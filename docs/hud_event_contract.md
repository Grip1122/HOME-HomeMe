# HUD 事件契约（整改后）

本文件不再维护独立事件表。

`web/src/ui/` 的唯一事件真值是 [`contracts/events.md`](../contracts/events.md)。  
HUD 订阅 / 派发的事件名由 `web/src/ui/hud.contract.test.js` 动态读取契约并断言；出现契约外事件即测试失败。

整改前的平行事件（`chat:*`、`found`、`memory:update`、`toast`、`ui:director` 等）已删除，不再作为 HUD 契约。
