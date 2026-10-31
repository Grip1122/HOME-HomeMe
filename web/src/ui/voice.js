/* global window */
(function (global) {
  "use strict";
  const UI = (global.HomeTwinUI = global.HomeTwinUI || {});
  const C = UI.COPY;

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
      this.getMemoryEnabled = this.options.getMemoryEnabled || (() => true);
      this.onToast = this.options.onToast || (() => {});
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
      this._onSay = (p) => {
        if (!p || p.who !== "robot" || typeof p.text !== "string") return;
        if (this.enabled) this.speak(p.text);
      };
      this.bus.on("task:say", this._onSay);
    }

    _bind() {
      if (this.micEl) this.micEl.addEventListener("click", () => this.listen());
      if (this.speakEl) this.speakEl.addEventListener("click", () => this.toggle());
    }

    toggle() {
      this.setEnabled(!this.enabled);
      if (this.enabled) {
        this.onToast(C.chat.voice.on, "");
        this.speak(C.chat.welcome);
      } else {
        this.onToast(C.chat.voice.off, "");
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
        this.speakEl.title = C.chat.speak;
        this.speakEl.setAttribute("aria-label", C.chat.speak);
      }
      if (this.micEl) {
        const SR = global.SpeechRecognition || global.webkitSpeechRecognition;
        this.micEl.disabled = !SR;
        this.micEl.title = SR ? C.chat.mic : C.chat.voice.unsupported;
        this.micEl.setAttribute("aria-label", this.micEl.title);
      }
    }

    speak(text) {
      if (!this.synth || !text || typeof global.SpeechSynthesisUtterance !== "function") return;
      try {
        this.synth.cancel();
        const utter = new global.SpeechSynthesisUtterance(String(text).replace(/https?:\/\/\S+/g, ""));
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
        this.onToast(C.chat.voice.unsupported, "warn");
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
          this.onToast(C.chat.voice.listening, "");
        };
        rec.onresult = (event) => {
          const text = event.results && event.results[0] && event.results[0][0] && event.results[0][0].transcript;
          if (text && text.trim()) {
            this.bus.emit("plan:request", { query: text.trim(), memoryEnabled: !!this.getMemoryEnabled() });
          }
        };
        rec.onerror = (event) => {
          const map = {
            "not-allowed": C.chat.voice.notAllowed,
            "no-speech": C.chat.voice.noSpeech,
            network: C.chat.voice.network,
          };
          this.onToast(map[event.error] || C.chat.voice.failed, "warn");
        };
        rec.onend = () => {
          this.listening = false;
          if (this.micEl) this.micEl.classList.remove("is-listening");
        };
        this.recognition = rec;
        rec.start();
      } catch (e) {
        this.onToast(C.chat.voice.startFailed, "warn");
      }
    }

    destroy() {
      if (this.recognition) {
        try { this.recognition.abort(); } catch (e) { /* ignore */ }
      }
      if (this.synth) this.synth.cancel();
      if (this.bus.off) this.bus.off("task:say", this._onSay);
    }
  }

  UI.Voice = Voice;
})(window);
