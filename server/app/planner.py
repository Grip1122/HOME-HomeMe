"""离线规划：纠错规则 → 本地缓存 → 澄清。不调用任何网络服务。

在线规划（大模型）在步骤 3.1 接入，且只能插在“缓存之后、澄清之前”；
纠错句永远走这里的规则路径，大模型不参与。
"""
from __future__ import annotations

import time
from pathlib import Path

from . import rules
from .layoutlib import Index, load_json
from .validate import validate_steps

CACHE_PATH = Path(__file__).with_name("cache.json")


def load_cache(path=CACHE_PATH):
    return load_json(path)["entries"]


def plan_offline(query, index: Index, ctx=None, cache=None):
    t0 = time.perf_counter()
    ctx = ctx or {}
    holding = (ctx.get("robot") or {}).get("holding")

    resp = rules.try_correct(query, index, ctx.get("last_object"), holding)
    if resp is None:
        entries = cache if cache is not None else load_cache()
        hit = entries.get(rules.normalize(query))
        if hit:
            resp = {"say": hit["say"], "steps": [dict(s) for s in hit["steps"]], "source": "cache"}
        else:
            resp = {"say": "我没听懂，可以换个说法吗？", "steps": [], "source": "rule"}

    # 出口再校验一次：任何来源的 steps 都不允许带着语义错误离开后端
    errs = validate_steps(index, resp["steps"], holding)
    if errs:
        resp = {"say": "我没听懂，可以换个说法吗？", "steps": [], "source": "rule"}
    resp["latency_ms"] = int((time.perf_counter() - t0) * 1000)
    return resp
