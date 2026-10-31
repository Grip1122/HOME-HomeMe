# 餐厅Task B接入候选与验证证据

布局：web/public/layouts/layout_restaurant.json。场景适配器与测试：web/src/scene/restaurant-scene*.js。侧车坐标与语义：web/public/scene-data/。独立联调页：web/public/restaurant-integration/index.html。

原素材从Release splat-restaurant-v1下载scene.ply，SHA256 db3ff012934704ba8787f82464bdc7b1db21760281189274626914a2800efb28。原PLY不入普通Git。使用Vite打开/restaurant-integration/index.html后，可从文件框选择本机PLY，文件只在浏览器读取。原本地服务器仍支持直接加载。

Schema和原check_layout.py零错误，三项故意改坏检查有效，8目标可达，180路线段与外扩阻挡交叉数0，4项场景Node测试通过。完整仓库Vitest与CI尚需在合入环境运行，不将独立页视为主页面已接入。

63件语义家具的blocks=false依赖99个nav_block_*覆盖，不能删除代理。原标注和墙/门不确定性在annotations_accepted_v2.json；墙厚/墙高未知，D1未开放通行，C08高度待实测。截图为新世界坐标，附属旧审核坐标不再额外套用旧建筑rawToSim映射。

任务物体是新增虚拟标记。点云显示SH0并裁切上部，仅改变显示，源PLY未改。Hilo / heroizme，CC BY4.0，https://superspl.at/scene/40c67340。
