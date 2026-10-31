import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import * as THREE from 'three';
import { createRestaurantScene } from '../scene/restaurant-scene.js';
import { createEventBus } from '../core/eventbus.js';
import { createStateMachine } from '../core/statemachine.js';
import { createTicker } from '../core/ticker.js';
import { createTaskQueue } from '../core/taskqueue.js';
import { createLocalMemory } from '../core/memory.js';
import { drive } from '../core/sim.js';
import { createRobot } from '../robot/robot.js';
import { createExecutor } from '../robot/executor.js';
import { buildGrid } from '../nav/route.js';
import { createProductLoop } from './loop.js';

const read = (p) => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const layout = read('../../public/layouts/layout_restaurant.json');
const semantics = read('../../public/scene-data/restaurant_semantics.json');
const PLAN = { say: '好的', source: 'cache', steps: [
  { action: 'find', target: 'cup_red' }, { action: 'grab', target: 'cup_red' },
  { action: 'drop', target: 'cup_red', to: 'table_03' },
] };

function setup({ planFails = false, logFails = 0 } = {}) {
  const world = createRestaurantScene({ THREE, layout, semantics });
  const ticker = createTicker();
  const bus = createEventBus({ now: () => ticker.time * 1000 });
  const robot = createRobot({ root: new THREE.Group() });
  const s = layout.rooms[0].scan_point;
  robot.setPose(s[0], s[2], 0);
  world.root.add(robot.group);
  const ctx = { world, layout, ticker, bus, robot, grid: buildGrid(layout), sm: createStateMachine({ bus }),
    memory: createLocalMemory({ bus, enabled: false }), holding: null, handBusy: false, options: {} };
  ctx.executor = createExecutor(ctx, createTaskQueue());
  const calls = { plan: 0, log: [] };
  let logFail = logFails;
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    if (url.endsWith('/plan')) {
      calls.plan++;
      if (planFails) return new Response('boom', { status: 500 });
      return new Response(JSON.stringify(PLAN), { status: 200 });
    }
    calls.log.push(body);
    if (logFail-- > 0) return new Response('{"detail":"db down"}', { status: 503 });
    return new Response(JSON.stringify({ id: calls.log.length }), { status: 200 });
  };
  const logs = [];
  const loop = createProductLoop({ ctx, layoutId: layout.layout_id, fetchImpl, onLog: (e) => logs.push(e) });
  return { ctx, world, loop, calls, logs };
}

describe('产品闭环（真实执行器 + 餐厅场景）', () => {
  it('成功：find→grab→drop 落到 3 号桌，/log 记录三步 succeeded', async () => {
    const { ctx, world, loop, calls, logs } = setup();
    const r = await drive(ctx.ticker, loop.run('帮我把红色水杯放到3号桌上'), { maxSeconds: 600 });
    expect(r.ok).toBe(true);
    expect(world.getObject('cup_red').parent).toBe(world.getFurniture('table_03'));
    expect(ctx.holding).toBe(null);
    expect(calls.log).toHaveLength(1);
    expect(calls.log[0].steps.map((s) => s.result)).toEqual(['succeeded', 'succeeded', 'succeeded']);
    expect(calls.log[0].layout_id).toBe('restaurant_candidate_v1');
    expect(logs[0].ok).toBe(true);
  });

  it('后端 /plan 失败：派发 plan:rejected，执行器不动，不写日志', async () => {
    const { ctx, loop, calls } = setup({ planFails: true });
    const rejected = [];
    ctx.bus.on('plan:rejected', (p) => rejected.push(p));
    const r = await loop.run('帮我把红色水杯放到3号桌上');
    expect(r.ok).toBe(false);
    expect(rejected[0].reason).toMatch(/HTTP 500/);
    expect(calls.log).toHaveLength(0);
    expect(ctx.bus.log.some((e) => e.name === 'task:start')).toBe(false);
  });

  it('/log 失败可见且可重试，同一任务不会重复写入', async () => {
    const { ctx, loop, calls, logs } = setup({ logFails: 1 });
    const r = await drive(ctx.ticker, loop.run('帮我把红色水杯放到3号桌上'), { maxSeconds: 600 });
    expect(r.log.ok).toBe(false);
    expect(logs[0]).toMatchObject({ ok: false });
    const again = await loop.retryLog(r.taskId, r.log.payload);
    expect(again.ok).toBe(true);
    const dup = await loop.retryLog(r.taskId, r.log.payload);
    expect(dup.duplicate).toBe(true);
    expect(calls.log.filter((b) => b.query === r.log.payload.query)).toHaveLength(2);
  });

  for (const phase of ['picking', 'placing']) {
    it(`取消于 ${phase}：归属、holding、锁、终态一致，日志末项 cancelled`, async () => {
      const { ctx, world, loop, calls } = setup();
      ctx.bus.on('robot:state', ({ to }) => { if (to === phase) ctx.executor.cancel(); });
      const ends = [];
      ctx.bus.on('task:end', (p) => ends.push(p));
      const r = await drive(ctx.ticker, loop.run('帮我把红色水杯放到3号桌上'), { maxSeconds: 600 });
      expect(r.result.reason).toBe('cancelled');
      expect(ends).toHaveLength(1);
      expect(ends[0].ok).toBe(false);
      const cup = world.getObject('cup_red');
      expect(ctx.holding).toBe('cup_red');
      expect(cup.parent).toBe(ctx.robot.carryAnchor);
      expect(ctx.handBusy).toBe(false);
      expect(ctx.sm.state).toBe('idle');
      expect(loop.busy).toBe(false);
      const steps = calls.log[0].steps;
      expect(calls.log[0].robot).toEqual({ holding: null });
      expect(steps.at(-1).result).toBe('cancelled');
      expect(steps.at(-1).action).toBe(phase === 'picking' ? 'grab' : 'drop');
    });
  }
});
