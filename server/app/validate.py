"""语义校验：steps 是否能在给定布局里被机器人合法执行。

结构校验（字段、枚举）由 contracts/plan.schema.json 负责；这里只管“说得通不通”。
返回错误字符串列表，空列表表示通过。
"""
from __future__ import annotations

from .layoutlib import Index


def validate_steps(index: Index, steps, holding=None):
    errs = []
    held = holding
    for i, s in enumerate(steps, 1):
        a = s.get("action")
        t = s.get("target")
        if a in ("find", "grab"):
            if t not in index.objects:
                errs.append(f"第{i}步 {a}: 目标物体不存在 {t!r}")
        if a == "go" and t not in index.objects and t not in index.furniture \
                and t not in index.rooms:
            errs.append(f"第{i}步 go: 目标不存在 {t!r}")
        if a == "grab":
            if held is not None:
                errs.append(f"第{i}步 grab: 手里已拿着 {held!r}，一次只能拿一件")
            held = t
        if a == "drop":
            to = s.get("to")
            if t != held:
                errs.append(f"第{i}步 drop: 手里拿的是 {held!r}，不是 {t!r}（drop 前必须 grab）")
            if to not in index.furniture:
                errs.append(f"第{i}步 drop: 落点家具不存在 {to!r}")
            elif not index.furniture[to]["surface"]:
                errs.append(f"第{i}步 drop: {to!r} 不是可放置家具")
            held = None
        if a == "observe" and s.get("room") and s["room"] not in index.rooms:
            errs.append(f"第{i}步 observe: 分区不存在 {s['room']!r}")
    return errs
