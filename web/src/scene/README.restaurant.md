# 餐厅场景接入候选

本目录的restaurant-scene.js是设计B提供的纯场景数据适配器，依赖注入THREE，不加载第二套家具GLB，不修改nav/server/contracts/core。正式布局在web/public/layouts/layout_restaurant.json，坐标/旁车语义在web/public/scene-data/。独立验证页在web/public/restaurant-integration/。

## 已实现

- 63件原语义家具世界坐标、14处不可见四点台面、8件新增彩色虚拟任务物体。
- 99块不可见阻挡代理：所有家具外接范围和显式禁入区向外取整到1/4096米，再将二维并集分解为无重叠矩形。只向外扩，不缩小家具；分割前后量化并集面积相同。
- 直接兼容 A PR #20 的 world adapter：getFurniture、getObject、worldPos、objectsInRoom、roomOf；详见 [world-adapter.md](world-adapter.md)。家具提供 box/surface/top，8 个任务 Mesh 提供 halfH 并能直接 attach。任务世界坐标为几何中心，台面接触点是 layout.objects[].pos。
- 保留 getObjectById、listObjectsByRoom、getWorldPosition 调试接口；家具调试网格位置仍是包围盒中心，A worldPos 返回家具底面中心。不要混淆 listObjectsByRoom 与仅列任务物体的 objectsInRoom。
- attachKeepingWorld通过Object3D.attach保持世界坐标，挂载差值有测试。不代替最终机器人抓取动画。
- sourcePointToLayout用于原始坐标校验；真正渲染高斯时对整个实体使用config中的四元数和位移，不能只改PLY中心。

## 坐标

raw_ply_entity_transform采用Ry(-25.448004826759416°)*Rz(180°)，四元数xyzw和位移由restaurant_scene_config.json提供。缩放仍1，地面归零后的Y偏移为0.06703794747591019。这是既有标注坐标的刚体转向与地面平移，不更改已审核物体的相对几何。不要再叠加旧建筑scene-transform.js的[x,z,-y]映射或额外z翻转。

所有布局坐标、机器人路径、点云、台面和对象必须用同一个新世界。相机正交45°、禁止旋转，缩放0.7–1.5。原SuperSplat轴图和v2标注图仍属于旧编辑器对齐世界，验证新接入请看本包validation/restaurant_integration_45.png和_top.png。

## 阻挡语义

63件语义家具blocks=false，其真实占用范围全部被99个nav_block_*代理覆盖。代理blocks=true、surface=false，前后端都直接从同一layout读取。不能删掉代理而仅留下不占格的语义家具。如此处理是为满足现有Schema的AABB和校验器阻挡不重叠规则，不绕过碰撞，也不调整校验规则。导航半径仍0.25米。

显式禁入区包含已观察餐厅地面边界之外及厨房遮挡区；这些代理的高度是导航调试用的挤出高度，不声称是实测墙高或墙厚。D1只是已审核的候选入口标注，正式layout中doors为空：单餐厅演示不连接未知室外空间。12个孤立可走小格不作为出生点或任务目标。

## 与A/D联调

1. Jesu在core/config维护唯一相机与场景变换，并把createRestaurantScene的root挂到主场景。该模块不自行改core。GLSL正交协方差兼容适配目前在独立页中；采用其他高斯渲染器时必须重新验证，不能只复制参数。
2. wei让后端与导航读取同一份layout_restaurant.json。保留所有99个代理。场景词典新增餐桌1～12、长桌、水槽台等唯一别名；原家庭卧室/书房的缓存台词不能直接用于单餐厅演示，应重新录制/固化示例。
3. createRestaurantScene 的返回值直接传给 A 的 ctx.world；ACTIONS 和 executor 不改写。getFurniture 不向动作层暴露 nav_block_*；objectsInRoom 只返回 8 件任务物体并随挂载后的世界位置更新。
4. 已用未改动的 A PR #20 执行器在此餐厅布局上跑通 9 条 find→grab→drop，并在既有页面加载原 PLY 后运行红杯跨桌放置。对应报告和叠加图见 assets/gaussian-splat/task-b-restaurant/README.adapter.md。主入口与最终机器人 GLB/动画仍待 A 整合验收；未将独立页或本机瞬时 FPS 当作完整产品结果。

## 独立页依赖

通过项目Vite访问/restaurant-integration/index.html。路线和报告已放在web/public/scene-data下，不依赖作者机器上的JSON路由。原PLY不进仓库；页面可选择本机scene.ply，文件仅由浏览器读取，不上传。作者本地8767服务器额外提供/scene.ply便利入口，其他服务器没有该入口时会提示选择文件。

公开目录vendor固定Three.js0.170.0和GaussianSplats3D0.4.7并附MIT许可证，形成隔离验证页；生产项目不要混用两套Three对象。主场景应注入项目自己的THREE，并审核高斯渲染依赖兼容性。原PLY仍从Release下载，不提交进普通Git。
