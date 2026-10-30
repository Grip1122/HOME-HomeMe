"""五句固化台词 + 语义校验 + 置信度纯函数。"""
import pytest

from server.app import memory as M
from server.app import rules
from server.app.planner import load_cache, plan_offline
from server.app.validate import validate_steps

FIVE = [
    "我的红色水杯在哪？",
    "帮我把红色水杯放到茶几上",
    "帮我找钥匙",
    "帮我把书拿到卧室",
    "巡检一下",
]


# ---------- 固化台词 ----------
@pytest.mark.parametrize("q", FIVE)
def test_five_demo_lines_hit_cache_offline(index, q):
    r = plan_offline(q, index)
    assert r["source"] == "cache" and r["steps"], q
    assert validate_steps(index, r["steps"]) == []


@pytest.mark.parametrize("q", [
    "小方，我的红色水杯在哪",
    "我的红色水杯在哪?",
    " 帮我把红色水杯放到茶几上 ",
    "请帮我找钥匙！",
])
def test_cache_key_is_robust_to_punctuation_and_wake_word(index, q):
    assert plan_offline(q, index)["source"] == "cache"


def test_unknown_query_is_clarified_not_empty_crash(index):
    r = plan_offline("今天天气怎么样", index)
    assert r["steps"] == [] and "没听懂" in r["say"]


def test_every_cache_entry_is_semantically_valid(index):
    for k, v in load_cache().items():
        assert validate_steps(index, v["steps"]) == [], k


def test_poisoned_cache_is_blocked_at_exit(index):
    bad = {"帮我找钥匙": {"say": "x", "steps": [{"action": "grab", "target": "ghost"}]}}
    r = plan_offline("帮我找钥匙", index, cache=bad)
    assert r["steps"] == []


# ---------- 语义校验 ----------
def test_drop_before_grab_rejected(index):
    errs = validate_steps(index, [{"action": "drop", "target": "cup_red", "to": "table_coffee"}])
    assert any("必须 grab" in e for e in errs)


def test_drop_on_non_surface_rejected(index):
    errs = validate_steps(index, [
        {"action": "grab", "target": "cup_red"},
        {"action": "drop", "target": "cup_red", "to": "sofa"},
    ])
    assert any("不是可放置" in e for e in errs)


def test_unknown_target_rejected(index):
    assert validate_steps(index, [{"action": "find", "target": "unicorn"}])


def test_two_grabs_in_a_row_rejected(index):
    errs = validate_steps(index, [
        {"action": "grab", "target": "cup_red"},
        {"action": "grab", "target": "book_blue"},
    ])
    assert any("一次只能拿一件" in e for e in errs)


# ---------- 置信度纯函数：六条规则各一条 ----------
def test_confidence_observe_first():
    assert M.on_observe_first() == 0.80


def test_confidence_hit_reinforces_and_caps():
    assert M.on_hit(0.85) == 0.90
    assert M.on_hit(0.98) == 1.0


def test_confidence_miss_weakens_and_floors():
    assert M.on_miss(0.85) == 0.45
    assert M.on_miss(0.2) == 0.0


def test_confidence_rescan_resets():
    assert M.on_rescan_found() == 0.80


def test_confidence_correct_old_and_new():
    assert M.on_correct_old(0.85) == 0.55
    assert M.on_correct_new() == 0.90


def test_confidence_threshold():
    assert M.usable(0.30) and not M.usable(0.29)
