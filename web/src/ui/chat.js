/* global window */
(function (global) {
  "use strict";
  const UI = (global.HomeTwinUI = global.HomeTwinUI || {});

  function nowLabel() {
    const d = new Date();
    return d.toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit" });
  }

  class Chat {
    constructor(bus, root, options) {
      this.bus = bus;
      this.root = root;
      this.options = options || {};
      this.messagesEl = root.querySelector(".ht-chat-messages");
      this.formEl = root.querySelector(".ht-chat-bar");
      this.inputEl = root.querySelector(".ht-chat-input");
      this.sendEl = root.querySelector(".ht-send-btn");
      this.typingEl = null;
      this.busy = false;
      this._bind();
      this._subscribe();
    }

    _subscribe() {
      this._onMessage = (payload) => {
        if (!payload || !payload.text) return;
        this.addMessage(payload.role || "butler", payload.text, payload.meta);
      };
      this._onTyping = (payload) => this.setTyping(!!(payload && payload.on));
      this._onTaskStart = () => this.setBusy(true);
      this._onTaskEnd = () => this.setBusy(false);
      this._onTaskReset = () => this.setBusy(false);
      this._onVoice = (payload) => {
        if (!payload || !payload.text) return;
        this.addMessage("user", payload.text, { source: "voice" });
        if (this.options.voiceEcho !== false) {
          this.bus.emit("ui:query", { text: payload.text, source: "voice" });
        }
      };
      this._onClear = () => this.clear();
      this.bus.on("chat:message", this._onMessage);
      this.bus.on("chat:typing", this._onTyping);
      this.bus.on("task:start", this._onTaskStart);
      this.bus.on("task:end", this._onTaskEnd);
      this.bus.on("task:reset", this._onTaskReset);
      this.bus.on("ui:voice", this._onVoice);
      this.bus.on("chat:clear", this._onClear);
    }

    _bind() {
      this.formEl.addEventListener("submit", (e) => {
        e.preventDefault();
        this.submit();
      });
      this.sendEl.addEventListener("click", (e) => {
        e.preventDefault();
        this.submit();
      });
      this.root.querySelectorAll(".ht-sug").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (this.busy) return;
          const q = btn.dataset.query || btn.textContent.trim();
          this.addMessage("user", q);
          this.bus.emit("ui:query", { text: q, source: "chip" });
        });
      });
    }

    submit() {
      if (this.busy) {
        this.bus.emit("toast", { text: "小方正在执行上一个任务，请稍等", type: "warn" });
        return;
      }
      const text = (this.inputEl.value || "").trim();
      if (!text) return;
      this.inputEl.value = "";
      this.addMessage("user", text);
      this.bus.emit("ui:query", { text, source: "text" });
    }

    addMessage(role, text, meta) {
      this.setTyping(false);
      const wrap = document.createElement("div");
      wrap.className = "ht-msg " + (role === "user" ? "user" : "butler");
      const avatar = document.createElement("span");
      avatar.className = "ht-msg-avatar";
      avatar.textContent = role === "user" ? "我" : "方";
      const bubble = document.createElement("div");
      bubble.className = "ht-bubble";
      bubble.textContent = text;
      const metaEl = document.createElement("span");
      metaEl.className = "ht-msg-meta";
      metaEl.textContent = nowLabel() + (meta && meta.tag ? " · " + meta.tag : "");
      bubble.appendChild(metaEl);
      wrap.appendChild(avatar);
      wrap.appendChild(bubble);
      this.messagesEl.appendChild(wrap);
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
      return wrap;
    }

    setTyping(on) {
      if (on) {
        if (this.typingEl) return;
        const wrap = document.createElement("div");
        wrap.className = "ht-msg butler";
        wrap.innerHTML =
          '<span class="ht-msg-avatar">方</span>' +
          '<div class="ht-bubble"><span class="ht-typing"><i></i><i></i><i></i></span></div>';
        this.messagesEl.appendChild(wrap);
        this.typingEl = wrap;
      } else if (this.typingEl) {
        this.typingEl.remove();
        this.typingEl = null;
      }
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }

    setBusy(busy) {
      this.busy = !!busy;
      this.inputEl.disabled = this.busy;
      this.sendEl.disabled = this.busy;
    }

    clear() {
      this.messagesEl.innerHTML = "";
      this.typingEl = null;
    }

    destroy() {
      if (this.bus.off) {
        this.bus.off("chat:message", this._onMessage);
        this.bus.off("chat:typing", this._onTyping);
        this.bus.off("task:start", this._onTaskStart);
        this.bus.off("task:end", this._onTaskEnd);
        this.bus.off("task:reset", this._onTaskReset);
        this.bus.off("ui:voice", this._onVoice);
        this.bus.off("chat:clear", this._onClear);
      }
    }
  }

  UI.Chat = Chat;
})(window);
