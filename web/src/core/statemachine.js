// 状态机：转移表，不是条件分支。表里没有的转移一律是非法转移。
//
// 与总览表 6 的差异（已在 PR 中向把关人说明）：
// 原表没有任何状态的出边指向 celebrating，该状态永远进不去。
// 这里给"任务可能在此结束"的四个状态补上 -> celebrating，其余与原表逐项一致。
export const TRANSITIONS = Object.freeze({
  idle: ['thinking'],
  thinking: ['walking', 'confused'],
  walking: ['scanning', 'picking', 'placing', 'idle', 'celebrating'],
  scanning: ['walking', 'confused', 'idle', 'celebrating'],
  picking: ['walking', 'idle', 'celebrating'],
  placing: ['idle', 'celebrating'],
  confused: ['scanning', 'idle'],
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

export function createStateMachine({ bus, table = TRANSITIONS, initial = 'idle' }) {
  if (!(initial in table)) throw new RangeError(`未知初始状态: ${initial}`);
  let state = initial;
  const illegal = [];
  return {
    get state() { return state; },
    illegal,
    can(to) { return (table[state] || []).includes(to); },
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
