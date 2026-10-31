"""生成前端寻路网格的参照快照（web/src/nav/__fixtures__/*.nav.json）。

快照由 `server/app/layoutlib.py`（后端参照实现）产出，供 `web/src/nav/grid.test.js`
在 Node 里逐格比对，确保「前端 nav/grid.js 与后端同一套规则」（任务书步骤 1.3）。

用法：
    python scripts/gen_nav_fixture.py                    # 生成全部
    python scripts/gen_nav_fixture.py --check            # 只校验快照是否过期

改了 layout 或 layoutlib 之后必须重跑本脚本，否则 `tests/test_nav_fixture.py` 会红。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from server.app import layoutlib as L  # noqa: E402

LAYOUTS = {
    "A": ROOT / "web" / "public" / "layouts" / "layout_A.json",
}

FIXTURE_DIR = ROOT / "web" / "src" / "nav" / "__fixtures__"

NOTE = (
    "自动生成，勿手改。规则源：server/app/layoutlib.py；"
    "重跑：python scripts/gen_nav_fixture.py"
)


def sha256_of(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build(layout_path: Path) -> dict:
    layout = L.load_json(layout_path)
    g = layout["grid"]
    blocked = sorted(L.blocked_cells(layout))
    reachable = {}
    for room in layout["rooms"]:
        sx, _, sz = room["scan_point"]
        start = L.world_to_cell(layout, sx, sz)
        reachable[room["id"]] = sorted(L.reachable_cells(layout, start, set(blocked)))

    # 跨分区相邻格的门洞判定：逐行探测左右两列，验证“只有门洞内才连通”。
    probes = []
    for c in range(g["cols"] - 1):
        for r in range(g["rows"]):
            a, b = (c, r), (c + 1, r)
            if L.room_of_cell(layout, *a) == L.room_of_cell(layout, *b):
                continue
            probes.append({"a": list(a), "b": list(b), "open": L._door_open(layout, a, b)})

    return {
        "$note": NOTE,
        "layout": layout_path.relative_to(ROOT).as_posix(),
        "layout_sha256": sha256_of(layout_path),
        "grid": {
            "cols": g["cols"],
            "rows": g["rows"],
            "cell": g["cell"],
            "origin": g["origin"],
        },
        "robot_radius": L.ROBOT_RADIUS,
        "blocked": [list(cell) for cell in blocked],
        "reachable": reachable,
        "boundary_probes": probes,
    }


def dump(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False, indent=1, sort_keys=False) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="只校验，不写盘")
    args = ap.parse_args(argv)

    FIXTURE_DIR.mkdir(parents=True, exist_ok=True)
    stale = []
    for name, path in LAYOUTS.items():
        target = FIXTURE_DIR / f"layout_{name}.nav.json"
        text = dump(build(path))
        if args.check:
            current = target.read_text(encoding="utf-8") if target.exists() else ""
            if current != text:
                stale.append(target.relative_to(ROOT).as_posix())
            continue
        target.write_text(text, encoding="utf-8", newline="\n")
        print(f"[OK]  写入 {target.relative_to(ROOT).as_posix()} ({len(text)} 字节)")

    if args.check:
        if stale:
            print("[FAIL] 快照已过期：", ", ".join(stale))
            print("       重跑 python scripts/gen_nav_fixture.py")
            return 1
        print("[OK]   寻路快照与当前布局 / layoutlib 一致")
    return 0


if __name__ == "__main__":
    sys.exit(main())
