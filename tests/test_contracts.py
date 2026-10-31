"""契约自检：示例文件必须满足各自的 Schema；Schema 必须真能拦住坏数据。"""
import copy
import json
from pathlib import Path

import jsonschema
import pytest

ROOT = Path(__file__).resolve().parents[1]
C = ROOT / "contracts"


def load(name):
    return json.loads((C / name).read_text(encoding="utf-8"))


def validator(schema, ref=None):
    if ref:
        schema = {"$ref": f"#/$defs/{ref}", "$defs": schema["$defs"]}
    return jsonschema.Draft202012Validator(schema)


def test_all_schemas_are_valid_schemas():
    for n in ["layout.schema.json", "plan.schema.json", "memory.schema.json", "captions.schema.json"]:
        jsonschema.Draft202012Validator.check_schema(load(n))


def test_layout_example_matches_schema():
    validator(load("layout.schema.json")).validate(load("layout.example.json"))


def test_cache_matches_schema_and_has_five_lines():
    cache = load("../server/app/cache.json")
    validator(load("captions.schema.json")).validate(cache)
    assert len(cache["entries"]) >= 5


def test_schema_rejects_unknown_action():
    v = validator(load("plan.schema.json"), "response")
    bad = {"say": "x", "source": "rule", "steps": [{"action": "fly", "target": "cup_red"}]}
    assert not v.is_valid(bad)


def test_schema_rejects_drop_without_destination():
    v = validator(load("plan.schema.json"), "response")
    bad = {"say": "x", "source": "rule", "steps": [{"action": "drop", "target": "cup_red"}]}
    assert not v.is_valid(bad)


def test_schema_rejects_extra_field_in_layout():
    lay = copy.deepcopy(load("layout.example.json"))
    lay["furniture"][0]["secret"] = 1
    assert not validator(load("layout.schema.json")).is_valid(lay)


def test_llm_source_value_is_allowed_but_corrective_exists():
    enum = load("plan.schema.json")["$defs"]["response"]["properties"]["source"]["enum"]
    assert "corrective" in enum and "llm" in enum


def test_frontend_layouts_match_schema():
    """运行布局由 B 管理；契约示例是示例，不是运行布局的字节镜像。"""
    paths = sorted((ROOT / "web/public/layouts").glob("*.json"))
    assert paths, "至少需要一个运行布局"
    ids = set()
    for path in paths:
        layout = json.loads(path.read_text(encoding="utf-8"))
        validator(load("layout.schema.json")).validate(layout)
        assert isinstance(layout.get("version"), int) and layout["version"] >= 1
        assert layout["layout_id"] not in ids, "运行布局 id 重复"
        ids.add(layout["layout_id"])
