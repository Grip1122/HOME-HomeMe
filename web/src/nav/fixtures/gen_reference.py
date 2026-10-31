"""用后端参照实现 server/app/layoutlib.py 生成前端 nav/grid.js 的对账数据。

用法（在仓库根目录）：
    python web/src/nav/fixtures/gen_reference.py

产物 reference_layout_A.json 随 layout_A.json 的 sha256 一起存；布局改了而没重新生成，
前端对账测试会直接变红，防止"前后端规则悄悄分叉"。
"""
import hashlib
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT))

from server.app import layoutlib as L  # noqa: E402

LAYOUT_PATH = ROOT / "web/public/layouts/layout_A.json"
OUT = Path(__file__).with_name("reference_layout_A.json")

layout = L.load_json(LAYOUT_PATH)
blocked = L.blocked_cells(layout)
g = layout["grid"]

DIRS = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]

# 所有"跨分区且门洞放行"的相邻格对（有向，含对角）。
open_edges = []
for c in range(g["cols"]):
    for r in range(g["rows"]):
        for dc, dr in DIRS:
            b = (c + dc, r + dr)
            if not L.in_grid(layout, *b):
                continue
            ra, rb = L.room_of_cell(layout, c, r), L.room_of_cell(layout, *b)
            if ra is not None and rb is not None and ra != rb and L._door_open(layout, (c, r), b):
                open_edges.append([c, r, b[0], b[1]])

reach = {}
for room in layout["rooms"]:
    start = L.world_to_cell(layout, room["scan_point"][0], room["scan_point"][2])
    reach[room["id"]] = sorted([list(x) for x in L.reachable_cells(layout, start, blocked)])

union = set()
for cells in reach.values():
    union |= {tuple(x) for x in cells}

nearest = {}
for o in layout["objects"]:
    f = next(f for f in layout["furniture"] if f["id"] == o["on"])
    d_box = L.nearest_reach_distance(layout, union, 0, 0, L.furniture_box(f))
    d_pt = L.nearest_reach_distance(layout, union, o["pos"][0], o["pos"][2])
    nearest[o["id"]] = {"on": o["on"], "dist_to_furniture_box": round(d_box, 6), "dist_to_point": round(d_pt, 6)}

# 穿角：对角步 a->b 本身可走，但两条直角边之一不可走。后端 reachable_cells 禁止这类步。
def _ok(a, b):
    return L.in_grid(layout, *b) and b not in blocked and L._door_open(layout, a, b)

corner_forbidden = []
for c in range(g["cols"]):
    for r in range(g["rows"]):
        if (c, r) in blocked:
            continue
        for dc, dr in DIRS:
            if not (dc and dr):
                continue
            b = (c + dc, r + dr)
            if _ok((c, r), b) and not (_ok((c, r), (c + dc, r)) and _ok((c, r), (c, r + dr))):
                corner_forbidden.append([c, r, b[0], b[1]])

# 含网格外的点：向零取整和向下取整只在这里分歧（origin 为负，网格内 x-origin 恒为正）。
probe = [(-5.99, -4.49), (-0.0001, 0.0), (0.0, 0.0), (0.4999, 0.5), (5.99, 4.49), (3.0, -1.5), (-1.5, 0.0),
         (-6.2, 0.0), (0.0, -4.7), (-6.5, -5.0), (6.2, 4.7)]
w2c = [[x, z, *L.world_to_cell(layout, x, z)] for x, z in probe]

data = {
    "layout_sha256": hashlib.sha256(LAYOUT_PATH.read_bytes()).hexdigest(),
    "blocked": sorted([list(x) for x in blocked]),
    "open_edges": sorted(open_edges),
    "reachable_from_scan_point": reach,
    "nearest": nearest,
    "world_to_cell": w2c,
    "corner_forbidden": sorted(corner_forbidden),
}
OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
print(f"blocked={len(blocked)} open_edges={len(open_edges)} reach={ {k: len(v) for k, v in reach.items()} }")
print(f"nearest dist to furniture box: {[v['dist_to_furniture_box'] for v in nearest.values()]}")
