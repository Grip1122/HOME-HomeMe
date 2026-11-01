// 产品闭环：/plan → 真实执行器 → /log。HUD 只订阅 ctx.bus，不从这里拿任何返回值。
import { collectTaskLog, toLogPayload } from '../robot/log-report.js';

async function postJson(fetchImpl, url, body) {
  let res;
  try {
    res = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch (e) {
    throw new Error(`后端不可达：${e.message || e}`);
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) {
    const detail = data && data.detail !== undefined ? JSON.stringify(data.detail) : text.slice(0, 200);
    throw new Error(`HTTP ${res.status}：${detail}`);
  }
  return data;
}

export function createProductLoop({ ctx, layoutId, apiBase = '/api', fetchImpl = (...a) => fetch(...a), onLog = () => {} }) {
  const submitted = new Set();
  let running = null;
  let seq = 0;

  async function submitLog(taskId, payload) {
    if (submitted.has(taskId)) return { ok: true, duplicate: true };
    submitted.add(taskId);
    try {
      const r = await postJson(fetchImpl, `${apiBase}/log`, payload);
      onLog({ ok: true, taskId, id: r && r.id, payload });
      return { ok: true, id: r && r.id };
    } catch (e) {
      // 失败允许重试，但同一任务只会成功写入一次
      submitted.delete(taskId);
      onLog({ ok: false, taskId, error: e.message, payload });
      return { ok: false, error: e.message, payload };
    }
  }

  async function run(query) {
    const q = String(query || '').trim();
    if (!q) return { ok: false, reason: 'empty' };
    if (running) return { ok: false, reason: 'busy' };
    running = true;
    const { bus } = ctx;
    try {
      bus.emit('plan:request', { query: q, memoryEnabled: !!ctx.memory.enabled });
      // /log 的 robot.holding 是"规划时"的持物上下文，后端据此复核计划；不能用执行后的状态
      const holdingAtPlan = ctx.holding;
      let plan;
      try {
        plan = await postJson(fetchImpl, `${apiBase}/plan`, {
          query: q, layout_id: layoutId, memory_enabled: !!ctx.memory.enabled,
          robot: { pos: ctx.robot.pos, holding: holdingAtPlan },
        });
      } catch (e) {
        bus.emit('plan:rejected', { reason: e.message, raw: null });
        return { ok: false, reason: 'plan_failed', error: e.message };
      }
      if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
        const reason = (plan && plan.say) || '规划为空';
        bus.emit('plan:rejected', { reason, raw: plan ?? null });
        if (plan && plan.say) bus.emit('task:say', { text: plan.say, who: 'robot' });
        return { ok: false, reason: 'empty_plan', plan };
      }
      bus.emit('plan:received', { source: plan.source, steps: plan.steps, latencyMs: plan.latency_ms ?? null });

      const taskId = `p${Date.now().toString(36)}_${++seq}`;
      const rec = collectTaskLog(bus, taskId);
      let result;
      try {
        result = await ctx.executor.submitPlan(plan, { query: q, taskId });
      } catch (e) {
        result = { ok: false, reason: 'error', error: e.message };
      } finally {
        rec.stop();
      }
      if (result && result.reason === 'busy' && !rec.end) return { ok: false, reason: 'busy' };

      let payload;
      try {
        payload = toLogPayload(rec, { layoutId, plan, result, holding: holdingAtPlan, memoryEnabled: !!ctx.memory.enabled });
      } catch (e) {
        onLog({ ok: false, taskId, error: `日志映射失败：${e.message}` });
        return { ok: false, reason: 'log_map_failed', result, error: e.message };
      }
      const log = await submitLog(taskId, payload);
      return { ok: !!result.ok, taskId, result, log, plan };
    } finally {
      running = null;
    }
  }

  return {
    run,
    retryLog: submitLog,
    cancel: () => ctx.executor.cancel(),
    get busy() { return !!running; },
  };
}
