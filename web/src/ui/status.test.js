// @vitest-environment jsdom
// Keep DOM tests scoped to HUD; the repository's A/B tests require node.
import { afterEach, describe, expect, it } from "vitest";
import { createHud } from "./index.mjs";

class TestBus {
  constructor() {
    this.map = new Map();
    this.log = new Set();
  }
  on(name, fn) {
    this.log.add(name);
    if (!this.map.has(name)) this.map.set(name, new Set());
    this.map.get(name).add(fn);
    return () => this.off(name, fn);
  }
  off(name, fn) {
    const set = this.map.get(name);
    if (set) set.delete(fn);
  }
  emit(name, payload) {
    this.log.add(name);
    const set = this.map.get(name);
    if (set) Array.from(set).forEach((fn) => fn(payload));
  }
}

function mount() {
  const bus = new TestBus();
  const root = document.createElement("div");
  document.body.appendChild(root);
  const hud = createHud({
    bus,
    root,
    catalog: { cup_red: { name: "红色水杯", color: "#e8643a", furniture: "茶几" } },
    memoryEnabled: true,
    layoutId: "A",
  });
  return { bus, hud };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Status · official contract", () => {
  it("reads robot:state.to for idle / walking / celebrating / error", () => {
    const { bus, hud } = mount();
    for (const [to, text] of [
      ["idle", "待机"],
      ["walking", "前往中"],
      ["celebrating", "完成"],
      ["error", "异常"],
    ]) {
      bus.emit("robot:state", { from: "idle", to, step: 0, taskId: "t1" });
      expect(hud.el.querySelector(".ht-state-text").textContent).toContain(text);
    }
    hud.destroy();
  });

  it("does not keep a stale success state when to is missing", () => {
    const { bus, hud } = mount();
    bus.emit("robot:state", { from: "idle", to: "walking", step: 0, taskId: "t1" });
    bus.emit("robot:state", { from: "walking", step: 0, taskId: "t1" });
    expect(hud.el.querySelector(".ht-state-text").textContent).toBe("状态未知");
    hud.destroy();
  });

  it("keeps progress below 100% for a failed task", () => {
    const { bus, hud } = mount();
    bus.emit("plan:received", { source: "rule", steps: [{}, {}, {}, {}], latencyMs: 120 });
    bus.emit("task:start", { taskId: "t1", query: "找水杯", source: "rule" });
    bus.emit("task:step", { taskId: "t1", index: 0, action: "go", target: "客厅", ok: true, ms: 800 });
    bus.emit("task:step", { taskId: "t1", index: 1, action: "verify", target: "cup_red", ok: false, ms: 500 });
    expect(hud.el.querySelector(".ht-progress i").style.width).toBe("25%");
    expect(hud.el.querySelector(".ht-state-text").textContent).toContain("步骤失败");

    bus.emit("task:end", { taskId: "t1", ok: false, steps: 1, durationMs: 1300, corrected: false });
    expect(hud.el.querySelector(".ht-progress i").style.width).toBe("25%");
    expect(hud.el.querySelector(".ht-step-indicator").textContent).toContain("任务中断");
    expect(hud.el.querySelector(".ht-state-text").textContent).toContain("任务中断");
    hud.destroy();
  });

  it("sets 100% only for an ok task", () => {
    const { bus, hud } = mount();
    bus.emit("plan:received", { source: "rule", steps: [{}, {}, {}] });
    bus.emit("task:start", { taskId: "t2", query: "找水杯", source: "rule" });
    bus.emit("task:end", { taskId: "t2", ok: true, steps: 3, durationMs: 2400, corrected: false });
    expect(hud.el.querySelector(".ht-progress i").style.width).toBe("100%");
    expect(hud.el.querySelector(".ht-step-indicator").textContent).toContain("任务完成");
    hud.destroy();
  });

  it("handles missing task:end.ok without claiming success", () => {
    const { bus, hud } = mount();
    bus.emit("task:start", { taskId: "t3", query: "x", source: "rule" });
    bus.emit("task:end", { taskId: "t3", steps: 1, durationMs: 500 });
    expect(hud.el.querySelector(".ht-progress i").style.width).not.toBe("100%");
    expect(hud.el.querySelector(".ht-step-indicator").textContent).toContain("状态未知");
    hud.destroy();
  });

  it("marks malformed task:step payloads as data errors", () => {
    const { bus, hud } = mount();
    bus.emit("task:start", { taskId: "t4", query: "x", source: "rule" });
    bus.emit("task:step", { taskId: "t4", action: "go" });
    expect(hud.el.querySelector(".ht-step-indicator").textContent).toBe("步骤数据异常");
    hud.destroy();
  });

  it("shows 规则/纠错 after plan:corrected", () => {
    const { bus, hud } = mount();
    bus.emit("plan:received", { source: "rule", steps: [{}, {}], latencyMs: 120 });
    bus.emit("plan:corrected", { objectId: "cup_red", to: "卧室", source: "corrective" });
    expect(hud.el.querySelector(".ht-source-badge").textContent).toBe("规则/纠错");
    hud.destroy();
  });

  it("does not react to robot:moved at 10 Hz", () => {
    const { bus, hud } = mount();
    bus.emit("plan:received", { source: "rule", steps: [{}, {}], latencyMs: 120 });
    bus.emit("task:start", { taskId: "t5", query: "x", source: "rule" });
    bus.emit("task:step", { taskId: "t5", index: 0, action: "go", target: "x", ok: true, ms: 100 });
    const before = {
      state: hud.el.querySelector(".ht-state-text").textContent,
      step: hud.el.querySelector(".ht-step-indicator").textContent,
      source: hud.el.querySelector(".ht-source-badge").textContent,
      timeline: hud.el.querySelector(".ht-timeline").innerHTML,
    };
    for (let i = 0; i < 100; i++) {
      bus.emit("robot:moved", { pos: [i * 0.01, 0, 0], yaw: 0 });
    }
    expect(hud.el.querySelector(".ht-state-text").textContent).toBe(before.state);
    expect(hud.el.querySelector(".ht-step-indicator").textContent).toBe(before.step);
    expect(hud.el.querySelector(".ht-source-badge").textContent).toBe(before.source);
    expect(hud.el.querySelector(".ht-timeline").innerHTML).toBe(before.timeline);
    hud.destroy();
  });
});
