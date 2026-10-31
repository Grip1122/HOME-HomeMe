import './robot-find/styles.css';
import './robot-find/realtwin.css';
import { config } from './robot-find/config.js';

// 保留样本 r160，与现有 A/B 模块的 npm Three 隔离，避免升级改变视觉效果。
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => reject(new Error(`依赖加载超时：${src}`)), 15000);
    script.src = src;
    script.onload = () => { clearTimeout(timer); resolve(); };
    script.onerror = () => { clearTimeout(timer); reject(new Error(`无法加载：${src}`)); };
    document.head.appendChild(script);
  });
}

async function boot() {
  const base = import.meta.env.BASE_URL;
  window.RF = { config };
  await loadScript(`${base}robot-find/vendor/three.min.js`);
  await loadScript(`${base}robot-find/vendor/gaussian-splats-3d.umd.js`);
  await import('./robot-find/utils.js');
  await import('./robot-find/nav.js');
  await import('./robot-find/splat.js');
  await import('./robot-find/world.js');
  await import('./robot-find/memory.js');
  await import('./robot-find/agent.js');
  await import('./robot-find/realtwin.js');
  await import('./robot-find/app.js');
}

boot().catch((error) => {
  console.error(error);
  document.getElementById('fatal-msg').textContent = error.message;
  document.getElementById('fatal').classList.remove('hidden');
});

// 原样本没有组件卸载协议；热更新使用整页刷新，不叠加 RAF 和 DOM 监听。
if (import.meta.hot) import.meta.hot.accept(() => window.location.reload());
