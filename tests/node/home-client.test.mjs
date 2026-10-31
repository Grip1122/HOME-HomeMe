import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHomeClient } from '../../server/client/home-client.mjs';

function fixture(run) {
  const handlers = new Set();
  const calls = [];
  const entries = new Map();
  const plan = { say: '收到', source: 'rule', steps: [{ action: 'find', target: 'cup_red' }] };
  const ctx = {
    layout: { layout_id: 'restaurant_candidate_v1' }, robot: { pos: [0, 0, 0] }, holding: null,
    bus: { on(_, fn) { handlers.add(fn); return () => handlers.delete(fn); } },
    memory: { enabled: true, entries, upsert(seen) {
      for (const item of seen) entries.set(item.id, { object_id: item.id, pos: item.pos, room: item.room, confidence: .8 });
    }, hit() {}, miss() {} },
  };
  const emit = event => { for (const fn of handlers) fn(event); };
  ctx.executor = { submitPlan: p => run(ctx, p, emit), cancel() {} };
  let memory = [];
  let failPath;
  const fetchImpl = async (url, options) => {
    const path = new URL(url, 'http://local').pathname.replace('/api', '');
    const body = options.body ? JSON.parse(options.body) : undefined;
    calls.push({ path, body });
    if (path === failPath) return { ok: false, status: 503, json: async () => ({ detail: 'unavailable' }) };
    let value = {};
    if (path === '/memory') value = memory;
    if (path === '/plan') value = plan;
    if (path === '/memory/observe') memory = body.entries.map(e => ({ ...e, confidence: .8, layout_id: body.layout_id, source: 'observe', status: 'fresh', updated_at: 'now' }));
    if (path === '/log') value = { id: 1 };
    return { ok: true, json: async () => value };
  };
  return { ctx, plan, calls, handlers, client: createHomeClient(ctx, { fetchImpl }), fail(path) { failPath = path; } };
}

test('observations use HTTP, request memory is projected, and logs use executed steps', async () => {
  const f = fixture(async (ctx, plan, emit) => {
    ctx.memory.upsert([{ id: 'cup_red', room: 'restaurant', pos: [1, .75, 2] }]);
    emit({ action: 'find', ok: true });
    return { ok: true };
  });
  assert.equal((await f.client.run('找水杯')).ok, true);
  assert.equal((await f.client.run('找水杯')).ok, true);
  const requests = f.calls.filter(c => c.path === '/plan');
  assert.deepEqual(Object.keys(requests[1].body.memory[0]).sort(), ['confidence', 'object_id', 'pos', 'room']);
  assert.equal(f.calls.find(c => c.path === '/memory/observe').body.layout_id, 'restaurant_candidate_v1');
  const log = f.calls.find(c => c.path === '/log').body;
  assert.equal(log.ok, true);
  assert.deepEqual(log.steps, [{ action: 'find', target: 'cup_red', result: 'succeeded' }]);
  assert.equal(f.handlers.size, 0);
});

test('executor failure writes ok=false and never counts unexecuted instructions as success', async () => {
  const f = fixture(async (_, plan, emit) => {
    emit({ action: plan.steps[0].action, ok: false });
    return { ok: false, reason: 'no_path' };
  });
  f.plan.steps.push({ action: 'grab', target: 'cup_red' });
  assert.equal((await f.client.run('拿水杯')).ok, false);
  const log = f.calls.find(c => c.path === '/log').body;
  assert.equal(log.ok, false);
  assert.equal(log.steps.length, 1);
  assert.equal(log.steps[0].result, 'failed');
});

test('corrective drop calls memory/correct once and does not also observe the same object', async () => {
  const f = fixture(async (ctx, plan, emit) => {
    ctx.memory.upsert([{ id: 'cup_red', room: 'restaurant', pos: [1, .75, 2] }]);
    emit({ action: 'drop', ok: true });
    return { ok: true };
  });
  Object.assign(f.plan, { source: 'corrective', corrected: true, corrected_object: 'cup_red', corrected_to: 'table_02',
    steps: [{ action: 'drop', target: 'cup_red', to: 'table_02' }] });
  await f.client.run('不对，放二号餐桌');
  assert.equal(f.calls.filter(c => c.path === '/memory/correct').length, 1);
  assert.equal(f.calls.filter(c => c.path === '/memory/observe').length, 0);
});

test('concurrent calls are rejected and cancellation still writes its log', async () => {
  let started;
  let complete;
  const ready = new Promise(resolve => { started = resolve; });
  const f = fixture(async () => { started(); return new Promise(resolve => { complete = resolve; }); });
  f.ctx.executor.cancel = () => complete({ ok: false, reason: 'cancelled' });
  const controller = new AbortController();
  const first = f.client.run('找水杯', { signal: controller.signal });
  await ready;
  assert.deepEqual(await f.client.run('找钥匙'), { ok: false, reason: 'busy' });
  controller.abort();
  assert.equal((await first).ok, false);
  const log = f.calls.find(c => c.path === '/log').body;
  assert.equal(log.ok, false);
  assert.equal(log.steps[0].result, 'cancelled');
  assert.equal(f.client.busy, false);
  assert.equal(f.handlers.size, 0);
});

test('memory errors stay visible, produce a failure log, and release the lock', async () => {
  const f = fixture(async (ctx, _, emit) => {
    ctx.memory.upsert([{ id: 'cup_red', room: 'restaurant', pos: [1, .75, 2] }]);
    emit({ action: 'find', ok: true });
    return { ok: true };
  });
  f.fail('/memory/observe');
  await assert.rejects(f.client.run('找水杯'), /HTTP 503/);
  assert.equal(f.calls.find(c => c.path === '/log').body.ok, false);
  assert.equal(f.client.busy, false);
});

test('planning and log HTTP failures stay visible and release the lock', async () => {
  const f = fixture(async (_, plan, emit) => { emit({ action: plan.steps[0].action, ok: true }); return { ok: true }; });
  f.fail('/plan');
  await assert.rejects(f.client.run('找水杯'), /HTTP 503/);
  assert.equal(f.calls.filter(c => c.path === '/log').length, 0);
  assert.equal(f.client.busy, false);
  f.fail('/log');
  await assert.rejects(f.client.run('找水杯'), /HTTP 503/);
  assert.equal(f.client.busy, false);
});
