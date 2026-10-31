/** D-owned HTTP adapter for A's createExecutor/createLocalMemory interfaces.
 * A injects its context; this module never imports or replaces frontend code.
 */
export class HomeHttpError extends Error {
  constructor(path, status, detail) {
    super(`${path}: HTTP ${status}`);
    this.status = status;
    this.detail = detail;
  }
}

export function createHomeClient(ctx, { baseUrl = '/api', fetchImpl = globalThis.fetch } = {}) {
  let busy = false;
  const lastObjects = new Map();
  const base = baseUrl.replace(/\/$/, '');
  async function request(path, body, signal) {
    const response = await fetchImpl(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal,
    });
    const value = await response.json();
    if (!response.ok) throw new HomeHttpError(path, response.status, value);
    return value;
  }

  return {
    get busy() { return busy; },
    async run(query, { signal } = {}) {
      if (busy || ctx.executor.busy) return { ok: false, reason: 'busy' };
      busy = true;
      const layoutId = ctx.layout.layout_id;
      const local = ctx.memory;
      const memoryEnabled = local.enabled;
      const initialRobot = { pos: [...ctx.robot.pos], holding: ctx.holding ?? null };
      let plan;
      let pending = Promise.resolve();
      let execution;
      let failure;
      let unsubscribe;
      const steps = [];
      const started = performance.now();
      const reload = async () => {
        const entries = await request(`/memory?layout_id=${encodeURIComponent(layoutId)}`);
        local.entries.clear();
        for (const entry of entries) local.entries.set(entry.object_id, entry);
        return entries;
      };
      const enqueue = (path, body) => {
        pending = pending.then(() => request(path, { layout_id: layoutId, ...body }));
        // A's memory interface is synchronous. Failures are awaited and surfaced below.
        pending.catch(() => {});
      };
      const cancel = () => ctx.executor.cancel();
      try {
        const entries = await reload();
        plan = await request('/plan', {
          query, layout_id: layoutId, memory_enabled: memoryEnabled,
          memory: entries.map(({ object_id, room, pos, confidence }) => ({ object_id, room, pos, confidence })),
          last_object: lastObjects.get(layoutId) ?? null, robot: initialRobot,
        }, signal);
        if (!plan.steps.length) return { ok: false, reason: 'clarification', plan };
        if (signal?.aborted) throw signal.reason ?? new Error('cancelled');
        ctx.memory = {
          ...local,
          upsert(seen) {
            const previous = new Map([...local.entries].map(([id, entry]) => [id, [...entry.pos]]));
            local.upsert(seen);
            for (const item of seen) {
              const entry = { object_id: item.id, room: item.room, pos: [...item.pos] };
              const current = plan.steps[steps.length];
              if (plan.corrected && item.id === plan.corrected_object && current?.action === 'drop') {
                enqueue('/memory/correct', { object_id: item.id, to: current.to, pos: entry.pos });
              } else if (!previous.has(item.id) || previous.get(item.id).some((v, i) => v !== item.pos[i])) {
                enqueue('/memory/observe', { entries: [entry], rescan: previous.has(item.id) });
              }
            }
          },
          hit(objectId) { local.hit(objectId); enqueue('/memory/hit', { object_id: objectId }); },
          miss(objectId) { local.miss(objectId); enqueue('/memory/miss', { object_id: objectId }); },
        };
        unsubscribe = ctx.bus.on('task:step', event => {
          const instruction = plan.steps[steps.length];
          if (!instruction || instruction.action !== event.action) throw new Error('execution_step_mismatch');
          steps.push({ ...instruction, result: event.ok ? 'succeeded' : 'failed' });
          if (instruction.target && ['find', 'grab', 'drop'].includes(instruction.action)) lastObjects.set(layoutId, instruction.target);
        });
        signal?.addEventListener('abort', cancel, { once: true });
        execution = await ctx.executor.submitPlan(plan, { query });
      } catch (error) {
        failure = error;
        execution = { ok: false, reason: signal?.aborted ? 'cancelled' : 'error' };
      } finally {
        signal?.removeEventListener('abort', cancel);
        unsubscribe?.();
        ctx.memory = local;
        try {
          await pending;
          if (plan?.steps.length) await reload();
        } catch (error) {
          failure ??= error;
          execution = { ok: false, reason: 'memory_sync_failed' };
        }
        try {
          if (plan?.steps.length) {
            const interrupted = plan.steps[steps.length];
            if (interrupted && execution?.ok !== true && !steps.some(s => s.result !== 'succeeded')) {
              steps.push({ ...interrupted, result: execution?.reason === 'cancelled' ? 'cancelled' : 'failed' });
            }
            const ok = execution?.ok === true && !failure;
            await request('/log', {
              layout_id: layoutId, query, plan, steps, robot: initialRobot,
              memory_enabled: memoryEnabled, duration_ms: performance.now() - started,
              ok, ...(ok ? {} : { reason: execution?.reason ?? 'error' }),
            });
          }
        } finally {
          busy = false;
        }
      }
      if (failure) throw failure;
      return { ...execution, plan };
    },
  };
}
