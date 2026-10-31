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
  const hud = createHud({ bus, root });
  return { bus, hud };
}

function run(bus, taskId, query, memoryEnabled, steps, durationMs) {
  bus.emit("plan:request", { query, memoryEnabled });
  bus.emit("task:start", { taskId, query, source: "rule" });
  bus.emit("task:end", { taskId, ok: true, steps, durationMs, corrected: false });
}

afterEach(() => { document.body.innerHTML = ""; });

describe("Compare · no fake data", () => {
  it("shows an explicit empty state when no task logs exist", () => {
    const { hud } = mount();
    hud.compare.open();
    expect(hud.el.querySelector(".ht-compare").classList.contains("is-open")).toBe(true);
    expect(hud.el.querySelector(".ht-compare").classList.contains("is-empty")).toBe(true);
    expect(hud.el.querySelector(".ht-compare-empty").hidden).toBe(false);
    expect(hud.el.querySelector(".ht-compare-empty").textContent).toContain("暂无对比数据");
    expect(hud.el.querySelector(".ht-compare-col.on .big").textContent).toBe("—");
    hud.destroy();
  });

  it("builds a real pair from task:end events, not hardcoded numbers", () => {
    const { bus, hud } = mount();
    run(bus, "a", "帮我找红色水杯", true, 4, 5600);
    run(bus, "b", "帮我找红色水杯", false, 8, 18400);
    hud.compare.open();
    expect(hud.el.querySelector(".ht-compare").classList.contains("is-empty")).toBe(false);
    expect(hud.el.querySelector(".ht-compare-col.on .big").textContent).toContain("4");
    expect(hud.el.querySelector(".ht-compare-col.off .big").textContent).toContain("8");
    expect(hud.el.querySelector(".ht-compare-col.on .v-time").textContent).toBe("5.6s");
    expect(hud.el.querySelector(".ht-compare-col.off .v-time").textContent).toBe("18.4s");
    expect(hud.el.querySelector(".ht-compare-note").textContent).toContain("task:end");
    hud.destroy();
  });

  it("rejects partial data instead of filling defaults", () => {
    const { hud } = mount();
    const ok = hud.compare.setData({ memoryOn: { steps: 4 }, memoryOff: { steps: 8 } }, {});
    expect(ok).toBe(false);
    expect(hud.el.querySelector(".ht-compare").classList.contains("is-empty")).toBe(true);
    expect(hud.el.querySelector(".ht-compare-col.on .big").textContent).toBe("—");
    hud.destroy();
  });

  it("ignores task:end without duration/steps for comparison", () => {
    const { bus, hud } = mount();
    bus.emit("plan:request", { query: "找水杯", memoryEnabled: true });
    bus.emit("task:start", { taskId: "a", query: "找水杯", source: "rule" });
    bus.emit("task:end", { taskId: "a", ok: true, steps: 4, corrected: false });
    hud.compare.open();
    expect(hud.el.querySelector(".ht-compare").classList.contains("is-empty")).toBe(true);
    hud.destroy();
  });
});
