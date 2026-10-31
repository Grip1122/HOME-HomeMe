# 交付说明

- 交付人：Gary　对接人：Jesu　代传上传：Jesu（Grip1122）　时间：2026-10-31 12:20
- 对应步骤：2.3（HUD 四块骨架）为主，附带 0.2（验收用例）与 2.4 的判定口径部分
- 原始包：`taskC任务.zip`（2026-10-31 12:07）

## 1. 本次交付清单（仓库内路径）

| # | 仓库内路径 | 用途 |
|---|---|---|
| 1 | `web/src/ui/hud.js` | `createHud()` 装配器：四块 HUD 的 DOM 模板、事件订阅、toast / 找到卡片 / 布局与离线状态 |
| 2 | `web/src/ui/hud.css` | 设计 token 与全部样式（浅底卡片 + 单一品牌色） |
| 3 | `web/src/ui/chat.js` | 对话区、输入、快捷指令、单飞锁 |
| 4 | `web/src/ui/status.js` | 状态条、步骤进度、规划来源标签 |
| 5 | `web/src/ui/memory-panel.js` | 记忆面板、置信度三段色、变化高亮 1 秒 |
| 6 | `web/src/ui/timeline.js` | 任务时间线、每步耗时、错误态 |
| 7 | `web/src/ui/compare.js` | 训练前后对比卡片（Chart 柱状） |
| 8 | `web/src/ui/voice.js` | TTS / ASR 封装 |
| 9 | `web/src/ui/director.js` | 导演模式抽屉 |
| 10 | `web/src/ui/index.mjs` | ESM 入口，导出 `createHud` 与各组件 |
| 11 | `web/src/ui/README.md` | 集成说明（替换原占位 README） |
| 12 | `web/preview/index.html` | 零依赖预览页，双击即开 |
| 13 | `web/preview/preview.js` | 预览页的假数据驱动与旅程脚本（`?auto=`） |
| 14 | `web/preview/scene.js` | 预览页 HUD 底图（非生产场景） |
| 15 | `docs/acceptance_cases_hud.md` | 十条可判定验收用例（HUD 视角，四栏 + 通过标准） |
| 16 | `docs/hud_event_contract.md` | HUD 事件契约（设计 C 审核版，**未覆盖 `contracts/`**） |

> 代传补录（非 Gary 产出）：`docs/event_contract_gap.md`（契约差异逐条对照）、`docs/shots/shot_hud_01.png` / `shot_hud_02.png`（代传人复核截图）。

## 2. 订阅的事件

HUD 实际订阅 21 个事件名，其中**仅 4 个在 `contracts/events.md` 已声明**：

- 契约内（4）：`task:start`、`task:step`、`task:end`、`plan:received`
- 契约外（17）：`chat:clear`、`chat:message`、`chat:typing`、`compare:update`、`comparison:hide`、`found`、`layout:change`、`memory:highlight`、`memory:toggle`、`memory:update`、`offline:change`、`plan:degraded`、`task:reset`、`toast`、`ui:director`、`ui:voice`、`voice:speak`

HUD 派发 8 个事件名，全部在契约外：`chat:message`、`toast`、`ui:compareClose`、`ui:director`、`ui:focusObject`、`ui:foundAction`、`ui:query`、`ui:voice`。

逐条对照与影响见 `docs/event_contract_gap.md`。**这不是笔误，是两套事件命名体系**，合并前必须由契约 PR 裁决。

## 3. 网盘文件

无。本次交付不含录屏、大图。

## 4. 自检结果

| 项 | 结果 |
|---|---|
| `node --check` 全部 11 个 JS | 通过 |
| 预览页静态可加载（无外部依赖、无 CDN、无构建） | 通过 |
| 1366×768 与 1920×1080 下 HUD 宽度 ≤ 22% | 代传人复核补拍：`docs/shots/shot_hud_01.png`（1366）、`shot_hud_02.png`（1920）；左右面板约占 19% / 17%（1366）与 14% / 12%（1920），均 ≤ 22% |
| 每模块 ≥ 3 条测试（`<模块>.test.js`） | **未提供**，本包 0 条测试 |
| 「故意改错 → 测试变红」终端输出 | **未提供** |
| 事件名只用契约已声明的 18 个 | **不符合**，见第 2 节 |
| 文案集中在 `web/src/ui/copy.js` | **未遵守**，文案散落在各组件 |

## 5. 我的 Agent 做了哪些假设

1. 包内 `src/ui/` 即 `web/src/ui/`，`preview/` 即 `web/preview/`（其 `index.html` 用 `../src/ui/...` 相对引用，与仓库结构自洽）。
2. 包内 `02-acceptance-cases.md` 是 HUD 视角的**补充**用例，不改 `docs/test-cases.md` 已定稿的期望值，因此另存为 `docs/acceptance_cases_hud.md`。
3. 包内 `events.md` 是对契约的**审核 / 提案版**，`contracts/` 只读，因此另存为 `docs/hud_event_contract.md`，不覆盖契约。
4. 预览页的 `scene.js` 只是 HUD 底图，生产场景由设计 B 的高斯泼溅接管。

## 6. 需要别人配合的事

1. **契约裁决（阻断联调）**：HUD 订阅的 17 个事件名契约里没有；契约里 14 个事件 HUD 没听。需要 wei（AI-D，契约裁决）与 Jesu 共同决定走哪条路：
   - A. 扩契约：把 `chat:*`、`memory:update`、`found`、`plan:degraded`、`layout:change`、`offline:change`、`task:reset`、`toast` 及 UI 派发的 8 个事件补进 `contracts/events.md`，走 `contract/` 分支 + `[CONTRACT]` PR；
   - B. 改 HUD：把 HUD 适配到现有 18 个事件（`task:say`、`memory:updated/:hit/:miss`、`plan:rejected`、`plan:corrected`、`ui:view`、`demo:reset`、`demo:teleport`），`robot:state` 接进状态条。
2. **测试补齐**：HUD 与各组件共 10 个模块需要 30 条以上测试（正常 / 边界 / 异常），当前为 0。
3. **截图证据**：1366×768 与 1920×1080 各一张，用于证明 22% 宽度硬上限。
4. **文案抽取**：把各组件里的中文串收敛到 `web/src/ui/copy.js`，否则后续改台词要动 8 个文件。
