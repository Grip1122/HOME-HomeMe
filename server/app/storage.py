"""SQLite persistence; confidence formulas remain in app.memory."""
from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
import json
import sqlite3
import threading

from . import memory


def execution_ok(payload):
    steps = payload["steps"]
    return (len(steps) == len(payload["plan"]["steps"])
            and all(step.get("result") == "succeeded" for step in steps))


class Store:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.lock = threading.RLock()
        with self.connection() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS spatial_memory (
                  layout_id TEXT NOT NULL, object_id TEXT NOT NULL, room TEXT NOT NULL,
                  pos_x REAL NOT NULL, pos_y REAL NOT NULL, pos_z REAL NOT NULL,
                  confidence REAL NOT NULL, source TEXT NOT NULL, status TEXT NOT NULL,
                  updated_at TEXT NOT NULL, PRIMARY KEY(layout_id, object_id));
                CREATE TABLE IF NOT EXISTS memory_history (
                  id INTEGER PRIMARY KEY, layout_id TEXT NOT NULL,
                  object_id TEXT NOT NULL, previous_json TEXT, next_json TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS task_log (
                  id INTEGER PRIMARY KEY, layout_id TEXT NOT NULL, query TEXT NOT NULL,
                  plan_json TEXT NOT NULL, source TEXT NOT NULL, steps_json TEXT NOT NULL,
                  step_count INTEGER NOT NULL, duration_ms REAL NOT NULL,
                  corrected INTEGER NOT NULL, memory_enabled INTEGER NOT NULL,
                  created_at TEXT NOT NULL);
            """)
        # Additive migration: preserve existing databases and execution history.
        with self.connection() as db:
            columns = {row["name"] for row in db.execute("PRAGMA table_info(task_log)")}
            if "ok" not in columns:
                db.execute("ALTER TABLE task_log ADD COLUMN ok INTEGER NOT NULL DEFAULT 0")
                for row in db.execute("SELECT id,plan_json,steps_json FROM task_log").fetchall():
                    value = {"plan": json.loads(row["plan_json"]), "steps": json.loads(row["steps_json"])}
                    db.execute("UPDATE task_log SET ok=? WHERE id=?", (int(execution_ok(value)), row["id"]))
            if "reason" not in columns:
                db.execute("ALTER TABLE task_log ADD COLUMN reason TEXT")

    @contextmanager
    def connection(self):
        with self.lock:
            db = sqlite3.connect(self.path, timeout=10)
            db.row_factory = sqlite3.Row
            try:
                with db:
                    # Serialize read-modify-write across independent Store instances/processes.
                    db.execute("BEGIN IMMEDIATE")
                    yield db
            finally:
                db.close()

    @staticmethod
    def record(row):
        if row is None:
            raise KeyError("memory_not_found")
        return {"layout_id": row["layout_id"], "object_id": row["object_id"],
                "room": row["room"], "pos": [row["pos_x"], row["pos_y"], row["pos_z"]],
                **{key: row[key] for key in ("confidence", "source", "status", "updated_at")}}

    def list_memory(self, layout_id):
        with self.connection() as db:
            return [self.record(row) for row in db.execute(
                "SELECT * FROM spatial_memory WHERE layout_id=? ORDER BY object_id", (layout_id,))]

    def _write(self, db, layout_id, entry, confidence, source, status):
        now = datetime.now(timezone.utc).isoformat()
        result = {"layout_id": layout_id, "object_id": entry["object_id"], "room": entry["room"],
                  "pos": list(entry["pos"]), "confidence": confidence,
                  "source": source, "status": status, "updated_at": now}
        previous = db.execute("SELECT * FROM spatial_memory WHERE layout_id=? AND object_id=?",
                              (layout_id, entry["object_id"])).fetchone()
        db.execute("INSERT OR REPLACE INTO spatial_memory VALUES (?,?,?,?,?,?,?,?,?,?)",
                   (layout_id, entry["object_id"], entry["room"], *entry["pos"], confidence, source, status, now))
        db.execute("INSERT INTO memory_history(layout_id,object_id,previous_json,next_json) VALUES (?,?,?,?)",
                   (layout_id, entry["object_id"], json.dumps(self.record(previous)) if previous else None,
                    json.dumps(result)))
        return result

    def observe(self, layout_id, entries, rescan=False):
        with self.connection() as db:
            return [self._write(db, layout_id, entry,
                                memory.on_rescan_found() if rescan else memory.on_observe_first(),
                                "rescan" if rescan else "observe", memory.status_default()) for entry in entries]

    def update_confidence(self, layout_id, object_id, hit):
        with self.connection() as db:
            old = self.record(db.execute("SELECT * FROM spatial_memory WHERE layout_id=? AND object_id=?",
                                         (layout_id, object_id)).fetchone())
            confidence = memory.on_hit(old["confidence"]) if hit else memory.on_miss(old["confidence"])
            status = memory.status_default() if hit else memory.status_after_miss(old["confidence"])
            return self._write(db, layout_id, old, confidence, old["source"], status)

    def correct(self, layout_id, entry):
        with self.connection() as db:
            row = db.execute("SELECT * FROM spatial_memory WHERE layout_id=? AND object_id=?",
                             (layout_id, entry["object_id"])).fetchone()
            if row:
                old = self.record(row)
                self._write(db, layout_id, old, memory.on_correct_old(old["confidence"]), "correct", "stale")
            return self._write(db, layout_id, entry, memory.on_correct_new(), "correct", memory.status_default())

    def reset(self, layout_id, entries):
        with self.connection() as db:
            db.execute("DELETE FROM spatial_memory WHERE layout_id=?", (layout_id,))
            return [self._write(db, layout_id, entry, entry["confidence"], "seed", entry["status"])
                    for entry in entries]

    def append_log(self, payload):
        plan = payload["plan"]
        with self.connection() as db:
            result = db.execute("""INSERT INTO task_log
                (layout_id,query,plan_json,source,steps_json,step_count,duration_ms,corrected,memory_enabled,created_at,ok,reason)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                (payload["layout_id"], payload["query"], json.dumps(plan), plan["source"],
                 json.dumps(payload["steps"]), len(payload["steps"]), payload["duration_ms"],
                 int(plan.get("corrected", False)), int(payload["memory_enabled"]),
                 datetime.now(timezone.utc).isoformat(),
                 int(execution_ok(payload) and payload.get("ok", True)), payload.get("reason")))
            return result.lastrowid

    def logs(self, layout_id, limit):
        with self.connection() as db:
            rows = db.execute("SELECT * FROM task_log WHERE layout_id=? ORDER BY id DESC LIMIT ?",
                              (layout_id, limit)).fetchall()
            return [{**dict(row), "ok": bool(row["ok"]), "plan": json.loads(row["plan_json"]),
                     "steps": json.loads(row["steps_json"])} for row in rows]
