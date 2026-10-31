import { EVENT_NAMES, THROTTLE_MS } from './config.js';

// 载荷只许是纯 JSON：函数、符号、three.js 对象等类实例一律拒绝（契约 6.2）。
function assertPlain(payload) {
  JSON.stringify(payload, (key, v) => {
    if (typeof v === 'function' || typeof v === 'symbol') throw new TypeError(`载荷含不可序列化值: ${key}`);
    if (v && typeof v === 'object') {
      const p = Object.getPrototypeOf(v);
      if (p !== Object.prototype && p !== Array.prototype && p !== null) throw new TypeError(`载荷含非纯对象: ${key}`);
    }
    return v;
  });
}

export function createEventBus({ now = () => performance.now(), maxLog = 5000 } = {}) {
  const handlers = new Map(EVENT_NAMES.map((n) => [n, new Set()]));
  const lastAt = new Map();
  const log = [];
  const check = (name) => {
    if (!handlers.has(name)) throw new RangeError(`未声明的事件: ${name}`);
  };
  return {
    log,
    on(name, fn) {
      check(name);
      handlers.get(name).add(fn);
      return () => handlers.get(name).delete(fn);
    },
    /** 返回 true 表示已派发，false 表示被节流丢弃。 */
    emit(name, payload = {}) {
      check(name);
      assertPlain(payload);
      const t = now();
      if (name in THROTTLE_MS) {
        const prev = lastAt.has(name) ? lastAt.get(name) : -Infinity;
        if (t - prev < THROTTLE_MS[name]) return false;
        lastAt.set(name, t);
      }
      log.push({ t, name, payload: JSON.parse(JSON.stringify(payload)) });
      if (log.length > maxLog) log.shift();
      for (const fn of [...handlers.get(name)]) fn(payload);
      return true;
    },
  };
}
