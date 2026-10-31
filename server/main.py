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

from .app.layoutlib import Index, load_json
from .app.planner import plan_offline
from .app.storage import Store
from .app.validate import validate_steps

ROOT = Path(__file__).resolve().parents[1]


def create_app(db_path=None, layouts=None, static_dir=None):
    plan_schema = load_json(ROOT / "contracts/plan.schema.json")
    request_validator = Draft202012Validator({**plan_schema, "$ref": "#/$defs/request"})
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
        holding = (payload.get("robot") or {}).get("holding")
        if holding is not None and holding not in index.objects:
            raise HTTPException(422, "unknown_holding")
        response = plan_offline(payload["query"], index, payload)
        checked(response_validator, response)
        errors = validate_steps(index, response["steps"], holding)
        if errors:
            raise HTTPException(422, errors)
        if response.get("corrected"):
            target = response["corrected_to"]
            store.correct(payload["layout_id"], {"object_id": response["corrected_object"],
                          "room": index.furniture[target]["room"], "pos": index.surface_pos(target)})
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
        return store.correct(layout_id, {"object_id": object_id, "room": index.furniture[target]["room"],
                                        "pos": index.surface_pos(target)})

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
        holding = (payload.get("robot") or {}).get("holding")
        if validate_steps(index, plan_value["steps"], holding):
            raise HTTPException(422, "invalid_plan_steps")
        if not isinstance(payload.get("query"), str) or not payload["query"].strip():
            raise HTTPException(422, "invalid_query")
        steps = payload.get("steps")
        duration = payload.get("duration_ms")
        if not isinstance(steps, list) or len(steps) > 10000 or any(not isinstance(s, dict) for s in steps):
            raise HTTPException(422, "invalid_executed_steps")
        if isinstance(duration, bool) or not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration < 0:
            raise HTTPException(422, "invalid_duration")
        if not isinstance(payload.get("memory_enabled"), bool):
            raise HTTPException(422, "invalid_memory_enabled")
        return {"id": store.append_log(payload)}

    @router.get("/log")
    def get_log(layout_id: str, limit: int = Query(50, ge=1, le=1000)):
        index_for(layout_id)
        return store.logs(layout_id, limit)

    app.include_router(router)
    app.include_router(router, prefix="/api", include_in_schema=False)
    # Keep D's delivery resources separate from A/B/C-owned frontend modules.
    delivery = ROOT / "server/delivery"
    if delivery.is_dir():
        app.mount("/delivery", StaticFiles(directory=delivery, html=True), name="delivery")
    frontend = Path(static_dir or os.getenv("HOMETWIN_WEB_DIST", str(ROOT / "web/dist")))
    if frontend.is_dir():
        app.mount("/", StaticFiles(directory=frontend, html=True), name="frontend")
    else:
        @app.get("/", include_in_schema=False)
        def delivery_index():
            return RedirectResponse("/delivery/index.html" if delivery.is_dir() else "/docs")
    return app
