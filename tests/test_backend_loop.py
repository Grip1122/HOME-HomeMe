"""HTTP and SQLite acceptance gates independent of scene binaries and remote credentials."""
import copy
import json
import shutil
import sqlite3
import subprocess
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from server.main import create_app


@pytest.fixture
def client(tmp_path, layout):
    other = copy.deepcopy(layout)
    other["layout_id"] = "B"
    return TestClient(create_app(tmp_path / "loop.db", {"A": layout, "B": other}, static_dir=tmp_path / 'missing-dist'))


def payload(client):
    plan = client.post('/plan', json={"layout_id": "A", "query": "帮我找钥匙"}).json()
    return {"layout_id": "A", "query": "帮我找钥匙", "plan": plan,
            "steps": [{**s, "result": "succeeded"} for s in plan["steps"]],
            "duration_ms": 12, "memory_enabled": True}


@pytest.mark.parametrize("result", ["failed", "cancelled", "incomplete", "executor_error"])
def test_failed_execution_is_persisted_as_ok_false_after_restart(client, layout, result):
    value = payload(client)
    if result == "incomplete":
        value["steps"] = []
    elif result == "executor_error":
        value["ok"] = False  # The executor may fail after its last action completes.
    else:
        value["steps"][-1]["result"] = result
    assert client.post('/log', json=value).status_code == 200
    again = TestClient(create_app(client.app.state.store.path, {"A": layout}))
    row = again.get('/log?layout_id=A').json()[0]
    assert row["ok"] is False
    assert row["steps"] == value["steps"]


def test_success_requires_complete_execution_and_a_boolean_ok(client):
    value = payload(client)
    assert client.post('/log', json=value).status_code == 200
    assert client.get('/log?layout_id=A').json()[0]["ok"] is True
    for invalid in ({**value, "steps": [], "ok": True}, {**value, "ok": "true"}):
        assert client.post('/log', json=invalid).status_code == 422
    assert len(client.get('/log?layout_id=A').json()) == 1


def test_planning_and_failed_corrective_execution_do_not_change_memory(client):
    entry = {"object_id": "cup_red", "room": "living", "pos": [-3, .75, 2.85]}
    client.post('/memory/observe', json={"layout_id": "A", "entries": [entry]})
    before = client.get('/memory?layout_id=A').json()
    query = {"layout_id": "A", "query": "不对，应该放书房", "last_object": "cup_red"}
    plan = client.post('/plan', json=query).json()
    assert plan["source"] == "corrective" and plan["corrected"] is True
    value = {**payload(client), **query, "plan": plan,
             "steps": [{**plan["steps"][0], "result": "failed"}]}
    assert client.post('/log', json=value).status_code == 200
    assert client.get('/memory?layout_id=A').json() == before
    with sqlite3.connect(client.app.state.store.path) as db:
        assert db.execute('SELECT count(*) FROM memory_history').fetchone()[0] == 1


def test_layout_switch_keeps_observations_corrections_and_logs_isolated(client):
    for layout_id, to in (("A", "desk"), ("B", "table_coffee")):
        assert client.post('/memory/correct', json={"layout_id": layout_id, "object_id": "cup_red", "to": to}).status_code == 200
        value = {**payload(client), "layout_id": layout_id}
        assert client.post('/log', json=value).status_code == 200
    assert client.get('/memory?layout_id=A').json()[0]["room"] == "study"
    assert client.get('/memory?layout_id=B').json()[0]["room"] == "living"
    client.post('/memory/reset', json={"layout_id": "B"})
    assert client.get('/memory?layout_id=B').json() == []
    assert client.get('/memory?layout_id=A').json()[0]["confidence"] == .9
    assert [r["layout_id"] for r in client.get('/log?layout_id=A').json()] == ["A"]


@pytest.mark.parametrize("origin", ["cache", "rule", "llm", "corrective"])
def test_every_planning_source_passes_semantic_validation_at_the_exit(tmp_path, layout, monkeypatch, origin):
    bad = {"say": "bad", "source": origin, "steps": [{"action": "drop", "target": "cup_red", "to": "desk"}]}
    monkeypatch.setattr('server.app.planner.load_cache', lambda: {"找水杯": bad} if origin == "cache" else {})
    monkeypatch.setattr('server.app.planner.plan_command', lambda *args: bad if origin == "rule" else None)
    monkeypatch.setattr('server.app.planner.rules.try_correct', lambda *args: bad if origin == "corrective" else None)
    client = TestClient(create_app(tmp_path / "db", {"A": layout}, online_planner=(lambda *args: bad) if origin == "llm" else None))
    response = client.post('/plan', json={"layout_id": "A", "query": "找水杯"})
    assert response.status_code == 200
    assert response.json()["steps"] == []
    assert response.json()["source"] == "rule"


def test_online_output_is_labelled_llm_and_cannot_impersonate_correction(tmp_path, layout, monkeypatch):
    monkeypatch.setattr('server.app.planner.load_cache', lambda: {})
    response = {"say": "收到", "source": "cache", "steps": [{"action": "find", "target": "cup_red"}]}
    client = TestClient(create_app(tmp_path / "db", {"A": layout}, online_planner=lambda *args: dict(response)))
    assert client.post('/plan', json={"layout_id": "A", "query": "定位水杯"}).json()["source"] == "llm"
    response.update(corrected=True, corrected_to="desk", corrected_object="cup_red")
    assert client.post('/plan', json={"layout_id": "A", "query": "定位水杯"}).json()["steps"] == []


def test_online_timeout_falls_back_and_correction_never_calls_provider(tmp_path, layout, monkeypatch):
    monkeypatch.setattr('server.app.planner.load_cache', lambda: {})
    calls = []
    def timeout(*args):
        calls.append(args)
        raise TimeoutError()
    client = TestClient(create_app(tmp_path / "db", {"A": layout}, online_planner=timeout))
    value = client.post('/plan', json={"layout_id": "A", "query": "找红色水杯"}).json()
    assert value["source"] == "rule" and value["steps"][0]["action"] == "find"
    assert client.post('/plan', json={"layout_id": "A", "query": "不对，应该放书房", "last_object": "cup_red"}).json()["source"] == "corrective"
    assert len(calls) == 1


def test_experimental_previews_are_excluded_from_default_demo_chain(client):
    for path in ('/delivery/robot/robot.html', '/delivery/vendor/playcanvas.mjs'):
        assert client.get(path).status_code == 404
    assert client.get('/', follow_redirects=False).headers['location'] == '/docs'
    assert client.get('/api/client/home-client.mjs').status_code == 200


def test_actual_corrected_position_is_validated_before_memory_write(client):
    response = client.post('/memory/correct', json={"layout_id": "A", "object_id": "cup_red", "to": "desk", "pos": [999, 1, 999]})
    assert response.status_code == 422
    assert client.get('/memory?layout_id=A').json() == []


def test_existing_sqlite_log_rows_are_migrated_without_losing_history(tmp_path):
    from server.app.storage import Store
    path = tmp_path / 'legacy.db'
    value = {"say": "ok", "source": "cache", "steps": [{"action": "find", "target": "cup_red"}]}
    with sqlite3.connect(path) as db:
        db.execute('CREATE TABLE task_log (id INTEGER PRIMARY KEY,layout_id TEXT,query TEXT,plan_json TEXT,source TEXT,steps_json TEXT,step_count INTEGER,duration_ms REAL,corrected INTEGER,memory_enabled INTEGER,created_at TEXT)')
        db.execute('INSERT INTO task_log VALUES (1,?,?,?,?,?,?,?,?,?,?)', ('A', '找杯子', json.dumps(value), 'cache', json.dumps([{**value['steps'][0], 'result': 'failed'}]), 1, 12, 0, 1, 'legacy'))
    for _ in range(2):  # Startup migrations must be repeatable.
        row = Store(path).logs('A', 1)[0]
        assert row['id'] == 1 and row['ok'] is False and row['created_at'] == 'legacy'


def test_http_adapter_handles_success_failure_cancellation_and_concurrent_calls():
    node = shutil.which('node')
    if node is None:
        pytest.skip('Node is required for A/D adapter acceptance')
    root = Path(__file__).resolve().parents[1]
    result = subprocess.run([node, '--test', 'tests/node/home-client.test.mjs'], cwd=root, capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stdout + result.stderr
