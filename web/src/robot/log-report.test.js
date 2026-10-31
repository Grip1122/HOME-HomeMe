// 事件 → /log 请求体的映射。指令字段只从 plan 按 index 回填，不从 task:step 的事件载荷拼。
// 理由：executor 的 task:step.target 是 s.target ?? s.room ?? null，会把 drop 的 to 与 observe 的 room 丢掉；
// 而 #13 的 /log 要求每条执行记录是"计划指令的完整字段 + result"，且必须按序等于计划前缀。
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createSimContext } from './testkit.js';
import { drive } from '../core/sim.js';
import { collectTaskLog, toLogPayload } from './log-report.js';

const layout = JSON.parse(readFileSync(new URL('../../public/layouts/layout_A.json', import.meta.url), 'utf-8'));

const chain = (to) => ({
  say: '好的',
  source: 'script',
  steps: [
    { action: 'find', target: 'cup_red' },
    { action: 'grab', target: 'cup_red' },
    { action: 'drop', target: 'cup_red', to },
  ],
});

describe('collectTaskLog → toLogPayload', () => {
  it('成功链路：三步全 succeeded，指令完整取自 plan（drop 保留 to）', async () => {
    const ctx = createSimContext(layout, { start: [-1.5, 0] });
    const rec = collectTaskLog(ctx.bus, 'task-ok');
    const plan = chain('table_coffee');
    const result = await drive(ctx.ticker, ctx.executor.submitPlan(plan, { taskId: 'task-ok', query: '把红杯子放到茶几上' }));

    const payload = toLogPayload(rec, { layoutId: 'A', plan, result });
    expect(payload.steps).toEqual([
      { action: 'find', target: 'cup_red', result: 'succeeded' },
      { action: 'grab', target: 'cup_red', result: 'succeeded' },
      { action: 'drop', target: 'cup_red', to: 'table_coffee', result: 'succeeded' },
    ]);
    expect(payload.plan).toEqual(plan);
    expect(payload.layout_id).toBe('A');
    expect(payload.query).toBe('把红杯子放到茶几上');
    expect(payload.memory_enabled).toBe(true);
    expect(payload.robot).toEqual({ holding: null });
    expect(payload.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('失败链路：末步 failed 且必须是最后一项，失败前的步骤保持 succeeded', async () => {
    const ctx = createSimContext(layout, { start: [-1.5, 0] });
    const rec = collectTaskLog(ctx.bus, 'task-fail');
    const plan = chain('sofa');
    const result = await drive(ctx.ticker, ctx.executor.submitPlan(plan, { taskId: 'task-fail', query: '放到沙发上' }));

    const payload = toLogPayload(rec, { layoutId: 'A', plan, result });
    expect(payload.steps.map((s) => s.result)).toEqual(['succeeded', 'succeeded', 'failed']);
    expect(payload.steps[2]).toEqual({ action: 'drop', target: 'cup_red', to: 'sofa', result: 'failed' });
    expect(rec.ok).toBe(false);
  });

  it('取消链路：末步 cancelled，长度小于计划，未执行的步骤不计入', async () => {
    const ctx = createSimContext(layout, { start: [-1.5, 0] });
    const rec = collectTaskLog(ctx.bus, 'task-cancel');
    let fired = false;
    const plan = chain('table_coffee');
    const result = await drive(ctx.ticker, ctx.executor.submitPlan(plan, { taskId: 'task-cancel', query: '取消' }), {
      onFrame: () => {
        if (!fired && ctx.ticker.time > 0.3) { fired = true; ctx.executor.cancel(); }
      },
    });

    expect(result).toMatchObject({ ok: false, reason: 'cancelled' });
    const payload = toLogPayload(rec, { layoutId: 'A', plan, result });
    expect(rec.ok).toBe(false);
    expect(payload.steps.length).toBeLessThan(plan.steps.length);
    expect(payload.steps.at(-1).result).toBe('cancelled');
    expect(payload.steps.at(-1)).toMatchObject({ action: plan.steps[payload.steps.length - 1].action });
    for (const s of payload.steps.slice(0, -1)) expect(s.result).toBe('succeeded');
  });

  it('乱序/他人的 taskId 不串台', async () => {
    const ctx = createSimContext(layout, { start: [-1.5, 0] });
    const mine = collectTaskLog(ctx.bus, 'mine');
    const other = collectTaskLog(ctx.bus, 'other');
    const plan = chain('table_coffee');
    const result = await drive(ctx.ticker, ctx.executor.submitPlan(plan, { taskId: 'mine', query: 'a' }));
    expect(toLogPayload(mine, { layoutId: 'A', plan, result }).steps).toHaveLength(3);
    expect(other.task).toBe(null);
    expect(() => toLogPayload(other, { layoutId: 'A', plan, result })).toThrow(/task:end/);
  });

  it('执行器抛错（未知家具 table_x）：当前步标 failed，不伪造成功', async () => {
    const ctx = createSimContext(layout, { start: [-1.5, 0] });
    const rec = collectTaskLog(ctx.bus, 'task-throw');
    const plan = chain('table_x');
    await expect(drive(ctx.ticker, ctx.executor.submitPlan(plan, { taskId: 'task-throw', query: 'x' }))).rejects.toThrow('未知家具');

    const payload = toLogPayload(rec, { layoutId: 'A', plan, result: { ok: false, reason: 'error' } });
    expect(payload.steps.map((s) => s.result)).toEqual(['succeeded', 'succeeded', 'failed']);
    expect(payload.steps[2]).toMatchObject({ action: 'drop', to: 'table_x' });
  });

  it('全部步骤成功后才取消（庆祝等待中）：不追加不存在的步骤', async () => {
    const ctx = createSimContext(layout, { start: [-1.5, 0] });
    const rec = collectTaskLog(ctx.bus, 'task-late');
    const plan = chain('table_coffee');
    let fired = false;
    const result = await drive(ctx.ticker, ctx.executor.submitPlan(plan, { taskId: 'task-late', query: 'late' }), {
      onFrame: () => {
        if (!fired && ctx.bus.log.some((e) => e.name === 'task:step' && e.payload.index === 2)) { fired = true; ctx.executor.cancel(); }
      },
    });
    const payload = toLogPayload(rec, { layoutId: 'A', plan, result });
    expect(result).toMatchObject({ ok: false, reason: 'cancelled' });
    expect(payload.steps.map((s) => s.result)).toEqual(['succeeded', 'succeeded', 'succeeded']);
  });

  it('holding 取任务开始时的值，交给 #13 校验计划前置条件', async () => {
    const ctx = createSimContext(layout, { start: [-1.5, 0] });
    const rec = collectTaskLog(ctx.bus, 'h');
    const plan = chain('table_coffee');
    const result = await drive(ctx.ticker, ctx.executor.submitPlan(plan, { taskId: 'h', query: 'h' }));
    expect(toLogPayload(rec, { layoutId: 'A', plan, result, holding: 'cup_red' }).robot).toEqual({ holding: 'cup_red' });
  });
});
