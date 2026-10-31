# 小觅HOME：虚拟孪生家庭具身空间物体定位（四人团队·AI辅助开发）

> **最新安排（本地待审、未上传、未合并生效）**：先读 [`team/03-demo-coordination.md`](team/03-demo-coordination.md)。接续方案沿用 **robot-find 母版**的界面、功能与交互；当前为 **local-demo，未接后端，场景与机器人素材待替换**，demo 尚未进入 main。下文旧里程碑、职责与最新安排冲突时，以 03 为待合并提案准；合并后才生效，不据旧步骤重做旋转立方体或整套 HUD。

> **职责与操作边界**：jesu 全文件全局/最终整合审核、GitHub 整体搭建审核维护安排及前端设计搭建；wei 代码负责人、后端、代码审核与技术合理性复核，jesu 自己代码由 wei 审不自审。sen 场景/空间/校准，Gary UI/通用及机器人素材/材质渲染/产品设计；owner 自验、jesu 统筹验收。当前仅本地文档调整，未提交未推送；create_branch 403 未解除，禁止任何网络写入，不猜换 wei 账号。

> 项目 **HOME**（读音 "home me"，谐音 *homie*，"伙伴"之意），配套机器人 **小觅**。
> **开工前必读**：所有 Agent 在接取任何任务前，必须先完整阅读 [`team/01-overview-v3.md`](team/01-overview-v3.md) 与 [`team/02-roles.md`](team/02-roles.md)，再按分工领取工作。入口见 [`team/README.md`](team/README.md)。
> **视觉基点**：建筑高斯泼溅素材 `scene.ply`（见 [`assets/gaussian-splat/`](assets/gaussian-splat/README.md)）。
> **素材总索引**：所有模型、场景、归档的位置与拉取方式见 [`assets/README.md`](assets/README.md)，新增素材前先查它。
> 旧称 "HomeTwin / 小方" 即本项目与小觅；仓库名 `hometwin` 与代码标识符暂不改名。

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

前端（main 已有 Vite 脚手架；robot-find demo 仍在本地，尚未进入 main）：

```bash
cd web && npm ci && npm run dev
```

---

## 2. 目录与责任边界

| 目录 | 归属 | 内容 | 谁能改 |
|---|---|---|---|
| `contracts/` | 全员共有 | JSON Schema、事件表、示例 | **只能走 contract PR**（见 `contracts/README.md`） |
| `web/src/scene/` `web/public/layouts/` | sen | 场景几何/空间/校准、任务空间语义；装配 Gary 场景材质接口 | sen；不改 world.js |
| `web/src/robot-find/`、入口及 `robot/` `nav/` `core/` | jesu | 前端设计搭建、交互、动作代码、资源与 UI 装配 | jesu 单写，wei 独立复核其代码 |
| `web/src/ui/` `web/src/demo/` | jesu 前端装配、Gary 设计素材 | UI 交互美术、通用素材、材质渲染参数与产品方案 | 先锁文件清单，不并发改母版 |
| `assets/robot/`、既有美术资源路径 | Gary；场景资源 sen | Gary 机器人建模/UI/通用素材/材质参数；sen 场景空间资源 | 对应 owner 交来源/许可/SHA，jesu 汇总审核 |
| `server/` | wei | 编程代码负责人、后端搭建、代码与技术方案复核 | wei 自验，jesu 最终整合审核 |
| `scripts/` `tests/` `.github/` | wei 技术实现，jesu GitHub 全局安排 | 守门脚本、CI、测试基座、仓库维护安排 | owner 单写，jesu 全局审核 |
| `docs/` `team/` | jesu 统筹全局审核 | 各 owner 自验记录、集成验收、协作安排 | 各 owner 自验，jesu 统筹；Gary 不以测试为主 |
| `reference/` | 整合（Jesu） | 已验证的参照实现归档，**不进产品运行路径**；删掉不影响构建与测试 | 只读归档 |

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
