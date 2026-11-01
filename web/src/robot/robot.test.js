import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createRobot, bindRobotVisuals, missingClips, STATE_CLIPS } from './robot.js';
import { createEventBus } from '../core/eventbus.js';
import { createStateMachine } from '../core/statemachine.js';
import { FADE_SECONDS } from '../core/config.js';

const GLB_CLIPS = ['Dance', 'Death', 'Idle', 'Jump', 'No', 'Punch', 'Running', 'Sitting', 'Standing', 'ThumbsUp', 'Walking', 'WalkJump', 'Wave', 'Yes'];

describe('robot 视觉层', () => {
  it('8 个状态映射到的动画在 RobotExpressive.glb 里都存在', () => {
    expect(Object.keys(STATE_CLIPS)).toHaveLength(8);
    expect(missingClips(GLB_CLIPS)).toEqual([]);
    expect(missingClips(GLB_CLIPS.filter((n) => n !== 'ThumbsUp'))).toEqual(['ThumbsUp']);
  });

  it('模型缺动画时构造即报错，不静默回退', () => {
    const clips = ['Idle', 'Walking'].map((n) => new THREE.AnimationClip(n, 1, []));
    expect(() => createRobot({ root: new THREE.Group(), clips })).toThrow(/缺少动画/);
  });

  it('状态切换驱动动画，淡入淡出统一 0.25 秒；confused 带 Sad 表情，离开后清零', () => {
    const bus = createEventBus({ now: () => 0 });
    const sm = createStateMachine({ bus });
    const head = { morphTargetDictionary: { Angry: 0, Surprised: 1, Sad: 2 }, morphTargetInfluences: [0, 0, 0] };
    const robot = createRobot({ root: new THREE.Group(), morphMesh: head });
    bindRobotVisuals(bus, robot);
    sm.transition('thinking');
    sm.transition('confused');
    expect(head.morphTargetInfluences[2]).toBe(1);
    sm.transition('idle');
    expect(head.morphTargetInfluences[2]).toBe(0);
    expect(robot.animationLog.map((e) => e.name)).toEqual(['Idle', 'No', 'Idle']);
    expect(robot.animationLog.every((e) => e.fade === FADE_SECONDS)).toBe(true);
  });
});
