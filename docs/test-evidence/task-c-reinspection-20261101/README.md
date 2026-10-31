# Task C 复检补充（2026-11-01）

结论仍为分项有条件交付，不认定 Task C 完成，不批准合并。

## 本次修复与证据

实际 A 总线位于 PR #20 的 web/src/core/eventbus.js，on() 返回退订函数，没有 off()。原 HUD 销毁逻辑依赖 off()，导致销毁后继续响应。hud.js 现在为每个 HUD 保存自己的退订函数，兼容原预览总线；销毁一份不会移除另一份的监听。

实际 A 执行器的 task:end.steps 包括尝试执行的失败步骤。原 HUD 首步失败仍按1/1显示100%。status/timeline 优先使用已观察到的成功 task:step 计数；没有步骤事件时保留旧载荷降级行为。另补 source=script 的中文标签。

- 六个 HUD 测试文件、28条测试通过（含5条回归）；[原始组合检查失败记录](red-results.json)。
- [真实总线/执行器/餐厅布局/模型/HUD组合结果](candidate-results.json)：四项通过。37个基线源码逐字节匹配固定提交，允许的 HUD 补丁另列；未复制一份假总线来冒充。
- [餐厅浏览器事件记录](browser-results.json)及[截图](restaurant-abc.png)：沿用现有 B 联调页，本地装配真实 A+C 模块、新 GLB 和原版999131高斯餐厅，正交45°，五动作与抓放检查通过。未新建独立产品入口，未声称主页面已接线。
- 当前 WebGL 设备为 Intel UHD Graphics630，实测约15.4FPS；这不是1650独显成绩，不迁移旧建筑或SuperSplat帧率。
- [executor-adapter.mjs](executor-adapter.mjs)把原始GLB交给A的createRobot，只有一个由A配置定义的carryAnchor [0,.55,.4]；三维世界坐标保持，杯子最终Y=.8164929297566415=台面top+halfH。旧RF包装器的[0,.624,.36]不能直接当同一接口，也不能两套嵌套。GLTFLoader、模型、场景和A执行器使用同一Three实例。
- 模型作者sen明确自建并授权仅HOME项目使用及本库分发，见PR#27 [授权记录](https://github.com/Grip1122/HOME-HomeMe/blob/feat/robot-fbx-v1/docs/task-c/robot-fbx-20261101/model-usage.md)；不是MIT/CC通用开源素材。

## 复现

将A PR#20、B PR#23、C PR#7的本轮HUD补丁在独立检出中装配；须安装web项目依赖并有jsdom。仅在已包含A/B模块的检出运行，缺依赖应失败，不得skip后写通过。

`node docs/test-evidence/task-c-reinspection-20261101/verify-candidate.mjs <组合检出根目录> <robot-web.glb绝对路径> <结果JSON路径>`

输入资产为PR#27的SHA f5dcae49c12905548eb59b9d2960ce36920f3088afc374275074bad0109276e2。Node检查图片解码用桩，不据此宣称贴图像素/GPU/FPS通过；实际贴图与点云来自另列的浏览器记录。输入计划是固定验证计划，不代表自然语言/后端/plan接口已打通。

## 仍待正式验收

Jesu将组合候选装到实际产品入口，处理单写文件和版本配对；目标1650独显、正式浏览器与1366/1920视口复测；审核实际餐厅叠加、性能和抓放画面。单网格不具备独立头/杆/轮/机械抓取动画，需明确五动作验收是否仅要求逻辑闭环。Blender草稿排除可用建模程序验收，保留历史材料，不运行/不当作新机器人源工程。旧建筑来源及4个候选剔除理由是独立遗留项，不能用自建机器人授权补齐。

## 两档桌面视口

1366×768：左右侧栏各286.94px，约21.01%；1920×1080：各312px，16.25%，均≤22%。两档均完成真实餐厅五动作，记录见 [viewport-results.json](viewport-results.json) 和 [1920事件记录](browser-1920.json)，[1920截图](restaurant-1920.png)。

两档当前核显环境平均FPS分别约15.4 / 12.3。只作为本次组合候选的实测，不作为1650独显或生产主入口性能验收。验证装配把原B页全局aside选择器限制到body>aside，避免覆盖HUD左右侧栏定位；没有修改B源场景或新增正式入口。

## 模型尺寸与碰撞半径配对

A侧适配器传入 maxRadius: ROBOT_RADIUS=0.25，按真实网格顶点等比限缩：名义高度上限1.2m，实际显示约0.827206m，渲染外轮廓半径约0.25m。验证器独立遍历变换后的顶点再次检查半径，避免只比较元数据。该参数不改原FBX/GLB字节；旧RF演示1.2m配置不作为A侧碰撞通过依据。

本次使用A的createLocalMemory离线内存实现，未验证SQLite/SD卡持久化。HUD保留的存储文案不构成后端或硬件存储证据。
