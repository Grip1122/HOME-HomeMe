/* global THREE */
(function () {
  const RF = (window.RF = window.RF || {});

  RF.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  RF.lerp = (a, b, t) => a + (b - a) * t;
  RF.invLerp = (a, b, v) => (b - a === 0 ? 0 : (v - a) / (b - a));
  RF.smoothstep = (a, b, x) => {
    const t = RF.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  RF.damp = (current, target, lambda, dt) => RF.lerp(current, target, 1 - Math.exp(-lambda * dt));
  RF.angleLerp = (a, b, t) => {
    let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  };
  RF.rand = (a, b) => a + Math.random() * (b - a);

  RF.ease = {
    linear: (t) => t,
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    outBack: (t) => {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
  };

  RF.mulberry32 = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  RF.randRange = (rng, a, b) => a + rng() * (b - a);
  RF.pick = (rng, arr) => arr[Math.floor(rng() * arr.length) % arr.length];

  RF.formatNumber = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  RF.formatBytes = (bytes) => {
    if (!bytes || bytes < 0) return "0 KB";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  };
  RF.formatTime = (d = new Date()) =>
    d.toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });

  RF.escapeHTML = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  RF.hexToRgb01 = (hex) => {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
    ];
  };

  RF.bytesToBase64 = (bytes) => {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return btoa(binary);
  };
  RF.base64ToBytes = (b64) => {
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  };

  RF.sha256Hex = async (bytes) => {
    if (window.crypto && crypto.subtle && crypto.subtle.digest) {
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    // FNV-1a fallback (demo only)
    let h = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) {
      h ^= bytes[i];
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  };

  RF.textToBytes = (text) => new TextEncoder().encode(text);
  RF.bytesToText = (bytes) => new TextDecoder().decode(bytes);

  RF.wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  class Tween {
    constructor(opts) {
      this.duration = Math.max(0.0001, opts.duration || 0);
      this.delay = opts.delay || 0;
      this.easing = opts.ease || RF.ease.inOutCubic;
      this.onUpdate = opts.onUpdate || null;
      this.onComplete = opts.onComplete || null;
      this.elapsed = 0;
      this.done = false;
      this.started = false;
    }
    update(dt) {
      if (this.done) return;
      this.elapsed += dt;
      if (this.elapsed < this.delay) return;
      const t = RF.clamp((this.elapsed - this.delay) / this.duration, 0, 1);
      if (!this.started) {
        this.started = true;
        if (this.onUpdate) this.onUpdate(0);
      }
      const e = this.easing(t);
      if (this.onUpdate) this.onUpdate(e, t);
      if (t >= 1) {
        this.done = true;
        if (this.onComplete) this.onComplete();
      }
    }
  }

  class TweenManager {
    constructor() {
      this.tweens = [];
      this.timeScale = 1;
    }
    setTimeScale(v) {
      this.timeScale = RF.clamp(v, 0.25, 12);
    }
    add(opts) {
      const t = new Tween(opts);
      this.tweens.push(t);
      return t;
    }
    delay(seconds) {
      return new Promise((resolve) => {
        this.add({ duration: seconds, onComplete: resolve });
      });
    }
    update(dt) {
      const scaled = Math.min(dt, 0.1) * this.timeScale;
      if (scaled <= 0) return;
      for (let i = 0; i < this.tweens.length; i++) this.tweens[i].update(scaled);
      if (this.tweens.some((t) => t.done)) this.tweens = this.tweens.filter((t) => !t.done);
    }
  }

  RF.Tween = Tween;
  RF.TweenManager = TweenManager;

  RF.toast = (el, text, type, duration) => {
    if (!el) return;
    el.textContent = text;
    el.className = "toast " + (type || "");
    el.classList.remove("hidden", "fade");
    clearTimeout(el._toastTimer);
    clearTimeout(el._toastFade);
    el._toastTimer = setTimeout(() => {
      el.classList.add("fade");
      el._toastFade = setTimeout(() => el.classList.add("hidden"), 320);
    }, duration || 3200);
  };
})();
