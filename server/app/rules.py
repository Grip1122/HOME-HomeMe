"""纠错强规则：不依赖大模型，纯正则 + 词典，耗时 < 2 ms。

流程固定：
  1. 命中否定/纠正词；
  2. 抽取“新地点”（取最后一次提到、且未被否定的地点）；
  3. 抽取物体（地点词所占的字符先遮掉，避免“书房”里的“书”被当成物体）；缺省用 last_object；
  4. 下发固定步骤模板，并通知调用方走记忆纠正接口。

模板（与 V3 方案 3.4 一致）：
  手里正拿着该物体 : go(新地点) + drop
  物体已放下       : go(物体) + grab + go(新地点) + drop
第二种是对“go+drop”的必要补全：机器人已经把物体放下，不先拿起就 drop 会被语义校验拦截。
"""
from __future__ import annotations

import re

from .layoutlib import Index

HARD_NEG = re.compile(
    r"(不对|不是|错了|放错|搞错|不应该|别放|不要放|不在这|不在那|没有在)"
)
# 软改写词：单独出现**不足以**判定为纠错。
# 反例（实测踩过）：“帮我把书搬到卧室”“把钥匙挪到餐桌”是普通搬运指令，
# 若按纠错处理，机器人会回一句“抱歉，我记错了”，非常突兀。
SOFT_REWRITE = re.compile(r"(应该|该放|改放|挪到|移到|换到|搬到|放到别|换个地方)")
# 出现这些祈使包装，说明用户在下一道新指令，不是纠正上一轮
IMPERATIVE = re.compile(r"(帮我|请|麻烦|把|拿|去|找)")
# 地点前面紧挨着的否定结构：“不要放茶几”“别放在茶几”“不是茶几”
_NEG_BEFORE_PLACE = re.compile(r"(不要|别|不是|不能|不可以|不用)(放|在|是)?(在|到)?$")

_PUNCT = re.compile(r"[\s，。！？、；：,.!?;:~～…\-—\"'“”‘’（）()\[\]【】]+")
_WAKE = re.compile(r"^(小方|请|麻烦|那个|嗯|呃)+")


def normalize(query: str) -> str:
    q = _PUNCT.sub("", query or "")
    return _WAKE.sub("", q).lower()


def _spans(text: str, tokens):
    """返回 [(start, end, token)]，长词优先，已占用区间不重复匹配。"""
    taken = [False] * len(text)
    out = []
    for tok in sorted(tokens, key=len, reverse=True):
        start = 0
        while True:
            i = text.find(tok, start)
            if i < 0:
                break
            j = i + len(tok)
            if not any(taken[i:j]):
                for k in range(i, j):
                    taken[k] = True
                out.append((i, j, tok))
            start = i + 1
    return sorted(out)


def _result(say, steps, **extra):
    r = {"say": say[:40], "steps": steps, "source": "corrective"}
    r.update(extra)
    return r


def _clarify(say):
    return {"say": say[:40], "steps": [], "source": "rule", "corrected": False}


_FIND_INTENT = re.compile(r"(找|寻找|在哪|哪里|哪儿|定位)")
_MOVE_INTENT = re.compile(r"(放到|放在|搬到|移到|挪到|送到|拿起|抓起|拿给)")


def try_find(query, index: Index):
    """Recognize ordinary single-object finding requests without weakening move plans."""
    text = normalize(query)
    if not _FIND_INTENT.search(text) or _MOVE_INTENT.search(text):
        return None
    spans = _spans(text, index.object_tokens.keys())
    if not spans:
        return None
    obj = index.object_tokens[spans[-1][2]]
    return _result(f"好的，我去找{index.name_of(obj)}。",
                   [{"action": "find", "target": obj}], source="rule")


def is_correction(text: str) -> bool:
    """判定一句话是不是「纠正上一轮」而不是「新下一道指令」。

    硬否定词 -> 一定是纠错。
    软改写词 -> 仅当它是一句简短补语（无祈使包装、不超过 10 字）才算，
                例如“应该放书房”“挪到餐桌”；“帮我把书搬到卧室”不算。
    """
    if HARD_NEG.search(text):
        return True
    if SOFT_REWRITE.search(text):
        return len(text) <= 10 and not IMPERATIVE.search(text)
    return False


def try_correct(query, index: Index, last_object=None, holding=None):
    """不是纠正句返回 None；是纠正句则返回完整 plan 响应（可能是澄清）。"""
    text = normalize(query)
    if not is_correction(text):
        return None

    place_spans = _spans(text, index.place_tokens.keys())
    if not place_spans:
        # 有纠正词但没说新位置，例如“不对”。不猜，直接问。
        return _clarify("我记错了吗？请告诉我应该放哪里。")

    # 取最后一个未被否定的地点
    chosen = None
    for i, j, tok in place_spans:
        if _NEG_BEFORE_PLACE.search(text[max(0, i - 6):i]):
            continue
        chosen = (i, j, tok)
    if chosen is None:
        return _clarify("好的，不放那里。请告诉我应该放哪里。")

    kind, ident = index.place_tokens[chosen[2]]
    to = index.drop_target(kind, ident)
    if to is None:
        return _clarify(f"{index.name_of(ident)}上放不了东西，换个位置吧。")

    # 遮掉地点字符再找物体
    masked = list(text)
    for i, j, _ in place_spans:
        for k in range(i, j):
            masked[k] = "\u0000"
    obj_spans = _spans("".join(masked), index.object_tokens.keys())
    obj = index.object_tokens[obj_spans[-1][2]] if obj_spans else last_object
    if obj is None or obj not in index.objects:
        return _clarify("你说的是哪件东西？")

    if holding == obj:
        steps = [{"action": "go", "target": to},
                 {"action": "drop", "target": obj, "to": to}]
    else:
        steps = [{"action": "go", "target": obj},
                 {"action": "grab", "target": obj},
                 {"action": "go", "target": to},
                 {"action": "drop", "target": obj, "to": to}]
    say = f"抱歉，我记错了。这就把{index.name_of(obj)}放到{index.name_of(to)}。"
    return _result(say, steps, corrected=True, corrected_object=obj, corrected_to=to)
