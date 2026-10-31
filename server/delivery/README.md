# HOME / 小觅：机器人资源交接

本目录是 D 提供给 A/B/C 的交接索引，正式项目名统一为 **HOME / 小觅**。机器人资产已由 PR #9 纳入 `assets/robot/`，不重复导入 GLB、OBJ、上游源码、依赖副本或高斯二进制。

| 负责人 | 唯一资源位置 | 下一步 |
|---|---|---|
| A / Jesu | `web/src/robot/kinematics.js`、`pose-buffer.js`、`assets/robot/roomscan-rs01.glb` | 接正式状态机、事件总线与 GLTFLoader；独立预览不提供业务动作 |
| B / sen | `assets/robot/manifest.json`、`assets/gaussian-splat/manifest.json` | 机器人材质/接地与场景尺度、轴向和 layout 对齐 |
| C / Gary | `assets/robot/README.md`、本目录预览 | 接 HUD、标签和演示验收；不复用历史扫描界面冒充正式 HUD |
| D / wei | HTTP/SQLite、下载打包工具、实验入口各自独立 PR | 提供接口与失败边界；由 Jesu 审核，作者不自审 |

## Windows 资源预览

Python 3.11+；Node.js 24（以 web/.nvmrc 为准，与 Jesu 的 PR #10 一致）。命令均从仓库根目录执行，无本机绝对路径：

```powershell
npm --prefix web ci
py -3.11 -m http.server 8767 --bind 127.0.0.1
```

Linux / macOS 用 `python3 -m http.server 8767 --bind 127.0.0.1`。打开 http://127.0.0.1:8767/server/delivery/robot.html 。这是单独的静态资产预览，无后端、无场景、无新依赖，复用已安装的 three.js 和 A 已合入的运动学函数。Ctrl+C 停止服务。不是正式产品入口。

缺少 GLB/manifest 时明确显示资源路径；缺少依赖时提示先运行 npm ci。预览不会下载第三方场景或回退为伪造场景。正式启动方式仍看项目根 README。

## 来源、许可与限制

- 当前履带造型是 D 程序化生成的项目资产，生成器见 `reference/hackerson/scripts/build_robot.py`；外观参考 WALL·E 复刻项目，未复制其程序/STL。
- `assets/robot/source/create3/` 是 iRobot Create 3 上游参考源码，适用同目录 BSD-3-Clause；当前履带模型不使用这些源模型。不能把该许可证扩展到场景或其他第三方素材。
- `reference/hackerson/` 是历史独立扫描器，Hackerson 仅为归档标识；其旧操作文档和测试数字不是 HOME 正式验收。见 [实验原型边界](EXPERIMENTAL.md)。
- 原始高斯场景来源为 [Milano Living / argenzio](https://superspl.at/scene/0131a3b9)，页面声明 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/)；基于开源素材进行优化时须保留署名、来源/许可、修改说明，限定非商业用途。本 PR 不携带/下载此场景。来源核验、摘要和下载限制由资源工具 PR 维护。
- 机器人模型无手臂、Punch/Wave 或已定义 carryAnchor；不宣称五动作完整接入。场景单位/朝上轴未标定，不宣称全房导航或 M1/M2 完成。

[完整历史交付与校验表](https://github.com/Grip1122/HOME-HomeMe/releases/tag/d-roomscan-source-20261031) 保留在 Release。该归档排除旧餐厅 ZIP 与全部旧餐厅场景数据；不再把 6,712 项清单复制到 Git。
