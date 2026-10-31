# 事件契约差异审计（整改后）

## 结论

整改后，`web/src/ui/` 不使用任何契约外事件。  
测试 `hud.contract.test.js` 会读取 `contracts/events.md`，对 HUD 实际 `on/emit` 的事件名逐条断言。

## 旧 → 新映射

| 整改前 HUD 事件 | 现在的做法 |
|---|---|
| `chat:message` / `chat:typing` / `chat:clear` | `task:say` + `plan:request` 本地打字态 |
| `memory:update`（数组） | `memory:updated`（单条） |
| `memory:highlight` | `memory:hit` / `memory:miss` 的条目刷新 |
| `found` | `memory:hit` |
| `compare:update` | 不订阅；Compare 从 `plan:request + task:start + task:end` 推导 |
| `layout:change` / `offline:change` | 删除；布局/离线不再是 HUD 事件 |
| `memory:toggle` | 本地状态，随 `plan:request.memoryEnabled` 发出 |
| `plan:degraded` | `plan:rejected` + `plan:received.source` |
| `task:reset` | `demo:reset {layoutId}` |
| `toast` | HUD 本地方法，不跨模块 |
| `ui:director` | `plan:request` / `demo:teleport` / `demo:reset` |
| `ui:query` | `plan:request` |
| `ui:voice` / `voice:speak` | ASR 直接发 `plan:request`；TTS 订阅 `task:say` |
| `ui:foundAction` | 删除；目标卡片只保留本地关闭 |
| `ui:focusObject` | 删除；无对应契约事件 |
| `ui:compareClose` | 删除；Compare 本地关闭 |

## 判定

- `robot:state` 读取 `to`，不是 `state`。
- `task:step` 读取 `ok/ms`，不读 `status/durationMs`。
- `task:end` 读取 `ok/steps/durationMs`，不读 `found/stepCount`。
- `memory:updated` 读取 `objectId/room/confidence/status`，不读数组/name/color。
- 所有 UI 派发均为契约内事件：`plan:request`、`demo:teleport`、`demo:reset`。
