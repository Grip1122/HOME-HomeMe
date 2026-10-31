# HUD 验收用例（契约整改版）

> 设计 C · 步骤 0.2 / 2.4  
> 判定口径以 `contracts/events.md` 为准；HUD 不再有私有事件。
>
> **判定边界**：本文件全部用例由 `web/src/ui/*.test.js`（同签名 mock bus）与 `web/preview/` 演示页验证，
> 证明的是**组件行为符合契约**。真实 `core/bus.js` 的事件时序、节流与跨模块联调**尚未执行**，
> 因此本文件**不构成生产集成验收**，联调需另开验收记录。

| ID | 场景 | 前置 / 操作 | 期望画面 | 期望事件与数据 | 通过标准 |
|---|---|---|---|---|---|
| HUD-01 | `robot:state` 字段 | 发送 `{from:"idle",to:"walking",step:0,taskId:"t1"}` | 状态条显示「前往中」 | 只读 `to` | 发 `to` 后状态变化；发缺失 `to` 显示「状态未知」 |
| HUD-02 | 成功步骤 | `task:start` + `task:step {ok:true,ms:800}` | 时间线一行绿色，耗时 800ms | `task:step.ok/ms` | 不出现失败态 |
| HUD-03 | 失败步骤 | `task:step {ok:false,ms:500}` | 该行红色，文案「失败 · 请查看任务日志」 | `ok=false` | 不标成完成 |
| HUD-04 | 失败任务进度 | 计划 4 步，完成 1 步后 `task:end {ok:false,steps:1}` | 进度 25%，状态「任务中断」 | `task:end.ok/steps` | 不出现 100% |
| HUD-05 | 成功任务 | `task:end {ok:true,steps:3,durationMs:2400}` | 进度 100%，摘要「任务完成 · 3 步 · 2.4s」 | `task:end` | 仅 `ok=true` 才 100% |
| HUD-06 | 对话 | `task:say {who:"user"}` / `{who:"robot"}` | 用户/小方气泡各一条，不重复 | `task:say` | 单飞锁在任务结束释放 |
| HUD-07 | 记忆命中 | `memory:updated` + `memory:hit` | 条目高亮、目标卡片出现 | `objectId/room/confidence/status` | 不读非契约字段 |
| HUD-08 | 记忆过期 | `memory:miss {confidence:0.45}` | 条目「待复核」，置信度 45% | `memory:miss` | 不显示成命中 |
| HUD-09 | 空对比 | 没有任何两次同指令 task:end，打开对比 | 「暂无对比数据」，数字为「—」 | 无 | 不显示 3/8、5.6s 等默认值 |
| HUD-10 | 真实对比 | 同一 query、memory 开/关各完成一次 task:end | 双列显示真实 steps 与耗时，注明来自 task:end | `plan:request/task:start/task:end` | 无数据不伪造 |
| HUD-11 | 契约兼容 | 动态读取 `contracts/events.md`，运行组件交互 | 测试通过 | 所有订阅/派发事件在契约内 | 出现契约外事件即失败 |
| HUD-12 | 分辨率 | 1366×768 / 1920×1080 | 左右侧栏各 21.0%（1366，视口 1348px）/ 16.4%（1920，视口 1902px），均 ≤22%，无滚动、无遮挡 | — | 截图 `docs/shots/shot_hud_01.png`（1366）/ `docs/shots/shot_hud_02.png`（1920）；失败态另见 `shot_hud_03.png` |

## 失败载荷专项

- `task:step` 缺 `index` 或 `ok`：时间线出现「步骤载荷异常」红行，不崩溃、不标成功。
- `task:end` 缺 `ok`：状态「任务结束 · 状态未知」，进度不得为 100%。
- `memory:updated` 缺 `objectId`：忽略，不生成条目。
- `robot:state` 缺 `to`：显示「状态未知」，不沿用旧状态。
- 空数据对比：显示「暂无对比数据」，不填默认值。
