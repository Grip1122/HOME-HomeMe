// @vitest-environment node
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const sources = ["memory.js", "agent.js", "app.js"].map((name) => ({
  name,
  code: readFileSync(new URL("./" + name, import.meta.url), "utf8"),
}));
const copy = (value) => JSON.parse(JSON.stringify(value));

function element() {
  const classes = new Set();
  const parts = new Map();
  let html = "";
  return {
    children: [],
    style: {},
    dataset: {},
    textContent: "",
    value: "",
    disabled: false,
    focus: vi.fn(),
    addEventListener: vi.fn(),
    classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle(name, force) {
        const enabled = force === undefined ? !classes.has(name) : force;
        if (enabled) classes.add(name);
        else classes.delete(name);
        return enabled;
      },
    },
    set className(value) {
      classes.clear();
      value.split(/\s+/).filter(Boolean).forEach((name) => classes.add(name));
    },
    get className() {
      return [...classes].join(" ");
    },
    set innerHTML(value) {
      html = value;
      this.children = [];
      parts.clear();
    },
    get innerHTML() {
      return html;
    },
    appendChild(child) {
      this.children.push(child);
    },
    querySelector(selector) {
      if (selector === ".timeline-empty") return null;
      if (!parts.has(selector)) parts.set(selector, element());
      return parts.get(selector);
    },
    querySelectorAll() {
      return [];
    },
  };
}

function loadApp(overrides = {}) {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
      this.set(x, y, z);
    }
    set(x, y, z) {
      Object.assign(this, { x, y, z });
      return this;
    }
    clone() {
      return new Vector3(this.x, this.y, this.z);
    }
  }
  class BufferGeometry {
    constructor() {
      this.dispose = vi.fn();
    }
    setFromPoints(points) {
      this.points = points;
      return this;
    }
  }
  class LineDashedMaterial {
    constructor() {
      this.dispose = vi.fn();
    }
  }
  class Line {
    constructor(geometry, material) {
      Object.assign(this, { geometry, material });
    }
    computeLineDistances() {}
  }
  const RF = {
    config: { autoStart: false },
    ease: { linear: (v) => v, inOutQuad: (v) => v, inOutCubic: (v) => v },
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
    angleLerp: (start, end, t) => start + (end - start) * t,
    formatTime: () => "12:00",
    formatNumber: (v) => String(v),
    formatBytes: (v) => v + " B",
    quantizeSplatData: (data) => ({ count: data.count }),
    ...overrides,
  };
  const nodes = new Map();
  const document = {
    createElement: () => element(),
    getElementById(id) {
      if (!nodes.has(id)) nodes.set(id, element());
      return nodes.get(id);
    },
    querySelectorAll: () => [],
  };
  const window = {
    RF,
    THREE: { Vector3, BufferGeometry, LineDashedMaterial, Line },
    addEventListener: vi.fn(),
    confirm: vi.fn(() => true),
  };
  const sandbox = {
    window,
    document,
    console: { error: vi.fn(), warn: vi.fn() },
    performance: { now: () => 0 },
    requestAnimationFrame: vi.fn(),
  };
  vm.createContext(sandbox);
  for (const source of sources) vm.runInContext(source.code, sandbox, { filename: source.name });
  return { RF, window, document, sandbox };
}

function harness({ moved = false, enabled = true, ready = true, persisted = true } = {}) {
  const h = loadApp();
  const { RF } = h;
  const app = Object.create(RF.App.prototype);
  Object.assign(app, {
    started: true,
    busy: false,
    state: "idle",
    memoryReady: ready,
    scannedRooms: [ready, ready, ready],
    roomProgress: [1, 1, 1],
    actions: [],
    stepCount: 0,
    lastStepCount: 0,
    sdWriteFailed: false,
    foundId: null,
    lastTargetId: null,
    activeRoom: -1,
    robotSpeed: 0,
    robotScanning: false,
    robotLookDown: false,
    pathLine: null,
  });
  app.bindDom();
  app.dom.scanToast.classList.add("hidden");
  const target = {
    id: "cup_red",
    name: "红色杯子",
    category: "杯子",
    aliases: ["水杯"],
    colorName: "红",
    color: "#d9534a",
    shape: "圆柱",
    size: "小",
    room: "客厅",
    roomIndex: 0,
    homePos: [-6, 0.55, -1],
    homeRoom: "客厅",
    homeRoomIndex: 0,
    currentPos: [-6, 0.55, -1],
    currentRoom: "客厅",
    currentRoomIndex: 0,
    furniture: "茶几",
    currentFurniture: "茶几",
    alt: [1, 0.55, 2],
    altFurniture: "梳妆台",
    approach: [-6, 0.15],
    splatCount: 5,
    splats: { data: { count: 5 }, setReveal: vi.fn(), setHighlight: vi.fn() },
  };
  app.world = {
    objectList: [target],
    getObject: (id) => id === target.id ? target : null,
    robot: {
      group: { position: { x: 0, y: 0, z: 0 }, rotation: { y: 0 } },
      setState: vi.fn(),
    },
    roomCenters: [
      { name: "客厅", x: -5.8, z: 0.2, scanX: -5.7, scanZ: 0.55 },
      { name: "卧室", x: 0.8, z: 0.2, scanX: 0.6, scanZ: 0.7 },
      { name: "书房", x: 7, z: 0.2, scanX: 7, scanZ: 0.7 },
    ],
    roomSplats: { setProgress: vi.fn(), setAllProgress: vi.fn() },
    roomSplatData: { count: 30 },
    roomSplatCounts: [10, 10, 10],
    fxGroup: { add: vi.fn(), remove: vi.fn() },
    nav: {
      nearestFreeWorld: vi.fn((x, z) => ({ x, z })),
      findPath: vi.fn((start, end) => [start, end]),
    },
    moveObjectTo: vi.fn((id, pos, room, roomIndex, furniture) => {
      Object.assign(target, {
        currentPos: pos.slice(),
        currentRoom: room,
        currentRoomIndex: roomIndex,
        currentFurniture: furniture,
      });
      return target;
    }),
    resetObject: vi.fn(),
  };
  app.memory = new RF.SpatialMemory();
  app.memory.setEnabled(enabled);
  if (ready) app.memory.ingest("客厅", 0, [target], 0.8);
  if (moved) app.world.moveObjectTo(target.id, target.alt, "卧室", 1, target.altFurniture);
  app.agent = new RF.Agent([{ ...target, currentPos: target.homePos.slice() }]);
  app.tween = {
    delay: vi.fn(async () => {}),
    add: vi.fn((options) => {
      if (options.onUpdate) options.onUpdate(1);
      options.onComplete();
    }),
  };
  app.rig = { followRobot: vi.fn(), overview: vi.fn() };
  app.say = vi.fn();
  app.toast = vi.fn();
  app.showReasoning = vi.fn();
  app.showFoundFx = vi.fn();
  app.clearFound = vi.fn(() => {
    app.foundId = null;
    app.dom.objectLabel.classList.add("hidden");
  });
  app.renderMemoryList = vi.fn(() => app.updateStats());
  app.updateRoomLabels = vi.fn();
  app.setViewMode = vi.fn();
  app.sd = {
    info: { bytes: 40, splats: 35, alg: "AES-256-GCM", percent: 1, persisted: true },
    status: vi.fn(() => ({ ...app.sd.info })),
    save: vi.fn(async () => {
      app.sd.info = { ...app.sd.info, persisted };
      return { ...app.sd.info };
    }),
    erase: vi.fn(async () => {
      app.sd.info = { ...app.sd.info, bytes: 0, persisted: false };
    }),
  };
  app.initDebugAPI();
  return { ...h, app, target };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function steps(app, title) {
  return (app._timelineSteps || []).filter((step) => step.querySelector(".tl-title").textContent.startsWith(title));
}

function expectFailed(step) {
  expect(step.classList.contains("error")).toBe(true);
  expect(step.classList.contains("done")).toBe(false);
  expect(step.classList.contains("active")).toBe(false);
}

function expectClean(app) {
  expect(app.busy).toBe(false);
  expect(app.activeRoom).toBe(-1);
  expect(app.robotSpeed).toBe(0);
  expect(app.robotScanning).toBe(false);
  expect(app.robotLookDown).toBe(false);
  expect(app.pathLine).toBeNull();
  expect(app.dom.scanToast.classList.contains("hidden")).toBe(true);
  expect(app.dom.input.disabled).toBe(false);
  expect(app.world.robot.setState).toHaveBeenLastCalledWith("idle");
}

function messages(app) {
  return [
    ...app.toast.mock.calls.map((args) => args[0]),
    ...app.say.mock.calls.map((args) => args[0]),
    ...(app._timelineSteps || []).map((step) => step.querySelector(".tl-sub").textContent),
    app.dom.sdStatus.textContent,
  ].join("\n");
}

describe("RF.App 启动接线", () => {
  it("autoStart=false 只暴露 App，不构造场景或启动动画", () => {
    const createWorld = vi.fn();
    const h = loadApp({ createWorld });
    expect(typeof h.RF.App).toBe("function");
    expect(createWorld).not.toHaveBeenCalled();
    expect(h.window.__app).toBeUndefined();
    expect(h.sandbox.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it.each([undefined, {}, { autoStart: true }])("默认仍构造并优先继承 createWorld 工厂：%j", (config) => {
    const createWorld = vi.fn(() => { throw new Error("工厂调用探针"); });
    const World = vi.fn();
    const h = loadApp({ config, createWorld, World });
    expect(createWorld).toHaveBeenCalledExactlyOnceWith(h.document.getElementById("scene"));
    expect(World).not.toHaveBeenCalled();
    expect(h.document.getElementById("fatal-msg").textContent).toContain("工厂调用探针");
  });

  it("没有工厂时仍使用 RF.World", () => {
    const World = vi.fn(function () { throw new Error("World 调用探针"); });
    const h = loadApp({ config: {}, World });
    expect(World).toHaveBeenCalledExactlyOnceWith(h.document.getElementById("scene"));
  });
});

describe("记忆路线与复核", () => {
  it("移动后先导航、朝向旧快照，复核失败才复扫并导航新位置", async () => {
    const { app, target } = harness({ moved: true });
    const old = copy(app.memory.get(target.id));
    const approach = vi.spyOn(app, "navigateToApproach");
    const turns = vi.spyOn(app, "turnTo");
    const scan = vi.spyOn(app, "_scanAllInternal");
    const verify = vi.spyOn(app.memory, "verify");
    const result = await app.runQuery("红色杯子");
    expect(result.ok).toBe(true);
    expect(approach).toHaveBeenCalledTimes(2);
    const first = approach.mock.calls[0][0];
    expect(first).not.toBe(target);
    expect(first.currentPos).toEqual(old.pos);
    expect(first.currentRoom).toBe(old.room);
    expect(first.currentRoomIndex).toBe(old.roomIndex);
    expect(first.currentFurniture).toBe(old.furniture);
    expect(first.currentPos).not.toBe(app.memory.get(target.id).pos);
    expect(turns.mock.calls[0]).toEqual([old.pos[0], old.pos[2]]);
    expect(app.world.nav.findPath.mock.calls[0][1]).toEqual({ x: target.approach[0], z: target.approach[1] });
    expect(scan).toHaveBeenCalledExactlyOnceWith({ nested: true, staleRecovery: true });
    expect(verify.mock.invocationCallOrder[0]).toBeLessThan(scan.mock.invocationCallOrder[0]);
    expect(scan.mock.invocationCallOrder[0]).toBeLessThan(approach.mock.invocationCallOrder[1]);
    expect(approach.mock.calls[1][0]).toMatchObject({
      currentPos: target.alt,
      currentRoom: "卧室",
      currentRoomIndex: 1,
      currentFurniture: "梳妆台",
    });
    expect(turns.mock.calls[1]).toEqual([target.alt[0], target.alt[2]]);
    const checks = steps(app, "视觉复核");
    expect(checks).toHaveLength(2);
    expectFailed(checks[0]);
    expect(checks[1].classList.contains("done")).toBe(true);
    expect(app.actions.filter((a) => a.action === "verify").map((a) => a.ok)).toEqual([false, true]);
    expect(app.showFoundFx).toHaveBeenCalledTimes(1);
    expectClean(app);
  });

  it("记忆快照不借用实时位置字段，也不随记忆或物体后续变动", () => {
    const { app, target } = harness();
    const rec = app.memory.get(target.id);
    const expected = copy(rec);
    for (const name of ["currentPos", "currentRoom", "currentRoomIndex", "currentFurniture"]) {
      Object.defineProperty(target, name, { get() { throw new Error("不可提前读取实时位置"); } });
    }
    const snapshot = app.navigationTarget(target, rec);
    rec.pos[0] = 100;
    rec.room = "书房";
    rec.roomIndex = 2;
    rec.furniture = "书桌";
    target.homePos[0] = 90;
    target.approach[0] = 80;
    expect(snapshot.currentPos).toEqual(expected.pos);
    expect(snapshot.currentRoom).toBe(expected.room);
    expect(snapshot.currentRoomIndex).toBe(expected.roomIndex);
    expect(snapshot.currentFurniture).toBe(expected.furniture);
    expect(snapshot.homePos[0]).toBe(-6);
    expect(snapshot.approach[0]).toBe(-6);
  });

  it.each([0, 1, 2])("同房间但坐标第 %i 轴不同，不复用 home approach", (axis) => {
    const { app, target } = harness();
    const destination = app.navigationTarget(target, app.memory.get(target.id));
    expect(app.findApproach(destination)).toEqual({ x: -6, z: 0.15 });
    destination.currentPos[axis] += 2;
    const [x, , z] = destination.currentPos;
    const room = app.world.roomCenters[destination.currentRoomIndex];
    const len = Math.hypot(room.x - x, room.z - z);
    expect(app.findApproach(destination)).toEqual({
      x: x + ((room.x - x) / len) * 1.15,
      z: z + ((room.z - z) / len) * 1.15,
    });
  });

  it("二次复核仍失败时保留两个红色步骤，绝不报告找到", async () => {
    const { app } = harness({ moved: true });
    app.memory.verify = vi.fn(() => ({ ok: false, distance: 5 }));
    const result = await app.runQuery("红色杯子");
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("仍未确认") });
    const checks = steps(app, "视觉复核");
    expect(checks).toHaveLength(2);
    checks.forEach(expectFailed);
    app.completeStep(checks[0], "不应抹绿");
    expectFailed(checks[0]);
    expect(checks[0].querySelector(".tl-sub").textContent).toContain("记忆过期");
    expect(app.showFoundFx).not.toHaveBeenCalled();
    expect(app.foundId).toBeNull();
    expect(app.actions.some((a) => a.action === "found")).toBe(false);
    expect(app.actions.filter((a) => a.action === "verify").map((a) => a.ok)).toEqual([false, false]);
    expect(app.toast.mock.calls.some(([text]) => text.startsWith("已找到"))).toBe(false);
    expect(app.state).toBe("error");
    expectClean(app);
  });

  it("复核比对本次导航快照，不被导航期间更新的记忆误导", async () => {
    const { app, target } = harness();
    const destination = app.navigationTarget(target, app.memory.get(target.id));
    app.world.moveObjectTo(target.id, target.alt, "卧室", 1, "梳妆台");
    app.memory.correct(target.id, target.alt, "卧室", 1, "梳妆台");
    const result = await app.verifyTarget(target, destination);
    expect(result.ok).toBe(false);
    expect(app.actions).toMatchObject([{ action: "verify", ok: false, room: "客厅" }]);
  });
});

describe("不可达与单飞清理", () => {
  it.each(["point", "nearest", "path", "empty"])("%s 不可达必须抛错，不记到达动作", async (failure) => {
    const { app } = harness();
    if (failure === "nearest") app.world.nav.nearestFreeWorld.mockReturnValue(null);
    if (failure === "path") app.world.nav.findPath.mockReturnValue(null);
    if (failure === "empty") app.world.nav.findPath.mockReturnValue([]);
    await expect(app.navigateTo(failure === "point" ? null : { x: 3, z: 2 })).rejects.toThrow("导航不可达");
    expect(app.actions).toEqual([]);
    expect(app.tween.add).not.toHaveBeenCalled();
    if (failure === "point" || failure === "nearest") expect(app.world.nav.findPath).not.toHaveBeenCalled();
  });

  it("接近点为空时通过任务错误可见，不把导航步骤标为到达", async () => {
    const { app } = harness();
    app.world.nav.nearestFreeWorld.mockReturnValue(null);
    const result = await app.runQuery("红色杯子");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("导航不可达");
    const nav = steps(app, "导航至")[0];
    expectFailed(nav);
    expect(nav.querySelector(".tl-sub").textContent).not.toContain("已到达");
    expect(app.toast).toHaveBeenCalledWith(expect.stringContaining("导航不可达"), "error", 6000);
    expect(app.actions).toEqual([]);
    expect(app.showFoundFx).not.toHaveBeenCalled();
    expectClean(app);
  });

  it.each(["success", "reject", "throw"])("单飞锁与 %s 收尾均清理扫描、路径和速度", async (outcome) => {
    const { app } = harness();
    const entered = deferred();
    const gate = deferred();
    const step = app.addStep("待执行动作", "执行中");
    const line = { geometry: { dispose: vi.fn() }, material: { dispose: vi.fn() } };
    const first = app.runExclusive(() => {
      app.activeRoom = 2;
      app.robotScanning = true;
      app.robotLookDown = true;
      app.robotSpeed = 3;
      app.pathLine = line;
      app.dom.scanToast.classList.remove("hidden");
      entered.resolve();
      if (outcome === "throw") throw new Error("同步失败");
      return gate.promise;
    });
    expect(app.busy).toBe(true);
    const second = vi.fn();
    expect(await app.runExclusive(second)).toEqual({ ok: false, busy: true });
    expect(second).not.toHaveBeenCalled();
    await entered.promise;
    if (outcome === "success") gate.resolve({ ok: true });
    if (outcome === "reject") gate.reject(new Error("异步失败"));
    const result = await first;
    expect(result.ok).toBe(outcome === "success");
    if (outcome !== "success") expectFailed(step);
    expect(app.world.fxGroup.remove).toHaveBeenCalledWith(line);
    expect(line.geometry.dispose).toHaveBeenCalledTimes(1);
    expect(line.material.dispose).toHaveBeenCalledTimes(1);
    expectClean(app);
  });

  it("异常前没有活动步骤也新增红色失败记录", async () => {
    const { app } = harness();
    await app.runExclusive(() => { throw new Error("启动失败"); });
    expectFailed(steps(app, "任务失败")[0]);
    expectClean(app);
  });
});

describe("实际动作记录", () => {
  it("导航完成才记动作；同格零长度成功也与不可达区分", async () => {
    const { app } = harness();
    let tween;
    app.tween.add.mockImplementation((options) => { tween = options; });
    const navigation = app.navigateTo({ x: 3, z: 4 });
    expect(app.actions).toEqual([]);
    tween.onUpdate(1);
    tween.onComplete();
    await navigation;
    expect(app.actions).toEqual([{ action: "go", from: { x: 0, z: 0 }, to: { x: 3, z: 4 }, distance: 5 }]);
    app.world.nav.findPath.mockReturnValue([{ x: 3, z: 4 }]);
    await app.navigateTo({ x: 3, z: 4 });
    expect(app.actions[1]).toMatchObject({ action: "go", distance: 0 });
    expect(app.stepCount).toBe(2);
  });

  it("扫描和复核抛错前未完成的动作不计入", async () => {
    const { app, target } = harness();
    app.memory.ingest = vi.fn(() => { throw new Error("扫描中断"); });
    expect((await app.runExclusive(() => app.scanRoom(0))).ok).toBe(false);
    expect(app.actions).toEqual([]);
    expectFailed(steps(app, "扫描")[0]);
    app.memory.verify = vi.fn(() => { throw new Error("复核中断"); });
    await expect(app.verifyTarget(target, app.navigationTarget(target, app.memory.get(target.id)))).rejects.toThrow("复核中断");
    expect(app.actions).toEqual([]);
  });

  it("真实直达为 go/verify/found，不采纳 planner 虚构动作数，导出为深快照", async () => {
    const { app, target, window } = harness();
    const plan = app.agent.plan.bind(app.agent);
    vi.spyOn(app.agent, "plan").mockImplementation((...args) => ({ ...plan(...args), actionCount: 999 }));
    const result = await app.runQuery("红色杯子");
    expect(result.stepCount).toBe(3);
    expect(app.actions.map((a) => a.action)).toEqual(["go", "verify", "found"]);
    expect(app.actions[1].ok).toBe(true);
    expect(window.__demo.getStepCount()).toBe(app.actions.length);
    expect(app.dom.stepCount.textContent).toBe("3 动作");
    const original = copy(app.actions);
    const snapshot = window.__demo.getActions();
    snapshot[0].to.x = 1000;
    snapshot[2].pos[0] = 1000;
    snapshot.push({ action: "伪造" });
    target.currentPos[0] = 2000;
    expect(window.__demo.getActions()).toEqual(original);
    expect(app.actions).toEqual(original);
  });

  it.each([{ enabled: false, ready: true }, { enabled: true, ready: false }])("无记忆路径逐区记录导航和扫描，比直达动作更多：%j", async (options) => {
    const { app, window } = harness(options);
    app.addAction("上次任务");
    const result = await app.runQuery("红色杯子");
    expect(result.ok).toBe(true);
    expect(window.__demo.getActions().map((a) => a.action)).toEqual([
      "go", "scan", "go", "scan", "go", "scan", "go", "verify", "found",
    ]);
    expect(app.actions.filter((a) => a.action === "scan").map((a) => a.roomIndex)).toEqual([0, 1, 2]);
    expect(result.stepCount).toBe(app.actions.length);
    expect(result.stepCount).toBeGreaterThan(3);
    expect(app.lastStepCount).toBe(app.stepCount);
  });

  it("全屋扫描与下一次无法解析的查询均重置上次动作", async () => {
    const { app } = harness();
    await app.runQuery("红色杯子");
    await app.scanAll();
    expect(app.actions.map((a) => a.action)).toEqual(["go", "scan", "go", "scan", "go", "scan"]);
    expect((await app.runQuery("完全无法识别的描述")).ok).toBe(false);
    expect(app.actions).toEqual([]);
    expect(app.stepCount).toBe(0);
    expect(app.lastStepCount).toBe(0);
  });
});

describe("SD 状态与异步写入", () => {
  it("quiet 保存成功也记录存储步骤，但不弹成功 toast", async () => {
    const { app } = harness();
    const meta = await app.savePack({ quiet: true });
    expect(meta.persisted).toBe(true);
    expect(app.dom.sdStatus.textContent).toContain("已写入");
    expect(steps(app, "写入机身 SD 卡")[0].classList.contains("done")).toBe(true);
    expect(app.toast).not.toHaveBeenCalled();
    expect(app.actions).toEqual([]);
  });

  it.each([false, true])("persisted=false 时 UI、toast、timeline 不宣称已写入，quiet=%s", async (quiet) => {
    const { app } = harness({ persisted: false });
    app.sd.info.alg = "XOR-256 (demo fallback)";
    const meta = await app.savePack({ quiet });
    expect(meta.persisted).toBe(false);
    expect(app.dom.sdStatus.textContent).toContain("写入失败");
    expect(app.dom.sdLock.textContent).toBe("XOR");
    expect(app.dom.btnExport.disabled).toBe(false);
    expectFailed(steps(app, "写入机身 SD 卡")[0]);
    expect(app.toast).toHaveBeenCalledWith(expect.stringContaining("仅在本次会话"), "warn", 5000);
    expect(messages(app)).not.toMatch(/已写入|保存到机身 SD 卡/);
  });

  it("仅凭 status.persisted=false 也不会把有字节的会话包当成已落盘", () => {
    const { app } = harness();
    app.sd.info.persisted = false;
    app.updateSDUI();
    expect(app.dom.sdStatus.textContent).toContain("未持久化");
    expect(app.dom.sdStatus.textContent).not.toContain("已写入");
  });

  it.each(["memory-only", "reject"])("%s 保存失败不打断扫描后找物，quiet 写入仍可见", async (failure) => {
    const { app } = harness({ enabled: false, persisted: false });
    if (failure === "reject") app.sd.save.mockRejectedValue(new Error("存储不可用"));
    const result = await app.runQuery("红色杯子");
    expect(result.ok).toBe(true);
    expect(app.state).toBe("completed");
    expect(app.showFoundFx).toHaveBeenCalledTimes(1);
    const writes = steps(app, "写入机身 SD 卡");
    expect(writes).toHaveLength(2);
    writes.forEach(expectFailed);
    expect(app.sdWriteFailed).toBe(true);
    expect(app.dom.sdStatus.textContent).toContain("写入失败");
    expect(messages(app)).not.toMatch(/已写入|保存到机身 SD 卡|SD 卡离线命中/);
    expectClean(app);
  });

  it("独立扫描失败落盘后只提示会话记忆，恢复写入后更新真实状态", async () => {
    const { app } = harness({ persisted: false });
    expect((await app.scanAll()).ok).toBe(true);
    expect(messages(app)).not.toMatch(/已写入|保存到机身 SD 卡/);
    expect(app.say).toHaveBeenCalledWith(expect.stringContaining("本次会话"), 6500);
    app.sd.save.mockImplementation(async () => {
      app.sd.info.persisted = true;
      return { ...app.sd.info };
    });
    await app.savePack({ quiet: true });
    expect(app.sdWriteFailed).toBe(false);
    expect(app.dom.sdStatus.textContent).toContain("已写入");
    const writes = steps(app, "写入机身 SD 卡");
    expectFailed(writes[0]);
    expect(writes[1].classList.contains("done")).toBe(true);
  });

  it("清除持锁等待 erase，失败可见且不清空原记忆和 UI", async () => {
    const { app, target } = harness();
    app.foundId = target.id;
    app.addAction("found", { target: target.id });
    app.updateAllUI();
    const before = copy(app.memory.snapshot().objects);
    const status = app.dom.sdStatus.textContent;
    const entered = deferred();
    const gate = deferred();
    app.sd.erase.mockImplementation(() => {
      entered.resolve();
      return gate.promise;
    });
    const clearing = app.clearMemory();
    expect(app.busy).toBe(true);
    await entered.promise;
    expect(app.memoryReady).toBe(true);
    expect(app.foundId).toBe(target.id);
    gate.reject(new Error("SD 卡记忆包擦除失败"));
    expect((await clearing).ok).toBe(false);
    expect(copy(app.memory.snapshot().objects)).toEqual(before);
    expect(app.foundId).toBe(target.id);
    expect(app.memoryReady).toBe(true);
    expect(app.scannedRooms).toEqual([true, true, true]);
    expect(app.roomProgress).toEqual([1, 1, 1]);
    expect(app.actions).toHaveLength(1);
    expect(app.dom.sdStatus.textContent).toBe(status);
    expect(app.clearFound).not.toHaveBeenCalled();
    expect(app.world.resetObject).not.toHaveBeenCalled();
    expect(app.world.roomSplats.setAllProgress).not.toHaveBeenCalled();
    expectFailed(steps(app, "清除机身 SD 卡")[0]);
    expect(app.toast).toHaveBeenCalledWith(expect.stringContaining("擦除失败"), "error", 6000);
    expectClean(app);
  });

  it("erase 成功后才清记忆、重置扫描和动作", async () => {
    const { app } = harness();
    app.addAction("found");
    expect(await app.clearMemory()).toEqual({ ok: true });
    expect(app.memory.all()).toEqual([]);
    expect(app.memoryReady).toBe(false);
    expect(app.roomProgress).toEqual([0, 0, 0]);
    expect(app.scannedRooms).toEqual([false, false, false]);
    expect(app.actions).toEqual([]);
    expect(app.dom.sdStatus.textContent).toBe("等待写入");
    expectClean(app);
  });

  it("纠正 API 可 await，save 结束前阻止再次纠正、查询、移动、扫描和清除", async () => {
    const { app, target, window } = harness();
    const gate = deferred();
    const entered = deferred();
    app.sd.save.mockImplementation(() => {
      entered.resolve();
      return gate.promise;
    });
    const correct = vi.spyOn(app.memory, "correct");
    const saving = app.demoCorrect();
    let settled = false;
    saving.then(() => { settled = true; });
    expect(typeof saving.then).toBe("function");
    expect(app.busy).toBe(true);
    await entered.promise;
    expect(settled).toBe(false);
    expect(app.memory.get(target.id).pos).toEqual(target.alt);
    expect(await app.demoCorrect()).toBeNull();
    expect(await app.runQuery("红色杯子")).toEqual({ ok: false, busy: true });
    expect(await app.scanAll()).toEqual({ ok: false, busy: true });
    await app.clearMemory();
    expect(app.sd.erase).not.toHaveBeenCalled();
    expect(window.__demo.moveObject(target.id, "书房")).toEqual({ ok: false, busy: true });
    expect(app.demoMoveObject(target.id)).toBeNull();
    expect(correct).toHaveBeenCalledTimes(1);
    expect(app.sd.save).toHaveBeenCalledTimes(1);
    expect(app.sd.save.mock.calls[0][0].memory.objects[target.id].pos).toEqual(target.alt);
    gate.resolve({ ...app.sd.info, persisted: true });
    expect(await saving).toMatchObject({ id: target.id, room: "卧室", pos: target.alt, persisted: true });
    expect(settled).toBe(true);
    expectClean(app);
  });

  it.each(["memory-only", "reject"])("纠正保存 %s 不误报持久化，锁最终释放", async (failure) => {
    const { app, target } = harness({ persisted: false });
    if (failure === "reject") app.sd.save.mockRejectedValue(new Error("设备存储失败"));
    const result = await app.demoCorrect();
    expect(result).toMatchObject({ id: target.id, persisted: false });
    expect(app.memory.get(target.id).room).toBe("卧室");
    expect(app.dom.sdStatus.textContent).toContain("写入失败");
    expect(app.toast.mock.calls.at(-1)[0]).toContain("仅本次会话");
    expect(messages(app)).not.toMatch(/已写入|并写入 SD 卡/);
    expectFailed(steps(app, "写入机身 SD 卡")[0]);
    expectClean(app);
  });
});
