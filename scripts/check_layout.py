"""布局静态检查：契约示例合入前必须零错误。

检查的是“逻辑一致性”，不是 JSON 语法（语法由 layout.schema.json 管）。
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from server.app import layoutlib as L  # noqa: E402


def check_layout(layout, grab_radius=L.GRAB_RADIUS):
    errs = []
    g = layout["grid"]
    rooms = {r["id"]: r for r in layout["rooms"]}
    furn = {}
    for f in layout["furniture"]:
        if f["id"] in furn:
            errs.append(f"家具 id 重复: {f['id']}")
        furn[f["id"]] = f

    # 1. 分区矩形：在网格内、互不重叠
    covered = {}
    for r in layout["rooms"]:
        c0, r0, w, h = r["rect"]
        if c0 + w > g["cols"] or r0 + h > g["rows"]:
            errs.append(f"分区 {r['id']} 超出网格")
        for c in range(c0, c0 + w):
            for rr in range(r0, r0 + h):
                if (c, rr) in covered:
                    errs.append(f"分区重叠: {r['id']} 与 {covered[(c, rr)]}")
                    break
                covered[(c, rr)] = r["id"]

    # 2. 名称/别名全局唯一（否则“放到X”有歧义）
    seen = {}
    for kind, items in (("room", layout["rooms"]), ("furniture", layout["furniture"])):
        for it in items:
            for t in [it["name"], *it.get("aliases", [])]:
                if t in seen:
                    errs.append(f"地点词重名: {t} ({seen[t]} / {it['id']})")
                seen[t] = it["id"]
    oseen = {}
    for o in layout["objects"]:
        if o["id"] in oseen.values():
            errs.append(f"物体 id 重复: {o['id']}")
        for t in [o["name"], *o.get("aliases", [])]:
            if t in oseen and oseen[t] != o["id"]:
                errs.append(f"物体词重名: {t} ({oseen[t]} / {o['id']})")
            oseen[t] = o["id"]

    # 3. 家具：归属分区存在，包围盒落在该分区世界范围内；阻挡家具互不重叠
    def room_world(r):
        c0, r0, w, h = r["rect"]
        s = g["cell"]
        return (g["origin"][0] + c0 * s, g["origin"][2] + r0 * s,
                g["origin"][0] + (c0 + w) * s, g["origin"][2] + (r0 + h) * s)

    for f in layout["furniture"]:
        if f["room"] not in rooms:
            errs.append(f"家具 {f['id']} 的分区不存在: {f['room']}")
            continue
        x0, z0, x1, z1 = L.furniture_box(f)
        rx0, rz0, rx1, rz1 = room_world(rooms[f["room"]])
        if x0 < rx0 - 1e-9 or z0 < rz0 - 1e-9 or x1 > rx1 + 1e-9 or z1 > rz1 + 1e-9:
            errs.append(f"家具 {f['id']} 不在分区 {f['room']} 范围内")
    blockers = [f for f in layout["furniture"] if f.get("blocks")]
    for i, a in enumerate(blockers):
        for b in blockers[i + 1:]:
            ax0, az0, ax1, az1 = L.furniture_box(a)
            bx0, bz0, bx1, bz1 = L.furniture_box(b)
            if ax0 < bx1 and bx0 < ax1 and az0 < bz1 and bz0 < az1:
                errs.append(f"阻挡家具重叠: {a['id']} 与 {b['id']}")

    # 4. 门洞：宽度 >= 1.0 米（外扩 0.25 后至少留 0.5 米净宽）；两端分区存在
    for d in layout.get("doors", []):
        if d["width"] < 1.0:
            errs.append(f"门洞过窄: {d['id']} 宽 {d['width']} < 1.0")
        for rid in d["between"]:
            if rid not in rooms:
                errs.append(f"门洞 {d['id']} 引用了不存在的分区 {rid}")

    # 5. 扫描点：在本分区、不在阻挡格内、全部互通
    blocked = L.blocked_cells(layout)
    first = layout["rooms"][0]
    start = L.world_to_cell(layout, first["scan_point"][0], first["scan_point"][2])
    reach = L.reachable_cells(layout, start, blocked)
    if not reach:
        errs.append(f"起始分区 {first['id']} 的扫描点落在阻挡格内")
    for r in layout["rooms"]:
        sx, _, sz = r["scan_point"]
        cell = L.world_to_cell(layout, sx, sz)
        if L.room_of_cell(layout, *cell) != r["id"]:
            errs.append(f"分区 {r['id']} 的扫描点不在本分区")
        elif cell in blocked:
            errs.append(f"分区 {r['id']} 的扫描点在阻挡格内")
        elif cell not in reach:
            errs.append(f"分区 {r['id']} 的扫描点不可达（被家具或墙封死）")

    # 6. 物体：落在 surface 家具的包围盒内、高度贴合台面、分区一致
    for o in layout["objects"]:
        if o["on"] == "floor":
            continue
        f = furn.get(o["on"])
        if f is None:
            errs.append(f"物体 {o['id']} 的 on 不存在: {o['on']}")
            continue
        if not f["surface"]:
            errs.append(f"物体 {o['id']} 放在了不可放置家具 {f['id']} 上")
        if o["room"] != f["room"]:
            errs.append(f"物体 {o['id']} 分区与所在家具不一致")
        x, y, z = o["pos"]
        x0, z0, x1, z1 = L.furniture_box(f)
        if not (x0 <= x <= x1 and z0 <= z <= z1):
            errs.append(f"物体 {o['id']} 不在 {f['id']} 台面范围内")
        if abs(y - L.furniture_top(f)) > 0.06:
            errs.append(f"物体 {o['id']} 高度 {y} 与台面 {L.furniture_top(f)} 不贴合")

    # 7. 抓取可达：每个物体周围 grab_radius 米内必须有机器人能站的格子
    for o in layout["objects"]:
        d = L.nearest_reach_distance(layout, reach, o["pos"][0], o["pos"][2])
        if d > grab_radius:
            errs.append(f"物体 {o['id']} 够不着：最近可站格距 {d:.2f} m > {grab_radius} m")

    # 8. 放置可达：每个 surface 家具、每个分区默认落点，边缘 grab_radius 内要有可站格
    for f in layout["furniture"]:
        if f["surface"]:
            d = L.nearest_reach_distance(layout, reach, 0, 0, box=L.furniture_box(f))
            if d > grab_radius:
                errs.append(f"可放置家具 {f['id']} 放不到：最近可站格距边缘 {d:.2f} m")
    for r in layout["rooms"]:
        t = furn.get(r["drop_to"])
        if t is None:
            errs.append(f"分区 {r['id']} 的 drop_to 不存在: {r['drop_to']}")
        elif not t["surface"]:
            errs.append(f"分区 {r['id']} 的 drop_to {t['id']} 不可放置")
        elif t["room"] != r["id"]:
            errs.append(f"分区 {r['id']} 的 drop_to {t['id']} 不在本分区")
    return errs


def main(argv=None):
    path = (argv or sys.argv[1:] or [str(ROOT / "contracts" / "layout.example.json")])[0]
    errs = check_layout(L.load_json(path))
    if errs:
        print(f"[FAIL] {path}: {len(errs)} 项问题")
        for e in errs:
            print("  -", e)
        return 1
    print(f"[OK] {path}: 布局检查通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
