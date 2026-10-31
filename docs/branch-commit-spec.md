# 分支、提交与合并规范

四人 × AI 辅助开发，26 小时窗口。规范的目标不是“好看”，是**让把关人能在 3 分钟内判断一个 PR 该不该合**。

---

## 1. 分支

| 分支 | 谁用 | 命名 | 生命周期 |
|---|---|---|---|
| `main` | 全员只读 | — | 永久；**禁止直推**（本地钩子与人工审查；服务端保护尚未启用） |
| 功能分支 | 每人 | `feat/<步骤号>-<短名>`，如 `feat/2-1-grab-action` | 合并后删除 |
| 修复分支 | 每人 | `fix/<现象短名>`，如 `fix/grab-scope-jump` | 合并后删除 |
| 契约分支 | 任何人 | `contract/<改什么>`，如 `contract/doors-width` | 合并后删除 |
| 演示分支 | 设计 A | `demo/<场景>`，用于彩排期临时隔离，**不得存活过夜** | 当日删除 |

**一人同时最多一个未合并分支。** 分支活过 4 小时视为风险：要么拆小合并，要么废弃。

```bash
git switch main && git pull --ff-only
git switch -c feat/2-1-grab-action
# ... 开发、测试 ...
git push -u origin feat/2-1-grab-action
gh pr create --fill --base main
```

---

## 2. 提交信息

格式（`commit-msg` 钩子强校验）：

```
<type>(<scope>): <摘要>

<可选正文：为什么这么改，而不是改了什么>

Authored-by: ai|human|ai+human
Step: 2.1
```

| 位置 | 规则 |
|---|---|
| `type` | `feat` 新功能 / `fix` 修缺陷 / `test` 只动测试 / `docs` 只动文档 / `contract` 只动 contracts / `chore` 构建与配置 / `refactor` 不改行为 / `perf` 性能 |
| `scope` | 目录或模块名：`robot` `nav` `scene` `ui` `server` `rules` `layout` `ci` |
| 摘要 | 中文可，动宾结构，不写“修改了一些东西”。**带步骤号**，便于对照方案查进度 |
| `Authored-by` | 必填。`ai` = 基本由 AI 生成未大改；`ai+human` = AI 起草人改过；`human` = 纯手写 |
| `Step` | 方案里的步骤编号；文档/CI 类写 `-` |

**一次提交只做一件事。** 混提交（既改逻辑又调格式又改文档）在审核时会被要求拆分——这是为了出问题时能 `git revert` 单个提交而不牵连其他改动。

---

## 3. 合并

只允许 **Squash and merge**，PR 标题即最终提交信息（沿用上面的格式）。理由：演示期分支多、提交碎，squash 让 `main` 的历史一条 PR 一行，回滚粒度清晰。

合并前必须满足（当前采用人工门禁；GitHub 分支保护未启用）：

1. CI 四个 job 全绿（契约闸门 / 后端测试 / 变异验证 / 前端测试）。
2. 把关人已 approve，且 PR 模板自检项**全部勾选**。
3. 至少 1 条“变红证据”（见 `review-checklist.md` 第 1 关）。
4. 分支已与 `main` 同步（`git rebase main` 或 GitHub 的 update branch）。

---

## 4. 里程碑标签

| tag | 时点 | 含义 |
|---|---|---|
| `m0-contracts` | 契约冻结 | 四份 Schema + events.md + lock 就位 |
| `m1-offline` | 离线可演 | 五句台词离线跑通，十条用例过八条 |
| `m2-full` | 全链路 | 自然语言 + 记忆 + 纠错贯通，录屏完成 |
| `m3-visual` | 视觉定稿 | 正式美术，帧率达标 |
| `m4-submit` | 提交 | 提交包完整，离线可运行 |

打 tag 只在**把关人**合并对应 PR 后执行，避免“自己给自己发奖”。

---

## 5. 紧急通道（只在彩排期使用）

11 月 1 日 09:00 后不再走正常 PR 流程，改为：

1. 把关人口头同意；
2. 改动**只能是文案、颜色、时长参数**，不得动逻辑；
3. 直接改 `main`，但必须 `git tag hotfix-<时间>` 留痕；
4. 改完立刻用录屏兜底。

**超过这个范围的改动一律拒绝**，宁可播放录屏。

## 当前服务端门禁状态（2026-10-31）

仓库公开；当前上传账号只有 push 权限，没有 admin/maintain 权限。main 的保护接口返回 404，仓库 rulesets 为空，不能声称已经启用服务端保护。保留公开属性与当前方案，不擅自转私有或升级付费。管理员 Jesu 应核对分支保护可用性，能启用时要求 PR、独立审核与四项 CI；无法启用时继续人工门禁：作者不自审、不直推 main，Jesu 审核 D 的 PR，CI 全绿后由非作者 squash merge。CODEOWNERS 与本地钩子不等同于服务端强制保护。

## 布局更新边界

`contracts/layout.schema.json` 定义结构；`contracts/layout.example.json` 是合法用例，不是运行真值。运行布局的唯一源是 B 管理的 `web/public/layouts/*.json`，其版本独立递增并经过 Schema、静态布局与寻路快照检查。契约示例更新只提交 contracts/ 和自动刷新的 lock；无需复制到 layout_A。业务布局改动另开 PR，运行 `python scripts/gen_nav_fixture.py` 更新派生导航快照。Schema 发生不兼容更新时，应先设计向后兼容/分阶段迁移，不绕过契约门禁混合提交。
