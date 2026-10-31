"""Real ASGI boundary tests: frozen schemas, persistence, concurrent writes and correction."""
from concurrent.futures import ThreadPoolExecutor
import copy
import sqlite3

from fastapi.testclient import TestClient
import pytest

from server.main import create_app


@pytest.fixture
def client(tmp_path, layout):
    second = copy.deepcopy(layout)
    second["layout_id"] = "B"
    return TestClient(create_app(tmp_path / "memory.db", {"A": layout, "B": second}))


def observe(client, object_id="cup_red", **extra):
    return client.post("/memory/observe", json={"layout_id": "A", "entries": [
        {"object_id": object_id, "room": "living", "pos": [-3, .75, 2.85]}], **extra})


def test_plan_preserves_corrective_source_and_updates_memory(client):
    observe(client)
    response = client.post("/plan", json={"query": "不对，应该放书房", "layout_id": "A", "last_object": "cup_red"})
    assert response.status_code == 200
    value = response.json()
    assert value["source"] == "corrective"
    assert len(value["steps"]) == 4
    record = client.get("/memory", params={"layout_id": "A"}).json()[0]
    assert record["confidence"] == .90 and record["room"] == "study"
    assert record["source"] == "correct" and record["status"] == "fresh"
    with sqlite3.connect(client.app.state.store.path) as db:
        history = db.execute("SELECT next_json FROM memory_history ORDER BY id").fetchall()
    assert '"confidence": 0.5' in history[-2][0]


@pytest.mark.parametrize("payload", [{}, {"query": "", "layout_id": "A"},
    {"query": "找水杯", "layout_id": "A", "extra": True},
    {"query": "找水杯", "layout_id": "A", "robot": {"holding": "unknown"}}])
def test_invalid_plan_request_returns_422_instead_of_500(client, payload):
    assert client.post("/plan", json=payload).status_code == 422


def test_unknown_layout_returns_404_and_api_prefix_matches(client):
    assert client.post("/plan", json={"query": "找水杯", "layout_id": "missing"}).status_code == 404
    assert client.get("/api/health").json() == client.get("/health").json()


def test_offline_plan_uses_existing_cache_with_different_memory(client):
    for enabled in (False, True):
        result = client.post("/plan", json={"query": "我的红色水杯在哪", "layout_id": "A", "memory_enabled": enabled})
        assert result.status_code == 200
        assert result.json()["source"] == "cache"
        assert result.json()["steps"] == [{"action": "find", "target": "cup_red"}]


def test_invalid_planner_response_is_rejected_at_the_http_boundary(client, monkeypatch):
    monkeypatch.setattr("server.main.plan_offline", lambda *args: {"say": "bad", "steps": [], "source": "invented"})
    response = client.post("/plan", json={"query": "我的红色水杯在哪", "layout_id": "A"})
    assert response.status_code == 422


def test_illegal_step_order_is_rejected_even_when_response_schema_is_valid(client, monkeypatch):
    monkeypatch.setattr("server.main.plan_offline", lambda *args: {"say": "bad", "steps": [
        {"action": "drop", "target": "cup_red", "to": "desk"}], "source": "rule"})
    response = client.post("/plan", json={"query": "我的红色水杯在哪", "layout_id": "A"})
    assert response.status_code == 422


def test_observation_miss_rescan_and_hit_use_existing_confidence_functions(client):
    assert observe(client).json()[0]["confidence"] == .8
    request = {"layout_id": "A", "object_id": "cup_red"}
    assert client.post("/memory/hit", json=request).json()["confidence"] == .85
    missed = client.post("/memory/miss", json=request).json()
    assert missed["confidence"] == .45 and missed["status"] == "stale"
    assert observe(client, rescan=True).json()[0]["confidence"] == .8


def test_parallel_hits_do_not_lose_updates(client):
    observe(client)
    def hit(_):
        return client.post("/memory/hit", json={"layout_id": "A", "object_id": "cup_red"})
    with ThreadPoolExecutor(max_workers=4) as pool:
        assert all(r.status_code == 200 for r in pool.map(hit, range(4)))
    assert client.get("/memory", params={"layout_id": "A"}).json()[0]["confidence"] == 1.0


def test_duplicate_observations_reject_entire_batch_without_partial_write(client):
    entry = {"object_id": "cup_red", "room": "living", "pos": [0, .75, 0]}
    response = client.post("/memory/observe", json={"layout_id": "A", "entries": [entry, entry]})
    assert response.status_code == 422
    assert client.get("/memory", params={"layout_id": "A"}).json() == []


@pytest.mark.parametrize("entry", [{"object_id": {}}, {"object_id": "unknown"},
    {"object_id": "cup_red", "room": [], "pos": [0, 0, 0]},
    {"object_id": "cup_red", "room": "living", "pos": [True, 0, 0]}])
def test_malformed_observation_is_visible_as_422(client, entry):
    assert client.post("/memory/observe", json={"layout_id": "A", "entries": [entry]}).status_code == 422


def test_layout_memory_is_partitioned_and_survives_server_restart(client, layout):
    observe(client)
    assert client.get("/memory", params={"layout_id": "B"}).json() == []
    again = TestClient(create_app(client.app.state.store.path, {"A": layout}))
    assert again.get("/memory", params={"layout_id": "A"}).json()[0]["object_id"] == "cup_red"
    assert client.post("/memory/reset", json={"layout_id": "B"}).json() == []
    assert len(client.get("/memory", params={"layout_id": "A"}).json()) == 1


def test_missing_memory_and_non_surface_correction_are_rejected(client):
    assert client.post("/memory/miss", json={"layout_id": "A", "object_id": "cup_red"}).status_code == 404
    assert client.post("/memory/correct", json={"layout_id": "A", "object_id": "cup_red", "to": "sofa"}).status_code == 422


def test_log_uses_plan_source_correction_flag_and_actual_execution_count(client):
    plan = client.post("/plan", json={"query": "不对，应该放书房", "layout_id": "A", "last_object": "cup_red"}).json()
    payload = {"layout_id": "A", "query": "不对，应该放书房", "plan": plan,
               "steps": [{"action": "go", "ok": True, "ms": 200}],
               "duration_ms": 200, "memory_enabled": True}
    assert client.post("/log", json=payload).status_code == 200
    row = client.get("/log", params={"layout_id": "A"}).json()[0]
    assert row["source"] == "corrective" and row["corrected"] == 1
    assert row["step_count"] == 1 and row["duration_ms"] == 200
    assert client.post("/log", json={**payload, "duration_ms": -1}).status_code == 422
    assert client.get("/log", params={"layout_id": "A", "limit": 0}).status_code == 422


def test_reset_seed_validates_confidence_before_deleting_existing_memory(client):
    observe(client)
    entry = {"object_id": "cup_red", "room": "living", "pos": [0, .75, 0], "confidence": 1.1, "status": "fresh"}
    assert client.post("/memory/reset", json={"layout_id": "A", "entries": [entry]}).status_code == 422
    assert client.get("/memory", params={"layout_id": "A"}).json()[0]["confidence"] == .8


def test_delivery_preview_serves_shared_assets_without_a_second_copy(client):
    """D's preview reuses repo-root assets/ and the archived PlayCanvas; no duplicate copy under server/delivery/."""
    from server.main import ROOT
    glb = client.get("/delivery/assets/robot/roomscan-rs01.glb")
    assert glb.status_code == 200
    assert glb.content == (ROOT / "assets/robot/roomscan-rs01.glb").read_bytes()
    assert client.get("/delivery/assets/robot/manifest.json").json()["tracks"]
    assert client.get("/delivery/vendor/playcanvas.mjs").status_code == 200
    assert client.get("/delivery/robot/robot.html").status_code == 200
    assert not (ROOT / "server/delivery/roomscan").exists()
