import * as THREE from 'three';
import '../ui/hud.css';
import { createHud } from '../ui/index.mjs';
import { createRestaurantScene } from '../scene/restaurant-scene.js';
import { createEventBus } from '../core/eventbus.js';
import { createStateMachine } from '../core/statemachine.js';
import { createTicker } from '../core/ticker.js';
import { createTaskQueue } from '../core/taskqueue.js';
import { createLocalMemory } from '../core/memory.js';
import { createRobot } from '../robot/robot.js';
import { createExecutor } from '../robot/executor.js';
import { buildGrid } from '../nav/route.js';
import { createProductLoop } from './loop.js';

const $ = (id) => document.getElementById(id);
const banner = $('banner');
function show(kind, text, action) {
  banner.className = kind;
  banner.textContent = text;
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.onclick = action.fn;
    banner.appendChild(b);
  }
}

async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}

async function boot() {
  const base = import.meta.env.BASE_URL;
  const [layout, semantics] = await Promise.all([
    getJson(`${base}layouts/layout_restaurant.json`),
    getJson(`${base}scene-data/restaurant_semantics.json`),
  ]);
  const health = await fetch('/api/health').then((r) => r.ok, () => false);
  if (!health) show('err', '后端 /api 不可达：指令将无法规划，日志无法保存（不会降级为 mock）。请先启动 scripts/run_home.py');

  const canvas = $('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b1118);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.2));
  const camera = new THREE.OrthographicCamera(-10, 10, 7, -7, 0.1, 200);
  const target = new THREE.Vector3(0.75, 0, 0.5);
  let zoom = 0.85;
  function placeCamera() {
    camera.position.copy(target).add(new THREE.Vector3(0, 12, 12));
    camera.lookAt(target);
    camera.zoom = zoom;
    camera.updateProjectionMatrix();
  }
  function resize() {
    const w = innerWidth, h = innerHeight, a = w / h;
    renderer.setSize(w, h);
    camera.left = -7 * a; camera.right = 7 * a; camera.top = 7; camera.bottom = -7;
    placeCamera();
  }
  addEventListener('resize', resize);
  resize();
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoom = Math.max(0.7, Math.min(1.5, zoom * Math.exp(-e.deltaY * 0.001)));
    placeCamera();
  }, { passive: false });

  const world = createRestaurantScene({ THREE, layout, semantics });
  scene.add(world.root);
  // 可视化碰撞/语义代理（同一 layout 数据，不另造几何）
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(17, 10), new THREE.MeshBasicMaterial({ color: 0x1a232c }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0.75, -0.001, 0.5);
  scene.add(floor);
  for (const f of layout.furniture) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...f.size),
      new THREE.MeshLambertMaterial({ color: f.surface ? 0x8a5a3a : 0x3a4652, transparent: true, opacity: f.surface ? 0.9 : 0.55 }));
    m.position.set(f.pos[0] + f.size[0] / 2, f.pos[1] + f.size[1] / 2, f.pos[2] + f.size[2] / 2);
    scene.add(m);
  }

  const ticker = createTicker();
  const bus = createEventBus({ now: () => performance.now() });
  const body = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.9, 20), new THREE.MeshLambertMaterial({ color: 0xdbe5e6 }));
  torso.position.y = 0.45;
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.05), new THREE.MeshBasicMaterial({ color: 0x5fe3cf }));
  eye.position.set(0, 0.75, 0.22);
  body.add(torso, eye);
  const robot = createRobot({ root: body });
  const s = layout.rooms[0].scan_point;
  robot.setPose(s[0], s[2], 0);
  world.root.add(robot.group);

  const ctx = { world, layout, ticker, bus, robot, grid: buildGrid(layout), sm: createStateMachine({ bus }),
    memory: createLocalMemory({ bus, enabled: true }), holding: null, handBusy: false, options: {} };
  ctx.executor = createExecutor(ctx, createTaskQueue());

  const catalog = {};
  for (const o of layout.objects) catalog[o.id] = { name: o.name, room: '餐厅' };
  const hud = createHud({ bus, root: document.body, catalog, layoutId: layout.layout_id,
    welcomeText: '餐厅已就绪。试试：帮我把红色水杯放到3号桌上' });

  const loop = createProductLoop({
    ctx, layoutId: layout.layout_id,
    onLog: (e) => {
      if (e.ok) show('ok', `日志已保存 #${e.id}（${e.payload.steps.map((x) => x.action + ':' + x.result).join(' → ')}）`);
      else show('err', `日志保存失败：${e.error}`, e.payload && {
        label: '重试保存', fn: () => loop.retryLog(e.taskId, e.payload),
      });
    },
  });

  // 只有 HUD 的 plan:request 触发真实链路；loop 自己派发的 plan:request 用标记跳过
  let selfEmit = false;
  const origEmit = bus.emit;
  bus.emit = (name, payload) => {
    if (name === 'plan:request' && loop.busy) selfEmit = true;
    return origEmit.call(bus, name, payload);
  };
  bus.on('plan:request', (p) => {
    if (selfEmit) { selfEmit = false; return; }
    if (loop.busy) { hud.toast('正在执行，请稍候', 'warn'); return; }
    banner.className = '';
    loop.run(p.query).then((r) => {
      if (r && r.reason === 'plan_failed') show('err', `规划失败：${r.error}`);
      if (r && r.result && !r.result.ok) {
        const why = r.result.reason === 'cancelled' ? '任务已取消' : '执行失败';
        hud.toast(why, 'warn');
      }
    });
  });
  bus.on('robot:blocked', (p) => show('err', `执行受阻：${p.reason}`));
  bus.on('task:say', () => {});

  const btnCancel = $('btn-cancel');
  bus.on('task:start', () => { btnCancel.disabled = false; });
  bus.on('task:end', () => { btnCancel.disabled = true; });
  btnCancel.onclick = () => loop.cancel();
  // 失败注入：把杯子临时移出餐厅，find 真实扫描不到 → not_found；结束后放回原家具。
  $('btn-fail').onclick = () => {
    if (loop.busy || ctx.holding) { hud.toast('请在空手且空闲时演示失败', 'warn'); return; }
    const cup = world.getObject('cup_red');
    const home = cup.parent;
    const saved = cup.position.clone();
    const away = new THREE.Group();
    scene.add(away);
    away.updateMatrixWorld(true);
    away.attach(cup);
    away.position.set(100, 0, 100); // attach 保持世界位置，所以先挂再整体挪走
    away.updateMatrixWorld(true);
    const off = bus.on('task:end', () => {
      off();
      home.add(cup);
      cup.position.copy(saved);
      scene.remove(away);
    });
    bus.emit('plan:request', { query: '帮我把红色水杯放到3号桌上', memoryEnabled: true });
  };

  bus.on('demo:reset', () => location.reload());

  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    // rAF 时间戳可能早于启动时取的 performance.now()，负 dt 会让 ticker 抛错并停掉整个渲染循环
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    ticker.update(dt);
    robot.update(dt);
    renderer.render(scene, camera);
  });

  window.__product = { ctx, loop, layout, hud, threeRevision: THREE.REVISION,
    state: () => ({ sm: ctx.sm.state, holding: ctx.holding, handBusy: ctx.handBusy, busy: loop.busy,
      cupParent: world.getObject('cup_red').parent?.name ?? null, cupPos: world.worldPos('cup_red') }) };
}

boot().catch((e) => {
  console.error(e);
  const el = $('fatal');
  el.textContent = '启动失败：' + (e.stack || e.message || e);
  el.style.display = 'block';
});
