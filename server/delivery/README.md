# HOME / 小觅 · D 集成交付

对应步骤：1.4 HTTP 骨架、3.3 记忆持久化、3.4 纠错日志、6.2 资源交付。作者是 D / wei；本 PR 必须由 Jesu 审批合并，作者不自审。不修改 `contracts/`、`web/`、团队场景清单或其他成员现有模块。

## 运行

在仓库根目录，使用团队已有依赖：

```bash
python -m venv .venv
# Linux: source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r server/requirements.txt
python scripts/run_home.py --host 127.0.0.1 --port 8000
```

打开 `http://127.0.0.1:8000/delivery/index.html`，能看到队友场景与履带机器人，以及 `/plan` 的接口联调。`/docs` 提供接口文档。A 的 `web/dist` 构建产物就绪后，同一进程会托管该目录作为首页；D 的预览仍保留在 `/delivery/`。已有 HTTP 路径同时接受 `/api` 前缀，便于 Vite 代理。

## 程序如何结合团队逻辑

- `/plan` 直接调用现有 `planner.plan_offline`，复用 `rules.py` 和 `validate_steps`，输入/输出按冻结 Schema 校验。非法请求为 422，未知布局为 404。
- SQLite 是持久化唯一真值。命中、落空、复扫和纠正全部调用现有 `memory.py` 公式；事务和锁防止并发更新丢失。纠正前旧置信度减 0.30 的记录保存在 `memory_history`，新记录为 0.90，避免把旧数据降权过程丢掉。
- `/log` 保存实际执行事件与耗时，来源及纠错标志取自合法 plan；步骤数取执行列表长度，禁止用计划长度伪造执行次数。
- 布局由 B 的 `web/public/layouts/*.json` 读取，按文件内容中的 `layout_id` 匹配，禁止把客户端 ID 当路径。可用 `HOMETWIN_LAYOUT_DIR`、`HOMETWIN_DB`、`HOMETWIN_WEB_DIST` 配置路径。
- 不反向导入 `scripts/`；不新增后端依赖；默认不调用模型或外部网络。在线 GLM 与完整规则泛化仍按团队后续步骤推进。

### 记忆与日志请求示例

```json
POST /memory/observe
{"layout_id":"A","entries":[{"object_id":"cup_red","room":"living","pos":[-3,0.75,2.85]}],"rescan":false}

POST /memory/hit 或 /memory/miss
{"layout_id":"A","object_id":"cup_red"}

POST /memory/correct
{"layout_id":"A","object_id":"cup_red","to":"desk"}

POST /memory/reset
{"layout_id":"A","entries":[]}

GET /memory?layout_id=A
GET /log?layout_id=A&limit=50
```

重置种子 entry 另需 `confidence`、`status`；服务生成 `source=seed` 和当前更新时间。重置前整批校验，异常时不删除既有数据。`POST /log` 接受 `layout_id/query/plan/steps/duration_ms/memory_enabled`；plan 使用冻结响应结构，steps 是执行端实际发生的事件对象数组。当前 contracts 没有定义上述写入请求的独立 Schema，这些是本 PR 明确提出的传输约定，需 Jesu / A 审核，不改动已有契约。

## 机器人、场景和各分工资源

详细清单：[handoff-by-owner.json](handoff-by-owner.json)。

| 分工 | 已备妥资源 | 集成责任 |
| --- | --- | --- |
| A / Jesu | `roomscan/assets/robot/` 的 GLB 与部件清单，`roomscan/web/robot.mjs`、`motion.mjs` 动画/插值参考 | 用既有 three.js GLTFLoader 接入；通过团队事件总线绑定状态机、导航和动作，不直接导入 PlayCanvas 参考模块。 |
| B / sen | 团队 `scene_main` 的来源清单、原始 SHA-256、2.2 MiB 轻量预览和转换参数 | 人工确认方向、尺度、偏移、layout 碰撞层及台面高度。预览变换不等于标定。 |
| C / Gary | `evidence/` 截图、模型预览与界面联调参考 | 按团队事件契约接 HUD、来源标签和验收；资源预览不替代 M1/M2 验收。 |
| D / wei | FastAPI、SQLite、校验下载脚本、完整归档与测试/变异证据 | 维护接口与交付；由 Jesu 审批合并。 |

### 场景来源与限制

团队场景来自 [原有 splat-v1 Release](https://github.com/Grip1122/HOME-HomeMe/releases/tag/splat-v1)，原始文件 SHA-256：

```text
901cf8ce0be73706d6ab0f2649e4f7520def2ee4342a30bca984b55ce2678fae
```

已下载并校验一致。原始 449 MiB 文件继续使用队友 Release，不重复入 Git。`team-scene/preview-manifest.json` 记录轻量副本的裁剪、采样、球谐与哈希；所有处理只作用于预览文件，不修改团队源资产或 layout。可用以下命令校验下载原文件：

```bash
python scripts/fetch_team_scene.py
```

资源预览使用随原工程已存在的 PlayCanvas 本地脚本；正交 45°、禁止旋转、缩放 0.7–1.5。它是 D 的独立资源联调工具，没有替换 A 的 three.js 前端。首屏资源无需访问 CDN。

**正式业务接入的前提**：原团队清单尚未确认米制尺度与朝上轴，必须由 B/A 完成标定。不能把示例 layout 的客厅/卧室/书房语义直接当作当前高斯建筑中已校准的房间，不能依据预览位置启用正式导航或宣称整屋扫描完成。

**机器人差异**：履带模型没有 RobotExpressive 的 Punch/Wave 片段、手臂或既定 carryAnchor。A/B 需要共同确定携带锚点与抓放表现，保持原有五动作、挂载世界坐标、0.4 倍缩放、单飞锁与状态机契约；本 PR 不伪造这些动画。

## 全文件归档

下载：[D 完整归档与逐文件清单](https://github.com/mwaiting002/HOME-HomeMe/releases/tag/d-roomscan-source-20261031)。GitHub 返回的 SHA-256 与本地逐项校验结果一致。

原始 Hackerson 中所有未被用户排除的文件（含隐藏文件、依赖安装副本、模型源文件及上游许可）保存在 `hackerson-d-delivery.tar.gz`。逐文件清单及校验和随包提供；大归档走 GitHub Release，不塞进 Git 历史。

用户已明确排除原餐厅 ZIP、解压/转换场景资产及包含旧餐厅的扫描结果/效果图。排除项有完整清单，没有用 `.gitignore` 默默丢弃其他目录。

`roomscan/` 是便于团队直接评审的程序与机器人资源副本；原工程的 `run.py`、MuJoCo 扫描器、实验文档作为参考保留，不作为 HOME 的默认执行入口。旧餐厅运行资产已排除，因此不要使用旧文档中的默认餐厅启动命令；原版代码的完整备份以归档为准。原版 MuJoCo / NumPy / SciPy 等依赖与安装副本只随备份保存，不加入团队后端依赖或 CI。

## 验证与假设

- 团队原有 70 项测试与 12 处变异已先行通过，再接入新代码。
- 新增 HTTP、SQLite 并发/持久化、非法参数、原子批处理、布局隔离、日志真值、下载校验和与归档排除测试。
- 新接口与校验逻辑登记单行锚点变异；完整输出见 `evidence/mutation.txt`，还原后测试必须全绿。
- `evidence/` 保留真实浏览器的队友场景 + 机器人效果，及接口联调记录；这不是 Windows 帧率测量或正式全链路找物验收。
- 服务器提供的 `/plan` 纠错会按团队要求先写纠正记忆；动作执行成功/失败日志由 A 调用 `/log` 落库，不把规划成功当作动作成功。

尚待团队后续验收：B/A 坐标标定、A 的五动作与携带锚点接入、C 的正式 HUD 与导演脚本、GLM 在线规划以及 M1/M2 演示录屏。由 owner 分别确认，D 不代为标记完成。
