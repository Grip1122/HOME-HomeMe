# Hackerson 交付包 · 整合落位说明

> 交付人：AI-D（wei）｜代传与整合：Jesu｜日期：2026-10-31｜分支 `feat/1-0-hackerson-integration`
> 原始包：`Hackerson.zip`（7606 文件 / 996.7 MB）｜归档：`reference/hackerson/`（86 文件 / 12 MB）

## 1. 一句话结论

交付包**没有整体并进 `server/` 或 `web/`**，因为它是另一套运行环境（MuJoCo + EGL，Ubuntu）。
本次做的是**拆解 + 落位 + 对齐**：能测的数值逻辑搬进产品代码并补上测试，不能跑的整体归档只读，
超过 GitHub 上限的资产不入库，场景按 Jesu 的决定统一到队友那份。

| 结果 | 数字 |
| --- | --- |
| 新增前端模块 | 5 个（寻路 2、运动学 2、坐标标定 1），模块本身不依赖任何库 |
| 新增测试 | 前端 44 条（vitest）+ 后端 3 条（pytest）；并入脚手架后前端共 48 条 |
| 后端测试总数 | 70 → 73，全绿 |
| 入库文件 | 86 归档 + 70 机器人资产 + 5 模块 + 6 测试 + 3 文档 |
| 未入库体积 | 约 940 MB（依赖、临时产物、超限二进制） |

## 2. 落位表

| 分工 | 目录 | 本次落了什么 | 状态 |
| --- | --- | --- | --- |
| **AI-D** | `reference/hackerson/` | `scanner/`（扫描引擎 / 建图 / NBV / 餐厅适配）、`scripts/`、`tests/`、`run.py`、六份 zh-CN 文档、QA 记录 | 归档只读，**未接入 `server/`** |
| **AI-D** | `scripts/gen_nav_fixture.py` | 从 `layoutlib.py` 生成前端寻路快照 | 新增 |
| **AI-D** | `tests/test_nav_fixture.py` | 快照不过期守护（布局一改就红） | 新增 |
| **设计 A** | `web/src/robot/kinematics.js` | 四节杆行程、差速履带、履带节轮廓定位、俯仰限位 | 新增 + 13 条测试 |
| **设计 A** | `web/src/robot/pose-buffer.js` | 权威位姿插值（断流不外推、跨 ±π 最短转、换场景重置） | 新增 + 7 条测试 |
| **设计 A / D** | `web/src/nav/grid.js` `astar.js` | 与 `layoutlib.py` **同规则**的网格、门洞、可达集、A* 与视线拉直 | 新增 + 16 条测试 |
| **设计 B** | `assets/robot/` | RS-01 GLB、部件清单、MuJoCo 网格、Create 3 上游许可 | 新增（原样迁入） |
| **设计 B** | `web/src/scene/scene-transform.js` | 高斯素材三层坐标换算、尺度标定、ROI 转仿真包围盒 | 新增 + 8 条测试 |
| **设计 C** | — | 交付包里没有 UI 成果可搬（Hackerson 的控制面板与 C 的 HUD 是两套信息结构） | 无变化 |
| **整合** | `reference/README.md`、本文件、`.gitignore`、`CODEOWNERS` | 归档规则、落位说明、超限资产排除 | 新增 |

> 目录边界按 `team/02-roles.md` 执行。唯一越界的是 `web/src/nav/`：任务书步骤 1.3 明确写了
> 「**你写**：网格模块……**设计 A 写**：行走插值、转身、路径虚线」，所以 `nav/grid.js` 归 AI-D，
> 这次一并落地，A 只负责把路径渲染出来。

## 3. 三处真正的「结合」，不是搬文件

### 3.1 寻路：前后端同一套规则，用快照对账

Hackerson 的 `Navigation` 用的是自己的 16 cm 网格、任意多边形安全判定；hometwin 的契约是
24×18 / 0.5 m 网格 + 门洞连通。两者不能混。做法：

```
server/app/layoutlib.py  ──gen_nav_fixture.py──▶  web/src/nav/__fixtures__/layout_A.nav.json
        ▲                                                    │
        │ tests/test_nav_fixture.py 防过期                     ▼
        └────────────────────────────────────  web/src/nav/grid.test.js 逐格比对
```

快照里存了三样东西：104 个阻挡格、三个分区各 328 格可达集、18 个跨分区相邻格的门洞判定。
**任何一边改了规则，另一边立刻变红**——这是任务书「同一套规则」的验收口径，不是口头承诺。

顺带修掉 Hackerson 的一个真实隐患：它按固定 3.5 cm 间距采样判断路径安全，会在门框角点上漏检。
`astar.js` 改用超覆盖（supercover）格遍历，斜向贴角直接判不可见。

### 3.2 坐标：三层坐标不再靠口头传承

`assets/gaussian-splat/README.md` 写着「单位未定、y 轴未验证」。Hackerson 已经踩完了这条路，
结论收进 `web/src/scene/scene-transform.js`：

| 层 | 用途 | 换算 |
| --- | --- | --- |
| 原始重建坐标（PLY） | 高斯点云 | — |
| 仿真坐标（米、y 向上） | `layout_A.json`、寻路、记忆 | `[x, z, -y + 0.07]` |
| 渲染坐标（three.js） | 相机、机器人 | `[x, 0, -z]` |

`calibrateScale(units, meters)` 强制要求两个正数：**没量过就抛异常，不会静默当成 1 米**。
这一条是给设计 B 的：`scene.ply` 的缩放系数目前仍然是猜的。

### 3.3 运动学：把渲染耦合剥掉，才测得了

`web/robot.mjs` 的 `update()` 直接操作 PlayCanvas 节点，没法在 Node 里测。剥离后：

- `mastStageOffsets(height)` — 四节行程，合计高度必须等于目标高度（有断言）
- `treadTravel(prev, next)` — 差速分解，原地转向时左右反向（有断言）
- `treadLinkPoses(profile, offset)` — 84 块履带节沿闭合轮廓定位，按周长回绕（有断言）

渲染层只负责把结果抄到节点上，见 `assets/robot/README.md` 第 3 节。

## 4. 没有上传的东西（逐项理由）

| 项 | 体积 | 为什么 | 谁去补 |
| --- | --- | --- | --- |
| `Hackerson天安骏业集团餐厅.zip` | 224.9 MB | Jesu 明确不上传；且中文文件名违反团队 5.2 命名规则 | 不需要 |
| `assets/restaurant/scene.ply` | 224.9 MB | 与上面同一份场景，单文件超 GitHub 100 MB 上限 | 已由 `assets/gaussian-splat/scene.ply` 替代（Release `splat-v1`） |
| `assets/restaurant/*.ply/*.obj` | 约 175 MB | 从 `scene.ply` 派生，可重跑 `prepare_restaurant.py` 重建 | 设计 B 如需代理网格，从 Release 取原始 `scene.ply` 重跑 |
| `tools/splat/node_modules/` | 265 MB | npm 依赖 | `npm install --prefix tools/splat` |
| `tools/python/` | 41 MB | 便携 Python 依赖 | `pip install --target tools/python` |
| `artifacts/runs/`、`*.npy` | 31 MB | 扫描临时产物 | 重跑即可生成 |

> 「保证全部上传」在 GitHub 上做不到 100%：单文件 >100 MB 会被服务端直接拒绝，Git LFS 免费额度
> 只有 1 GB 且不适合静态素材。所以采用团队已有的做法——**源码与文档全量入库，超限资产走 Release**。
> 归档说明里的差异表可以逐项对账，没有静默丢文件。

## 5. 各分工接下来要做什么

### AI-D（wei）

1. `reference/hackerson/scanner/restaurant.py` 仍指向已排除的 `assets/restaurant/*.ply`，要改指向统一场景才跑得起来。**本次没动**（归档只读）。
2. 若要把「扫描建图」真正并进 `server/`：`mapping.py` 的体素射线更新 + `planner.py` 的收益公式是纯数值，可以去掉 numpy 重写成 stdlib 版，接 `/memory` 的 `source=rescan`。**需要先加测试，再登记变异**。
3. 步骤 1.4 的 `/plan` HTTP 接口仍未写——本次交付包不含它。

### 设计 A（Jesu）

1. 步骤 1.1 的脚手架已 rebase 到 main 之上：`web/package.json` 归 Vite + vitest，本次新增的 44 条测试已改为 `import { test } from 'vitest'`，与脚手架的 4 条同跑（共 48 条）。
2. `nav/astar.js` 输出的 `cells` 还是格子下标，接渲染时需要 `cellsToWorld()` 转米制坐标，再加行走插值与路径虚线（任务书 1.3 明确这部分归 A）。

### 设计 B（sen）

1. `assets/robot/` 已入库，先确认 GLB 在浏览器里加载正常、84 块履带节找得到。
2. 用 `calibrateScale()` 量一处已知尺寸，把 `scene.ply` 的缩放系数定下来——**这是 `layout_A.json` 坐标能不能信的前提**。
3. 机器人接地阴影与摄影棚环境贴图（`reference/hackerson/web/robot.mjs` 的 `studioReflections` 是程序化生成，不依赖 HDR，可直接抄思路）。

### 设计 C（Gary）

本次无变化。Hackerson 的控制面板（覆盖率曲线、四路环视、三视图切换）信息结构和 C 的 HUD 不同，
**不建议合并**；如需参考，看 `reference/hackerson/web/index.html`。

## 6. 验收

```bash
python -m pytest -q                      # 73 条，含 3 条寻路快照守护
python scripts/check_layout.py           # 零错误
python scripts/check_contracts.py        # 契约闸门通过
python scripts/gen_nav_fixture.py --check  # 快照未过期
cd web && npm ci && npm test             # 48 条（脚手架 4 + 本次 44）
```

**失败演示**（证明测试真的会红）：

```bash
# 1) 把后端外扩半径改大 1 cm —— 前后端「同一套规则」的约定被破坏
python - <<'PY'
import pathlib
p = pathlib.Path("server/app/layoutlib.py")
p.write_text(p.read_text(encoding="utf-8").replace("ROBOT_RADIUS = 0.25", "ROBOT_RADIUS = 0.26"), encoding="utf-8")
PY
python scripts/gen_nav_fixture.py         # 快照变化：阻挡格变多
cd web && npm test                        # grid.test.js 逐格比对失败（红）
cd ..
python scripts/gen_nav_fixture.py --check # 未重生成时也会红
git checkout -- server/app/layoutlib.py web/src/nav/__fixtures__/   # 还原
```

## 7. 风险

| 风险 | 影响 | 处置 |
| --- | --- | --- |
| 归档 12 MB 进了 git 历史 | 仓库变大，clone 变慢 | 可接受；真要清理用 `git filter-repo` 摘掉 `reference/` |
| 测试脚手架曾有两套（整合方 `node --test` / 设计 A `vitest`） | 同目录两个 `package.json` 必然冲突 | 已统一到 vitest：脚手架的 PR #6 rebase 到 main，44 条测试改了 import，48 条同跑 |
| 两份机器人参数（`manifest.json` 与 `kinematics.js` 常量） | 改一处忘另一处 | `kinematics.test.js` 直接读 `manifest.json` 断言 `links_per_side` 与轮廓周长 |
| 场景仍是两套（hometwin 的 `scene.ply` / Hackerson 的餐厅） | 视觉与坐标对不上 | 本次已定：**唯一源 = `assets/gaussian-splat/scene.ply`**，Hackerson 的餐厅版本不再维护 |
