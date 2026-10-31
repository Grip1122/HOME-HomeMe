/** Live socket test with A's real Three.js actions, A* and task queue. No mocked executor. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createHomeClient } from '../../server/client/home-client.mjs';

const [base, executorRoot, fixturePath] = process.argv.slice(2);
const moduleAt = path => import(pathToFileURL(`${executorRoot}/web/src/${path}`).href);
const { createSimContext } = await moduleAt('robot/testkit.js');
const { drive } = await moduleAt('core/sim.js');
const layout = JSON.parse(await readFile(fixturePath, 'utf8'));
const ctx = createSimContext(layout, { start: [layout.rooms[0].scan_point[0], layout.rooms[0].scan_point[2]], observeSeconds: .05 });
// Fast-forward animation jobs only. Advancing virtual time while waiting for real
// HTTP would turn a few hundred milliseconds of I/O into hours of simulated time.
const clock = { get time() { return ctx.ticker.time; }, update(dt) {
  if (ctx.ticker.pending) ctx.ticker.update(dt);
} };
const httpTrace = [];
const client = createHomeClient(ctx, { baseUrl: `${base}/api`, fetchImpl: async (...args) => {
  const trace = { path: args[0], state: 'pending' };
  httpTrace.push(trace);
  const response = await fetch(...args);
  trace.state = response.status;
  return response;
} });
const call = async (path, body) => {
  const response = await fetch(base + path, body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return { status: response.status, value: await response.json() };
};
const run = async query => {
  try {
    return await drive(clock, client.run(query), { maxSeconds: 600 });
  } catch (error) {
    console.error(JSON.stringify({ state: ctx.sm.state, pending: ctx.ticker.pending,
      lastEvents: ctx.bus.log.slice(-5), http: httpTrace.slice(-5) }));
    throw error;
  }
};
const objectId = 'cup_red';
const target = layout.furniture.find(f => f.id === 'table_02');
const correctedTarget = layout.furniture.find(f => f.id === 'table_01');
assert(target?.surface && correctedTarget?.surface);

assert.equal((await call('/plan', { layout_id: layout.layout_id, query: '', robot: [] })).status, 422);
const found = await run('我的红色水杯在哪');
assert.equal(found.ok, true);
assert.equal(found.plan.source, 'cache');
assert((await call(`/memory?layout_id=${layout.layout_id}`)).value.some(e => e.object_id === objectId));

const moved = await run(`帮我把红色水杯放到${target.name}`);
assert.equal(moved.ok, true);
assert.equal(moved.plan.source, 'rule');
assert.equal(ctx.holding, null);
assert.equal(ctx.world.getObject(objectId).parent, ctx.world.getFurniture(target.id));

const corrected = await run(`不对，应该放${correctedTarget.name}`);
assert.equal(corrected.ok, true);
assert.equal(corrected.plan.source, 'corrective');
assert.equal(ctx.world.getObject(objectId).parent, ctx.world.getFurniture(correctedTarget.id));
const memory = (await call(`/memory?layout_id=${layout.layout_id}`)).value.find(e => e.object_id === objectId);
assert.equal(memory.confidence, .9);
assert.equal(memory.source, 'correct');
ctx.world.worldPos(objectId).forEach((v, i) => assert(Math.abs(v - memory.pos[i]) < 1e-6));

// A real action failure: a semantic-valid object ID whose runtime mesh has vanished.
// Restore the exact mesh afterwards; never alter the authoritative layout.
const mesh = ctx.world.objects.get(objectId);
ctx.world.objects.delete(objectId);
await assert.rejects(run(`不对，应该放${target.name}`));
ctx.world.objects.set(objectId, mesh);
assert.equal((await call(`/log?layout_id=${layout.layout_id}`)).value[0].ok, false);
assert.deepEqual((await call(`/memory?layout_id=${layout.layout_id}`)).value.find(e => e.object_id === objectId), memory);

// Cancel the real A queue, with the adapter still responsible for persisting failure.
const controller = new AbortController();
const cancelTask = drive(clock, client.run('我的红色水杯在哪', { signal: controller.signal }), {
  maxSeconds: 600, onFrame() { if (ctx.sm.state === 'walking') controller.abort(); },
});
const cancelled = await cancelTask;
assert.equal(cancelled.ok, false);
assert.equal((await call(`/log?layout_id=${layout.layout_id}`)).value[0].ok, false);

const isolatedId = layout.layout_id + '_isolated';
assert.deepEqual((await call(`/memory?layout_id=${isolatedId}`)).value, []);
await call('/memory/reset', { layout_id: isolatedId });
assert((await call(`/memory?layout_id=${layout.layout_id}`)).value.length > 0);
const logs = (await call(`/log?layout_id=${layout.layout_id}`)).value;
assert(logs.some(row => row.source === 'corrective' && row.corrected === 1 && row.ok));
console.log(JSON.stringify({ layout_id: layout.layout_id, checks: ['find', 'grab', 'drop', 'corrective', 'invalid_422', 'executor_failure', 'cancelled', 'layout_isolation'], logs: logs.length }));
