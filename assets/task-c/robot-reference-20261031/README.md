# 机器人视图与 Blender 草稿补交

| 原文件 | 仓库文件 | 类型 |
| --- | --- | --- |
| 前.jpg | [front.jpg](front.jpg) | 视图参考图 |
| 顶.jpg | [top.jpg](top.jpg) | 视图参考图 |
| 左.png | [left.png](left.png) | 视图参考图 |
| 右.png | [right.png](right.png) | 视图参考图 |
| build_robot_blender.py | [build_robot_blender.py](build_robot_blender.py) | 源代码草稿 |

五个文件保持原始字节；大小、SHA256、原名映射和脚本静态审计见 [manifest.json](manifest.json)。用户于 2026-10-31 回复“都许可”，已记为用户确认有使用许可。具体作者、来源链接和许可证名称未提供，不擅自写成 CC BY 或 MIT。

## 用途与限制

四张图属于机器人外观参考，不能当 albedo/normal/roughness/AO 贴图，也不能证明相机是精确正交投影或提供米制尺寸。它们不是旧 robot-find 运行时的矮圆底盘模型。

build_robot_blender.py 经 AST 静态检查可解析，但其 17 个硬编码人形方块与这些轮式/履带外观图不符；没有加载图片并建模的实现，也没有骨架、节点约束、锚点对象、贴图和模型导出。size=1 的 cube 又缩放 sx/2，实际尺寸是声明值的一半；高度写到 Blender Y，但默认 Blender 上轴为 Z。脚部坐标也不在注释声明的原点。

**脚本包含全选删除当前场景对象的操作，本次未执行。** 不把该脚本作为已完成机器人模型接入产品。后续需由建模 owner 统一机器人方案、尺寸、上轴、节点和输出格式后修正。

本组是补交参考材料，不改变 C-01/C-02 待复核状态。完整对照见 [复核补充说明](../../../docs/task-c/robot-find-20261031/review-followup.md)。
