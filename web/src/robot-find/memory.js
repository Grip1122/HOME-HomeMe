/* global RF */
(function () {
  const RF = window.RF;

  function nowISO() {
    return new Date().toISOString();
  }

  class SpatialMemory {
    constructor() {
      this.layoutId = "A";
      this.enabled = true;
      this.records = new Map();
    }

    reset() {
      this.records.clear();
    }

    setEnabled(v) {
      this.enabled = !!v;
    }

    ingest(roomName, roomIndex, objects, confidence) {
      const conf = confidence === undefined ? 0.8 : confidence;
      const touched = [];
      for (const obj of objects) {
        const existing = this.records.get(obj.id);
        const rec = existing || {
          object_id: obj.id,
          name: obj.name,
          category: obj.category,
          aliases: obj.aliases,
          colorName: obj.colorName,
          color: obj.color,
          shape: obj.shape,
          size: obj.size,
          splatCount: obj.splatCount,
        };
        rec.name = obj.name;
        rec.category = obj.category;
        rec.aliases = obj.aliases;
        rec.colorName = obj.colorName;
        rec.color = obj.color;
        rec.shape = obj.shape;
        rec.size = obj.size;
        rec.splatCount = obj.splatCount;
        rec.room = roomName;
        rec.roomIndex = roomIndex;
        rec.pos = obj.currentPos.slice();
        rec.furniture = obj.currentFurniture || obj.furniture;
        rec.confidence = Math.max(existing ? existing.confidence * 0.6 : 0, conf);
        rec.status = "fresh";
        rec.updated_at = nowISO();
        this.records.set(obj.id, rec);
        touched.push(rec);
      }
      return touched;
    }

    get(id) {
      return this.records.get(id);
    }

    all() {
      return Array.from(this.records.values());
    }

    score(profile) {
      const results = [];
      for (const rec of this.records.values()) {
        let score = 0.02;
        const reasons = [];
        const hay = [rec.name, rec.category, ...(rec.aliases || [])].join(" ");
        const raw = profile.raw || "";

        if (profile.nameTerms && profile.nameTerms.length) {
          for (const term of profile.nameTerms) {
            if (!term) continue;
            if (hay.indexOf(term) >= 0) {
              score += term.length >= 2 ? 0.58 : 0.5;
              reasons.push("类别:" + term);
              break;
            }
          }
        }
        if (profile.colors && profile.colors.length) {
          if (profile.colors.indexOf(rec.colorName) >= 0) {
            score += 0.28;
            reasons.push("颜色:" + rec.colorName);
          }
        }
        if (profile.sizes && profile.sizes.length) {
          if (profile.sizes.indexOf(rec.size) >= 0) {
            score += 0.08;
            reasons.push("尺寸:" + rec.size);
          }
        }
        if (profile.shapes && profile.shapes.length) {
          if (profile.shapes.indexOf(rec.shape) >= 0) {
            score += 0.08;
            reasons.push("形状:" + rec.shape);
          }
        }
        if (profile.rooms && profile.rooms.length) {
          if (profile.rooms.indexOf(rec.room) >= 0) {
            score += 0.12;
            reasons.push("房间:" + rec.room);
          }
        }
        if (raw && raw.indexOf(rec.name) >= 0) {
          score += 0.15;
          reasons.push("名称命中");
        }
        score *= 0.75 + 0.25 * (rec.confidence || 0.8);
        results.push({ record: rec, score: Math.min(1, score), reasons });
      }
      results.sort((a, b) => b.score - a.score);
      return results;
    }

    verify(id, actualPos, roomName, tolerance) {
      const rec = this.records.get(id);
      if (!rec) return { ok: false, distance: Infinity };
      const tol = tolerance === undefined ? 1.15 : tolerance;
      const d = Math.hypot(actualPos[0] - rec.pos[0], actualPos[2] - rec.pos[2]);
      const sameRoom = !roomName || roomName === rec.room;
      if (d <= tol && sameRoom) {
        rec.confidence = Math.min(1, (rec.confidence || 0.8) + 0.05);
        rec.status = "fresh";
        rec.updated_at = nowISO();
        return { ok: true, distance: d, confidence: rec.confidence };
      }
      rec.confidence = Math.max(0, (rec.confidence || 0.8) - 0.4);
      rec.status = "stale";
      rec.updated_at = nowISO();
      return { ok: false, distance: d, confidence: rec.confidence };
    }

    correct(id, pos, roomName, roomIndex, furniture) {
      const rec = this.records.get(id);
      if (!rec) return null;
      rec.pos = pos.slice();
      rec.room = roomName;
      rec.roomIndex = roomIndex;
      if (furniture) rec.furniture = furniture;
      rec.confidence = 0.9;
      rec.status = "fresh";
      rec.updated_at = nowISO();
      return rec;
    }

    touch(id) {
      const rec = this.records.get(id);
      if (!rec) return;
      rec.confidence = Math.min(1, (rec.confidence || 0.8) + 0.03);
      rec.status = "fresh";
      rec.updated_at = nowISO();
    }

    snapshot() {
      const objects = {};
      for (const [id, rec] of this.records) {
        objects[id] = {
          object_id: id,
          name: rec.name,
          category: rec.category,
          colorName: rec.colorName,
          shape: rec.shape,
          size: rec.size,
          room: rec.room,
          roomIndex: rec.roomIndex,
          furniture: rec.furniture,
          color: rec.color,
          pos: rec.pos.slice(),
          confidence: Math.round(rec.confidence * 100) / 100,
          status: rec.status,
          updated_at: rec.updated_at,
          splatCount: rec.splatCount,
        };
      }
      return {
        layoutId: this.layoutId,
        enabled: this.enabled,
        count: this.records.size,
        objects,
        updatedAt: nowISO(),
      };
    }
  }

  class SDCard {
    constructor() {
      this.sceneId = RF.config?.sceneId || "robot-find-apartment-v1";
      this.storagePrefix = "robot-find." + encodeURIComponent(this.sceneId);
      this.storagePack = this.storagePrefix + ".sdcard.pack";
      this.storageKey = this.storagePrefix + ".deviceKey";
      this.layoutId = "A";
      this.capacityBytes = 64 * 1024 * 1024 * 1024;
      this.demoQuota = 4 * 1024 * 1024;
      this.info = {
        bytes: 0,
        splats: 0,
        objects: 0,
        checksum: "",
        alg: "AES-256-GCM",
        savedAt: null,
        packId: "",
        persisted: false,
      };
      this.hasPack = false;
      this.lastPayload = null;
      this.lastEnvelope = null;
      this.writeQueue = Promise.resolve();
      this.keyPersisted = false;
      this.supported = this.checkStorage();
      this.deviceKey = this.getOrCreateKey();
      this.readMeta();
    }

    checkStorage() {
      try {
        localStorage.getItem(this.storagePack);
        return true;
      } catch (e) {
        return false;
      }
    }

    getOrCreateKey() {
      try {
        const b64 = localStorage.getItem(this.storageKey);
        if (b64) {
          const bytes = RF.base64ToBytes(b64);
          if (bytes.length === 32) {
            this.keyPersisted = true;
            return bytes;
          }
        }
      } catch (e) {
        // 存储不可读时仍保留本次会话的设备密钥。
      }
      const bytes = new Uint8Array(32);
      if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(bytes);
      else for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
      try {
        const b64 = RF.bytesToBase64(bytes);
        // 已有包但密钥缺失时，新密钥不能恢复旧包，也不覆盖其存储。
        if (!localStorage.getItem(this.storagePack)) {
          localStorage.setItem(this.storageKey, b64);
          this.keyPersisted = localStorage.getItem(this.storageKey) === b64;
        }
      } catch (e) {
        this.keyPersisted = false;
      }
      return bytes;
    }

    validateEnvelope(env) {
      if (!env || typeof env !== "object" || env.version !== 1 ||
        !env.meta || typeof env.meta !== "object" || env.meta.version !== 1 ||
        typeof env.data !== "string" || !env.data || typeof env.iv !== "string" ||
        typeof env.meta.persisted !== "boolean" || typeof env.meta.createdAt !== "string" ||
        typeof env.meta.packId !== "string" ||
        [env.meta.bytes, env.meta.payloadBytes, env.meta.splats, env.meta.objects].some((v) => !Number.isSafeInteger(v) || v < 0)) {
        throw new Error("SD 卡记忆包结构无效");
      }
      if ((env.alg !== "AES-256-GCM" && env.alg !== "XOR-256 (demo fallback)") || env.meta.alg !== env.alg) {
        throw new Error("SD 卡记忆包加密算法无效");
      }
      if (env.meta.sceneId !== this.sceneId || env.meta.layoutId !== this.layoutId) {
        throw new Error("SD 卡记忆包场景或布局不匹配");
      }
      if (typeof env.meta.checksum !== "string" || !env.meta.checksum) {
        throw new Error("SD 卡记忆包缺少校验和");
      }
      const bytes = RF.base64ToBytes(env.data);
      if (!bytes.length || bytes.length !== env.meta.bytes || RF.base64ToBytes(env.iv).length !== 12) {
        throw new Error("SD 卡记忆包密文结构无效");
      }
      return bytes;
    }

    validatePayload(payload) {
      const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
      const isPosition = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
      const isSplat = (v) => {
        if (!isObject(v) || !Number.isSafeInteger(v.count) || v.count < 0 || v.count > 2000000) return false;
        try {
          return Object.entries({ pos: 6, col: 3, size: 1, op: 1, room: 1 }).every(([key, stride]) =>
            typeof v[key] === "string" && RF.base64ToBytes(v[key]).length === v.count * stride) &&
            ["posScale", "sizeScale"].every((key) => v[key] === undefined || (Number.isFinite(v[key]) && v[key] > 0));
        } catch (e) { return false; }
      };
      const validRoomIndex = (v) => v === undefined || (Number.isInteger(v) && v >= 0 && v < 3);
      const validText = (v) => v === undefined || typeof v === "string";
      if (!isObject(payload)) throw new Error("SD 卡记忆包内容结构无效");
      if (payload.sceneId !== this.sceneId || payload.layoutId !== this.layoutId ||
        (payload.memory && payload.memory.layoutId !== undefined && payload.memory.layoutId !== this.layoutId)) {
        throw new Error("SD 卡记忆包场景或布局不匹配");
      }
      if ((payload.version !== undefined && payload.version !== 1) || typeof payload.createdAt !== "string" ||
        !isObject(payload.memory) || !isObject(payload.memory.objects) ||
        (payload.memory.enabled !== undefined && typeof payload.memory.enabled !== "boolean") ||
        Object.values(payload.memory.objects).some((rec) => !isObject(rec) || !isPosition(rec.pos) ||
          !validRoomIndex(rec.roomIndex) || ![rec.name, rec.room, rec.category, rec.furniture].every(validText) ||
          (rec.confidence !== undefined && (!Number.isFinite(rec.confidence) || rec.confidence < 0 || rec.confidence > 1))) ||
        (payload.objects !== undefined && (!Array.isArray(payload.objects) ||
          payload.objects.some((obj) => !isObject(obj) || typeof obj.id !== "string" || !isPosition(obj.pos) ||
            !validRoomIndex(obj.roomIndex) || !validText(obj.room)))) ||
        (payload.scannedRooms !== undefined && (!Array.isArray(payload.scannedRooms) ||
          payload.scannedRooms.some((v) => typeof v !== "boolean"))) ||
        (payload.roomSplats !== undefined && !isSplat(payload.roomSplats)) ||
        (payload.objectSplats !== undefined && (!Array.isArray(payload.objectSplats) ||
          payload.objectSplats.some((obj) => !isObject(obj) || typeof obj.id !== "string" ||
            !Number.isSafeInteger(obj.count) || obj.count < 0 || !isSplat(obj.data) || obj.count !== obj.data.count)))) {
        throw new Error("SD 卡记忆包内容结构无效");
      }
    }

    readMeta() {
      try {
        const raw = localStorage.getItem(this.storagePack);
        if (raw) {
          const env = JSON.parse(raw);
          this.validateEnvelope(env);
          this.info = Object.assign({}, env.meta, { persisted: env.meta.persisted && this.keyPersisted });
          this.hasPack = true;
        }
      } catch (e) {
        this.hasPack = false;
      }
    }

    enqueue(operation) {
      const result = this.writeQueue.then(operation);
      this.writeQueue = result.catch(() => {});
      return result;
    }

    async aesKey() {
      if (!window.crypto || !crypto.subtle) return null;
      try {
        return await crypto.subtle.importKey("raw", this.deviceKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
      } catch (e) {
        return null;
      }
    }

    xorCrypt(bytes) {
      const out = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        out[i] = bytes[i] ^ this.deviceKey[i % this.deviceKey.length] ^ ((i * 37) & 0xff);
      }
      return out;
    }

    async encryptBytes(bytes) {
      const key = await this.aesKey();
      if (key) {
        try {
          const iv = new Uint8Array(12);
          crypto.getRandomValues(iv);
          const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
          return { data: new Uint8Array(ct), iv, alg: "AES-256-GCM" };
        } catch (e) {
          // 加密不可用时仅使用显式标注的演示回退算法。
        }
      }
      const iv = new Uint8Array(12);
      for (let i = 0; i < 12; i++) iv[i] = Math.floor(Math.random() * 256);
      const x = this.xorCrypt(bytes);
      return { data: x, iv, alg: "XOR-256 (demo fallback)" };
    }

    async decryptBytes(bytes, ivB64, alg) {
      if (alg === "XOR-256 (demo fallback)") return this.xorCrypt(bytes);
      if (alg !== "AES-256-GCM") throw new Error("SD 卡记忆包加密算法无效");
      try {
        const key = await this.aesKey();
        if (!key) throw new Error("AES 密钥不可用");
        const iv = RF.base64ToBytes(ivB64);
        const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, bytes);
        return new Uint8Array(plain);
      } catch (e) {
        throw new Error("SD 卡记忆包解密失败：" + (e.message || e));
      }
    }

    async save(payload) {
      const snapshot = JSON.parse(JSON.stringify(Object.assign({}, payload, {
        createdAt: payload.createdAt || nowISO(),
        layoutId: payload.layoutId === undefined ? this.layoutId : payload.layoutId,
        sceneId: payload.sceneId === undefined ? this.sceneId : payload.sceneId,
      })));
      this.validatePayload(snapshot);
      const plain = RF.textToBytes(JSON.stringify(snapshot));
      return this.enqueue(async () => {
        const enc = await this.encryptBytes(plain);
        const checksum = await RF.sha256Hex(enc.data);
        const splats = (snapshot.roomSplats ? snapshot.roomSplats.count : 0) +
          (snapshot.objectSplats || []).reduce((a, o) => a + o.count, 0);
        const meta = {
          version: 1,
          sceneId: this.sceneId,
          layoutId: snapshot.layoutId,
          createdAt: snapshot.createdAt,
          bytes: enc.data.length,
          payloadBytes: plain.length,
          splats,
          objects: Object.keys(snapshot.memory.objects).length,
          checksum,
          alg: enc.alg,
          packId: "RF-A-" + checksum.slice(0, 10).toUpperCase(),
          persisted: false,
        };
        const envelope = {
          version: 1,
          alg: enc.alg,
          iv: RF.bytesToBase64(enc.iv),
          data: RF.bytesToBase64(enc.data),
          meta,
        };
        this.supported = this.checkStorage();
        this.keyPersisted = false;
        try {
          const b64 = RF.bytesToBase64(this.deviceKey);
          let storedKey = localStorage.getItem(this.storageKey);
          if (!storedKey) {
            localStorage.setItem(this.storageKey, b64);
            storedKey = localStorage.getItem(this.storageKey);
          }
          this.keyPersisted = storedKey === b64;
          if (this.keyPersisted) {
            meta.persisted = true;
            localStorage.setItem(this.storagePack, JSON.stringify(envelope));
          }
        } catch (e) {
          meta.persisted = false;
        }
        this.info = meta;
        this.hasPack = true;
        this.lastPayload = snapshot;
        this.lastEnvelope = envelope;
        return meta;
      });
    }

    async load() {
      return this.enqueue(async () => {
        let env = this.lastEnvelope;
        let persisted = false;
        // 最新保存若仅在内存中，绝不回退到磁盘上的旧包。
        if (!env || env.meta.persisted) {
          let raw = null;
          try {
            raw = localStorage.getItem(this.storagePack);
          } catch (e) {
            this.supported = false;
          }
          if (raw) {
            env = JSON.parse(raw);
            persisted = !!(env && env.meta && env.meta.persisted && this.keyPersisted);
          }
        }
        if (!env) return null;
        const bytes = this.validateEnvelope(env);
        const checksum = await RF.sha256Hex(bytes);
        if (checksum !== env.meta.checksum) throw new Error("SD 卡记忆包校验和不匹配");
        const plain = await this.decryptBytes(bytes, env.iv, env.alg);
        let payload;
        try {
          payload = JSON.parse(RF.bytesToText(plain));
        } catch (e) {
          throw new Error("SD 卡记忆包解密或解析失败");
        }
        this.validatePayload(payload);
        const meta = Object.assign({}, env.meta, { persisted });
        this.lastPayload = payload;
        this.lastEnvelope = Object.assign({}, env, { meta });
        this.info = meta;
        this.hasPack = true;
        return payload;
      });
    }

    hasStoredPack() {
      if (!this.keyPersisted || (this.lastEnvelope && !this.lastEnvelope.meta.persisted)) return false;
      try {
        const raw = localStorage.getItem(this.storagePack);
        if (!raw) return false;
        const env = JSON.parse(raw);
        this.validateEnvelope(env);
        return env.meta.persisted;
      } catch (e) {
        return false;
      }
    }

    status() {
      return {
        capacityBytes: this.capacityBytes,
        capacityText: "64 GB",
        demoQuota: this.demoQuota,
        bytes: this.info.bytes || 0,
        percent: Math.min(100, ((this.info.bytes || 0) / this.demoQuota) * 100),
        splats: this.info.splats || 0,
        objects: this.info.objects || 0,
        checksum: this.info.checksum || "",
        alg: this.info.alg || "AES-256-GCM",
        savedAt: this.info.createdAt || null,
        packId: this.info.packId || "",
        supported: this.supported,
        hasPack: this.hasPack,
        persisted: !!this.info.persisted,
      };
    }

    exportPack() {
      let envelope = this.lastEnvelope;
      try {
        if (!envelope) {
          const raw = localStorage.getItem(this.storagePack);
          if (raw) envelope = JSON.parse(raw);
        }
        this.validateEnvelope(envelope);
      } catch (e) {
        return false;
      }
      const text = JSON.stringify({
        version: envelope.version,
        alg: envelope.alg,
        iv: envelope.iv,
        data: envelope.data,
        meta: {
          version: envelope.meta.version,
          sceneId: envelope.meta.sceneId,
          layoutId: envelope.meta.layoutId,
          createdAt: envelope.meta.createdAt,
          bytes: envelope.meta.bytes,
          payloadBytes: envelope.meta.payloadBytes,
          splats: envelope.meta.splats,
          objects: envelope.meta.objects,
          checksum: envelope.meta.checksum,
          alg: envelope.meta.alg,
          packId: envelope.meta.packId,
          persisted: envelope.meta.persisted,
        },
      }, null, 2);
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (envelope.meta.packId || "robot-find-memory") + ".rfpack.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      return true;
    }

    async erase() {
      return this.enqueue(() => {
        try {
          localStorage.removeItem(this.storagePack);
        } catch (e) {
          throw new Error("SD 卡记忆包擦除失败：" + (e.message || e));
        }
        this.info = { bytes: 0, splats: 0, objects: 0, checksum: "", alg: this.info.alg, savedAt: null, packId: "", persisted: false };
        this.hasPack = false;
        this.lastPayload = null;
        this.lastEnvelope = null;
        return true;
      });
    }
  }

  RF.SpatialMemory = SpatialMemory;
  RF.SDCard = SDCard;
})();
