/* global window, document, location, performance */
(function () {
  "use strict";
  const RF = (window.RF = window.RF || {});
  const LIB_NAME = "Gaussian Splats 3D";

  // 实景查看器的资源与变换集中配置，不改变示范公寓的语义坐标。
  const CONFIG = RF.config.realtwin;

  class RealtwinViewer {
    constructor(app) {
      this.app = app;
      this.root = document.getElementById("realtwin");
      this.viewerEl = document.getElementById("rt-viewer");
      this.loadingEl = document.getElementById("rt-loading");
      this.errorEl = document.getElementById("rt-error");
      this.errorMsgEl = document.getElementById("rt-error-msg");
      this.statusEl = document.getElementById("rt-status");
      this.countEl = document.getElementById("rt-count");
      this.infoCountEl = document.getElementById("rt-info-count");
      this.percentEl = document.getElementById("rt-percent");
      this.progressEl = document.getElementById("rt-progress");
      this.loadingSubEl = document.getElementById("rt-loading-sub");
      this.viewer = null;
      this.loaded = false;
      this.loadingPromise = null;
      this.isOpen = false;
      this.loadStartedAt = 0;
      this._bind();
      window.addEventListener("resize", () => this.resize());
    }

    _bind() {
      const openBtn = document.getElementById("btn-realtwin");
      const introBtn = document.getElementById("btn-realtwin-intro");
      if (openBtn) openBtn.addEventListener("click", () => this.open());
      if (introBtn) introBtn.addEventListener("click", () => this.open());
      const close = document.getElementById("rt-close");
      if (close) close.addEventListener("click", () => this.close());
      const closeError = document.getElementById("rt-close-error");
      if (closeError) closeError.addEventListener("click", () => this.close());
      const reset = document.getElementById("rt-reset");
      if (reset) reset.addEventListener("click", () => this.resetView());
      const retry = document.getElementById("rt-retry");
      if (retry) retry.addEventListener("click", () => this.retry());
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.isOpen) this.close();
      });
    }

    open() {
      if (!this.root) return;
      this.isOpen = true;
      if (this.app) this.app.realtwinActive = true;
      document.body.classList.add("rt-active");
      this.root.classList.remove("hidden");
      this.resize();
      if (this.loaded) {
        this.startViewer();
        this.kickFrames();
        this.setStatus("已就绪", "ready");
        return;
      }
      if (!this.loadingPromise) this.load();
    }

    close() {
      this.isOpen = false;
      if (this.app) this.app.realtwinActive = false;
      document.body.classList.remove("rt-active");
      if (this.root) this.root.classList.add("hidden");
      this.stopViewer();
    }

    startViewer() {
      if (!this.viewer) return;
      try {
        if (!this.viewer.selfDrivenModeRunning) this.viewer.start();
      } catch (e) {
        // start() can throw only if self-driven mode is disabled; we always enable it.
      }
    }

    stopViewer() {
      if (!this.viewer) return;
      try {
        if (this.viewer.selfDrivenModeRunning) this.viewer.stop();
      } catch (e) {
        // ignore
      }
    }

    resize() {
      if (!this.viewer || !this.viewer.renderer || !this.viewer.camera) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      try {
        this.viewer.renderer.setSize(w, h);
        this.viewer.camera.aspect = w / h;
        this.viewer.camera.updateProjectionMatrix();
      } catch (e) {
        // ignore
      }
    }

    setProgress(pct, label) {
      const p = Math.max(0, Math.min(100, Number(pct) || 0));
      if (this.percentEl) this.percentEl.textContent = Math.round(p) + "%";
      if (this.progressEl) this.progressEl.style.width = p + "%";
      if (label && this.loadingSubEl) this.loadingSubEl.textContent = label;
    }

    setStatus(text, cls) {
      if (!this.statusEl) return;
      this.statusEl.textContent = text;
      this.statusEl.className = "rt-pill" + (cls ? " is-" + cls : "");
    }

    setLoading(show) {
      if (this.loadingEl) this.loadingEl.classList.toggle("hidden", !show);
    }

    setError(show, message) {
      if (!this.errorEl) return;
      this.errorEl.classList.toggle("hidden", !show);
      if (show && this.errorMsgEl) this.errorMsgEl.textContent = message || "未知错误";
    }

    async load() {
      if (this.loadingPromise) return this.loadingPromise;
      this.setError(false);
      this.setLoading(true);
      this.setStatus("加载中", "");
      this.setProgress(0, "读取 31.4 MB 压缩高斯点…");
      if (this.countEl) this.countEl.textContent = "976,476 splats";

      const Lib = window[LIB_NAME];
      if (!Lib) {
        this.fail("找不到 3DGS 渲染库：assets/gaussian-splats-3d.umd.js。");
        return;
      }
      if (location.protocol === "file:") {
        this.fail(
          "浏览器安全策略禁止 file:// 读取 31 MB 空间模型。\n\n" +
          "请使用 HOME 项目的本地预览服务，不要直接打开磁盘文件。"
        );
        return;
      }

      this.loadStartedAt = performance.now();
      this.loadingPromise = (async () => {
        try {
          if (this.viewer) {
            try { this.viewer.stop(); } catch (e) {}
            try { await this.viewer.dispose(); } catch (e) {}
            this.viewer = null;
          }
          if (this.viewerEl) this.viewerEl.innerHTML = "";

          const viewer = new Lib.Viewer({
            rootElement: this.viewerEl,
            selfDrivenMode: true,
            useBuiltInControls: true,
            sharedMemoryForWorkers: false,
            gpuAcceleratedSort: false,
            cameraUp: [0, 1, 0],
            initialCameraPosition: CONFIG.camera.position,
            initialCameraLookAt: CONFIG.camera.lookAt,
            showLoadingUI: false,
            ignoreDevicePixelRatio: true,
          });
          this.viewer = viewer;

          await viewer.addSplatScene(CONFIG.model, {
            rotation: CONFIG.rotation,
            position: CONFIG.position,
            splatAlphaRemovalThreshold: CONFIG.alphaThreshold,
            showLoadingUI: false,
            onProgress: (pct, label) => {
              const p = Number(pct) || 0;
              const text = label ? "解码中 · " + label : "解码高斯点…";
              this.setProgress(p, text);
            },
          });

          const count = viewer.splatMesh && viewer.splatMesh.getSplatCount
            ? viewer.splatMesh.getSplatCount()
            : CONFIG.splatCountFallback;
          this.loaded = true;
          this.setProgress(100, "空间模型已就绪");
          if (this.countEl) this.countEl.textContent = count.toLocaleString("en-US") + " splats";
          if (this.infoCountEl) this.infoCountEl.textContent = count.toLocaleString("en-US");
          const sec = ((performance.now() - this.loadStartedAt) / 1000).toFixed(1);
          this.setStatus("已就绪 · " + sec + "s", "ready");
          this.setLoading(false);
          this.setError(false);
          this.resize();
          this.resetView();
          if (this.isOpen) this.startViewer();
          this.kickFrames();
        } catch (e) {
          this.fail(
            (e && (e.stack || e.message || String(e))) +
            "\n\n请确认本地示范模型存在：" + CONFIG.model + "。可返回示范公寓继续找物。"
          );
        } finally {
          this.loadingPromise = null;
        }
      })();
      return this.loadingPromise;
    }

    fail(message) {
      this.loaded = false;
      this.setLoading(false);
      this.setError(true, message);
      this.setStatus("加载失败", "error");
    }

    async retry() {
      if (this.loadingPromise) return;
      this.setError(false);
      this.loaded = false;
      this.loadingPromise = null;
      await this.load();
    }

    kickFrames() {
      [80, 320, 900, 1800].forEach((ms) => {
        setTimeout(() => {
          if (!this.viewer || !this.isOpen) return;
          try { this.viewer.update(); } catch (e) { /* ignore */ }
        }, ms);
      });
    }

    resetView() {
      if (!this.viewer || !this.viewer.camera) return;
      const pos = CONFIG.camera.position;
      const look = CONFIG.camera.lookAt;
      try {
        this.viewer.camera.position.set(pos[0], pos[1], pos[2]);
        if (this.viewer.controls && this.viewer.controls.target) {
          this.viewer.controls.target.set(look[0], look[1], look[2]);
          this.viewer.controls.update();
        } else {
          this.viewer.camera.lookAt(look[0], look[1], look[2]);
        }
        this.viewer.camera.updateMatrixWorld(true);
        if (typeof this.viewer.update === "function") this.viewer.update();
        this.kickFrames();
      } catch (e) {
        // ignore
      }
    }
  }

  RF.RealtwinViewer = RealtwinViewer;
})();
