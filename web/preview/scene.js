/* global window */
(function (global) {
  "use strict";

  const COS = Math.cos(Math.PI / 6);
  const SIN = 0.5;

  function shade(hex, factor) {
    const h = String(hex || "#b9a897").replace("#", "");
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    const r = Math.min(255, Math.round(parseInt(full.slice(0, 2), 16) * factor));
    const g = Math.min(255, Math.round(parseInt(full.slice(2, 4), 16) * factor));
    const b = Math.min(255, Math.round(parseInt(full.slice(4, 6), 16) * factor));
    return `rgb(${r},${g},${b})`;
  }

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function layoutFurniture(layout) {
    if (layout === "B") {
      return [
        { type: "sofa", x: 1.0, z: 5.5, w: 2.8, d: 1.0, h: 0.78, color: "#6e8b7b" },
        { type: "coffee", x: 4.2, z: 5.9, w: 1.6, d: 0.9, h: 0.44, color: "#a9764e" },
        { type: "tv", x: 0.65, z: 7.1, w: 0.45, d: 2.1, h: 0.55, color: "#5c4432" },
        { type: "bed", x: 7.2, z: 5.3, w: 2.4, d: 2.2, h: 0.64, color: "#b9876a" },
        { type: "nightstand", x: 9.85, z: 5.4, w: 0.8, d: 0.6, h: 0.55, color: "#8a5d3c" },
        { type: "desk", x: 8.15, z: 0.95, w: 2.65, d: 0.9, h: 0.75, color: "#9a6b47" },
        { type: "shelf", x: 10.65, z: 2.2, w: 0.5, d: 2.3, h: 2.2, color: "#7a5236" },
        { type: "plant", x: 1.0, z: 1.0, w: 0.5, d: 0.5, h: 1.0, color: "#e1c7a4" },
        { type: "plant", x: 10.9, z: 8.0, w: 0.5, d: 0.5, h: 1.0, color: "#e1c7a4" },
        { type: "rug", x: 1.5, z: 5.0, w: 4.0, d: 3.0, h: 0.012, color: "#d8c3a6" },
        { type: "rug", x: 7.0, z: 5.1, w: 3.8, d: 2.7, h: 0.012, color: "#cdb9a2" },
      ];
    }
    return [
      { type: "sofa", x: 1.2, z: 1.0, w: 2.8, d: 1.0, h: 0.78, color: "#6e8b7b" },
      { type: "coffee", x: 4.4, z: 2.0, w: 1.6, d: 0.9, h: 0.44, color: "#a9764e" },
      { type: "tv", x: 0.65, z: 4.0, w: 0.45, d: 2.2, h: 0.55, color: "#5c4432" },
      { type: "bed", x: 7.2, z: 1.0, w: 2.4, d: 2.2, h: 0.64, color: "#b9876a" },
      { type: "nightstand", x: 9.85, z: 1.1, w: 0.8, d: 0.6, h: 0.55, color: "#8a5d3c" },
      { type: "desk", x: 8.15, z: 5.35, w: 2.65, d: 0.9, h: 0.75, color: "#9a6b47" },
      { type: "shelf", x: 10.65, z: 3.6, w: 0.5, d: 2.3, h: 2.2, color: "#7a5236" },
      { type: "plant", x: 1.0, z: 7.4, w: 0.5, d: 0.5, h: 1.0, color: "#e1c7a4" },
      { type: "plant", x: 10.9, z: 7.9, w: 0.5, d: 0.5, h: 1.0, color: "#e1c7a4" },
      { type: "rug", x: 1.6, z: 1.9, w: 4.0, d: 3.0, h: 0.012, color: "#d8c3a6" },
      { type: "rug", x: 7.0, z: 1.5, w: 3.8, d: 2.8, h: 0.012, color: "#cdb9a2" },
    ];
  }

  const OBJECT_POS = {
    A: {
      cup_red: [5.0, 2.3, 0.46],
      remote_black: [2.4, 1.55, 0.78],
      key_yellow: [0.98, 4.6, 0.55],
      book_blue: [9.85, 1.35, 0.55],
      bottle_white: [10.05, 1.15, 0.55],
      headphones_orange: [7.85, 2.0, 0.78],
      umbrella_purple: [4.45, 8.2, 0.0],
      notebook_green: [8.75, 5.55, 0.75],
    },
    B: {
      cup_red: [8.9, 1.35, 0.75],
      remote_black: [7.9, 5.9, 0.78],
      key_yellow: [10.82, 2.9, 1.18],
      book_blue: [2.4, 5.9, 0.78],
      bottle_white: [9.55, 1.55, 0.75],
      headphones_orange: [3.0, 6.15, 0.78],
      umbrella_purple: [10.35, 7.85, 0.0],
      notebook_green: [4.85, 6.15, 0.44],
    },
  };

  const DOCK = { A: [3.1, 7.4], B: [3.0, 7.8] };
  const SCAN_POINTS = {
    A: { 客厅: [3.6, 4.4], 卧室: [8.2, 4.0], 书房: [8.5, 7.2] },
    B: { 客厅: [3.2, 7.0], 卧室: [8.2, 7.2], 书房: [8.4, 2.9] },
  };

  class IsoScene {
    constructor(canvas, options) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.options = options || {};
      this.layout = "A";
      this.furniture = layoutFurniture("A");
      this.objects = [];
      this.robot = { x: DOCK.A[0], z: DOCK.A[1], state: "idle", carrying: null, bob: 0 };
      this.targetId = null;
      this.focusId = null;
      this.memoryMarker = null;
      this.path = null;
      this.move = null;
      this.scanState = null;
      this.layout = "A";
      this.time = 0;
      this.dust = [];
      this.resize();
      this._seedDust();
      this.last = performance.now();
      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);
      window.addEventListener("resize", () => this.resize());
    }

    setObjects(objects) {
      this.objects = objects.map((o) => Object.assign({}, o));
    }

    getObject(id) {
      return this.objects.find((o) => o.id === id);
    }

    setObjectPosition(id, x, z, y) {
      const o = this.getObject(id);
      if (!o) return;
      o.x = x;
      o.z = z;
      o.y = y === undefined ? o.y : y;
    }

    setLayout(layout) {
      if (this.move && this.move.resolve) this.move.resolve();
      if (this.scanState && this.scanState.resolve) this.scanState.resolve();
      this.layout = layout;
      this.furniture = layoutFurniture(layout);
      const pos = OBJECT_POS[layout];
      for (const o of this.objects) {
        const p = pos[o.id];
        if (p) {
          o.x = p[0]; o.z = p[1]; o.y = p[2];
        }
      }
      const dock = DOCK[layout];
      this.robot.x = dock[0];
      this.robot.z = dock[1];
      this.robot.state = "idle";
      this.robot.carrying = null;
      this.path = null;
      this.move = null;
      this.targetId = null;
      this.scanState = null;
      this.memoryMarker = null;
    }

    setState(state) {
      this.robot.state = state;
    }

    setTarget(id) {
      this.targetId = id;
    }

    focusObject(id) {
      this.targetId = id;
      this.focusUntil = this.time + 3.2;
    }

    reset() {
      if (this.move && this.move.resolve) this.move.resolve();
      if (this.scanState && this.scanState.resolve) this.scanState.resolve();
      this.layout = "A";
      this.furniture = layoutFurniture("A");
      const pos = OBJECT_POS.A;
      for (const o of this.objects) {
        const p = pos[o.id];
        if (p) { o.x = p[0]; o.z = p[1]; o.y = p[2]; }
        o.hidden = false;
      }
      this.robot.x = DOCK.A[0];
      this.robot.z = DOCK.A[1];
      this.robot.state = "idle";
      this.robot.carrying = null;
      this.targetId = null;
      this.focusId = null;
      this.memoryMarker = null;
      this.path = null;
      this.move = null;
      this.scanState = null;
    }

    setMemoryMarker(x, z) {
      this.memoryMarker = x === undefined || x === null ? null : { x, z };
    }

    cancel() {
      if (this.move && this.move.resolve) this.move.resolve();
      if (this.scanState && this.scanState.resolve) this.scanState.resolve();
      this.move = null;
      this.scanState = null;
      this.path = null;
      if (this.robot.carrying) {
        const o = this.getObject(this.robot.carrying);
        if (o) o.hidden = false;
        this.robot.carrying = null;
      }
      this.setMemoryMarker(null);
      this.robot.state = "idle";
    }

    moveTo(x, z, duration) {
      if (this.move && this.move.resolve) this.move.resolve();
      if (this.robot.carrying) {
        const o = this.getObject(this.robot.carrying);
        if (o) { o.x = x; o.z = z; }
      }
      const from = { x: this.robot.x, z: this.robot.z };
      this.path = { from, to: { x, z }, start: performance.now(), duration: Math.max(60, duration || 900) };
      return new Promise((resolve) => {
        const token = (this.moveToken = (this.moveToken || 0) + 1);
        this.move = {
          from,
          to: { x, z },
          start: performance.now(),
          duration: Math.max(60, duration || 900),
          token,
          resolve,
        };
        // rAF can be throttled in background tabs / headless; keep the
        // state machine deterministic even if the render loop pauses.
        setTimeout(() => {
          if (!this.move || this.move.token !== token) return;
          this.robot.x = x;
          this.robot.z = z;
          const r = this.move.resolve;
          this.move = null;
          this.path = null;
          if (r) r();
        }, Math.max(60, duration || 900) + 90);
      });
    }

    scan(duration) {
      if (this.scanState && this.scanState.resolve) this.scanState.resolve();
      const dur = Math.max(200, duration || 800);
      return new Promise((resolve) => {
        const token = (this.scanToken = (this.scanToken || 0) + 1);
        this.scanState = { start: performance.now(), duration: dur, token, resolve };
        setTimeout(() => {
          if (!this.scanState || this.scanState.token !== token) return;
          const r = this.scanState.resolve;
          this.scanState = null;
          if (r) r();
        }, dur + 80);
      });
    }

    pickUp(id) {
      this.robot.carrying = id;
      const o = this.getObject(id);
      if (o) {
        o.hidden = true;
        this.targetId = id;
      }
    }

    drop(id, x, z, y) {
      const o = this.getObject(id);
      if (o) {
        o.hidden = false;
        o.x = x; o.z = z; o.y = y === undefined ? o.y : y;
      }
      if (this.robot.carrying === id) this.robot.carrying = null;
      this.targetId = id;
    }

    scanPoint(room) {
      return (SCAN_POINTS[this.layout] || SCAN_POINTS.A)[room] || [6, 4];
    }

    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.w = w; this.h = h; this.dpr = dpr;
      this.canvas.width = Math.floor(w * dpr);
      this.canvas.height = Math.floor(h * dpr);
      this.canvas.style.width = w + "px";
      this.canvas.style.height = h + "px";
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.scale = Math.min(w / (18.2 * COS), h / (21.2 * SIN)) * (w < 720 ? 0.56 : w < 1100 ? 0.66 : 0.78);
      this.ox = w * 0.5 - (6 - 4.5) * COS * this.scale;
      this.oy = h * 0.56 - (6 + 4.5) * SIN * this.scale;
    }

    project(x, z, y) {
      return [
        (x - z) * COS * this.scale + this.ox,
        (x + z) * SIN * this.scale - (y || 0) * this.scale + this.oy,
      ];
    }

    _seedDust() {
      for (let i = 0; i < 28; i++) {
        this.dust.push({
          x: Math.random(),
          y: Math.random(),
          r: 0.4 + Math.random() * 1.5,
          s: 0.00001 + Math.random() * 0.00003,
          a: 0.08 + Math.random() * 0.16,
        });
      }
    }

    _loop(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.time += dt;
      this._update(now);
      this._draw(now);
      requestAnimationFrame(this._loop);
    }

    _update(now) {
      if (this.move) {
        const t = Math.min(1, (now - this.move.start) / this.move.duration);
        const e = easeInOut(t);
        this.robot.x = this.move.from.x + (this.move.to.x - this.move.from.x) * e;
        this.robot.z = this.move.from.z + (this.move.to.z - this.move.from.z) * e;
        this.robot.bob = Math.sin(now * 0.012) * 0.025;
        if (t >= 1) {
          const resolve = this.move.resolve;
          this.move = null;
          this.robot.bob = 0;
          if (resolve) resolve();
        }
      } else {
        this.robot.bob = Math.sin(now * 0.0022) * 0.008;
      }
      if (this.scanState) {
        if (now - this.scanState.start >= this.scanState.duration) {
          const resolve = this.scanState.resolve;
          this.scanState = null;
          if (resolve) resolve();
        }
      }
      if (this.path && (!this.move || now > this.path.start + this.path.duration + 200)) {
        if (!this.move) this.path = null;
      }
      for (const d of this.dust) {
        d.y -= d.s * (now - (this.lastDraw || now));
      }
    }

    _draw(now) {
      this.lastDraw = now;
      const ctx = this.ctx;
      const w = this.w, h = this.h;
      ctx.clearRect(0, 0, w, h);

      // ambient background
      const bg = ctx.createRadialGradient(w * 0.6, h * 0.32, 20, w * 0.55, h * 0.58, Math.max(w, h) * 0.75);
      bg.addColorStop(0, "rgba(92, 66, 47, 0.22)");
      bg.addColorStop(0.45, "rgba(28, 20, 15, 0.06)");
      bg.addColorStop(1, "rgba(8, 6, 5, 0.32)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      this._drawFloor(ctx);
      this._drawRugs(ctx);
      this._drawWalls(ctx);
      this._drawFloorFx(ctx, now);

      const drawables = [];
      for (const f of this.furniture) {
        if (f.type === "rug") continue;
        drawables.push({ depth: f.x + f.z + (f.w + f.d) * 0.12, kind: "furniture", data: f });
      }
      for (const o of this.objects) {
        if (o.hidden) continue;
        drawables.push({ depth: o.x + o.z + 0.12, kind: "object", data: o });
      }
      drawables.push({ depth: this.robot.x + this.robot.z + 0.18, kind: "robot", data: this.robot });
      drawables.sort((a, b) => a.depth - b.depth);
      for (const d of drawables) {
        if (d.kind === "furniture") this._drawFurniture(ctx, d.data);
        else if (d.kind === "object") this._drawObject(ctx, d.data, now);
        else this._drawRobot(ctx, now);
      }

      this._drawTargetFx(ctx, now);
      if (this.robot.carrying) this._drawCarried(ctx, now);
      this._drawDust(ctx);
      this._drawVignette(ctx);
    }

    _drawFloor(ctx) {
      const p = (x, z) => this.project(x, z, 0);
      const pts = [p(0, 0), p(12, 0), p(12, 9), p(0, 9)];
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, this.oy - 200, 0, this.oy + 300);
      g.addColorStop(0, "#7c5a3d");
      g.addColorStop(0.5, "#9a704c");
      g.addColorStop(1, "#b58558");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 235, 210, 0.16)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.strokeStyle = "#5d3f28";
      ctx.lineWidth = 0.7;
      for (let x = 0.35; x < 12; x += 0.35) {
        const a = p(x, 0.15), b = p(x, 8.85);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      for (let z = 0.35; z < 9; z += 0.35) {
        const a = p(0.15, z), b = p(11.85, z);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ctx.restore();

      // room labels on floor
      ctx.save();
      ctx.font = "600 10px 'PingFang SC','Microsoft YaHei',sans-serif";
      ctx.fillStyle = "rgba(255, 244, 228, 0.26)";
      ctx.textAlign = "center";
      const labels = [["客厅", 3.5, 4.6], ["卧室", 8.2, 4.4], ["书房", 8.4, 7.4]];
      for (const [name, x, z] of labels) {
        const q = this.project(x, z, 0.01);
        ctx.fillText(name, q[0], q[1]);
      }
      ctx.restore();
    }

    _drawRugs(ctx) {
      for (const f of this.furniture) {
        if (f.type !== "rug") continue;
        const p = (x, z) => this.project(x, z, 0.015);
        const pts = [p(f.x, f.z), p(f.x + f.w, f.z), p(f.x + f.w, f.z + f.d), p(f.x, f.z + f.d)];
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = f.color;
        ctx.globalAlpha = 0.5;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(90, 55, 32, 0.16)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    _drawWalls(ctx) {
      const wallH = 2.5;
      const p = (x, z, y) => this.project(x, z, y);
      // back wall z=0
      let q = [p(0, 0, 0), p(12, 0, 0), p(12, 0, wallH), p(0, 0, wallH)];
      ctx.beginPath();
      ctx.moveTo(q[0][0], q[0][1]);
      for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]);
      ctx.closePath();
      let g = ctx.createLinearGradient(0, q[3][1], 0, q[0][1]);
      g.addColorStop(0, "rgba(255, 238, 219, 0.2)");
      g.addColorStop(1, "rgba(255, 238, 219, 0.04)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 238, 219, 0.18)";
      ctx.stroke();

      // left wall x=0
      q = [p(0, 0, 0), p(0, 9, 0), p(0, 9, wallH), p(0, 0, wallH)];
      ctx.beginPath();
      ctx.moveTo(q[0][0], q[0][1]);
      for (let i = 1; i < q.length; i++) ctx.lineTo(q[i][0], q[i][1]);
      ctx.closePath();
      g = ctx.createLinearGradient(q[3][0], 0, q[0][0], 0);
      g.addColorStop(0, "rgba(255, 238, 219, 0.16)");
      g.addColorStop(1, "rgba(255, 238, 219, 0.03)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 238, 219, 0.15)";
      ctx.stroke();

      // wall trims
      ctx.save();
      ctx.strokeStyle = "rgba(255, 245, 230, 0.12)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= 12; x += 2) {
        const a = p(x, 0, 0), b = p(x, 0, wallH);
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      ctx.restore();
    }

    _drawFloorFx(ctx, now) {
      if (this.path) {
        const from = this.project(this.path.from.x, this.path.from.z, 0.03);
        const to = this.project(this.path.to.x, this.path.to.z, 0.03);
        ctx.save();
        ctx.setLineDash([5, 6]);
        ctx.lineDashOffset = -((now || this.time * 1000) * 0.02) % 22;
        ctx.strokeStyle = "rgba(232, 100, 58, 0.55)";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(from[0], from[1]);
        ctx.lineTo(to[0], to[1]);
        ctx.stroke();
        ctx.restore();
      }
      if (this.scanState) {
        const t = Math.min(1, (performance.now() - this.scanState.start) / this.scanState.duration);
        const base = this.project(this.robot.x, this.robot.z, 0.03);
        for (let k = 0; k < 3; k++) {
          const p = (t + k / 3) % 1;
          const rx = (0.5 + p * 3.4) * this.scale;
          const ry = rx * 0.5;
          ctx.save();
          ctx.strokeStyle = `rgba(232, 100, 58, ${0.48 * (1 - p)})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.ellipse(base[0], base[1], rx, ry, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
      if (this.memoryMarker) {
        const mp = this.project(this.memoryMarker.x, this.memoryMarker.z, 0.03);
        ctx.save();
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = "rgba(199, 91, 74, 0.65)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(mp[0], mp[1], 18, 9, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "rgba(199, 91, 74, 0.7)";
        ctx.font = "600 8px 'PingFang SC','Microsoft YaHei',sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("记忆位置", mp[0], mp[1] - 14);
        ctx.restore();
      }
    }

    _drawFurniture(ctx, f) {
      const box = (x, z, w, d, h, color, opts) => this._box(ctx, x, z, w, d, h, color, opts);
      if (f.type === "sofa") {
        box(f.x, f.z, f.w, f.d, 0.32, shade(f.color, 0.9));
        box(f.x, f.z - 0.05, f.w, 0.22, f.h + 0.12, f.color);
        box(f.x - 0.08, f.z, 0.22, f.d, f.h * 0.85, shade(f.color, 0.94));
        box(f.x + f.w - 0.14, f.z, 0.22, f.d, f.h * 0.85, shade(f.color, 0.94));
        box(f.x + 0.18, f.z + 0.18, f.w * 0.43, f.d * 0.62, 0.14, "#d7c9b7", { y: 0.34 });
        box(f.x + f.w * 0.52, f.z + 0.18, f.w * 0.42, f.d * 0.62, 0.14, "#c9b39e", { y: 0.34 });
        box(f.x + 0.32, f.z + 0.08, 0.34, 0.34, 0.28, "#c26b4e", { y: 0.42 });
      } else if (f.type === "coffee") {
        box(f.x, f.z, f.w, f.d, 0.08, shade(f.color, 1.08));
        for (const lx of [0.08, f.w - 0.14]) for (const lz of [0.08, f.d - 0.14]) {
          box(f.x + lx, f.z + lz, 0.07, 0.07, f.h - 0.08, shade(f.color, 0.62));
        }
      } else if (f.type === "tv") {
        box(f.x, f.z, f.w, f.d, f.h, shade(f.color, 0.92));
        box(f.x + 0.04, f.z + 0.12, 0.08, f.d - 0.24, 1.0, "#1d2428", { y: f.h + 0.05 });
        box(f.x + 0.13, f.z + 0.18, 0.02, f.d - 0.36, 0.86, "#36545b", { y: f.h + 0.1 });
      } else if (f.type === "bed") {
        box(f.x, f.z, f.w, f.d, 0.3, shade(f.color, 0.86));
        box(f.x + 0.05, f.z + 0.06, f.w - 0.1, f.d - 0.12, 0.2, "#e4d4bf", { y: 0.3 });
        box(f.x, f.z - 0.06, f.w, 0.12, f.h + 0.5, shade(f.color, 0.72));
        box(f.x + 0.12, f.z + 0.12, f.w * 0.4, f.d * 0.34, 0.12, "#f1e6d6", { y: 0.52 });
        box(f.x + f.w * 0.52, f.z + 0.12, f.w * 0.36, f.d * 0.34, 0.12, "#f1e6d6", { y: 0.52 });
        box(f.x + 0.1, f.z + 0.95, f.w - 0.2, f.d * 0.5, 0.06, "#c27a5e", { y: 0.5 });
      } else if (f.type === "nightstand") {
        box(f.x, f.z, f.w, f.d, f.h, shade(f.color, 0.94));
        box(f.x + 0.08, f.z + 0.06, f.w - 0.16, 0.02, f.h * 0.55, "#6e4a30", { y: 0.12 });
      } else if (f.type === "desk") {
        box(f.x, f.z, f.w, f.d, 0.08, shade(f.color, 1.08));
        for (const lx of [0.1, f.w - 0.16]) for (const lz of [0.08, f.d - 0.14]) {
          box(f.x + lx, f.z + lz, 0.07, 0.07, f.h - 0.08, shade(f.color, 0.62));
        }
        box(f.x + f.w * 0.34, f.z + 0.12, 0.62, 0.08, 0.42, "#222a2e", { y: f.h + 0.06 });
        box(f.x + f.w * 0.36, f.z + 0.13, 0.58, 0.02, 0.34, "#3b6268", { y: f.h + 0.1 });
      } else if (f.type === "shelf") {
        box(f.x, f.z, f.w, f.d, f.h, shade(f.color, 0.92));
        for (let i = 1; i < 4; i++) {
          box(f.x + 0.03, f.z + 0.08, f.w - 0.06, f.d - 0.16, 0.035, shade(f.color, 1.08), { y: i * 0.5 });
        }
        const colors = ["#c26b4e", "#d3a15a", "#6f8b7b", "#d7c9b7"];
        for (let i = 0; i < 8; i++) {
          box(f.x + 0.06, f.z + 0.12 + i * 0.24, f.w - 0.12, 0.1, 0.26, colors[i % colors.length], { y: 0.28 + Math.floor(i / 4) * 0.5 });
        }
      } else if (f.type === "plant") {
        box(f.x, f.z, f.w, f.d, 0.32, "#a96b4d");
        const c = this.project(f.x + f.w / 2, f.z + f.d / 2, 0.4);
        ctx.save();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          ctx.fillStyle = i % 2 ? "#6e8b6a" : "#83a07a";
          ctx.beginPath();
          ctx.ellipse(c[0] + Math.cos(a) * 8, c[1] - 12 + Math.sin(a) * 5, 9, 5, a, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    _box(ctx, x, z, w, d, h, color, opts) {
      opts = opts || {};
      const y0 = opts.y || 0;
      const p = (px, pz, py) => this.project(px, pz, py);
      const top = [p(x, z, y0 + h), p(x + w, z, y0 + h), p(x + w, z + d, y0 + h), p(x, z + d, y0 + h)];
      const front = [p(x, z + d, y0), p(x + w, z + d, y0), p(x + w, z + d, y0 + h), p(x, z + d, y0 + h)];
      const side = [p(x + w, z, y0), p(x + w, z + d, y0), p(x + w, z + d, y0 + h), p(x + w, z, y0 + h)];
      const poly = (pts, fill, stroke) => {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        if (stroke) {
          ctx.strokeStyle = stroke;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      };
      poly(side, shade(color, 0.66), "rgba(40, 25, 15, 0.12)");
      poly(front, shade(color, 0.82), "rgba(40, 25, 15, 0.12)");
      poly(top, shade(color, 1.12), "rgba(40, 25, 15, 0.14)");
    }

    _drawObject(ctx, o, now) {
      const target = o.id === this.targetId;
      const p = this.project(o.x, o.z, o.y);
      const s = this.scale;
      ctx.save();
      if (o.kind === "cup") {
        ctx.fillStyle = o.color;
        ctx.beginPath();
        ctx.ellipse(p[0], p[1] - 9 * s / 60, 5.5 * s / 60, 3.2 * s / 60, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(p[0] - 2.6 * s / 60, p[1] - 9 * s / 60, 5.2 * s / 60, 9 * s / 60);
      } else if (o.kind === "bottle") {
        ctx.fillStyle = o.color;
        ctx.fillRect(p[0] - 2.6 * s / 60, p[1] - 10 * s / 60, 5.2 * s / 60, 9 * s / 60);
        ctx.fillStyle = "#c98a4b";
        ctx.fillRect(p[0] - 1.8 * s / 60, p[1] - 13 * s / 60, 3.6 * s / 60, 3.5 * s / 60);
      } else if (o.kind === "headphones") {
        ctx.strokeStyle = o.color;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(p[0], p[1] - 7 * s / 60, 6.5 * s / 60, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = o.color;
        ctx.beginPath(); ctx.arc(p[0] - 6.5 * s / 60, p[1] - 7 * s / 60, 2.6 * s / 60, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(p[0] + 6.5 * s / 60, p[1] - 7 * s / 60, 2.6 * s / 60, 0, Math.PI * 2); ctx.fill();
      } else if (o.kind === "umbrella") {
        ctx.fillStyle = o.color;
        ctx.fillRect(p[0] - 2 * s / 60, p[1] - 36 * s / 60, 4 * s / 60, 36 * s / 60);
        ctx.beginPath();
        ctx.ellipse(p[0], p[1] - 36 * s / 60, 5 * s / 60, 3 * s / 60, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const w = o.kind === "book" || o.kind === "notebook" ? 8 : 5;
        const d = o.kind === "book" || o.kind === "notebook" ? 6 : 3;
        this._box(ctx, o.x - w / 120, o.z - d / 120, w / 60, d / 60, 0.06, o.color, { y: o.y });
      }
      if (target) {
        const t = (now || 0) * 0.004;
        ctx.strokeStyle = `rgba(232, 100, 58, ${0.5 + 0.3 * Math.sin(t * 2)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.ellipse(p[0], p[1] + 1, 13 + Math.sin(t) * 2, 6.5 + Math.sin(t), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    _drawRobot(ctx, now) {
      const r = this.robot;
      const p = this.project(r.x, r.z, 0);
      const s = this.scale;
      const bodyW = 0.46 * s;
      const bob = r.bob * s;
      ctx.save();
      // shadow
      ctx.fillStyle = "rgba(30, 18, 10, 0.24)";
      ctx.beginPath();
      ctx.ellipse(p[0], p[1] + 1, bodyW * 0.9, bodyW * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      // glow ring
      ctx.strokeStyle = "rgba(232, 100, 58, 0.35)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(p[0], p[1] + 1, bodyW * (1 + 0.04 * Math.sin(now * 0.003)), bodyW * 0.48, 0, 0, Math.PI * 2);
      ctx.stroke();
      // body
      const bodyTop = p[1] - 0.55 * s + bob;
      const bodyH = 0.55 * s;
      const g = ctx.createLinearGradient(p[0], bodyTop, p[0], bodyTop + bodyH);
      g.addColorStop(0, "#f3eee5");
      g.addColorStop(1, "#c9c1b5");
      ctx.fillStyle = g;
      this._roundRect(ctx, p[0] - bodyW / 2, bodyTop, bodyW, bodyH, bodyW * 0.28);
      ctx.fill();
      ctx.strokeStyle = "rgba(60, 45, 32, 0.16)";
      ctx.lineWidth = 0.8;
      ctx.stroke();
      // chest
      ctx.fillStyle = "#1f2428";
      this._roundRect(ctx, p[0] - bodyW * 0.22, bodyTop + bodyH * 0.3, bodyW * 0.44, bodyH * 0.22, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(232, 100, 58, 0.8)";
      ctx.fillRect(p[0] - bodyW * 0.1, bodyTop + bodyH * 0.39, bodyW * 0.2, 1.3);
      // head
      const headY = bodyTop - 0.28 * s + bob * 0.5;
      const headW = bodyW * 0.86;
      const headH = 0.28 * s;
      const hg = ctx.createLinearGradient(p[0], headY, p[0], headY + headH);
      hg.addColorStop(0, "#faf6ef");
      hg.addColorStop(1, "#d5cec2");
      ctx.fillStyle = hg;
      this._roundRect(ctx, p[0] - headW / 2, headY, headW, headH, headW * 0.3);
      ctx.fill();
      ctx.strokeStyle = "rgba(60, 45, 32, 0.16)";
      ctx.stroke();
      // face
      ctx.fillStyle = "#1b2023";
      this._roundRect(ctx, p[0] - headW * 0.34, headY + headH * 0.3, headW * 0.68, headH * 0.42, 3);
      ctx.fill();
      const blink = 0.6 + 0.4 * Math.abs(Math.sin(now * 0.0016));
      ctx.fillStyle = "rgba(110, 242, 220, 0.9)";
      for (const side of [-1, 1]) {
        ctx.fillRect(p[0] + side * headW * 0.15 - 1, headY + headH * 0.46, 2, 3.2 * blink);
      }
      // antenna
      ctx.strokeStyle = "rgba(250, 246, 239, 0.75)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p[0], headY);
      ctx.lineTo(p[0], headY - 0.12 * s);
      ctx.stroke();
      ctx.fillStyle = "rgba(232, 100, 58, 0.9)";
      ctx.beginPath();
      ctx.arc(p[0], headY - 0.14 * s, 1.6, 0, Math.PI * 2);
      ctx.fill();
      // state dots
      if (r.state === "thinking") {
        ctx.fillStyle = "rgba(232, 100, 58, 0.7)";
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(p[0] + (i - 1) * 7, headY - 0.26 * s, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    _drawTargetFx(ctx, now) {
      if (!this.targetId) return;
      const o = this.getObject(this.targetId);
      if (!o) return;
      const p = this.project(o.x, o.z, o.y + 0.02);
      const top = this.project(o.x, o.z, o.y + 1.35);
      const t = (now || 0) * 0.001;
      ctx.save();
      const grad = ctx.createLinearGradient(p[0], p[1], top[0], top[1]);
      grad.addColorStop(0, "rgba(232, 100, 58, 0.28)");
      grad.addColorStop(1, "rgba(232, 100, 58, 0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(top[0], top[1]);
      ctx.stroke();
      const ry = 6.5 + Math.sin(t * 3) * 1.5;
      ctx.strokeStyle = `rgba(232, 100, 58, ${0.5 + 0.35 * Math.sin(t * 3)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], ry * 2.1, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    _drawCarried(ctx, now) {
      const o = this.getObject(this.robot.carrying);
      if (!o) return;
      const p = this.project(this.robot.x, this.robot.z, 1.22);
      ctx.save();
      ctx.fillStyle = o.color;
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 245, 230, 0.6)";
      ctx.beginPath();
      ctx.arc(p[0] + 8, p[1] - 7, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    _drawDust(ctx) {
      ctx.save();
      for (const d of this.dust) {
        if (d.y < -0.02) d.y = 1.02;
        ctx.fillStyle = `rgba(255, 235, 210, ${d.a})`;
        ctx.beginPath();
        ctx.arc(d.x * this.w, d.y * this.h, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    _drawVignette(ctx) {
      const g = ctx.createRadialGradient(this.w * 0.5, this.h * 0.48, this.h * 0.25, this.w * 0.5, this.h * 0.5, Math.max(this.w, this.h) * 0.75);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(6, 4, 3, 0.52)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, this.w, this.h);
    }

    _roundRect(ctx, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    }
  }

  global.HomeTwinScene = IsoScene;
})(window);
