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

POST 必须带 layout_id、query（非空，最多 200 字）、plan（完整冻结 plan 响应）、steps（实际执行记录）、duration_ms（有限非负数，毫秒）、memory_enabled（布尔）。可选 robot 复用冻结 plan 请求的 robot 对象结构：pos 是三个有限数，holding 为本 layout 的物体 id 或 null；数组、字符串、数值、布尔、null 或额外字段返回 422。省略 robot 等于空手上下文，已持物计划需显式传入 holding。

- `plan.steps` 是规划的完整指令序列，最多 8 步；响应结构与动作顺序均验证。
- `steps` 是客户端报告的**已结束执行记录**，每项是对应计划指令的完整字段，加必填 `result`。只允许 `succeeded`、`failed`、`cancelled`。不接受 `running`、任意附加字段或通用事件对象。
- 实际记录必须按序等于计划的一个前缀，长度 0 到计划长度。find/go/grab 必须含合法 target；drop 必须含 target/to，observe 的可选 room 受 plan Schema 约束；目标和落点由完整计划的语义验证保证。不得跳步、换目标、插入新动作或重复记录。
- failed/cancelled 必须是记录的最后一项。空数组表示尚无步骤结束（例如任务在开始前取消）；允许部分前缀，不能把未执行计划计入步数。
- step_count 取实际记录长度，source/corrected 取已验证计划。服务端只能校验客户端报告的合法性，不能证明实物已执行。GET /log?layout_id=A&limit=50 只返回该 layout 日志。

```json
{"layout_id":"A","query":"我的红色水杯在哪","plan":{"say":"好的","source":"cache","steps":[{"action":"find","target":"cup_red"}]},"steps":[{"action":"find","target":"cup_red","result":"succeeded"}],"duration_ms":200,"memory_enabled":true,"robot":{"holding":null}}
```

非法输入在写入前返回 422，不写日志。存储异常不伪造成功；SQLite 中 memory 更新及 history 为同一事务，reset 删除与重建也为同一事务。BEGIN IMMEDIATE 防止不同 Store/服务实例对同一数据库读改写丢更新，布局之间按复合键与查询条件隔离。

测试：`python -m pytest tests/test_http.py tests/test_log_boundary.py tests/test_storage_transactions.py`。并发使用独立 Store/客户端共享数据库；通过 SQLite trigger 注入第二次写入失败，验证 memory/history 与 reset 一并回滚；重建 app 后验证两份布局的记忆和日志可恢复。
