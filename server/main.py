"""HOME D-owned HTTP boundary; frozen contracts and existing planner remain authoritative."""
from __future__ import annotations

import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Body, FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from jsonschema import Draft202012Validator, FormatChecker

from .app.layoutlib import Index, load_json, furniture_box
from .app.planner import plan_offline
from .app.storage import Store, execution_ok
from .app.validate import validate_steps

ROOT = Path(__file__).resolve().parents[1]


def create_app(db_path=None, layouts=None, static_dir=None, *, online_planner=None):
    plan_schema = load_json(ROOT / "contracts/plan.schema.json")
    request_validator = Draft202012Validator({**plan_schema, "$ref": "#/$defs/request"})
    robot_validator = Draft202012Validator(plan_schema["$defs"]["request"]["properties"]["robot"])
    step_validator = Draft202012Validator({**plan_schema, "$ref": "#/$defs/step"})
    response_validator = Draft202012Validator({**plan_schema, "$ref": "#/$defs/response"})
    memory_validator = Draft202012Validator(load_json(ROOT / "contracts/memory.schema.json"), format_checker=FormatChecker())
    layout_validator = Draft202012Validator(load_json(ROOT / "contracts/layout.schema.json"))
    store = Store(db_path or os.getenv("HOMETWIN_DB", str(ROOT / "server/app/hometwin.db")))
    app = FastAPI(title="HOME · 小觅 D 服务", version="1.0")
    app.state.store = store
    router = APIRouter()

    def checked(validator, value):
        def finite(item):
            if isinstance(item, float) and not math.isfinite(item):
                raise HTTPException(422, "non_finite_number")
            if isinstance(item, dict):
                for child in item.values():
                    finite(child)
            elif isinstance(item, list):
                for child in item:
                    finite(child)
        finite(value)
        errors = sorted(validator.iter_errors(value), key=lambda e: str(list(e.path)))
        if errors:
            raise HTTPException(422, detail=[{"path": list(e.path), "message": e.message} for e in errors])

    def index_for(layout_id):
        if not isinstance(layout_id, str) or not layout_id or len(layout_id) > 200:
            raise HTTPException(422, "invalid_layout_id")
        if layouts is not None:
            data = layouts.get(layout_id)
        else:
            # IDs are matched against file contents; never interpolated into paths.
            directory = Path(os.getenv("HOMETWIN_LAYOUT_DIR", str(ROOT / "web/public/layouts")))
            data = next((v for p in sorted(directory.glob("*.json"))
                         if (v := load_json(p)).get("layout_id") == layout_id), None)
        if data is None:
            raise HTTPException(404, "unknown_layout")
        checked(layout_validator, data)
        return Index(data)

    def identity(payload, index):
        object_id = payload.get("object_id")
        if not isinstance(object_id, str) or object_id not in index.objects:
            raise HTTPException(422, "unknown_object")
        return object_id

    def robot_holding(payload, index):
        robot = payload.get("robot", {})
        checked(robot_validator, robot)
        holding = robot.get("holding")
        if holding is not None and holding not in index.objects:
            raise HTTPException(422, "unknown_holding")
        return holding

    def observations(payload, index):
        entries = payload.get("entries")
        if not isinstance(entries, list) or len(entries) > len(index.objects):
            raise HTTPException(422, "invalid_entries")
        seen = set()
        for entry in entries:
            if not isinstance(entry, dict):
                raise HTTPException(422, "invalid_entry")
            object_id = identity(entry, index)
            if object_id in seen:
                raise HTTPException(422, "duplicate_object")
            seen.add(object_id)
            if not isinstance(entry.get("room"), str) or entry["room"] not in index.rooms:
                raise HTTPException(422, "unknown_room")
            pos = entry.get("pos")
            if not isinstance(pos, list) or len(pos) != 3 or any(
                isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) for v in pos
            ):
                raise HTTPException(422, "invalid_position")
        return entries

    @router.get("/health")
    def health():
        return {"status": "ok", "planner": "offline", "scene": "scene_main"}

    @router.post("/plan")
    def plan(payload: dict = Body(...)):
        checked(request_validator, payload)
        index = index_for(payload["layout_id"])
        holding = robot_holding(payload, index)
        if online_planner is None:
            response = plan_offline(payload["query"], index, payload)
        else:
            response = plan_offline(payload["query"], index, payload, online=online_planner)
        checked(response_validator, response)
        errors = validate_steps(index, response["steps"], holding)
        if errors:
            raise HTTPException(422, errors)
        # Planning is read-only. The executor commits a correction through /memory/correct
        # only after drop succeeds, so failed/cancelled plans cannot move remembered objects.
        return response

    @router.get("/memory")
    def get_memory(layout_id: str):
        index_for(layout_id)
        result = store.list_memory(layout_id)
        for entry in result:
            checked(memory_validator, entry)
        return result

    @router.post("/memory/observe")
    def observe(payload: dict = Body(...)):
        layout_id = payload.get("layout_id")
        index = index_for(layout_id)
        entries = observations(payload, index)
        if "rescan" in payload and not isinstance(payload["rescan"], bool):
            raise HTTPException(422, "invalid_rescan")
        return store.observe(layout_id, entries, payload.get("rescan", False))

    def confidence_update(payload, hit):
        layout_id = payload.get("layout_id")
        object_id = identity(payload, index_for(layout_id))
        try:
            return store.update_confidence(layout_id, object_id, hit)
        except KeyError as exc:
            raise HTTPException(404, "memory_not_found") from exc

    @router.post("/memory/hit")
    def hit(payload: dict = Body(...)):
        return confidence_update(payload, True)

    @router.post("/memory/miss")
    def miss(payload: dict = Body(...)):
        return confidence_update(payload, False)

    @router.post("/memory/correct")
    def correct(payload: dict = Body(...)):
        layout_id = payload.get("layout_id")
        index = index_for(layout_id)
        object_id = identity(payload, index)
        target = payload.get("to")
        if not isinstance(target, str) or target not in index.furniture or not index.furniture[target]["surface"]:
            raise HTTPException(422, "invalid_surface")
        entry = {"object_id": object_id, "room": index.furniture[target]["room"],
                 "pos": payload.get("pos", index.surface_pos(target))}
        observations({"entries": [entry]}, index)
        x0, z0, x1, z1 = furniture_box(index.furniture[target])
        if not (x0 <= entry["pos"][0] <= x1 and z0 <= entry["pos"][2] <= z1):
            raise HTTPException(422, "position_outside_surface")
        return store.correct(layout_id, entry)

    @router.post("/memory/reset")
    def reset(payload: dict = Body(...)):
        layout_id = payload.get("layout_id")
        index = index_for(layout_id)
        entries = observations({**payload, "entries": payload.get("entries", [])}, index)
        for entry in entries:
            checked(memory_validator, {**entry, "layout_id": layout_id, "source": "seed", "updated_at": datetime.now(timezone.utc).isoformat()})
        return store.reset(layout_id, entries)

    @router.post("/log")
    def append_log(payload: dict = Body(...)):
        index = index_for(payload.get("layout_id"))
        plan_value = payload.get("plan")
        checked(response_validator, plan_value)
        holding = robot_holding(payload, index)
        if validate_steps(index, plan_value["steps"], holding):
            raise HTTPException(422, "invalid_plan_steps")
        if not isinstance(payload.get("query"), str) or not payload["query"].strip() or len(payload["query"]) > 200:
            raise HTTPException(422, "invalid_query")
        steps = payload.get("steps")
        duration = payload.get("duration_ms")
        if not isinstance(steps, list) or len(steps) > len(plan_value["steps"]):
            raise HTTPException(422, "invalid_executed_steps")
        for number, event in enumerate(steps):
            if not isinstance(event, dict) or event.get("result") not in ("succeeded", "failed", "cancelled"):
                raise HTTPException(422, "invalid_execution_result")
            instruction = {k: v for k, v in event.items() if k != "result"}
            checked(step_validator, instruction)
            if instruction != plan_value["steps"][number]:
                raise HTTPException(422, "execution_must_match_plan_prefix")
            if event["result"] != "succeeded" and number != len(steps) - 1:
                raise HTTPException(422, "execution_after_terminal_failure")
        if isinstance(duration, bool) or not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration < 0:
            raise HTTPException(422, "invalid_duration")
        if not isinstance(payload.get("memory_enabled"), bool):
            raise HTTPException(422, "invalid_memory_enabled")
        if "ok" in payload and not isinstance(payload["ok"], bool):
            raise HTTPException(422, "invalid_execution_ok")
        if payload.get("ok") is True and not execution_ok(payload):
            raise HTTPException(422, "execution_did_not_complete")
        if "reason" in payload and (not isinstance(payload["reason"], str) or len(payload["reason"]) > 200):
            raise HTTPException(422, "invalid_execution_reason")
        return {"id": store.append_log(payload)}

    @router.get("/log")
    def get_log(layout_id: str, limit: int = Query(50, ge=1, le=1000)):
        index_for(layout_id)
        return store.logs(layout_id, limit)

    app.include_router(router)
    app.include_router(router, prefix="/api", include_in_schema=False)
    # A may import the adapter through Vite's existing /api proxy without changing config.
    for prefix in ("/client", "/api/client"):
        app.mount(prefix, StaticFiles(directory=ROOT / "server/client"), name=prefix.strip("/"))
    # Keep D's delivery resources separate from A/B/C-owned frontend modules.
    delivery = ROOT / "server/delivery"
    if os.getenv("HOMETWIN_ENABLE_EXPERIMENTAL_DELIVERY") == "1" and delivery.is_dir():
        # Shared resources live once in the repo (assets/ owned by B, reference/ read-only archive).
        # Mount them under /delivery/ before the catch-all instead of copying; /assets is left to Vite's dist.
        for prefix, source in (("/delivery/assets", ROOT / "assets"),
                               ("/delivery/vendor", ROOT / "reference/hackerson/web/vendor")):
            if source.is_dir():
                app.mount(prefix, StaticFiles(directory=source), name=prefix.strip("/").replace("/", "-"))
        app.mount("/delivery", StaticFiles(directory=delivery, html=True), name="delivery")
    frontend = Path(static_dir or os.getenv("HOMETWIN_WEB_DIST", str(ROOT / "web/dist")))
    if frontend.is_dir():
        app.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")
    else:
        @app.get("/", include_in_schema=False)
        def delivery_index():
            return RedirectResponse("/docs")
    return app
