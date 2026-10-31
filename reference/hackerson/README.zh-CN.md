# 归档说明（Hackerson → hometwin）

> 本目录是 **AI-D 交付的原始工程**，由 Jesu 校验后代传归档。
> **只读**：不要在这里改代码；要复用就抽成纯函数搬进 `web/src/` 或 `server/`，并补测试。
> 落位对照见 [`../../docs/hackerson-integration.md`](../../docs/hackerson-integration.md)。

## 1. 这是什么

**自主升降全景扫描机器人**：扫地机形态的双履带底盘 + 四节伸缩杆 + 四向环视相机，在仿真里自主选位置 / 高度 / 俯仰，扫描房间并把 RGB-D 观测融成彩色点云与在线体素地图。

它回答的是 hometwin 里**「机器人怎么知道自己看到了什么」**这一段——目前的 `layout_A.json` 假设家具位置已知，而真实机器人得先扫一遍。

原始运行环境是 Ubuntu + MuJoCo 3.13 + NVIDIA EGL，**Windows 本地跑不起来**（`mujoco` 需要 EGL 渲染）。这也是它没有并入 `server/` 的原因之一：后端任务书第 1 条红线是「不得新增依赖」。

## 2. 与原始交付包的差异（可核对的清单）

原始包 `Hackerson.zip`（7606 个文件 / 996.7 MB）**没有**原样全量入库，逐项理由如下。任何一项都能用 `sha256` 与原始包对账。

| 原始路径 | 状态 | 去向 / 原因 |
| --- | --- | --- |
| `天安骏业集团餐厅.zip`（224.9 MB） | **未入库** | Jesu 明确「这个场景不上传，改用仓库里队友的素材」 |
| `assets/restaurant/scene.ply`（224.9 MB） | **未入库** | 与上面那个 zip 是同一份场景；单文件超 GitHub 100 MB 上限 |
| `assets/restaurant/*.ply / *.obj`（约 175 MB） | **未入库** | 由 `scene.ply` 派生的裁剪 / 压缩 / 代理网格；同样超限，重跑 `scripts/prepare_restaurant.py` 可重建 |
| `tools/splat/node_modules/`（265 MB / 5377 文件） | **未入库** | npm 依赖，`npm install --prefix tools/splat` 还原 |
| `tools/python/`（41 MB / 859 文件） | **未入库** | 便携式 Python 依赖，`pip install --target tools/python` 还原 |
| `tools/create3_sim/`（10 MB） | **未入库** | 上游 iRobot 模型的原始包；许可证副本见 `assets/robot/CREATE3-LICENSE.txt` |
| `artifacts/runs/`（26 MB） | **未入库** | 每次扫描导出的临时产物（cloud.ply / occupancy.npz），可重跑生成 |
| `artifacts/*/*.npy`（4.9 MB） | **未入库** | 深度数组中间产物 |
| `assets/robot/**`（3.4 MB / 70 文件） | **已迁出** | 移到仓库根 `assets/robot/`（美术资产归设计 B，见该目录 README） |
| `__pycache__/`、`.pytest_cache/`、`artifacts/server.pid` | 已剔除 | 字节码与运行时垃圾 |

其余 **86 个文件 / 12 MB** 全部原样保留：`scanner/`、`web/`、`scripts/`、`tests/`、`research/`、`artifacts/` 的 QA 截图与结果 JSON、六份 zh-CN 文档。

## 3. 要在本目录复现原始工程

```bash
# 1) 把机器人资产放回原位（仓库里只有一份，在根 assets/robot/）
cp -r ../../assets/robot ./assets/robot

# 2) 恢复到能跑的状态
python3 -m pip install -r requirements.txt          # mujoco / numpy / scipy / Pillow
npm install --prefix tools/splat                    # splat-transform（餐厅转换用）
python3 -m pytest -q tests                          # 期望 10 项通过

# 3) 起服务（Ubuntu + NVIDIA EGL）
python3 scripts/service.py start
```

> Windows 上只能读代码和跑纯 Python 测试，`scripts/service.py` 会因 EGL 缺失失败。这不是缺陷，是渲染后端限制。

## 4. 哪些东西已经被搬进产品代码

| 原文件 | 搬运结果 | 说明 |
| --- | --- | --- |
| `web/robot.mjs` `update()` / `placeTrack()` | `web/src/robot/kinematics.js` | 去掉 PlayCanvas 调用，只留数值；四节杆、差速履带、履带节轮廓定位 |
| `web/motion.mjs` `PoseBuffer` | `web/src/robot/pose-buffer.js` | 时钟可注入；断流不外推的行为原样保留 |
| `scanner/world.py` `Navigation` | `web/src/nav/grid.js` + `web/src/nav/astar.js` | 与 `server/app/layoutlib.py` 对齐成同一套规则，并用快照逐格比对 |
| `scanner/world.py` `scene_xml()` 的四向相机 | `web/src/robot/kinematics.js`（俯仰限位） | 相机位姿矩阵待设计 A 在接入渲染器时补 |
| `assets/restaurant/manifest.json` 的坐标约定 | `web/src/scene/scene-transform.js` | `[x, z, -y+0.07]` 与渲染轴翻转 |

## 5. 尚未处理的遗留（诚实清单）

- **餐厅场景**：本目录的 `scanner/restaurant.py` 仍指向已被排除的 `assets/restaurant/*.ply`，直接跑会报文件缺失。场景统一到 `assets/gaussian-splat/scene.ply`（Release `splat-v1`）之后需要改一次加载路径，**未做**。
- **MuJoCo 依赖**：`scanner/` 全部依赖 `mujoco`，因此只归档、不并入 `server/`。
- **米制尺度**：餐厅资产的 1 场景单位 = 1 米是**暂定**，没有实测标定（原文档自己写明了）。hometwin 的 `layout_A.json` 用的是米制假设坐标，两者**不能直接互换**。
- **中文文件名**：原始包里的 `天安骏业集团餐厅.zip` 违反团队 5.2 命名规则（禁中文），本次直接排除，不再改名重传。
