// 状态机：转移表，不是条件分支。表里没有的转移一律是非法转移。
//
// 与总览表 6 的差异（已在 PR 中向把关人说明）共三处，其余与原表逐项一致：
// 1. 原表没有任何状态的出边指向 celebrating，该状态永远进不去。给"任务可能在此结束"的四个状态补上 -> celebrating。
// 2. confused 补上 -> walking（见下）。
// 3. walking 补上 -> confused（见下）。
export const TRANSITIONS = Object.freeze({
  idle: ['thinking'],
  thinking: ['walking', 'confused'],
  // walking -> confused：寻路失败（no_path）、走到仍够不着（too_far）都发生在行走之后，不补这条边就得借道 scanning。
  walking: ['scanning', 'picking', 'placing', 'idle', 'celebrating', 'confused'],
  scanning: ['walking', 'confused', 'idle', 'celebrating'],
  picking: ['walking', 'idle', 'celebrating'],
  placing: ['idle', 'celebrating'],
  // 原表 confused 只能去 scanning/idle，但 2.2 查找伪代码在"记忆落空→困惑"之后要直接去扫描点（walking），
  // 不补这条边就只能硬塞一个 0 帧的 scanning 中转，HUD 会闪一下假状态。
  confused: ['scanning', 'walking', 'idle'],
  celebrating: ['idle'],
});

/** 从 start 出发经转移表能到达的全部状态（含 start）。 */
export function reachableFrom(table, start = 'idle') {
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    for (const next of table[stack.pop()] || []) {
      if (!seen.has(next)) { seen.add(next); stack.push(next); }
    }
  }
  return seen;
}

/** 没有出边的状态（死锁）。 */
export function deadEnds(table) {
  return Object.keys(table).filter((s) => table[s].length === 0);
}

/**
 * 转移表上从 from 到 to 的最短合法路径（不含 from，含 to）。from===to 返回 []，不可达返回 null。
 * 用途：动作执行器只说"我要进入 X 状态"，由它规划逐跳路线；每一跳仍然逐条过转移表，
 * 所以它不会放行任何非法转移，只是替调用方省掉手工写中转状态。
 */
export function pathBetween(table, from, to) {
  if (from === to) return [];
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const nxt of table[cur] || []) {
      if (prev.has(nxt)) continue;
      prev.set(nxt, cur);
      if (nxt === to) {
        const path = [];
        for (let s = to; s !== from; s = prev.get(s)) path.unshift(s);
        return path;
      }
      queue.push(nxt);
    }
  }
  return null;
}

export function createStateMachine({ bus, table = TRANSITIONS, initial = 'idle' }) {
  if (!(initial in table)) throw new RangeError(`未知初始状态: ${initial}`);
  let state = initial;
  const illegal = [];
  const recoveries = [];
  return {
    get state() { return state; },
    illegal,
    recoveries,
    can(to) { return (table[state] || []).includes(to); },
    /** 进入 to 状态：已在则无操作；否则沿最短合法路径逐跳转移。无路可走抛错并记录。 */
    moveTo(to, ctx = {}) {
      const route = pathBetween(table, state, to);
      if (route === null) {
        illegal.push({ from: state, to, step: ctx.step ?? null, taskId: ctx.taskId ?? null });
        throw new Error(`非法状态转移: ${state} -> ${to}（无合法路径）`);
      }
      for (const hop of route) this.transition(hop, ctx);
    },
    /** 异常后的逃生口：强制回到 idle 并留痕。只给执行器在任务抛错后调用，不是常规转移。 */
    recover(ctx = {}) {
      if (state === 'idle') return false;
      const from = state;
      state = 'idle';
      recoveries.push({ from, step: ctx.step ?? null, taskId: ctx.taskId ?? null });
      bus.emit('robot:state', { from, to: 'idle', step: ctx.step ?? null, taskId: ctx.taskId ?? null });
      return true;
    },
    transition(to, { step = null, taskId = null } = {}) {
      if (!this.can(to)) {
        illegal.push({ from: state, to, step, taskId });
        throw new Error(`非法状态转移: ${state} -> ${to}`);
      }
      const from = state;
      state = to;
      bus.emit('robot:state', { from, to, step, taskId });
    },
  };
}
