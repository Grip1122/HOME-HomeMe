// @vitest-environment jsdom
// HUD 组件依赖 DOM；设计 A 的导航/机器人测试依赖 node 环境，故按文件声明环境。
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createHud } from "./index.mjs";

class RecordingBus {
  constructor() {
    this.handlers = new Map();
    this.used = new Set();
  }
  on(name, fn) {
    this.used.add(name);
    if (!this.handlers.has(name)) this.handlers.set(name, new Set());
    this.handlers.get(name).add(fn);
  }
  off(name, fn) {
    const set = this.handlers.get(name);
    if (set) set.delete(fn);
  }
  emit(name, payload) {
    this.used.add(name);
    const set = this.handlers.get(name);
    if (set) Array.from(set).forEach((fn) => fn(payload));
  }
}

function contractEvents() {
  const text = readFileSync(resolve(process.cwd(), "../contracts/events.md"), "utf8");
  const names = new Set();
  for (const match of text.matchAll(/`([a-z]+:[a-z]+)`/g)) names.add(match[1]);
  return names;
}

afterEach(() => { document.body.innerHTML = ""; });

describe("HUD · event contract compatibility", () => {
  it("only subscribes to and emits event names declared in contracts/events.md", () => {
    const declared = contractEvents();
    const bus = new RecordingBus();
    const root = document.createElement("div");
    document.body.appendChild(root);
    const hud = createHud({
      bus,
      root,
      catalog: { cup_red: { name: "红色水杯" } },
    });

    // Trigger UI-generated contract events.
    const input = hud.el.querySelector(".ht-chat-input");
    input.value = "帮我找红色水杯";
    hud.el.querySelector(".ht-chat-bar").dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    hud.el.querySelector('[data-action="query:first"]').click();
    hud.el.querySelector('[data-action="teleport:moved"]').click();
    hud.el.querySelector('[data-action="reset"]').click();
    hud.el.querySelector(".ht-reset").click();

    expect(bus.used.size).toBeGreaterThan(0);
    for (const name of bus.used) {
      expect(declared.has(name), `undeclared event: ${name}`).toBe(true);
    }

    // Required inbound events used by the HUD must be declared.
    for (const name of [
      "robot:state",
      "task:start",
      "task:step",
      "task:end",
      "task:say",
      "plan:request",
      "plan:received",
      "plan:rejected",
      "memory:updated",
      "memory:hit",
      "memory:miss",
      "robot:blocked",
      "demo:reset",
      "demo:teleport",
    ]) {
      expect(declared.has(name), `contract missing: ${name}`).toBe(true);
    }
    hud.destroy();
  });

  it("uses only contract fields in the status path", () => {
    const bus = new RecordingBus();
    const root = document.createElement("div");
    document.body.appendChild(root);
    const hud = createHud({ bus, root });

    bus.emit("plan:received", { source: "rule", steps: [{}, {}], latencyMs: 10 });
    bus.emit("task:start", { taskId: "t1", query: "找钥匙", source: "rule" });
    bus.emit("robot:state", { from: "idle", to: "walking", step: 0, taskId: "t1" });
    expect(hud.el.querySelector(".ht-state-text").textContent).toContain("前往中");
    bus.emit("task:step", { taskId: "t1", index: 0, action: "go", target: "客厅", ok: true, ms: 500 });
    bus.emit("task:end", { taskId: "t1", ok: true, steps: 1, durationMs: 600, corrected: false });
    expect(hud.el.querySelector(".ht-progress i").style.width).toBe("100%");
    hud.destroy();
  });
});
