import { describe, it, expect } from 'vitest';
import { createEventBus } from './eventbus.js';

function clockBus() {
  let t = 0;
  const bus = createEventBus({ now: () => t });
  return { bus, tick: (ms) => { t += ms; } };
}

describe('eventbus', () => {
  it('订阅者收到载荷，且日志里留有一份副本供回放', () => {
    const { bus } = clockBus();
    const got = [];
    bus.on('task:say', (p) => got.push(p));
    bus.emit('task:say', { text: '你好', who: 'robot' });
    expect(got).toEqual([{ text: '你好', who: 'robot' }]);
    expect(bus.log).toHaveLength(1);
    expect(bus.log[0].name).toBe('task:say');
  });

  it('robot:moved 在 100ms 内第二次派发被丢弃，满 100ms 后放行', () => {
    const { bus, tick } = clockBus();
    expect(bus.emit('robot:moved', { pos: [0, 0, 0], yaw: 0 })).toBe(true);
    tick(99);
    expect(bus.emit('robot:moved', { pos: [1, 0, 0], yaw: 0 })).toBe(false);
    tick(1);
    expect(bus.emit('robot:moved', { pos: [2, 0, 0], yaw: 0 })).toBe(true);
    expect(bus.log).toHaveLength(2);
  });

  it('一次性事件不节流：同一毫秒连发两次 robot:state 都送达', () => {
    const { bus } = clockBus();
    expect(bus.emit('robot:state', { from: 'idle', to: 'thinking', step: 0, taskId: 't' })).toBe(true);
    expect(bus.emit('robot:state', { from: 'thinking', to: 'walking', step: 0, taskId: 't' })).toBe(true);
    expect(bus.log).toHaveLength(2);
  });

  it('未声明的事件名会抛 RangeError，订阅与派发都一样', () => {
    const { bus } = clockBus();
    expect(() => bus.emit('robot:dance', {})).toThrow(RangeError);
    expect(() => bus.on('robot:dance', () => {})).toThrow(RangeError);
  });

  it('载荷含函数或类实例时抛 TypeError，且日志不留脏数据', () => {
    const { bus } = clockBus();
    class Mesh {}
    expect(() => bus.emit('task:say', { text: 'x', who: 'robot', cb() {} })).toThrow(TypeError);
    expect(() => bus.emit('task:say', { text: new Mesh(), who: 'robot' })).toThrow(TypeError);
    expect(bus.log).toHaveLength(0);
  });

  it('取消订阅后不再收到事件', () => {
    const { bus } = clockBus();
    let n = 0;
    const off = bus.on('task:say', () => { n += 1; });
    bus.emit('task:say', { text: 'a', who: 'user' });
    off();
    bus.emit('task:say', { text: 'b', who: 'user' });
    expect(n).toBe(1);
  });
});
