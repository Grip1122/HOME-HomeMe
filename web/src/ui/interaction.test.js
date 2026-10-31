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
  const hud = createHud({
    bus,
    root,
    catalog: { cup_red: { name: "红色水杯", color: "#e8643a", furniture: "茶几" } },
  });
  return { bus, hud };
}

afterEach(() => { document.body.innerHTML = ""; });

describe("MemoryPanel · single-record contract", () => {
  it("renders one memory:updated record with catalog labels", () => {
    const { bus, hud } = mount();
    bus.emit("memory:updated", { objectId: "cup_red", room: "客厅", confidence: 0.8, status: "fresh" });
    expect(hud.el.querySelectorAll(".ht-mem-item").length).toBe(1);
    expect(hud.el.querySelector(".ht-count").textContent).toBe("1");
    expect(hud.el.querySelector(".ht-mem-name").textContent).toBe("红色水杯");
    expect(hud.el.querySelector(".ht-mem-room").textContent).toContain("客厅");
    hud.destroy();
  });

  it("updates hit/miss confidence and found/stale state", () => {
    const { bus, hud } = mount();
    bus.emit("memory:updated", { objectId: "cup_red", room: "客厅", confidence: 0.8, status: "fresh" });
    bus.emit("memory:hit", { objectId: "cup_red", confidence: 0.91 });
    expect(hud.el.querySelector(".ht-mem-item").classList.contains("is-found")).toBe(true);
    expect(hud.el.querySelector(".ht-conf-num").textContent).toBe("91%");
    expect(hud.el.querySelector(".ht-found").classList.contains("is-open")).toBe(true);

    bus.emit("memory:miss", { objectId: "cup_red", confidence: 0.45 });
    expect(hud.el.querySelector(".ht-mem-item").classList.contains("is-stale")).toBe(true);
    expect(hud.el.querySelector(".ht-conf-num").textContent).toBe("45%");
    hud.destroy();
  });

  it("ignores malformed memory records without throwing", () => {
    const { bus, hud } = mount();
    bus.emit("memory:updated", { room: "客厅", confidence: 0.8 });
    expect(hud.el.querySelectorAll(".ht-mem-item").length).toBe(0);
    expect(hud.el.querySelector(".ht-count").textContent).toBe("0");
    hud.destroy();
  });
});

describe("Chat · plan:request / task:say / busy", () => {
  it("emits plan:request and renders the user echo", () => {
    const { bus, hud } = mount();
    let request = null;
    bus.on("plan:request", (p) => { request = p; });
    const input = hud.el.querySelector(".ht-chat-input");
    input.value = "帮我找红色水杯";
    hud.el.querySelector(".ht-chat-bar").dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    expect(request).toEqual({ query: "帮我找红色水杯", memoryEnabled: true });
    expect(hud.el.querySelector(".ht-msg.user .ht-bubble").textContent).toContain("帮我找红色水杯");
    expect(input.disabled).toBe(true);
    hud.destroy();
  });

  it("renders task:say robot/user and releases the single-flight lock", () => {
    const { bus, hud } = mount();
    bus.emit("plan:request", { query: "找水杯", memoryEnabled: true });
    bus.emit("task:say", { who: "user", text: "找水杯" });
    bus.emit("task:say", { who: "robot", text: "记忆命中，我过去。" });
    const bubbles = Array.from(hud.el.querySelectorAll(".ht-bubble")).map((el) => el.textContent);
    expect(bubbles.filter((t) => t.includes("找水杯")).length).toBe(1);
    expect(bubbles.some((t) => t.includes("记忆命中"))).toBe(true);

    bus.emit("task:start", { taskId: "t1", query: "找水杯", source: "rule" });
    expect(hud.el.querySelector(".ht-chat-input").disabled).toBe(true);
    bus.emit("task:end", { taskId: "t1", ok: false, steps: 0, durationMs: 500, corrected: false });
    expect(hud.el.querySelector(".ht-chat-input").disabled).toBe(false);
    hud.destroy();
  });
});
