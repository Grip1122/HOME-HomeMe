# web/src/ui · HUD 集成说明

## 1. 目录

```
web/src/ui/
├─ copy.js            # 所有用户可见文案（唯一来源）
├─ hud.css            # 设计 token + 样式
├─ hud.js             # createHud() 装配器
├─ chat.js            # 对话 / 输入 / 单飞锁
├─ status.js          # 状态条 / 步骤 / 规划来源
├─ memory-panel.js    # 记忆面板 / 置信度 / hit/miss
├─ timeline.js        # 任务时间线 / 失败步骤
├─ compare.js         # 从 task:end 事件构建对比（无数据即空态）
├─ voice.js           # TTS / ASR
├─ director.js        # 导演模式（只发契约事件）
├─ index.mjs          # ESM 入口
├─ *.test.js          # Vitest 测试（与组件同目录）
└─ README.md
```

无第三方运行时依赖；测试使用 `vitest` + `jsdom`。

## 2. 最小接入

```js
import "./ui/hud.css";
import { createHud } from "./ui/index.mjs";
import { bus } from "./core/bus.js";

const hud = createHud({
  bus,
  root: document.body,
  catalog: {
    cup_red: { name: "红色水杯", color: "#e8643a", furniture: "茶几" },
  },
  memoryEnabled: true,
  layoutId: "A",
});
```

`createHud` 返回：

```js
{ el, chat, status, memory, timeline, compare, voice, director, destroy() }
```

## 3. 事件契约

唯一真值：`contracts/events.md`。HUD **只**使用以下事件。

### 3.1 订阅

| 事件 | 载荷字段 | HUD 用途 |
|---|---|---|
| `robot:state` | `{from,to,step,taskId}` | 状态条读取 `to` |
| `robot:blocked` | `{reason,at}` | toast + 困惑状态 |
| `task:start` | `{taskId,query,source}` | 进入任务、锁输入 |
| `task:step` | `{taskId,index,action,target,ok,ms}` | 进度、时间线成功/失败 |
| `task:end` | `{taskId,ok,steps,durationMs,corrected}` | 完成/中断、进度、对比 |
| `task:say` | `{text,who:"robot"\|"user"}` | 对话气泡、TTS |
| `plan:request` | `{query,memoryEnabled}` | Chat/Voice/Director 发出；Chat 回显用户、Compare 记录 |
| `plan:received` | `{source,steps,latencyMs}` | 规划来源、计划步数 |
| `plan:rejected` | `{reason,raw}` | 对话错误提示 + toast |
| `memory:updated` | `{objectId,room,confidence,status}` | 单条记忆写入/更新 |
| `memory:hit` | `{objectId,confidence}` | 命中、目标卡片 |
| `memory:miss` | `{objectId,confidence}` | 过期、置信度下降 |
| `demo:reset` | `{layoutId}` | 重置任务 HUD |

### 3.2 派发

| 事件 | 载荷 | 触发 |
|---|---|---|
| `plan:request` | `{query,memoryEnabled}` | 输入、快捷指令、语音、导演旅程 |
| `demo:teleport` | `{objectId,to}` | 导演「物品被移动」 |
| `demo:reset` | `{layoutId}` | 顶栏/导演重置 |
| `ui:view` | `{view:"real"\|"overlay"\|"splat"}` | 预留；当前 HUD 不主动切换 |

不得新增 HUD 私有事件。确需新增，先改 `contracts/events.md`（`[CONTRACT]` PR + `contracts.lock.json` + `CHANGELOG.md`）。

## 4. 关键行为

- **状态**：只读 `robot:state.to`；缺失 `to` 显示「状态未知」，不会沿用旧状态。
- **失败步骤**：`task:step.ok === false` 显示失败 + 「请查看任务日志」，不会标成完成。
- **失败任务**：`task:end.ok === false` 按 `steps / 计划步数` 计算进度，不设 100%；状态显示中断。
- **单飞锁**：`plan:request` / `task:start` 锁输入，`task:end` / `plan:rejected` 释放。
- **记忆**：`memory:updated` 是单条记录；面板用 Map 维护全量。命中/过期分别由 `memory:hit` / `memory:miss` 驱动。
- **对比**：`compare.js` 只从本次会话的 `plan:request + task:start + task:end` 推导同指令、不同 `memoryEnabled` 的真实 steps/耗时；没有成对数据时显示「暂无对比数据」，不填默认值。
- **文案**：全部在 `copy.js`，组件不再散落中文串。
- **目标卡片**：由 `memory:hit` 驱动，只显示 objectId/catalog 名称、房间、置信度；没有「带回来」这类契约外动作。

## 5. 测试

```bash
cd web
npm ci
npm test
```

覆盖：

- `status.test.js`：`to` 字段、idle/walking/celebrating/error、失败进度、缺失 `ok`、异常 step。
- `timeline.test.js`：成功步骤、失败步骤、缺失字段、失败任务摘要。
- `compare.test.js`：空数据、真实 pair、部分数据、缺 duration。
- `interaction.test.js`：`plan:request`、`task:say`、单飞锁、记忆 hit/miss。
- `hud.contract.test.js`：动态读取 `contracts/events.md`，断言 HUD 订阅/派发的每个事件名都在契约内。

`docs/test-evidence/red.txt` 是故意把 `status.js` 的 `p.to` 改成 `p.state` 后的失败输出；`green.txt` 是恢复后的 21 条通过输出。

## 6. 预览

`web/preview/index.html` 是 demo-only 页面：

- 用 `?auto=memory|first|moved|correct|compare|move` 驱动；
- 预览的 mock bus 在 `preview.js` 里把旧 demo 事件翻译成正式契约；**生产 HUD 不使用这层适配**；
- 对比卡片在预览里使用 `setData(..., {preview:true})`，必须显示「预览数据（非正式任务日志）」。
