# 自主升降全景扫描机器人

**当前默认场景已替换为「天安骏业集团餐厅」**。页面顶部可切回原演示房间。餐厅使用真实 3DGS 原景展示机器人，使用独立几何代理做导航和 RGB-D 扫描；尺度暂按 1 场景单位 = 1 米，未实测标定。

- [履带机器人外观与开源参考](ROBOT.zh-CN.md)
- [机器人外观截图](artifacts/robot_qa/collapsed.png)
- [餐厅接入与复现记录](RESTAURANT.zh-CN.md)
- [餐厅界面截图](artifacts/restaurant_browser_qa/restaurant-ready.png)
- [餐厅完整扫描验证](artifacts/restaurant-validation.json)

目标：扫地机器人形态的底盘搭载伸缩杆和全景相机，在室内仿真中自主选择移动位置、扫描高度和角度，并补扫遮挡区域。服务器运行，Windows 浏览器查看。

当前完成：MuJoCo 家具房间、双履带机器人外观和四节伸缩杆、四方向 RGB-D 环视、已知地图路径规划、位置/高度/俯仰联合选点、观测体素与彩色点云、自动结束、浏览器控制和结果导出。

这是使用已知导航地图和仿真位姿的运动学原型，未接真实电机、SLAM 或未知房屋探索。环视是四路图像拼排，尚未生成等距柱状全景。

```bash
cd /home/xch/data/cww/Hackerson
python3 scripts/service.py start
python3 scripts/service.py status
```

服务器本地入口：`http://127.0.0.1:8765`；独立机器人外观预览：`http://127.0.0.1:8765/robot`。Windows 通过 SSH 转发后打开浏览器，详见 [Windows 使用说明](RUN_WINDOWS.zh-CN.md)。

- [实现架构与限制](IMPLEMENTATION.zh-CN.md)
- [验证结果与对比](VALIDATION.zh-CN.md)
- [完整对比数据](artifacts/comparison.json)
- [浏览器实拍](artifacts/browser_qa/scanning-desktop.png)

- [开源项目筛选与实现方案](research/OPEN_SOURCE_PLAN.zh-CN.md)
- [重点仓库元数据](research/repositories.json)
- `research/upstream/`：上游 README 快照，不是完整源码。
- `scripts/check_headless_render.py`：简化房间、圆盘底盘、升降杆和相机的环境验证；直接设置关节姿态，不代表电机控制或稳定性验证。
- `artifacts/render_check/`：早期环境验证的第三人称视图、相机图、深度数组及运行结果。
- `scanner/`：场景、导航、在线地图、NBV 规划和仿真执行。
- `web/`：无外部 CDN 依赖的浏览器控制界面。
- `artifacts/runs/`：逐次任务的 PLY、扫描记录、体素地图、评估样本与画面。

运行自动测试和完整离线扫描：

```bash
python3 -m pytest -q tests
python3 run.py --benchmark --scene restaurant --max-scans 48
python3 run.py --benchmark --scene demo --max-scans 48
python3 run.py --benchmark --scene demo --strategy fixed --max-scans 48
```

停止服务：`python3 scripts/service.py stop`。不注册系统服务，不修改其他项目。

重跑环境验证：

```bash
cd /home/xch/data/cww/Hackerson
python3 scripts/check_headless_render.py
```

使用服务器已有的 MuJoCo、NumPy、Pillow，默认选择 EGL，没有安装系统依赖。
