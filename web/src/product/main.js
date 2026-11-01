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
import { config as robotFindConfig } from '../robot-find/config.js';

async function loadDisplayRobot(url) {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(root);
  const height = bounds.getSize(new THREE.Vector3()).y;
  if (!Number.isFinite(height) || height <= 0) throw new Error('真实机器人模型尺寸无效');
  root.scale.setScalar(0.9 / height);
  root.updateMatrixWorld(true);
  const grounded = new THREE.Box3().setFromObject(root);
  root.position.y -= grounded.min.y;
  return createRobot({ root });
}

async function loadRestaurantViewer(rootElement, scene) {
  const Lib = window['Gaussian Splats 3D'];
  if (!Lib) throw new Error('餐厅实景渲染库未加载');
  const real = robotFindConfig.realtwin;
  const viewer = new Lib.Viewer({
    rootElement,
    selfDrivenMode: true,
    useBuiltInControls: true,
    sharedMemoryForWorkers: false,
    gpuAcceleratedSort: false,
    cameraUp: [0, 1, 0],
    initialCameraPosition: real.camera.position,
    initialCameraLookAt: real.camera.lookAt,
    showLoadingUI: false,
    ignoreDevicePixelRatio: true,
  });
  await viewer.addSplatScene(real.model, {
    rotation: real.rotation,
    position: real.position,
    splatAlphaRemovalThreshold: real.alphaThreshold,
    showLoadingUI: false,
  });
  viewer.start();
  return viewer;
}

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
  if (!health) show('err', '后端 /api 不可达：指令将无法规划，日志无法保存（不会降级为 mock）。请使用“一键启动”或先启动 scripts/run_home.py。');
  $('btn-experience').onclick = () => { location.href = `${base}experience.html`; };
  $('btn-health').onclick = async () => {
    const online = await fetch('/api/health').then((r) => r.ok, () => false);
    show(online ? 'ok' : 'err', online ? '本地规划、记忆与日志服务已连接' : '服务未连接：请使用一键启动后重新打开页面');
  };

  const canvas = $('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.6));
  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.01, 200);
  const real = robotFindConfig.realtwin;
  let viewer = null;
  const cameraPosition = new THREE.Vector3(...real.camera.position);
  const cameraTarget = new THREE.Vector3(...real.camera.lookAt);
  camera.position.copy(cameraPosition);
  camera.lookAt(cameraTarget);
  function resizeOverlay() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (viewer?.renderer && viewer?.camera) {
      viewer.renderer.setSize(w, h);
      viewer.camera.aspect = w / h;
      viewer.camera.updateProjectionMatrix();
    }
  }
  addEventListener('resize', resizeOverlay);
  resizeOverlay();

  const world = createRestaurantScene({ THREE, layout, semantics });
  // 任务语义和碰撞仍保留，但不再把代理几何作为可视场景。
  world.root.visible = false;
  scene.add(world.root);
  viewer = await loadRestaurantViewer($('restaurant-live'), scene);
  show('ok', '真实餐厅空间已加载；任务语义层已与可视画面分离');

  const ticker = createTicker();
  const bus = createEventBus({ now: () => performance.now() });
  const robot = await loadDisplayRobot(`${base}models/roomscan-rs01.glb`);
  const s = layout.rooms[0].scan_point;
  robot.setPose(s[0], s[2], 0);
  // 机器人是实际可见的 GLB，附到高斯点云渲染器的 threeScene 中。
  scene.add(robot.group);

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
  function tick(now) {
    // 点云餐厅由自身渲染器绘制；透明覆盖层仅渲染真实 GLB 机器人。
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    ticker.update(dt);
    robot.update(dt);
    if (viewer.camera) {
      camera.position.copy(viewer.camera.position);
      camera.quaternion.copy(viewer.camera.quaternion);
      camera.updateMatrixWorld();
    }
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  window.__product = { ctx, loop, layout, hud, viewer, threeRevision: THREE.REVISION,
    state: () => ({ sm: ctx.sm.state, holding: ctx.holding, handBusy: ctx.handBusy, busy: loop.busy,
      cupParent: world.getObject('cup_red').parent?.name ?? null, cupPos: world.worldPos('cup_red') }) };
}

boot().catch((e) => {
  console.error(e);
  const el = $('fatal');
  el.textContent = '启动失败：' + (e.stack || e.message || e);
  el.style.display = 'block';
});
