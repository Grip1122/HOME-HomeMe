import assert from 'node:assert/strict';
import {scanCameraPose} from '../web/raw-camera.mjs';
const near=(a,b)=>a.every((x,i)=>Math.abs(x-b[i])<1e-8);
const pose={xy:[2,3],height:1.5,yaw:0,tilt_deg:0};
const front=scanCameraPose(pose,0),left=scanCameraPose(pose,1);
assert.ok(near(front.position,[2.105,1.5,-3]));
assert.ok(near(front.forward,[1,0,0]));assert.ok(near(left.forward,[0,0,-1]));
assert.ok(near(front.up,[0,1,0]));
const tilted=scanCameraPose({...pose,tilt_deg:30},0);
assert.ok(Math.abs(tilted.forward[1]+.5)<1e-8);
for(let i=0;i<4;i++){
 const p=scanCameraPose({...pose,yaw:.8,tilt_deg:37},i);
 assert.ok(Math.abs(p.forward.reduce((s,x,j)=>s+x*p.up[j],0))<1e-8);
 assert.ok(Math.abs(Math.hypot(...p.forward)-1)<1e-8);
}
console.log('Four camera directions, height, pitch and simulation-to-render alignment passed.');
