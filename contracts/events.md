# 事件契约（EventBus）

所有跨模块通信只走事件总线。模块之间**不得**直接调用对方内部函数，也不得住 HUD 组件里读机器人对象。

命名规则：`域:动作`，全小写，冒号分隔，过去式表示“已发生”。

## 1. 机器人

| 事件 | 载荷 | 触发时机 | 订阅方 |
|---|---|---|---|
| `robot:state` | `{from, to, step, taskId}` | 状态机完成一次转移 | HUD 状态条、日志 |
| `robot:moved` | `{pos:[x,y,z], yaw}` | 每帧节流 10 Hz | 相机跟随、路径调试 |
| `robot:blocked` | `{reason, at:[x,y,z]}` | 寻路失败或到达目标但够不着 | HUD、日志 |
| `robot:holding` | `{objectId\|null}` | 抓取或放置成功 | HUD、记忆面板 |

## 2. 任务

| 事件 | 载荷 | 触发时机 |
|---|---|---|
| `task:start` | `{taskId, query, source}` | 收到指令入队时 |
| `task:step` | `{taskId, index, action, target, ok, ms}` | 每一步结束（成功或失败都发） |
| `task:end` | `{taskId, ok, steps, durationMs, corrected}` | 任务终止 |
| `task:say` | `{text, who:"robot"\|"user"}` | 需要上屏的一句话 |

## 3. 规划

| 事件 | 载荷 | 触发时机 |
|---|---|---|
| `plan:request` | `{query, memoryEnabled}` | 发起 /plan |
| `plan:received` | `{source, steps, latencyMs}` | 收到合法规划 |
| `plan:rejected` | `{reason, raw}` | 结构或语义校验不通过 |
| `plan:corrected` | `{objectId, to, source:"corrective"}` | 命中纠错规则 |

## 4. 记忆

| 事件 | 载荷 | 触发时机 |
|---|---|---|
| `memory:updated` | `{objectId, room, confidence, status}` | 任意一次写入后 |
| `memory:hit` | `{objectId, confidence}` | 复核命中 |
| `memory:miss` | `{objectId, confidence}` | 复核落空（触发复扫） |

## 5. 界面

| 事件 | 载荷 | 触发时机 |
|---|---|---|
| `ui:view` | `{view:"real"\|"overlay"\|"splat"}` | 切换渲染视图 |
| `demo:reset` | `{layoutId}` | 导演面板重置场景 |
| `demo:teleport` | `{objectId, to}` | 把某物体挪走（制造记忆过期） |

## 6. 约束

1. **事件只描述“发生了什么”，不描述“该做什么”。** 订阅方自己决定反应，派发方不得假设有人处理。
2. **载荷必须可 JSON 序列化**，不得传 three.js 对象或函数。
3. **高频事件必须节流**（`robot:moved` 10 Hz）；一次性事件不得节流，否则会丢状态。
4. **新增事件**：在 `events.md` 加一行 + 在 `CHANGELOG.md` 记一笔，属于契约变更，走 contract PR。
