"""把前端真实执行器产出的 /log 请求体送进 #13 的 FastAPI + SQLite，核对写入、回读与重启后的持久化。

用法（#13 尚未合入 main，必须显式指向它的 checkout）：
  python web/scripts/log-e2e/verify_log_e2e.py --server-root <#13 worktree> --payloads payloads.json
退出码 0 = 全部断言通过。
"""
import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("--server-root", required=True)
ap.add_argument("--payloads", required=True)
args = ap.parse_args()

server_root = Path(args.server_root).resolve()
sys.path.insert(0, str(server_root))
from fastapi.testclient import TestClient  # noqa: E402
from server.main import create_app  # noqa: E402

web = Path(__file__).resolve().parents[2]
layout = json.loads((web / "public/layouts/layout_A.json").read_text(encoding="utf-8"))
data = json.loads(Path(args.payloads).read_text(encoding="utf-8"))
sha = subprocess.run(["git", "-C", str(server_root), "rev-parse", "HEAD"], capture_output=True, text=True).stdout.strip()
print(f"#13 server sha = {sha}")

failures = []


def check(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg)
    if not cond:
        failures.append(msg)


with tempfile.TemporaryDirectory() as tmp:
    db = Path(tmp) / "e2e.sqlite"
    client = TestClient(create_app(db, {"A": layout}), raise_server_exceptions=False)

    expect = {
        "ok": (["succeeded"] * 3, 3),
        "fail": (["failed"], 1),
        "cancel": None,
    }
    ids = {}
    for name in ("ok", "fail", "cancel"):
        r = client.post("/log", json=data[name]["payload"])
        check(r.status_code == 200, f"{name}: POST /log -> {r.status_code} {r.text[:120]}")
        ids[name] = r.json().get("id")

    def rows(c):
        return {row["id"]: row for row in c.get("/log", params={"layout_id": "A"}).json()}

    def verify(c, label):
        got = rows(c)
        check(len(got) == 3, f"{label}: 共 3 行（实际 {len(got)}）")
        for name in ("ok", "fail", "cancel"):
            row = got.get(ids[name])
            if row is None:
                check(False, f"{label}: {name} 行存在")
                continue
            sent = data[name]["payload"]
            results = [s["result"] for s in row["steps"]]
            check(results == [s["result"] for s in sent["steps"]], f"{label}: {name} 步骤结果 {results}")
            check(row["step_count"] == len(sent["steps"]), f"{label}: {name} step_count={row['step_count']}")
            check(row["query"] == sent["query"], f"{label}: {name} query 一致")
        ok_row = got.get(ids["ok"])
        if ok_row:
            check(ok_row["steps"][2].get("to") == "table_coffee", f"{label}: ok 的 drop 保留 to")
        cancel_row = got.get(ids["cancel"])
        if cancel_row:
            check(cancel_row["steps"][-1]["result"] == "cancelled" and cancel_row["step_count"] < 3,
                  f"{label}: cancel 末步 cancelled 且短于计划")

    verify(client, "写入后")

    client2 = TestClient(create_app(db, {"A": layout}), raise_server_exceptions=False)
    verify(client2, "重启后")

    before = len(rows(client2))
    bad = json.loads(json.dumps(data["ok"]["payload"]))
    bad["steps"][2]["result"] = "running"
    check(client2.post("/log", json=bad).status_code == 422, "result=running -> 422")
    bad = json.loads(json.dumps(data["ok"]["payload"]))
    bad["steps"][0]["result"] = "failed"
    check(client2.post("/log", json=bad).status_code == 422, "失败不在末位 -> 422")
    bad = json.loads(json.dumps(data["ok"]["payload"]))
    del bad["steps"][2]["to"]
    check(client2.post("/log", json=bad).status_code == 422, "drop 丢失 to（旧事件载荷的失真形态）-> 422")
    check(len(rows(client2)) == before, "被拒请求未写库")

print(f"\n{'ALL PASS' if not failures else str(len(failures)) + ' FAILED'}")
sys.exit(1 if failures else 0)
