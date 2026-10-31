/* global THREE, RF */
(function () {
  const T = window.THREE;
  const RF = window.RF;

  function showFatal(msg) {
    const el = document.getElementById("fatal");
    const pre = document.getElementById("fatal-msg");
    if (el && pre) {
      pre.textContent = String(msg || "未知错误");
      el.classList.remove("hidden");
    }
    console.error(msg);
  }

  if (!T || !RF) {
    showFatal("依赖脚本加载失败：请确认 assets/three.min.js 与 src/*.js 完整。");
    return;
  }

  class CameraRig {
    constructor(camera) {
      this.camera = camera;
      this.target = new T.Vector3(0.5, 0.5, 0);
      this.desiredTarget = this.target.clone();
      this.radius = 24;
      this.desiredRadius = 24;
      this.theta = 0;
      this.desiredTheta = 0;
      this.phi = 0.92;
      this.desiredPhi = 0.92;
      this.follow = null;
      this.robot = null;
      this.manual = false;
    }

    overview() {
      this.follow = null;
      this.desiredTarget.set(0.5, 0.5, 0);
      this.desiredRadius = 24;
      this.desiredTheta = 0;
      this.desiredPhi = 0.92;
      this.manual = false;
    }

    followRobot() {
      this.follow = "robot";
      this.desiredRadius = 9.2;
      this.desiredTheta = -0.28;
      this.desiredPhi = 0.78;
      this.manual = false;
    }

    focusOn(pos, opts) {
      opts = opts || {};
      this.follow = null;
      this.desiredTarget.set(pos.x, pos.y, pos.z);
      this.desiredRadius = opts.radius || 4.6;
      this.desiredTheta = opts.theta === undefined ? 0.15 : opts.theta;
      this.desiredPhi = opts.phi === undefined ? 1.02 : opts.phi;
      this.manual = false;
    }

    update(dt) {
      if (this.follow === "robot" && this.robot) {
        const p = this.robot.group.position;
        this.desiredTarget.set(p.x, p.y + 0.55, p.z);
      }
      const k = 1 - Math.exp(-3.4 * dt);
      this.target.lerp(this.desiredTarget, k);
      this.radius = RF.damp(this.radius, this.desiredRadius, 3.0, dt);
      this.theta = RF.damp(this.theta, this.desiredTheta, 3.2, dt);
      this.phi = RF.damp(this.phi, this.desiredPhi, 3.2, dt);
      const sp = Math.sin(this.phi);
      this.camera.position.set(
        this.target.x + this.radius * sp * Math.sin(this.theta),
        this.target.y + this.radius * Math.cos(this.phi),
        this.target.z + this.radius * sp * Math.cos(this.theta)
      );
      this.camera.lookAt(this.target);
    }
  }

  class App {
    constructor() {
      this.dom = {};
      this.state = "boot";
      this.busy = false;
      this.started = false;
      this.memoryReady = false;
      this.scannedRooms = [false, false, false];
      this.roomProgress = [0, 0, 0];
      this.activeRoom = -1;
      this.stepCount = 0;
      this.lastStepCount = 0;
      this.actions = [];
      this.sdWriteFailed = false;
      this.foundId = null;
      this.lastTargetId = null;
      this.timeScale = 1;
      this.simTime = 0;
      this.robotSpeed = 0;
      this.robotScanning = false;
      this.robotLookDown = false;
      this.pathLine = null;
      this.foundFx = null;
      this.introOrbit = true;
      this.viewMode = "overlay";
      this.realtwinActive = false;
      this.last = performance.now();

      this.bindDom();
      // 场景替换通过工厂适配完整 World 接口，不用视觉点云冒充碰撞/语义真值。
      this.world = RF.createWorld ? RF.createWorld(this.dom.canvas) : new RF.World(this.dom.canvas);
      this.rig = new CameraRig(this.world.camera);
      this.rig.robot = this.world.robot;
      this.memory = new RF.SpatialMemory();
      this.sd = new RF.SDCard();
      const catalog = this.world.objectList.map((o) => ({
        id: o.id,
        name: o.name,
        category: o.category,
        aliases: o.aliases,
        colorName: o.colorName,
        color: o.color,
        shape: o.shape,
        size: o.size,
        room: o.room,
        roomIndex: o.roomIndex,
        currentPos: o.currentPos,
      }));
      this.agent = new RF.Agent(catalog);
      this.tween = new RF.TweenManager();
      this.realtwin = RF.RealtwinViewer ? new RF.RealtwinViewer(this) : null;

      this.grid = new T.GridHelper(20, 40, 0x1e4a46, 0x0d2626);
      this.grid.position.set(0.5, 0.008, 0);
      this.grid.material.transparent = true;
      this.grid.material.opacity = 0.3;
      this.grid.material.depthWrite = false;
      this.grid.visible = false;
      this.world.fxGroup.add(this.grid);

      this.bindUI();
      this.setViewMode("overlay");
      this.updateAllUI();
      this.setState("idle");
      this.initDebugAPI();
      this.installPointerControls();

      if (this.sd.hasStoredPack()) {
        const s = this.sd.status();
        const btn = this.dom.btnLoad;
        btn.classList.remove("hidden");
        btn.textContent = "加载机身 SD 卡记忆 · " + RF.formatBytes(s.bytes);
      }

      requestAnimationFrame((t) => this.loop(t));
      window.__appReady = true;
    }

    bindDom() {
      const $ = (id) => document.getElementById(id);
      this.dom = {
        canvas: $("scene"),
        intro: $("intro"),
        btnStart: $("btn-start"),
        btnLoad: $("btn-load"),
        btnScan: $("btn-scan"),
        btnHelp: $("btn-help"),
        helpModal: $("help-modal"),
        btnHelpClose: $("btn-help-close"),
        pillMemory: $("pill-memory"),
        pillSplat: $("pill-splat"),
        pillLayout: $("pill-layout"),
        toggleMemory: $("toggle-memory"),
        queryForm: $("query-form"),
        input: $("query-input"),
        findBtn: $("btn-find"),
        suggestions: $("suggestions"),
        viewSwitch: $("view-switch"),
        memoryList: $("memory-list"),
        memoryEmpty: $("memory-empty"),
        memoryCount: $("memory-count"),
        sdStatus: $("sd-status"),
        sdLock: $("sd-lock"),
        sdBar: $("sd-bar"),
        sdUsed: $("sd-used"),
        btnExport: $("btn-export"),
        btnErase: $("btn-erase"),
        privacyLine: $("privacy-line"),
        robotState: $("robot-state"),
        statObjects: $("stat-objects"),
        statSplats: $("stat-splats"),
        statSteps: $("stat-steps"),
        timeline: $("timeline"),
        stepCount: $("step-count"),
        reasoning: $("reasoning"),
        attrChips: $("attr-chips"),
        matchList: $("match-list"),
        scanToast: $("scan-toast"),
        scanTitle: $("scan-title"),
        scanSub: $("scan-sub"),
        scanPct: $("scan-pct"),
        scanBar: $("scan-progress-bar"),
        speech: $("speech"),
        speechText: $("speech-text"),
        objectLabel: $("object-label"),
        objLabelName: $("obj-label-name"),
        objLabelSub: $("obj-label-sub"),
        toast: $("toast"),
        btnMove: $("btn-move"),
        btnCorrect: $("btn-correct"),
        roomLabels: {},
      };
      document.querySelectorAll(".room-label").forEach((el) => {
        this.dom.roomLabels[el.dataset.room] = el;
      });
    }

    bindUI() {
      this.dom.btnStart.addEventListener("click", () => this.startDemo());
      this.dom.btnLoad.addEventListener("click", () => this.loadFromSD());
      this.dom.btnScan.addEventListener("click", () => {
        if (this.busy || !this.started) return;
        this.scanAll().then(() => this.focusInput());
      });
      this.dom.btnHelp.addEventListener("click", () => this.dom.helpModal.classList.remove("hidden"));
      this.dom.btnHelpClose.addEventListener("click", () => this.dom.helpModal.classList.add("hidden"));
      this.dom.helpModal.addEventListener("click", (e) => {
        if (e.target === this.dom.helpModal) this.dom.helpModal.classList.add("hidden");
      });
      this.dom.queryForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const q = this.dom.input.value.trim();
        if (q) this.runQuery(q);
      });
      this.dom.suggestions.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (this.busy) return;
          this.dom.input.value = btn.dataset.q;
          this.runQuery(btn.dataset.q);
        });
      });
      this.dom.viewSwitch.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => this.setViewMode(btn.dataset.mode));
      });
      this.dom.toggleMemory.addEventListener("change", () => {
        this.setMemoryEnabled(this.dom.toggleMemory.checked);
      });
      this.dom.pillMemory.addEventListener("click", () => {
        if (this.busy) return;
        this.setMemoryEnabled(!this.memory.enabled);
      });
      this.dom.btnMove.addEventListener("click", () => this.demoMoveObject());
      this.dom.btnCorrect.addEventListener("click", () => this.demoCorrect());
      this.dom.btnExport.addEventListener("click", () => {
        if (this.sd.exportPack()) this.toast("记忆包已导出（加密 JSON）", "", 3200);
        else this.toast("暂无可导出的记忆包", "warn");
      });
      this.dom.btnErase.addEventListener("click", () => this.clearMemory());
      this.dom.memoryList.addEventListener("click", (e) => {
        const item = e.target.closest(".memory-item");
        if (!item || this.busy || !this.started) return;
        const rec = this.memory.get(item.dataset.id);
        if (rec) {
          this.dom.input.value = "帮我找" + rec.name;
          this.runQuery(this.dom.input.value);
        }
      });
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") this.dom.helpModal.classList.add("hidden");
      });
      window.addEventListener("resize", () => this.world.resize());
      this.dom.canvas.addEventListener("webglcontextlost", (e) => {
        e.preventDefault();
        this.toast("WebGL 上下文丢失，请刷新页面", "error", 8000);
      });
    }

    installPointerControls() {
      const el = this.dom.canvas;
      let dragging = false;
      let button = 0;
      let lastX = 0;
      let lastY = 0;

      el.addEventListener("pointerdown", (e) => {
        dragging = true;
        button = e.button;
        lastX = e.clientX;
        lastY = e.clientY;
        el.setPointerCapture(e.pointerId);
        this.introOrbit = false;
        this.rig.manual = true;
        this.rig.follow = null;
      });
      el.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX;
        lastY = e.clientY;
        if (button === 2) {
          const dir = new T.Vector3();
          this.rig.camera.getWorldDirection(dir);
          dir.y = 0;
          dir.normalize();
          const right = new T.Vector3().crossVectors(this.rig.camera.up, dir).normalize();
          this.rig.desiredTarget.addScaledVector(right, -dx * 0.018);
          this.rig.desiredTarget.addScaledVector(dir, dy * 0.018);
          this.rig.target.copy(this.rig.desiredTarget);
        } else {
          this.rig.desiredTheta -= dx * 0.0052;
          this.rig.desiredPhi = RF.clamp(this.rig.desiredPhi - dy * 0.0038, 0.22, 1.44);
        }
      });
      const end = (e) => {
        if (dragging) {
          dragging = false;
          try {
            el.releasePointerCapture(e.pointerId);
          } catch (err) {
            // ignore
          }
        }
      };
      el.addEventListener("pointerup", end);
      el.addEventListener("pointercancel", end);
      el.addEventListener("contextmenu", (e) => e.preventDefault());
      el.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          this.rig.desiredRadius = RF.clamp(this.rig.desiredRadius * (1 + e.deltaY * 0.0011), 4.2, 34);
          this.rig.follow = null;
          this.rig.manual = true;
        },
        { passive: false }
      );
    }

    /* ---------------- UI ---------------- */
    setState(state) {
      this.state = state;
      const map = {
        boot: "启动中 · 加载场景",
        idle: "待机 · 等待指令",
        loading: "读取机身 SD 卡",
        scanning: "扫描 · 构建高斯记忆",
        planning: "解析指令 · 端侧检索",
        navigating: "导航中 · A* 避障",
        searching: "视觉复核 · 目标确认",
        found: "已找到 · 本地记忆",
        completed: "任务完成",
        error: "异常 · 请重试",
      };
      this.dom.robotState.textContent = map[state] || state;
    }

    setUIBusy(b) {
      this.busy = b;
      this.updateInputState();
    }

    updateInputState() {
      const disabled = this.busy || !this.started;
      this.dom.input.disabled = disabled;
      this.dom.findBtn.disabled = disabled;
      this.dom.btnScan.disabled = this.busy || !this.started;
      this.dom.toggleMemory.disabled = this.busy || !this.started;
      this.dom.btnMove.disabled = this.busy || !this.started;
      this.dom.btnCorrect.disabled = this.busy || !this.started;
      this.dom.suggestions.querySelectorAll("button").forEach((b) => (b.disabled = disabled));
      this.dom.btnStart.disabled = this.busy || this.started;
      this.dom.btnLoad.disabled = this.busy || this.started;
    }

    focusInput() {
      if (!this.started) return;
      this.dom.input.disabled = false;
      this.dom.findBtn.disabled = false;
      this.dom.input.focus();
    }

    toast(text, type, duration) {
      RF.toast(this.dom.toast, text, type, duration);
    }

    wait(seconds) {
      return this.tween.delay(seconds);
    }

    say(text, duration) {
      if (!this.dom.speech) return;
      const str = String(text || "");
      clearTimeout(this._speechHide);
      clearInterval(this._speechType);
      this.dom.speech.classList.remove("hidden");
      this.dom.speechText.textContent = "";
      let i = 0;
      this._speechType = setInterval(() => {
        i += 1;
        this.dom.speechText.textContent = str.slice(0, i);
        if (i >= str.length) clearInterval(this._speechType);
      }, 18);
      this._speechHide = setTimeout(() => this.hideSpeech(), (duration || 5200) + str.length * 18);
    }

    hideSpeech() {
      clearInterval(this._speechType);
      clearTimeout(this._speechHide);
      this.dom.speech.classList.add("hidden");
    }

    startTimeline() {
      this.dom.timeline.innerHTML = "";
      this._timelineSteps = [];
    }

    addStep(title, sub) {
      if (!this.dom.timeline.querySelector) return null;
      if (!this.dom.timeline.children.length || this.dom.timeline.querySelector(".timeline-empty")) {
        this.dom.timeline.innerHTML = "";
      }
      const el = document.createElement("div");
      el.className = "tl-item active";
      el.innerHTML =
        '<div class="tl-rail"><span class="tl-dot"></span></div>' +
        '<div class="tl-body"><div class="tl-title"></div><div class="tl-sub"></div><div class="tl-time"></div></div>';
      el.querySelector(".tl-title").textContent = title;
      el.querySelector(".tl-sub").textContent = sub || "";
      el.querySelector(".tl-time").textContent = RF.formatTime();
      this.dom.timeline.appendChild(el);
      this.dom.timeline.scrollTop = this.dom.timeline.scrollHeight;
      (this._timelineSteps = this._timelineSteps || []).push(el);
      return el;
    }

    completeStep(el, sub) {
      if (!el || el.classList.contains("error")) return;
      el.classList.remove("active");
      el.classList.add("done");
      if (sub !== undefined) el.querySelector(".tl-sub").textContent = sub;
      this.dom.timeline.scrollTop = this.dom.timeline.scrollHeight;
    }

    failStep(el, sub) {
      if (!el) return;
      el.classList.remove("active", "done");
      el.classList.add("error");
      if (sub !== undefined) el.querySelector(".tl-sub").textContent = sub;
      this.dom.timeline.scrollTop = this.dom.timeline.scrollHeight;
    }

    showReasoning(profile, candidates, bestId) {
      this.dom.reasoning.classList.remove("hidden");
      this.dom.attrChips.innerHTML = "";
      const addChip = (text, neutral) => {
        const s = document.createElement("span");
        s.className = "attr-chip" + (neutral ? " neutral" : "");
        s.textContent = text;
        this.dom.attrChips.appendChild(s);
      };
      for (const c of profile.colors || []) addChip("颜色 · " + c);
      for (const s of profile.sizes || []) addChip("尺寸 · " + s);
      for (const s of profile.shapes || []) addChip("形状 · " + s);
      for (const r of profile.rooms || []) addChip("房间 · " + r);
      for (const t of profile.nameTerms || []) addChip("关键词 · " + t);
      if (!this.dom.attrChips.children.length) addChip("未识别到属性", true);

      this.dom.matchList.innerHTML = "";
      const list = (candidates || []).slice(0, 4);
      if (!list.length) {
        this.dom.matchList.innerHTML = '<div class="match-row"><span class="m-name">无候选</span></div>';
        return;
      }
      for (const c of list) {
        const id = c.record.object_id || c.record.id;
        const row = document.createElement("div");
        row.className = "match-row" + (id === bestId ? " best" : "");
        row.innerHTML =
          '<span class="m-name"></span><span class="m-score"></span>';
        row.querySelector(".m-name").textContent = c.record.name + " · " + c.record.room;
        row.querySelector(".m-score").textContent = Math.round(c.score * 100) + "%";
        this.dom.matchList.appendChild(row);
      }
    }

    renderMemoryList() {
      const records = this.memory.all().sort((a, b) => {
        if (a.roomIndex !== b.roomIndex) return a.roomIndex - b.roomIndex;
        return a.name.localeCompare(b.name, "zh");
      });
      this.dom.memoryCount.textContent = records.length;
      if (!records.length) {
        this.dom.memoryEmpty.classList.remove("hidden");
        this.dom.memoryList.innerHTML = "";
      } else {
        this.dom.memoryEmpty.classList.add("hidden");
        this.dom.memoryList.innerHTML = "";
        for (const rec of records) {
          const item = document.createElement("div");
          item.className = "memory-item";
          item.dataset.id = rec.object_id;
          if (rec.status === "stale") item.classList.add("stale");
          if (rec.object_id === this.foundId) item.classList.add("found");
          const pct = Math.round(rec.confidence * 100);
          item.innerHTML =
            '<span class="swatch" style="background:' + rec.color + '"></span>' +
            '<div class="mem-body"><div class="mem-row"><span class="mem-name"></span><span class="mem-room"></span></div>' +
            '<div class="mem-sub"><div class="conf-bar"><i style="width:' + pct + '%"></i></div><span class="conf-num">' + pct + '%</span></div></div>';
          item.querySelector(".mem-name").textContent = rec.name;
          item.querySelector(".mem-room").textContent = rec.room + " · " + rec.furniture;
          this.dom.memoryList.appendChild(item);
        }
      }
      this.updateStats();
    }

    visibleSplatCount() {
      const counts = this.world.roomSplatCounts || [0, 0, 0];
      let total = 0;
      for (let i = 0; i < 3; i++) total += counts[i] * (this.roomProgress[i] || 0);
      for (const obj of this.world.objectList) {
        const rv = obj.splats && obj.splats.uniforms && obj.splats.uniforms.uReveal
          ? obj.splats.uniforms.uReveal.value
          : (this.roomProgress[obj.currentRoomIndex] || 0);
        total += obj.splatCount * rv;
      }
      return Math.round(total);
    }

    resetActions() {
      this.actions = [];
      this.stepCount = 0;
      this.lastStepCount = 0;
      this.updateStats();
    }

    addAction(action, details) {
      this.actions.push(Object.assign({ action }, details || {}));
      this.stepCount = this.actions.length;
      this.lastStepCount = this.stepCount;
      this.updateStats();
    }

    updateStats() {
      const shownSplats = this.visibleSplatCount();
      this.dom.statObjects.textContent = this.memory.all().length;
      this.dom.statSplats.textContent = RF.formatNumber(shownSplats);
      this.dom.statSteps.textContent = this.stepCount;
      this.dom.stepCount.textContent = this.stepCount + " 动作";
      this.dom.pillSplat.textContent = "GS " + RF.formatNumber(shownSplats) + " pts";
    }

    updateSDUI() {
      const s = this.sd.status();
      if (s.bytes > 0) {
        this.dom.sdStatus.textContent = this.sdWriteFailed
          ? "写入失败 · 最新记忆仅在内存"
          : s.persisted
            ? "已写入 · " + RF.formatNumber(s.splats) + " 高斯点"
            : "未持久化 · 仅本次会话可用";
        this.dom.sdBar.style.width = Math.max(1.5, s.percent) + "%";
        this.dom.sdUsed.textContent = RF.formatBytes(s.bytes) + " / 4 MB";
        this.dom.sdLock.textContent = s.alg.indexOf("AES") >= 0 ? "AES-256" : "XOR";
        this.dom.sdLock.title = s.alg + " · " + (s.packId || "");
        this.dom.btnExport.disabled = false;
        this.dom.btnErase.disabled = false;
      } else {
        this.dom.sdStatus.textContent = this.sdWriteFailed ? "写入失败 · 最新记忆仅在内存" : "等待写入";
        this.dom.sdBar.style.width = "0%";
        this.dom.sdUsed.textContent = "0 KB";
        this.dom.sdLock.textContent = "AES-256";
        this.dom.btnExport.disabled = true;
        this.dom.btnErase.disabled = true;
      }
      this.dom.privacyLine.textContent = "0 KB 上云 · 网络隔离";
    }

    updateAllUI() {
      this.renderMemoryList();
      this.updateSDUI();
      this.dom.pillMemory.innerHTML =
        '<i class="dot ' + (this.memory.enabled ? "cyan" : "") + '"></i>记忆增强 ' +
        (this.memory.enabled ? "ON" : "OFF");
      this.dom.pillMemory.classList.toggle("off", !this.memory.enabled);
      this.dom.toggleMemory.checked = this.memory.enabled;
      this.dom.stepCount.textContent = this.stepCount + " 动作";
      this.updateInputState();
    }

    setMemoryEnabled(v) {
      this.memory.setEnabled(v);
      this.dom.toggleMemory.checked = v;
      this.dom.pillMemory.innerHTML = '<i class="dot ' + (v ? "cyan" : "") + '"></i>记忆增强 ' + (v ? "ON" : "OFF");
      this.dom.pillMemory.classList.toggle("off", !v);
      if (!v) this.toast("记忆增强已关闭：下次找物将从全屋扫描开始", "warn", 3800);
      else this.toast("记忆增强已开启：优先使用本地空间记忆", "", 3200);
    }

    setViewMode(mode) {
      if (!["real", "overlay", "splat"].includes(mode)) mode = "overlay";
      this.viewMode = mode;
      this.world.setViewMode(mode);
      this.grid.visible = mode === "splat";
      this.dom.viewSwitch.querySelectorAll("button").forEach((b) => {
        b.classList.toggle("active", b.dataset.mode === mode);
      });
      const scene = this.world.scene;
      if (mode === "splat") {
        scene.background.setHex(0x02050a);
        scene.fog.density = 0.004;
        this.world.renderer.toneMappingExposure = 1.18;
      } else {
        scene.background.setHex(0x070b11);
        scene.fog.density = 0.0085;
        this.world.renderer.toneMappingExposure = 1.08;
      }
    }

    updateRoomLabels() {
      const camera = this.world.camera;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const closeUp = this.rig.radius < 12;
      for (let i = 0; i < this.world.roomCenters.length; i++) {
        const room = this.world.roomCenters[i];
        const el = this.dom.roomLabels[room.name];
        if (!el) continue;
        const isActive = this.activeRoom === i;
        if (closeUp && !isActive) {
          el.style.display = "none";
          continue;
        }
        const v = this.world.roomLabelPos[room.name].clone().project(camera);
        const x = (v.x * 0.5 + 0.5) * w;
        const y = (-v.y * 0.5 + 0.5) * h;
        if (v.z > 1 || x < -200 || x > w + 200 || y < -120 || y > h + 120) {
          el.style.display = "none";
          continue;
        }
        el.style.display = "";
        el.style.left = x + "px";
        el.style.top = y + "px";
        el.classList.toggle("scanned", !!this.scannedRooms[i]);
        el.classList.toggle("active", isActive);
      }
    }

    updateOverlays() {
      this.updateRoomLabels();
      const w = window.innerWidth;
      const h = window.innerHeight;
      const camera = this.world.camera;

      if (!this.dom.speech.classList.contains("hidden") && this.started) {
        const p = this.world.robot.group.position;
        const v = new T.Vector3(p.x, 1.55, p.z).project(camera);
        const x = (v.x * 0.5 + 0.5) * w;
        const y = (-v.y * 0.5 + 0.5) * h;
        if (v.z > 1 || x < -100 || x > w + 100) {
          this.dom.speech.style.opacity = "0";
        } else {
          this.dom.speech.style.opacity = "1";
          const left = RF.clamp(x + 34, w < 1080 ? 16 : 330, Math.max(340, w - 300));
          const top = RF.clamp(y - 36, 92, h - 210);
          this.dom.speech.style.left = left + "px";
          this.dom.speech.style.top = top + "px";
        }
      }

      if (this.foundId && !this.dom.objectLabel.classList.contains("hidden")) {
        const obj = this.world.getObject(this.foundId);
        if (obj) {
          const v = new T.Vector3(obj.group.position.x, obj.group.position.y + 0.62, obj.group.position.z).project(camera);
          const x = (v.x * 0.5 + 0.5) * w;
          const y = (-v.y * 0.5 + 0.5) * h;
          if (v.z > 1) {
            this.dom.objectLabel.style.opacity = "0";
          } else {
            this.dom.objectLabel.style.opacity = "1";
            const left = RF.clamp(x + 26, w < 1080 ? 14 : 322, Math.max(330, w - 250));
            const top = RF.clamp(y - 48, 92, h - 170);
            this.dom.objectLabel.style.left = left + "px";
            this.dom.objectLabel.style.top = top + "px";
          }
        }
      }
    }

    /* ---------------- robot / path ---------------- */
    async navigateTo(point, opts) {
      opts = opts || {};
      if (!point) throw new Error("导航不可达：没有可用的目标接近点");
      const start = { x: this.world.robot.group.position.x, z: this.world.robot.group.position.z };
      const end = this.world.nav.nearestFreeWorld(point.x, point.z);
      if (!end) throw new Error("导航不可达：目标附近没有可通行位置");
      const path = this.world.nav.findPath(start, end);
      if (!path || path.length === 0) throw new Error("导航不可达：无法规划安全路径");
      this.clearPathLine();
      const pts = path.map((p) => new T.Vector3(p.x, 0.065, p.z));
      const geom = new T.BufferGeometry().setFromPoints(pts);
      const mat = new T.LineDashedMaterial({
        color: 0x5fe3cf,
        dashSize: 0.22,
        gapSize: 0.14,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
      });
      const line = new T.Line(geom, mat);
      line.computeLineDistances();
      this.world.fxGroup.add(line);
      this.pathLine = line;

      const segs = [];
      let total = 0;
      for (let i = 1; i < path.length; i++) {
        const dx = path[i].x - path[i - 1].x;
        const dz = path[i].z - path[i - 1].z;
        const len = Math.hypot(dx, dz);
        if (len < 0.0001) continue;
        segs.push({ x0: path[i - 1].x, z0: path[i - 1].z, dx, dz, len, start: total });
        total += len;
      }
      if (total < 0.001) {
        this.clearPathLine();
        this.addAction("go", { from: start, to: { x: end.x, z: end.z }, distance: total });
        return;
      }
      const speed = opts.speed || 2.1;
      this.robotSpeed = speed;
      this.world.robot.setState("walking");
      this.setState("navigating");
      if (opts.follow !== false) this.rig.followRobot();

      await new Promise((resolve) => {
        this.tween.add({
          duration: Math.max(0.35, total / speed),
          ease: RF.ease.linear,
          onUpdate: (e) => {
            const d = e * total;
            let seg = segs[segs.length - 1];
            for (let i = 0; i < segs.length; i++) {
              if (d <= segs[i].start + segs[i].len) {
                seg = segs[i];
                break;
              }
            }
            const t = RF.clamp((d - seg.start) / seg.len, 0, 1);
            const rx = seg.x0 + seg.dx * t;
            const rz = seg.z0 + seg.dz * t;
            this.world.robot.group.position.x = rx;
            this.world.robot.group.position.z = rz;
            const heading = Math.atan2(seg.dx, seg.dz);
            this.world.robot.group.rotation.y = RF.angleLerp(this.world.robot.group.rotation.y, heading, 0.22);
          },
          onComplete: () => {
            this.world.robot.group.position.x = end.x;
            this.world.robot.group.position.z = end.z;
            this.robotSpeed = 0;
            resolve();
          },
        });
      });
      this.clearPathLine();
      this.addAction("go", { from: start, to: { x: end.x, z: end.z }, distance: total });
    }

    clearPathLine() {
      if (!this.pathLine) return;
      this.world.fxGroup.remove(this.pathLine);
      this.pathLine.geometry.dispose();
      this.pathLine.material.dispose();
      this.pathLine = null;
    }

    navigationTarget(obj, rec) {
      if (!rec || !rec.pos) throw new Error("缺少目标位置快照，请重新扫描");
      return {
        id: obj.id,
        name: rec.name || obj.name,
        currentPos: rec.pos.slice(),
        currentRoom: rec.room,
        currentRoomIndex: rec.roomIndex,
        currentFurniture: rec.furniture,
        homePos: obj.homePos.slice(),
        homeRoom: obj.homeRoom,
        approach: obj.approach ? obj.approach.slice() : null,
      };
    }

    findApproach(obj) {
      const room = this.world.roomCenters[obj.currentRoomIndex] || this.world.roomCenters[0];
      let ideal;
      if (obj.approach && obj.homePos && obj.currentPos.every((v, i) => v === obj.homePos[i])) {
        ideal = { x: obj.approach[0], z: obj.approach[1] };
      } else {
        const dx = room.x - obj.currentPos[0];
        const dz = room.z - obj.currentPos[2];
        const len = Math.hypot(dx, dz) || 1;
        ideal = {
          x: obj.currentPos[0] + (dx / len) * 1.15,
          z: obj.currentPos[2] + (dz / len) * 1.15,
        };
      }
      return this.world.nav.nearestFreeWorld(ideal.x, ideal.z, 20);
    }

    async turnTo(x, z) {
      const robot = this.world.robot;
      const dx = x - robot.group.position.x;
      const dz = z - robot.group.position.z;
      const target = Math.atan2(dx, dz);
      const start = robot.group.rotation.y;
      await new Promise((resolve) => {
        this.tween.add({
          duration: 0.45,
          ease: RF.ease.inOutCubic,
          onUpdate: (e) => {
            robot.group.rotation.y = RF.angleLerp(start, target, e);
          },
          onComplete: resolve,
        });
      });
      robot.headYawTarget = 0;
    }

    /* ---------------- scanning ---------------- */
    async scanAll() {
      if (!this.started) this.ensureStarted();
      if (this.busy) return { ok: false, busy: true };
      return this.runExclusive(async () => {
        await this._scanAllInternal({ nested: false });
        this.focusInput();
        return { ok: true, objects: this.memory.all().length };
      });
    }

    async _scanAllInternal(opts) {
      opts = opts || {};
      const nested = !!opts.nested;
      this.setState("scanning");
      this.robotLookDown = false;
      this.activeRoom = -1;
      this.dom.scanToast.classList.remove("hidden");
      this.dom.scanBar.style.width = "0%";
      this.dom.scanPct.textContent = "0%";
      let scanStep = null;
      if (!nested) {
        this.resetActions();
        this.startTimeline();
        this.dom.reasoning.classList.add("hidden");
        this.say("开始全屋扫描。我会依次建立客厅、卧室、书房的高斯记忆。", 6000);
      } else {
        scanStep = this.addStep("触发全屋复扫", opts.staleRecovery ? "旧记忆位置未发现目标" : "记忆命中不足");
        this.say(opts.staleRecovery ? "旧位置没有找到，我重新扫描全屋来更新记忆。" : "我先扫描全屋，再按外观特征寻找。", 6000);
      }

      for (let i = 0; i < 3; i++) {
        const room = this.world.roomCenters[i];
        this.activeRoom = i;
        this.updateRoomLabels();
        const navStep = this.addStep("前往 " + room.name, "A* 避障路径规划 · 目标扫描位");
        await this.navigateTo({ x: room.scanX, z: room.scanZ }, { speed: 2.15, follow: true });
        this.completeStep(navStep, "已到达 · 扫描位");
        await this.scanRoom(i);
      }

      this.activeRoom = -1;
      this.robotScanning = false;
      this.world.robot.setState("idle");
      this.dom.scanToast.classList.add("hidden");
      this.scannedRooms = [true, true, true];
      this.memoryReady = true;
      this.completeStep(scanStep, "三区扫描完成");

      const meta = await this.savePack({ quiet: true });
      this.updateRoomLabels();
      this.updateAllUI();
      if (!nested) {
        this.setState("idle");
        this.rig.overview();
        if (meta && meta.persisted) {
          this.say("记忆已保存到机身 SD 卡。断网也能读取，现在可以问我东西在哪。", 6500);
          this.toast("全屋记忆已写入 SD 卡 · " + this.memory.all().length + " 件物品", "", 4200);
        } else {
          this.say("扫描完成，但 SD 卡写入失败。记忆仅在本次会话可用，仍可继续找物。", 6500);
          this.toast("扫描完成 · SD 卡未写入，仅本次会话可用", "warn", 5000);
        }
      } else {
        this.setState("searching");
      }
      return { ok: true };
    }

    async scanRoom(i) {
      const room = this.world.roomCenters[i];
      const objs = this.world.objectList.filter((o) => o.currentRoomIndex === i);
      this.robotScanning = true;
      this.world.robot.setState("scanning");
      this.activeRoom = i;
      this.updateRoomLabels();
      this.world.roomSplats.setProgress(i, 0);
      for (const o of objs) o.splats.setReveal(0);
      this.dom.scanTitle.textContent = "正在扫描 " + room.name;
      this.dom.scanSub.textContent = "沿扫描波前构建高斯点…";
      this.dom.scanToast.classList.remove("hidden");

      const step = this.addStep("扫描 " + room.name, "RGB-D / LiDAR · 3D Gaussian Splatting");
      await new Promise((resolve) => {
        this.tween.add({
          duration: 2.15,
          ease: RF.ease.inOutQuad,
          onUpdate: (e) => {
            this.roomProgress[i] = e;
            this.world.roomSplats.setProgress(i, e);
            for (const o of objs) o.splats.setReveal(e);
            const overall = (i + e) / 3;
            this.dom.scanBar.style.width = overall * 100 + "%";
            this.dom.scanPct.textContent = Math.round(overall * 100) + "%";
            const counts = this.world.roomSplatCounts || [0, 0, 0];
            let pts = counts[i] * e;
            for (let k = 0; k < i; k++) pts += counts[k];
            this.dom.scanSub.textContent = "已采集 " + RF.formatNumber(pts) + " 个高斯点 · 波前 " + Math.round(e * 100) + "%";
            this.updateStats();
          },
          onComplete: resolve,
        });
      });
      this.roomProgress[i] = 1;
      this.world.roomSplats.setProgress(i, 1);
      for (const o of objs) o.splats.setReveal(1);

      this.memory.ingest(room.name, i, objs, 0.8);
      this.scannedRooms[i] = true;
      this.renderMemoryList();
      this.dom.scanSub.textContent = "本区扫描完成 · 等待打包存储";
      this.world.robot.setState("scanning");
      await this.wait(0.22);
      this.robotScanning = false;
      this.world.robot.setState("walking");
      this.updateRoomLabels();
      this.addAction("scan", { room: room.name, roomIndex: i, objects: objs.map((o) => o.id) });
      this.completeStep(step, "发现 " + objs.length + " 件物品 · 置信度 0.80");
    }

    async savePack(opts) {
      opts = opts || {};
      const step = this.addStep("写入机身 SD 卡", "量化高斯点 · 加密 · 校验和");
      try {
        const payload = {
          version: 1,
          layoutId: "A",
          createdAt: new Date().toISOString(),
          memory: this.memory.snapshot(),
          scannedRooms: this.scannedRooms.slice(),
          objects: this.world.objectList.map((o) => ({
            id: o.id,
            pos: o.currentPos.slice(),
            room: o.currentRoom,
            roomIndex: o.currentRoomIndex,
          })),
          roomSplats: RF.quantizeSplatData(this.world.roomSplatData),
          objectSplats: this.world.objectList.map((o) => ({
            id: o.id,
            count: o.splats.data.count,
            data: RF.quantizeSplatData(o.splats.data),
          })),
        };
        const meta = await this.sd.save(payload);
        this.sdWriteFailed = !meta.persisted;
        this.updateSDUI();
        if (meta.persisted) {
          this.completeStep(step, "已写入 " + RF.formatNumber(meta.splats) + " 高斯点 · " + RF.formatBytes(meta.bytes));
          if (!opts.quiet) this.toast("记忆包已写入机身 SD 卡 · " + RF.formatBytes(meta.bytes), "", 3600);
        } else {
          this.failStep(step, "写入失败 · 仅保留本次会话的内存副本");
          this.toast("SD 卡写入失败 · 记忆仅在本次会话可用，仍可继续找物", "warn", 5000);
        }
        return meta;
      } catch (e) {
        console.error("SD save failed", e);
        this.sdWriteFailed = true;
        this.updateSDUI();
        this.failStep(step, "写入失败 · " + (e.message || e) + " · 最新记忆仅在内存");
        this.toast("SD 卡写入失败：" + (e.message || e) + " · 仍可继续找物", "error", 5000);
        return null;
      }
    }

    _applySplatPack(payload) {
      if (!payload || !payload.roomSplats) return;
      try {
        const roomData = RF.dequantizeSplatData(payload.roomSplats);
        const oldRoom = this.world.roomSplats;
        if (oldRoom) {
          this.world.splatGroup.remove(oldRoom.points);
          oldRoom.points.geometry.dispose();
          oldRoom.material.dispose();
        }
        const roomCloud = new RF.RoomSplatCloud(roomData);
        roomCloud.setAllProgress(1);
        this.world.splatGroup.add(roomCloud.points);
        this.world.roomSplats = roomCloud;
        this.world.roomSplatData = roomData;
        this.world.recomputeRoomSplatCounts();

        let total = roomData.count;
        for (const entry of payload.objectSplats || []) {
          if (!entry || !entry.data) continue;
          const obj = this.world.getObject(entry.id);
          if (!obj) continue;
          const old = obj.splats;
          if (old) {
            obj.group.remove(old.points);
            old.points.geometry.dispose();
            old.material.dispose();
          }
          const data = RF.dequantizeSplatData(entry.data);
          const cloud = new RF.ObjectSplatCloud(data);
          const center = this.world.roomCenters[obj.currentRoomIndex] || this.world.roomCenters[0];
          cloud.uniforms.uScanOrigin.value.set(center.scanX, 0, center.scanZ);
          cloud.setReveal(1);
          obj.group.add(cloud.points);
          obj.splats = cloud;
          obj.splatCount = data.count;
          total += data.count;
        }
        this.world.splatCount = total;
        this.world.resize();
        this.world.setViewMode(this.viewMode);
        this.updateStats();
      } catch (e) {
        console.warn("splat pack decode failed, using procedural cloud", e);
      }
    }

    async _loadPack() {
      this.setState("loading");
      const payload = await this.sd.load();
      if (!payload || !payload.memory) throw new Error("SD 卡中没有有效的记忆包");
      if (payload.roomSplats && payload.roomSplats.count !== this.world.roomSplatData.count) {
        console.warn("splat count differs", payload.roomSplats.count, this.world.roomSplatData.count);
      }
      this.memory.reset();
      const saved = payload.memory.objects || {};
      for (const [id, rec] of Object.entries(saved)) {
        const cat = this.world.getObject(id);
        if (!cat) continue;
        this.memory.records.set(id, {
          object_id: id,
          name: rec.name || cat.name,
          category: rec.category || cat.category,
          aliases: cat.aliases,
          colorName: rec.colorName || cat.colorName,
          color: cat.color,
          shape: rec.shape || cat.shape,
          size: rec.size || cat.size,
          room: rec.room || cat.room,
          roomIndex: rec.roomIndex === undefined ? cat.roomIndex : rec.roomIndex,
          pos: (rec.pos || cat.currentPos).slice(),
          confidence: rec.confidence === undefined ? 0.8 : rec.confidence,
          status: rec.status || "fresh",
          updated_at: rec.updated_at || new Date().toISOString(),
          furniture: rec.furniture || cat.furniture,
          splatCount: cat.splatCount,
        });
      }
      if (Array.isArray(payload.objects)) {
        for (const st of payload.objects) {
          const obj = this.world.getObject(st.id);
          if (!obj) continue;
          obj.group.position.set(st.pos[0], st.pos[1], st.pos[2]);
          obj.currentPos = st.pos.slice();
          obj.currentRoom = st.room;
          obj.currentRoomIndex = st.roomIndex;
          const savedRec = saved[st.id];
          obj.currentFurniture = (savedRec && savedRec.furniture) || (st.room === obj.homeRoom ? obj.furniture : obj.altFurniture);
        }
      }
      this._applySplatPack(payload);
      this.scannedRooms = Array.isArray(payload.scannedRooms) ? payload.scannedRooms.slice(0, 3) : [true, true, true];
      for (let i = 0; i < 3; i++) {
        if (this.scannedRooms[i]) {
          this.roomProgress[i] = 1;
          this.world.roomSplats.setProgress(i, 1);
        } else {
          this.roomProgress[i] = 0;
          this.world.roomSplats.setProgress(i, 0);
        }
      }
      for (const obj of this.world.objectList) {
        obj.splats.setReveal(this.scannedRooms[obj.currentRoomIndex] ? 1 : 0);
      }
      this.memoryReady = true;
      this.setState("idle");
      this.setViewMode("overlay");
      this.rig.overview();
      this.renderMemoryList();
      this.updateAllUI();
      this.toast("已从机身 SD 卡恢复 " + this.memory.all().length + " 件物品 · 0 次联网", "", 4600);
      this.say("已离线读取机身 SD 卡记忆，共 " + this.memory.all().length + " 件物品。问我就好。", 6500);
      return { ok: true };
    }

    /* ---------------- query ---------------- */
    runQuery(query) {
      if (!this.started) this.ensureStarted();
      const q = String(query || "").trim();
      if (!q) {
        this.toast("请输入要找的物品", "warn");
        return Promise.resolve({ ok: false, empty: true });
      }
      if (this.busy) {
        this.toast("单飞锁：请等待当前任务完成", "warn", 2600);
        return Promise.resolve({ ok: false, busy: true });
      }
      return this.runExclusive(() => this._runQuery(q));
    }

    async _runQuery(query) {
      this.setState("planning");
      this.clearFound();
      this.resetActions();
      this.startTimeline();
      this.dom.reasoning.classList.add("hidden");
      this.say("收到，正在端侧解析指令。", 3000);
      await this.wait(0.22);

      let plan = this.agent.plan(query, {
        records: this.memory.enabled ? this.memory.all() : [],
        memoryEnabled: this.memory.enabled,
      });
      this.showReasoning(plan.profile, plan.candidates, plan.targetId);
      if (!plan.ok) {
        const step = this.addStep("解析指令", "未找到可执行目标");
        this.failStep(step, plan.say);
        this.say(plan.say, 6000);
        this.toast("没有找到匹配物品 · 试试「红色杯子」", "warn", 4200);
        this.setState("idle");
        return { ok: false, reason: "no_match", profile: plan.profile };
      }

      const parseStep = this.addStep("解析指令", plan.attrText || "属性检索");
      this.completeStep(parseStep);
      let targetId = plan.targetId || (plan.target && (plan.target.object_id || plan.target.id));
      let target = this.world.getObject(targetId);
      let scanHappened = false;

      if (!this.memoryReady) {
        const s = this.addStep("检查本地记忆", "机身 SD 卡暂无可用记忆包");
        this.completeStep(s);
        await this._scanAllInternal({ nested: true });
        scanHappened = true;
        const re = this.agent.plan(query, {
          records: this.memory.all(),
          memoryEnabled: this.memory.enabled,
        });
        if (re.ok) plan = re;
        targetId = plan.targetId || (plan.target && (plan.target.object_id || plan.target.id)) || targetId;
        target = this.world.getObject(targetId);
      }

      if (!plan.useMemory) {
        if (!scanHappened) {
          const scanStep = this.addStep("全屋扫描", this.memory.enabled ? "记忆命中不足，重新观察" : "记忆增强关闭");
          await this._scanAllInternal({ nested: true });
          this.completeStep(scanStep, "三区扫描完成");
          scanHappened = true;
        }
        const re = this.agent.plan(query, {
          records: this.memory.all(),
          memoryEnabled: this.memory.enabled,
        });
        if (re.ok) plan = re;
        targetId = plan.targetId || (plan.target && (plan.target.object_id || plan.target.id)) || targetId;
        target = this.world.getObject(targetId);
      } else {
        const memStep = this.addStep(
          "本地记忆检索",
          "命中 " + plan.target.name + " · " + plan.target.room + " · 置信度 " + Math.round((plan.target.confidence || 0.8) * 100) + "%"
        );
        this.completeStep(memStep, "本地记忆命中 · " + (plan.target.furniture || "房间"));
      }

      if (!target) throw new Error("目标物体不在当前场景中");
      this.lastTargetId = target.id;
      let destination = this.navigationTarget(target, this.memory.get(target.id));
      this.say(plan.say, 6200);
      await this.wait(0.35);

      this.setState("navigating");
      const navStep = this.addStep(
        "导航至 " + destination.currentRoom,
        "目标 " + destination.name + " · " + (destination.currentFurniture || "房间")
      );
      await this.navigateToApproach(destination);
      this.completeStep(navStep, "已到达 · 目标观察位");
      await this.turnTo(destination.currentPos[0], destination.currentPos[2]);
      this.robotLookDown = true;

      let verifyStep = this.addStep("视觉复核", "比对位置快照与当前观测");
      let verify = await this.verifyTarget(target, destination);
      if (!verify.ok) {
        const rec = this.memory.get(target.id);
        this.failStep(verifyStep, "记忆过期 · 置信度降至 " + Math.round((rec ? rec.confidence : 0) * 100) + "%");
        this.toast("记忆位置未发现目标 · 触发全屋复扫", "warn", 4200);
        this.say("咦，记忆位置没有找到。物品可能被移动了，我重新扫描全屋。", 6200);
        this.rig.overview();
        await this.wait(0.35);
        await this._scanAllInternal({ nested: true, staleRecovery: true });
        const re = this.agent.plan(query, {
          records: this.memory.all(),
          memoryEnabled: this.memory.enabled,
        });
        if (!re.ok) throw new Error("复扫后未找到匹配目标");
        plan = re;
        targetId = plan.targetId || (plan.target && (plan.target.object_id || plan.target.id));
        target = this.world.getObject(targetId);
        if (!target) throw new Error("复扫后的目标物体不在当前场景中");
        this.lastTargetId = target.id;
        destination = this.navigationTarget(target, this.memory.get(target.id));
        const nav2 = this.addStep("重新导航", destination.currentRoom + " · " + (destination.currentFurniture || "房间"));
        await this.navigateToApproach(destination, { follow: true });
        this.completeStep(nav2, "已到达新位置观察位");
        await this.turnTo(destination.currentPos[0], destination.currentPos[2]);
        this.robotLookDown = true;
        verifyStep = this.addStep("视觉复核（复扫后）", "比对新位置快照与当前观测");
        verify = await this.verifyTarget(target, destination);
        if (!verify.ok) {
          this.failStep(verifyStep, "仍未确认目标 · 请重新扫描或纠正位置");
          throw new Error("复扫后仍未确认目标，不能报告找到");
        }
      }
      this.completeStep(verifyStep, "确认目标 · 坐标误差 " + verify.distance.toFixed(2) + " m");

      this.foundId = target.id;
      this.showFoundFx(target, plan);
      this.addAction("found", { target: target.id, room: target.currentRoom, pos: target.currentPos.slice() });
      this.say(
        "找到了！" + target.name + "在" + target.currentRoom + "的" + (target.currentFurniture || target.furniture || "角落") + "。",
        7200
      );
      this.toast(
        "已找到 " + target.name + " · " + target.currentRoom + " · " + (plan.useMemory ? "本地记忆命中" : "扫描匹配"),
        "",
        4800
      );
      const done = this.addStep("完成", "任务日志已记录 · 数据未离开机身");
      this.completeStep(done);
      this.setState("completed");
      this.robotLookDown = false;
      await this.savePack({ quiet: true });
      return {
        ok: true,
        target: target.id,
        room: target.currentRoom,
        stepCount: this.stepCount,
        usedMemory: plan.useMemory,
      };
    }

    async verifyTarget(target, destination) {
      this.setState("searching");
      this.robotScanning = true;
      this.world.robot.setState("scanning");
      this.say("到了，让我确认一下。", 2800);
      await this.wait(0.95);
      this.robotScanning = false;
      this.world.robot.setState("idle");
      const result = this.memory.verify(target.id, target.currentPos, target.currentRoom);
      const distance = Math.hypot(
        target.currentPos[0] - destination.currentPos[0],
        target.currentPos[2] - destination.currentPos[2]
      );
      const verify = {
        ok: result.ok && distance <= 1.15 && target.currentRoom === destination.currentRoom,
        distance,
      };
      this.renderMemoryList();
      this.addAction("verify", { target: target.id, room: destination.currentRoom, ok: verify.ok, distance });
      return verify;
    }

    async navigateToApproach(obj, opts) {
      const appr = this.findApproach(obj);
      await this.navigateTo(appr, Object.assign({ speed: 2.05, follow: true }, opts || {}));
    }

    /* ---------------- found FX ---------------- */
    showFoundFx(obj, plan) {
      this.clearFoundFx();
      const pos = obj.group.position;
      const ring = new T.Mesh(
        new T.RingGeometry(0.2, 0.245, 48),
        new T.MeshBasicMaterial({
          color: 0x5fe3cf,
          transparent: true,
          opacity: 0.85,
          blending: T.AdditiveBlending,
          side: T.DoubleSide,
          depthWrite: false,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(pos.x, 0.035, pos.z);
      const halo = new T.Mesh(
        new T.TorusGeometry(0.26, 0.008, 8, 40),
        new T.MeshBasicMaterial({
          color: 0x9ffbef,
          transparent: true,
          opacity: 0.8,
          blending: T.AdditiveBlending,
          depthWrite: false,
        })
      );
      halo.rotation.x = Math.PI / 2;
      halo.position.set(pos.x, pos.y + 0.05, pos.z);
      const beam = new T.Mesh(
        new T.CylinderGeometry(0.035, 0.09, 2.3, 18, 1, true),
        new T.MeshBasicMaterial({
          color: 0x5fe3cf,
          transparent: true,
          opacity: 0.16,
          blending: T.AdditiveBlending,
          side: T.DoubleSide,
          depthWrite: false,
        })
      );
      beam.position.set(pos.x, 1.15, pos.z);
      this.world.fxGroup.add(ring, halo, beam);
      this.foundFx = { ring, halo, beam, obj, baseY: pos.y };
      obj.splats.setHighlight(1);
      this.dom.objLabelName.textContent = obj.name;
      const rec = this.memory.get(obj.id);
      this.dom.objLabelSub.textContent =
        (plan && plan.useMemory ? "本地记忆命中" : "扫描匹配") +
        " · " +
        Math.round((rec ? rec.confidence : 0.8) * 100) +
        "%";
      this.dom.objectLabel.classList.remove("hidden");
      this.rig.focusOn(new T.Vector3(pos.x, pos.y + 0.55, pos.z), { radius: 4.7, phi: 1.03, theta: 0.16 });
      this.renderMemoryList();
      this.updateRoomLabels();
    }

    clearFoundFx() {
      if (!this.foundFx) return;
      this.world.fxGroup.remove(this.foundFx.ring, this.foundFx.halo, this.foundFx.beam);
      this.foundFx.ring.geometry.dispose();
      this.foundFx.ring.material.dispose();
      this.foundFx.halo.geometry.dispose();
      this.foundFx.halo.material.dispose();
      this.foundFx.beam.geometry.dispose();
      this.foundFx.beam.material.dispose();
      this.foundFx = null;
    }

    clearFound() {
      if (this.foundId) {
        const obj = this.world.getObject(this.foundId);
        if (obj) obj.splats.setHighlight(0);
      }
      this.foundId = null;
      this.clearFoundFx();
      this.dom.objectLabel.classList.add("hidden");
      this.renderMemoryList();
    }

    updateFoundFx(dt) {
      if (!this.foundFx) return;
      const t = this.simTime;
      const pulse = 1 + 0.14 * Math.sin(t * 4.2);
      this.foundFx.ring.scale.setScalar(pulse);
      this.foundFx.ring.material.opacity = 0.55 + 0.3 * (0.5 + 0.5 * Math.sin(t * 4.2));
      this.foundFx.halo.rotation.z += dt * 1.4;
      this.foundFx.halo.scale.setScalar(1 + 0.08 * Math.sin(t * 3.1 + 1));
      this.foundFx.halo.material.opacity = 0.5 + 0.35 * (0.5 + 0.5 * Math.sin(t * 4.2 + 0.8));
      this.foundFx.beam.material.opacity = 0.12 + 0.07 * (0.5 + 0.5 * Math.sin(t * 1.8));
    }

    /* ---------------- intents ---------------- */
    ensureStarted() {
      if (this.started) return;
      this.started = true;
      this.introOrbit = false;
      this.dom.intro.classList.add("leaving");
      this.setState("idle");
      this.updateInputState();
    }

    async startDemo() {
      if (this.started) return;
      this.started = true;
      this.introOrbit = false;
      this.dom.intro.classList.add("leaving");
      this.rig.overview();
      this.setState("loading");
      this.say("机身存储卡自检完成。开始全屋扫描。", 4200);
      await this.wait(0.55);
      this.updateInputState();
      const res = await this.scanAll();
      if (res && res.ok) {
        this.focusInput();
      }
    }

    async loadFromSD() {
      if (!this.sd.hasStoredPack()) {
        this.toast("机身 SD 卡中没有记忆包", "warn");
        return;
      }
      if (this.busy) return;
      const res = await this.runExclusive(async () => {
        await this._loadPack();
        return { ok: true };
      });
      if (res && res.ok) {
        this.started = true;
        this.introOrbit = false;
        this.dom.intro.classList.add("leaving");
        this.updateInputState();
        this.focusInput();
      }
      return res;
    }

    async clearMemory() {
      if (this.busy) {
        this.toast("请等待当前任务完成", "warn");
        return;
      }
      const yes = window.confirm("清除机身 SD 卡中的空间记忆？机器人将回到未扫描状态。");
      if (!yes) return;
      return this.runExclusive(async () => {
        const step = this.addStep("清除机身 SD 卡", "等待存储擦除完成");
        await this.sd.erase();
        this.sdWriteFailed = false;
        this.memory.reset();
        this.memoryReady = false;
        this.scannedRooms = [false, false, false];
        this.roomProgress = [0, 0, 0];
        this.world.roomSplats.setAllProgress(0);
        for (const obj of this.world.objectList) {
          obj.splats.setReveal(0);
          obj.splats.setHighlight(0);
          this.world.resetObject(obj.id);
        }
        this.clearFound();
        this.resetActions();
        this.renderMemoryList();
        this.updateAllUI();
        this.updateRoomLabels();
        this.setViewMode("overlay");
        this.completeStep(step, "空间记忆已清除 · SD 卡已释放");
        this.setState("idle");
        this.toast("空间记忆已清除 · SD 卡已释放", "", 3600);
        this.say("记忆已清除。再次扫描即可重新建立。", 4200);
        return { ok: true };
      });
    }

    demoMoveObject(id) {
      if (this.busy) {
        this.toast("请等待当前任务完成", "warn");
        return null;
      }
      if (!this.memory.all().length) {
        this.toast("先完成一次全屋扫描，再演示记忆过期", "warn", 3600);
        return null;
      }
      id = id || this.foundId || this.lastTargetId || "cup_red";
      const obj = this.world.getObject(id);
      if (!obj) return null;
      const rec = this.memory.get(id);
      const useAlt = obj.currentRoomIndex === obj.homeRoomIndex;
      let pos;
      let roomIndex;
      let roomName;
      let furniture;
      if (useAlt) {
        pos = obj.alt;
        roomIndex = this.roomIndexFromX(pos[0]);
        roomName = this.roomNameFromIndex(roomIndex);
        furniture = obj.altFurniture;
      } else {
        pos = obj.homePos;
        roomIndex = obj.homeRoomIndex;
        roomName = obj.homeRoom;
        furniture = obj.furniture;
      }
      this.world.moveObjectTo(id, pos, roomName, roomIndex, furniture);
      this.clearFound();
      this.lastTargetId = id;
      this.dom.input.value = "帮我找" + obj.name;
      this.toast(
        "已把「" + obj.name + "」移到" + roomName + " · 记忆仍停留在" + (rec ? rec.room : "原位置"),
        "warn",
        5200
      );
      this.say("演示：物品被移动了，但我的记忆还没更新。再找一次试试。", 5600);
      if (this.started) this.dom.input.focus();
      return { id, room: roomName, pos };
    }

    async demoCorrect() {
      if (this.busy) {
        this.toast("请等待当前任务完成", "warn");
        return null;
      }
      const id = this.foundId || this.lastTargetId || "cup_red";
      const rec = this.memory.get(id);
      const obj = this.world.getObject(id);
      if (!rec || !obj) {
        this.toast("先扫描建立记忆，才能演示用户纠正", "warn", 3600);
        return null;
      }
      return this.runExclusive(async () => {
        const useAlt = obj.currentRoomIndex === obj.homeRoomIndex;
        let pos;
        let roomIndex;
        let roomName;
        let furniture;
        if (useAlt) {
          pos = obj.alt;
          roomIndex = this.roomIndexFromX(pos[0]);
          roomName = this.roomNameFromIndex(roomIndex);
          furniture = obj.altFurniture;
        } else {
          pos = obj.homePos;
          roomIndex = obj.homeRoomIndex;
          roomName = obj.homeRoom;
          furniture = obj.furniture;
        }
        this.world.moveObjectTo(id, pos, roomName, roomIndex, furniture);
        this.memory.correct(id, pos, roomName, roomIndex, furniture);
        this.clearFound();
        this.renderMemoryList();
        this.lastTargetId = id;
        this.dom.input.value = "帮我找" + obj.name;
        const meta = await this.savePack({ quiet: true });
        const persisted = !!(meta && meta.persisted);
        this.toast(
          "用户纠正已记录" + (persisted ? "并写入 SD 卡：" : "（仅本次会话，SD 卡未写入）：") + obj.name + " → " + roomName + " · 置信度 0.90",
          persisted ? "" : "warn",
          4800
        );
        this.say("好的，" + (persisted ? "我记住了。" : "已更新本次会话记忆，但 SD 卡写入失败。") + obj.name + "现在在" + roomName + "。", 5200);
        return { id, room: roomName, pos: pos.slice(), persisted };
      });
    }

    roomIndexFromX(x) {
      if (x < -2.5) return 0;
      if (x < 4) return 1;
      return 2;
    }
    roomNameFromIndex(i) {
      return ["客厅", "卧室", "书房"][i] || "客厅";
    }

    /* ---------------- loop ---------------- */
    runExclusive(fn) {
      if (this.busy) return Promise.resolve({ ok: false, busy: true });
      this.setUIBusy(true);
      return Promise.resolve()
        .then(fn)
        .catch((e) => {
          console.error(e);
          const message = String(e.message || e);
          const active = (this._timelineSteps || []).filter((step) => step.classList.contains("active"));
          if (!active.length) active.push(this.addStep("任务失败", message));
          for (const step of active) this.failStep(step, message);
          this.setState("error");
          this.toast("任务失败：" + message, "error", 6000);
          this.say("出了点问题，请再试一次。", 4200);
          return { ok: false, error: message };
        })
        .finally(() => {
          this.robotSpeed = 0;
          this.robotScanning = false;
          this.robotLookDown = false;
          this.activeRoom = -1;
          try {
            this.dom.scanToast.classList.add("hidden");
            this.clearPathLine();
            this.world.robot.setState("idle");
            this.updateRoomLabels();
          } finally {
            this.setUIBusy(false);
            this.updateInputState();
          }
        });
    }

    loop(now) {
      requestAnimationFrame((t) => this.loop(t));
      if (this.realtwinActive) {
        this.last = now;
        return;
      }
      const raw = (now - this.last) / 1000;
      this.last = now;
      const dt = Math.min(raw, 0.05);
      this.tween.update(dt);
      const sdt = dt * this.timeScale;
      this.simTime += sdt;
      if (this.introOrbit && !this.started) {
        this.rig.desiredTheta = Math.sin(this.simTime * 0.07) * 0.2;
      }
      this.rig.update(sdt);
      this.world.update(sdt, this.simTime, {
        movingSpeed: this.robotSpeed,
        scanning: this.robotScanning,
        lookDown: this.robotLookDown,
      });
      this.updateFoundFx(sdt);
      this.updateOverlays();
      this.world.render();
    }

    /* ---------------- debug API ---------------- */
    initDebugAPI() {
      const self = this;
      window.__demo = {
        version: "1.0.0",
        start: () => self.startDemo(),
        run: (q) => self.runQuery(q),
        scanAll: (opts) => self.scanAll(opts),
        getState: () => self.state,
        getStepCount: () => self.lastStepCount,
        getActions: () => JSON.parse(JSON.stringify(self.actions)),
        getMemory: () => self.memory.snapshot(),
        getSDCard: () => self.sd.status(),
        getSplats: () => self.world.splatCount,
        getPlan: (q) =>
          self.agent.plan(q, {
            records: self.memory.enabled ? self.memory.all() : [],
            memoryEnabled: self.memory.enabled,
          }),
        setMemoryEnabled: (v) => self.setMemoryEnabled(!!v),
        setSpeed: (v) => {
          self.timeScale = RF.clamp(Number(v) || 1, 0.25, 12);
          self.tween.setTimeScale(self.timeScale);
          return self.timeScale;
        },
        moveObject: (id, room) => {
          if (self.busy) return { ok: false, busy: true };
          const idx = room === "客厅" ? 0 : room === "卧室" ? 1 : room === "书房" ? 2 : -1;
          if (idx < 0) return { ok: false, error: "unknown room" };
          const obj = self.world.getObject(id);
          if (!obj) return { ok: false, error: "unknown object" };
          const pos = obj.alt && self.roomIndexFromX(obj.alt[0]) === idx
            ? obj.alt
            : (() => {
                const c = self.world.roomCenters[idx];
                return [c.x + 0.5, 0.14, c.z + 0.6];
              })();
          const furn = pos === obj.alt ? obj.altFurniture : "房间地面";
          self.world.moveObjectTo(id, pos, room, idx, furn);
          self.clearFound();
          return { ok: true, id, room, pos };
        },
        setView: (m) => self.setViewMode(m),
        loadSD: () => self.loadFromSD(),
        clearSD: () => self.clearMemory(),
        getSDCardBytes: () => self.sd.info.bytes || 0,
      };
    }
  }

  RF.App = App;
  if (RF.config && RF.config.autoStart === false) return;

  let app;
  window.addEventListener("error", (e) => {
    if (!window.__appReady) showFatal((e.error && e.error.stack) || e.message || "脚本错误");
  });
  try {
    app = new App();
    window.__app = app;
  } catch (e) {
    showFatal((e && e.stack) || e);
  }
})();

