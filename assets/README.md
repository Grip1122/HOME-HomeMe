# assets · 素材总索引

> **找素材先看这里。** 每样素材在仓库里只放一份；超过 GitHub 单文件上限的放 Release，这里给拉取命令和校验和。
> 归属：设计 B（场景与美术）＋ Jesu 共管（`.github/CODEOWNERS` 的 `/assets/`）。

## 1. 一览

| 素材 | 仓库路径 | 在 Git 里？ | 体积 | 怎么拿 | 详情 |
| --- | --- | --- | --- | --- | --- |
| RS-01 履带机器人（主模型） | `assets/robot/roomscan-rs01.glb` | ✅ | 340 KiB | 克隆即得 | [robot/README.md](robot/README.md) |
| RS-01 部件清单（节点名、履带参数） | `assets/robot/manifest.json` | ✅ | 16 KiB | 克隆即得 | 同上 |
| RS-01 Create 3 底盘变体 | `assets/robot/variants/` | ✅ | 560 KiB | 克隆即得 | 同上 |
| RS-01 MuJoCo 分材质网格 | `assets/robot/meshes/` | ✅ | 960 KiB | 克隆即得 | 同上 |
| Create 3 上游源文件与许可 | `assets/robot/source/create3/` | ✅ | 1.5 MiB | 克隆即得 | 同上 |
| 建筑高斯泼溅（主场景 `scene_main`） | `assets/gaussian-splat/scene.ply` | ❌ 超限 | 449 MiB | `python scripts/fetch_team_scene.py`（下载并校验） | [gaussian-splat/README.md](gaussian-splat/README.md) |
| 主场景轻量预览（裁剪＋28% 采样） | `server/delivery/team-scene/home-preview.compressed.ply` | ✅ | 2.1 MiB | 克隆即得 | `server/delivery/team-scene/preview-manifest.json` |
| Hackerson 原工程完整备份（6712 文件） | — | ❌ 超限 | 107 MiB | Release [`d-roomscan-source-20261031`](https://github.com/Grip1122/HOME-HomeMe/releases/tag/d-roomscan-source-20261031) | 附件 `*.manifest.json` 是逐文件 sha256 清单 |
| Hackerson 源码、文档、QA 截图（只读归档） | `reference/hackerson/` | ✅ | 12 MiB | 克隆即得 | [reference/README.md](../reference/README.md) |

**不在仓库里、也不要再传的**：原「天安骏业集团餐厅」场景包及其转换产物（用户明确排除，以队友的 `scene_main` 代替）。

## 2. 校验和

| 文件 | sha256 |
| --- | --- |
| `scene.ply` | `901cf8ce0be73706d6ab0f2649e4f7520def2ee4342a30bca984b55ce2678fae` |
| `home-preview.compressed.ply` | `b9a5a013433331d37d1f8e157e43a3301bc9dc84f2f3aa2a5b880d396718f884` |
| `hackerson-d-delivery.tar.gz` | `f0fc6083a66bdb219b135e17a3105de0c7b0444115a27c01de67facf382a518b` |

## 3. 给 agent 的规则

1. **先查这张表再新增素材。** 已有的东西不要换个目录再放一份；需要在别处用，就引用这里的路径（后端预览页通过 `/delivery/assets/` 挂载本目录，不复制）。
2. **超过 50 MiB 的文件不进 Git**：上传 Release，在本表加一行，写清 sha256 和拉取方式。
3. **`reference/` 只读**：要复用里面的逻辑，抽成纯函数放进 `web/src/` 或 `server/` 并写测试。
4. 改了 `robot/` 的几何，要同步 `web/src/robot/kinematics.js` 的常量（有测试比对 `manifest.json`）。
