// @vitest-environment jsdom
// HUD 组件依赖 DOM；设计 A 的导航/机器人测试依赖 node 环境，故按文件声明环境。
import { afterEach, describe, expect, it } from "vitest";
import { createHud } from "./index.mjs";

class TestBus {
  constructor() { this.map = new Map(); }
  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, new Set());
    this.map.get(name).add(fn);
  }
  off(name, fn) { const set = this.map.get(name); if (set) set.delete(fn); }
  emit(name, payload) {
    const set = this.map.get(name);
    if (set) Array.from(set).forEach((fn) => fn(payload));
  }
}

function mount() {
  const bus = new TestBus();
  const root = document.createElement("div");
  document.body.appendChild(root);
  const hud = createHud({ bus, root, catalog: { cup_red: { name: "红色水杯" } } });
  return { bus, hud };
}

afterEach(() => { document.body.innerHTML = ""; });

describe("Timeline · ok / failed / malformed", () => {
  it("shows successful steps as done", () => {
    const { bus, hud } = mount();
    bus.emit("task:start", { taskId: "t1", query: "找水杯", source: "rule" });
    bus.emit("task:step", { taskId: "t1", index: 0, action: "go", target: "客厅", ok: true, ms: 800 });
    const items = hud.el.querySelectorAll(".ht-tl-item");
    expect(items.length).toBe(1);
    expect(items[0].classList.contains("is-done")).toBe(true);
    expect(items[0].classList.contains("is-error")).toBe(false);
    expect(items[0].querySelector(".ht-tl-time").textContent).toBe("800ms");
    hud.destroy();
  });

  it("shows ok:false as failed instead of done", () => {
    const { bus, hud } = mount();
    bus.emit("task:start", { taskId: "t1", query: "找水杯", source: "rule" });
    bus.emit("task:step", { taskId: "t1", index: 1, action: "verify", target: "cup_red", ok: false, ms: 500 });
    const item = hud.el.querySelector(".ht-tl-item");
    expect(item.classList.contains("is-error")).toBe(true);
    expect(item.classList.contains("is-done")).toBe(false);
    expect(item.querySelector(".ht-tl-sub").textContent).toContain("失败");
    hud.destroy();
  });

  it("marks missing ok/index as payload errors", () => {
    const { bus, hud } = mount();
    bus.emit("task:start", { taskId: "t1", query: "找水杯", source: "rule" });
    bus.emit("task:step", { taskId: "t1", index: 2, action: "go", target: "客厅", ms: 300 });
    bus.emit("task:step", { taskId: "t1", action: "go" });
    const items = hud.el.querySelectorAll(".ht-tl-item");
    expect(items.length).toBe(2);
    items.forEach((item) => {
      expect(item.classList.contains("is-error")).toBe(true);
      expect(item.querySelector(".ht-tl-sub").textContent).toBe("步骤载荷异常");
    });
    hud.destroy();
  });

  it("does not turn a failed task into a completed summary", () => {
    const { bus, hud } = mount();
    bus.emit("plan:received", { source: "rule", steps: [{}, {}, {}, {}] });
    bus.emit("task:start", { taskId: "t1", query: "找水杯", source: "rule" });
    bus.emit("task:step", { taskId: "t1", index: 0, action: "go", target: "客厅", ok: true, ms: 800 });
    bus.emit("task:step", { taskId: "t1", index: 1, action: "verify", target: "cup_red", ok: false, ms: 500 });
    bus.emit("task:end", { taskId: "t1", ok: false, steps: 1, durationMs: 1300, corrected: false });
    const summary = hud.el.querySelector(".ht-tl-summary");
    expect(summary.classList.contains("is-error")).toBe(true);
    expect(summary.textContent).toContain("任务中断");
    expect(summary.textContent).toContain("1/4");
    expect(hud.el.querySelector(".ht-tl-item:nth-of-type(2)").classList.contains("is-done")).toBe(false);
    hud.destroy();
  });
});
