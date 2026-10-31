# Task C 交付材料索引（C-01 / C-02）

本目录是本轮 Task C 的全部交付物。母版为 `robot-find` 实景找物演示，所有参数均从运行代码中提取。

## 文件

| 文件 | 对应任务项 | 内容 |
| --- | --- | --- |
| [C-01_UI流程与状态设计稿.md](c-01-ui-flow-states.md) | C-01 | 屏幕三层结构、主流程状态机、13 个状态定义、失败与空数据设计、相机预设、文案规范 |
| [C-02_素材_节点限位_锚点_材质_渲染参数.md](c-02-assets-rig-rendering.md) | C-02 | 机器人 12 节点尺寸表、节点限位、5 个锚点、8 件任务物件表、材质参数、渲染参数 |
| [manifest.json](manifest.json) | C-01 + C-02 | 19 个文件的来源 / 许可 / 字节数 / 完整 SHA-256，以及全局比例与上轴约定 |

## 全局约定（摘要）

- 单位米，比例 **1:1**，上轴 **+Y**，前向 +Z，右手系，地面 y=0。
- 源扫描为 Y-down，转换时绕 X 轴 180° 烘焙进顶点与四元数，运行时场景旋转为单位四元数。
- 源→世界：`world = (src.x + 0.35, −src.y + 0.03 + lift, −src.z − 0.30)`。

## 仓库路径与资源位置

本目录位于 `docs/task-c/robot-find-20261031/`。C-01、C-02 正文保持原始字节，仅规范文件名；`README(1).md` 改为本索引 `README.md`。

`manifest.json` 的 `files[].path` 保留原交付路径；新增 `repositoryMapping` 说明两份文档的仓库路径，以及其余资源相对于原型 ZIP 根目录的路径。

原型代码、模型和四张截图均在 [Gary 完整交付归档](https://github.com/Grip1122/HOME-HomeMe/releases/tag/gary-delivery-20261031) 的 `gary-robot-find-20261031.zip` 中（解压根目录 `gary-robot-find-20261031/`），SHA256：`007607b3e1a44c1184c2aea8709bbf8bc2451bdfb14430a83cf4e3b079459660`。不要在正式仓库根目录寻找原型的 `src/scene-find.js` 或 `assets/models/scene.splat`。

## 校验记录与适用范围

本次独立核对清单中的 19 项：两份文档与 17 项已归档原型资源，字节数和 SHA256 全部相符，失败 0 项。未重新验收文档中的功能、导航安全、尺寸实测或性能结论。

原索引列出的 `tools/verify-manifest.ps1` 和 `tools/hash-manifest.ps1` 不在本次四文件或已收到的原型包中，因此不作为本仓库的可运行入口。原作者的验证命令说明仍保留在 manifest.global.verify 中，仅作来源记录。

本文描述的是旧建筑实景原型（1,555,624 splats、透视相机、独立坐标变换），不替代餐厅 world adapter、45° 正交相机、碰撞层或正式机器人验收。文中的限制、建议值与许可声明按原作者记录保留。

## 需要验收方注意的三点

1. **位图贴图当前不存在。** 机器人为纯色 PBR 材质（color + roughness + metalness + emissive），没有 albedo / normal / roughness / AO 贴图文件。材质参数已完整交付，但贴图文件无法附来源 / 许可 / 大小 / SHA-256，因为它们尚未制作。若本项必须交付位图，请先定材质方向。
2. **`assets/models/scene.splat`（49,779,968 B）未重复打包**，它已随 `robot-find_实景找物_20261031.zip` 交付；manifest 中登记了其 SHA-256 `05755d69…95f2` 以便比对。源 `scene.ply`（449 MB）同样仅登记校验值。
3. **物件名是几何 + 颜色描述**（如「黑色大长方体物体」），不是语义标签。这是离线几何聚类的真实输出，语义化需另引入模型。

## 不在本轮范围

- 真实事件总线 / 真实场景 / 真实执行器的集成验收（等餐厅 world 与执行器接通）。
- 旧 HUD / PR #7 的结论不计入本轮 Task C。
- C-03 材质优化对比与路演视觉，待真实日志样例。
- 全局测试与验收主责。

## 复核补充材料

见 [review-followup.md](review-followup.md)：原始场景来源/许可确认与 SHA、12→8 候选对照、原型资产/节点/限位/锚点/材质清单，以及新四视图和 Blender 草稿的实际状态。该记录保留待补证项，不作为 C-01/C-02 已关单的声明。

2026-11-01 更新：用户已指定新 FBX；新模型、两张贴图及替换版另行交付，见 [模型交付记录](https://github.com/Grip1122/HOME-HomeMe/tree/feat/robot-fbx-v1/docs/task-c/robot-fbx-20261101)。本目录原始构造器清单描述的是未改动的 20261031 归档版本。

模型替换审核： https://github.com/Grip1122/HOME-HomeMe/pull/27（待审核合并）。
