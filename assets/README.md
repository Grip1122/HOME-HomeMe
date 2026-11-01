# assets · 素材总索引

> **新增、替换或引用素材前先查此表。** 同一素材只保留一个权威路径；每项资源须写明体积、来源/使用范围和校验方式。

## 资源清单

| 素材 | 仓库路径 | Git 状态 | 体积 | 用途 / 获取方式 |
| --- | --- | --- | --- | --- |
| 餐厅高斯溅射演示模型 | `web/public/robot-find/models/restaurant.splat` | ✅ | 31.4 MB | 小觅HOME 餐厅实景查看器，克隆即得 |
| 餐厅布局、语义与导航数据 | `web/public/layouts/layout_restaurant.json`、`web/public/scene-data/` | ✅ | 小型 JSON | 餐厅空间适配与后续语义导航整合 |
| RS-01 履带机器人主模型 | `assets/robot/roomscan-rs01.glb` | ✅ | 340 KiB | 克隆即得 |
| RS-01 节点与运动清单 | `assets/robot/manifest.json` | ✅ | 16 KiB | 机器人运动代码的校验依据 |
| RS-01 变体、网格和来源 | `assets/robot/variants/`、`assets/robot/meshes/`、`assets/robot/source/` | ✅ | 约 3 MiB | 克隆即得，详见 [`robot/README.md`](robot/README.md) |
| 建筑主场景高斯资产 | `assets/gaussian-splat/scene.ply` | ❌ | 449 MiB | 超出 GitHub 单文件上限；按 [`gaussian-splat/README.md`](gaussian-splat/README.md) 获取并校验 |
| 主场景轻量预览 | `server/delivery/team-scene/home-preview.compressed.ply` | ✅ | 2.1 MiB | 克隆即得 |
| Hackerson 完整原工程备份 | GitHub Release | ❌ | 107 MiB | Release `d-roomscan-source-20261031`，附逐文件 SHA-256 清单 |
| 参考实现归档 | `reference/hackerson/` | ✅ | 约 12 MiB | 只读参考，不进入产品运行路径 |

## 校验信息

| 文件 | SHA-256 |
| --- | --- |
| `web/public/robot-find/models/restaurant.splat` | `18731c2cbdcd11a3c3ece79555fdcd4c4e916304af30a88180b17d9a67ad3b6b` |
| `assets/gaussian-splat/scene.ply` | `901cf8ce0be73706d6ab0f2649e4f7520def2ee4342a30bca984b55ce2678fae` |
| `server/delivery/team-scene/home-preview.compressed.ply` | `b9a5a013433331d37d1f8e157e43a3301bc9dc84f2f3aa2a5b880d396718f884` |

## 管理规则

1. **先索引、后落位**：新增资源前先确认没有已有等价素材；写入本表后再接入代码。
2. **普通 Git 单文件不超过 100 MB**：超限文件使用 Release、网盘或团队共享路径，并记录 SHA-256 与获取方式。
3. **运行路径和参考路径分离**：`reference/` 只读；需要复用逻辑时抽取到 `web/src/` 或 `server/` 并补测试。
4. **餐厅素材边界清晰**：`restaurant.splat` 已随演示交付；餐厅 JSON 是后续整合的语义/导航数据，不能据此宣称主找物流程已接入餐厅坐标。
5. **变更机器人几何时同步验证**：改动 `assets/robot/` 后，需检查 `web/src/robot/kinematics.js` 与 `manifest.json` 的一致性测试。