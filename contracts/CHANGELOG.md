# 契约变更日志

格式：`日期 | 文件 | 改了什么 | 为什么 | 影响谁`

新增在前。演示窗口内的变更一律只增不删，详见 `README.md` 的兼容性原则。

---

- 2026-10-30 | 全部（首次冻结） | 建立 layout / plan / memory / captions 四份 Schema、events.md、layout.example.json | 阶段 0 契约先行，四人并行开工的前提 | 全员
- 2026-10-30 | plan.schema.json | 新增 `request.last_object`（可选）与 `response.corrected/corrected_object/corrected_to` | 纠正句常省略宾语（“不对，放书房”），需要上一次的物体；纠错结果要能被 HUD 与日志区分 | 设计 A（执行器）、设计 C（HUD）、AI-D
- 2026-10-30 | plan.schema.json | `source` 枚举增加 `corrective` | 纠错路径永不来自大模型，必须在来源标签上可辨识 | 设计 C（来源标签）
- 2026-10-30 | layout.schema.json | 新增 `rooms[].drop_to`、`rooms[].aliases`、`furniture[].aliases`、`doors[]` | 用户说“放书房”要能解析成具体落点；门洞决定跨房间可达性 | 设计 B（布局）、设计 A（寻路）、AI-D（校验）
- 2026-10-30 | memory.schema.json | 新增 `status` 枚举 `fresh/stale` | 复核落空必须可标记，否则复扫触发条件只能靠 confidence 猜 | AI-D、设计 C（置信度条）
