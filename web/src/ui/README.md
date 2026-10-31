# web/src/ui · 集成说明

## 1. 目录

```
web/src/ui/
├─ hud.css          # 设计 token + 全部样式
├─ hud.js           # createHud() 装配器（含 DOM 模板）
├─ chat.js          # 对话 / 输入 / 快捷指令 / 单飞锁
├─ status.js        # 状态 / 进度 / 规划来源
├─ memory-panel.js  # 记忆面板 / 置信度 / 更新高亮
├─ timeline.js      # 任务时间线 / 每步耗时 / 错误态
├─ compare.js       # 训练前后对比卡片
├─ voice.js         # TTS / ASR
├─ director.js      # 导演模式抽屉
└─ index.mjs        # ESM 入口
```

无第三方依赖，不需要 `npm install`。

---

## 2. 最小接入（Vite / ESM）

```js
// main.js
import "./ui/hud.css";
import { createHud } from "./ui/index.mjs";
import { bus } from "./core/bus.js";

const hud = createHud({
  bus,
  root: document.body,
  welcomeText: "我在呢。要找什么？",
});

// 场景 / 状态机 / 记忆模块照常 emit：
bus.emit("memory:update", { layoutId: "A", objects: memoryList });
bus.emit("robot:state", { state: "idle", text: "待机 · 我在呢" });
```

`createHud` 返回：

```js
{
  el,          // .ht-ui 根节点
  chat, status, memory, timeline, compare, voice, director,
  destroy()
}
```

---

## 3. 非构建页面

按顺序加载：

```html
<link rel="stylesheet" href="./ui/hud.css" />
<script src="./ui/chat.js"></script>
<script src="./ui/status.js"></script>
<script src="./ui/memory-panel.js"></script>
<script src="./ui/timeline.js"></script>
<script src="./ui/compare.js"></script>
<script src="./ui/voice.js"></script>
<script src="./ui/director.js"></script>
<script src="./ui/hud.js"></script>
<script>
  const hud = HomeTwinUI.createHud({
    bus: myBus,
    root: document.body,
    welcomeText: "我在呢。要找什么？",
    layoutName: "布局 A",
  });
</script>
```

---

## 4. 事件接线

完整字段见 `contracts/events.md`。

必需事件：

```js
robot:state
task:start / task:step / task:end / task:reset
plan:received / plan:degraded
memory:update / memory:highlight / memory:toggle
chat:message / chat:typing / chat:clear
found
compare:update
layout:change
offline:change
toast
```

UI 发出：

```js
ui:query
ui:voice
ui:focusObject
ui:director
ui:foundAction
ui:compareClose
```

### 示例：把记忆面板接上

```js
// 任务开始时拉全量
bus.emit("memory:update", {
  layoutId: currentLayout,
  objects: await fetch("/memory?layout_id=A").then(r => r.json()).then(d => Object.values(d.objects)),
});
```

### 示例：把时间线接上

```js
async function runStep(index, action, label, targetLabel, fn) {
  bus.emit("task:step", {
    index, total, action, label, targetLabel,
    status: "active", sub: "",
  });
  const t0 = performance.now();
  try {
    await fn();
    bus.emit("task:step", {
      index, total, action, label, targetLabel,
      status: "done", durationMs: performance.now() - t0,
    });
  } catch (e) {
    bus.emit("task:step", {
      index, total, action, label, targetLabel,
      status: "error", durationMs: performance.now() - t0, sub: String(e),
    });
    throw e;
  }
}
```

---

## 5. 样式定制

所有 token 在 `hud.css` 的 `:root`：

```css
:root {
  --ht-brand: #e8643a;
  --ht-green: #3e9b6d;
  --ht-amber: #d89a2b;
  --ht-paper: #fffaf3;
  --ht-ink: #2b211b;
}
```

- 换品牌色只改 `--ht-brand` / `--ht-brand-deep` / `--ht-brand-soft`。
- 场景更亮时，可把 `--ht-card` 提到 0.96、加 1px 白色描边。
- 不要改 `.ht-` 前缀类名，预览与文档依赖它。

---

## 6. 回调 / 导演模式

`ui:director` 的 action 由业务层处理：

```js
bus.on("ui:director", ({ action, enabled }) => {
  switch (action) {
    case "script:memory": return runDemo("memory");
    case "script:moved": return runDemo("moved");
    case "script:correct": return runDemo("correct");
    case "script:compare": return showCompare();
    case "script:layoutB": return switchLayout("B");
    case "script:offline": return setOffline(true);
    case "scene:reset": return resetScene();
    case "clear": return clearMemory();
    case "reset": return resetAll();
    case "memory:toggle": return setMemoryEnabled(enabled);
  }
});
```

---

## 7. 语音

- TTS：`speechSynthesis`；默认关闭，用户点扬声器开启，偏好存 `localStorage["hometwin.voice"]`。
- ASR：`SpeechRecognition` / `webkitSpeechRecognition`；不支持时按钮 disabled。
- 识别结果通过 `ui:voice` 发出；Chat 负责转成 `ui:query`。
- 注意：部分浏览器的 ASR 需要联网；纯离线场景以文字输入为主。

---

## 8. 浏览器支持

- Chrome / Edge 最新版（推荐）。
- Safari：布局与 TTS 可用；ASR 支持不稳定。
- Firefox：ASR 通常不可用；TTS 可用。
- 不支持 `backdrop-filter` 时卡片会退化为半透明纯色，不影响功能。

---

## 9. 预览与调试

```bash
# 直接双击
web/preview/index.html

# 关闭自动演示
web/preview/index.html?auto=0

# 自动跑某条旅程
?auto=memory|first|moved|correct|compare|layoutB|offline|move

# 输出布局测量
?debug=1
```

预览中的 `scene.js` 只是 HUD 底图；生产环境请替换为团队的 three.js 场景。
