import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const T = window.THREE;
if (!T || T.REVISION !== '160') throw new Error('robot-model.js 需要已有的 Three r160');
const RF = window.RF = window.RF || {};
const cache = new Map();
const defaults = { url: 'assets/models/robot-web.glb', height: 1.2, yaw: -Math.PI / 2 };
function settings(options = {}) {
  const value = { ...defaults, ...RF.robotModelConfig, ...options };
  if (!(Number.isFinite(value.height) && value.height > 0) || !Number.isFinite(value.yaw)) throw new Error('机器人展示高度和朝向无效');
  value.url = new URL(value.url, document.baseURI).href;
  return value;
}
function reportError(error) {
  let el = document.getElementById('robot-model-error');
  if (!el) { el = document.createElement('div'); el.id = 'robot-model-error'; el.setAttribute('role','alert'); el.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:10000;max-width:600px;padding:12px;background:#7b2735;color:#fff;border-radius:8px'; document.body.append(el); }
  el.textContent = `机器人模型加载失败：${error.message}`;
}
export function preloadRobotModel(options = {}) {
  const cfg = settings(options);
  if (!cache.has(cfg.url)) {
    const promise = new GLTFLoader().loadAsync(cfg.url).then(gltf => {
      const box = new T.Box3().setFromObject(gltf.scene);
      if (box.isEmpty() || !(box.max.y > box.min.y)) throw new Error('机器人模型为空或高度无效');
      return gltf;
    }).catch(error => { cache.delete(cfg.url); throw error; });
    cache.set(cfg.url,promise);
  }
  return cache.get(cfg.url);
}
export class ModelRobot {
  constructor(options = {}) {
    if (options.THREE && options.THREE !== T) throw new Error('机器人必须使用场景已有的 Three r160');
    this.config = settings(options.model);
    this.height = this.config.height;
    this.group = new T.Group(); this.group.name = 'robot';
    this.group.userData.robotAsset = 'user-robot-fbx-v1';
    this.group.userData.modelStatus = 'loading';
    this.group.userData.capabilities = { rootMotion: true, skeleton: false, jointAnimation: false };
    this.state = 'idle'; this.speed = 0;
    this.carryAnchor = new T.Object3D(); this.carryAnchor.name = 'carryAnchor';
    this.carryAnchor.position.set(0,this.height * .52,this.height * .3);
    this.carryAnchor.userData.calibration = 'display offset; not a physical gripper or rig joint';
    this.group.add(this.carryAnchor);
    this.ready = preloadRobotModel(this.config).then(gltf => {
      const visual = gltf.scene.clone(true); visual.name = 'robot_fbx_visual';
      const box = new T.Box3().setFromObject(visual), size = box.getSize(new T.Vector3()), center = box.getCenter(new T.Vector3());
      const normalized = new T.Group(); normalized.name = 'robot_fbx_grounded';
      visual.position.x -= center.x; visual.position.y -= box.min.y; visual.position.z -= center.z;
      normalized.add(visual); normalized.scale.setScalar(this.height / size.y); normalized.rotation.y = this.config.yaw;
      normalized.traverse(node => { if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; node.userData.noSplat = true; } });
      this.group.add(normalized); this.visual = normalized;
      this.group.userData.modelStatus = 'ready';
      return this;
    }).catch(error => { this.group.userData.modelStatus = 'error'; this.error = error; throw error; });
    // Keep the rejected ready promise observable while giving ordinary UI callers a visible failure.
    this.ready.catch(reportError);
  }
  setState(state) { this.state = state; this.group.userData.robotState = state; }
  lookToward(x,z) { this.lookTarget = [x,z]; } // Single mesh has no head joint; don't pretend to articulate it.
  update(_dt,_time,options = {}) { this.speed = options.movingSpeed || 0; }
  setPose(x,z,yaw) { this.group.position.set(x,0,z); if (yaw !== undefined) this.group.rotation.y = yaw; }
  dispose() { this.group.removeFromParent(); } // Geometry/textures belong to the shared model cache.
}
RF.preloadRobotModel = preloadRobotModel;
RF.ModelRobot = ModelRobot;
RF.createRobot = options => new ModelRobot(options);
