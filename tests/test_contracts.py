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


def test_frontend_layout_copy_is_identical_to_contract_example():
    """前端从 web/public/layouts 读、后端与测试从 contracts 读，两份必须逐字节一致。"""
    a = (C / "layout.example.json").read_bytes()
    b = (ROOT / "web" / "public" / "layouts" / "layout_A.json").read_bytes()
    assert a == b, "layout_A.json 与 contracts/layout.example.json 不一致：改契约示例后要同步拷贝"
