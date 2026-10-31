// 用真实执行器（buildWorld + layout_A）跑出成功/失败/取消三份 /log 请求体，写到 stdout 的 JSON。
// 用法：node web/scripts/log-e2e/emit-payloads.mjs > payloads.json
import { readFileSync } from 'node:fs';
import { createSimContext } from '../../src/robot/testkit.js';
import { drive } from '../../src/core/sim.js';
import { collectTaskLog, toLogPayload } from '../../src/robot/log-report.js';

const layout = JSON.parse(readFileSync(new URL('../../public/layouts/layout_A.json', import.meta.url), 'utf-8'));

const chain = {
  say: '好的',
  source: 'script',
  steps: [
    { action: 'find', target: 'cup_red' },
    { action: 'grab', target: 'cup_red' },
    { action: 'drop', target: 'cup_red', to: 'table_coffee' },
  ],
};
const findOnly = { say: '找找', source: 'script', steps: [{ action: 'find', target: 'cup_red' }] };

async function run(name, plan, { query, setup, onFrame } = {}) {
  const ctx = createSimContext(layout, { start: [-1.5, 0] });
  if (setup) setup(ctx);
  const rec = collectTaskLog(ctx.bus, name);
  const result = await drive(ctx.ticker, ctx.executor.submitPlan(plan, { taskId: name, query }), { onFrame: onFrame?.(ctx) });
  rec.stop();
  return { result, payload: toLogPayload(rec, { layoutId: 'A', plan, result }) };
}

const ok = await run('e2e-ok', chain, { query: '把红杯子放到茶几上' });
const fail = await run('e2e-fail', findOnly, {
  query: '找红杯子',
  setup: (ctx) => {
    const cup = ctx.world.getObject('cup_red');
    cup.parent.remove(cup);
    ctx.world.objects.delete('cup_red');
  },
});
const cancel = await run('e2e-cancel', chain, {
  query: '取消',
  onFrame: (ctx) => {
    let fired = false;
    return () => { if (!fired && ctx.ticker.time > 0.3) { fired = true; ctx.executor.cancel(); } };
  },
});

process.stdout.write(JSON.stringify({
  ok: { reason: ok.result.reason ?? null, ok: ok.result.ok, payload: ok.payload },
  fail: { reason: fail.result.reason ?? null, ok: fail.result.ok, payload: fail.payload },
  cancel: { reason: cancel.result.reason ?? null, ok: cancel.result.ok, payload: cancel.payload },
}));
