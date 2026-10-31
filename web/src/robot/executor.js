// 执行器：把一份 plan（contracts/plan.schema.json 的 steps 数组）交给任务队列串行执行。
// 外部只能调用 submitPlan 入队，不能直接改状态（任务书三条规则之一）。
// corrective 计划不加任何特殊逻辑，只多派发一次 plan:corrected（步骤 3.4）。
import { CELEBRATE_SECONDS, CONFUSED_SECONDS } from '../core/config.js';
import { isAbort } from '../core/ticker.js';
import { ACTIONS } from './actions.js';

let seq = 0;

export function createExecutor(ctx, queue) {
  async function run(plan, signal, taskId) {
    const { bus, sm, ticker } = ctx;
    const t0 = ticker.time;
    const steps = plan.steps ?? [];
    const corrected = plan.source === 'corrective';
    let done = 0;
    let ok = true;
    let reason = null;
    try {
      sm.moveTo('thinking', { taskId });
      if (corrected) bus.emit('plan:corrected', { taskId });
      if (plan.say) bus.emit('task:say', { text: plan.say, who: 'robot' });
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        const fn = ACTIONS[s.action];
        if (!fn) throw new RangeError(`未知动作: ${s.action}`);
        const s0 = ticker.time;
        const r = await fn(ctx, s, { signal, step: i, taskId });
        bus.emit('task:step', {
          taskId, index: i, action: s.action, target: s.target ?? s.room ?? null,
          ok: !!r.ok, ms: Math.round((ticker.time - s0) * 1000),
        });
        done = i + 1;
        if (!r.ok) { ok = false; reason = r.reason; break; }
      }
      if (ok) {
        sm.moveTo('celebrating', { taskId });
        await ticker.wait(CELEBRATE_SECONDS, signal);
      } else {
        sm.moveTo('confused', { taskId });
        await ticker.wait(CONFUSED_SECONDS, signal);
      }
      sm.moveTo('idle', { taskId });
    } catch (e) {
      ok = false;
      reason = isAbort(e) ? 'cancelled' : 'error';
      sm.recover({ taskId });
      if (!isAbort(e)) throw e;
    } finally {
      bus.emit('task:end', { taskId, ok, steps: done, durationMs: Math.round((ticker.time - t0) * 1000), corrected });
    }
    return { ok, reason, steps: done };
  }

  return {
    /** 入队。忙时返回 {ok:false, reason:'busy'}，不执行。 */
    submitPlan(plan, { query = '', taskId = `t${++seq}` } = {}) {
      if (queue.busy) return Promise.resolve({ ok: false, reason: 'busy' });
      ctx.bus.emit('task:start', { taskId, query, source: plan.source ?? 'script' });
      return queue.submit((signal) => run(plan, signal, taskId)).then((r) => (r.ok ? r.value : r));
    },
    cancel: () => queue.cancel(),
  };
}
