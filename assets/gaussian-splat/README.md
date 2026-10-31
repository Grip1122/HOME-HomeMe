# 餐厅高斯泼溅素材（sen 交付）

当前选用**原版「天安骏业集团餐厅」scene.ply**。沿用高斯视觉层 + layout 逻辑与碰撞层的方案，不做灰盒。本次只交付素材说明、指纹、截图与验证结论，尚未宣称项目场景集成完成。

## 版本辨识

| 项目 | 本次餐厅原版 | 历史建筑素材 |
|---|---|---|
| 清单 ID | scene_restaurant（当前） | scene_main（归档） |
| 文件名 | scene.ply | scene.ply |
| 大小 | 235,796,393 字节（约 224.87 MiB） | 471,149,518 字节 |
| 高斯点数 | 999,131 | 1,996,390 |
| SHA256 | db3ff012934704ba8787f82464bdc7b1db21760281189274626914a2800efb28 | 901cf8ce0be73706d6ab0f2649e4f7520def2ee4342a30bca984b55ce2678fae |
| Release | [splat-restaurant-v1](https://github.com/Grip1122/HOME-HomeMe/releases/tag/splat-restaurant-v1)，**原始附件已上传并校验** | [splat-v1](https://github.com/Grip1122/HOME-HomeMe/releases/tag/splat-v1) |

两个同名文件不是同一场景。旧 Release 保留追溯；仓库内 reference/ 中的餐厅参考数据及其他交付文档，不能代替按当前清单核对文件版本。

## 原始文件存放

原版 PLY 超过普通 Git 单文件限制，代码目录只保存清单和证据。原始附件已发布于 [splat-restaurant-v1](https://github.com/Grip1122/HOME-HomeMe/releases/tag/splat-restaurant-v1)。2026-10-31 已核对 GitHub 报告的文件大小（235,796,393 字节）和SHA256，均与本地原版一致。

[下载原版 scene.ply](https://github.com/Grip1122/HOME-HomeMe/releases/download/splat-restaurant-v1/scene.ply)。manifest.json 的 external_copy 与 release.status 已更新。

取得文件后核对 scene.ply.sha256，并放在本地 assets/gaussian-splat/scene.ply（已被 .gitignore 排除）。80万、50万点抽样版本均未选为最终素材，不需上传。

## 格式与坐标

- PLY binary_little_endian 1.0，三阶球谐，每点59个float（236字节）。文件长度符合声明，未发现NaN/Infinity。
- 截图所见 SuperSplat 变换：位置(0,0,0)、旋转XYZ(0°,0°,180°)、缩放1。原始文件未被改写；项目中须核对导入器是否另做轴转换，不直接叠加到现有 scene-transform.js。
- sen 确认尺寸测量正确；具体参照物和读数尚未附入，因此不伪造数值标定结果。
- 截图2为斜俯视，尚不足以验证完整平面布局或固定45°正交投影。项目相机、几何体遮挡与 layout 坐标对齐仍需与 Jesu 联调。

## 验证与帧率取舍

| 版本/设置 | sen 报告的拖动帧率 | 外观与决定 |
|---|---|---|
| 原版，初始设置 | 约18 FPS | 场景可辨，保留原始基线 |
| 原版，SH Bands 1/0 | 合并记录22–27 FPS | 没有每档独立值，不擅自拆分 |
| 80万点抽样版 | 未提供具体值，优化不明显 | 无明显破洞，不选用 |
| 50万点抽样版 | 约28 FPS | 明显破洞，不选用 |

设备为sen报告的1650显卡，完整浏览器/视口/随机透明设置未留档，不能将这些结果当作受控提速比例。详情见 [验证数据](restaurant_validation.json) 和 [选型决定](scene_decision.md)。

**sen 已决定取消本素材的30 FPS硬门槛，以原版画质、加载稳定和固定演示视角可用性为主；帧率如实记录，最终在路演电脑复测。** 这项调整通过本交付PR供整合与验收人同步，不修改全项目其他模块的性能标准。

## 截图

- [总览](shots/overview.png)
- [斜俯视](shots/oblique_view.png)
- [地面近景1](shots/detail_floor_01.png)
- [地面近景2](shots/detail_floor_02.png)

网格相关黑线已由sen检查确认无问题。截图仅证明所示编辑器状态，不作为项目正交/碰撞测试通过的证据。

## 后续集成

1. 取得与清单哈希一致的原版，接入渲染器并复现正确坐标。
2. 补数值标定依据，按真实场景调整 layout 实例；contracts/ 保持只读。
3. 添加隐形家具碰撞体、台面、通行区和8件任务物体。
4. 与Jesu核对既有坐标模块及固定正交相机；全部通过后再更新对应验证状态。

## 许可与署名

天安骏业集团餐厅 — **Hilo（heroizme）**。

[原作](https://superspl.at/scene/40c67340) · [作者](https://superspl.at/user/heroizme) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)。保留作者、来源与许可证；发布派生版本时注明实际变换、裁剪或压缩。当前交付选用原始PLY，编辑器显示变换与未采用的抽点试验分别留档。
