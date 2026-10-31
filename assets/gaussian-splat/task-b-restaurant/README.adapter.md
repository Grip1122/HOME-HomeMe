# 餐厅 world adapter 补交记录

本次补 PR #23 的 A/B 接口差异，保留原 layout、99 个碰撞代理、14 个台面、点云坐标配置和 8 件任务物体；没有新增独立验证页面，也没有修改 A/D/contracts。

## 接口

[world-adapter.md](../../../web/src/scene/world-adapter.md) 是本轮明确的接入约定：createRestaurantScene 的返回值可直接作为 A 的 ctx.world。提供 getFurniture/getObject/worldPos/objectsInRoom/roomOf、rooms/furniture/objects Map，以及家具 box/surface/top 和任务物体 halfH。B 的旧调试接口保留。

实现对照 A PR #20 `1499b6a420219c9788e2cc8eac0384464de78edb`；A 源码快照指纹见 [a-source-lock.json](a-source-lock.json)。这里只上传 B 的改动，不把 A 的文件复制进 B 分支。

## 三类证据

1. [restaurant-adapter-45.png](restaurant-adapter-45.png)：原版餐厅 999131 高斯与 layout 同坐标叠加，实算正交俯角 45°。橙线为 99 个实际碰撞代理 Mesh 的 Box3，绿线为四点家具轮廓；青色显示 8 件物体初始位置到最近可达站立格的距离。未缩小碰撞代理，未用旧建筑替代。
2. [restaurant-adapter-validation.json](../../../web/public/scene-data/restaurant_adapter_validation.json)：8 个初始物体的最近可达格、世界坐标、水平距离、A 原导航终点；162 个家具/代理 Mesh 的真实边界逐一对照 layout，其中阻挡代理 99 个。8 件物体的最近距离如下。
3. 同一 JSON 中记录 A 原 executor 的 9 条 find→grab→drop 自动化断言：8 件各放回原台面，另红杯跨到 table_03；动作事件全部 ok，挂载世界位置误差 <1e-6，最终 parent/holding/台面接触高度和真实四点面内落点均检查。A 原移动过程每段连续线段与半径 0.25 米外扩代理的穿越数为 0。[restaurant-adapter-browser.json](restaurant-adapter-browser.json) 和 [restaurant-a-executor-drop.png](restaurant-a-executor-drop.png) 另记录既有页面实际加载原 PLY 后运行 A 红杯跨桌流程，3 步通过、页面错误 0。动作结束图中的青色标注仍是初始位置的可达性标注。

| 物体 | 初始承载家具 | 最近可达站立格距离 / 米 |
| --- | --- | ---: |
| cup_red | table_01 | 0.620405 |
| bottle_green | table_03 | 0.584172 |
| remote_black | long_table_01 | 0.431767 |
| keys_yellow | table_05 | 0.657081 |
| phone_white | table_07 | 0.638046 |
| notebook_orange | table_09 | 0.578252 |
| book_blue | table_10 | 0.637033 |
| glasses_black | counter_01 | 0.836815 |

## 测试与变红

[adapter-unit-tests.txt](adapter-unit-tests.txt)：同一份 restaurant-scene.test.js 的 5 项断言用 node:test 执行，JSON 导入改为 Node 支持的 import attributes；原文件仍用 Vitest，不修改项目依赖。故意把 roomOf 改成返回初始分区，或者把家具 box 最大 X 缩小 0.2 米，新 adapter 注册表测试都失败；还原版本 5/5 通过。异常还覆盖未知 id、负尺寸和禁用必要阻挡代理。

本机测试使用隔离页已有 Three r170；全仓 package 指定 r187，此版本和全仓 npm/Vitest/build/CI 没有在本机完成验证，应以整合环境与 CI 为准。不能把这些局部结果说成整个项目已经通过。

## 复跑

在整合 checkout 中同时具备 A PR #20 与当前 B 源码，安装 web 的现有依赖后，在仓库根目录运行：

```sh
node web/src/scene/restaurant-a-integration.mjs restaurant-adapter-validation.json
cd web
npm test -- src/scene/restaurant-scene.test.js
```

浏览器证据脚本 [verify-restaurant-browser.cjs](verify-restaurant-browser.cjs) 复用既有 `/restaurant-integration/index.html`，需要已启动的整合 Vite、可用 Chrome 和团队已有 Playwright 测试环境。它不增加产品依赖。RESTAURANT_URL 默认 `http://127.0.0.1:5173/restaurant-integration/index.html`；设置 SCENE_PLY 为本机原版餐厅 PLY 的绝对路径；PLAYWRIGHT_MODULE 可指定已有 Playwright 模块位置。然后在仓库根运行 `node assets/gaussian-splat/task-b-restaurant/verify-restaurant-browser.cjs evidence-output`。截图的 1 秒/0.5 秒等待只用于画面稳定；动作完成断言依赖真实 executor Promise，不依赖固定 sleep。

## 假设与待整合

- 原点云 SHA256 `db3ff012934704ba8787f82464bdc7b1db21760281189274626914a2800efb28`，来源 Hilo / heroizme，CC BY 4.0，https://superspl.at/scene/40c67340。原 PLY 留在 Release splat-restaurant-v1，不进 Git。
- 根节点、分区节点和上级世界不再加额外变换；点云实体按既有 config 单独变换。任务物体世界 Y 是几何中心，layout Y 是台面接触点。
- 自动化使用 A 的真实 createRobot 位置/携带锚点，但 Node 不加载 GLB；浏览器蓝色圆柱只是可视测试体。最终模型手部姿势、携带锚点观感尚未审核。
- 9 条具体落点中心在真实四边形内；A pickDropSpot 当前只读 AABB，任意站位与拥挤台面边缘放置仍需 Jesu 扩展四点面约束。本次不缩小 box 来隐藏差异。
- Jesu 仍需在最终主入口替换演示 world 并使用一份 THREE，统一 core/config 的相机/点云配置；wei 仍需让后端、缓存/台词与单餐厅布局一致。最终目标机性能、遮挡、完整 CI 由整合环境复核。
- PR #19 仅作素材版本/许可/SHA 台账；PR #17 的旧建筑 FPS 与正交结论不能迁移到餐厅。

这是一份可接入 A 的场景候选和可复跑证据，不单独宣告完整 Task B 已验收。
