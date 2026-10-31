// 接线层：把 EventBus 上一次任务的事件整理成 POST /log 的请求体（server/HTTP_API.md，PR #13）。
// 指令字段只从 plan 按 index 回填；事件只提供结果与耗时。不改 contracts/，不新增事件。

export function collectTaskLog(bus, taskId) {
  const rec = { taskId, task: null, steps: [], end: null, get ok() { return this.end ? this.end.ok : null; } };
  const offs = [
    bus.on('task:start', (p) => { if (p.taskId === taskId) rec.task = p; }),
    bus.on('task:step', (p) => { if (p.taskId === taskId) rec.steps.push(p); }),
    bus.on('task:end', (p) => { if (p.taskId === taskId) rec.end = p; }),
  ];
  rec.stop = () => offs.forEach((off) => off());
  return rec;
}

export function toLogPayload(rec, { layoutId, plan, result, holding = null, memoryEnabled = true }) {
  if (!rec.end) throw new Error('任务尚未结束：缺少 task:end，不上报');
  if (!rec.task) throw new Error('缺少 task:start，无法确定 query');
  const planSteps = plan.steps ?? [];

  const records = rec.steps.map((ev, i) => {
    const instruction = planSteps[i];
    if (!instruction || ev.index !== i || ev.action !== instruction.action) {
      throw new Error(`task:step 与计划不一致（第 ${i} 条）：事件 ${ev.action}#${ev.index}，计划 ${instruction?.action}`);
    }
    return { ...instruction, result: ev.ok ? 'succeeded' : 'failed' };
  });
  if (rec.end.steps !== records.length) {
    throw new Error(`task:end.steps=${rec.end.steps} 与已收到的 task:step 数 ${records.length} 不一致`);
  }

  // 被中断/抛错的那一步不会发 task:step，按执行结果补一条终态记录；已 failed 或步骤已全部完成则不补。
  const interrupted = result?.reason === 'cancelled' ? 'cancelled' : result?.reason === 'error' ? 'failed' : null;
  if (interrupted && records.at(-1)?.result !== 'failed' && records.length < planSteps.length) {
    records.push({ ...planSteps[records.length], result: interrupted });
  }

  return {
    layout_id: layoutId,
    query: rec.task.query,
    plan: JSON.parse(JSON.stringify(plan)),
    steps: records,
    duration_ms: rec.end.durationMs,
    memory_enabled: memoryEnabled,
    robot: { holding },
  };
}
