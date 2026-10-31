# D 后端闭环待审交付

任务：保留 #13 HTTP/SQLite 增量，独立验证后端闭环。未批量合并 #11–#16。

## 基线与改动边界

- main：`50ea5474f729aa966c2a75808abc5482588d090e`（含 #21/#22）。
- #13 原始 head：`a0ea3eadcd5ca70d60b2f9eb4e342c27062ee8a7`。
- 本次重提分支：`fix/d02-backend-main-20261101`，从上述 main 重新提取后端修复；原本地 `fix/13-backend-execution-loop` 与远端 #13 均保留历史，不重写提交。
- 净改动仅 `server/`、`scripts/`、`tests/`；`web/`、`contracts/`、CI、前端环境配置与 main 相同，保留现有依赖。前端构建产物和数据库不提交。
- #11 闸门、#12 纠错解析已分别重提为 #24、#25，旧草稿关闭；新草稿仍独立待审，本分支没有叠加二者。

## 最终行为

1. D 的 HTTP 适配层调用 A 的原始执行器，任务前拉取 SQLite 记忆，向 /plan 投影冻结请求字段，收集实际步骤，最终写 /log。取消、动作失败、记忆同步失败均不能记录为成功；异常可见，锁在 finally 释放。
2. /plan 只读，纠正不再提前改记忆。只有成功 drop 通过 /memory/correct 记录真实位置，避免 plan 与客户端双写。计划/日志 source=corrective，记忆 source=correct；不改冻结枚举。
3. /log 校验计划、机器人初始快照、真实执行前缀及终止结果；SQLite 增量迁移 ok/reason，保留旧日志和布局分区。
4. 缓存、普通规则、纠错、可注入在线提供者均经过统一结构/语义出口；默认无云端调用。在线错误不能伪造纠正。
5. 正式服务默认不挂载 /delivery 或 reference；无 dist 时进入 /docs。实验预览必须显式设置环境变量。

## 真实联调证据

运行命令见 [HTTP_API.md](HTTP_API.md)。A/B 代码均从明确 Git commit 只读提取到临时目录，无场景二进制、无假执行器：

| 项目 | 固定值或结果 |
| --- | --- |
| A 执行器 commit（#20，本次重新验证） | `f0babb9659c99504e17f2ba4a4b3ec33e6706cfd` |
| B 候选布局 commit | `b41d6793e2dde5cc783024421aae569941743211` |
| layout_id | `restaurant_candidate_v1` |
| layout JSON SHA256 | `208d214800101ce82ad5d76795cdda683c988a555f7eb63212f19054b8aaebe9` |
| 路径 | /api/plan → A 寻路/动作/队列 → /api/memory/* → /api/log |
| 通过项 | find、grab、drop、corrective、非法请求 422、动作异常 ok=false、取消 ok=false、两布局隔离 |
| 持久化 | 新建服务实例后保留 5 条任务日志；成功 corrective 的物体父节点和实际位置与 SQLite 一致 |

该结果只覆盖候选 JSON 的逻辑闭环。未宣称 B 的资源许可、点云对齐、生产坐标或 #20 已合并。

另已直接运行 A 在同一 f0babb9 提交提供的 `web/scripts/log-e2e/emit-payloads.mjs` 与 `verify_log_e2e.py`，未修改 A 的脚本。真实执行器产生的成功/失败/取消请求均通过本分支 /log：步骤字段完整，取消仅记录实际执行前缀，非法 running / 非末位失败 / 缺失 drop.to 返回 422，拒绝请求不写库，重建服务实例后仍一致。此项是接口兼容实测，不替代 A 的正式审批或页面装配。

## 自动检查

- `python -m pytest -q`：159 条通过；其中包含 Node 原生测试覆盖适配器正常、失败、取消、并发、HTTP 错误。
- `python -u scripts/mutation_demo.py`：28/28 KILLED，全部命中登记的目标测试；还原后全绿。新增 6 条覆盖失败日志、规划只读、适配器失败标记、grab 前置、在线纠正防伪和实验入口隔离。
- `python scripts/check_contracts.py --base origin/main`：通过；冻结 digest `62456bf9b1a4bf9e`，契约净差异为空。
- `python scripts/check_layout.py`：通过。
- 历史本地前端基线：197 条通过、Vite 构建通过；本次不把历史结果当作新提交远端 CI。未改 package/lock/Node/CI 配置。现有 main CI 的 Node20 与声明的 Vitest5 版本要求不一致，需 #10/ENV-01 由 A 单独处理；远端检查以新 PR 当前提交的实际结果为准。
- `git diff --check`：通过。

## 审核边界与后续 owner

- A：将 HTTP 适配层装配到正式 HOME context；当前 main 的 local-demo 没有接此模块，不能直接把中文房间/sceneId 映射为正式 layout_id。D 未越界修改 web/。
- B + A：确认餐厅候选 ID、资源身份、完整 SHA、许可、Release 名称与坐标适配。#14 在这些信息确认后独立重审；不复制或分发受限场景。
- #15/#16：旧草稿已关闭，分支和原始代码保留；仅实验参考，默认入口关闭，不进入正式演示链。#14 保持草稿和 B + Jesu 双审阻断。
- 本次使用用户已配置的 D 正确账号 `mwaiting002`，已核对仓库 push 权限。旧账号连接已由用户要求断开；不再使用。根据用户本轮“解决复审问题”的授权，允许推送独立重提分支、建立草稿和整理旧 PR 状态；不直推 main、不自批或合并。Jesu 审核 D 代码，#10 环境前置及正式产品装配仍待相应 owner 完成。

回滚：代码交由整合者按提交 revert；SQLite ok/reason 是增量列，回滚代码不覆盖数据库或删除新增历史。HTTP 适配层装配前，旧客户端应先确认 /plan 改为只读后的纠正写入责任。
