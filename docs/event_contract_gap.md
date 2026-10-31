# HUD 与事件契约的差异清单

> 记录人：Jesu（代传 Gary 交付时逐条比对）
> 对照文件：`contracts/events.md`（18 个已声明事件，只读） ↔ `web/src/ui/*.js`（HUD 实际订阅与派发）
> 结论：**不是拼写笔误，是两套命名体系。合并代码不会报错，但 HUD 在真实链路上不会响应。**

## 1. 总览

| 维度 | 数量 | 说明 |
|---|---|---|
| 契约已声明 | 18 | `robot:*` 4、`task:*` 4、`plan:*` 4、`memory:*` 3、`ui:view` / `demo:*` 3 |
| HUD 实际订阅 | 21 | 其中命中契约 4 个，命中率 19% |
| HUD 订阅但契约没有 | 17 | 见第 3 节 |
| 契约有但 HUD 没听 | 14 | 含 `robot:state`、`task:say`、`memory:hit/miss` |
| HUD 派发（UI → 执行） | 8 | 命中契约 0 个 |

## 2. 四个"名字对上"的事件，载荷也对不上

| 事件 | 契约载荷 | HUD 实际读取 | 判断 |
|---|---|---|---|
| `task:start` | `{taskId, query, source}` | `{total, source, latencyMs, state}` | 字段交集只有 `source`；HUD 拿不到总步数，进度条会停在「准备中」 |
| `task:step` | `{taskId, index, action, target, ok, ms}` | `{total, index, action, label, targetLabel, status, sub, durationMs, state}` | `ok`(bool) ↔ `status`(active/done/error)、`ms` ↔ `durationMs`、`target` ↔ `targetLabel`；按契约发，时间线永远拿不到 `status`，会全部落到 else 分支 |
| `task:end` | `{taskId, ok, steps, durationMs, corrected}` | `{found, stepCount, durationMs}` | `ok` ↔ `found`、`steps` ↔ `stepCount`；按契约发，状态条显示「完成 · undefined 步」 |
| `plan:received` | `{source, steps, latencyMs}` | `{source, latencyMs}` | **唯一真正兼容的一个** |

## 3. HUD 订阅、契约里没有（17 个）

| 事件 | HUD 用途 | 建议归属 |
|---|---|---|
| `chat:message` | 对话气泡（`role: user/butler`） | 语义与契约 `task:say` 重复，二者选一 |
| `chat:typing` | 思考三点 | 需新增 |
| `chat:clear` | 清空对话 | 可用 `task:reset` 覆盖 |
| `found` | 目标卡片 + 语音播报 | 需新增（契约只有 `memory:hit`） |
| `memory:update` | 记忆面板**全量**刷新（HUD 靠 diff 做高亮） | 与契约 `memory:updated` 单条增量冲突，需裁决 |
| `memory:highlight` | 单条闪烁 1 秒 | 需新增 |
| `memory:toggle` | 记忆开关 | 契约无对应 |
| `plan:degraded` | 降级提示 + 来源切「规则」 | 与契约 `plan:rejected` 语义相近，需统一 |
| `layout:change` | 布局标签 | 契约无对应 |
| `offline:change` | OFFLINE 徽标 | 契约无对应 |
| `compare:update` | 对比卡片数据 | 契约无对应 |
| `comparison:hide` | 收起对比卡片 | 无冒号前缀，违反 `域:动作` 命名规则 |
| `task:reset` | 清空任务 UI | 契约 `demo:reset` 语义相近 |
| `toast` | 轻提示 | 无冒号前缀，违反命名规则 |
| `ui:director` | 导演动作 | 契约无对应 |
| `ui:voice` | 语音识别结果 | 契约无对应 |
| `voice:speak` | 指定文本播报 | 契约无对应 |

## 4. HUD 派发、契约里没有（8 个）

`ui:query`、`ui:voice`、`ui:focusObject`、`ui:director`、`ui:foundAction`、`ui:compareClose`、`chat:message`、`toast`

契约里 UI 只声明了 `ui:view` 一个出口。执行层若按契约只监听 `ui:view`，**用户在小觅对话框里打的字永远到不了规划器**。

## 5. 契约有、HUD 完全没听（14 个）

| 事件 | 谁在等它 | 不接的后果 |
|---|---|---|
| `robot:state` | 状态条 | 状态条只能靠 `task:step.state` 猜，机器人「困惑 / 纠正中 / 异常」三种状态上不了屏 |
| `task:say` | 对话区 | 机器人说的话没有通道上屏 |
| `memory:updated` / `:hit` / `:miss` | 记忆面板 | 复核命中与落空无法单条反馈 |
| `plan:rejected` | 状态条「降级中」 | 非法规划拦截时界面无感知 |
| `plan:corrected` | 对话区「已纠正」标记 | 纠错这条核心卖点在 UI 上没有痕迹 |
| `robot:blocked` | 状态条告警 | 被挡住时界面无提示 |
| `robot:holding` | 记忆面板 | 「手里拿着什么」显示不出来 |
| `plan:request` / `robot:moved` / `ui:view` / `demo:reset` / `demo:teleport` | 调试与视图 | 调试面板与视图切换接不上 |

## 6. 两条路，二选一（需 wei + Jesu 共同拍板）

**A. 扩契约**
把第 3、4 节的 25 个事件名补进 `contracts/events.md`，并统一命名（`comparison:hide`→`compare:hide`，`toast`→`ui:toast`）。
代价：契约从 18 涨到 43，评审面扩大；收益：HUD 与预览页零改动。
风险：契约膨胀后「事件即接口」的约束力下降。

**B. 改 HUD 适配现有 18 个事件**
映射：`task:say`→对话、`memory:updated/:hit/:miss`→记忆面板（改成增量合并）、`plan:rejected`→降级、`plan:corrected`→纠正标记、`robot:state`→状态条、`demo:reset`→`task:reset`、`ui:view`→视图切换。
代价：改 8 个 UI 文件 + 预览页假数据；收益：契约不膨胀，与 A 组（机器人/执行层）零摩擦。
风险：HUD 已有的空值兜底要重写一遍（`ok`/`status` 语义不同）。

**建议：B 为主 + A 的少量补充。** 理由：`task:step` 的 `ok/ms/target` 是执行层已经在用的口径（A 组代码已按契约写），改 HUD 只是适配层；而 `chat:*`、`found`、`toast` 这三个纯 UI 语义，契约里确实没有等价物，补进去成本最低、争议最小。最终由 wei 裁决。

## 7. 复现方式

```bash
python - <<'PY'
import re, pathlib
declared = set(re.findall(r"`([a-z]+:[a-z_]+)`", pathlib.Path("contracts/events.md").read_text(encoding="utf-8")))
text = "".join(p.read_text(encoding="utf-8") for p in pathlib.Path("web/src/ui").glob("*.js"))
subs = set(re.findall(r"on\(\s*[\"']([\w:]+)[\"']", text))
print("契约内:", sorted(subs & declared))
print("契约外:", sorted(subs - declared))
PY
```
