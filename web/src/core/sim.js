// 驱动 ticker 直到某个 Promise 落定。测试与录屏共用；不使用 sleep 断言。
export const macrotask = () => new Promise((r) => (typeof setImmediate === 'function' ? setImmediate(r) : setTimeout(r, 0)));

export async function drive(ticker, promise, { dt = 1 / 30, maxSeconds = 600, onFrame } = {}) {
  let settled = false;
  let failed = false;
  let result;
  let error;
  promise.then(
    (v) => { settled = true; result = v; },
    (e) => { settled = true; failed = true; error = e; },
  );
  const t0 = ticker.time;
  while (!settled) {
    if (ticker.time - t0 > maxSeconds) throw new Error(`drive 超时：${maxSeconds} 秒仍未完成`);
    ticker.update(dt);
    if (onFrame) onFrame(dt);
    await macrotask(); // 让所有微任务续跑完、下一段 until 登记好
  }
  if (failed) throw error;
  return result;
}
