# 分工（最新用户职责 · 本地待审）

> **最新安排（本地待审、未上传、未合并生效）**：先读 [`03-demo-coordination.md`](03-demo-coordination.md)。接续方案沿用 **robot-find 母版**；当前为 **local-demo，未接后端，场景与机器人素材待替换**，demo 尚未进入 main。旧里程碑、职责冲突以 03 为待合并提案准，合并后才生效；Gary 的第 5 节交付包、署名与代传审核规范保留，具体任务范围按 03 提案对齐，不重做整套 HUD。
> **人员确认**：sen 担任设计 B 已确认。wei 的有效审阅账号及仓库权限仍待核验，保留现有账号，不因昵称或后续交付账号自动替换。

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
| **wei** | 有效账号待确认；保留历史路由 `krlozhilderman287-creator`，不猜换 | **AI-D**：编程代码负责人、后端搭建与技术复核 | 代码审核、技术方案合理性判断、后端一致性与验证；jesu 自己的代码由 wei 独立复核，不自批 | [task-D](tasks/task-D-backend-algo.md) |
| **jesu（Jesu）** | `Grip1122` | **设计 A**：前端设计搭建、全局审核及整合 | 所有文件全局审核，GitHub 整体搭建/审核/维护安排，最终整合审核，前端与动作代码；Gary 署名代传 | [task-A](tasks/task-A-frontend-3d.md) |
| **Gary** | **无账号，不伪造** | **设计 C**：UI 交互美术、素材、材质渲染与产品设计 | UI/通用素材、机器人建模素材、材质贴图与渲染参数、参与产品设计；不再以测试为主 | [task-C](tasks/task-C-ui-acceptance.md) |
| **sen** | `sen985211sen-sys` | **设计 B**：场景设计及相关美术、空间点位校准 | 场景几何/空间/layout/碰撞/校准、任务空间语义；装配 Gary 的场景材质接口 | [task-B](tasks/task-B-scene-art.md) |

> **已确认：sen 担任设计 B**，不再标记为推断；接续职责范围见最新安排提案。

### 1.1 两处身兼数职带来的真实风险（需要大家知道）

| 风险 | 为什么是问题 | 处置（已写进流程） |
| --- | --- | --- |
| **代码作者不能自审** | wei 负责技术复核，jesu 负责最终整合审核，但两人均写代码 | wei 自己的代码由 jesu 审核；jesu 自己的代码由 wei 独立复核，不得自审。契约仍需两人共同同意，作者回避自批 |
| **jesu 兼全局审核、前端与代传** | 全局审查不等于代改各 owner 文件 | 各 owner 自验提交证据，jesu 统筹验收；Gary 以设计素材为主，不承担唯一验收职责；代传保留署名并独立复核代码 |

## 2. 目录边界

越界改别人目录 = 打回。需要别人配合时，写明"需要谁提供什么"，不要代劳。

| 角色（真人） | 主责目录 | 不得触碰 |
| --- | --- | --- |
| 设计 A（jesu） | `web/index.html` `web/src/main.js` `web/src/robot-find/`（含 world.js 单写）、`core/` `robot/` `nav/`，UI/前端装配 | 不改 sen/Gary 素材真值、wei 后端或冻结契约；自己代码不自审 |
| 设计 B（sen） | `web/src/scene/` `web/public/layouts/`、`assets/gaussian-splat/` 的场景几何/空间/校准；场景材质接口装配 | 不改 UI/通用素材/材质参数、机器人模型、动作代码、world.js、后端或契约 |
| 设计 C（Gary） | `assets/robot/` 机器人建模素材；既有资源路径内 UI/通用素材、材质贴图/渲染参数；`ui/` `demo/` 设计稿及经约定的独立模块 | 不改场景几何/空间/校准、world.js、动作代码、后端或契约；不以测试为主 |
| AI-D（wei） | `server/` `scripts/` `tests/` 技术实现，`.github/` 技术配置与方案复核 | 前端变更交 jesu；GitHub 全局安排归 jesu；不自行改契约，不批自己代码 |
| 全局整合审核（jesu） | 全部文件评审路由；`team/` `docs/`、资源索引、GitHub 搭建/审核/维护安排 | 全局审核不是全目录写权限；owner 自验后由 jesu 统筹；jesu 代码必须 wei 复核 |
| 技术复核（wei） | 代码审核、技术方案合理性判断、契约与接口技术复核 | 不替代 jesu 最终整合审核，不自批 |

`contracts/` 谁都不能顺手改：要改就单开 `contract/<改什么>` 分支，只含 `contracts/`，标题以 `[CONTRACT]` 开头，由 wei 与 Jesu 共同批准后合并。

## 3. 仓库权限

| 人 | 仓库权限 | 说明 |
| --- | --- | --- |
| jesu | 历史记录为所有者；本轮不核验或修改远端权限 | `Grip1122`；负责 GitHub 整体安排与最终整合审核，自己的代码由 wei 复核 |
| wei | 当前有效账号和审阅权限待确认 | 保留历史 `krlozhilderman287-creator` 路由，不自动替换或授权 |
| sen | 协作者 · Write | `sen985211sen-sys`；设计 B |
| Gary | 无 | 无法登录 GitHub，成果由 Jesu 代传（见第 5 节） |

> GitHub 免费私有库**无法开启服务端分支保护**：直推 `main` 与跳过 review 在服务端拦不住，目前靠本地钩子（`git config core.hooksPath .githooks`）、CI 与把关人人工把关。详见总览第十五章第五节。

## 4. wei 的编程负责人及技术复核职责

**日常技术审核**：按 [`docs/review-checklist.md`](../docs/review-checklist.md) 的三关走（契约 → 测试有效性 → 代码与边界），判断技术方案合理性并负责后端搭建；不越过目录 owner 并发修改前端。

**验收机制**：各 owner 自验，jesu 统筹最终验收，wei 技术复核；下面是历史交付清单参考，当前任务门槛以 03 第 5 节为准，未核验不得勾成完成：

- [ ] `main` 上 CI 四个 job 全绿（契约闸门 / 后端测试 / 变异验证 / 前端测试）
- [ ] `docs/test-cases.md` 十条主用例全部通过，八条纠正专项全部通过
- [ ] 断网状态下五句核心台词全部正常，来源标签显示"缓存"，纠错显示"规则"
- [ ] 演示录屏完成（1080p、含字幕），两处备份
- [ ] 在一台没装过项目的电脑上，按说明 5 分钟内跑起演示
- [ ] 提交包齐全：源码、构建产物、一键启动说明、视频、路演稿、架构图
- [ ] 最终里程碑由 jesu 汇总审核、wei 技术复核后安排；当前禁止创建 tag 或任何网络写入

**自审回避**：wei 自己写的代码，验收时不得由 wei 单独放行；对应项由 Jesu 复核后勾选。

## 4.1 整合负责人 Jesu 的职责

1. **同步 `main`**：每天固定两次把 `main` 的状态发群里（谁合了什么、CI 是否绿）。
2. **仲裁冲突**：合并冲突、跨目录争议由 Jesu 定（与总览风险表"合并冲突由设计 A 仲裁"一致）。
3. **素材与 Release**：`scene.ply` 在 Release `splat-v1`；维护 `assets/gaussian-splat/manifest.json`（网盘链接、授权状态、验证结论）。
4. **代传 Gary 的交付包**：流程见 5.6，窗口见 5.7。
5. **全局与最终整合审核**：所有文件均纳入 jesu 审核范围；GitHub 整体搭建、审核、维护安排由 jesu 负责。各 owner 自验，wei 负责代码和技术方案复核。jesu 自己的代码必须由 wei 独立复核，不能自审。
6. **资源接口**：sen 管场景几何/空间/校准与任务空间语义；Gary 管 UI/通用素材/机器人建模素材/材质参数。场景材质由 sen 装配，前端由 jesu 装配；迁移版 world.js 不并发修改。
7. **本轮限制**：仅本地文档调整，GitHub create_branch 的 403 未解除；不得提交、push、上传或换通道绕过。

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

### 5.5 Gary 的历史交付物清单（仅参考，不据此重新领测试主责）

最新交付是 UI 交互美术/通用素材、机器人建模素材、材质贴图/渲染参数及产品设计方案（03 的 C-01/C-02/C-03）。按同样的路径、署名、清单、SHA、证据与代传规范打包；非代码素材提供设计效果、来源许可及参数自验，只有实际含代码的模块要求代码测试/变异。场景几何/空间/校准归 sen；验收由各 owner 自验、jesu 统筹。以下旧步骤不新增 Gary 测试/主持验收义务。

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

### 5.6 Jesu 的对接与上传步骤（保留交付规范；当前只到本地核验）

当前禁止提交、上传、push 和创建 PR；403 未解除。本节第 4–6 步仅作未来获得明确授权后的流程参考，不能在本轮执行。代传不等于原创，Gary 保留贡献署名；若含代码须 wei 独立复核，jesu 不自批代传代码。

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
6. 获得授权后的交付须 CI 全绿、owner 自验；wei 独立复核代码，jesu 汇总最终整合审核并安排合并，不自批自己的或代传的代码。

### 5.7 代传窗口

Jesu 同时是设计 A，不能随到随传。约定：**每个整点后 10 分钟**集中处理一次；Gary 在整点前把包发给 Jesu。紧急（阻断他人开工）可随时。

## 6. 领取工作的规则

1. 先读完 `01-overview-v3.md` 与本文件，再读你角色的任务书。
2. 领取的单位是**步骤**（如 `2.1`）。领取前在群里声明"我领 2.1"，避免两人做同一件事。
3. **一人同时只开一个未合并分支**，活过 4 小时就拆小或废弃。
4. 每个 PR 必须带"故意改错 → 测试变红"的证据；改了 `contracts/` 的 PR 直接打回，除非走契约 PR。
5. 提交信息格式 `type(scope): 摘要`，正文末尾必须有 `Authored-by: ai | human | ai+human` 与 `Step: N.N`，钩子会拦。
6. **作者不批自己的 PR**：wei 的代码由 jesu 审核；jesu 的代码由 wei 独立复核；其他 owner 自验后由 jesu 统筹最终审核，wei 复核代码与技术方案。当前不执行任何提交或网络写入。

## 7. 开工第一步（历史，不执行以下旧步骤）

当前依 03 第 5 节领取：jesu INT-01/A-01（全局安排及前端），sen B-01（场景校准），Gary C-01/C-02（设计素材与材质/机器人素材），wei ENV-01/D-01（技术复核与后端）。以下旋转立方体、测试主责与旧时间安排作废，仅保留历史记录。

| 人 | 第一步 | 交付 |
| --- | --- | --- |
| **wei**（AI-D＋把关） | 跑通 `pytest` / `check_layout` / `check_contracts` / `mutation_demo` 四条命令；然后写 `server/main.py` 的 `/plan` 一个接口 + 三条测试 + 两条变异 | PR：`feat(server): 1.4 /plan 接口`（由 Jesu 批） |
| **Jesu**（A＋整合） | 起 `web/` 的 Vite 脚手架（旋转立方体）；同时做 `scene.ply` 的**三项验证**里"正交相机下渲染是否正确" | PR：`chore(web): 1.0 前端脚手架`；验证结论写回 `assets/gaussian-splat/README.md` |
| **sen**（B） | 复制 `contracts/layout.example.json` → `web/public/layouts/layout_A.json` 并跑 `check_layout.py`；故意改坏三处记录报错；做三项验证里"浏览器能否打开 `scene.ply`、帧率多少" | PR：`feat(scene): 0.2 layout_A 与校验证据` |
| **Gary**（C） | 通读 `docs/test-cases.md`，把十条用例的"期望日志"对一遍 `events.md`；做 HUD 的静态假数据版 | 交付包 `gary_0-2_<时间>.zip`（核对意见），交 Jesu |

## 8. 待确认事项

当前以 03 第 8 节为准：403 未解除、wei 有效账号与权限待确认、正式资源 SHA/许可与旧餐厅身份待判。下列为历史记录（包括“前端尚无代码”和账号权限结论），不作当前状态依据。

- [x] **sen 担任设计 B 已确认**（见 1 节）
- [ ] **日程重排。** 原计划基于 10/30 21:45 开工、M1 定在 10/31 12:00。现在是 10/31 上午，前端尚无代码，素材与渲染路线还没验证，M1 按原时间**不可能达成**。需要 wei 与 Jesu 按相对工期重排，并重新核对提交截止（原定 11/1 10:30）
- [ ] 是否把文档与代码里的 "小方 / HomeTwin" 全量改成 "小觅 / HOME"（目前只做了命名对照和唤醒词兼容）
- [x] **场景路线已定（Jesu 10/31 确认）：以高斯泼溅素材为准，不做灰盒。** 总览「修订 1」与设计 B 任务书已同步改写
- [ ] **高斯泼溅素材 `scene.ply` 的三项验证**（浏览器能否渲染 / 正交相机下是否排序出错 / 帧率）：**Jesu 与 sen 共同做**，结论写回 `assets/gaussian-splat/README.md`，在此之前不要改 `layout_A.json` 的坐标。详见 [`../assets/gaussian-splat/README.md`](../assets/gaussian-splat/README.md)
- [x] `scene.ply` 授权：Jesu 已确认为开源素材（具体许可证条款待补进 `manifest.json`）
- [x] 原始文件已在 Release `splat-v1`（2026-10-31 核对：471,149,518 字节，sha256 `901cf8ce…2678fae` 与本地一致）。下载：`gh release download splat-v1 -p scene.ply --repo Grip1122/hometwin`
- [x] wei 与 sen 的 GitHub 用户名，邀请已被接受；`CODEOWNERS` 已换成真实用户名
