"""布局几何与索引：网格、门洞、可达性、地点/物体词典。

前端的 nav/grid.js 与本模块实现同一套规则；本模块是后端校验与离线脚本检查用的参照实现。
"""
from __future__ import annotations

import json
import math
from collections import deque
from pathlib import Path

ROBOT_RADIUS = 0.25   # 米，A* 外扩半径
GRAB_RADIUS = 1.0     # 米，逻辑上“够得着”的距离（水平面）


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


# ---------- 几何 ----------
def furniture_box(f):
    x, _, z = f["pos"]
    w, _, d = f["size"]
    return (x, z, x + w, z + d)


def furniture_top(f):
    return f["pos"][1] + f["size"][1]


def dist_to_box(px, pz, box):
    x0, z0, x1, z1 = box
    dx = max(x0 - px, 0.0, px - x1)
    dz = max(z0 - pz, 0.0, pz - z1)
    return math.hypot(dx, dz)


def cell_center(layout, c, r):
    g = layout["grid"]
    s = g["cell"]
    return (g["origin"][0] + (c + 0.5) * s, g["origin"][2] + (r + 0.5) * s)


def world_to_cell(layout, x, z):
    g = layout["grid"]
    s = g["cell"]
    return (int(math.floor((x - g["origin"][0]) / s)), int(math.floor((z - g["origin"][2]) / s)))


def in_grid(layout, c, r):
    g = layout["grid"]
    return 0 <= c < g["cols"] and 0 <= r < g["rows"]


def room_of_cell(layout, c, r):
    for room in layout["rooms"]:
        rc, rr, rw, rh = room["rect"]
        if rc <= c < rc + rw and rr <= r < rr + rh:
            return room["id"]
    return None


def blocked_cells(layout, radius=ROBOT_RADIUS):
    """家具包围盒外扩 radius 后，中心落入其内的格子不可通行。"""
    g = layout["grid"]
    boxes = [furniture_box(f) for f in layout["furniture"] if f.get("blocks")]
    out = set()
    for c in range(g["cols"]):
        for r in range(g["rows"]):
            cx, cz = cell_center(layout, c, r)
            for x0, z0, x1, z1 in boxes:
                if x0 - radius <= cx <= x1 + radius and z0 - radius <= cz <= z1 + radius:
                    out.add((c, r))
                    break
    return out


def _door_open(layout, a, b):
    ra, rb = room_of_cell(layout, *a), room_of_cell(layout, *b)
    if ra is None or rb is None:
        return False
    if ra == rb:
        return True
    (ax, az), (bx, bz) = cell_center(layout, *a), cell_center(layout, *b)
    mx, mz = (ax + bx) / 2, (az + bz) / 2
    s = layout["grid"]["cell"]
    for d in layout.get("doors", []):
        if set(d["between"]) != {ra, rb}:
            continue
        dx, _, dz = d["pos"]
        half = d["width"] / 2 + 1e-9
        if d["axis"] == "z" and abs(mx - dx) <= s and abs(mz - dz) <= half:
            return True
        if d["axis"] == "x" and abs(mz - dz) <= s and abs(mx - dx) <= half:
            return True
    return False


def reachable_cells(layout, start_cell, blocked=None):
    blocked = blocked_cells(layout) if blocked is None else blocked
    if start_cell in blocked or not in_grid(layout, *start_cell):
        return set()
    seen = {start_cell}
    q = deque([start_cell])
    dirs = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1)]

    def ok(a, b):
        return in_grid(layout, *b) and b not in blocked and _door_open(layout, a, b)

    while q:
        cur = q.popleft()
        for dc, dr in dirs:
            nxt = (cur[0] + dc, cur[1] + dr)
            if nxt in seen or not ok(cur, nxt):
                continue
            if dc and dr:  # 禁止穿角
                if not (ok(cur, (cur[0] + dc, cur[1])) and ok(cur, (cur[0], cur[1] + dr))):
                    continue
            seen.add(nxt)
            q.append(nxt)
    return seen


def nearest_reach_distance(layout, reach, px, pz, box=None):
    """可达格中心到点（或到包围盒）的最短水平距离；无可达格返回 inf。"""
    best = math.inf
    for c, r in reach:
        cx, cz = cell_center(layout, c, r)
        d = dist_to_box(cx, cz, box) if box else math.hypot(cx - px, cz - pz)
        best = min(best, d)
    return best


# ---------- 词典 ----------
class Index:
    """地点与物体词典。rules.py 与 validate.py 共用。"""

    def __init__(self, layout):
        self.layout = layout
        self.rooms = {r["id"]: r for r in layout["rooms"]}
        self.furniture = {f["id"]: f for f in layout["furniture"]}
        self.objects = {o["id"]: o for o in layout["objects"]}
        self.place_tokens = {}   # token -> ("room"|"furniture", id)
        for r in layout["rooms"]:
            for t in [r["name"], *r.get("aliases", [])]:
                self.place_tokens[t] = ("room", r["id"])
        for f in layout["furniture"]:
            for t in [f["name"], *f.get("aliases", [])]:
                self.place_tokens[t] = ("furniture", f["id"])
        self.object_tokens = {}
        for o in layout["objects"]:
            for t in [o["name"], *o.get("aliases", [])]:
                self.object_tokens[t] = o["id"]

    def drop_target(self, kind, ident):
        """把“地点”解析成可 drop 的家具 id；不可放返回 None。"""
        if kind == "room":
            return self.rooms[ident]["drop_to"]
        f = self.furniture[ident]
        return ident if f["surface"] else None

    def name_of(self, ident):
        for table in (self.objects, self.furniture, self.rooms):
            if ident in table:
                return table[ident]["name"]
        return ident

    def surface_pos(self, furniture_id):
        f = self.furniture[furniture_id]
        x0, z0, x1, z1 = furniture_box(f)
        return [round((x0 + x1) / 2, 3), round(furniture_top(f), 3), round((z0 + z1) / 2, 3)]
