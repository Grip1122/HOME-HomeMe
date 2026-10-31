# assets（本归档内为空）

机器人资产不在归档里，避免两份副本漂移。唯一真值：

```
assets/robot/            # 仓库根目录
├─ roomscan-rs01.glb     # 25,720 三角形，约 340 KiB
├─ manifest.json         # 部件、材质、关节限位、履带轮廓与环形路径参数
├─ meshes/*.obj          # MuJoCo 几何代理部件
├─ source/create3/       # 上游 iRobot Create 3 原始 DAE / URDF（BSD-3-Clause）
└─ variants/             # 圆盘底盘变体
```

要在本归档目录下复现原始工程，把资产拷回来即可：

```bash
cp -r ../../assets/robot ./assets/robot
```

餐厅场景（`assets/restaurant/*.ply`、`*.obj`）**不在仓库里**：原始 `scene.ply` 单文件 224.9 MB，超过 GitHub 单文件上限，且 Jesu 已决定场景统一使用 `assets/gaussian-splat/scene.ply`（Release `splat-v1`）。详见 `../../docs/hackerson-integration.md` 第 4 节。
