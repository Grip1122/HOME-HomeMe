# PR #7 HUD 整改交付说明

- 交付人：Gary　对接人：Jesu　复核：wei（契约）
- 交付时间：2026-10-31
- 对应 PR：#7（HUD 四块骨架）
- 本次范围：按审核意见整改事件契约、失败状态、对比真实性与测试/交付证据；**不是**新增功能
- 工作区：`D:\黑客松\HOME-HomeMe_PR7`（以下路径均相对仓库根目录）

> 说明：本包由 Jesu 代传，已落到分支 `feat/2-3-hud-skeleton`（PR #7）。代传过程中做了 3 处必要修正
> （jsdom 环境、预览步骤文案、截图按 §5.2 重命名并重拍），逐条记录在 §9。原始整改内容未改动。

## 1. 审核意见与整改结果

| # | 审核意见 | 整改结果 |
|---|---|---|
| 1 | 事件名/载荷必须适配 `contracts/events.md`，不得另起一套事件体系 | HUD 及全部组件只使用契约内事件。实际用到 14 个，全部能在 `contracts/events.md` 找到；不再订阅或派发 `chat:*`、`ui:*`、`toast`、`found`、`compare:update`、`memory:update` 等 17 个旧事件。未新增任何契约事件 |
| 2 | `robot:state` 读错字段，发 `to:"walking"` 仍显示“待机” | `status.js` 改为读取 `payload.to`；缺失或非字符串时显示“状态未知”，不再保留旧的“待机” |
| 3 | `task:step.ok:false` 被标成完成 | 时间线 `ok:true` 才是成功；`ok:false` 显示“失败 · 请查看任务日志”；缺 `ok`/`index` 显示“步骤载荷异常” |
| 4 | `task:end` 失败仍把进度置 100% | 只有 `ok === true` 才 100%；失败按实际完成步数/计划总步数计算，并显示“任务中断 · 已完成 n/total 步” |
| 5 | 空数据生成假对比结果 | 删除硬编码 3/8/5.6/18.4；无真实 `task:end` 配对时显示“暂无对比数据 / 先完成一次记忆开启、一次记忆关闭的同一指令”。示例数据只在预览页出现，并标注“预览数据（非正式任务日志）” |
| 6 | 补前端测试与变红证据 | 5 个测试文件 / 21 条测试，覆盖正常、失败、空数据、缺字段、契约兼容；附故意改错后失败的 `red.txt` 与恢复后的 `green.txt` |
| 7 | 补交付包、路径对应仓库、文案集中、双分辨率截图 | 本文件 + `web/src/ui/copy.js` 集中文案 + 1366×768 / 1920×1080 截图 + 测试日志 |

## 2. 文件清单（仓库路径）

### 2.1 HUD 实现

| 仓库路径 | 说明 |
|---|---|
| `web/src/ui/hud.js` | `createHud()` 装配器；只订阅契约事件，派发 `demo:reset` |
| `web/src/ui/hud.css` | HUD 样式；新增失败摘要、对比空态样式 |
| `web/src/ui/copy.js` | **全部用户可见文案**（状态、时间线、对话、对比、导演模式、错误提示） |
| `web/src/ui/status.js` | 状态条、进度、规划来源；读取 `robot:state.to`、`task:step.ok` |
| `web/src/ui/timeline.js` | 时间线；成功/失败/异常步骤与失败摘要 |
| `web/src/ui/compare.js` | 仅从 `plan:request` + `task:start` + `task:end` 生成会话内配对；空态 |
| `web/src/ui/chat.js` | 对话与快捷指令；派发 `plan:request`，订阅 `task:say` 等 |
| `web/src/ui/memory-panel.js` | 空间记忆；按 `memory:updated` 单条记录增量更新 |
| `web/src/ui/director.js` | 导演模式；只派发 `plan:request`、`demo:teleport`、`demo:reset` |
| `web/src/ui/voice.js` | TTS 订阅 `task:say`；ASR 派发 `plan:request` |
| `web/src/ui/index.mjs` | ESM 入口；先加载 `copy.js`，再导出组件 |
| `web/src/ui/README.md` | 集成说明与新事件表 |

### 2.2 预览与测试

| 仓库路径 | 说明 |
|---|---|
| `web/preview/index.html` | 零依赖预览页（仅演示用，不是正式 HUD 事件源） |
| `web/preview/preview.js` | 预览适配层：把旧演示事件翻译成契约事件后再喂给正式 HUD；预览对比显式标记 `{preview:true}` |
| `web/preview/scene.js` | 预览底图（非生产场景） |
| `web/src/ui/status.test.js` | 6 条：`to` 四态、缺 `to`、失败进度、仅成功 100%、缺 `task:end.ok`、异常 step |
| `web/src/ui/timeline.test.js` | 4 条：成功、失败、缺字段、失败摘要 |
| `web/src/ui/compare.test.js` | 4 条：空态、真实配对、部分数据、缺 `durationMs` |
| `web/src/ui/interaction.test.js` | 5 条：记忆单条更新、hit/miss、异常记忆载荷、`plan:request`、`task:say`/单飞锁 |
| `web/src/ui/hud.contract.test.js` | 2 条：动态读取 `contracts/events.md` 校验所有 on/emit 事件名；状态条字段白名单 |
| `web/vitest.config.js` | jsdom 环境，包含 `src/**/*.test.js` |
| `web/package.json` / `web/package-lock.json` | 增加 `jsdom`；`npm test` = `vitest run` |

### 2.3 文档与证据

| 仓库路径 | 说明 |
|---|---|
| `DELIVERY.md` | 本文件 |
| `docs/acceptance_cases_hud.md` | 12 条 HUD 验收用例（含失败/空数据/异常载荷） |
| `docs/hud_event_contract.md` | 指向 `contracts/events.md` 的说明，不再维护平行契约 |
| `docs/event_contract_gap.md` | 旧事件 → 契约事件逐条映射；当前 HUD 非契约事件为 0 |
| `docs/test-evidence/README.md` | 测试与变异证据说明 |
| `docs/test-evidence/red.txt` | 故意改错后 `2 failed / 19 passed`，退出码 1 |
| `docs/test-evidence/green.txt` | 恢复后 `21 passed`，退出码 0 |
| `docs/shots/shot_hud_01.png` | 1366×768 HUD 实拍（任务完成态） |
| `docs/shots/shot_hud_02.png` | 1920×1080 HUD 实拍（任务完成态） |
| `docs/shots/shot_hud_03.png` | 1366×768 HUD 实拍（失败步骤态） |

## 3. 事件契约对照

### 3.1 订阅（读取字段均来自契约载荷）

| 事件 | 读取字段 | 订阅组件 | 行为 |
|---|---|---|---|
| `robot:state` | `to` | status | 状态文案；缺 `to` → “状态未知” |
| `robot:blocked` | `reason` | status / hud | 状态改为“困惑”并 toast 原因 |
| `task:start` | `taskId`、`source` | status / timeline / memory / chat / compare | 重置进度、记录任务元数据与查询 |
| `task:step` | `index`、`action`、`target`、`ok`、`ms` | status / timeline | 进度与每步结果；失败/异常单独标记 |
| `task:end` | `taskId`、`ok`、`steps`、`durationMs` | status / timeline / chat / compare / hud | 成功 100%，失败按 `steps` 计算并显示中断 |
| `task:say` | `text`、`who` | chat / voice | 上屏与 TTS；用户消息 1.5s 内去重 |
| `plan:request` | `query`、`memoryEnabled` | chat / voice / compare | 对话输入、ASR、导演模式统一从这里发起 |
| `plan:received` | `source`、`steps`、`latencyMs` | status / timeline / chat / hud | 来源标签、计划总步数、规划说明 |
| `plan:rejected` | `reason` | status / chat / hud | 规划失败提示，不进入执行态 |
| `memory:updated` | `objectId`、`room`、`confidence`、`status` | memory | 单条记录 upsert，不做数组全量刷新 |
| `memory:hit` | `objectId`、`confidence` | memory / hud | 命中高亮、显示“找到了”卡片 |
| `memory:miss` | `objectId`、`confidence` | memory / hud | 标记待复核、隐藏找到卡片 |
| `demo:reset` | `layoutId` | hud | 清空当前任务视图 |
| `demo:teleport` | `objectId`、`to` | （仅派发） | 导演模式制造记忆过期 |

### 3.2 派发

HUD 只派发 `plan:request`、`demo:teleport`、`demo:reset` 三个契约事件，均由用户操作触发。

契约中未被 HUD 使用的事件：`robot:moved`、`robot:holding`、`plan:corrected`、`ui:view`。保留不用，不影响契约。

## 4. 失败与空数据行为

### 4.1 失败步骤

- `task:step { ok: true }` → 绿色“成功”，进度 `index + 1`
- `task:step { ok: false }` → 红色“失败 · 请查看任务日志”，进度停在 `index`，状态条显示“步骤失败”
- 缺 `ok` 或缺 `index` → 红色“步骤载荷异常”，不推进进度，也不显示成功

### 4.2 失败任务

- `task:end { ok: true }` → 进度 100%，摘要“任务完成 · n 步 · 时长”
- `task:end { ok: false }` → 不置 100%，进度按 `steps / 计划总步数`，摘要“任务中断 · 已完成 n/total 步”，任务标签“失败”
- 缺 `ok` → 摘要“任务结束 · 状态未知”，标签“中断”

### 4.3 对比

- 只有同一归一化查询同时存在 `memoryEnabled:true` 与 `false` 的**成功** `task:end` 才渲染对比
- 无配对 → “暂无对比数据”，不显示任何数字
- `durationMs`、`steps` 非法或缺字段 → 直接空态
- 预览页示例 → 副标题改为“以下是演示用示例数据，仅用于预览；正式组件只读取真实 task:end 事件”，底部标注“预览数据（非正式任务日志）”

## 5. 测试与证据

### 5.1 运行方式

```bash
cd web
npm ci
npm test
```

CI 中同样执行 `npm test`；`package.json` 已包含 `vitest`、`jsdom`，配置在 `web/vitest.config.js`。

### 5.2 结果

- `Test Files 5 passed (5)`
- `Tests 21 passed (21)`
- 覆盖正常、失败、空数据、未知/缺失字段、事件契约兼容

### 5.3 变红证据

把 `web/src/ui/status.js` 的 `p.to` 故意改成 `p.state` 后：

- `status.test.js` 的 `reads robot:state.to for idle / walking / celebrating / error` 失败
- `hud.contract.test.js` 的 `uses only contract fields in the status path` 失败
- 输出 `2 failed / 19 passed`，退出码 1（`docs/test-evidence/red.txt`）

恢复 `p.to` 后重新运行，21/21 通过，退出码 0（`docs/test-evidence/green.txt`）。

## 6. 截图

| 文件 | 分辨率 | 内容 |
|---|---|---|
| `docs/shots/shot_hud_01.png` | 1366×768 | 任务完成态、四块 HUD、记忆列表、时间线、找到卡片 |
| `docs/shots/shot_hud_02.png` | 1920×1080 | 同上，宽屏布局 |
| `docs/shots/shot_hud_03.png` | 1366×768 | 失败步骤态：时间线红行「失败 · 请查看任务日志」、进度 2/9、状态「前往中」 |

截图来自 `web/preview/`（演示数据），用于验证 HUD 布局与状态文案；生产场景由设计 B 的高斯泼溅接管。

## 7. 已执行的验证

| 验证 | 结果 |
|---|---|
| `npm ci` | 通过，79 个包，0 漏洞 |
| `npm test` | 5 文件 / 21 测试通过 |
| 预览 `?auto=memory` | 4 步完成，记忆 8 条，找到卡片正常，无 `.ht-error` |
| 预览 `?auto=moved` | 失败步骤显示“失败 · 请查看任务日志”，进度 2/9，状态“前往中”，无错误 |
| 预览 `?auto=compare` | 显示预览标注与示例数据，无错误 |
| 对比空态 | 无历史时显示“暂无对比数据”，网格隐藏，无数字 |
| 布局实测 | 左右侧栏各 283px（21.0%）@1366×768，各 312px（16.4%，视口 1902px）@1920×1080，均 ≤22%；四块互不重叠 |

## 8. 未完成 / 需要配合

1. ~~尚未推送~~ → **已由 Jesu 代传**：合并 `origin/main` 后落到 `feat/2-3-hud-skeleton`，CI 结果见 PR #7。
2. **尚未与 `core/bus.js` 联调**：测试使用同签名的 mock bus；事件名与字段已按契约校验，但未在真实场景中跑完整任务。
3. ~~本地 `npm run build` 未能完成~~ → **已解决**：代传时合并了 `origin/main`（含 `web/src/main.js` 与 `src/core/spinning_cube.js`），`npm run build` 通过（8 modules，527.68 kB，299ms）。
4. **契约变更**：本 PR 未新增事件；若后续需要 `ui:view` 联动或新的 UI 事件，请按契约第 6 节走 contract PR，由 wei 与 Jesu 审核。

## 9. 代传复核（Jesu，2026-10-31）

本节记录代传时对原包做的修正与独立复核结果，**原整改内容（第 1~7 节）未改写**。

### 9.1 修正 1：`vitest.config.js` 全局 jsdom 打挂设计 A 的测试

原包把 `test.environment` 设为 `jsdom`，而设计 A 的 `nav / robot / scene` 测试用
`readFileSync(new URL(..., import.meta.url))` 读取 layout 与 manifest，jsdom 的 `URL` 不认 `file:` 协议：

```
TypeError: The URL must be of scheme file
Test Files  4 failed | 7 passed (11)
Tests  33 passed (33)
```

改为**默认 `node` 环境**，HUD 的 5 个测试文件首行各自声明 `// @vitest-environment jsdom`。
修复后全仓前端测试：

```
Test Files  11 passed (11)
Tests  69 passed (69)
```

### 9.2 修正 2：预览时间线漏出英文动作名

`copy.js` 的 `actionLabels` 没有 `found` 这一项（预览末步用 `action:"found"`），
时间线因此回退显示原始 id —— 截图里出现「found · 红色水杯」。补 `found: "确认找到"`。
生产动作取自 `contracts/plan.schema.json` 的枚举（`find/go/grab/drop/observe`），均已有中文文案。

### 9.3 修正 3：截图命名与重拍

按 §5.2 改为 `shot_<模块>_<两位序号>.png`，并用当前代码重拍：

| 文件 | 分辨率 | 内容 |
|---|---|---|
| `docs/shots/shot_hud_01.png` | 1366×768 | 任务完成态（4 步 · 2.8s，记忆 8 条，找到卡片 91%） |
| `docs/shots/shot_hud_02.png` | 1920×1080 | 同上，宽屏 |
| `docs/shots/shot_hud_03.png` | 1366×768 | 失败步骤态（红行「失败 · 请查看任务日志」，进度 2/9，状态「前往中」） |

布局实测（`?debug=1` 输出）：1366 视口 1348px，左右侧栏各 283px = **21.0%**；
1920 视口 1902px，各 312px = **16.4%**；四块无重叠。

### 9.4 独立复核

| 项 | 方法 | 结果 |
|---|---|---|
| 事件越界 | 扫描 `web/src/ui/*.js` 全部 `on/emit` 字面量，对比 `contracts/events.md` | 契约内 14 个，**契约外 0 个** |
| 状态字段 | 读 `status.js` 源码 | 只读 `robot:state.to`，缺 `to` → 「状态未知」 |
| 步骤成败 | `task:step.ok` 布尔判定 | `ok:false` → 失败红行且不推进进度 |
| 任务失败 | `task:end.ok/steps` | 仅 `ok===true` 置 100%，否则按 `steps/total` |
| 对比真实性 | 读 `compare.js` 配对逻辑 | 无 `task:end` 配对 → 空态「—」，不伪造数字 |
| 文案集中 | 扫非 `copy.js` 文件中的中文字面量 | 仅剩开发期 `throw new Error` 与房间排序键，无用户可见文案 |
| 变红证据 | 把 `status.js` 的 `p.to` 改 `p.state` 后重跑 | **复现**：`2 failed / 67 passed`，失败项与原包 `red.txt` 一致 |
| 契约文件 | 包内 `contracts/events.md` 与 `origin/main` 比对 | **sha256 相同**，未改动，未进 diff |
| 后端回归 | 合并 `origin/main` 后 `pytest -q` | 见 PR #7 检查项 |
| 构建 | `npm run build` | 通过 |

### 9.5 仍存在的已知问题（不阻塞合并）

1. **对话区高度偏紧**：`.ht-chat-messages` 上限 128px，3 条消息时最早一条被滚动裁掉半行。
   属滚动行为而非文字截断；若要改需同步上移 `.ht-found`（`bottom: 218px`），建议单独 PR。
2. **未与真实 `core/bus.js` 联调**：测试用同签名 mock，事件名与字段已按契约校验。
3. **`hud.contract.test.js` 依赖 cwd**：用 `resolve(process.cwd(), "../contracts/events.md")`，
   必须在 `web/` 下运行（CI 与 `npm test` 均满足）。
