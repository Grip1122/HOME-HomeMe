# assets/robot · RS-01 履带扫描机器人

> 归属：设计 B（场景与美术）＋ Jesu 共管，见 `.github/CODEOWNERS` 的 `/assets/`。
> 来源：`robot.fbx` 为 Task C 本地交付；轻量模型为 AI-D 交付（`reference/hackerson/`）。

小觅HOME 的机器人外观资产。**逻辑层不读这个目录**：碰撞半径、杆高限位、履带参数在
`web/src/robot/kinematics.js` 里另有一份常量，改动几何后两边要一起改（有测试比对 `manifest.json`）。

## 1. 文件

| 文件 | 用途 |
| --- | --- |
| `robot.fbx` | 原始主视觉模型，来自 Task C 本地交付；62,266,860 bytes，1,714,693 个多边形 |
| `../../web/public/models/robot.glb` | 由上述 FBX 保留外观、减面至 5% 的网页显示模型；不额外制作替代造型 |
| `roomscan-rs01.glb` | 轻量履带扫描机器人模型，25,720 三角形，约 340 KiB。GLB 坐标：X 前、Y 上、Z 右 |
| `manifest.json` | 部件 → 网格 → 颜色；关节限位；履带闭合轮廓与环形路径参数 |
| `meshes/*.obj` | MuJoCo 几何代理部件（每个材质一个 OBJ），仅供仿真，不要拿去渲染主视角 |
| `source/create3/` | 上游 iRobot Create 3 的原始 DAE / URDF 与 BSD 许可，**当前履带版不使用** |
| `variants/` | 圆盘底盘变体 GLB，历史版本 |
| `CREATE3-LICENSE.txt` | 上游 BSD-3-Clause 许可全文 |

## 2. 关节与命名（渲染层按名字找节点）

```
ScannerRobot
├─ Base
├─ WheelLeft / WheelRight                # 主驱动轮，绕局部 Z 转
├─ WheelLeftFront / LeftRear / RightFront / RightRear
├─ TreadLeft00 … TreadLeft41             # 每侧 42 块履带节，沿 profile 环形排布
├─ TreadRight00 … TreadRight41
├─ MastStage1 … MastStage4               # 四节伸缩杆，逐级滑动
└─ CameraHead                            # 云台，绕局部 Z 做俯仰
```

| 参数 | 值 |
| --- | --- |
| 占地半径 | 0.25 m（与 `layoutlib.ROBOT_RADIUS` 一致） |
| 杆高范围 | 0.55 – 2.30 m，四节，每节行程 0.45 m |
| 云台俯仰 | ±0.65 rad |
| 履带半轮距 | 0.128 m |
| 驱动轮半径 | 0.049 m |
| 滚轮半径 | 0.052 m |
| 履带节数 | 每侧 42，共 84 |

## 3. 动画怎么算

不要自己写积分。渲染层只做一件事：把 `kinematics.js` 的结果抄到节点上。

```js
import { mastStageOffsets, treadLinkPoses, treadTravel, clampTilt } from '../../../web/src/robot/kinematics.js';

const { localY } = mastStageOffsets(pose.height);          // 四节局部 Y
const t = treadTravel(prevPose, pose);                      // 差速行程与转角
const links = treadLinkPoses(manifest.tracks.profile, t.leftTravel);
links.forEach((p, i) => {
  const node = root.findByName(`TreadLeft${String(i).padStart(2, '0')}`);
  node.setLocalPosition(p.forward, p.up, p.lateral);
  node.setLocalEulerAngles(0, 0, (p.yaw * 180) / Math.PI);
});
```

## 4. 许可与来源

- 造型参考 [chillibasket/walle-replica](https://github.com/chillibasket/walle-replica)（双履带 + 方形机身 + 双眼比例），**没有复制其程序或第三方 STL**。
- 网格由 `scripts/build_robot.py` 程序化建模生成（见 `reference/hackerson/scripts/build_robot.py`）。
- `source/create3/` 来自 [iRobotEducation/create3_sim](https://github.com/iRobotEducation/create3_sim)，BSD-3-Clause，许可全文在同目录 `CREATE3-LICENSE.txt`。

## 5. 待办（设计 B）

- [ ] 按 `assets/gaussian-splat/scene.ply` 实测尺度重标定：机器人在真实空间里多大，现在没有依据。
- [ ] 决定是走 GLB 直出还是转 glTF + DRACO；仓库根 `.gitignore` 目前把 `web/public/models/**/*.glb` 排除了，接入前要确认路径。
- [ ] 机器人底盘的接地阴影 / 材质反射与摄影棚环境贴图对齐（原实现里用 Canvas 程序化生成等距柱状图，见 `reference/hackerson/web/robot.mjs` 的 `studioReflections`）。
