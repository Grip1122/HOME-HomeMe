// 机器人本体：位姿、朝向、携带锚点、动画播放。只负责"看起来怎样"，不判断能不能抓（逻辑在 actions.js）。
// 动画名从模型实际读取后建映射，缺动画时明确报错，不静默回退。
import * as THREE from 'three';
import { FADE_SECONDS, CARRY_ANCHOR } from '../core/config.js';

/** 状态 -> 动画片段名。名称对照 RobotExpressive.glb 实际列表（Dance Death Idle Jump No Punch Running Sitting Standing ThumbsUp Walking WalkJump Wave Yes）。 */
export const STATE_CLIPS = Object.freeze({
  idle: 'Idle',
  thinking: 'Idle',
  walking: 'Walking',
  scanning: 'Idle',
  picking: 'Punch',
  placing: 'Wave',
  confused: 'No',
  celebrating: 'ThumbsUp',
});

/** 单次播放（播完停在末帧）的片段，其余循环。 */
export const ONE_SHOT = new Set(['Punch', 'Wave', 'No', 'ThumbsUp']);

export function missingClips(available, mapping = STATE_CLIPS) {
  const have = new Set(available);
  return [...new Set(Object.values(mapping))].filter((n) => !have.has(n));
}

export function createRobot({ root, clips = [], morphMesh = null }) {
  const group = new THREE.Group();
  group.name = 'robot';
  group.add(root);
  const carryAnchor = new THREE.Object3D();
  carryAnchor.name = 'carryAnchor';
  carryAnchor.position.set(...CARRY_ANCHOR);
  group.add(carryAnchor);

  const mixer = clips.length ? new THREE.AnimationMixer(root) : null;
  const actions = new Map();
  if (mixer) {
    const missing = missingClips(clips.map((c) => c.name));
    if (missing.length) throw new Error(`模型缺少动画: ${missing.join(', ')}`);
    for (const clip of clips) actions.set(clip.name, mixer.clipAction(clip));
  }
  let current = null;
  const log = [];

  return {
    group,
    carryAnchor,
    mixer,
    animationLog: log,
    get yaw() { return group.rotation.y; },
    set yaw(v) { group.rotation.y = v; },
    get pos() { return [group.position.x, group.position.y, group.position.z]; },
    setPose(x, z, yaw) {
      group.position.set(x, 0, z);
      if (yaw !== undefined) group.rotation.y = yaw;
    },
    /** 淡入淡出切换片段，时长统一 FADE_SECONDS。同一片段重复请求只记日志不重播。 */
    play(name, { fade = FADE_SECONDS } = {}) {
      log.push({ name, fade });
      if (!mixer) return;
      const next = actions.get(name);
      if (!next) throw new Error(`没有动画: ${name}`);
      if (current === next) return;
      next.reset();
      next.enabled = true;
      if (ONE_SHOT.has(name)) {
        next.setLoop(THREE.LoopOnce, 1);
        next.clampWhenFinished = true;
      } else {
        next.setLoop(THREE.LoopRepeat, Infinity);
      }
      if (current) current.crossFadeTo(next, fade, false);
      next.play();
      current = next;
    },
    /** 形变目标 0..1：Angry / Surprised / Sad。 */
    setExpression(name, value) {
      if (!morphMesh) return;
      const i = morphMesh.morphTargetDictionary[name];
      if (i === undefined) throw new Error(`没有形变目标: ${name}`);
      morphMesh.morphTargetInfluences[i] = Math.max(0, Math.min(1, value));
    },
    update(dt) { if (mixer) mixer.update(dt); },
  };
}

/** 状态 -> 表情（形变目标）。confused 用 Sad（任务书 3.1 动作表）。 */
export const STATE_EXPRESSION = Object.freeze({ confused: 'Sad' });

/** 视觉层订阅：robot:state 到来时切动画与表情。单向，只读事件，不回写任何逻辑状态。返回取消订阅函数。 */
export function bindRobotVisuals(bus, robot) {
  return bus.on('robot:state', ({ to }) => {
    robot.play(STATE_CLIPS[to]);
    for (const name of new Set(Object.values(STATE_EXPRESSION))) robot.setExpression(name, 0);
    if (STATE_EXPRESSION[to]) robot.setExpression(STATE_EXPRESSION[to], 1);
  });
}

/** 浏览器里加载 RobotExpressive.glb。返回 createRobot 的结果。 */
export async function loadRobot(url = '/models/RobotExpressive.glb') {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
  const gltf = await new GLTFLoader().loadAsync(url);
  let morphMesh = null;
  gltf.scene.traverse((o) => { if (o.morphTargetDictionary && o.name === 'Head') morphMesh = o; });
  gltf.scene.scale.setScalar(0.2); // 模型约 4.8 单位高（实测缩 0.3 后 1.44 米），缩到约 0.96 米，与 0.5 米网格量级匹配
  return createRobot({ root: gltf.scene, clips: gltf.animations, morphMesh });
}
