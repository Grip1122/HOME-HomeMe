# 餐厅场景接入候选

本目录的restaurant-scene.js是设计B提供的纯场景数据适配器，依赖注入THREE，不加载第二套家具GLB，不修改nav/server/contracts/core。正式布局在web/public/layouts/layout_restaurant.json，坐标/旁车语义在web/public/scene-data/。独立验证页在web/public/restaurant-integration/。

## 已实现

- 63件原语义家具世界坐标、14处不可见四点台面、8件新增彩色虚拟任务物体。
- 99块不可见阻挡代理：所有家具外接范围和显式禁入区向外取整到1/4096米，再将二维并集分解为无重叠矩形。只向外扩，不缩小家具；分割前后量化并集面积相同。
- 注册表getObjectById、listObjectsByRoom、getWorldPosition；家具网格世界位置是包围盒中心，放置应使用getSurfacePosition或布局台面高度。物体世界位置是放置锚点，子网格向上偏移。
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
3. 注册表listObjectsByRoom默认不返回nav_block_*，可以includeNavigation=true调试。任务操作应以8个对象id和真实语义家具id为目标，不能把导航代理作为可放置台面。
4. 主入口与最终机器人模型、抓取动画仍待A接入；独立页蓝色圆柱仅为导航测试体。后续重跑项目自身测试、布局检查、主页面遮挡与性能，不将这里的头浏览器瞬时FPS当目标机基准。

## 独立页依赖

通过项目Vite访问/restaurant-integration/index.html。路线和报告已放在web/public/scene-data下，不依赖作者机器上的JSON路由。原PLY不进仓库；页面可选择本机scene.ply，文件仅由浏览器读取，不上传。作者本地8767服务器额外提供/scene.ply便利入口，其他服务器没有该入口时会提示选择文件。

公开目录vendor固定Three.js0.170.0和GaussianSplats3D0.4.7并附MIT许可证，形成隔离验证页；生产项目不要混用两套Three对象。主场景应注入项目自己的THREE，并审核高斯渲染依赖兼容性。原PLY仍从Release下载，不提交进普通Git。
