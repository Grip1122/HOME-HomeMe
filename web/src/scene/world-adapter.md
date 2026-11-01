# 餐厅 world adapter v1

适配基准：Jesu 的 [PR #20](https://github.com/Grip1122/HOME-HomeMe/pull/20)，提交 `1499b6a420219c9788e2cc8eac0384464de78edb` 的 `robot/world.js`、`actions.js` 与 `executor.js`。B 基线为 PR #23 的 `a65f0531cf238e7a7bc5a2e7668e0268a1791196`。本约定放在 scene 目录，不修改冻结的 `contracts/`。

## 交给 A 的对象

`createRestaurantScene({ THREE, layout, semantics })` 直接返回 `ctx.world`，不需要另一层同名函数包装。

| 成员 | 返回值与语义 |
| --- | --- |
| `root` | Three.Group，包含整个餐厅语义层；由调用方加入主 Three.Scene |
| `layout` | 传入的同一份 layout；导航和执行器必须共用它 |
| `rooms` | Map<roomId, Group>；分区组无位移、旋转、缩放 |
| `furniture` | Map<id, Object3D>，仅 63 件语义家具；不含导航代理 |
| `objects` | Map<id, Object3D>，仅 8 件可抓取任务物体；A 的落点避让使用此 Map |
| `getFurniture(id)` | 家具 Group；不存在或 id 是 nav_block_* 时返回 undefined |
| `getObject(id)` | 可直接被 `parent.attach(object)` 接管的任务 Mesh；不存在返回 undefined |
| `worldPos(id)` | 当前 `[x,y,z]` 数组；接受任务物体或语义家具 id；不存在抛 RangeError |
| `objectsInRoom(roomId)` | 当前分区内的任务物体 id[]，不混入家具或导航代理 |
| `roomOf(id)` | 由当前世界位置换算网格，再匹配 room.rect；返回 roomId 或 null。抓取和移动后立即生效 |

家具 Group 的原点为底面中心 `[pos.x+size.x/2,pos.y,pos.z+size.z/2]`。家具需提供：

```js
group.userData = {
  id, kind: 'furniture', room,
  box: [minX, minZ, maxX, maxZ], // layout 的完整 AABB，供 A 选择可站落点
  surface: trueOrFalse,         // 可否放置；不是台面 Mesh
  top: posY + height,           // 世界台面高度，米
  surfacePolygon: [[x,z], ...], // B 的真实四点轮廓，额外信息
};
```

任务 Mesh 的几何中心为原点，提供 `userData.id/kind/home/halfH`。`home` 是初始家具 id；当前承载关系以 `parent` 为准，不能把 home 或原始 layout.objects[].on 当动态位置。

初始任务 Mesh 通过 attach 挂在对应家具 Group 下。`layout.objects[].pos.y` 是接触台面的高度；`worldPos(objectId).y = pos.y + halfH` 是物体中心。抓取中缩到 0.4、放下恢复 1 均由 A 原动作层处理。B 不另写抓取动画。

## 接入示例（由 Jesu 落到自己的入口）

```js
const [layout, semantics, config] = await Promise.all([
  fetch('/layouts/layout_restaurant.json').then(r => r.json()),
  fetch('/scene-data/restaurant_semantics.json').then(r => r.json()),
  fetch('/scene-data/restaurant_scene_config.json').then(r => r.json()),
]);
const world = createRestaurantScene({ THREE, layout, semantics });
scene.add(world.root);
// 原来传入 buildWorld(layout) 的位置改传 world；不再同时构造旧演示世界。
const ctx = { /* 保留 A 的 ticker/bus/sm/robot/memory 等 */, world, layout, grid: buildGrid(layout) };
// 原 executor、submitPlan、ACTIONS 继续使用原实现。
```

同一运行时只注入一份 THREE。`root`、房间 Group 及其父级保持世界单位矩阵；A 的 settleOnSurface 把家具的本地位置视作世界位置，不能在接入后再给整个世界加缩放或旋转。点云单独使用 config.frame.raw_ply_entity_transform；不要再叠旧建筑 `[x,z,-y]` 映射。唯一配置如何归入 core/config 由 Jesu 决定，本提交不跨目录改 A。

## 碰撞和台面

63 件语义家具 `blocks=false` 的占用范围已由 99 个 `nav_block_*` 覆盖；99 个代理仍为不可见真实 Mesh，并保留在同一 layout 中 `blocks=true`。前后端不可过滤掉这些代理。动作查询不能把代理当作可放家具。

14 处真实四点台面 Mesh 仍在 `surfaceById`；`getFurniture(id).userData.surface` 是 A 需要的布尔值。碰撞 AABB 不因视觉框线而缩小。墙高/门厚不确定性保留；外部门 D1 不打开。

A 当前 pickDropSpot 按 AABB 采样，不读取 surfacePolygon。本次 8 个原台面放回 + 红杯跨桌共 9 个具体落点，已断言中心位于真实四边形内；这不代表任意机器人站位、任意台面、多个物体拥挤情况下的四边形边缘放置全部验收。若扩展到这些指令，需要 Jesu 在动作层采用四点台面约束；B 不能通过缩小碰撞 box 掩盖该差异。

## 保留的 B 调试接口

`getObjectById/getWorldPosition/listObjectsByRoom/getSurfacePosition/attachKeepingWorld` 保留。`getObjectById` 可取导航代理 Mesh；`getFurniture` 只取语义家具 Group。家具的旧 getWorldPosition 是包围盒中心，A worldPos 是底面中心。任务对象两个坐标接口现在均返回几何中心，修正了旧版本“锚点在台面、子网格抬高”的语义。

`listObjectsByRoom` 默认包括家具和任务物体，不能拿来替代 A 的 objectsInRoom。任务物体所属分区改为动态查询；includeNavigation=true 仅用于调试。

## 验证与范围

- `restaurant-scene.test.js`：5 项坐标/注册表/动态分区/挂载/异常测试。两种故意改错会使新 adapter 测试变红。
- `restaurant-a-integration.mjs`：在同时具备 A 与 B 代码的整合 checkout 中运行。实际 A 的 executor、queue、ticker、actions、grid、route、walker 均未改写、未 mock。8 件物体各 find/grab/drop，加红杯 table_01 → table_03，共 9 条；每条检查事件、挂载误差、最终父节点、台面接触高度、中心落在真实四点面内、路径线段不穿半径外扩代理。
- 浏览器：既有联调页加载原版 999131 高斯，正交俯角实算 45°；同页加载原 A 模块跑红杯跨桌动作。没有新增验证页面。
- 本机执行使用隔离页已有 Three r170；未改 package.json/lock，也未把第二份 Three 接入产品。仓库当前 package 指定的 Three r187 和全仓 Vitest/build/CI 需要在整合环境重跑。本记录不能替代它们。
- 未验收：最终主入口、机器人 GLB 视觉/手部锚点、后端同布局、目标硬件 FPS。单餐厅不是旧三分区家庭，旧台词和缓存须由对应 owner 更新。
- PR #19 仅作餐厅 Release、来源、CC BY 4.0、SHA 台账；PR #17 的旧建筑 FPS/正交结果不作为餐厅证据。

复跑（仓库根目录，A PR #20 已合入当前测试 checkout、web 依赖安装完毕）：

```sh
node web/src/scene/restaurant-a-integration.mjs restaurant-adapter-validation.json
cd web
npm test -- src/scene/restaurant-scene.test.js
```

截至本次交付，9 条流程和本机浏览器验证通过；最终整合由 Jesu、wei 审核确认，本文件不单独宣布 Task B 完成。
