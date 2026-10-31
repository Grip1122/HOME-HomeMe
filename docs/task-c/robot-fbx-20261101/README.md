# 新机器人模型替换（2026-11-01）

用户指定 `robot.fbx`，并确认主项目和实景找物原型都替换。主项目从现有 main 的入口接入同一个 RF.createRobot 工厂；原型的示范公寓和旧建筑实景机器人也改用该工厂。

- [网页 GLB](../../../web/public/robot-find/models/robot-web.glb)：8165032 字节、120000 三角面、78082 顶点，内嵌两张 PNG。
- [原 FBX 与原型替换包 Release](https://github.com/Grip1122/HOME-HomeMe/releases/tag/robot-fbx-v1)：保留源文件 SHA256；不覆盖 20261031 旧包。
- [来源/尺寸/能力清单](manifest.json)、[转换记录](conversion.json)、[原始结构](source-inspection.json)、[转换与加载器源码](../../../scripts/robot-model/README.md)。

原模型含 1714687 三角面，只有一个 Mesh，0 骨骼、0 动画。替换保留机器人整体移动和转向，以及找物状态/UI；不把之前 RS-01 的伸缩、俯仰、履带动画写成此网格已具备的能力。carryAnchor 是程序挂点，不能作为机械抓取绑定证据。

朝向为 Y-up；原 +X 正面通过局部 Y=-90° 对齐应用 +Z。脚底对齐 Y=0。默认高 1.2m 可在 RF.robotModelConfig 调整，**不是实测**。颜色/粗糙度为网页显示参数，原两张贴图字节未变。加载失败会显示错误，不回退旧机器人。

现有前端 9 文件197条测试通过、生产构建通过；新增 GLB/实例/姿态/失败路径2条检查通过。浏览器已完成“黑色中长条”找物闭环；截图随本目录提交。此项不代替 Task B 正交/碰撞验收或 C 真实总线集成。授权见 model-usage.md。

## 验证截图

[三面外观](model-views.png) · [主项目扫描后](main-result.png) · [实景找物完成](prototype-result.png)

附件 SHA256 见 [robot-delivery-manifest.json](robot-delivery-manifest.json)，均与 GitHub Release digest 核对一致。

## 2026-11-01 复检补充

sen 明确声明模型为本人自建，并选择“仅供 HOME 项目使用及在本仓库分发，不声明为通用开源素材”。授权仅按该原话登记，见 [model-usage.md](model-usage.md)，不套用旧 RS-01 的许可。

五动作指 find/go/grab/drop/observe 的任务逻辑，不等于五段骨骼动画。[executor-adapter.mjs](executor-adapter.mjs) 将原始 GLB 场景交给 A 的 createRobot，统一使用 A 的单一 carryAnchor [0,0.55,0.4]。旧 local-demo 包装器的 [0,0.624,0.36] 不当作同一接口；不能嵌套两套包装器。GLBLoader、场景和执行器须使用同一个 Three 实例。

组合候选验证中已运行真实 A 执行器/事件总线、B 餐厅布局和 C HUD，抓放世界坐标与台面高度通过。生产主入口仍待 Jesu 接线；单网格无独立头部/杆/轮/机械抓取动画。

A 执行器装配应传入 maxRadius: ROBOT_RADIUS（0.25m）。实际网格在名义高度1.2m时水平外轮廓半径约0.362667m，超过寻路半径；适配器按真实顶点计算并等比限缩，显示高度约0.827206m、外轮廓半径0.25m。原FBX/GLB字节与造型比例保持不变。旧RF本地演示的1.2m展示配置不作为A侧碰撞通过依据。
