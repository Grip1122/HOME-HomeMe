"""布局检查器的“能失败”证明：对合法布局做 7 种破坏，检查器必须逐一报错。

这是方案 0.3 里“故意改错看测试变红”的自动化版本，同时也是 AI 生成 layout 时的闸门。
"""
import copy

import pytest

from scripts.check_layout import check_layout


def test_example_layout_is_clean(layout):
    assert check_layout(layout) == []


def mutate(layout, fn):
    lay = copy.deepcopy(layout)
    fn(lay)
    return check_layout(lay)


def furn(lay, fid):
    return next(f for f in lay["furniture"] if f["id"] == fid)


def obj(lay, oid):
    return next(o for o in lay["objects"] if o["id"] == oid)


def test_narrow_door_is_caught(layout):
    errs = mutate(layout, lambda l: l["doors"][0].__setitem__("width", 0.8))
    assert any("门洞过窄" in e for e in errs)


def test_blocked_door_is_caught(layout):
    """把沙发横在去卧室的门洞上，卧室扫描点必须被判不可达。"""
    def f(l):
        s = furn(l, "sofa")
        s["room"] = "living"
        s["pos"] = [-0.7, 0.0, -3.0]
        s["size"] = [1.4, 0.85, 1.6]
    errs = mutate(layout, f)
    assert any("不可达" in e or "够不着" in e for e in errs)


def test_object_floating_above_table_is_caught(layout):
    errs = mutate(layout, lambda l: obj(l, "cup_red")["pos"].__setitem__(1, 1.4))
    assert any("不贴合" in e for e in errs)


def test_object_on_non_surface_is_caught(layout):
    errs = mutate(layout, lambda l: obj(l, "cup_red").__setitem__("on", "sofa"))
    assert any("不可放置" in e for e in errs)


def test_overlapping_furniture_is_caught(layout):
    def f(l):
        furn(l, "side_table")["pos"] = [-4.0, 0.0, -0.3]
    errs = mutate(layout, f)
    assert any("重叠" in e for e in errs)


def test_duplicate_alias_is_caught(layout):
    errs = mutate(layout, lambda l: furn(l, "desk").__setitem__("aliases", ["茶几"]))
    assert any("重名" in e for e in errs)


def test_object_beyond_reach_is_caught(layout):
    """把笔记本放到床的靠墙里侧：离最近可站格 2.0 m，必须报“够不着”。

    注意：只断言“有错”不够，上一版就是这样漏掉了对 reach 检查的覆盖（变异验证发现）。
    必须断言具体是“够不着”这一类错误。
    """
    def f(l):
        obj(l, "notebook_orange")["pos"] = [5.25, 0.5, -4.25]
    errs = mutate(layout, f)
    assert any("够不着" in e for e in errs), errs


def test_reach_margin_is_documented(layout):
    """示例布局里所有物体离可站格的距离都应 < 1.0 m；记录当前最大值，防止悄悄逼近阈值。"""
    from server.app import layoutlib as L
    blocked = L.blocked_cells(layout)
    sp = layout["rooms"][0]["scan_point"]
    reach = L.reachable_cells(layout, L.world_to_cell(layout, sp[0], sp[2]), blocked)
    worst = max(L.nearest_reach_distance(layout, reach, o["pos"][0], o["pos"][2])
                for o in layout["objects"])
    assert worst < 1.0
    assert worst > 0.5, "若变小到 0.5 以下，说明布局或网格参数变了，请同步方案里的阈值说明"
