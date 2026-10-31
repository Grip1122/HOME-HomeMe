// 本地记忆桩：只服务离线演示与单元测试。置信度六条规则与 server/app/memory.py 逐条一致；
// 步骤 3.3 起后端是唯一真值，届时由记忆客户端替换本模块，接口（get/upsert/hit/miss）保持不变。
import { MEMORY, MEMORY_MOVED_EPS } from './config.js';

const r2 = (x) => Math.round(Math.max(0, Math.min(1, x)) * 100) / 100;

export function createLocalMemory({ bus = null, enabled = true } = {}) {
  const entries = new Map();
  const emitUpdated = (e) => bus && bus.emit('memory:updated', { objectId: e.object_id, room: e.room, confidence: e.confidence, status: e.status });
  return {
    enabled,
    entries,
    get(id) { return entries.get(id) ?? null; },
    usable(id) {
      const e = entries.get(id);
      return !!e && e.confidence >= MEMORY.MIN_USABLE;
    },
    /** 观察结果入库：首次看到或位置变了 → 0.80（fresh）；位置没变 → 不动。 */
    upsert(seen) {
      for (const s of seen) {
        const old = entries.get(s.id);
        const moved = old && Math.hypot(old.pos[0] - s.pos[0], old.pos[2] - s.pos[2]) > MEMORY_MOVED_EPS;
        if (old && !moved) continue;
        const e = { object_id: s.id, room: s.room, pos: [...s.pos], confidence: MEMORY.OBSERVE, status: 'fresh' };
        entries.set(s.id, e);
        emitUpdated(e);
      }
    },
    hit(id) {
      const e = entries.get(id);
      if (!e) throw new RangeError(`记忆里没有 ${id}`);
      e.confidence = r2(e.confidence + MEMORY.HIT);
      if (bus) bus.emit('memory:hit', { objectId: id, confidence: e.confidence });
      emitUpdated(e);
    },
    miss(id) {
      const e = entries.get(id);
      if (!e) throw new RangeError(`记忆里没有 ${id}`);
      e.confidence = r2(e.confidence - MEMORY.MISS);
      e.status = 'stale';
      if (bus) bus.emit('memory:miss', { objectId: id, confidence: e.confidence });
      emitUpdated(e);
    },
  };
}
