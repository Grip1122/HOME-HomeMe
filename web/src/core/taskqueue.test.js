import { describe, it, expect } from 'vitest';
import { createTaskQueue } from './taskqueue.js';

// 不用 sleep 断言：用手动放行的 Promise 控制任务何时结束。
function gate() {
  let open;
  const p = new Promise((r) => { open = r; });
  return { p, open };
}

describe('taskqueue', () => {
  it('空闲时提交成功，返回任务结果，结束后不再忙', async () => {
    const q = createTaskQueue();
    const r = await q.submit(async () => 42);
    expect(r).toEqual({ ok: true, value: 42 });
    expect(q.busy).toBe(false);
  });

  it('执行中连点十次，只有第一次执行，其余九次被拒绝为 busy', async () => {
    const q = createTaskQueue();
    const g = gate();
    let runs = 0;
    const first = q.submit(async () => { runs += 1; await g.p; return 'done'; });
    const rest = await Promise.all(Array.from({ length: 9 }, () => q.submit(async () => { runs += 1; })));
    expect(rest.every((r) => r.ok === false && r.reason === 'busy')).toBe(true);
    g.open();
    expect(await first).toEqual({ ok: true, value: 'done' });
    expect(runs).toBe(1);
  });

  it('任务中途抛错后锁仍被释放，下一次提交能正常进入', async () => {
    const q = createTaskQueue();
    await expect(q.submit(async () => { throw new Error('动画炸了'); })).rejects.toThrow('动画炸了');
    expect(q.busy).toBe(false);
    const r = await q.submit(async () => 'ok');
    expect(r).toEqual({ ok: true, value: 'ok' });
  });

  it('cancel 会让当前任务收到 abort 信号；没有任务时返回 false', async () => {
    const q = createTaskQueue();
    expect(q.cancel()).toBe(false);
    const g = gate();
    let aborted = null;
    const p = q.submit(async (signal) => {
      signal.addEventListener('abort', () => { aborted = true; g.open(); });
      await g.p;
      return signal.aborted;
    });
    expect(q.cancel()).toBe(true);
    expect(await p).toEqual({ ok: true, value: true });
    expect(aborted).toBe(true);
    expect(q.busy).toBe(false);
  });

  it('提交的不是函数时抛 TypeError，且不占用锁', async () => {
    const q = createTaskQueue();
    await expect(q.submit('not a fn')).rejects.toThrow(TypeError);
    expect(q.busy).toBe(false);
  });
});
