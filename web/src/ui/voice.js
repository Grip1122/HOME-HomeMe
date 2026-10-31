/* global window */
(function (global) {
  "use strict";
  const UI = (global.HomeTwinUI = global.HomeTwinUI || {});

  class Voice {
    constructor(bus, root, options) {
      this.bus = bus;
      this.root = root;
      this.options = options || {};
      this.micEl = root.querySelector(".ht-mic");
      this.speakEl = root.querySelector(".ht-speak");
      this.enabled = false;
      this.listening = false;
      this.recognition = null;
      this.synth = global.speechSynthesis || null;
      this.voice = null;
      this._loadPref();
      this._bind();
      this._subscribe();
      this._refresh();
      if (this.synth) {
        this._pickVoice();
        this.synth.onvoiceschanged = () => this._pickVoice();
      }
    }

    _loadPref() {
      try {
        this.enabled = localStorage.getItem("hometwin.voice") === "on";
      } catch (e) {
        this.enabled = false;
      }
    }

    _pickVoice() {
      if (!this.synth) return;
      const voices = this.synth.getVoices() || [];
      this.voice = voices.find((v) => /zh[-_]CN|Chinese|中文/i.test(v.lang + " " + v.name)) || voices[0] || null;
    }

    _subscribe() {
      this._onChat = (p) => {
        if (!p || p.role === "user") return;
        if (this.enabled) this.speak(p.text);
      };
      this._onSpeak = (p) => {
        if (p && p.text && this.enabled) this.speak(p.text);
      };
      this.bus.on("chat:message", this._onChat);
      this.bus.on("voice:speak", this._onSpeak);
    }

    _bind() {
      if (this.micEl) this.micEl.addEventListener("click", () => this.listen());
      if (this.speakEl) this.speakEl.addEventListener("click", () => this.toggle());
    }

    toggle() {
      this.setEnabled(!this.enabled);
      if (this.enabled) {
        this.bus.emit("toast", { text: "语音播报已开启", type: "" });
        this.speak("语音已开启，我在呢。");
      } else {
        this.bus.emit("toast", { text: "语音播报已关闭", type: "" });
        if (this.synth) this.synth.cancel();
      }
    }

    setEnabled(v) {
      this.enabled = !!v;
      try {
        localStorage.setItem("hometwin.voice", this.enabled ? "on" : "off");
      } catch (e) {
        // ignore
      }
      this._refresh();
    }

    _refresh() {
      if (this.speakEl) {
        this.speakEl.classList.toggle("is-on", this.enabled);
        this.speakEl.title = this.enabled ? "关闭语音播报" : "开启语音播报";
        this.speakEl.setAttribute("aria-label", this.speakEl.title);
      }
      if (this.micEl) {
        const SR = global.SpeechRecognition || global.webkitSpeechRecognition;
        this.micEl.disabled = !SR;
        this.micEl.title = SR ? "说话（语音识别）" : "当前浏览器不支持语音识别";
        this.micEl.setAttribute("aria-label", this.micEl.title);
      }
    }

    speak(text) {
      if (!this.synth || !text) return;
      try {
        this.synth.cancel();
        const utter = new SpeechSynthesisUtterance(String(text).replace(/https?:\/\/\S+/g, ""));
        utter.lang = "zh-CN";
        utter.rate = 1.05;
        utter.pitch = 1.02;
        if (this.voice) utter.voice = this.voice;
        this.synth.speak(utter);
      } catch (e) {
        // ignore
      }
    }

    listen() {
      const SR = global.SpeechRecognition || global.webkitSpeechRecognition;
      if (!SR) {
        this.bus.emit("toast", { text: "当前浏览器不支持语音识别，请用文字输入", type: "warn" });
        return;
      }
      if (this.listening && this.recognition) {
        this.recognition.stop();
        return;
      }
      try {
        const rec = new SR();
        rec.lang = "zh-CN";
        rec.interimResults = false;
        rec.continuous = false;
        rec.maxAlternatives = 1;
        rec.onstart = () => {
          this.listening = true;
          if (this.micEl) this.micEl.classList.add("is-listening");
          this.bus.emit("toast", { text: "我在听，请说…", type: "" });
        };
        rec.onresult = (event) => {
          const text = event.results && event.results[0] && event.results[0][0] && event.results[0][0].transcript;
          if (text && text.trim()) this.bus.emit("ui:voice", { text: text.trim() });
        };
        rec.onerror = (event) => {
          const map = { "not-allowed": "麦克风权限未开启", "no-speech": "没有听到声音", network: "语音识别网络异常" };
          this.bus.emit("toast", { text: map[event.error] || "语音识别失败，请用文字", type: "warn" });
        };
        rec.onend = () => {
          this.listening = false;
          if (this.micEl) this.micEl.classList.remove("is-listening");
        };
        this.recognition = rec;
        rec.start();
      } catch (e) {
        this.bus.emit("toast", { text: "语音识别启动失败，请用文字输入", type: "warn" });
      }
    }

    destroy() {
      if (this.recognition) {
        try { this.recognition.abort(); } catch (e) { /* ignore */ }
      }
      if (this.synth) this.synth.cancel();
      if (this.bus.off) {
        this.bus.off("chat:message", this._onChat);
        this.bus.off("voice:speak", this._onSpeak);
      }
    }
  }

  UI.Voice = Voice;
})(window);
