# 设计 A · 任务书（前端 3D 与执行层）

> **最新安排（本地待审、未上传、未合并生效）**：先读 [`../03-demo-coordination.md`](../03-demo-coordination.md)。沿用 **robot-find 母版**的界面、功能与交互；当前为 **local-demo，未接后端，场景与机器人素材待替换**，demo 尚未进入 main。本文旧里程碑、职责冲突以 03 为待合并提案准，合并后才生效；旧文保留作参考，不重建 Vite、旋转立方体或整套 HUD。A 的接续任务见 03 的 A-01/A-02，迁移期入口与 `web/src/robot-find/` 由 A 单写。

> **最新负责人 / 主责：jesu（Jesu，`Grip1122`）**：所有文件全局审核、GitHub 整体搭建/审核/维护安排、最终整合审核；前端设计搭建、交互/导航/动作代码及前端装配。**交付**：INT-01、A-01/A-02，沿用母版，接入 sen 场景与 Gary 设计素材；迁移版 world.js 单写。**验收**：各 owner 自验，jesu 统筹；jesu 自己的代码必须 wei 独立复核，不自审。机器人模型 Gary、空间语义 sen、动作代码 jesu、后端 wei。
> **下文第 0–8 节为历史技术参考，不是当前目录授权或任务清单**；旧“只改 core/robot/nav”“不得改 UI”“超载先砍整合”、旧日期及初始化立方体不再执行。当前仅本地文档调整，禁止提交与网络写入，403 未解除。

> **开工前必读**：先读完 [`../01-overview-v3.md`](../01-overview-v3.md) 与 [`../02-roles.md`](../02-roles.md)，再按本任务书领取步骤。项目全称「小觅HOME：虚拟孪生家庭具身空间物体定位（四人团队·AI 辅助开发）」，题目 HOME（"home me"，谐音 homie），机器人"小觅"；旧称"小方 / HomeTwin"同指。

> 自包含。把这一份整段给你的 Agent，不需要再附别的东西（要查契约原文时它会自己看仓库）。
> 全局方案见 `../01-overview-v3.md`，本文件已把与你相关的部分摘全。

## 0. 你负责什么（一句话）

浏览器里那台机器人怎么动：**场景能跑、机器人能动、路能走对、五个动作能执行、状态不乱**。你是关键路径的中心，其余三人的工作都在为你不被阻塞让路。

| 项 | 内容 |
| --- | --- |
| 代号 | 设计 A |
| 主责目录 | `web/src/core/`、`web/src/robot/`、`web/src/nav/` |
| 只通过契约对外提供 | 事件总线事件（`contracts/events.md`）、五个动作的 Promise 语义、状态机状态名 |
| 不得触碰 | `web/src/scene/`、`web/src/ui/`、`server/`、`contracts/` |
| 你的步骤 | 1.1（审核坐标）、1.2、1.3（行走部分）、2.1、2.2、3.2（来源标签）、3.3（前端客户端）、3.4（执行纠错步骤）、4.1（切换器）、4.3（表情与高亮）、6.1（现场操作） |
| 关键路径 | 是。**任何人不得给你增派额外任务** |

---

## 1. 你的 Agent 必须遵守的规则

1. **`contracts/` 只读。** 不得修改。认为契约有问题就停下来，只输出「契约问题说明」（哪一行、为什么、建议怎么改），不要写绕过的代码。
2. **只改 `web/src/core|robot|nav/`。** 需要场景数据找设计 B，需要界面样式找设计 C，需要接口找 AI-D，**不要代劳**。
3. **每个模块至少三条测试**：正常 / 边界 / 异常。异步必须测「中途取消」「并发调用两次」；状态机必须测「非法转移」。
4. **不得为了跑通放宽 Schema、删断言、改测试预期。**
5. **不得新增依赖**（three / pathfinding / tween.js / lil-gui 已定），要加先说明理由。

**判定"做完了"的硬标准**：测试能变红。交付时附「我改坏了哪一行 → 哪个测试变红 → 终端输出」。

---

## 2. 环境与开场（30 分钟，M0 前完成）

```bash
git clone git@github.com:Grip1122/hometwin.git && cd hometwin
git config core.hooksPath .githooks        # 必做，否则守门只在 CI 生效，反馈慢一轮

cd web && npm create vite@latest . -- --template vanilla
npm i three pathfinding tween.js lil-gui
npm i -D vitest
```

`vite.config.js` 里把 `/api` 代理到 `http://127.0.0.1:8000`（避免跨域）。环境变量写 `.env.example`（模型 key、接口地址、模型名），**真实 key 不进仓库**。

**验收**：前端能起，显示一个旋转立方体；`npm test` 能跑。

---

## 3. 你必须先看懂的四段契约

### 3.1 五个动作的语义与后置条件

| 动作 | 参数 | 前端行为 | 后置条件 |
| --- | --- | --- | --- |
| find | target | 有可信记忆则走到记忆位置并观察；没有或观察落空则按分区扫描直到发现 | 机器人站在目标旁 |
| go | target（家具 / 物体 / 分区） | 寻路走到目标的可达邻格；目标是分区时走到扫描点 | 机器人到达 |
| grab | target | 水平距离小于 1 米即判定可抓；播放 Punch 前半段快速过渡，物体挂到携带锚点并缩到 0.4 倍 | holding = target |
| drop | target、to | 先 go 到 to，再播放放置动画，物体挂回家具并落到台面高度，缩放恢复 | holding = null |
| observe | room（可选） | 原地环顾，返回可见物体列表并写入记忆 | 记忆更新 |

### 3.2 状态机（转移表，不是条件分支）

| 状态 | 进入条件 | 动画与表现 | 可转移到 |
| --- | --- | --- | --- |
| idle | 初始或任务完成 | Idle | thinking |
| thinking | 收到指令、等待 /plan | Idle 加头顶思考气泡 | walking、confused |
| walking | 执行 go 或 find 的移动段 | Walking | scanning、picking、placing、idle |
| scanning | 执行 observe | Idle 加原地转身 | walking、confused、idle |
| picking | 执行 grab | Punch 前半段，总时长不超过 0.5 秒；物体缩到 0.4 倍；无发光 | walking、idle |
| placing | 执行 drop | Punch 反向或 Wave，同样不超过 0.5 秒；缩放恢复为 1 | idle |
| confused | 记忆落空、规划失败、澄清 | Sad 表情加 No 动作 | scanning、idle |
| celebrating | 任务完成 | ThumbsUp | idle |

**三条必须写成代码的规则**：外部请求只能入队、不能直接改状态；每帧只处理队首任务；状态切换统一做动画淡入淡出 0.25 秒。

> AI 生成的状态机最常见的两种病：**某个状态没有出边导致死锁**、**出边条件互斥导致永远进不去**。这两条只有测试能抓出来。

### 3.3 事件契约（你负责派发这些，设计 C 负责订阅）

命名 `域:动作`，全小写，过去式=已发生。**你至少要派发**：

| 事件 | 载荷 | 时机 |
| --- | --- | --- |
| `robot:state` | `{from, to, step, taskId}` | 每次状态转移 |
| `robot:moved` | `{pos:[x,y,z], yaw}` | 每帧节流 10 Hz |
| `robot:blocked` | `{reason, at:[x,y,z]}` | 寻路失败，或到达但够不着 |
| `robot:holding` | `{objectId\|null}` | 抓取或放置成功 |
| `task:start` / `task:step` / `task:end` | 见契约 | 入队 / 每步结束 / 任务终止 |
| `task:say` | `{text, who:"robot"\|"user"}` | 需要上屏的话 |
| `plan:request` / `plan:received` / `plan:rejected` / `plan:corrected` | 见契约 | 规划相关 |

**四条约束**：只描述"发生了什么"不描述"该做什么"；载荷必须可 JSON 序列化（不得传 three.js 对象或函数）；高频事件必须节流；一次性事件不得节流。

### 3.4 挂载写法（这条会决定你演示当天是否穿帮）

```js
// 正确：attach() 重算局部变换，世界位置不变
carryAnchor.attach(objectMesh)

// 错误：add() 不改局部变换，物体会瞬移到锚点局部坐标
carryAnchor.add(objectMesh)          // ← 审核一票否决项

// 放置同理，把"贴台面"单独写成一步，便于测试
furnitureGroup.attach(objectMesh)
objectMesh.position.y = furnitureTopY
objectMesh.scale.setScalar(1)
```

---

## 4. 按步骤干活（每个步骤 = 一次 PR）

### 步骤 1.2 机器人加载与状态机（2.5 h，关键路径）

**做**：
1. 加载 RobotExpressive，**先打印模型的动画名称列表**核对，按实际名称建映射表，不要硬编码。
2. 表情用模型自带形变目标（愤怒 / 惊讶 / 悲伤三个）。
3. 实现状态机：转移表 + 非法转移抛错并记录。
4. 实现 50 行以内的事件总线，派发时追加到内存日志（供回放）。
5. 任务队列：串行、单飞锁（执行中禁止再入队）。

**验收**：调试面板按行走 / 抓取 / 困惑 / 庆祝四键，动画正确且过渡平滑；**连点十次不抖动**。

**必须有的测试**：非法转移抛错；连点 10 次只执行第一次；动画中途抛错后锁仍被释放（`finally`）。

> 风险：动画名称与预期不符 → 先打印列表。依赖：0.1。

### 步骤 1.3 寻路与行走（2 h，与 AI-D 分工）

**你负责**：行走插值、转身、路径虚线。**AI-D 负责**：网格与 A* 纯函数。
1. 沿路径分段补间，**每段开始先转身再前进**，到达后切回空闲；返回 Promise。
2. 速度 1.2 米/秒，朝向用四元数球面插值。
3. 地面点击调试：点地板任意位置走过去，虚线画路径。

**验收**：点客厅/卧室/书房任意可达点，不穿墙不穿家具地走到；点家具内部时走到最近可达邻格。

> 风险：网格太粗导致门洞被堵（门洞 ≥1 米、格 0.5 米、外扩 0.25 米，三者联动校核）；路径锯齿 → 必须平滑。

### 步骤 2.1 五个动作执行器（2 h，关键路径，本步骤最重要）

按第 3.1 节的动作表实现，每个动作返回 Promise，执行前后各派发一次事件。**抓取与放置严格按视觉规则**：

1. **观察**：原地转身 360° 约 1.5 秒，取该分区所有物体，简化视锥判断可见性，返回列表并派发事件。
2. **前往**：解析目标世界坐标 → 最近可通行格 → 调用行走。
3. **抓取**：**判定只看水平距离 < 1.0 米**（不含高度差）；不满足先 `go(target)` 再判一次，仍不满足返回 `{ok:false, reason:"too_far"}`；播放 Punch 前半段（≤0.5 秒）；`attach()` 挂到携带锚点并缩到 **0.4 倍**；**不加任何发光/描边/粒子**；单飞锁必须在 `finally` 中释放。
4. **放置**：先前往目标家具，`attach()` 挂回家具，贴台面高度，缩放恢复 1。
5. **查找**：见步骤 2.2。

**五条必须有的测试**（直接进任务卡）：
- 距离 0.9 米抓取成功
- 距离 1.1 米返回 `too_far` 且**物体不动**
- 挂载前后物体世界坐标差 **< 1e-6**
- 抓取中途再次调用被拒绝，**不产生第二次挂载**
- 动画中途抛错后**锁仍被释放**

**验收**：控制台执行一段"抓取+放置"步骤数组，机器人自动完成；录屏逐帧看不到手进入家具。

### 步骤 2.2 全屋扫描与查找策略（1 h，关键路径）

```
find(target):
  mem = memory.get(target)
  if memory_enabled and mem and mem.confidence >= 0.3:
      go(mem.pos); seen = observe(mem.room)
      if target in seen: memory.hit(target); return OK
      memory.miss(target); emit('robot:confused'); play Sad 1.2s
  order = 当前分区优先，其余按到扫描点距离升序
  for room in order:
      go(room.scan_point); seen = observe(room); memory.upsert(seen)
      if target in seen: go(target); return OK
  return NOT_FOUND
```

**验收**：记忆关闭时找水杯走完三个分区；记忆开启时直达；手动拖走后先扑空、困惑、再找到。
> 观察转身时长做成参数（演示可调 0.8 秒），否则扫描会拖慢路演。

### 步骤 3.2 前端部分：来源标签与降级提示（0.5 h，与 AI-D 对接）

规划响应里的 `source` 必须显示出来：`cache` 缓存 / `llm` 在线 / `rule` 规则 / `corrective` 纠错 / `script` 脚本。**路演时这一行是给评委看"没调模型"的证据**，尤其纠错必须显示"规则"。

### 步骤 3.3 前端部分：记忆客户端与拖拽（1 h）

1. 每次动作完成后调用对应记忆接口，派发 `memory:updated` 驱动面板刷新。
2. 拖拽物体时吸附到家具表面；**拖拽用 `attach()` 语义，别让物体瞬移**。
3. 任务开始前全量拉取一次记忆（后端为唯一真值）。

### 步骤 3.4 执行纠错步骤（0.5 h，关键路径）

后端返回 `source=corrective` 时，你的执行器**什么特殊逻辑都不要加**——照常执行 `steps` 数组即可，`say` 已经在里面（含道歉）。你只需要：
- 派发 `plan:corrected`（供 HUD 显示"纠错"标签）
- 状态机走 `confused`（1.2 秒）→ `walking` 的自然过渡

> 两套模板（手里有物体 / 已放下）都在后端，前端不判断。

### 步骤 4.1 切换器（1 h）与 4.3 表情高亮（0.75 h）

**4.1**：清空场景 → 加载新布局 → 重建网格 → 记忆切到该布局。**切换前遍历旧场景显式释放几何体、材质与贴图**（否则掉帧）。
**4.3**：表情映射（思考轻微惊讶 / 困惑悲伤到最大 / 完成 ThumbsUp 归零）；目标物高亮**只在"找到了"那一刻**脉冲两次，与抓取动画时间上错开、不叠加。

### 步骤 6.1 彩排现场（2.5 h）

你负责现场操作与故障处置。**10:00 后不改代码**，问题用导演模式绕开。

---

## 5. 每个 PR 的标准动作

```bash
git switch -c feat/2-1-grab-action
# 干活…
git add -A
git commit -m "feat(robot): 2.1 抓取改为水平距离判定并使用 attach 挂载" \
           -m "Authored-by: ai+human
Step: 2.1"
git push -u origin feat/2-1-grab-action
gh pr create --fill --base main
```

**提交信息首行必须是** `type(scope): 摘要`，`type` ∈ `feat/fix/test/docs/contract/chore/refactor/perf`，`scope` ∈ `robot/nav/scene/ui/server/rules/layout/ci`。**正文末尾必须有 `Authored-by: ai | human | ai+human` 与 `Step: N.N`**——钩子会拦。

PR 模板里四块必须填：步骤编号 / 三关自检 / **变红证据**（终端输出）/ 影响面。

**一人同时只能有一个未合并分支。**分支活过 4 小时视为风险：拆小合并或废弃。

---

## 6. 会被直接打回的红线

1. 用了 `.add(objectMesh)` 形式的挂载（必瞬移）
2. 状态机存在无法退出的状态
3. 改了逻辑却零测试，或变红证据是假的
4. 越界改 `scene/`、`ui/`、`server/`、`contracts/` 且未打招呼
5. 硬编码相机角度 / 缩放倍数 / 距离阈值（必须只有 `core/config.js` 一处定义）
6. 静态兜底：空 `catch`、裸 `except`、`??` 默认值掩盖错误
7. 用 `sleep(1000)` 断言异步（负载一高就假红）→ 改断言"等待条件"

---

## 7. 你最容易踩的坑（按概率排序）

| 坑 | 怎么发现 | 怎么防 |
| --- | --- | --- |
| 异步竞态 | `await` 前后用同一个变量 | `await` 后重新读，或加版本号校验 |
| 假单飞锁 | 没在 `finally` 释放 | 必须测"中途抛错后锁仍释放" |
| 边界嗅探 | 裸索引 `[0]`、`parseInt` 不判 `NaN` | 补空值与格式异常用例 |
| 抓取穿模 | 只靠网格外扩 | 水平距离判定 + 锁死视角 + 0.4 倍 + 无发光 |
| 相机被转 | 只设了默认角度 | `enableRotate=false` 且 `minPolarAngle == maxPolarAngle` |
| 内存泄漏掉帧 | 切布局后不释放 | 显式 dispose 几何体/材质/贴图 |

---

## 8. 你的第一件事（今天 23:00 前）

1. 跑通环境，起一个旋转立方体 → 发一条 `chore(ci): 1.0 前端脚手架初始化` 的 PR。
2. 用 `docs/ai-prompt-template.md` 的"示例 1：寻路网格"，把 1.3 的网格纯函数交给 Agent（这活其实是 AI-D 的，你先看它的输出契约）。
3. 2.1 的动作执行器先写 `grab` 一个动作 + 五条测试，跑通再写其余四个——**不要一次性让 AI 写五个**。
