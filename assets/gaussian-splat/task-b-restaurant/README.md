# 餐厅场景 · 接入候选与验证证据

餐厅素材为小觅HOME 当前演示前端的实景基础；运行时模型与语义数据分层存放，避免把视觉坐标直接混写进产品逻辑。

## 资源位置

| 内容 | 路径 | 当前用途 |
| --- | --- | --- |
| 餐厅实景高斯模型 | `web/public/robot-find/models/restaurant.splat` | 主界面“餐厅实景”入口加载，随仓库交付 |
| 餐厅布局 | `web/public/layouts/layout_restaurant.json` | 场景空间描述 |
| 餐厅语义、路线与校验数据 | `web/public/scene-data/` | 后续语义导航整合依据 |
| 场景适配器与测试 | `web/src/scene/restaurant-scene*.js` | 餐厅坐标、对象及验证逻辑 |
| 独立联调页 | `web/public/restaurant-integration/index.html` | 本地集成验证 |

`restaurant.splat`：31,358,432 bytes，SHA-256 `18731c2cbdcd11a3c3ece79555fdcd4c4e916304af30a88180b17d9a67ad3b6b`。

## 已验证范围

- Layout Schema 与 `check_layout.py` 验证通过；故意改坏的检查可触发失败。
- 8 个目标可达，180 条路线段与外扩阻挡的交叉数为 0。
- 餐厅场景相关 Node 测试通过。
- 前端母版提供独立餐厅实景查看器，并与空间记忆找物演示并列交付。

## 尚未完成的整合

- 母版的主找物世界仍使用独立演示世界；**不能宣称已经在餐厅实景中完成同屏找物与导航闭环**。
- 餐厅布局/语义/路线数据待接入主交互流程后，再以真实坐标更新可达性和任务验证。
- 正式公开发布前需再确认餐厅模型的可公开分发授权；当前仅按项目内部演示使用。