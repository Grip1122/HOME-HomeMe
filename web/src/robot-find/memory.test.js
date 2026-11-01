// @vitest-environment node
import assert from "node:assert/strict";
import { Blob } from "node:buffer";
import { webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { TextDecoder, TextEncoder } from "node:util";
import vm from "node:vm";
import { describe, it } from "vitest";

const source = readFileSync(new URL("./memory.js", import.meta.url), "utf8");
const DEFAULT_SCENE = "xiaomi-home-restaurant-v1";
const copy = (value) => JSON.parse(JSON.stringify(value));
const packKey = (sceneId = DEFAULT_SCENE) => "xiaomi-home." + encodeURIComponent(sceneId) + ".sdcard.pack";
const keyKey = (sceneId = DEFAULT_SCENE) => "xiaomi-home." + encodeURIComponent(sceneId) + ".deviceKey";

function createStorage(options = {}) {
  const values = new Map();
  const writes = [];
  return {
    values,
    writes,
    disabled: false,
    quotaFull: false,
    keyBlocked: false,
    eraseBlocked: false,
    ...options,
    getItem(key) {
      if (this.disabled) throw new Error("存储已禁用");
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      if (this.disabled) throw new Error("存储已禁用");
      if (this.quotaFull || (this.keyBlocked && key.endsWith(".deviceKey"))) {
        throw new Error("存储配额已满");
      }
      values.set(key, String(value));
      writes.push(key);
    },
    removeItem(key) {
      if (this.disabled || this.eraseBlocked) throw new Error("存储擦除被拒绝");
      values.delete(key);
    },
  };
}

function createHarness({ storage = createStorage(), sceneId, crypto = webcrypto, missingStorage = false } = {}) {
  const downloads = [];
  const anchors = [];
  const RF = {
    bytesToBase64: (bytes) => Buffer.from(bytes).toString("base64"),
    base64ToBytes: (text) => Uint8Array.from(atob(text), (ch) => ch.charCodeAt(0)),
    textToBytes: (text) => new TextEncoder().encode(text),
    bytesToText: (bytes) => new TextDecoder().decode(bytes),
    sha256Hex: async (bytes) => {
      if (crypto && crypto.subtle) {
        return Buffer.from(await crypto.subtle.digest("SHA-256", bytes)).toString("hex");
      }
      let hash = 0x811c9dc5;
      for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193);
      return (hash >>> 0).toString(16).padStart(8, "0");
    },
  };
  if (sceneId !== undefined) RF.config = { sceneId };
  const window = { RF, crypto, TextEncoder, TextDecoder };
  const sandbox = {
    window,
    crypto,
    TextEncoder,
    TextDecoder,
    Blob,
    URL: {
      createObjectURL(blob) {
        downloads.push(blob);
        return "blob:xiaomi-home-memory";
      },
      revokeObjectURL() {},
    },
    document: {
      body: { appendChild() {} },
      createElement(tag) {
        assert.equal(tag, "a");
        const anchor = { click() {}, remove() {} };
        anchors.push(anchor);
        return anchor;
      },
    },
    setTimeout(callback) {
      callback();
      return 0;
    },
  };
  if (!missingStorage) {
    sandbox.localStorage = storage;
    window.localStorage = storage;
  }
  vm.runInNewContext(source, sandbox, { filename: "memory.js" });
  return { RF, sd: new RF.SDCard(), storage, downloads, anchors, sceneId: sceneId || DEFAULT_SCENE };
}

function splatData(count) {
  return {
    count,
    pos: Buffer.alloc(count * 6).toString("base64"),
    col: Buffer.alloc(count * 3).toString("base64"),
    size: Buffer.alloc(count).toString("base64"),
    op: Buffer.alloc(count).toString("base64"),
    room: Buffer.alloc(count).toString("base64"),
    posScale: 200,
    sizeScale: 1000,
  };
}

function makePayload(name = "蓝色杯子") {
  return {
    version: 1,
    layoutId: "A",
    memory: {
      layoutId: "A",
      enabled: true,
      count: 1,
      objects: {
        cup: {
          object_id: "cup",
          name,
          category: "杯子",
          pos: [1, 0, 2],
          room: "客厅",
          roomIndex: 0,
          confidence: 0.8,
          status: "fresh",
        },
      },
    },
    objects: [{ id: "cup", pos: [1, 0, 2], room: "客厅", roomIndex: 0 }],
    scannedRooms: [true, false, false],
    roomSplats: splatData(2),
    objectSplats: [{ id: "cup", count: 3, data: splatData(3) }],
  };
}

async function exportedEnvelope(harness) {
  assert.equal(harness.sd.exportPack(), true);
  const text = await harness.downloads.at(-1).text();
  const env = JSON.parse(text);
  assert.equal("payload" in env, false);
  assert.equal("memory" in env, false);
  assert.equal("objects" in env, false);
  assert.equal(typeof env.data, "string");
  assert.equal(typeof env.iv, "string");
  assert.equal(env.alg, env.meta.alg);
  assert.equal(text.includes("蓝色杯子"), false);
  return env;
}

async function writeEncryptedPayload(harness, payload) {
  const { sd, RF, storage, sceneId } = harness;
  const env = copy(sd.lastEnvelope);
  const plain = RF.textToBytes(JSON.stringify(payload));
  const encrypted = await sd.encryptBytes(plain);
  env.alg = encrypted.alg;
  env.iv = RF.bytesToBase64(encrypted.iv);
  env.data = RF.bytesToBase64(encrypted.data);
  env.meta.alg = encrypted.alg;
  env.meta.bytes = encrypted.data.length;
  env.meta.payloadBytes = plain.length;
  env.meta.checksum = await RF.sha256Hex(encrypted.data);
  storage.setItem(packKey(sceneId), JSON.stringify(env));
}

describe("SDCard 本地加密记忆包", () => {
  it("无 config 时使用默认场景，原子保存并从同一 envelope 恢复元数据与记忆", async () => {
    const h = createHarness();
    const payload = makePayload();
    h.storage.writes.length = 0;
    const meta = await h.sd.save(payload);
    const env = JSON.parse(h.storage.getItem(packKey()));
    assert.equal(h.RF.config, undefined);
    assert.equal(meta.persisted, true);
    assert.equal(meta.sceneId, DEFAULT_SCENE);
    assert.equal(meta.layoutId, "A");
    assert.equal(meta.alg, "AES-256-GCM");
    assert.equal(meta.splats, 5);
    assert.equal(meta.objects, 1);
    assert.deepEqual(env.meta, copy(meta));
    assert.deepEqual(h.storage.writes, [packKey()]);
    assert.equal(payload.sceneId, undefined);
    assert.equal(h.sd.status().persisted, true);
    assert.equal(h.sd.hasStoredPack(), true);

    const fresh = createHarness({ storage: h.storage });
    assert.deepEqual(copy(fresh.sd.info), env.meta);
    const loaded = await fresh.sd.load();
    assert.deepEqual(copy(loaded.memory), payload.memory);
    assert.deepEqual(copy(loaded.objects), payload.objects);
    assert.deepEqual(copy(loaded.roomSplats), payload.roomSplats);
    assert.equal(loaded.sceneId, DEFAULT_SCENE);
    assert.equal(loaded.layoutId, "A");
    assert.equal(fresh.sd.status().persisted, true);
  });

  it("按配置场景隔离包和设备密钥，不读取或修改旧 rf.* 数据", async () => {
    const storage = createStorage();
    const legacy = {
      "rf.sdcard.pack.A": "旧密文",
      "rf.sdcard.meta.A": JSON.stringify({ bytes: 99, alg: "旧算法" }),
      "rf.deviceKey": "旧设备密钥",
    };
    for (const [key, value] of Object.entries(legacy)) storage.setItem(key, value);
    const first = createHarness({ storage, sceneId: "公寓/一" });
    const second = createHarness({ storage, sceneId: "公寓/二" });
    assert.equal(first.sd.status().hasPack, false);
    assert.equal(second.sd.hasStoredPack(), false);
    await first.sd.save(makePayload("场景一"));
    assert.equal(await second.sd.load(), null);
    await second.sd.save(makePayload("场景二"));
    assert.notEqual(storage.getItem(keyKey("公寓/一")), storage.getItem(keyKey("公寓/二")));
    assert.equal((await first.sd.load()).memory.objects.cup.name, "场景一");
    assert.equal((await second.sd.load()).memory.objects.cup.name, "场景二");
    for (const [key, value] of Object.entries(legacy)) assert.equal(storage.getItem(key), value);
    assert.equal([...storage.values.keys()].some((key) => key.startsWith("xiaomi-home.") && key.includes(".meta")), false);
  });

  it("实例创建时读取 sceneId，之后的配置切换不串写已创建的卡", async () => {
    const h = createHarness();
    h.RF.config = { sceneId: "next-scene" };
    const next = new h.RF.SDCard();
    assert.equal(h.sd.sceneId, DEFAULT_SCENE);
    assert.equal(next.sceneId, "next-scene");
    await h.sd.save(makePayload("原场景"));
    await next.save(makePayload("新场景"));
    assert.equal((await h.sd.load()).sceneId, DEFAULT_SCENE);
    assert.equal((await next.load()).sceneId, "next-scene");
    assert.notEqual(h.storage.getItem(packKey()), h.storage.getItem(packKey("next-scene")));
  });

  it("只读存储仍可读取已有记忆，不以试写探针误判为不可用", async () => {
    const h = createHarness();
    await h.sd.save(makePayload());
    h.storage.quotaFull = true;
    const fresh = createHarness({ storage: h.storage });
    assert.equal(fresh.sd.status().supported, true);
    assert.equal(fresh.sd.status().persisted, true);
    assert.equal((await fresh.sd.load()).memory.objects.cup.name, "蓝色杯子");
  });

  it("配额满时保留最新密文和真实算法，不加载或导出磁盘上的旧包", async () => {
    const h = createHarness();
    await h.sd.save(makePayload("旧包"));
    const oldRaw = h.storage.getItem(packKey());
    h.storage.quotaFull = true;
    const meta = await h.sd.save(makePayload());
    assert.equal(meta.persisted, false);
    assert.equal(meta.alg, "AES-256-GCM");
    assert.equal(h.sd.lastEnvelope.meta.persisted, false);
    assert.equal(h.sd.status().persisted, false);
    assert.equal(h.sd.status().hasPack, true);
    assert.equal(h.sd.hasStoredPack(), false);
    assert.equal(h.storage.getItem(packKey()), oldRaw);
    const env = await exportedEnvelope(h);
    assert.deepEqual(env, copy(h.sd.lastEnvelope));
    assert.notEqual(env.data, JSON.parse(oldRaw).data);
    assert.equal((await h.sd.load()).memory.objects.cup.name, "蓝色杯子");
    assert.equal(h.sd.status().persisted, false);
  });

  it("启动时已满额也不假称持久化，存储恢复后可保存相同会话密钥", async () => {
    const storage = createStorage({ quotaFull: true });
    const h = createHarness({ storage });
    assert.equal((await h.sd.save(makePayload())).persisted, false);
    assert.equal(h.sd.keyPersisted, false);
    assert.equal(storage.getItem(packKey()), null);
    assert.equal((await h.sd.load()).sceneId, DEFAULT_SCENE);
    await exportedEnvelope(h);
    const key = Buffer.from(h.sd.deviceKey).toString("base64");
    storage.quotaFull = false;
    assert.equal((await h.sd.save(makePayload())).persisted, true);
    assert.equal(storage.getItem(keyKey()), key);
    assert.equal((await createHarness({ storage }).sd.load()).memory.objects.cup.name, "蓝色杯子");
  });

  it("localStorage disabled 时仅保留会话密文，仍可加载与加密导出", async () => {
    const h = createHarness({ storage: createStorage({ disabled: true }) });
    const meta = await h.sd.save(makePayload());
    assert.equal(meta.persisted, false);
    assert.equal(meta.alg, "AES-256-GCM");
    assert.equal(h.sd.status().supported, false);
    assert.equal(h.sd.status().persisted, false);
    assert.equal(h.sd.hasStoredPack(), false);
    assert.equal((await h.sd.load()).memory.objects.cup.name, "蓝色杯子");
    assert.equal((await exportedEnvelope(h)).meta.persisted, false);
  });

  it("没有 localStorage 全局变量时不崩溃，也绝不回退明文导出", async () => {
    const h = createHarness({ missingStorage: true });
    assert.equal((await h.sd.save(makePayload())).persisted, false);
    assert.equal(h.sd.status().supported, false);
    assert.equal((await h.sd.load()).sceneId, DEFAULT_SCENE);
    await exportedEnvelope(h);
    await assert.rejects(h.sd.erase(), /擦除失败/);
    assert.equal(h.sd.status().hasPack, true);
  });

  it("仅设备密钥存储失败时，不写入不可恢复的持久化包", async () => {
    const storage = createStorage({ keyBlocked: true });
    const h = createHarness({ storage });
    assert.equal((await h.sd.save(makePayload())).persisted, false);
    assert.equal(h.sd.keyPersisted, false);
    assert.equal(storage.getItem(packKey()), null);
    assert.equal(storage.writes.includes(packKey()), false);
    assert.equal(h.sd.hasStoredPack(), false);
    await exportedEnvelope(h);
    storage.keyBlocked = false;
    assert.equal((await h.sd.save(makePayload())).persisted, true);
    assert.equal((await createHarness({ storage }).sd.load()).memory.objects.cup.name, "蓝色杯子");
  });

  it("设备密钥写入静默丢失时也不报告持久化成功", async () => {
    const storage = createStorage();
    const setItem = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      if (!key.endsWith(".deviceKey")) setItem(key, value);
    };
    const h = createHarness({ storage });
    assert.equal((await h.sd.save(makePayload())).persisted, false);
    assert.equal(storage.getItem(packKey()), null);
    assert.equal((await h.sd.load()).sceneId, DEFAULT_SCENE);
  });

  it("刷新后丢失设备密钥不称可恢复，也不会为旧包写入新密钥", async () => {
    const h = createHarness();
    await h.sd.save(makePayload());
    h.storage.removeItem(keyKey());
    const fresh = createHarness({ storage: h.storage });
    assert.equal(fresh.sd.keyPersisted, false);
    assert.equal(fresh.sd.status().persisted, false);
    assert.equal(fresh.sd.hasStoredPack(), false);
    assert.equal(h.storage.getItem(keyKey()), null);
    await assert.rejects(fresh.sd.load(), /解密失败/);
    assert.equal(fresh.sd.lastPayload, null);
  });

  it("显式标注并正确读取无 WebCrypto 的 XOR 演示回退包", async () => {
    const h = createHarness({ crypto: null });
    const meta = await h.sd.save(makePayload());
    assert.equal(meta.alg, "XOR-256 (demo fallback)");
    assert.equal(meta.persisted, true);
    const env = await exportedEnvelope(h);
    assert.equal(env.alg, meta.alg);
    assert.equal((await createHarness({ storage: h.storage, crypto: null }).sd.load()).sceneId, DEFAULT_SCENE);
  });

  it.each([
    ["未知算法", (env) => { env.alg = env.meta.alg = "PLAINTEXT"; }, /加密算法无效/],
    ["伪造状态后缀", (env) => { env.alg = env.meta.alg = "AES-256-GCM · memory-only"; }, /加密算法无效/],
    ["算法与元数据不一致", (env) => { env.meta.alg = "XOR-256 (demo fallback)"; }, /加密算法无效/],
    ["缺少校验和", (env) => { delete env.meta.checksum; }, /缺少校验和/],
    ["错误校验和", (env) => { env.meta.checksum = "bad"; }, /校验和不匹配/],
    ["缺少元数据", (env) => { delete env.meta; }, /结构无效/],
    ["元数据夹带对象", (env) => { env.meta.objects = makePayload(); }, /结构无效/],
    ["错误包版本", (env) => { env.version = 2; }, /结构无效/],
    ["损坏 IV 长度", (env) => { env.iv = "AA=="; }, /密文结构无效/],
    ["跨场景元数据", (env) => { env.meta.sceneId = "home-backend"; }, /场景或布局不匹配/],
    ["跨布局元数据", (env) => { env.meta.layoutId = "B"; }, /场景或布局不匹配/],
  ])("拒绝%s，失败不覆盖当前有效记忆", async (name, change, error) => {
    const h = createHarness();
    await h.sd.save(makePayload());
    const previousPayload = h.sd.lastPayload;
    const previousEnvelope = h.sd.lastEnvelope;
    const previousInfo = h.sd.info;
    const env = copy(previousEnvelope);
    change(env);
    h.storage.setItem(packKey(), JSON.stringify(env));
    await assert.rejects(h.sd.load(), error);
    assert.equal(h.sd.lastPayload, previousPayload);
    assert.equal(h.sd.lastEnvelope, previousEnvelope);
    assert.equal(h.sd.info, previousInfo);
  });

  it("损坏密文先拒绝校验和；重算校验和也无法绕过 AES 认证", async () => {
    const h = createHarness();
    await h.sd.save(makePayload());
    const env = copy(h.sd.lastEnvelope);
    const bytes = h.RF.base64ToBytes(env.data);
    bytes[0] ^= 1;
    env.data = h.RF.bytesToBase64(bytes);
    h.storage.setItem(packKey(), JSON.stringify(env));
    await assert.rejects(h.sd.load(), /校验和不匹配/);
    env.meta.checksum = await h.RF.sha256Hex(bytes);
    h.storage.setItem(packKey(), JSON.stringify(env));
    await assert.rejects(h.sd.load(), /解密失败/);
    assert.equal(h.sd.lastPayload.memory.objects.cup.name, "蓝色杯子");
  });

  it("IV 内容被篡改时明确报告解密失败", async () => {
    const h = createHarness();
    await h.sd.save(makePayload());
    const env = copy(h.sd.lastEnvelope);
    const iv = h.RF.base64ToBytes(env.iv);
    iv[0] ^= 1;
    env.iv = h.RF.bytesToBase64(iv);
    h.storage.setItem(packKey(), JSON.stringify(env));
    await assert.rejects(h.sd.load(), /解密失败/);
  });

  it("AES 环境不可用时不能将 AES 包误当 XOR 解密", async () => {
    const h = createHarness();
    await h.sd.save(makePayload());
    const fresh = createHarness({ storage: h.storage, crypto: null });
    fresh.RF.sha256Hex = h.RF.sha256Hex;
    await assert.rejects(fresh.sd.load(), /解密失败.*AES/);
    assert.equal(fresh.sd.lastPayload, null);
  });

  it("其他场景的包即使复制到当前命名空间也不能加载", async () => {
    const storage = createStorage();
    const first = createHarness({ storage, sceneId: "scene-one" });
    const second = createHarness({ storage, sceneId: "scene-two" });
    await first.sd.save(makePayload());
    storage.setItem(packKey("scene-two"), storage.getItem(packKey("scene-one")));
    await assert.rejects(second.sd.load(), /场景或布局不匹配/);
    assert.equal(second.sd.lastPayload, null);
  });

  it.each([
    ["payload 场景", (payload) => { payload.sceneId = "another-scene"; }, /场景或布局不匹配/],
    ["payload 布局", (payload) => { payload.layoutId = "B"; }, /场景或布局不匹配/],
    ["记忆布局", (payload) => { payload.memory.layoutId = "B"; }, /场景或布局不匹配/],
    ["缺少场景", (payload) => { delete payload.sceneId; }, /场景或布局不匹配/],
    ["错误内容版本", (payload) => { payload.version = 2; }, /内容结构无效/],
    ["缺少记忆", (payload) => { delete payload.memory; }, /内容结构无效/],
    ["记忆 objects 数组", (payload) => { payload.memory.objects = []; }, /内容结构无效/],
    ["非法记忆坐标", (payload) => { payload.memory.objects.cup.pos = [1, null, 2]; }, /内容结构无效/],
    ["非法物体列表", (payload) => { payload.objects = {}; }, /内容结构无效/],
    ["非法物体坐标", (payload) => { payload.objects[0].pos = "1,0,2"; }, /内容结构无效/],
    ["非法扫描状态", (payload) => { payload.scannedRooms = ["true"]; }, /内容结构无效/],
    ["非法 splat 数量", (payload) => { payload.objectSplats[0].count = -1; }, /内容结构无效/],
    ["缺少 room splat 数据", (payload) => { delete payload.roomSplats.pos; }, /内容结构无效/],
    ["缺少 object splat 数据", (payload) => { delete payload.objectSplats[0].data; }, /内容结构无效/],
  ])("解密后校验%s，未经验证不应用 payload", async (name, change, error) => {
    const h = createHarness();
    await h.sd.save(makePayload());
    const previousPayload = h.sd.lastPayload;
    const previousEnvelope = h.sd.lastEnvelope;
    const payload = copy(previousPayload);
    change(payload);
    await writeEncryptedPayload(h, payload);
    await assert.rejects(h.sd.load(), error);
    assert.equal(h.sd.lastPayload, previousPayload);
    assert.equal(h.sd.lastEnvelope, previousEnvelope);
  });

  it("没有密文 envelope 时即使存在 lastPayload 也拒绝明文导出", () => {
    const h = createHarness();
    assert.equal(h.sd.exportPack(), false);
    h.sd.lastPayload = makePayload();
    assert.equal(h.sd.exportPack(), false);
    h.storage.setItem(packKey(), JSON.stringify({ version: 1, payload: makePayload() }));
    assert.equal(h.sd.exportPack(), false);
    assert.equal(h.downloads.length, 0);
  });

  it("刷新后不解密也只能导出带元数据的密文 envelope", async () => {
    const h = createHarness();
    await h.sd.save(makePayload());
    const fresh = createHarness({ storage: h.storage });
    assert.equal(fresh.sd.lastPayload, null);
    assert.deepEqual(await exportedEnvelope(fresh), JSON.parse(h.storage.getItem(packKey())));
    assert.equal(fresh.anchors[0].download, h.sd.info.packId + ".rfpack.json");
  });

  it("导出仅允许密文与元数据字段，排除外部包夹带的明文", async () => {
    const h = createHarness();
    await h.sd.save(makePayload());
    const env = copy(h.sd.lastEnvelope);
    env.payload = makePayload();
    env.meta.payload = makePayload();
    h.storage.setItem(packKey(), JSON.stringify(env));
    const fresh = createHarness({ storage: h.storage });
    const exported = await exportedEnvelope(fresh);
    assert.equal("payload" in exported.meta, false);
  });

  it("并发 save 按调用顺序串行化，且对每次输入立即快照", async () => {
    const h = createHarness();
    const encrypt = h.sd.encryptBytes.bind(h.sd);
    let release;
    let started;
    const gate = new Promise((resolve) => { release = resolve; });
    const entered = new Promise((resolve) => { started = resolve; });
    let calls = 0;
    h.sd.encryptBytes = async (bytes) => {
      calls++;
      if (calls === 1) {
        started();
        await gate;
      }
      return encrypt(bytes);
    };
    const firstPayload = makePayload("第一次保存");
    const first = h.sd.save(firstPayload);
    await entered;
    const secondPayload = makePayload("第二次保存");
    const second = h.sd.save(secondPayload);
    firstPayload.memory.objects.cup.name = "不应进入旧快照";
    secondPayload.memory.objects.cup.name = "不应进入新快照";
    await Promise.resolve();
    try {
      assert.equal(calls, 1);
    } finally {
      release();
    }
    const [firstMeta, secondMeta] = await Promise.all([first, second]);
    assert.equal(calls, 2);
    assert.notEqual(firstMeta.checksum, secondMeta.checksum);
    assert.equal(h.sd.lastEnvelope.meta.checksum, secondMeta.checksum);
    assert.equal(h.sd.lastPayload.memory.objects.cup.name, "第二次保存");
    const loaded = await createHarness({ storage: h.storage }).sd.load();
    assert.equal(loaded.memory.objects.cup.name, "第二次保存");
  });

  it("保存链中的一次失败不阻塞后续保存或加载", async () => {
    const h = createHarness();
    const encrypt = h.sd.encryptBytes.bind(h.sd);
    let calls = 0;
    h.sd.encryptBytes = async (bytes) => {
      if (++calls === 1) throw new Error("模拟加密失败");
      return encrypt(bytes);
    };
    const rejected = assert.rejects(h.sd.save(makePayload("失败包")), /模拟加密失败/);
    const success = h.sd.save(makePayload("成功包"));
    await rejected;
    assert.equal((await success).persisted, true);
    assert.equal((await h.sd.load()).memory.objects.cup.name, "成功包");
  });

  it("erase 排在尚未完成的 save 之后，避免擦除后旧包重新出现", async () => {
    const h = createHarness();
    const encrypt = h.sd.encryptBytes.bind(h.sd);
    let release;
    let started;
    const gate = new Promise((resolve) => { release = resolve; });
    const entered = new Promise((resolve) => { started = resolve; });
    h.sd.encryptBytes = async (bytes) => {
      started();
      await gate;
      return encrypt(bytes);
    };
    const saving = h.sd.save(makePayload());
    await entered;
    const erasing = h.sd.erase();
    release();
    await saving;
    assert.equal(await erasing, true);
    assert.equal(h.storage.getItem(packKey()), null);
    assert.equal(h.sd.lastEnvelope, null);
    assert.equal(h.sd.lastPayload, null);
    assert.equal(h.sd.status().hasPack, false);
    assert.equal(h.sd.status().persisted, false);
    assert.equal(await h.sd.load(), null);
    assert.equal(h.sd.exportPack(), false);
  });

  it("erase 存储失败明确 reject 且保留状态，重试成功后才清空", async () => {
    const h = createHarness();
    await h.sd.save(makePayload());
    const previousEnvelope = h.sd.lastEnvelope;
    const previousPayload = h.sd.lastPayload;
    const key = h.storage.getItem(keyKey());
    h.storage.eraseBlocked = true;
    await assert.rejects(h.sd.erase(), /擦除失败/);
    assert.equal(h.sd.lastEnvelope, previousEnvelope);
    assert.equal(h.sd.lastPayload, previousPayload);
    assert.equal(h.sd.status().hasPack, true);
    assert.equal(h.sd.status().persisted, true);
    assert.notEqual(h.storage.getItem(packKey()), null);
    h.storage.eraseBlocked = false;
    assert.equal(await h.sd.erase(), true);
    assert.equal(h.sd.status().bytes, 0);
    assert.equal(h.sd.status().persisted, false);
    assert.equal(h.storage.getItem(keyKey()), key);
    assert.equal((await h.sd.save(makePayload())).persisted, true);
  });
});

describe("SpatialMemory 原行为", () => {
  it("继续暴露 RF.SpatialMemory 与 RF.SDCard，并保留感知、排序、校验和纠正行为", () => {
    const { RF } = createHarness();
    assert.equal(typeof RF.SDCard, "function");
    const memory = new RF.SpatialMemory();
    const obj = {
      id: "cup",
      name: "蓝色杯子",
      category: "杯子",
      aliases: ["水杯"],
      colorName: "蓝色",
      currentPos: [1, 0, 2],
      furniture: "桌子",
    };
    const touched = memory.ingest("客厅", 0, [obj]);
    assert.equal(touched.length, 1);
    assert.equal(memory.get("cup").confidence, 0.8);
    memory.touch("cup");
    assert.ok(memory.get("cup").confidence > 0.8);
    const ranked = memory.score({ raw: "找蓝色杯子", nameTerms: ["杯子"], colors: ["蓝色"] });
    assert.equal(ranked[0].record.object_id, "cup");
    assert.ok(ranked[0].score > 0.8);
    assert.equal(memory.verify("cup", [9, 0, 9], "客厅").ok, false);
    assert.equal(memory.get("cup").status, "stale");
    memory.correct("cup", [3, 0, 4], "卧室", 1, "床头柜");
    assert.equal(memory.get("cup").confidence, 0.9);
    assert.equal(memory.verify("cup", [3, 0, 4], "卧室").ok, true);
    memory.setEnabled(false);
    const snapshot = memory.snapshot();
    assert.equal(snapshot.enabled, false);
    assert.equal(snapshot.layoutId, "A");
    assert.equal(snapshot.count, 1);
    assert.deepEqual(Array.from(snapshot.objects.cup.pos), [3, 0, 4]);
    snapshot.objects.cup.pos[0] = 100;
    assert.equal(memory.get("cup").pos[0], 3);
    memory.reset();
    assert.equal(memory.all().length, 0);
  });
});
