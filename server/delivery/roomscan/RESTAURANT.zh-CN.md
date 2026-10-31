# 天安骏业集团餐厅 · 场景替换记录

已将用户提供的餐厅替换为服务默认场景，浏览器入口和 SSH 转发端口仍为 8765。页面顶部可切回原演示房间，切换时重置当前任务。

## 三个视图

- **餐厅原景**：PlayCanvas 在浏览器渲染餐厅原始高斯资产，叠加服务器状态驱动的 RS-01 双履带机器人、伸缩杆、相机和扫描目标。支持跟随、机器人特写、旋转、平移、缩放及全景俯看。为看到室内机器人，默认剖切高处高斯。外观来源和验证见 [机器人记录](ROBOT.zh-CN.md)。
- **几何代理**：MuJoCo 渲染由餐厅高斯体素化得到的纹理近似网格。实际相机深度、点云融合和碰撞/导航使用此代理；传感器仍看到完整代理，第三人称只显示剖切副本。
- **重建点云**：实际代理 RGB-D 相机观测生成的点云，随扫描更新，不直接把整份原场景点云显示成扫描成果。

页面下方的四路相机 RGB 已改为从完整餐厅高斯资产渲染，不使用重建点云或纹理代理画面。每次停车扫描时锁定实际底盘位置、杆高和俯仰，等待高斯排序就绪后生成四方向图像；开始前显示起点预览。原始资产只有高斯数据，不包含可直接播放的源照片/视频。深度、在线建图、点云颜色与覆盖率计算仍使用 MuJoCo 几何代理，因此导出 `ring.jpg` 仍是代理 RGB-D 记录。

运动状态改为 60 Hz 仿真更新，通过 `/api/pose` 单独提供轻量位姿；浏览器约 20 Hz 请求，并在动画帧之间插值位置、杆高和俯仰。基础缓冲 100 ms，收到位姿较慢时适当增加缓冲；断流时保持最后位姿。重置和切换场景清空插值历史。原景视图开启时不再持续渲染服务器的第三人称代理画面。实际浏览器帧率取决于 Windows 显卡和硬件加速。

## 数据与转换

原始文件：999,131 个高斯，约 225 MiB。裁剪已知主体范围并去除无效/极低不透明度记录后，保留 943,603 个高斯；浏览器使用只保留 DC 颜色的压缩 PLY，以降低首屏传输。完整主体约 14.7 MiB，默认剖切版约 11.3 MiB；未改变原压缩包与原始 `scene.ply`。

坐标约定：原始 PLY `[x,y,z]` 转为机器人仿真 `[x,z,-y+0.07]`；地面按高密度水平结构近似对齐。浏览器使用 Y 向上，映射为 `[sim_x,sim_z,-sim_y]`。PlayCanvas 的 PLY 导入坐标变换与原始坐标不同，转换命令中的 Y 轴旋转用于使体素结果与上述显示一致。

**米制尺度未标定，暂按 1 场景单位 = 1 米。** 当前起点由有地面支撑的连通区域中最大障碍距离选取，而不是盲放在原点。

体素代理使用 PlayCanvas `splat-transform 3.10.3` 的 GPU 高斯体素化，体素边长 0.12 场景单位、不透明度阈值 0.25，产生约 25.1 万三角形。网格转换为 MuJoCo OBJ，按邻近高斯颜色生成纹理图集。

## 导航和扫描范围

从代理体素提取近地面支撑，排除 0.20–2.42 高度内的障碍列，再进行机器人半径与安全余量膨胀。当前选取的最大连通可行区域约 23.3 平方场景单位，有 16 个可达扫描位置，每个位置可选择 4 个高度和 3 个俯仰角。

这不是餐厅总面积。桌椅、薄结构、重建噪声和保守整杆包络可能隔开其他区域；这版仅导航到已确认的连通可行区域，未实现跨越缺失地面或任意桌底穿行。

餐厅路径检查使用栅格线段的精确 supercover 遍历，避免固定间距采样漏过障碍角点；执行前也复查每一步。已知代理地图用于导航，在线 NBV 收益仍只读取已观测体素与表面观测方向记录。

## 覆盖率与验证

完整 48 次自主扫描已执行完成，采集 83,218 个去重观测点；代理参考表面覆盖率约 91.538%，路程约 189.98 个假定米，以扫描次数预算结束。记录见 `artifacts/restaurant-validation.json`，原任务目录在其中的 `export` 字段。

此指标与演示房间原来的 99.8% 不能直接比较。餐厅分母来自代理网格的面积随机采样：从 16 个可达位置、1.15 与 2.30 两个参考高度进行遮挡射线检查，筛出 3,888 个可见参考样本。指标反映该参考集合被传感器观察的比例，不是整个餐厅真实表面的完整度，也不是重建精度。

原始高斯中未记录的表面、代理网格的孔洞/伪表面、透明和反光区域，需要进一步人工核查。代理网格与导航范围均为自动估计；现阶段不用于实物机器人直接执行。

自动检查：9 项 Python 测试通过，包含餐厅候选路径安全与动态场景地图边界检查；餐厅完整 48 次任务正常结束。真实 Chromium 已验证压缩高斯加载、机器人扫描、三视图、双向场景切换和移动布局，页面没有脚本异常。浏览器记录和截图位于 `artifacts/restaurant_browser_qa/`，结果见 `result.json`。

## 复现转换

以下命令都在项目目录执行。依赖仅安装在项目的 `tools/`，无需修改系统 Python。

```bash
npm install --prefix tools/splat
python3 -m pip install --target tools/python --no-deps trimesh==5.2.0
python3 scripts/prepare_restaurant.py

node tools/splat/node_modules/@playcanvas/splat-transform/bin/cli.mjs -w assets/restaurant/cropped.ply assets/restaurant/restaurant.compressed.ply
node tools/splat/node_modules/@playcanvas/splat-transform/bin/cli.mjs -w assets/restaurant/cutaway.ply assets/restaurant/restaurant_cutaway.compressed.ply
node tools/splat/node_modules/@playcanvas/splat-transform/bin/cli.mjs -w assets/restaurant/cropped.ply --rotate 0,180,0 --translate 0,0.07,0 --voxel-size 0.12 --voxel-opacity 0.25 --collision-mesh assets/restaurant/restaurant.voxel.json

python3 scripts/build_restaurant_proxy.py
```

首次运行时离线计算可见代理参考样本，之后缓存；代理数据变化会使缓存失效。缓存只包含参考样本，不复用任务的“已扫描”状态。

启动或切回餐厅：

```bash
python3 scripts/service.py start
# 或前台指定场景
python3 run.py --scene restaurant
# 离线完整扫描
python3 run.py --benchmark --scene restaurant --max-scans 48
```

## 来源

餐厅资产：**天安骏业集团餐厅 — Hilo**，[SuperSplat 原始页面](https://superspl.at/scene/40c67340)，随包声明为 CC BY 4.0；原始 `license.txt` 已保留，界面提供署名和来源。

Gaussian 渲染：[PlayCanvas](https://github.com/playcanvas/engine)，本项目固定使用 npm `playcanvas 2.23.3`，本地提供脚本及 MIT 许可。转换：[splat-transform](https://github.com/playcanvas/splat-transform)，固定使用 3.10.3；碰撞体素规范按官方 v1.1 解码。网格导入使用 trimesh 5.2.0。
