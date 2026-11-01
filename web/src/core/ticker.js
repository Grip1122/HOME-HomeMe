// 可注入的时钟。所有"等待多久""走多远"都由 update(dt) 推进，而不是 setTimeout，
// 所以测试能确定性地快进，录屏也能逐帧步进。
export function abortError() {
  const e = new Error('aborted');
  e.name = 'AbortError';
  return e;
}
export const isAbort = (e) => !!e && e.name === 'AbortError';

export function createTicker() {
  let time = 0;
  const jobs = new Set();
  return {
    get time() { return time; },
    get pending() { return jobs.size; },
    update(dt) {
      if (!Number.isFinite(dt) || dt < 0) throw new RangeError(`dt 必须是非负有限数，收到 ${dt}`);
      time += dt;
      for (const job of [...jobs]) {
        if (job.signal && job.signal.aborted) {
          jobs.delete(job);
          job.reject(abortError());
          continue;
        }
        let done;
        try {
          done = job.step(dt);
        } catch (e) {
          jobs.delete(job);
          job.reject(e);
          continue;
        }
        if (done) {
          jobs.delete(job);
          job.resolve();
        }
      }
    },
    /** 每次 update 调用 step(dt)，返回 true 时 Promise 完成。signal 被中止则以 AbortError 拒绝。 */
    until(step, signal) {
      return new Promise((resolve, reject) => {
        if (signal && signal.aborted) { reject(abortError()); return; }
        jobs.add({ step, resolve, reject, signal });
      });
    },
    wait(seconds, signal) {
      if (!Number.isFinite(seconds) || seconds < 0) throw new RangeError(`seconds 必须是非负有限数，收到 ${seconds}`);
      let left = seconds;
      return this.until((dt) => { left -= dt; return left <= 1e-9; }, signal);
    },
  };
}
