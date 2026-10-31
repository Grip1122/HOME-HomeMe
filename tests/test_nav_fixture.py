"""前端寻路快照的护栏：快照必须与当前 layout + layoutlib 一致。

任务书步骤 1.3 的验收口径是「前端 nav/grid.js 与后端的 blocked_cells / reachable_cells
同一套规则」。硬编码一份期望值不算证明——布局一改就会悄悄失真。
所以这里守两件事：

1. 快照没被手改（重跑 `scripts/gen_nav_fixture.py` 必须字节一致）；
2. 快照本身不是空壳（阻挡格、可达集、门洞都有实际内容）。
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.gen_nav_fixture import LAYOUTS, build, dump

ROOT = Path(__file__).resolve().parents[1]
FIXTURE_DIR = ROOT / "web" / "src" / "nav" / "__fixtures__"


def fixture_path(name: str) -> Path:
    return FIXTURE_DIR / f"layout_{name}.nav.json"


@pytest.mark.parametrize("name", sorted(LAYOUTS))
def test_fixture_matches_current_layout(name):
    path = fixture_path(name)
    assert path.exists(), f"缺少寻路快照 {path.relative_to(ROOT)}，先跑 scripts/gen_nav_fixture.py"
    assert path.read_text(encoding="utf-8") == dump(build(LAYOUTS[name])), (
        f"{path.relative_to(ROOT)} 已过期：布局或 layoutlib 改过但没重跑 "
        "python scripts/gen_nav_fixture.py"
    )


def test_fixture_is_not_empty():
    data = json.loads(fixture_path("A").read_text(encoding="utf-8"))
    g = data["grid"]
    free = g["cols"] * g["rows"] - len(data["blocked"])
    assert free > 0, "全部格子都被家具挡住，寻路无从谈起"
    assert len(data["blocked"]) > 0, "没有任何阻挡格，说明半径外扩没生效"
    for room_id, cells in data["reachable"].items():
        assert cells, f"分区 {room_id} 的可达集为空"
        assert len(cells) <= free
    assert len(set(map(tuple, data["blocked"]))) == len(data["blocked"]), "阻挡格有重复"


def test_doors_are_the_only_cross_room_links():
    data = json.loads(fixture_path("A").read_text(encoding="utf-8"))
    probes = data["boundary_probes"]
    assert probes, "跨分区相邻格探测为空，说明分区矩形没有共享边界"
    opened = [p for p in probes if p["open"]]
    assert opened, "两扇 1.5 m 门洞应当至少打通一行格子"
    # 门洞在网格上是连续的一段：两条边界各一段，每段至少 3 行（1.5 m / 0.5 m）。
    # 若判定退化成散点，这里会立刻变红。
    rows = sorted(p["a"][1] for p in opened if p["a"][0] == 11)
    runs = []
    for row in rows:
        if runs and row == runs[-1][-1] + 1:
            runs[-1].append(row)
        else:
            runs.append([row])
    assert len(runs) == 2, f"c=11 边界上应有两条门洞，实际 {runs}"
    for run in runs:
        assert len(run) >= 3, f"门洞格子太少（{run}），宽度或格子尺寸对不上"
