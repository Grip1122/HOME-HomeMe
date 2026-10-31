# reference · 参照实现归档

这里放**已验证过、但不直接进入产品运行路径**的参照实现。原则只有一条：

> 归档不等于合并。`reference/` 下的代码不是 `web/` 或 `server/` 的依赖，
> 任何人删掉整个 `reference/` 目录，项目仍应能构建、测试、演示。

为什么需要它：

| 理由 | 具体到本项目 |
| --- | --- |
| **复现别人的验证结论** | `reference/hackerson/VALIDATION.zh-CN.md` 里的覆盖率数字、帧率、相机位姿回归，是重新实现时要对照的基线 |
| **避免重复踩坑** | 坐标映射、门洞判定、履带差速、位姿插值，这些细节在原实现里已经调通 |
| **可追溯** | 评审时能回答「这段逻辑从哪来的」，而不是「AI 写的」 |

## 目录

| 路径 | 内容 | 归属 |
| --- | --- | --- |
| `hackerson/` | 自主升降全景扫描机器人（MuJoCo + PlayCanvas 3DGS）完整源码、文档与 QA 记录 | AI-D 交付，Jesu 代传归档 |

## 使用方式

只读。需要复用的部分，**抽成纯函数搬进 `web/src/` 或 `server/`，并为搬运结果写测试**——不要在 `reference/` 里改代码，也不要把 `reference/` 变成第二套实现。

落位对照见 [`docs/hackerson-integration.md`](../docs/hackerson-integration.md)。
