import { describe, it, expect } from 'vitest';
import { createEventBus } from './eventbus.js';
import { createStateMachine, TRANSITIONS, reachableFrom, deadEnds } from './statemachine.js';

const make = () => {
  const bus = createEventBus({ now: () => 0 });
  return { bus, sm: createStateMachine({ bus }) };
};

describe('statemachine', () => {
  it('合法转移更新状态，并派发 robot:state 带 from/to/step/taskId', () => {
    const { bus, sm } = make();
    sm.transition('thinking', { step: 0, taskId: 't1' });
    expect(sm.state).toBe('thinking');
    expect(bus.log.at(-1)).toMatchObject({ name: 'robot:state', payload: { from: 'idle', to: 'thinking', step: 0, taskId: 't1' } });
  });

  it('非法转移抛错、记录在 illegal 里，且状态与事件日志都不变', () => {
    const { bus, sm } = make();
    expect(() => sm.transition('picking')).toThrow(/非法状态转移: idle -> picking/);
    expect(sm.state).toBe('idle');
    expect(sm.illegal).toEqual([{ from: 'idle', to: 'picking', step: null, taskId: null }]);
    expect(bus.log).toHaveLength(0);
  });

  it('不存在的目标状态同样按非法转移处理', () => {
    const { sm } = make();
    expect(() => sm.transition('dancing')).toThrow(/非法状态转移/);
  });

  it('未知初始状态拒绝创建', () => {
    const bus = createEventBus({ now: () => 0 });
    expect(() => createStateMachine({ bus, initial: 'flying' })).toThrow(RangeError);
  });

  it('没有任何状态是死锁（每个状态都有出边）', () => {
    expect(deadEnds(TRANSITIONS)).toEqual([]);
  });

  it('从 idle 出发能到达全部 8 个状态（含 celebrating）', () => {
    const reach = reachableFrom(TRANSITIONS, 'idle');
    expect([...reach].sort()).toEqual(Object.keys(TRANSITIONS).sort());
  });

  it('检查器自己会报警：构造一张 celebrating 无入边的表，可达性检查必须抓到', () => {
    const broken = { ...TRANSITIONS };
    for (const k of Object.keys(broken)) broken[k] = broken[k].filter((s) => s !== 'celebrating');
    expect(reachableFrom(broken, 'idle').has('celebrating')).toBe(false);
    expect(deadEnds({ ...TRANSITIONS, confused: [] })).toEqual(['confused']);
  });
});
