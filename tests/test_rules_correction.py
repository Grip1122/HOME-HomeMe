"""纠错强规则测试：正例 + 边界句 + 不触发的反例。

覆盖建议 2 的核心风险：
  - 否定词 + 新地点 → 固定 go + drop 流程
  - 地点里含物体字（“书房”含“书”）不能误判
  - “不要放茶几，放书房”这类否定在前、肯定在后
  - 非纠正句不能被吞（“放到茶几上”不是纠错）
  - 全程不触网、耗时极短
"""
import time

import pytest

from server.app import rules
from server.app.planner import plan_offline
from server.app.validate import validate_steps


def correct(index, q, last=None, holding=None):
    return rules.try_correct(q, index, last, holding)


# ---------- 核心台词：路演上说的那一句 ----------
def test_demo_line_not_right_put_in_study(index):
    r = correct(index, "不对，应该放书房", last="cup_red", holding=None)
    assert r["source"] == "corrective" and r["corrected"] is True
    assert r["corrected_object"] == "cup_red" and r["corrected_to"] == "desk"
    assert r["steps"] == [
        {"action": "go", "target": "cup_red"},
        {"action": "grab", "target": "cup_red"},
        {"action": "go", "target": "desk"},
        {"action": "drop", "target": "cup_red", "to": "desk"},
    ]


def test_holding_object_uses_go_then_drop_only(index):
    r = correct(index, "不对，应该放书房", last="cup_red", holding="cup_red")
    assert [s["action"] for s in r["steps"]] == ["go", "drop"]
    assert r["steps"][0] == {"action": "go", "target": "desk"}


def test_explicit_object_overrides_last_object(index):
    r = correct(index, "不对，钥匙应该放在餐桌上", last="cup_red")
    assert r["corrected_object"] == "keys_yellow" and r["corrected_to"] == "table_dining"


def test_say_apologizes_and_is_short(index):
    r = correct(index, "不对，应该放书房", last="cup_red")
    assert "抱歉" in r["say"] and len(r["say"]) <= 40


# ---------- 边界：地点词里含物体字 ----------
def test_study_does_not_become_book(index):
    """“书房”里有“书”，不能因此把物体识别成蓝色书。"""
    r = correct(index, "不对，应该放书房", last="cup_red")
    assert r["corrected_object"] == "cup_red"


def test_bedroom_word_does_not_trigger_object(index):
    r = correct(index, "放错了，应该放卧室", last="cup_red")
    assert r["corrected_to"] == "nightstand" and r["corrected_object"] == "cup_red"


def test_book_object_with_study_destination(index):
    r = correct(index, "不对，书应该放书房", last="cup_red")
    assert r["corrected_object"] == "book_blue" and r["corrected_to"] == "desk"


# ---------- 边界：否定在前、肯定在后 ----------
def test_negated_place_then_positive_place(index):
    r = correct(index, "不要放茶几，应该放书房", last="cup_red")
    assert r["corrected_to"] == "desk"


def test_positive_place_then_negated_place_at_end(index):
    """否定地点在句尾：取“最后一个地点”会选错，必须靠否定前缀识别排除。

    这条用例是变异验证逼出来的：上一条里正确答案恰好在句尾，关掉否定判断也能蒙对。
    """
    r = correct(index, "应该放书房，不要放茶几", last="cup_red")
    assert r["corrected_to"] == "desk", r


def test_positive_place_then_negated_with_bie(index):
    r = correct(index, "放错了，应该放卧室，别放客厅", last="cup_red")
    assert r["corrected_to"] == "nightstand", r


def test_only_negated_place_asks_back(index):
    r = correct(index, "不要放茶几", last="cup_red")
    assert r["steps"] == [] and r["source"] == "rule"
    assert "哪里" in r["say"]


def test_wrong_without_place_asks_back(index):
    r = correct(index, "不对", last="cup_red")
    assert r["steps"] == [] and "哪里" in r["say"]


# ---------- 边界：缺信息时不猜 ----------
def test_no_last_object_and_no_object_in_text_asks_back(index):
    r = correct(index, "不对，应该放书房", last=None)
    assert r["steps"] == [] and "哪件" in r["say"]


def test_drop_on_non_surface_refuses(index):
    r = correct(index, "不对，应该放沙发", last="cup_red")
    assert r["steps"] == [] and "放不了" in r["say"]


# ---------- 非纠正句不能被吞 ----------
@pytest.mark.parametrize("q", [
    "帮我把红色水杯放到茶几上",
    "我的红色水杯在哪",
    "帮我找钥匙",
    "巡检一下",
])
def test_normal_commands_are_not_correction(index, q):
    assert correct(index, q, last="cup_red") is None


# ---------- 输出必须能被语义校验放行 ----------
@pytest.mark.parametrize("q,last,holding", [
    ("不对，应该放书房", "cup_red", None),
    ("不对，应该放书房", "cup_red", "cup_red"),
    ("放错了，应该放卧室", "keys_yellow", None),
    ("不对，书应该放餐桌", "cup_red", None),
])
def test_corrective_steps_pass_semantic_validation(index, q, last, holding):
    r = correct(index, q, last, holding)
    assert r["steps"], q
    assert validate_steps(index, r["steps"], holding) == []


# ---------- 固定流程：整条链路不触网、够快 ----------
def test_plan_offline_routes_correction_without_network(index, monkeypatch):
    import socket

    def boom(*a, **k):
        raise AssertionError("纠错路径不允许触网")

    monkeypatch.setattr(socket, "create_connection", boom)
    monkeypatch.setattr(socket.socket, "connect", boom)
    r = plan_offline("不对，应该放书房", index, {"last_object": "cup_red"})
    assert r["source"] == "corrective" and r["corrected_to"] == "desk"


def test_correction_is_fast(index):
    t0 = time.perf_counter()
    for _ in range(200):
        correct(index, "不对，应该放书房", last="cup_red")
    avg_ms = (time.perf_counter() - t0) * 1000 / 200
    assert avg_ms < 5, f"平均 {avg_ms:.2f} ms"
