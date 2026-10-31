# 分工（暂定方案 · 第 2 版）

> **项目全称**：小觅HOME：虚拟孪生家庭具身空间物体定位（四人团队·AI辅助开发）
>
> **项目背景**：项目题目 **HOME**，读音 "home me"，谐音英语 *homie*，即"伙伴"之意；配套机器人命名为 **小觅**。视觉基点为建筑高斯泼溅素材 `scene.ply`（见 [`../assets/gaussian-splat/README.md`](../assets/gaussian-splat/README.md)）。（文中旧称 "HomeTwin / 小方" 即 HOME / 小觅。）
>
> **本分工为暂定方案**，调整时直接改本文件并走 PR。
> **所有 Agent 开工前必须先读完 [`01-overview-v3.md`](01-overview-v3.md) 与本文件**，再领取工作。

## 1. 人员与角色

四人，四个任务书，一人一份。总览里的"设计 A / 设计 B / 设计 C / AI-D"是**角色代号**，下表是代号到真人的对应。

| 成员 | GitHub | 角色 | 一句话职责 | 任务书 |
| --- | --- | --- | --- | --- |
| **wei** | `krlozhilderman287-creator` | **AI-D**：后端与算法　**＋　整体审核与把关人** | 后端接 HTTP 与 SQLite、GLM 规划；同时是唯一的验收人，验收最终交付成果 | [task-D](tasks/task-D-backend-algo.md) |
| **Jesu** | `Grip1122`（仓库所有者） | **设计 A**：前端 3D 与执行层　**＋　总体库整合调配　＋　代 Gary 上传** | 机器人怎么动（状态机、寻路行走、五个动作）；维护 `main` 的整合、冲突仲裁、素材与 Release；把 Gary 的交付包校验后上传 | [task-A](tasks/task-A-frontend-3d.md) |
| **Gary** | **无账号** | **设计 C**：产品 UI 与验收 | 用户看到的一切：HUD、对话气泡、导演面板、验收用例、路演稿 | [task-C](tasks/task-C-ui-acceptance.md) |
| **sen** | `sen985211sen-sys` | **设计 B**：场景与美术 | 世界长什么样：layout 数据、点云接入与坐标标定、隐形碰撞层、泼溅质量调优（**不做灰盒**） | [task-B](tasks/task-B-scene-art.md) |

> **⚠ 待确认 · sen 担任设计 B 是我的推断。** 原话只分了 Gary→C、wei→D、Jesu→A，剩下的设计 B 正好空着，而 sen 是唯一没被分配的人，所以暂记 sen→B。若不对，请直接改本表与 `.github/CODEOWNERS`。

### 1.1 两处身兼数职带来的真实风险（需要大家知道）

| 风险 | 为什么是问题 | 处置（已写进流程） |
| --- | --- | --- |
| **wei 既写后端又当把关人** | 总览的原则是"把关人不写业务代码，避免既当运动员又当裁判" | **自审回避**：wei 作者的 PR（`server/` `scripts/` `tests/` `.github/`）由 **Jesu 审批并合并**，wei 不得批自己的；其余所有人的 PR 由 wei 审。契约 PR 需 **wei 与 Jesu 两人都批** |
| **Jesu 是关键路径中心，又兼整合与代传** | 总览关键路径规定"任何人不得给设计 A 增派额外任务"，现在 A 同时背整合与代传 | **代传集中成批**：Gary 的交付包按固定窗口收（见 5.7），不随到随传；整合只做三件事——同步 `main`、仲裁冲突、管素材。超载时优先砍整合，不砍 A 的步骤 |

## 2. 目录边界

越界改别人目录 = 打回。需要别人配合时，写明"需要谁提供什么"，不要代劳。

| 角色（真人） | 主责目录 | 不得触碰 |
| --- | --- | --- |
| 设计 A（Jesu） | `web/src/core/` `web/src/robot/` `web/src/nav/` | `scene/`、`ui/`、`server/`、`contracts/` |
| 设计 B（sen） | `web/src/scene/` `web/public/` `assets/`（与 Jesu 共管） | `robot/`、`nav/`、`server/`、`contracts/` |
| 设计 C（Gary） | `web/src/ui/` `web/src/demo/` `docs/` | `robot/`、`nav/`、`scene/`、`server/`、`contracts/` |
| AI-D（wei） | `server/` `scripts/` `tests/` `.github/` | `web/`、`contracts/` |
| 整合（Jesu） | `team/` `assets/`（清单与 Release） | 不替别人写他们目录里的代码 |
| 把关人（wei） | `contracts/` 的最终裁决 | 不批自己的 PR |

`contracts/` 谁都不能顺手改：要改就单开 `contract/<改什么>` 分支，只含 `contracts/`，标题以 `[CONTRACT]` 开头，由 wei 与 Jesu 共同批准后合并。

## 3. 仓库权限

| 人 | 仓库权限 | 说明 |
| --- | --- | --- |
| Jesu | 所有者（admin） | `Grip1122`；整合，并合并 wei 的 PR |
| wei | 协作者 · Write | `krlozhilderman287-creator`；把关人，合并其他人的 PR |
| sen | 协作者 · Write | `sen985211sen-sys`；设计 B |
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

**自审回避**：wei 自己写的代码，验收时不得由 wei 单独放行；对应项由 Jesu 复核后勾选。

## 4.1 整合负责人 Jesu 的职责

1. **同步 `main`**：每天固定两次把 `main` 的状态发群里（谁合了什么、CI 是否绿）。
2. **仲裁冲突**：合并冲突、跨目录争议由 Jesu 定（与总览风险表"合并冲突由设计 A 仲裁"一致）。
3. **素材与 Release**：`scene.ply` 在 Release `splat-v1`；维护 `assets/gaussian-splat/manifest.json`（网盘链接、授权状态、验证结论）。
4. **代传 Gary 的交付包**：流程见 5.6，窗口见 5.7。
5. **审批 wei 的 PR**：见 1.1。

## 5. Gary 的交付规范（由 Jesu 对接并上传）

Gary 不用 GitHub。他的 Agent 照常按 [task-C](tasks/task-C-ui-acceptance.md) 干活，**成果以"交付包"形式交给 Jesu**，Jesu 校验后上传。

### 5.1 交付包结构：包内路径 = 仓库内路径

Jesu 拿到后直接把包里的 `web/`、`docs/` 覆盖拷进仓库，不需要搬来搬去。

```
gary_2-3_20261031-1530.zip
└─ gary_2-3_20261031-1530/
   ├─ DELIVERY.md                     交付说明（必填，模板见 5.4）
   ├─ web/src/ui/hud.js
   ├─ web/src/ui/hud.css
   ├─ web/src/ui/hud.test.js
   ├─ docs/test-cases.md              只有改过才放
   └─ evidence/
      ├─ red_evidence.txt             "故意改错 → 测试变红"的终端输出
      └─ shot_hud_01.png              效果截图（1366×768 与 1920×1080 各一）
```

### 5.2 命名与格式规则

| 项 | 规则 |
| --- | --- |
| 所有文件与目录名 | 全小写英文、数字、下划线 `_`、连字符 `-`；**禁止空格、中文、大写、括号** |
| 文本文件编码 | UTF-8，**无 BOM**，换行 LF，末尾留一个空行 |
| 压缩包 | `gary_<步骤号>_<yyyymmdd-hhmm>.zip`，步骤号用连字符，如 `gary_2-3_20261031-1530.zip`；包内顶层文件夹与包同名 |
| 代码 | ES module `.js`，放 `web/src/ui/` 或 `web/src/demo/`；样式 `.css`；**不引入 UI 框架**（不用 React / Vue） |
| 测试 | 与源文件同目录，命名 `<模块>.test.js`；每个模块至少三条（正常 / 边界 / 异常） |
| 事件名 | 只用 `contracts/events.md` 里已声明的 18 个；缺事件**不要自己加**，写进 `DELIVERY.md` 的"需要别人配合的事" |
| 文案 | 放 `web/src/ui/copy.js`，口语化、第一人称（小觅的口吻），不要散落在组件里 |
| 文档 | Markdown，放 `docs/`；验收记录 `docs/acceptance_<m1\|m2>.md`；路演稿 `docs/pitch.md`；彩排记录 `docs/rehearsal_log.md` |
| 字幕 | `docs/subtitles_m2.srt`，UTF-8 |
| 截图 | `shot_<模块>_<两位序号>.png`，PNG，放压缩包 `evidence/`（需入库的放 `docs/shots/`），HUD 截图必须 1366×768 与 1920×1080 各一 |
| 录屏 | `demo_<m2\|final>_<yyyymmdd>.mp4`，1080p，H.264，≤ 200 MB；**走网盘，不进压缩包** |

### 5.3 大文件不入库

视频与大图已被 `.gitignore` 或体积规则排除。Gary 把它们放网盘，链接和 sha256 写进 `DELIVERY.md`；Jesu 再记入 `assets/` 下对应清单。仓库里只留清单与校验和。

### 5.4 `DELIVERY.md` 模板（每次必填）

```markdown
# 交付说明
- 交付人：Gary　对接人：Jesu　时间：2026-10-31 15:30
- 对应步骤：2.3
- 本次交付清单：（逐个文件，写仓库内路径与一句话用途）
  1. web/src/ui/hud.js — 四块 HUD 的渲染与事件订阅
  2. ...
- 订阅的事件：（逐个列出，必须都在 contracts/events.md 里）
- 网盘文件：（文件名、链接、sha256）
- 自检结果：
  - 测试：通过 N 条；故意改错的位置与变红的测试名
  - 1366×768 与 1920×1080 下 HUD 宽度 ≤ 22%：是 / 否（附截图）
- 我的 Agent 做了哪些假设：
- 需要别人配合的事：
```

### 5.5 Gary 的交付物清单（按步骤）

| 步骤 | 交付物 | 仓库内路径 | 格式 | 通过标准 |
| --- | --- | --- | --- | --- |
| 0.2 | 验收用例核对 | `docs/test-cases.md`（改动才交）+ `evidence/events_check.md` | Markdown | 十条用例的"期望日志"逐条对过 `events.md`，对不上的列出来 |
| 0.4 | 两栏补充用例 | `docs/test-cases.md` | Markdown 表格 | 补"抓取期视觉检查（无发光、缩放 0.4）"与"纠错来源标签必须显示规则" |
| 1.2 | 状态气泡文案库 | `web/src/ui/copy.js` + `copy.test.js` | ES module | 覆盖 8 个状态；文案口语化第一人称 |
| 2.3 | HUD 四块（对话区 / 状态条 / 记忆面板 / 时间线） | `web/src/ui/hud*.js` `hud.css` 与测试 | JS + CSS | 只订阅事件总线；**宽度 ≤ 屏幕 22%**；置信度条三段色（>0.7 绿 / 0.3–0.7 黄 / <0.3 灰） |
| 2.4 | 离线演示脚本库、导演面板雏形、M1 验收记录 | `web/src/demo/` + `docs/acceptance_m1.md` | JS + Markdown | 五个脚本断开后端全跑通；十条用例过 ≥ 8 条，其余有修复计划 |
| 3.2 | 来源标签（缓存 / 在线 / 规则 / 纠错 / 脚本） | `web/src/ui/source_label.js` + 测试 | ES module | 纠错路径必须显示"规则" |
| 3.4 | 任务时间线、M2 录屏、字幕 | `web/src/ui/timeline.js`、`docs/subtitles_m2.srt`、`demo_m2_*.mp4`（网盘） | JS + SRT + MP4 | 时间线读任务日志；录屏 1080p 含字幕，两处备份 |
| 4.2 | 训练前后对比卡片 | `web/src/ui/compare_card.js` + 测试 | ES module | 数据全部来自任务日志，**不得手写**；40 秒内出图 |
| 4.3 | 语音合成与识别封装 | `web/src/ui/voice.js` + 测试 | ES module | 识别失败提示改用文字；断网时合成仍可用 |
| 6.1 | 路演稿、彩排记录 | `docs/pitch.md`、`docs/rehearsal_log.md` | Markdown | 结构：痛点 → 演示 → 技术亮点 → 数据 → 愿景；时长误差 ≤ 15 秒 |
| 6.2 | 终版演示视频 | `demo_final_*.mp4`（网盘） | MP4 | ≤ 200 MB，1080p |

### 5.6 Jesu 的对接与上传步骤（每次交付都走）

1. 收到 zip，解压到仓库外的临时目录，**不要直接在仓库里解压**。
2. 核对 `DELIVERY.md` 的清单与包内文件一一对应；文件名违反 5.2 的先退回 Gary。
3. 把 `web/`、`docs/` 覆盖拷进仓库工作区，运行：
   ```bash
   python -m pytest -q
   python scripts/check_contracts.py --base origin/main
   cd web && npm test
   ```
4. 切分支：`git switch -c feat/<步骤号>-<短名>`（例如 `feat/2-3-hud-skeleton`），提交信息：
   ```
   feat(ui): 2.3 HUD 四块界面订阅事件总线

   Contributor: Gary
   Uploaded-by: Jesu
   Authored-by: ai+human
   Step: 2.3
   ```
5. 推送并开 PR：`git push -u origin <分支>`，`gh pr create --fill --base main`；PR 里"谁写的"勾"AI 生成 + 人工修改"，"给把关人的话"写明"本 PR 由 Gary 完成、Jesu 代传"，并贴 `evidence/` 里的输出。
6. 等 CI 四个 job 全绿，**由 wei 审核合并**（Jesu 是代传人，不得自批）。

### 5.7 代传窗口

Jesu 同时是设计 A，不能随到随传。约定：**每个整点后 10 分钟**集中处理一次；Gary 在整点前把包发给 Jesu。紧急（阻断他人开工）可随时。

## 6. 领取工作的规则

1. 先读完 `01-overview-v3.md` 与本文件，再读你角色的任务书。
2. 领取的单位是**步骤**（如 `2.1`）。领取前在群里声明"我领 2.1"，避免两人做同一件事。
3. **一人同时只开一个未合并分支**，活过 4 小时就拆小或废弃。
4. 每个 PR 必须带"故意改错 → 测试变红"的证据；改了 `contracts/` 的 PR 直接打回，除非走契约 PR。
5. 提交信息格式 `type(scope): 摘要`，正文末尾必须有 `Authored-by: ai | human | ai+human` 与 `Step: N.N`，钩子会拦。
6. **作者不批自己的 PR**：wei 的 PR 由 Jesu 批；其余由 wei 批。

## 7. 开工第一步（每人一条，今天就做）

| 人 | 第一步 | 交付 |
| --- | --- | --- |
| **wei**（AI-D＋把关） | 跑通 `pytest` / `check_layout` / `check_contracts` / `mutation_demo` 四条命令；然后写 `server/main.py` 的 `/plan` 一个接口 + 三条测试 + 两条变异 | PR：`feat(server): 1.4 /plan 接口`（由 Jesu 批） |
| **Jesu**（A＋整合） | 起 `web/` 的 Vite 脚手架（旋转立方体）；同时做 `scene.ply` 的**三项验证**里"正交相机下渲染是否正确" | PR：`chore(web): 1.0 前端脚手架`；验证结论写回 `assets/gaussian-splat/README.md` |
| **sen**（B） | 复制 `contracts/layout.example.json` → `web/public/layouts/layout_A.json` 并跑 `check_layout.py`；故意改坏三处记录报错；做三项验证里"浏览器能否打开 `scene.ply`、帧率多少" | PR：`feat(scene): 0.2 layout_A 与校验证据` |
| **Gary**（C） | 通读 `docs/test-cases.md`，把十条用例的"期望日志"对一遍 `events.md`；做 HUD 的静态假数据版 | 交付包 `gary_0-2_<时间>.zip`（核对意见），交 Jesu |

## 8. 待确认事项

- [ ] **sen 是否担任设计 B**（见 1 节的警告）
- [ ] **日程重排。** 原计划基于 10/30 21:45 开工、M1 定在 10/31 12:00。现在是 10/31 上午，前端尚无代码，素材与渲染路线还没验证，M1 按原时间**不可能达成**。需要 wei 与 Jesu 按相对工期重排，并重新核对提交截止（原定 11/1 10:30）
- [ ] 是否把文档与代码里的 "小方 / HomeTwin" 全量改成 "小觅 / HOME"（目前只做了命名对照和唤醒词兼容）
- [x] **场景路线已定（Jesu 10/31 确认）：以高斯泼溅素材为准，不做灰盒。** 总览「修订 1」与设计 B 任务书已同步改写
- [ ] **高斯泼溅素材 `scene.ply` 的三项验证**（浏览器能否渲染 / 正交相机下是否排序出错 / 帧率）：**Jesu 与 sen 共同做**，结论写回 `assets/gaussian-splat/README.md`，在此之前不要改 `layout_A.json` 的坐标。详见 [`../assets/gaussian-splat/README.md`](../assets/gaussian-splat/README.md)
- [x] `scene.ply` 授权：Jesu 已确认为开源素材（具体许可证条款待补进 `manifest.json`）
- [ ] 原始文件在 Release `splat-v1`：**上传完成并核对 sha256 后才算数**，在此之前队友无法下载素材
- [x] wei 与 sen 的 GitHub 用户名，邀请已被接受；`CODEOWNERS` 已换成真实用户名
