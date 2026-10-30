# 小方 HomeTwin

> 虚拟孪生家庭具身找物 Agent。四人团队 × AI 辅助开发，26 小时执行窗口。

本仓库是《HomeTwin 分步实施计划 V3》的落地载体。**契约先于代码**：`contracts/` 是唯一真值，任何模块只允许通过契约互相调用。

---

## 1. 五分钟上手

```bash
git clone <repo> && cd hometwin
python -m venv .venv && .venv/Scripts/activate      # Windows
pip install -r server/requirements.txt
pytest -q                                           # 契约与规则测试必须全绿
git config core.hooksPath .githooks                 # 启用本地守门
```

前端（由设计 A 在步骤 1.1 填充）：

```bash
cd web && npm ci && npm run dev     # 目录当前只有 README，npm 脚本待 1.1 落地
```

---

## 2. 目录与责任边界

| 目录 | 归属 | 内容 | 谁能改 |
|---|---|---|---|
| `contracts/` | 全员共有 | JSON Schema、事件表、示例 | **只能走 contract PR**（见 `contracts/README.md`） |
| `web/src/scene/` | 设计 B | layout 加载、灰盒与正式场景、资产 | 设计 B |
| `web/src/robot/` `web/src/nav/` `web/src/core/` | 设计 A | 状态机、寻路、动作执行器、事件总线 | 设计 A |
| `web/src/ui/` `web/src/demo/` | 设计 C | HUD、对话、记忆面板、导演面板、脚本库 | 设计 C |
| `server/` | AI-D | 规划、校验、纠错规则、记忆、日志 | AI-D |
| `scripts/` `tests/` `.github/` | AI-D | 守门脚本、CI、测试基座 | AI-D |
| `docs/` | 设计 C 主笔 | 提示词模板、验收用例、审核清单、路演稿 | 设计 C（他人可提 PR） |

违反边界不靠人喊，靠 `CODEOWNERS` 声明 + `scripts/check_contracts.py` 拦截 + 审核清单第一关。

---

## 3. 三条硬规则

1. **契约可改，但只能单独改。** 触碰 `contracts/` 的 PR 不得混入业务代码；须更新 `contracts.lock.json` 并写 `contracts/CHANGELOG.md`。详见 `contracts/README.md`。
2. **每个模块必须带能失败的测试。** PR 里要附「故意改错 → 测试变红」的证据（命令输出截图或 CI 变异记录）。测试只写 happy path 的 PR 一律打回。
3. **禁止直推 `main`。** 本地 `.githooks/pre-push` 拦截，CI 二次校验。所有变更走 PR + squash merge。

---

## 4. 演示的确定性前提

路演当天不依赖任何外部服务：

- 五句核心台词的结果固化在 `server/app/cache.json`，**key 不含记忆快照**（记忆只影响 `find` 的走法，不影响 `steps` 结构）。
- 纠正指令走 `server/app/rules.py` 的纯规则，**不调用大模型**，本地耗时 < 2 ms。
- 断网时 `/plan` 依次回落到 `cache → rule → script`，三档都不会返回空步骤。

---

## 5. 文档索引

| 文档 | 用途 |
|---|---|
| `docs/branch-commit-spec.md` | 分支、提交、合并规范 |
| `docs/review-checklist.md` | 把关人审核清单（含一票否决项） |
| `docs/ai-prompt-template.md` | 交给 AI 的任务说明模板 |
| `docs/test-cases.md` | 十条验收用例 + 纠正专项用例 |
| `contracts/README.md` | 契约变更流程 |
