/* global window, document, location */
(function () {
  "use strict";

  class Bus {
    constructor() { this.map = new Map(); }
    on(name, fn) {
      if (!this.map.has(name)) this.map.set(name, new Set());
      this.map.get(name).add(fn);
      return () => this.off(name, fn);
    }
    off(name, fn) {
      const set = this.map.get(name);
      if (set) set.delete(fn);
    }
    emit(name, payload) {
      const set = this.map.get(name);
      if (set) Array.from(set).forEach((fn) => {
        try { fn(payload); } catch (e) { console.error(e); }
      });
    }
  }

  // PREVIEW ONLY: the legacy mock events used by this demo scene are
  // translated into the official contracts/events.md vocabulary. The
  // production HUD in web/src/ui never subscribes to or emits these names.
  function createPreviewBus(raw) {
    let currentTaskId = null;
    let taskTotal = 0;
    let taskFailed = false;
    let lastState = "idle";
    return {
      on: (name, fn) => raw.on(name, fn),
      off: (name, fn) => raw.off(name, fn),
      emit(name, payload) {
        switch (name) {
          case "memory:update": {
            const objects = (payload && payload.objects) || [];
            if (!objects.length) {
              if (raw.hud) raw.hud.resetMemory();
              return;
            }
            for (const o of objects) {
              raw.emit("memory:updated", {
                objectId: o.object_id,
                room: o.room,
                confidence: o.confidence,
                status: o.status,
              });
            }
            return;
          }
          case "memory:highlight":
            if (raw.hud && raw.hud.memory && payload && payload.objectId) {
              raw.hud.memory.flash(payload.objectId);
            }
            return;
          case "memory:toggle":
            if (raw.hud) raw.hud.setMemoryEnabled(payload && payload.enabled);
            return;
          case "layout:change":
            if (raw.hud) raw.hud.setLayout((payload && (payload.id || payload.name)) || "A");
            return;
          case "offline:change":
            return;
          case "chat:message":
            raw.emit("task:say", {
              text: payload && payload.text,
              who: payload && payload.role === "user" ? "user" : "robot",
            });
            return;
          case "chat:typing":
            return;
          case "chat:clear":
            if (raw.hud) raw.hud.chat.clear();
            return;
          case "task:start":
            currentTaskId = payload.id;
            taskTotal = payload.total || 0;
            taskFailed = false;
            raw.emit("plan:received", {
              source: payload.source || "rule",
              steps: Array.from({ length: taskTotal }, () => ({})),
              latencyMs: 120,
            });
            raw.emit("task:start", { taskId: payload.id, query: payload.query, source: payload.source || "rule" });
            return;
          case "task:step":
            if (!payload || payload.status === "active") return;
            if (payload.status === "error") taskFailed = true;
            raw.emit("task:step", {
              taskId: currentTaskId,
              index: payload.index,
              action: payload.action,
              target: payload.target || payload.targetLabel || "",
              ok: payload.status !== "error",
              ms: payload.durationMs,
            });
            return;
          case "task:end":
            raw.emit("task:end", {
              taskId: payload.id,
              ok: payload.found === true ? true : !taskFailed,
              steps: payload.stepCount === undefined ? taskTotal : payload.stepCount,
              durationMs: payload.durationMs,
              corrected: !!payload.corrected,
            });
            return;
          case "task:reset":
            if (raw.hud) raw.hud.resetTask();
            return;
          case "robot:state": {
            const to = payload && payload.state;
            if (typeof to !== "string") return;
            raw.emit("robot:state", { from: lastState, to, step: 0, taskId: currentTaskId });
            lastState = to;
            return;
          }
          case "toast":
            if (raw.hud) raw.hud.toast(payload && payload.text, payload && payload.type);
            return;
          case "found":
            raw.emit("memory:updated", {
              objectId: payload.objectId,
              room: payload.room,
              confidence: payload.confidence,
              status: "fresh",
            });
            raw.emit("memory:hit", { objectId: payload.objectId, confidence: payload.confidence });
            return;
          case "compare:update":
            if (raw.hud) raw.hud.compare.setData(payload, { preview: true });
            return;
          case "plan:request":
            raw.emit("plan:request", payload);
            return;
          case "demo:reset":
            raw.emit("ui:director", { action: "reset", layoutId: payload && payload.layoutId });
            return;
          case "demo:teleport":
            raw.emit("ui:director", {
              action: "teleport",
              objectId: payload && payload.objectId,
              to: payload && payload.to,
            });
            return;
          case "plan:received":
            return;
          case "ui:query":
            raw.emit("plan:request", { query: payload.text, memoryEnabled: payload.memoryEnabled !== false });
            return;
          case "ui:director":
            raw.emit("ui:director", payload);
            return;
          default:
            raw.emit(name, payload);
        }
      },
    };
  }

  const rawBus = new Bus();
  const bus = createPreviewBus(rawBus);
  const scene = new window.HomeTwinScene(document.getElementById("ht-scene"));
  const root = document.getElementById("ht-root");

  const META = [
    { id: "cup_red", name: "红色水杯", aliases: ["红色水杯", "红色马克杯", "水杯", "杯子", "红杯子", "马克杯"], color: "#e8643a", kind: "cup", shape: "圆柱", size: "小", confidence: 0.86 },
    { id: "remote_black", name: "黑色遥控器", aliases: ["黑色遥控器", "遥控器", "电视遥控器", "黑遥控", "遥控"], color: "#4b5058", kind: "remote", shape: "长方体", size: "小", confidence: 0.78 },
    { id: "key_yellow", name: "黄色钥匙", aliases: ["黄色钥匙", "黄钥匙", "钥匙"], color: "#e3b23c", kind: "key", shape: "长条", size: "小", confidence: 0.72 },
    { id: "book_blue", name: "蓝色书本", aliases: ["蓝色书本", "蓝色的书", "蓝书", "书本", "书"], color: "#4f7bd9", kind: "book", shape: "长方体", size: "中", confidence: 0.81 },
    { id: "bottle_white", name: "白色药瓶", aliases: ["白色药瓶", "白药瓶", "药瓶", "瓶子", "白瓶", "药"], color: "#e8e4da", kind: "bottle", shape: "圆柱", size: "小", confidence: 0.55 },
    { id: "headphones_orange", name: "橙色耳机", aliases: ["橙色耳机", "橙耳机", "耳机", "头戴耳机"], color: "#e68036", kind: "headphones", shape: "环形", size: "中", confidence: 0.64 },
    { id: "umbrella_purple", name: "紫色雨伞", aliases: ["紫色雨伞", "紫雨伞", "雨伞", "伞"], color: "#9a6bd8", kind: "umbrella", shape: "长条", size: "大", confidence: 0.48 },
    { id: "notebook_green", name: "绿色笔记本", aliases: ["绿色笔记本", "绿笔记本", "笔记本", "本子", "绿本子"], color: "#4eae7a", kind: "notebook", shape: "长方体", size: "中", confidence: 0.76 },
  ];
  const BY_ID = {};
  META.forEach((m) => { BY_ID[m.id] = m; });

  const LAYOUT_META = {
    A: {
      cup_red: { room: "客厅", furniture: "茶几" },
      remote_black: { room: "客厅", furniture: "沙发" },
      key_yellow: { room: "客厅", furniture: "电视柜" },
      book_blue: { room: "卧室", furniture: "床头柜" },
      bottle_white: { room: "卧室", furniture: "床头柜" },
      headphones_orange: { room: "卧室", furniture: "床" },
      umbrella_purple: { room: "书房", furniture: "门边" },
      notebook_green: { room: "书房", furniture: "书桌" },
    },
    B: {
      cup_red: { room: "书房", furniture: "书桌" },
      remote_black: { room: "卧室", furniture: "床" },
      key_yellow: { room: "书房", furniture: "书架" },
      book_blue: { room: "客厅", furniture: "沙发" },
      bottle_white: { room: "书房", furniture: "书桌" },
      headphones_orange: { room: "客厅", furniture: "沙发" },
      umbrella_purple: { room: "卧室", furniture: "墙角" },
      notebook_green: { room: "客厅", furniture: "茶几" },
    },
  };

  const DEST = {
    A: {
      coffee: { pos: [4.95, 2.35, 0.46], room: "客厅", name: "茶几" },
      sofa: { pos: [2.45, 1.6, 0.52], room: "客厅", name: "沙发" },
      bed: { pos: [8.0, 2.1, 0.64], room: "卧室", name: "床" },
      desk: { pos: [8.75, 5.55, 0.75], room: "书房", name: "书桌" },
      tv: { pos: [1.0, 4.55, 0.55], room: "客厅", name: "电视柜" },
      nightstand: { pos: [9.9, 1.35, 0.55], room: "卧室", name: "床头柜" },
    },
    B: {
      coffee: { pos: [4.8, 6.15, 0.44], room: "客厅", name: "茶几" },
      sofa: { pos: [2.45, 5.9, 0.52], room: "客厅", name: "沙发" },
      bed: { pos: [8.0, 6.2, 0.64], room: "卧室", name: "床" },
      desk: { pos: [8.9, 1.35, 0.75], room: "书房", name: "书桌" },
      tv: { pos: [1.0, 7.4, 0.55], room: "客厅", name: "电视柜" },
      nightstand: { pos: [10.1, 5.6, 0.55], room: "卧室", name: "床头柜" },
    },
  };

  const STATE_TEXT = {
    idle: "待机 · 我在呢",
    thinking: "思考中 · 正在理解",
    walking: "前往中 · 正在走路",
    scanning: "观察中 · 正在环顾",
    confused: "困惑 · 记忆对不上",
    correcting: "纠正中 · 记住新位置",
    celebrating: "完成 · 找到啦",
  };

  let layout = "A";
  let memoryEnabled = true;
  let offline = false;
  let busy = false;
  let runId = 0;
  let taskSeq = 0;
  let taskId = null;
  let movedRooms = {};
  let movedFurniture = {};

  const memory = new Map();

  const sceneObjects = META.map((m) => Object.assign({}, m, { x: 0, z: 0, y: 0, hidden: false }));
  scene.setObjects(sceneObjects);
  scene.setLayout("A");

  const catalog = {};
  META.forEach((m) => {
    const lm = LAYOUT_META.A[m.id] || {};
    catalog[m.id] = { name: m.name, color: m.color, furniture: lm.furniture || "" };
  });
  const hud = window.HomeTwinUI.createHud({
    bus,
    root,
    catalog,
    memoryEnabled: true,
    layoutId: "A",
    welcomeText: window.HomeTwinUI.COPY.chat.welcome,
  });
  rawBus.hud = hud;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function nowISO() { return new Date().toISOString(); }

  function memoryArray() {
    return Array.from(memory.values()).map((r) => Object.assign({}, r, { pos: r.pos.slice() }));
  }

  function emitMemory() {
    bus.emit("memory:update", { layoutId: layout, objects: memoryArray() });
  }

  function say(text) {
    bus.emit("chat:message", { role: "butler", text });
  }

  function user(text) {
    bus.emit("chat:message", { role: "user", text });
  }

  function toast(text, type) {
    bus.emit("toast", { text, type: type || "" });
  }

  function setMemoryEnabled(v) {
    memoryEnabled = !!v;
    bus.emit("memory:toggle", { enabled: memoryEnabled });
  }

  function setOffline(v) {
    offline = !!v;
    bus.emit("offline:change", { enabled: offline });
  }

  function objectRoom(id) {
    return movedRooms[id] || (LAYOUT_META[layout][id] && LAYOUT_META[layout][id].room) || "客厅";
  }

  function objectFurniture(id) {
    return movedFurniture[id] || (LAYOUT_META[layout][id] && LAYOUT_META[layout][id].furniture) || "房间";
  }

  function seedMemory() {
    memory.clear();
    for (const m of META) {
      const o = scene.getObject(m.id);
      const lm = LAYOUT_META[layout][m.id];
      memory.set(m.id, {
        object_id: m.id,
        name: m.name,
        room: lm.room,
        furniture: lm.furniture,
        color: m.color,
        confidence: m.confidence,
        status: "fresh",
        pos: [o.x, o.y, o.z],
        updated_at: nowISO(),
      });
    }
  }

  function syncMemoryToScene(layoutId) {
    for (const rec of memory.values()) {
      const lm = LAYOUT_META[layoutId] && LAYOUT_META[layoutId][rec.object_id];
      const o = scene.getObject(rec.object_id);
      if (!lm || !o) continue;
      rec.room = lm.room;
      rec.furniture = lm.furniture;
      rec.pos = [o.x, o.y, o.z];
    }
  }

  function setLayout(id) {
    layout = id;
    movedRooms = {};
    movedFurniture = {};
    scene.setLayout(id);
    syncMemoryToScene(id);
    bus.emit("layout:change", { id, name: "布局 " + id });
    emitMemory();
    bus.emit("memory:highlight", {});
  }

  function approachAt(x, z) {
    let ax = x + 0.95;
    let az = z + 1.0;
    if (ax > 11.2) ax = x - 0.95;
    if (az > 8.25) az = z - 1.0;
    return [clamp(ax, 0.7, 11.3), clamp(az, 0.7, 8.3)];
  }

  function alive(ctx) {
    return !!ctx && ctx.token === runId && busy && ctx.id === taskId;
  }

  function emitState(state, text) {
    scene.setState(state);
    bus.emit("robot:state", { state, text: text || STATE_TEXT[state] || state });
  }

  function beginTask(query, source, total) {
    if (busy) {
      toast("小方正在执行上一个任务，请稍等", "warn");
      return null;
    }
    runId += 1;
    busy = true;
    taskId = "task-" + ++taskSeq;
    const t0 = performance.now();
    bus.emit("plan:received", { source: source || "rule", latencyMs: source === "cache" ? 3 : 120 });
    bus.emit("task:start", { id: taskId, query, source: source || "rule", total });
    scene.setState("thinking");
    return { token: runId, id: taskId, total, t0 };
  }

  function endTask(ctx, found, corrected) {
    if (!ctx || ctx.token !== runId) return;
    busy = false;
    taskId = null;
    scene.setState(found ? "celebrating" : "idle");
    bus.emit("task:end", {
      id: ctx.id,
      stepCount: ctx.total,
      total: ctx.total,
      durationMs: performance.now() - ctx.t0,
      found: !!found,
      corrected: !!corrected,
    });
  }

  function cancelRun() {
    runId += 1;
    busy = false;
    taskId = null;
    scene.cancel();
    scene.setState("idle");
    bus.emit("task:reset", {});
  }

  async function butler(ctx, text, delay) {
    if (!alive(ctx)) return;
    bus.emit("chat:typing", { on: true });
    await sleep(delay || 300);
    bus.emit("chat:typing", { on: false });
    if (!alive(ctx)) return;
    bus.emit("chat:message", { role: "butler", text });
  }

  async function simpleStep(ctx, index, action, label, target, ms, state, sub) {
    if (!alive(ctx)) return false;
    emitState(state || "thinking", sub || STATE_TEXT[state || "thinking"]);
    bus.emit("task:step", {
      index, total: ctx.total, action, label, targetLabel: target,
      status: "active", sub: sub || "",
    });
    await sleep(ms);
    if (!alive(ctx)) return false;
    bus.emit("task:step", {
      index, total: ctx.total, action, label, targetLabel: target,
      status: "done", durationMs: ms,
    });
    return true;
  }

  async function goStep(ctx, index, label, x, z) {
    if (!alive(ctx)) return false;
    emitState("walking", "前往 " + label);
    bus.emit("task:step", {
      index, total: ctx.total, action: "go", label, targetLabel: "",
      status: "active", sub: "A* 寻路 · 避障",
    });
    const t0 = performance.now();
    await scene.moveTo(x, z, 920);
    if (!alive(ctx)) return false;
    bus.emit("task:step", {
      index, total: ctx.total, action: "go", label, targetLabel: "",
      status: "done", durationMs: performance.now() - t0,
    });
    return true;
  }

  async function verifyStep(ctx, index, failed) {
    if (!alive(ctx)) return false;
    emitState("scanning", failed ? "正在核对记忆位置" : "正在确认目标");
    bus.emit("task:step", {
      index, total: ctx.total, action: "verify", label: "视觉复核",
      status: "active", sub: failed ? "比对旧记忆位置" : "比对记忆坐标与当前观测",
    });
    const t0 = performance.now();
    await scene.scan(620);
    if (!alive(ctx)) return false;
    if (failed) {
      bus.emit("task:step", {
        index, total: ctx.total, action: "verify", label: "视觉复核",
        status: "error", durationMs: performance.now() - t0,
        sub: "记忆位置没有发现目标 · 置信度下降",
      });
      return false;
    }
    bus.emit("task:step", {
      index, total: ctx.total, action: "verify", label: "视觉复核",
      status: "done", durationMs: performance.now() - t0, sub: "目标确认",
    });
    return true;
  }

  async function scanRoomStep(ctx, index, room) {
    if (!alive(ctx)) return false;
    const sp = scene.scanPoint(room);
    emitState("walking", "前往 " + room + " 扫描位");
    bus.emit("task:step", {
      index, total: ctx.total, action: "scan", label: "扫描 " + room,
      targetLabel: "", status: "active", sub: "A* 寻路 → 原地环顾",
    });
    const t0 = performance.now();
    await scene.moveTo(sp[0], sp[1], 620);
    if (!alive(ctx)) return false;
    emitState("scanning", "正在扫描 " + room);
    await scene.scan(700);
    if (!alive(ctx)) return false;
    bus.emit("task:step", {
      index, total: ctx.total, action: "scan", label: "扫描 " + room,
      targetLabel: "", status: "done", durationMs: performance.now() - t0,
      sub: "发现物品并写入记忆",
    });
    return true;
  }

  function discoverRoom(room, targetId) {
    let changed = false;
    for (const m of META) {
      if (objectRoom(m.id) !== room) continue;
      const o = scene.getObject(m.id);
      if (!o) continue;
      let rec = memory.get(m.id);
      if (!rec) {
        rec = {
          object_id: m.id,
          name: m.name,
          room,
          furniture: objectFurniture(m.id),
          color: m.color,
          confidence: 0.8,
          status: "fresh",
          pos: [o.x, o.y, o.z],
          updated_at: nowISO(),
        };
        memory.set(m.id, rec);
      } else {
        rec.room = room;
        rec.furniture = objectFurniture(m.id);
        rec.pos = [o.x, o.y, o.z];
        rec.confidence = 0.8;
        rec.status = "fresh";
        rec.updated_at = nowISO();
      }
      changed = true;
    }
    if (changed) {
      emitMemory();
      if (targetId) bus.emit("memory:highlight", { objectId: targetId });
    }
  }

  async function finishFound(ctx, id, text) {
    if (!alive(ctx)) return;
    const rec = memory.get(id);
    if (!rec) {
      endTask(ctx, false, false);
      return;
    }
    rec.confidence = Math.min(1, Math.round((rec.confidence + 0.05) * 100) / 100);
    rec.updated_at = nowISO();
    rec.status = "fresh";
    emitMemory();
    bus.emit("memory:highlight", { objectId: id });
    scene.setTarget(id);
    scene.setMemoryMarker(null);
    await simpleStep(ctx, ctx.total - 1, "found", "确认目标", rec.name, 260, "celebrating", "目标已锁定");
    if (!alive(ctx)) return;
    bus.emit("found", {
      objectId: id,
      name: rec.name,
      room: rec.room,
      furniture: rec.furniture,
      confidence: rec.confidence,
    });
    await butler(ctx, text, 260);
    endTask(ctx, true, false);
  }

  async function runMemoryFind(id, opts) {
    opts = opts || {};
    if (busy) { toast("小忙，等我一下", "warn"); return; }
    if (!memoryEnabled) return runScanFind(id, opts);
    const rec = memory.get(id);
    if (!rec || rec.confidence < 0.3) return runScanFind(id, opts);
    const meta = BY_ID[id];
    const query = opts.query || "帮我找" + meta.name;
    const ctx = beginTask(query, opts.source || "rule", 4);
    if (!ctx) return;
    if (!opts.noUser) user(query);
    scene.setTarget(id);
    scene.setMemoryMarker(null);
    await simpleStep(ctx, 0, "memory", "检索记忆", rec.room, 280, "thinking", "命中 " + rec.name + " · " + Math.round(rec.confidence * 100) + "%");
    if (!alive(ctx)) return;
    await butler(ctx, "记忆里有：" + rec.name + "在" + rec.room + "的" + rec.furniture + "。我直接过去。", 320);
    if (!alive(ctx)) return;
    const a = approachAt(rec.pos[0], rec.pos[2]);
    await goStep(ctx, 1, "前往 " + rec.room, a[0], a[1]);
    if (!alive(ctx)) return;
    await verifyStep(ctx, 2, false);
    if (!alive(ctx)) return;
    await finishFound(ctx, id, "找到啦！" + rec.name + "在" + rec.room + "的" + rec.furniture + "。");
  }

  async function runScanFind(id, opts) {
    opts = opts || {};
    if (busy) { toast("小忙，等我一下", "warn"); return; }
    const meta = BY_ID[id];
    if (!meta) return;
    const query = opts.query || "帮我找" + meta.name;
    const ctx = beginTask(query, opts.source || "rule", 6);
    if (!ctx) return;
    if (!opts.noUser) user(query);
    await butler(ctx, memoryEnabled ? "记忆里没有十足把握，我先扫描全屋，再按外观特征找。" : "记忆增强已关闭。我先扫描全屋，再按外观特征找。", 320);
    if (!alive(ctx)) return;
    for (let i = 0; i < 3; i++) {
      const room = ["客厅", "卧室", "书房"][i];
      await scanRoomStep(ctx, i, room);
      if (!alive(ctx)) return;
      discoverRoom(room, id);
    }
    const rec = memory.get(id);
    if (!rec) { endTask(ctx, false, false); return; }
    const a = approachAt(rec.pos[0], rec.pos[2]);
    await goStep(ctx, 3, "前往 " + rec.room, a[0], a[1]);
    if (!alive(ctx)) return;
    await verifyStep(ctx, 4, false);
    if (!alive(ctx)) return;
    rec.confidence = 0.85;
    rec.updated_at = nowISO();
    emitMemory();
    await finishFound(ctx, id, "找到啦！" + rec.name + "在" + rec.room + "的" + rec.furniture + "。");
  }

  async function runFirstFind() {
    if (busy) { toast("小忙，等我一下", "warn"); return; }
    memory.clear();
    emitMemory();
    setMemoryEnabled(false);
    await runScanFind("cup_red", { query: "帮我找红色水杯", source: "rule" });
    if (busy) return;
    setMemoryEnabled(true);
    say("记忆建好了。下次可以直接问，我会先查记忆再出发。");
    toast("首次扫描完成 · 记忆已建立", "");
  }

  async function runMoved() {
    if (busy) { toast("小忙，等我一下", "warn"); return; }
    setMemoryEnabled(true);
    const rec = memory.get("cup_red");
    if (!rec) return;
    const oldX = rec.pos[0];
    const oldZ = rec.pos[2];
    scene.setObjectPosition("cup_red", 9.55, 1.55, 0.55);
    movedRooms.cup_red = "卧室";
    movedFurniture.cup_red = "床头柜";
    scene.setMemoryMarker(oldX, oldZ);
    const ctx = beginTask("帮我找红色水杯", "rule", 9);
    if (!ctx) return;
    user("帮我找红色水杯");
    await simpleStep(ctx, 0, "memory", "检索记忆", "客厅", 280, "thinking", "记忆命中 · 客厅茶几");
    if (!alive(ctx)) return;
    await butler(ctx, "记忆里在客厅茶几。我直接过去。", 300);
    if (!alive(ctx)) return;
    const aOld = approachAt(oldX, oldZ);
    await goStep(ctx, 1, "前往旧位置", aOld[0], aOld[1]);
    if (!alive(ctx)) return;
    await verifyStep(ctx, 2, true);
    if (!alive(ctx)) return;
    emitState("confused", "咦，这里没有…");
    rec.confidence = 0.45;
    rec.status = "stale";
    rec.updated_at = nowISO();
    emitMemory();
    bus.emit("memory:highlight", { objectId: "cup_red" });
    await butler(ctx, "咦，这里没有。物品可能被移动了，我重新扫描全屋。", 340);
    if (!alive(ctx)) return;
    for (let i = 0; i < 3; i++) {
      const room = ["客厅", "卧室", "书房"][i];
      await scanRoomStep(ctx, 3 + i, room);
      if (!alive(ctx)) return;
      discoverRoom(room, "cup_red");
    }
    scene.setMemoryMarker(null);
    const fresh = memory.get("cup_red");
    const aNew = approachAt(fresh.pos[0], fresh.pos[2]);
    await goStep(ctx, 6, "前往新位置", aNew[0], aNew[1]);
    if (!alive(ctx)) return;
    await verifyStep(ctx, 7, false);
    if (!alive(ctx)) return;
    fresh.confidence = 0.85;
    fresh.updated_at = nowISO();
    emitMemory();
    await finishFound(ctx, "cup_red", "找到啦！水杯被移到卧室的床头柜了，记忆已更新。");
  }

  async function runCorrect(id, opts) {
    opts = opts || {};
    if (busy) { toast("小忙，等我一下", "warn"); return; }
    id = id || "cup_red";
    setMemoryEnabled(true);
    const rec = memory.get(id);
    if (!rec) { toast("先建立记忆，再演示纠正", "warn"); return; }
    const meta = BY_ID[id];
    const pos = layout === "A" ? [8.75, 5.55, 0.75] : [8.9, 1.35, 0.75];
    scene.setObjectPosition(id, pos[0], pos[1], pos[2]);
    movedRooms[id] = "书房";
    movedFurniture[id] = "书桌";
    rec.room = "书房";
    rec.furniture = "书桌";
    rec.pos = pos.slice();
    rec.confidence = 0.9;
    rec.status = "fresh";
    rec.updated_at = nowISO();
    emitMemory();
    bus.emit("memory:highlight", { objectId: id });
    const ctx = beginTask("纠正：" + meta.name + "在书房", "rule", 4);
    if (!ctx) return;
    if (!opts.noUser) user("不对，水杯应该在书房");
    await simpleStep(ctx, 0, "correct", "记忆纠正", "书房", 460, "correcting", "旧记录已覆盖 · 0.90");
    if (!alive(ctx)) return;
    await butler(ctx, "抱歉，我记错了。" + meta.name + "在书房的书桌。", 320);
    if (!alive(ctx)) return;
    const a = approachAt(pos[0], pos[2]);
    await goStep(ctx, 1, "前往新位置", a[0], a[1]);
    if (!alive(ctx)) return;
    await verifyStep(ctx, 2, false);
    if (!alive(ctx)) return;
    await finishFound(ctx, id, "记住了。" + meta.name + "在书房的书桌。");
  }

  async function runMove(id, destKey, opts) {
    opts = opts || {};
    if (busy) { toast("小忙，等我一下", "warn"); return; }
    setMemoryEnabled(true);
    const rec = memory.get(id);
    const meta = BY_ID[id];
    const dest = (DEST[layout] || DEST.A)[destKey] || DEST.A.coffee;
    if (!rec) { toast("先建立记忆", "warn"); return; }
    const text = opts.text || "帮我把" + meta.name + "放到" + dest.name;
    const ctx = beginTask(text, "rule", 5);
    if (!ctx) return;
    if (!opts.noUser) user(text);
    await simpleStep(ctx, 0, "memory", "检索记忆", rec.room, 260, "thinking", "命中 " + rec.name);
    if (!alive(ctx)) return;
    const a = approachAt(rec.pos[0], rec.pos[2]);
    await goStep(ctx, 1, "前往 " + rec.name, a[0], a[1]);
    if (!alive(ctx)) return;
    await simpleStep(ctx, 2, "grab", "抓取物品", rec.name, 420, "picking", "悬浮携带 · 0.4×");
    scene.pickUp(id);
    if (!alive(ctx)) return;
    const da = approachAt(dest.pos[0], dest.pos[2]);
    await goStep(ctx, 3, "前往 " + dest.name, da[0], da[1]);
    if (!alive(ctx)) return;
    bus.emit("task:step", {
      index: 4, total: ctx.total, action: "drop", label: "放置物品",
      targetLabel: dest.name, status: "active", sub: "落到 " + dest.name + " 表面",
    });
    await sleep(420);
    scene.drop(id, dest.pos[0], dest.pos[1], dest.pos[2]);
    rec.pos = dest.pos.slice();
    rec.room = dest.room;
    rec.furniture = dest.name;
    rec.confidence = 0.84;
    rec.updated_at = nowISO();
    emitMemory();
    bus.emit("memory:highlight", { objectId: id });
    bus.emit("task:step", {
      index: 4, total: ctx.total, action: "drop", label: "放置物品",
      targetLabel: dest.name, status: "done", durationMs: 420, sub: "放置完成",
    });
    if (!alive(ctx)) return;
    scene.setTarget(id);
    await butler(ctx, "好，我把" + rec.name + "放到" + dest.room + "的" + dest.name + "了。", 320);
    if (!alive(ctx)) return;
    toast("已把 " + rec.name + " 放到 " + dest.name, "");
    endTask(ctx, false, false);
  }

  function runCompare() {
    bus.emit("compare:update", {
      memoryOn: { steps: 4, seconds: 5.6, distance: 4.2 },
      memoryOff: { steps: 8, seconds: 18.4, distance: 11.8 },
      note: "预览数据（非正式任务日志）",
    });
    say("预览对比：记忆开 4 步，记忆关 8 步。正式组件只读取 task:end 事件。");
    toast("训练前后对比 · 预览数据", "");
  }

  async function runLayoutB() {
    if (busy) { toast("小忙，等我一下", "warn"); return; }
    const next = layout === "A" ? "B" : "A";
    setLayout(next);
    user("切到布局 " + next + "，再找一下红色水杯");
    say("已切换到布局 " + next + "。记忆按布局分区，我重新按新布局找。");
    await runMemoryFind("cup_red", { noUser: true, query: "帮我找红色水杯", source: "rule" });
  }

  async function runOffline() {
    if (busy) { toast("小忙，等我一下", "warn"); return; }
    setOffline(true);
    user("断网了，还能找红色水杯吗？");
    say("网络已断开。我改用本机缓存与规则规划，记忆还在。");
    await runMemoryFind("cup_red", { noUser: true, query: "断网后找红色水杯", source: "offline" });
  }

  function resetAll() {
    cancelRun();
    layout = "A";
    movedRooms = {};
    movedFurniture = {};
    scene.reset();
    seedMemory();
    setMemoryEnabled(true);
    setOffline(false);
    bus.emit("plan:received", { source: "rule", latencyMs: 12 });
    bus.emit("layout:change", { id: "A", name: "布局 A" });
    emitMemory();
    bus.emit("task:reset", {});
    bus.emit("chat:clear", {});
    say("场景和记忆已重置。我在呢，要找什么？");
    toast("已重置到初始状态", "");
  }

  function clearMemory() {
    cancelRun();
    memory.clear();
    emitMemory();
    bus.emit("task:reset", {});
    scene.setTarget(null);
    scene.setMemoryMarker(null);
    say("空间记忆已清空。下次找物会从全屋扫描开始。");
    toast("记忆已清空", "warn");
  }

  function sceneReset() {
    cancelRun();
    const wasB = layout === "B";
    layout = "A";
    movedRooms = {};
    movedFurniture = {};
    scene.reset();
    syncMemoryToScene("A");
    if (wasB) bus.emit("layout:change", { id: "A", name: "布局 A" });
    emitMemory();
    bus.emit("task:reset", {});
    scene.setMemoryMarker(null);
    say("场景已复位，记忆保留。");
    toast("场景已复位", "");
  }

  function normalize(text) {
    return String(text || "").replace(/[\s，。！？、,.!?;；:：“”‘’（）()【】\[\]]/g, "");
  }

  function findTarget(text) {
    let best = null;
    let bestLen = 0;
    for (const m of META) {
      const pool = [m.name].concat(m.aliases || []);
      for (const alias of pool) {
        if (alias && text.indexOf(alias) >= 0 && alias.length > bestLen) {
          best = m.id;
          bestLen = alias.length;
        }
      }
    }
    return best;
  }

  function destinationKey(text) {
    if (/茶几/.test(text)) return "coffee";
    if (/沙发/.test(text)) return "sofa";
    if (/床头柜/.test(text)) return "nightstand";
    if (/床/.test(text)) return "bed";
    if (/书桌|桌子/.test(text)) return "desk";
    if (/电视柜/.test(text)) return "tv";
    return null;
  }

  async function handleQuery(text) {
    const t = normalize(text);
    if (!t) return;
    if (busy) { toast("小方正在执行上一个任务，请稍等", "warn"); return; }
    if (/对比|训练前后|前后差/.test(t)) return runCompare();
    if (/断网|离线/.test(t)) return runOffline();
    if (/布局/.test(t)) return runLayoutB();
    if (/重置|复位/.test(t)) return resetAll();
    if (/记忆/.test(t) && /(关|关闭|关掉)/.test(t)) {
      setMemoryEnabled(false);
      say("记忆增强已关闭。接下来每次找物都会从全屋扫描开始。");
      const id = findTarget(t);
      if (id) return runScanFind(id, { noUser: true, query: text });
      return;
    }
    if (/记忆/.test(t) && /(开|开启|打开)/.test(t)) {
      setMemoryEnabled(true);
      say("记忆增强已开启。我会优先使用空间记忆。");
      const id = findTarget(t);
      if (id) return runMemoryFind(id, { noUser: true, query: text });
      return;
    }
    const id = findTarget(t);
    if (/不对|不是|应该|纠正/.test(t)) {
      return runCorrect(id || "cup_red", { noUser: true });
    }
    if (id && /放到|拿到|放在|移到|搬到/.test(t)) {
      return runMove(id, destinationKey(t) || "coffee", { noUser: true, text });
    }
    if (id) {
      const rec = memory.get(id);
      return (memoryEnabled && rec && rec.confidence >= 0.3)
        ? runMemoryFind(id, { noUser: true, query: text })
        : runScanFind(id, { noUser: true, query: text });
    }
    if (/扫描|巡检/.test(t)) return runScanFind("cup_red", { noUser: true, query: text });
    say("我可以找红色水杯、钥匙、遥控器、蓝色书本、药瓶、耳机、雨伞或笔记本。");
  }

  function handleDirector(action, payload) {
    switch (action) {
      case "script:first": return runFirstFind();
      case "script:memory": return runMemoryFind("cup_red", { query: "帮我找红色水杯" });
      case "script:moved": return runMoved();
      case "script:correct": return runCorrect("cup_red", {});
      case "script:compare": return runCompare();
      case "script:layoutB": return runLayoutB();
      case "script:offline": return runOffline();
      case "teleport": {
        const id = (payload && payload.objectId) || "cup_red";
        const rec = memory.get(id);
        const oldX = rec ? rec.pos[0] : 0;
        const oldZ = rec ? rec.pos[2] : 0;
        scene.setObjectPosition(id, 9.55, 1.55, 0.55);
        movedRooms[id] = "卧室";
        movedFurniture[id] = "床头柜";
        scene.setMemoryMarker(oldX, oldZ);
        toast("已把 " + (BY_ID[id] ? BY_ID[id].name : id) + " 移到卧室；记忆未更新", "warn");
        return;
      }
      case "scene:reset": return sceneReset();
      case "clear": return clearMemory();
      case "reset": return resetAll();
      case "memory:toggle": return setMemoryEnabled(payload && payload.enabled);
      default: return undefined;
    }
  }

  bus.on("plan:request", (p) => {
    if (!p || typeof p.query !== "string") return;
    memoryEnabled = p.memoryEnabled !== false;
    hud.setMemoryEnabled(memoryEnabled);
    handleQuery(p.query);
  });
  bus.on("ui:director", (p) => { if (p && p.action) handleDirector(p.action, p); });

  seedMemory();
  emitMemory();
  bus.emit("layout:change", { id: "A", name: "布局 A" });
  bus.emit("memory:toggle", { enabled: true });
  bus.emit("offline:change", { enabled: false });
  bus.emit("plan:received", { source: "rule", latencyMs: 12 });
  bus.emit("robot:state", { state: "idle", text: STATE_TEXT.idle });

  const params = new URLSearchParams(location.search);
  if (params.get("panel") === "director") {
    setTimeout(() => hud.director.open(), 600);
  }
  const auto = params.get("auto");
  if (auto !== "0") {
    setTimeout(() => {
      if (busy) return;
      switch (auto) {
        case "moved": runMoved(); break;
        case "correct": runCorrect("cup_red", {}); break;
        case "compare": runCompare(); break;
        case "layoutB": runLayoutB(); break;
        case "offline": runOffline(); break;
        case "first": runFirstFind(); break;
        case "move": runMove("cup_red", "coffee", {}); break;
        case "query": bus.emit("ui:query", { text: "帮我找钥匙" }); break;
        case "director": bus.emit("ui:director", { action: "script:memory" }); break;
        case "chat": {
          const input = document.querySelector(".ht-chat-input");
          if (input) {
            input.value = "帮我找蓝色书本";
            const form = document.querySelector(".ht-chat-bar");
            if (form && form.requestSubmit) form.requestSubmit();
          }
          break;
        }
        default: runMemoryFind("cup_red", { query: "帮我找红色水杯" });
      }
    }, 1500);
  }

  window.__hudPreview = {
    bus,
    scene,
    hud,
    memory,
    runMemoryFind,
    runScanFind,
    runMoved,
    runCorrect,
    runMove,
    runCompare,
    runLayoutB,
    runOffline,
    resetAll,
    clearMemory,
    getState: () => ({
      busy,
      layout,
      memoryEnabled,
      offline,
      memoryCount: memory.size,
      target: scene.targetId,
      robot: { x: scene.robot.x, z: scene.robot.z, state: scene.robot.state },
    }),
  };

  if (params.get("debug") === "1") {
    setTimeout(() => {
      const rect = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) };
      };
      const overlap = (a, b) => !!(a && b) && !(a.r <= b.l || a.l >= b.r || a.b <= b.t || a.t >= b.b);
      const top = rect(".ht-topbar");
      const left = rect(".ht-side.left");
      const right = rect(".ht-side.right");
      const bottom = rect(".ht-bottom");
      const found = rect(".ht-found");
      const pre = document.createElement("pre");
      pre.id = "ht-debug";
      pre.textContent = JSON.stringify({
        viewport: [innerWidth, innerHeight],
        bodyScroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
        topbar: top,
        left,
        right,
        bottom,
        found,
        overlaps: {
          leftBottom: overlap(left, bottom),
          rightBottom: overlap(right, bottom),
          topbarLeft: overlap(top, left),
          topbarRight: overlap(top, right),
        },
        memItems: document.querySelectorAll(".ht-mem-item").length,
        tlItems: document.querySelectorAll(".ht-tl-item").length,
        chatMsgs: document.querySelectorAll(".ht-msg").length,
      }, null, 2);
      document.body.appendChild(pre);
    }, 2400);
  }
})();
