"""Small deterministic command fallback using the layout's own IDs and aliases."""
import re

from .rules import normalize


def _match(text, tokens):
    matches = [(len(token), value) for token, value in tokens.items() if token in text]
    if not matches:
        return None
    longest = max(length for length, _ in matches)
    values = {value for length, value in matches if length == longest}
    return next(iter(values)) if len(values) == 1 else None


def plan_command(query, index, holding=None):
    text = normalize(query)
    # Split before matching objects: "书房" must not become "书".
    parts = re.split(r"放到|放在|拿到|送到|放回", text, maxsplit=1)
    obj = _match(parts[0], index.object_tokens)
    if obj is None:
        return None
    if len(parts) == 2:
        place = _match(parts[1], index.place_tokens)
        target = index.drop_target(*place) if place else None
        if target is None:
            return None
        steps = [] if holding == obj else [{"action": "find", "target": obj}, {"action": "grab", "target": obj}]
        steps += [{"action": "go", "target": target}, {"action": "drop", "target": obj, "to": target}]
    elif re.search(r"找|在哪", text):
        steps = [{"action": "find", "target": obj}]
    elif re.search(r"拿|抓", text):
        steps = [{"action": "find", "target": obj}, {"action": "grab", "target": obj}]
    else:
        return None
    return {"say": "好的，这就去。", "steps": steps, "source": "rule"}
