# 开源调研与实施建议

调研日期：2026-10-30。依据作者仓库 README、仓库元数据和官方文档；下面的“适合”是工程评估，除本目录的自编渲染验证外，尚未在本机编译运行这些上游项目。

## 结论与推荐

可以做出仿真原型，但未核实到一个直接提供“圆盘底盘 + 伸缩杆 + 全景相机 + 位置/高度/角度联合规划 + 扫描完成判断”的现成完整仓库。

当前推荐：**MuJoCo + 自定义机器人模型 + RGB-D 观测/融合 + 简化 NBV（下一最佳视角）规划 + 浏览器画面传输**。最值得借鉴的算法项目是 FKIE NBV Planner 和 active_mapping_dvc；最有用的机构仿真参考是 stretch_mujoco。需要自行补齐联合规划和任务闭环。

先做竖直升降和顶部相机俯仰。如果“杆子的角度”指杆整体倾斜，还需单独增加倾斜关节和运动过程碰撞检查。

## 重点项目

| 项目 | 可复用部分 | 需要补齐 / 兼容性 | 建议 |
|---|---|---|---|
| [FKIE NBV Planner](https://github.com/fkie/fkie-nbv-planner) | 移动操作机器人三维探索与下一最佳视角，输入 OctoMap、相机位姿、底盘 footprint | 测试为 Ubuntu 20.04 + ROS Noetic；动作客户端不在仓库；需接导航和本项目机构约束 | 最贴近的视角规划参考 |
| [active_mapping_dvc](https://github.com/HITSZ-NRSL/active_mapping_dvc) | 移动机器人、固态激光雷达、云台、建筑主动三维重建，含 Gazebo 示例 | 室外建筑任务；Ubuntu 18.04 + ROS Melodic；RAMBO 第三方依赖；无现成伸缩杆全景相机闭环 | 阅读架构和信息增益，旧环境另行复现 |
| [stretch_mujoco](https://github.com/hello-robot/stretch_mujoco) | 移动底盘、升降/伸缩机构、RGB/深度、激光、headless 模式和可选 RoboCasa 厨房 | 非圆盘底盘；相机安装结构不等同于杆顶相机；无自主扫描策略；其 ROS 包链接为 Humble 分支 | 机构与传感器仿真参考 |
| [MuJoCo](https://github.com/google-deepmind/mujoco) | 物理、关节、碰撞、RGB/深度和离屏渲染 | 需自己接建图、导航、NBV 和浏览器查看 | 本机主选仿真器 |
| [m-explore-ros2](https://github.com/robo-friends/m-explore-ros2) | explore_lite 二维前沿探索、Nav2/TB3 示例；README 声明 Humble 及更新版本 | 不优化杆高/俯仰；地面探索完不等于三维表面扫完；示例 Gazebo 命令需匹配版本 | ROS 2 路线的探索层 |
| [rtabmap_ros](https://github.com/introlab/rtabmap_ros/tree/ros2) | RGB-D/双目/激光 SLAM，点云、栅格和 OctoMap，机器人示例 | 动态 TF、标定和同步必须正确；全景投影不能直接当针孔 RGB-D | 后续真实传感器建图候选 |
| [OctoMap](https://github.com/OctoMap/octomap) | 三维空闲/占据/未知空间、射线更新 | 不包含自动导航、NBV 或纹理重建 | 探索与遮挡地图候选 |
| [Open3D](https://github.com/isl-org/Open3D) | 点云处理、配准、RGB-D/TSDF 融合 | 不包含机器人导航和扫描策略 | 重建、导出与评估候选 |
| [TurtleBot3 simulations](https://github.com/ROBOTIS-GIT/turtlebot3_simulations) | Gazebo 差速底盘与场景 | 需要增加圆盘外观、杆和相机，按 ROS 版本选分支 | Gazebo 路线底盘参考 |
| [Nav2](https://github.com/ros-navigation/navigation2) | 路径规划、局部避障和任务执行 | 不会选最佳扫描位置；二维 footprint 不能覆盖伸高的杆和相机碰撞 | 后续导航执行层 |

## 补充参考

- [mav_active_3d_planning](https://github.com/ethz-asl/mav_active_3d_planning)：模块化信息路径规划和重建收益；核心可独立于 ROS 编译，但主要面向飞行器，需要底盘/杆约束。
- [nbvplanner](https://github.com/ethz-asl/nbvplanner)：滚动时域采样树和未知空间收益，README 测试环境为 ROS Indigo/Jade；适合读算法，不作首版基础。
- [ipa_coverage_planning](https://github.com/ipa320/ipa_coverage_planning)：室内房间划分和覆盖路径，ROS 1；适合作为规则扫描基线。
- [Fields2Cover](https://github.com/Fields2Cover/Fields2Cover)：区域分解和覆盖路径，主要面向农业地块，不含三维遮挡与杆高规划。
- [Webots](https://github.com/cyberbotics/webots)：Camera 支持 planar/spherical/cylindrical 投影，可作为全景传感器优先的替代仿真器；本机尚未验证安装。
- [FKIE 对应论文](https://arxiv.org/abs/2203.10113)：移动操作机器人的三维探索/检查、多目标信息收益。

已保存 7 个重点项目 README 到 `research/upstream/`，元数据见 `repositories.json`。其余项目通过作者仓库或官方文档浏览核对，未全部保存元数据；未下载完整仓库和大型场景资产。

## 本机环境与渲染验证

只读探测：Ubuntu 22.04.5；4 张 NVIDIA RTX 6000D，每张 `nvidia-smi` 报告 85651 MiB；Python 可导入 MuJoCo 3.13.0、NumPy、SciPy、Pillow。未发现 `/opt/ros`、`ros2`、`gz`，当前 Python 未发现 Open3D、FastAPI、Uvicorn。

已执行 `python3 scripts/check_headless_render.py`，MuJoCo EGL 成功输出两个高度/俯仰姿态的 RGB 和深度图，渲染段耗时约 1.49 秒。这不是实时流帧率，也不是完整扫描性能。结果见 `artifacts/render_check/result.json`。

该验证场景只有三面墙、没有天花板，深度图中的远裁剪背景值不应作为真实表面融合。脚本只检查深度有限且为正；后续融合需加背景、距离和有效像素掩码。

当前的 MuJoCo 环境可以减少搭建工作。GPU 多不代表该仿真会自动使用四卡；首版单卡即可，无需先训练大模型。

## Windows 浏览器查看

建议架构：

```text
服务器 MuJoCo → 相机观测 → 地图/规划器
      ↓
本地画面服务 :8765 → SSH 端口转发 → Windows 浏览器
```

第一版通过 MJPEG 传第三人称视图和相机图，另传覆盖进度；需要更流畅再换 WebRTC。Windows 端使用现有 SSH 目标，例如：

```powershell
ssh -L 8765:127.0.0.1:8765 <现有SSH目标>
```

随后浏览器访问 `http://localhost:8765`。这是部署方案，**当前没有运行该服务，地址尚不可用**；不需要在 Windows 安装 MuJoCo 或 ROS。服务实现后还需验证连接和带宽。

## 相机与机械方案

1. 圆盘差速底盘 + 竖直滑动关节 + 顶部俯仰关节；杆整体倾斜可独立扩展。
2. 多方向虚拟 RGB-D 相机形成 360° 环视；完整球面观测需另外覆盖上下方向。
3. 用每路相机独立内外参和深度融合，展示全景另行拼接。等距柱状全景不能直接按针孔公式反投影。
4. 普通全景 RGB 相机不自动提供度量深度。本方案的仿真深度是额外传感能力；迁移实物需 RGB-D、激光或验证过的多视图几何方案。
5. 首版可用仿真位姿融合，明确标注“已知位姿模式”；后续才接里程计和 SLAM，验证漂移/回环。
6. 理想完整球面相机原地转动未必增加几何可见范围；位置和高度更影响遮挡。角度优化应依据实际视场、分辨率和杆身遮挡。

## 扫描策略：联合选择底盘位置、杆高和角度

候选状态 `q = (x, y, yaw, height, tilt)`；杆整体倾斜另加变量。以下为建议实现，并非声称某个上游库现成包含所有步骤。

1. 初版用已知平面地图导航，先验证视角规划；此时不能宣称已经实现未知房屋探索。
2. 采样可达底盘位置和少量离散高度/角度，避免一开始求高维全局最优。
3. 在当前已观测地图上估计候选视线和遮挡，计算未知空间、低质量表面的预期收益。
4. 使用可解释评分：`新信息收益 + 补扫收益 - 路径代价 - 升降代价 - 转动代价`。无需先用强化学习。
5. 过滤不可达、越界和碰撞候选；检查底盘、整杆、相机以及整个动作过程，不能只检查最终姿态。
6. 执行一小段移动，停车调整高度/角度，采集融合，然后重新规划。
7. 接入未知地图后，同时保留前沿探索与已知区域补扫；没有二维前沿不能作为三维扫描完成的唯一条件。

在线规划器只能访问已观测信息；场景真值可供仿真传感器和离线评估使用，不能让规划器直接查询未来真实新增覆盖。

## “扫完”的定义和验收

墙后、封闭柜内和永久遮挡面无法从外部相机全部扫描。验收目标应定义为：规定运动范围、关节范围和传感器条件下可观测的目标表面。

- 用场景真值离线生成可观测表面样本，评估被有效观测的比例；固定分母、采样密度和不可观测区域。
- 有效观测至少满足距离、可见性和像素分辨率要求；可进一步加入入射角和重建误差。
- 区分三维表面覆盖率、地面覆盖率和已知空间比例，不把它们混成一个数字。
- 95% 可以是验收目标，不能在实测前承诺。
- 在线停止可采用“连续若干轮最大候选预期收益低于阈值，且没有可达探索前沿”，加时间/路程预算。这是启发式，不是未知房间 100% 覆盖证明。
- 展示覆盖率曲线、轨迹、总路程、升降次数、最终地图和停止原因。

## 实施顺序

1. 环境验证：已完成 EGL、RGB/深度、两个杆高姿态；不含自主控制。
2. 可看模型：完整房间、圆盘底盘、伸缩杆和相机，启动 Windows 可查看的画面服务。
3. 固定扫描基线：固定扫描点和高度，点云融合、可见性评估和任务回放。
4. 自适应扫描：NBV 评分、可达性、位置/杆高/俯仰联合选择，对比固定高度策略。
5. 完整任务：多房间探索、补扫、停止、点云/网格导出和演示录制。
6. 实物准备：ROS 2、真实传感器、SLAM、机构稳定性和动力学约束。

黑客松先完成第 2–4 步形成可重复演示。活动截止时间尚未提供，暂不承诺工期。

## ROS 版本与来源

本机 Ubuntu 22.04 可以选择 ROS 2 Humble 路线。官方默认配对为 Humble/Fortress、Jazzy/Harmonic；若用 Ubuntu 24.04 容器选择 Jazzy/Harmonic，还需验证图形/GPU 与包兼容性。不能直接把旧 ROS 1 项目当 ROS 2 包编译。

- [Gazebo 官方配对表](https://gazebosim.org/docs/harmonic/ros_installation/)
- [ros_gz 版本表](https://github.com/gazebosim/ros_gz/blob/ros2/README.md)
- [MuJoCo 官方渲染文档](https://mujoco.readthedocs.io/en/latest/programming/rendering.html)
- [Webots Camera 文档](https://github.com/cyberbotics/webots/blob/master/docs/reference/camera.md)

## 许可与复现状态

FKIE 为 BSD-3-Clause，active_mapping_dvc 为 MIT，stretch_mujoco 为 BSD-3-Clause-Clear，rtabmap_ros 为 BSD-3-Clause，TurtleBot3 simulations 为 Apache-2.0。m-explore-ros2 README 声明各包为 BSD，但根元数据是 NOASSERTION，复用前需看具体文件。OctoMap 核心为 BSD，octovis 及相关可视化库为 GPL。场景资产和子模块另查许可。

当前仅保存 README 和元数据，未编译这些上游仓库、安装系统 ROS 或下载大型厨房资产。实现时应锁定 commit，保留来源与许可证，并记录运行命令。
