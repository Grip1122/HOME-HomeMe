"""变异验证：证明测试真的会失败，而不是永远返回绿。

用法（在仓库根目录）:
    python scripts/mutation_demo.py           # 跑全部变异
    python scripts/mutation_demo.py -k rules  # 只跑名字含 rules 的变异

原理：对某个源文件做一处语义破坏 -> 跑 pytest -> 必须有测试失败 -> 还原。

判定规则（重要）：
    KILLED        至少一个测试失败，且期望的那个测试在失败列表里
    KILLED_OTHER  有测试失败，但不是期望的那一个（算抓住，但覆盖点变了，需检查）
    MISS          改坏代码后仍然全绿 —— 测试无效
    INVALID       pytest 因语法/收集中断退出（exit 2），这不是测试抓住，是变异写坏了
    SKIP          锚点不唯一，无法安全施加变异

历史教训：本脚本第一版把多行锚点写成了字面量反斜杠 n，产生语法错误，
pytest 以 exit 2 退出，被判成 KILLED —— 假证据。所以现在 exit 2 一律 INVALID，
并且只使用单行锚点，避免转义出错。
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# (名字, 文件, 单行锚点, 改成, 期望失败的测试名)
MUTATIONS = [
    ("http_preserve_corrective_source", "server/main.py",
     '        response = plan_offline(payload["query"], index, payload)',
     '        response = {**plan_offline(payload["query"], index, payload), "source": "cache"}',
     "test_plan_preserves_corrective_source_and_updates_memory"),
    ("storage_miss_calls_existing_formula", "server/app/storage.py",
     '            confidence = memory.on_hit(old["confidence"]) if hit else memory.on_miss(old["confidence"])',
     '            confidence = memory.on_hit(old["confidence"]) if hit else memory.on_hit(old["confidence"])',
     "test_observation_miss_rescan_and_hit_use_existing_confidence_functions"),
    ("storage_log_counts_executed_steps", "server/app/storage.py",
     '                 json.dumps(payload["steps"]), len(payload["steps"]), payload["duration_ms"],',
     '                 json.dumps(payload["steps"]), len(plan["steps"]), payload["duration_ms"],',
     "test_log_uses_plan_source_correction_flag_and_actual_execution_count"),
    ("rules_drop_location_masking", "server/app/rules.py",
     'obj_spans = _spans("".join(masked), index.object_tokens.keys())',
     'obj_spans = _spans(text, index.object_tokens.keys())',
     "test_study_does_not_become_book"),
    ("rules_skip_pickup_before_drop", "server/app/rules.py",
     "    if holding == obj:",
     "    if True:",
     "test_demo_line_not_right_put_in_study"),
    ("rules_ignore_negated_place", "server/app/rules.py",
     "        if _NEG_BEFORE_PLACE.search(text[max(0, i - 6):i]):",
     "        if False and _NEG_BEFORE_PLACE.search(text[max(0, i - 6):i]):",
     "test_positive_place_then_negated_place_at_end"),
    ("rules_never_detect_correction", "server/app/rules.py",
     "    if not is_correction(text):",
     "    if True:",
     "test_demo_line_not_right_put_in_study"),
    ("rules_soft_word_always_correction", "server/app/rules.py",
     "        return len(text) <= 10 and not IMPERATIVE.search(text)",
     "        return True",
     "test_normal_commands_are_not_correction"),
    ("layout_checker_skip_reach", "scripts/check_layout.py",
     "        d = L.nearest_reach_distance(layout, reach, o[\"pos\"][0], o[\"pos\"][2])",
     "        d = 0.0",
     "test_object_beyond_reach_is_caught"),
    ("layout_checker_skip_surface_height", "scripts/check_layout.py",
     "        if abs(y - L.furniture_top(f)) > 0.06:",
     "        if False:",
     "test_object_floating_above_table_is_caught"),
    ("layout_checker_skip_door_width", "scripts/check_layout.py",
     '        if d["width"] < 1.0:',
     "        if False:",
     "test_narrow_door_is_caught"),
    ("memory_miss_penalty_wrong", "server/app/memory.py",
     "    return _r(c - 0.40)",
     "    return _r(c - 0.30)",
     "test_confidence_miss_weakens_and_floors"),
    ("validate_allow_drop_before_grab", "server/app/validate.py",
     "            if t != held:",
     "            if False:",
     "test_drop_before_grab_rejected"),
    ("validate_allow_non_surface", "server/app/validate.py",
     '            elif not index.furniture[to]["surface"]:',
     "            elif False:",
     "test_drop_on_non_surface_rejected"),
    ("planner_skip_exit_validation", "server/app/planner.py",
     "    if errs:",
     "    if False:",
     "test_poisoned_cache_is_blocked_at_exit"),
    # 步骤 1.3：前端的 nav/grid.js 靠 __fixtures__ 里的快照与 layoutlib 对齐。
    # 把后端外扩半径改 1 cm，快照立刻过期 —— 证明这条对账不是摆设。
    ("nav_fixture_radius_drift", "server/app/layoutlib.py",
     "ROBOT_RADIUS = 0.25",
     "ROBOT_RADIUS = 0.26",
     "test_fixture_matches_current_layout"),
]


def _purge_bytecode():
    """删除所有 __pycache__。

    历史教训（CI 首跑失败）：变异 `0.40 -> 0.30` 前后文件大小相同，CI 上变异与还原发生在
    同一秒内，.pyc 以“mtime(秒) + 文件大小”判定有效，于是还原后仍读到变异版字节码，
    导致“还原后重跑仍有失败”。本机因运行慢、恰好跨秒而没暴露。
    """
    for top in ("server", "scripts", "tests"):
        for d in (ROOT / top).rglob("__pycache__"):
            shutil.rmtree(d, ignore_errors=True)


def run_pytest(extra=None):
    _purge_bytecode()
    cmd = [sys.executable, "-B", "-m", "pytest", "-q", "--no-header", "-p", "no:cacheprovider"]
    cmd += extra or []
    env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")
    p = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True,
                       encoding="utf-8", errors="replace", env=env)
    out = (p.stdout or "") + (p.stderr or "")
    failed = [ln.split(" - ")[0].replace("FAILED ", "").strip()
              for ln in out.splitlines() if ln.startswith("FAILED ")]
    return p.returncode, out, failed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-k", default=None)
    args = ap.parse_args()

    code, out, _ = run_pytest()
    if code != 0:
        print("[ABORT] 基线不是全绿，先修好测试再谈变异：")
        print(out[-2000:])
        return 2
    print("[BASE] 基线全绿\n")

    results = []
    for name, rel, old, new, expect in MUTATIONS:
        if args.k and args.k not in name:
            continue
        path = ROOT / rel
        src = path.read_text(encoding="utf-8")
        if src.count(old) != 1:
            results.append(("SKIP", name, f"锚点出现 {src.count(old)} 次（应为 1）"))
            print(f"  {'SKIP':<12} {name:<32} 锚点不唯一")
            continue

        # newline="\n" 不能省：Windows 上按默认换行写回会变 CRLF，还原后整文件仍显示为改动。
        path.write_text(src.replace(old, new, 1), encoding="utf-8", newline="\n")
        try:
            code, out, failed = run_pytest(["-rf", "--tb=no"])
        finally:
            path.write_text(src, encoding="utf-8", newline="\n")

        if code == 2:
            verdict, note = "INVALID", "pytest 因语法/收集中断退出，不算抓住"
        elif code == 0:
            verdict, note = "MISS", "改坏代码后测试仍全绿"
        elif any(expect in f for f in failed):
            verdict, note = "KILLED", f"{len(failed)} 个失败，含 {expect}"
        else:
            verdict, note = "KILLED_OTHER", f"失败 {failed[:2]}，但不是 {expect}"
        results.append((verdict, name, note))
        print(f"  {verdict:<12} {name:<32} {note}")

    code, out, _ = run_pytest()
    print("\n[RESTORE] 还原后重跑:", "全绿" if code == 0 else "仍有失败，请检查")
    if code != 0:
        print(out[-1500:])
        return 3

    killed = sum(1 for v, _, _ in results if v.startswith("KILLED"))
    bad = [r for r in results if not r[0].startswith("KILLED")]
    print(f"\n汇总: {killed}/{len(results)} 个变异被测试抓住")
    if bad:
        print("未通过:")
        for v, n, note in bad:
            print(f"  - {v:<12} {n}: {note}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
