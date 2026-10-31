# AI-D · 任务书（后端与算法）

> **负责人：wei**（`krlozhilderman287-creator`）。你同时是把关人：**自审回避**——你写的 PR 由 Jesu 批，不得自批；契约 PR 需你与 Jesu 两人都批。

> **开工前必读**：先读完 [`../01-overview-v3.md`](../01-overview-v3.md) 与 [`../02-roles.md`](../02-roles.md)，再按本任务书领取步骤。项目全称「小觅HOME：虚拟孪生家庭具身空间物体定位（四人团队·AI 辅助开发）」，题目 HOME（"home me"，谐音 homie），机器人"小觅"；旧称"小方 / HomeTwin"同指。

> 自包含。把这一份整段给你的 Agent。
> 全局方案见 `../01-overview-v3.md`。

## 0. 你负责什么（一句话）

**小觅的后端算法、接口与门禁。**** 规划、校验、纠错规则、空间记忆、日志，外加仓库的 CI 与守门脚本。

| 项 | 内容 |
| --- | --- |
| 代号 | AI-D |
| 主责目录 | `server/`、`scripts/`、`tests/`、`.github/` |
| 只通过契约对外提供 | `POST /plan` 响应、`/memory` 读写、纠错规则、布局校验脚本 |
| 不得触碰 | `web/`、`contracts/` |
| 你的步骤 | 0.1（环境与 CI）、0.2（核对接口契约）、0.4（纠错规则落地）、1.3（后端参照与接口对账，前端寻路由 A 负责）、1.4、2.2（后端记忆接口，前端同步由 A 负责）、3.1、3.2、3.3、3.4、4.1（记忆分区）、4.2、5.2（巡检规划）、6.1（后端值守）、6.2 |
| 特别说明 | **你的起点比其他人高**：规划、校验、纠错、记忆纯函数、70 条测试、12 个变异都已实现并全绿。你的重点是**接上 HTTP 与 SQLite**，不是重写 |

---

## 1. 你的 Agent 必须遵守的规则

1. **`contracts/` 只读。** 不得修改。认为契约有问题就停下，只输出「契约问题说明」（哪一行、为什么、建议怎么改）。
2. **只改自己四个目录。** `web/` 是别人的。
3. **每个模块至少三条测试**：正常 / 边界 / 异常。异步必须测「中途取消」「并发调用两次」。
4. **新增核心逻辑必须同步登记一条变异**（`scripts/mutation_demo.py`）。没有变异 = 没人证明你的测试能变红。
5. **不得为了跑通放宽 Schema、删断言、改测试预期。**
6. **不得新增依赖**（`requirements.txt` 现有：fastapi / uvicorn / pydantic / openai / jsonschema / pytest）。
7. **变异脚本自己也要能失败**：`pytest` 退出码 2 一律 `INVALID`，**只用单行锚点**（见第 6 节的真实教训）。

---

## 2. 环境与开场（20 分钟）

```bash
git clone git@github.com:Grip1122/hometwin.git && cd hometwin
python -m venv .venv && .venv/Scripts/activate     # Windows
pip install -r server/requirements.txt
git config core.hooksPath .githooks                # 必做
python -m pytest -q                                # 应该 70 条全绿
python scripts/check_layout.py                     # 应该零错误
python scripts/check_contracts.py                  # 应该通过
python scripts/mutation_demo.py                    # 应该 12/12 被抓住
```

**四条命令任一不通过，先别写新代码，告诉把关人。**

---

## 3. 仓库里已经有什么（别重写）

| 文件 | 内容 | 状态 |
| --- | --- | --- |
| `server/app/layoutlib.py` | 网格、门洞、可达性、地点与物体词典；`ROBOT_RADIUS=0.25`、`GRAB_RADIUS=1.0` | ✅ 完成 |
| `server/app/validate.py` | `validate_steps(index, steps, holding)` 语义校验 | ✅ 完成 |
| `server/app/rules.py` | `try_correct(query, index, last_object, holding)` 纠错强规则 | ✅ 完成 |
| `server/app/planner.py` | `plan_offline(query, index, ctx, cache)`：纠错 → 缓存 → 澄清，出口再校验 | ✅ 完成 |
| `server/app/memory.py` | 置信度六条纯函数 | ✅ 完成 |
| `server/app/cache.json` | 五句固化台词 | ✅ 完成 |
| `scripts/check_layout.py` | 布局八项检查 | ✅ 完成 |
| `scripts/check_contracts.py` | 契约闸门 | ✅ 完成 |
| `scripts/mutation_demo.py` | 12 处变异验证 | ✅ 完成 |
| **HTTP 服务 `server/main.py`** | FastAPI：`/plan` `/memory` `/log` | ❌ **你的活** |
| **SQLite 存储** | 建表、读写 | ❌ **你的活** |
| **GLM 在线规划** | 调模型 + 降级 | ❌ **你的活**（步骤 3.1） |
| **前端寻路与行走** | `web/src/nav/` 网格、A*、路径平滑、测试与执行表现 | **设计 A 负责**；D 只提供后端算法参照与接口数据 |

---

## 4. 你必须先看懂的四段契约

### 4.1 `/plan` 请求与响应

```jsonc
// 请求
{
  "query": "不对，应该放书房",
  "layout_id": "A",
  "memory": [ { "object_id": "cup_red", "room": "living",
                "pos": [-3.0, 0.75, 2.85], "confidence": 0.85 } ],
  "memory_enabled": true,
  "last_object": "cup_red",              // 上一任务操作的物体
  "robot": { "pos": [0, 0, 0], "holding": null }
}
// 响应
{
  "say": "抱歉，我记错了。这就把红色水杯放到书桌。",
  "steps": [
    { "action": "go",   "target": "cup_red" },
    { "action": "grab", "target": "cup_red" },
    { "action": "go",   "target": "desk" },
    { "action": "drop", "target": "cup_red", "to": "desk" }
  ],
  "source": "corrective",                // 永不来自大模型
  "corrected": true,
  "corrected_object": "cup_red",
  "corrected_to": "desk",
  "latency_ms": 2
}
```

- 请求必填：`query`、`layout_id`。响应必填：`say`、`steps`、`source`。
- `source` 枚举：`cache` / `llm` / `rule` / `corrective` / `script`。
- **字段只增不删**：新字段必须可选、不重命名、枚举只加值。

### 4.2 规划流水线（五档，这是你的核心设计）

```
0 纠错判断（前置，永不跳过）
    is_correction(query) 为真 → 走强规则，source=corrective，直接返回
    命中后不进缓存、不进模型；本地耗时 < 5 ms
1 缓存命中
    key = normalize(query)，【不含】记忆快照与 layout 摘要
    五句核心台词固化在 server/app/cache.json
2 在线规划（可选，可关闭）
    GLM，system 含动作定义 + 别名表 + 家具表 + 3 示例；只输出 JSON；超时 2.5 秒
3 结构校验 + 语义校验
    JSON Schema 管字段与枚举；语义管 target/to 存在、drop 前必须 grab、to 必须 surface
4 规则解析（source=rule）
    正则匹配 "找|拿|把 X 放到 Y" 等句式，X/Y 用别名表模糊匹配
5 仍失败 → say="我没听懂，可以换个说法吗？"，steps=[]，播放 confused
```

**出口再校验**：任何来源（缓存、模型、规则、脚本）的 steps，返回前都要过一遍 `validate_steps`。这是最后一道闸，防有人往 `cache.json` 塞非法步骤。

### 4.3 纠错强规则（已实现，你要理解而不是重写）

| 步 | 动作 | 规则 |
| --- | --- | --- |
| 1 | 判定是否纠错 | **硬否定词**（不对 / 不是 / 错了 / 放错 / 别放 / 不要放 / 不应该）出现即判纠错；**软改写词**（应该 / 挪到 / 移到 / 搬到 / 改放）只在"无祈使包装且 ≤10 字"时才算 |
| 2 | 抽取新地点 | 地点词典（分区名+别名+家具名+别名），取最后一个**未被否定**的地点 |
| 3 | 抽取物体 | **先用地点字符区间做遮罩**再匹配物体（"书房"里的"书"不能被当成蓝色书）；句中无物体用 `last_object` |
| 4 | 解析落点 | 地点是分区取 `drop_to`；是家具必须 `surface=true`，否则回"沙发上放不了东西" |
| 5 | 下发固定步骤 | **手里拿着该物体**：`go(新地点)+drop`；**已放下**：`go(物体)+grab+go(新地点)+drop`。同时调记忆纠正（旧位置 −0.30，新位置 0.90） |

**为什么第二套模板必须有**：演示里纠正发生在"已放到茶几上"之后，手里是空的。直接 `go+drop` 会被语义校验拦住（drop 前必须 grab），现场表现为"说了抱歉但什么都没发生"。

**失败时就问，不猜**：只说"不对"没说地点 / 说的是沙发等不可放置家具 / 没物体且没 `last_object` → 一律澄清，话术固定三句，写死在代码里，不调模型。

### 4.4 记忆置信度（六条纯函数，已实现）

| 事件 | 公式 | 函数 |
| --- | --- | --- |
| 观察首次看到 | c = 0.80 | `on_observe_first()` |
| 到达记忆位置且看到 | c = min(1.0, c + 0.05) | `on_hit(c)` |
| 到达但没看到 | c = c − 0.40，status=stale | `on_miss(c)` / `status_after_miss(c)` |
| 扫描在新位置看到 | c = 0.80，fresh | `on_rescan_found()` |
| 用户纠正 | 旧位置 c − 0.30；新位置 c = 0.90 | `on_correct_old(c)` / `on_correct_new()` |
| 读取时 | c < 0.30 视为无记忆 | `usable(c)` |

SQLite 表（建表脚本随服务启动自动执行）：

```sql
CREATE TABLE spatial_memory (
  layout_id TEXT NOT NULL, object_id TEXT NOT NULL, room TEXT NOT NULL,
  pos_x REAL, pos_y REAL, pos_z REAL,
  confidence REAL NOT NULL DEFAULT 0.8,
  source TEXT NOT NULL,                      -- observe / correct / seed / rescan
  status TEXT NOT NULL DEFAULT 'fresh',      -- fresh / stale
  updated_at TEXT NOT NULL,
  PRIMARY KEY (layout_id, object_id)
);
CREATE TABLE task_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  layout_id TEXT, query TEXT, plan_json TEXT, source TEXT,
  steps_json TEXT, step_count INTEGER, duration_ms INTEGER,
  corrected INTEGER DEFAULT 0, memory_enabled INTEGER, created_at TEXT
);
```

---

## 5. 按步骤干活

### 步骤 1.4 后端骨架：接 HTTP 与 SQLite（1 h，你的第一个活）

1. **`POST /plan`**：把 `planner.plan_offline` 包起来，按 `plan.schema.json` 校验请求与响应（校验失败返回 422，不是 500）。
2. **`/memory`**：读写 SQLite；调用 `memory.py` 的纯函数，**不要在 SQL 里重写公式**。
3. **`/log`**：落任务日志，`corrected` 取自响应。
4. 测试覆盖三个接口的正常与异常请求。
5. **在 `mutation_demo.py` 登记至少两条接口层变异**（例如：把"落空 −0.40"在接口层写成 −0.30；把响应的 `source` 写死成 `cache`）。

**验收**：接口文档页（`/docs`）可调通三个接口；`pytest` 全绿；变异验证全部被抓住。

> 因为规划与规则已有实现，这步比原计划少半小时。风险较低。

### 步骤 1.3 后端参照与接口对账（配合设计 A）

**D 负责**：维护 `server/app/layoutlib.py` 的布局校验、坐标换算、阻挡格/门洞/可达性参照，以及 `scripts/` 的数据导出和 `tests/` 中的后端回归。向 A 提供可复现的输入、期望结果与边界说明。

**设计 A 负责**：`web/src/nav/` 的网格、A*、最近可达邻格、禁止穿角、路径平滑及其 JS 测试，以及行走插值、转身和路径虚线。D 不实现、不修改这些前端文件，也不修改 Node 配置或 `web/README.md`。

对齐通过接口/导出数据协作完成：前端导航与后端参照规则不一致时，D 提供失败用例和期望值，由 A 修前端；D 不代写 `web/`。现有 `scripts/gen_nav_fixture.py` 的导出器由 D 维护；需要把结果写进 `web/src/nav/__fixtures__/` 时，由 A 执行并在 A 的 PR 中提交派生文件。

后端对账覆盖门洞内外连通、家具外扩半径、坐标边界、起终点相同和目标在家具内部；前端实现与行走验收详见 [设计 A 任务书](task-A-frontend-3d.md)。这些协作不构成跨目录修改豁免。

### 步骤 3.1 接入 GLM（2 h，关键路径）

1. 兼容 SDK 指向智谱接口，**温度 0.1**；能开 JSON 输出模式就开，否则提示词强约束。
2. 系统提示词四段：角色 / 动作定义表 / 当前布局物体与家具（含别名）/ 三个少样本（找物、搬运、纠正）。
3. 用户消息带记忆快照与机器人状态，**总长 ≤ 1500 token**。
4. 记录每次调用的延迟、token 用量、是否命中缓存。

```
系统提示词骨架
你是家庭管家机器人"小方"的任务规划器。只输出 JSON，不输出任何解释。
可用动作：find(target) / go(target) / grab(target) / drop(target, to) / observe(room)。
规则：1) target 与 to 只能取自下方清单的 id；
      2) drop 前必须先 grab；一次只能拿一件物品；
      3) 不确定用户指代时，选择别名最匹配的物体；
      4) say 字段用口语化中文，不超过 20 字。
物体清单：{objects}   家具清单（surface 为真者可放置）：{furniture}
示例：{few_shots}      输出格式：{"say": "...", "steps": [...]}
```

**验收**：二十句测试指令（口语化 / 带错别字 / 指代模糊三类）规划正确率 ≥ 85%，P90 延迟 < 3 秒。指令由设计 C 提供。
**风险**：额度/限流 → 注册两个账号 key 轮换。

### 步骤 3.2 校验、降级与固化缓存（1.5 h，关键路径）

1. 结构校验：pydantic 对应 Schema。
2. 语义校验 + **出口再校验**（已有，接到 HTTP 层）。
3. 规则解析器：六个句式正则 + 别名模糊匹配（编辑距离与包含关系两级）。
4. **固化缓存**：彩排后把五句核心台词写入 `cache.json`，键为标准化 query（去标点、去唤醒词、小写），**不含记忆快照**。上线前必须用 `validate_steps` 逐条自检。
5. 可选：切换到本地 Ollama，接口不变。

**验收**：**拔掉网线后五句台词全部由缓存正确处理**；人为注入十种非法模型输出（缺字段 / 目标不存在 / 先放后拿…）全部被拦截并降级；有一条**"缓存被投毒"**用例证明出口校验能兜住。

> 风险：布局改了物体 id，缓存里 id 就悬空。测试里已有"每条缓存都必须过语义校验"，布局一改会立刻变红。

### 步骤 3.3 空间记忆服务（2 h，与设计 A 并行）

1. 后端六个接口：批量观察、命中、落空、纠正、重置、按布局查询。
2. 置信度函数是纯函数（已实现），六条规则各配一条测试（已实现）。
3. 重置接口支持写入"上周的记忆"种子，用于演示"物体已被移动"。

**验收**：拖走水杯后找水杯，面板旧条目置信度从 **0.85 降到 0.45 并标黄**；扫描后新位置 **0.80 标绿**。
**风险**：前后端记忆不一致 → **后端为唯一真值**，前端每次任务开始前全量拉取。

### 步骤 3.4 纠正接口与日志（0.5 h）

1. 命中纠错后调用记忆纠正接口（旧 −0.30、新 0.90）。
2. 任务日志每次一行：来源、步骤数、耗时、是否被纠正。
3. **纠错逻辑已实现并有 31 条测试**；你只需要把它接到 HTTP 与记忆表。

### 步骤 4.1 / 4.2 记忆分区与对比实验（1.5 h + 1.5 h）

**4.1**：后端记忆按 `layout_id` 分区，切换布局时面板只显示当前布局的条目。
**4.2**：实验编排——重置位置 → 关记忆 → 执行 → 记录；开记忆 → 重置 → 再执行 → 记录。**数据全部来自任务日志**。每次执行前机器人复位到同一出生点（否则对比不公平）。可加"多轮学习曲线"（连续五次随机移动一件物体再找）。导出 CSV。

### 步骤 5.2 巡检规划（0.5 h，可选）

"小方，巡检一下" → 依次走各分区扫描点并观察。**已在缓存里有固化台词**，规则即可。

### 步骤 6.1 / 6.2 值守与交付（2.5 h + 1 h）

- 彩排时后端值守，负责**断网切换**（验证 cache → rule → script 三档不返回空步骤）。
- 交付：前端构建静态产物；后端与静态文件**同一进程托管**，一条命令启动；提交包含源码、构建产物、一键启动说明、视频、路演稿、架构图。
- **10:30 前提交**，留 30 分钟处理上传失败。

---

## 6. 变异验证（你的主场，也是最容易自欺欺人的地方）

### 6.1 它是什么

对一处关键逻辑故意破坏 → 跑 pytest → **必须有测试变红** → 还原。证明"测试真能抓错"。

```bash
python scripts/mutation_demo.py              # 全部
python scripts/mutation_demo.py -k rules     # 名字含 rules 的
```

### 6.2 判定结果

| 结果 | 含义 |
| --- | --- |
| `KILLED` | 至少一个测试失败，且期望的那个在列表里 ✅ |
| `KILLED_OTHER` | 有测试失败但不是期望那个 ⚠️ 覆盖点变了，要检查 |
| `MISS` | 改坏后仍全绿 ❌ **测试无效** |
| `INVALID` | pytest 因语法/收集中断（exit 2）——这是**变异写坏了**，不是测试抓住 |
| `SKIP` | 锚点不唯一，无法安全施加 |

### 6.3 三个真实教训（都已发生，都已修）

1. **多行锚点写成字面量 `\n`** → 语法错误 → pytest exit 2 → 被误判"抓住了"。一个能自洽出绿灯的**假证据**。现在 exit 2 一律 `INVALID`，**只用单行锚点**。
2. **"有错误"不等于"抓对了错误"**。布局检查器第一版测试只断言"报了错"；把"够不着"整段关掉测试仍全绿（别的检查也在报错）。已改为**断言具体错误类别**。
3. **CI 同秒还原读到变异版 `.pyc`**。变异 `0.40→0.30` 前后文件大小相同，CI 上变异与还原落在同一整秒，`.pyc` 以「mtime(秒)+大小」判有效，还原后仍加载变异字节码。**修复**：每次运行前清 `__pycache__` 并加 `-B`。本机因每次跑都跨秒而从未暴露——**本机绿不代表 CI 绿**。

> 一个能"证明测试有效"的工具，**本身也要能失败**。这是你整个角色的方法论。

---

## 7. 每个 PR 的标准动作

```bash
git switch -c feat/1-4-http-sqlite
# 干活…
python -m pytest -q && python scripts/mutation_demo.py && python scripts/check_contracts.py --base origin/main
git commit -m "feat(server): 1.4 接入 HTTP 与 SQLite" -m "Authored-by: ai+human
Step: 1.4"
git push -u origin feat/1-4-http-sqlite
gh pr create --fill --base main
```

**CI 四个 job**（`needs` 链：契约闸门 → 后端测试 → 变异验证 → 前端测试）全绿才能合。**CI 红了不要找人看，先按日志自己修。**

---

## 8. 会被直接打回的红线

1. 改了 `contracts/`（哪怕只是"顺手"）
2. 改了逻辑却零测试，或变红证据是假的
3. 新增核心逻辑没登记变异
4. 变异脚本用了多行锚点
5. 越界改 `web/`
6. `try/except: pass` 掩盖错误且无日志
7. 把密钥、绝对路径、演示台词硬编码
8. 擅自放宽 Schema 让代码通过
9. 接口层重写置信度公式（必须调 `memory.py`）

---

## 9. 你最容易踩的坑

| 坑 | 怎么防 |
| --- | --- |
| 纠错句进了缓存/模型 | 纠错必须是第 0 档，先于缓存判断 |
| 缓存键含记忆快照 | 键只用标准化 query，否则"彩排好好的现场不灵" |
| "书房"里的"书"被当成蓝色书 | 先用地点区间遮罩再匹配物体 |
| "帮我把书搬到卧室"被判纠错 | 软词只在"无祈使包装且 ≤10 字"时才算 |
| 模型输出非法步骤 | 出口再校验，不信任任何来源 |
| git 经代理推送偶发 502 | 先直连，失败再换代理端口；**代理端口会漂移，不得写死** |
| 本机绿 CI 红 | 同秒还原/pyc 缓存这类问题只在 CI 暴露，必须看 CI |

---

## 10. 你的第一件事

1. 跑第 2 节五条命令，确认 70 条测试 / 12 个变异全绿。
2. 读 `server/app/rules.py` 和 `tests/test_rules_correction.py`，**弄懂为什么软词要限 10 字**。
3. 写 `server/main.py` 的 `/plan` 一个接口 + 三条测试 + 两条变异，发 PR。**不要一次性写三个接口**。
