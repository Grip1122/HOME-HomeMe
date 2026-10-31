import assert from 'node:assert/strict';
import {PoseBuffer} from '../web/motion.mjs';
const pose=(sequence,t,x,yaw=0,epoch='a')=>({sequence,server_time:t,xy:[x,0],yaw,height:1+x/10,tilt_deg:x,epoch,scene:'restaurant'});
const buffer=new PoseBuffer(100);
buffer.push(pose(1,1,0),1100);buffer.push(pose(2,1.1,1),1200);
const middle=buffer.sample(1250);
assert.ok(Math.abs(middle.xy[0]-.5)<1e-9);
assert.ok(Math.abs(middle.height-1.05)<1e-9);
assert.equal(buffer.push(pose(1,1,99),1300),false);
assert.equal(buffer.sample(5000).xy[0],1); // Hold on dropout, never extrapolate into a wall.
const turn=new PoseBuffer(100);
turn.push(pose(1,1,0,179*Math.PI/180),1100);turn.push(pose(2,1.1,0,-179*Math.PI/180),1200);
assert.ok(Math.abs(Math.abs(turn.sample(1250).yaw)-Math.PI)<1e-9);
turn.push(pose(3,1.2,20,0,'reset'),1300);
assert.equal(turn.sample(1300).xy[0],20); // Scene/reset starts a new timeline.
console.log('Pose interpolation, shortest rotation, dropout hold and reset checks passed.');
