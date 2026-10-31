"""契约闸门：Code Review 第一关 + CI 复检。

规则（对应方案 0.3 / 第十四章）：
  1. 任何改动 contracts/ 的提交，必须同时更新 contracts.lock.json。
  2. contracts/ 的改动不得与本目录以外的代码改动混在同一次提交里（“契约 PR 单独开”）。
  3. lock 里的 hash 必须与当前 contracts/ 实际内容一致（有人手改示例没刷 lock 会被抓）。
  4. contracts/ 之外的代码不得 import 私有模块绕过契约（粗粒度但有效的护栏）。

用法：
    python scripts/check_contracts.py                     # 检查工作区相对 HEAD 的改动
    python scripts/check_contracts.py --base origin/main  # 检查相对某分支的改动（CI 用）
    python scripts/check_contracts.py --staged            # 只检查已暂存内容（pre-commit 用）
    python scripts/check_contracts.py --update-lock       # 重新生成 lock（必须单独提交）

退出码 0 = 通过；1 = 违规。
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / "contracts"
LOCK = CONTRACTS / "contracts.lock.json"

# 纳入指纹的契约文件（README/CHANGELOG 属于文档，不含在指纹里）
TRACKED = [
    "layout.schema.json",
    "layout.example.json",
    "plan.schema.json",
    "memory.schema.json",
    "captions.schema.json",
    "events.md",
]


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def build_lock() -> dict:
    files = {name: sha(CONTRACTS / name) for name in TRACKED if (CONTRACTS / name).exists()}
    digest = hashlib.sha256(
        json.dumps(files, sort_keys=True).encode("utf-8")
    ).hexdigest()[:16]
    return {"version": 1, "files": files, "digest": digest}


def git(*args) -> str:
    p = subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if p.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)}: {p.stderr.strip() or p.stdout.strip() or p.returncode}")
    return p.stdout


def changed_files(base=None, staged=False) -> list[str]:
    if staged:
        out = git("diff", "--cached", "--name-only")
    elif base:
        out = git("diff", "--name-only", f"{base}...HEAD", "--")
    else:
        out = git("diff", "--name-only", "HEAD")
        out += "\n" + git("ls-files", "--others", "--exclude-standard")
    return sorted({ln.strip() for ln in out.splitlines() if ln.strip()})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=None)
    ap.add_argument("--staged", action="store_true")
    ap.add_argument("--update-lock", action="store_true")
    args = ap.parse_args()

    if args.update_lock:
        LOCK.write_text(json.dumps(build_lock(), ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8")
        print(f"[OK] 已更新 {LOCK.relative_to(ROOT)}: {build_lock()['digest']}")
        return 0

    errs = []

    # 规则 3：lock 与磁盘一致
    if not LOCK.exists():
        errs.append("contracts/contracts.lock.json 不存在，先运行 --update-lock 并单独提交")
    else:
        current = build_lock()
        locked = json.loads(LOCK.read_text(encoding="utf-8"))
        if current["digest"] != locked.get("digest"):
            diff = [k for k, v in current["files"].items()
                    if locked.get("files", {}).get(k) != v]
            errs.append(f"契约文件与 lock 不一致（改动：{'、'.join(diff) or '未知'}），"
                        f"请运行 python scripts/check_contracts.py --update-lock 并单独提交")

    # 规则 1 / 2：契约与代码不得混提交
    # Git 基线无效时失败；不将任何 Git 错误误当成初始化豁免。
    try:
        git("rev-parse", "--verify", "HEAD")
        files = changed_files(args.base, args.staged)
    except RuntimeError as exc:
        print(f"[FAIL] Git 基线检查失败：{exc}")
        return 1
    touch_contracts = [f for f in files if f.startswith("contracts/")]
    touch_code = [f for f in files if f and not f.startswith("contracts/")
                  and not f.startswith("docs/") and f not in ("README.md",)]
    if touch_contracts and touch_code:
        errs.append("契约改动与业务代码混在同一次提交里。契约 PR 必须单独开，"
                    f"当前同时改了：{', '.join(touch_code[:5])}"
                    + ("…" if len(touch_code) > 5 else ""))

    # 规则 4：禁止跨层私有导入
    for py in ROOT.glob("server/**/*.py"):
        src = py.read_text(encoding="utf-8", errors="replace")
        for bad in ("from scripts.", "import scripts"):
            if bad in src:
                errs.append(f"{py.relative_to(ROOT)} 反向依赖 scripts/（运维脚本不得被业务代码引用）")

    if errs:
        print(f"[FAIL] 契约闸门拦下 {len(errs)} 项：")
        for e in errs:
            print("  -", e)
        return 1

    print(f"[OK] 契约闸门通过（检查 {len(files)} 个改动文件，"
          f"digest={build_lock()['digest']}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
