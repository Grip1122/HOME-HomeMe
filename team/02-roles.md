# 分工（暂定方案）

> **项目全称**：小觅HOME：虚拟孪生家庭具身空间物体定位（四人团队·AI辅助开发）
>
> **项目背景**：项目题目 **HOME**，读音 "home me"，谐音英语 *homie*，即"伙伴"之意；配套机器人命名为 **小觅**。视觉基点为建筑高斯泼溅素材 `scene.ply`（见 [`../assets/gaussian-splat/README.md`](../assets/gaussian-splat/README.md)）。（文中旧称 "HomeTwin / 小方" 即 HOME / 小觅。）
>
> **本分工为暂定方案**，由 wei 与 Jesu 确认后生效；调整时直接改本文件并走 PR。
> **所有 Agent 开工前必须先读完 [`01-overview-v3.md`](01-overview-v3.md) 与本文件**，再领取工作。

## 1. 人员与角色

| 成员 | GitHub | 角色（暂定） | 一句话职责 | 任务书 |
| --- | --- | --- | --- | --- |
| **wei** | `krlozhilderman287-creator` | **整体审核与把关人** | 唯一合并权；验收最终交付成果；**不写业务代码**（避免既当运动员又当裁判） | — |
| **sen** | `sen985211sen-sys` | **设计 A**：前端 3D 与执行层 | 机器人怎么动：场景交互、寻路行走、五个动作、状态机。关键路径中心 | [task-A](tasks/task-A-frontend-3d.md) |
| **Gary** | **无账号** | **设计 B**：场景与美术 | 世界长什么样：layout 数据、家具与物体、灰盒到正式美术 | [task-B](tasks/task-B-scene-art.md) |
| **Jesu** | `Grip1122`（仓库所有者） | **设计 C**：产品 UI 与验收，**兼 AI-D**：后端与算法；**代 Gary 上传** | HUD 与对话、验收用例、路演；后端剩余的 HTTP 与 SQLite | [task-C](tasks/task-C-ui-acceptance.md)、[task-D](tasks/task-D-backend-algo.md) |

> **待确认**：Jesu 同时担两个角色并代传 Gary 的成果，负荷偏重。后端（规划、纠错规则、记忆函数、70 条测试）已在初始仓库完成，AI-D 剩下的是接 HTTP 与 SQLite。若有第五个人或 sen 有余力，建议把 AI-D 拆出去。

## 2. 目录边界

越界改别人目录 = 打回。需要别人配合时，写明"需要谁提供什么"，不要代劳。

| 角色 | 主责目录 | 不得触碰 |
| --- | --- | --- |
| 设计 A | `web/src/core/` `web/src/robot/` `web/src/nav/` | `scene/`、`ui/`、`server/`、`contracts/` |
| 设计 B | `web/src/scene/` `web/public/` | `robot/`、`nav/`、`server/`、`contracts/` |
| 设计 C | `web/src/ui/` `web/src/demo/` `docs/` `team/` | `robot/`、`nav/`、`server/`、`contracts/` |
| AI-D | `server/` `scripts/` `tests/` `.github/` | `web/`、`contracts/` |
| 把关人 | `contracts/`（最终裁决） | 不直接写业务代码 |

`contracts/` 谁都不能顺手改：要改就单开 `contract/<改什么>` 分支，只含 `contracts/`，标题以 `[CONTRACT]` 开头，由把关人合并。

## 3. 仓库权限

| 人 | 仓库权限 | 说明 |
| --- | --- | --- |
| Jesu | 所有者 | `Grip1122` |
| wei | 协作者 · Write（`krlozhilderman287-creator`） | 把关人，负责合并 |
| sen | 协作者 · Write（`sen985211sen-sys`） | 设计 A |
| Gary | 无 | 无法登录 GitHub，成果由 Jesu 代传（见第 5 节） |

> GitHub 免费私有库**无法开启服务端分支保护**：直推 `main` 与跳过 review 在服务端拦不住，目前靠本地钩子（`git config core.hooksPath .githooks`）、CI 与把关人人工把关。详见总览第十五章第五节。

## 4. 把关人 wei 的职责

**日常审核**：按 [`docs/review-checklist.md`](../docs/review-checklist.md) 的三关走（契约 → 测试有效性 → 代码与边界），小 PR 3 分钟、大 PR 10 分钟，超时就要求拆分。固定审核窗口见总览第十六章。

**验收最终交付成果**：以下全部满足才算交付：

- [ ] `main` 上 CI 四个 job 全绿（契约闸门 / 后端测试 / 变异验证 / 前端测试）
- [ ] `docs/test-cases.md` 十条主用例全部通过，八条纠正专项全部通过
- [ ] 断网状态下五句核心台词全部正常，来源标签显示"缓存"，纠错显示"规则"
- [ ] 演示录屏完成（1080p、含字幕），两处备份
- [ ] 在一台没装过项目的电脑上，按说明 5 分钟内跑起演示
- [ ] 提交包齐全：源码、构建产物、一键启动说明、视频、路演稿、架构图
- [ ] 打最终里程碑 tag（只有 wei 打）

## 5. Gary 的交付规范（由 Jesu 对接并上传）

Gary 不用 GitHub。他的 Agent 照常按 [task-B](tasks/task-B-scene-art.md) 干活，**成果以"交付包"形式交给 Jesu**，Jesu 校验后上传。

### 5.1 交付包结构：包内路径 = 仓库内路径

Jesu 拿到后直接把 `web/` 整个覆盖拷进仓库，不需要搬来搬去。

```
gary_1-1_20261031-1530.zip
└─ gary_1-1_20261031-1530/
   ├─ DELIVERY.md                     交付说明（必填，模板见 5.4）
   ├─ web/public/layouts/layout_A.json
   ├─ web/src/scene/loader.js
   ├─ web/src/scene/loader.test.js
   └─ evidence/
      ├─ check_layout_output.txt      check_layout.py 的完整终端输出
      └─ red_evidence.txt             "故意改错 → 测试变红"的终端输出
```

### 5.2 命名与格式规则

| 项 | 规则 |
| --- | --- |
| 所有文件与目录名 | 全小写英文、数字、下划线 `_`、连字符 `-`；**禁止空格、中文、大写、括号** |
| 文本文件编码 | UTF-8，**无 BOM**，换行 LF，末尾留一个空行 |
| JSON | 2 空格缩进；`id` 一律 `^[a-z][a-z0-9_]*$` |
| 压缩包 | `gary_<步骤号>_<yyyymmdd-hhmm>.zip`，步骤号用连字符，如 `gary_1-1_20261031-1530.zip`；包内顶层文件夹与包同名 |
| 布局文件 | `layout_A.json`、`layout_B.json`，放 `web/public/layouts/` |
| 代码 | ES module `.js`，放 `web/src/scene/`；测试与源文件同目录，命名 `<模块>.test.js` |
| 家具模型 | `<furniture_id>.glb`，如 `sofa.glb`；**不进压缩包**，见 5.3 |
| 截图 | `shot_<A|B>_<两位序号>.png`，1920×1080，PNG，放 `web/public/shots/` |
| 污渍贴图 | `stain_<序号>.png`，512×512，透明底 PNG，放 `web/public/textures/` |
| 录屏 | `anchor_<yyyymmdd>.mp4`，1080p，H.264，≤ 200 MB，走网盘 |

### 5.3 大文件不入库

`.glb` 与视频已被 `.gitignore` 排除。Gary 把它们放网盘，链接和 sha256 写进 `DELIVERY.md` 与 `web/public/models/manifest.json`；仓库里只留清单与校验和。

### 5.4 `DELIVERY.md` 模板（每次必填）

```markdown
# 交付说明
- 交付人：Gary　对接人：Jesu　时间：2026-10-31 15:30
- 对应步骤：1.1
- 本次交付清单：（逐个文件，写仓库内路径与一句话用途）
  1. web/public/layouts/layout_A.json — 客厅/卧室/书房布局
  2. ...
- 网盘文件：（文件名、链接、sha256）
- 自检结果：
  - check_layout.py：零错误 / 有错误（附输出）
  - 测试：通过 N 条；故意改错的位置与变红的测试名
- 我的 Agent 做了哪些假设：
- 需要别人配合的事：
```

### 5.5 Gary 的交付物清单（按步骤）

| 步骤 | 交付物 | 仓库内路径 | 格式 | 通过标准 |
| --- | --- | --- | --- | --- |
| 0.1 | 资产清单 | `web/public/models/manifest.json` | JSON | 每项含文件名、尺寸、sha256、来源链接、授权 |
| 0.2 | 契约核对意见 | `evidence/contract_review.md` | Markdown | 对场景契约逐项写"符合 / 有异议" |
| 0.4 | 八件物体到可站格的距离表 | `evidence/reach_distance.md` | Markdown 表格 | 全部 ≤ 1.0 米，数据来自脚本输出 |
| 1.1 | 场景加载器、物体注册表、测试 | `web/src/scene/*.js` | ES module | 测试全绿 + 变红证据；挂载用 `attach()`，世界坐标差 < 1e-6 |
| 1.1 | 布局 A | `web/public/layouts/layout_A.json` | JSON | `check_layout.py` 零错误，且附"改坏会报错"的证据 |
| 2.1 | 携带锚点调校报告 | `evidence/anchor_report.md` + `anchor_*.mp4` | Markdown + MP4 | 含 0.4 倍与 0.5 倍对比结论 |
| 4.1 | 布局 B | `web/public/layouts/layout_B.json` | JSON | 同上，且家具与物体位置与 A 全不相同 |
| 5.1 | 正式美术与光照 | `web/src/scene/*.js`、`web/public/shots/` | JS + PNG | 首屏 < 8 MB，普通笔记本 ≥ 50 帧，3 张封面截图 |
| 5.2 | 污渍贴图 | `web/public/textures/stain_*.png` | PNG | 客厅、卧室各一处 |

### 5.6 Jesu 的对接与上传步骤（每次交付都走）

1. 收到 zip，解压到仓库外的临时目录，**不要直接在仓库里解压**。
2. 核对 `DELIVERY.md` 的清单与包内文件一一对应；文件名违反 5.2 的先退回 Gary。
3. 把 `web/` 覆盖拷进仓库工作区，运行：
   ```bash
   python scripts/check_layout.py web/public/layouts/layout_A.json
   python -m pytest -q
   cd web && npm test
   ```
4. 切分支：`git switch -c feat/<步骤号>-<短名>`（例如 `feat/1-1-scene-loader`），提交信息：
   ```
   feat(scene): 1.1 layout 加载器与物体注册表

   Contributor: Gary
   Uploaded-by: Jesu
   Authored-by: ai+human
   Step: 1.1
   ```
5. 推送并开 PR：`git push -u origin <分支>`，`gh pr create --fill --base main`；PR 里"谁写的"勾"AI 生成 + 人工修改"，"给把关人的话"写明"本 PR 由 Gary 完成、Jesu 代传"，并贴 `evidence/` 里的两份输出。
6. 等 CI 四个 job 全绿，由 wei 审核合并。Gary 的目录归属审核人设为 Jesu 代理（`CODEOWNERS` 里 `@DEV_B`）。

## 6. 领取工作的规则

1. 先读完 `01-overview-v3.md` 与本文件，再读你角色的任务书。
2. 领取的单位是**步骤**（如 `2.1`）。领取前在群里声明"我领 2.1"，避免两人做同一件事。
3. **一人同时只开一个未合并分支**，活过 4 小时就拆小或废弃。
4. 每个 PR 必须带"故意改错 → 测试变红"的证据；改了 `contracts/` 的 PR 直接打回，除非走契约 PR。
5. 提交信息格式 `type(scope): 摘要`，正文末尾必须有 `Authored-by: ai | human | ai+human` 与 `Step: N.N`，钩子会拦。

## 7. 待确认事项

- [ ] 角色分配（尤其 Jesu 兼任 C 与 AI-D）是否合适
- [x] wei 与 sen 的 GitHub 用户名（已发出邀请，待对方接受）；`CODEOWNERS` 已换成真实用户名
- [ ] 日程：原计划的里程碑时间基于 10/30 21:45 开工，实际开工更晚，需要 wei 与 Jesu 按相对工期重排
- [ ] 是否把文档与代码里的 "小方 / HomeTwin" 全量改成 "小觅 / HOME"（目前只做了命名对照和唤醒词兼容）
- [ ] **高斯泼溅素材 `scene.ply` 的三项验证由谁承担**（浏览器能否渲染 / 正交相机下是否排序出错 / 帧率）。建议由设计 A（sen）与设计 B（Gary）共同做，结论写回 `assets/gaussian-splat/README.md`，在此之前不要改 `layout_A.json` 的坐标。详见 [`../assets/gaussian-splat/README.md`](../assets/gaussian-splat/README.md)。
- [ ] `scene.ply` 的网盘链接与授权状态，由 Jesu 填入 `assets/gaussian-splat/manifest.json`
