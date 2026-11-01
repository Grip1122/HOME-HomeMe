// 串行任务执行 + 单飞锁。执行中再次提交会被拒绝，不排队、不执行。
// 锁一定在 finally 里释放：任务抛错或被取消，下一次提交都能正常进入。
export function createTaskQueue() {
  let busy = false;
  let controller = null;
  return {
    get busy() { return busy; },
    /** task 收到 AbortSignal；成功返回 {ok:true,value}，被拒绝返回 {ok:false,reason:'busy'}。任务抛错则原样抛出。 */
    async submit(task) {
      if (typeof task !== 'function') throw new TypeError('task 必须是函数');
      if (busy) return { ok: false, reason: 'busy' };
      busy = true;
      controller = new AbortController();
      try {
        const value = await task(controller.signal);
        return { ok: true, value };
      } finally {
        busy = false;
        controller = null;
      }
    },
    /** 通知当前任务中止；没有任务在跑返回 false。 */
    cancel() {
      if (!controller) return false;
      controller.abort();
      return true;
    },
  };
}
