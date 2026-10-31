# HOME / 小觅 HTTP 与 SQLite

Python 3.11+，从仓库根目录启动。Windows PowerShell：

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r server/requirements.txt
.\.venv\Scripts\python.exe scripts/run_home.py --port 8000 --database .local/home.db
```

Linux / macOS：

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r server/requirements.txt
.venv/bin/python scripts/run_home.py --port 8000 --database .local/home.db
```

打开 http://127.0.0.1:8000/docs。正式前端 `web/dist` 存在时托管它，否则跳转接口文档。HTTP 服务不需要机器人、MuJoCo 或高斯场景，不附带资源预览。

`/plan` 请求/响应遵守冻结 `contracts/plan.schema.json`。`/memory` 查询和 `/memory/{observe,hit,miss,correct,reset}` 写入使用现有置信度公式与 SQLite 事务；`/api` 前缀提供相同接口。运行布局来自 `web/public/layouts/*.json` 内容中的 layout_id；可通过 HOMETWIN_LAYOUT_DIR/HOMETWIN_DB/HOMETWIN_WEB_DIST 配置。

## /log 的传输约定（提请 A / Jesu 审核；不修改冻结契约）

POST 必须带 layout_id、query（非空，最多 200 字）、plan（完整冻结 plan 响应）、steps（实际执行记录）、duration_ms（有限非负数，毫秒）、memory_enabled（布尔）。可选 robot 是**执行前**机器人快照，复用冻结 plan 请求的 robot 对象结构：pos 是三个有限数，holding 为本 layout 的物体 id 或 null；数组、字符串、数值、布尔、null 或额外字段返回 422。省略 robot 等于空手上下文，已持物计划需显式传入 holding。不能传执行后的 holding 来验证执行前的计划。

- `plan.steps` 是规划的完整指令序列，最多 8 步；响应结构与动作顺序均验证。
- `steps` 是客户端报告的**已结束执行记录**，每项是对应计划指令的完整字段，加必填 `result`。只允许 `succeeded`、`failed`、`cancelled`。不接受 `running`、任意附加字段或通用事件对象。
- 实际记录必须按序等于计划的一个前缀，长度 0 到计划长度。find/go/grab 必须含合法 target；drop 必须含 target/to，observe 的可选 room 受 plan Schema 约束；目标和落点由完整计划的语义验证保证。不得跳步、换目标、插入新动作或重复记录。
- failed/cancelled 必须是记录的最后一项。空数组表示尚无步骤结束（例如任务在开始前取消）；允许部分前缀，不能把未执行计划计入步数。
- step_count 取实际记录长度，source/corrected 取已验证计划。服务端只能校验客户端报告的合法性，不能证明实物已执行。GET /log?layout_id=A&limit=50 只返回该 layout 日志。
- 可选 `ok` 必须是布尔。服务端仅在完整步骤全部 succeeded 且客户端没有报告失败时存为 true；失败、取消、部分执行为 false。将部分执行声称 ok=true 返回 422。执行器在最后一步后或记忆同步时失败，也可显式报告 ok=false。可选 reason 是最多 200 字的错误类别，不写密钥或异常堆栈。
- SQLite 自动增列 ok/reason，保留原日志；旧记录只有完整 succeeded 前缀才能迁移为成功，缺少执行结果的历史记录保守记为失败。新增实例不会重复迁移或删除数据。

```json
{"layout_id":"A","query":"我的红色水杯在哪","plan":{"say":"好的","source":"cache","steps":[{"action":"find","target":"cup_red"}]},"steps":[{"action":"find","target":"cup_red","result":"succeeded"}],"duration_ms":200,"memory_enabled":true,"robot":{"holding":null}}
```

非法输入在写入前返回 422，不写日志。存储异常不伪造成功；SQLite 中 memory 更新及 history 为同一事务，reset 删除与重建也为同一事务。BEGIN IMMEDIATE 防止不同 Store/服务实例对同一数据库读改写丢更新，布局之间按复合键与查询条件隔离。

测试：`python -m pytest tests/test_http.py tests/test_log_boundary.py tests/test_storage_transactions.py`。并发使用独立 Store/客户端共享数据库；通过 SQLite trigger 注入第二次写入失败，验证 memory/history 与 reset 一并回滚；重建 app 后验证两份布局的记忆和日志可恢复。

## A 执行器接线与纠正唯一写入责任

D 提供 `server/client/home-client.mjs`，生产与 Vite 现有 /api 代理均可访问 `/api/client/home-client.mjs`。A 在正式 HOME 模式装配其 #20 context 后接入：

```js
const { createHomeClient } = await import('/api/client/home-client.mjs');
const home = createHomeClient(ctx); // #20 的 context：layout/robot/executor/bus/memory/holding
await home.run(query, { signal: abortController.signal });
```

不要在 local-demo 上直接套用：母版的中文房间、sceneId、scan/verify/found 并不等同于冻结 layout_id 和五动作。当前 main 没有装配该模块，A 的 HOME 页面接线仍待其 owner 实施；D 不改 web/。

每次 run：按捕获的 layout_id 拉取后端记忆 → 只投影契约允许的四字段提交 /plan → A submitPlan 执行动作 → 观察/命中/落空/放置通过 /memory 写入 → 拉取服务端最终记忆 → 写 /log。A 的同步记忆对象仅作任务期间缓存，任务结束以后端为准。一个 client 同时只执行一个任务，支持 AbortSignal 取消；取消不取消最终 /log。网络错误向调用者抛出，UI 需显示失败；HTTP 写入未成功时不能宣称已保存，未做自动重试以避免重复日志/纠正历史。

**本补丁将 /plan 改为只读。** corrective 输出保留 source=corrective，但不提前搬移记忆。A 完成对应 drop 后，适配层仅调用一次 `/memory/correct`，不再同时 observe 同一物体。现有 to 参数仍可用；可选 pos 接受执行器报告的真实位置，验证有限坐标且 x/z 位于该家具台面范围。执行失败/取消不写纠正位置。内存记录 source=correct 是冻结记忆枚举，计划/日志 source=corrective 是冻结规划枚举，二者不混用。

缓存、普通规则、在线返回及纠错均经同一结构/语义出口校验。普通规则使用 layout 名称与别名生成确定性 find/grab/go/drop。`create_app(..., online_planner=callback)` 提供可选在线提供者接口，签名 `(query, index, context) -> dict`；默认无在线调用，未接入具体云端模型。纠错与缓存命中不会调用提供者，超时走本地规则；在线返回不能伪造纠正写入。

## 隔离联调与实验边界

从已安装现有 web 依赖的仓库运行：

```sh
.venv/bin/python scripts/check_backend_loop.py \
  --executor-ref 1499b6a420219c9788e2cc8eac0384464de78edb \
  --layout-ref b41d6793e2dde5cc783024421aae569941743211:web/public/layouts/layout_restaurant.json
```

只读 Git 提取 A 原始模块和 B 的餐厅候选 JSON 到临时目录，启动真实本地 HTTP/SQLite；验证 find/grab/drop/corrective、422、动作失败、取消、布局隔离、重启保留 5 条日志。不导入场景二进制，不修改 web/，不合并 #20 或候选场景分支。该证据只验证候选 layout 的逻辑联调，不代表点云对齐、许可或正式素材验收。

#14 仍需 sen 与 Jesu 确认完整 SHA、许可、Release 名称后独立审查。#15/#16 仅作实验参考，不进入正式演示链；默认不注册 /delivery 或 reference 静态路径，缺少 dist 跳 /docs。仅研究预览时显式设置 `HOMETWIN_ENABLE_EXPERIMENTAL_DELIVERY=1`。本补丁未合入 #11/#12/#14/#15/#16，也未关闭或批准远端 PR。
