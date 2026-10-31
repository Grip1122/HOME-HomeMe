# HUD 事件契约（设计 C 审核版）

> 对应步骤 0.2 · 事件契约  
> 原则：UI 只订阅事件，不直接读机器人 / 场景 / 记忆内部对象；执行层只 emit，不操作 DOM。

---

## 1. 事件一览

| 事件 | 方向 | 生产者 | 消费者 | 用途 |
|---|---|---|---|---|
| `robot:state` | 执行 → UI | FSM / actions | Status | 状态文案与状态点 |
| `task:start` | 执行 → UI | TaskQueue / planner | Chat, Status, Timeline, HUD | 任务开始，锁输入 |
| `task:step` | 执行 → UI | Actions / EventBus | Status, Timeline | 步骤开始 / 完成 / 失败 |
| `task:end` | 执行 → UI | TaskQueue | Chat, Status, Timeline, HUD | 任务结束，解锁输入 |
| `task:reset` | 导演 → UI | Director / reset | Chat, Status, Timeline, HUD | 清空任务 UI |
| `plan:received` | 规划 → UI | Planner | Status, HUD | 规划来源与延迟 |
| `plan:degraded` | 规划 → UI | Planner | Status, HUD | 降级提示 |
| `memory:update` | 记忆 → UI | Memory client | MemoryPanel | 记忆列表 |
| `memory:highlight` | 记忆 → UI | Actions / memory | MemoryPanel | 单条闪烁 |
| `memory:toggle` | 导演 → UI | Director / settings | HUD, Director | 记忆开关 |
| `chat:message` | 执行 → UI | Chat / actions | Chat, Voice | 对话气泡 |
| `chat:typing` | 执行 → UI | Chat / actions | Chat | 思考三点 |
| `chat:clear` | 导演 → UI | Director / reset | Chat | 清空对话 |
| `found` | 执行 → UI | find / verify | HUD, MemoryPanel | 目标卡片 |
| `compare:update` | 实验 → UI | Experiment | Compare | 对比卡片 |
| `layout:change` | 场景 → UI | Switcher | HUD | 布局标签 |
| `offline:change` | 网络 → UI | Planner / director | HUD | 离线徽标 / 来源 |
| `toast` | 任意 → UI | 任意 | HUD | 轻提示 |
| `ui:query` | UI → 执行 | Chat / Voice | Planner | 文字 / 语音指令 |
| `ui:voice` | 语音 → UI/执行 | Voice | Chat, Planner | 识别结果 |
| `ui:focusObject` | UI → 场景 | MemoryPanel | Scene | 聚焦物体 |
| `ui:director` | UI → 执行 | Director / topbar | Director handler | 导演动作 |
| `ui:foundAction` | UI → 执行 | Found card | Actions | 带回 / 知道了 |
| `ui:compareClose` | UI → 实验 | Compare | Experiment | 关闭对比 |
| `voice:speak` | 任意 → 语音 | 执行 / UI | Voice | 指定文本播报 |

---

## 2. 字段定义

### 2.1 `robot:state`

```json
{ "state": "walking", "text": "前往中 · 正在走路" }
```

- `state`: `idle | thinking | walking | scanning | picking | placing | confused | correcting | celebrating | error`
- `text`: 可选；缺省时 HUD 使用内置文案。

### 2.2 `task:start`

```json
{
  "id": "task-12",
  "query": "帮我找红色水杯",
  "source": "rule",
  "total": 4
}
```

- `source`: `cache | llm | online | rule | offline | seed`
- `total`: 预期动作数；用于进度条与“第 i/n 步”。

### 2.3 `task:step`

```json
{
  "id": "task-12",
  "index": 1,
  "total": 4,
  "action": "go",
  "label": "前往 客厅",
  "targetLabel": "客厅",
  "status": "active",
  "sub": "A* 寻路 · 避障",
  "durationMs": null
}
```

- `status`: `active | done | error`
- `durationMs`: `done/error` 时必填；`active` 时为空。
- `action`: `parse | memory | find | go | grab | drop | observe | scan | verify | correct | found`
- 同 `index` 的 `active` 与 `done` 必须成对；失败发 `error`，不要再发 `done`。

### 2.4 `task:end`

```json
{
  "id": "task-12",
  "stepCount": 4,
  "durationMs": 2800,
  "found": true,
  "corrected": false
}
```

- `stepCount` 使用真实执行记录，不可写死。
- `found=false` 时状态回 `idle`，不是 `celebrating`。

### 2.5 `task:reset`

```json
{}
```

- 清空时间线、状态、锁；不删除记忆。

### 2.6 `plan:received`

```json
{ "source": "rule", "latencyMs": 120, "steps": [ ... ] }
```

- `latencyMs` 可用于来源标签“规则解析 · 120ms”。
- `steps` 可选；HUD 不依赖具体动作，仅用于调试。

### 2.7 `plan:degraded`

```json
{ "from": "llm", "to": "rule", "reason": "timeout" }
```

- HUD 显示 toast：「在线规划超时，已切换到规则解析」；来源标签改为规则。

### 2.8 `memory:update`

```json
{
  "layoutId": "A",
  "objects": [
    {
      "object_id": "cup_red",
      "name": "红色水杯",
      "room": "客厅",
      "furniture": "茶几",
      "color": "#E8643A",
      "confidence": 0.91,
      "status": "fresh",
      "pos": [1.6, 0.48, 0.4],
      "updated_at": "2026-10-31T11:50:00+08:00"
    }
  ]
}
```

- `objects` 必须是**当前布局全量**，不是增量；HUD 做 diff 高亮。
- `status`: `fresh | stale`
- 置信度 ≥0.7 绿、0.3–0.7 黄、<0.3 灰；stale 红。

### 2.9 `memory:highlight`

```json
{ "objectId": "cup_red" }
```

- 只让指定条目闪烁 1 秒；不影响列表顺序。

### 2.10 `memory:toggle`

```json
{ "enabled": false }
```

- 关闭后 `find` 必须走全屋扫描；HUD 只更新开关与提示。

### 2.11 `chat:message`

```json
{ "role": "butler", "text": "找到啦！在客厅的茶几。", "meta": { "tag": "rule" } }
```

- `role`: `user | butler`
- 用户消息由 Chat 在提交时添加；执行层不要重复发同一条。
- 语音播报只读 `role=butler`。

### 2.12 `chat:typing`

```json
{ "on": true }
```

- 等待规划 / 生成回复时显示三点；收到 `chat:message` 自动关闭。

### 2.13 `chat:clear`

```json
{}
```

### 2.14 `found`

```json
{
  "objectId": "cup_red",
  "name": "红色水杯",
  "room": "客厅",
  "furniture": "茶几",
  "confidence": 0.91
}
```

- 触发目标卡片、记忆条目 `is-found`、语音播报。
- 卡片 9 秒自动收起；`task:start` 时立即收起。

### 2.15 `compare:update`

```json
{
  "memoryOn": { "steps": 4, "seconds": 5.6, "distance": 4.2 },
  "memoryOff": { "steps": 8, "seconds": 18.4, "distance": 11.8 },
  "note": "同布局、同指令、同初始位置，仅切换 memory_enabled。"
}
```

- 所有数值必须来自任务日志；HUD 不做美化。

### 2.16 `layout:change`

```json
{ "id": "B", "name": "布局 B" }
```

### 2.17 `offline:change`

```json
{ "enabled": true }
```

- 离线时 HUD 显示 OFFLINE 徽标；规划来源应同步为 `cache/rule/offline`。

### 2.18 `toast`

```json
{ "text": "记忆已清空", "type": "warn" }
```

- `type`: `"" | warn | error`
- 3.2 秒自动消失。

### 2.19 UI → 执行

#### `ui:query`

```json
{ "text": "帮我找红色水杯", "source": "text|voice|chip" }
```

#### `ui:voice`

```json
{ "text": "帮我找钥匙" }
```

- Chat 收到后添加用户气泡，并转发 `ui:query`；执行层只监听 `ui:query`。

#### `ui:focusObject`

```json
{ "objectId": "cup_red" }
```

#### `ui:director`

```json
{ "action": "script:moved" }
{ "action": "memory:toggle", "enabled": false }
```

- 动作：`script:first | script:memory | script:moved | script:correct | script:compare | script:layoutB | script:offline | scene:reset | clear | reset | memory:toggle`

#### `ui:foundAction`

```json
{ "action": "bring", "objectId": "cup_red" }
{ "action": "dismiss" }
```

#### `ui:compareClose`

```json
{}
```

#### `voice:speak`

```json
{ "text": "我记住了。" }
```

---

## 3. 事件顺序

### 3.1 正常任务

```text
plan:received
task:start
robot:state(thinking)
task:step(0, active)
task:step(0, done)
...
task:step(n, active)
task:step(n, done)
found
task:end
```

### 3.2 失败 / 过期

```text
task:step(verify, active)
task:step(verify, error)
robot:state(confused)
memory:update(stale)
task:step(scan, active/done) × 3
memory:update(fresh)
...
found
task:end
```

### 3.3 单飞锁

- `task:start` 到 `task:end` 之间，Chat 禁用输入；执行层拒绝新的 `ui:query`。
- 导演按钮不应绕过队列；需要打断时先 `task:reset`。

---

## 4. 适配团队 `core/bus.js`

HUD 只要求：

```js
bus.on(name, handler)   // 订阅
bus.emit(name, payload) // 派发
bus.off?.(name, handler) // 可选；没有 off 时 HUD.destroy 只清组件
```

如果团队 bus 使用 `subscribe/publish`，加一层适配：

```js
export const uiBus = {
  on: (n, f) => bus.subscribe(n, f),
  off: (n, f) => bus.unsubscribe?.(n, f),
  emit: (n, p) => bus.publish(n, p),
};
```

---

## 5. 禁止事项

- 不要在 UI 里直接调用机器人动作；只 emit `ui:query` / `ui:director`。
- 不要用 `setTimeout` 伪造 `task:step(done)`；步骤必须由真实动作完成触发。
- 不要把 `memory:update` 做成增量；HUD 需要全量做 diff。
- 不要在 `chat:message` 里发未经脱敏的模型原始输出（HTML 注入风险）；HUD 用 `textContent`。
- 不要在 `task:end` 之前解锁输入。
