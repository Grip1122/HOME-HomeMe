"""置信度更新：全部是确定性纯函数，六条规则各有一条单元测试。

不碰数据库。SQLite 读写由 main.py 在 B 阶段（步骤 3.3）接上。
"""
from __future__ import annotations

OBSERVE_FIRST = 0.80
RESCAN = 0.80
CORRECT_NEW = 0.90
MIN_USABLE = 0.30


def _r(x: float) -> float:
    return round(max(0.0, min(1.0, x)), 2)


def on_observe_first() -> float:
    return OBSERVE_FIRST


def on_hit(c: float) -> float:
    return _r(c + 0.05)


def on_miss(c: float) -> float:
    return _r(c - 0.40)


def on_rescan_found() -> float:
    return RESCAN


def on_correct_old(c: float) -> float:
    """用户纠正：旧位置记录降 0.30。"""
    return _r(c - 0.30)


def on_correct_new() -> float:
    return CORRECT_NEW


def usable(c: float) -> bool:
    return c >= MIN_USABLE


def status_after_miss(c: float) -> str:
    return "stale"


def status_default() -> str:
    return "fresh"
