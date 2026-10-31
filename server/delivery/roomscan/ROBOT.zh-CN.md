# RS-01 履带扫描机器人

当前默认外观是双履带 RS-01：金黄色方形机身、三角履带、每侧三个滚轮、四节金属伸缩杆和双镜头造型的四向环视相机。主页面的“机器人特写”可以近距离跟随；独立外观预览在 `http://localhost:8765/robot`，支持旋转、缩放、杆高/俯仰滑块与伸缩演示。

## 开源参考筛选

2026-10-31 查询了官方仓库，按社区规模、模型可用性与目标形态筛选。下列 Star 为当时 GitHub 元数据快照，代表各自仓库，不是所有开源机器人项目的排名。

| 项目 | Star 快照 | 适用点 |
| --- | ---: | --- |
| [Google DeepMind MuJoCo Menagerie](https://github.com/google-deepmind/mujoco_menagerie) | 4,292 | 成熟的机器人模型集合，可作为后续动力学模型来源；各模型单独核对许可。 |
| [ROBOTIS TurtleBot3](https://github.com/ROBOTIS-GIT/turtlebot3) | 2,094 | 成熟的 ROS 移动机器人生态、模块化底盘与传感器结构参考。 |
| [chillibasket/walle-replica](https://github.com/chillibasket/walle-replica) | 467 | 与用户给出的 WALL·E 图片最接近，参考双履带、方形机身与双眼比例；仓库代码 GPL-3.0。 |
| [TurtleBot4](https://github.com/turtlebot/turtlebot4) | 168 | 移动扫描平台参考；[官方手册](https://turtlebot.github.io/turtlebot4-user-manual/overview/features.html)确认使用 Create 3 底盘。 |
| [iRobot Create 3 模型](https://github.com/iRobotEducation/create3_sim) | 133 | 官方圆盘底盘 CAD/URDF，BSD-3-Clause；模型和许可已本地保存。 |

最终履带版的网格由 `scripts/build_robot.py` 在本项目中建模，造型参考用户图片和开源 WALL·E 复刻项目，没有复制该项目的程序或第三方 STL。Create 3 原始 DAE、URDF 和 BSD 许可保存在 `assets/robot/source/create3/`；圆盘版 GLB 在 `assets/robot/variants/`，当前履带版不使用这些 DAE。

## 模型与动画

- `assets/robot/roomscan-rs01.glb`：当前模型，约 340 KiB，25,720 个三角形，可直接导入兼容 GLB 的软件。
- `assets/robot/manifest.json`：部件、材质、关节限位、履带环形路径和来源说明。
- `assets/robot/meshes/`：由同一几何生成的 MuJoCo OBJ 部件，主页面几何代理视图也显示新外观。
- `web/robot.mjs`：GLB 加载、四节升降、相机俯仰、六个滚轮和 84 块履带节动画。左右履带行程分别为底盘前向行程减/加半轮距乘转角，原地转向时反向滚动。

杆高沿用 0.55–2.30 m，俯仰沿用仿真限位。网格经过检查，在这些姿态下仍位于原有半径 0.25 m 的扫掠包络内。相机位置、方向、导航和观测计算保持原有模型；复杂装饰网格只参与第三人称展示。当前仍为运动学执行，履带滚动属于视觉动画，未增加履带接触、打滑或电机动力学。

环视采集仍是四个方向的相机；前方双镜头是外观造型，没有增加双目视差估计或改变传感器数量。餐厅页面显示完整高斯场景 RGB，深度、建图和覆盖率继续来自几何代理。

## 复现与验证

在项目目录执行：

```bash
python3 -m pip install --target tools/python --no-deps trimesh==5.2.0
PYTHONPATH=tools/python python3 scripts/build_robot.py
python3 -m pytest -q tests
```

服务启动方式见 README。模型生成后刷新网页即可；更新 MuJoCo 几何需重启本项目服务。

10 项 Python 测试通过，包括最低/最高杆高、多种俯仰下的真实相机位置与装饰网格包络检查。真实 Chromium / NVIDIA Vulkan 检查通过：GLB 加载、两侧各 42 块履带、原地差速转向、伸缩与俯仰、移动端布局、餐厅特写、移动动画、几何代理视图，以及原景相机与平滑位姿回归。结果和截图位于 `artifacts/robot_qa/`；Windows 端实际帧率未测量。
