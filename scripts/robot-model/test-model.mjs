import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import * as T from 'three';
import http from 'node:http';import {once}from 'node:events';import {after}from 'node:test';
const modelPath=new URL('../../web/public/robot-find/models/robot-web.glb',import.meta.url); // rewritten below to the script depth
const server=http.createServer((req,res)=>{if(req.url==='/robot-web.glb'){res.setHeader('Content-Type','model/gltf-binary');res.end(fs.readFileSync(modelPath));}else{res.statusCode=404;res.end('missing');}}).listen(0,'127.0.0.1');await once(server,'listening');
const origin='http://127.0.0.1:'+server.address().port;after(()=>new Promise(resolve=>server.close(resolve)));

const glb=fs.readFileSync(modelPath);
const jlen=glb.readUInt32LE(12),json=JSON.parse(glb.subarray(20,20+jlen).toString());
test('GLB buffer ranges, normals, UVs, two embedded PNGs and triangle reduction',()=>{
 assert.equal(glb.readUInt32LE(0),0x46546c67);assert.equal(glb.readUInt32LE(8),glb.length);assert.equal(json.meshes.length,1);assert.equal(json.images.length,2);assert.equal(json.animations,undefined);assert.equal(json.skins,undefined);
 for(const v of json.bufferViews)assert(v.byteOffset+v.byteLength<=json.buffers[0].byteLength);
 const p=json.meshes[0].primitives[0];assert.equal(json.accessors[p.indices].count/3,120000);for(const name of ['POSITION','NORMAL','TEXCOORD_0'])assert.notEqual(p.attributes[name],undefined);
 const offset=20+jlen+8;for(const image of json.images){const v=json.bufferViews[image.bufferView];assert.equal(glb.subarray(offset+v.byteOffset,offset+v.byteOffset+8).toString('hex'),'89504e470d0a1a0a');}
});
test('Factory uses real GLB geometry, preserves instance poses, grounds/scales/front direction, reports missing model',async()=>{
 globalThis.ProgressEvent=class {constructor(type,props){Object.assign(this,{type},props);}};
 globalThis.self=globalThis;
 globalThis.createImageBitmap=async()=>({width:2048,height:2048,close(){}});
 // Three FileLoader fetches the real GLB; PNGs are decoded by the browser in the visual check.
 const ui=new Map();const errors=[];
 const sandbox={window:{THREE:T,RF:{robotModelConfig:{url:origin+'/robot-web.glb',height:1.2,yaw:-Math.PI/2}}},document:{baseURI:origin+'/',getElementById:id=>ui.get(id),createElement:()=>({style:{},setAttribute(){},textContent:''}),body:{append(el){ui.set(el.id,el);errors.push(el);}}},console,URL,Blob,fetch,Headers,Request,Response,AbortController,TextDecoder,TextEncoder,ArrayBuffer,Uint8Array,ProgressEvent:class {constructor(type,props){Object.assign(this,{type},props);}},createImageBitmap:async blob=>({width:2048,height:2048,close(){}}),setTimeout,clearTimeout};
 sandbox.self=sandbox;sandbox.window.URL=URL;
 vm.runInNewContext(fs.readFileSync(new URL('../../web/public/robot-find/vendor/robot-model.js',import.meta.url),'utf8'),sandbox);
 const RF=sandbox.window.RF;
 const a=RF.createRobot({THREE:T}),b=RF.createRobot({THREE:T});a.setPose(2,3,.4);b.setPose(-1,2,-.5);
 await Promise.all([a.ready,b.ready]);assert.equal(a.group.userData.modelStatus,'ready');assert.equal(b.group.userData.modelStatus,'ready');assert.notEqual(a.visual,b.visual);assert.equal(a.group.position.x,2);assert.equal(b.group.position.x,-1);
 const bound=new T.Box3().setFromObject(a.visual);assert(Math.abs(bound.min.y)<1e-5);assert(Math.abs(bound.getSize(new T.Vector3()).y-1.2)<1e-5);assert.equal(a.group.userData.capabilities.jointAnimation,false);
 const front=new T.Vector3(1,0,0).applyAxisAngle(new T.Vector3(0,1,0),a.config.yaw);assert(front.distanceTo(new T.Vector3(0,0,1))<1e-5);
 a.setState('scanning');a.update(.016,1,{movingSpeed:.5});assert.equal(a.state,'scanning');assert.equal(a.speed,.5);
 const parent=new T.Group();parent.add(a.group);const item=new T.Object3D();parent.add(item);a.carryAnchor.attach(item);assert.equal(item.parent,a.carryAnchor);
 const bad=RF.createRobot({THREE:T,model:{url:origin+'/missing.glb'}});await assert.rejects(bad.ready);assert.equal(bad.group.userData.modelStatus,'error');assert(errors.length);assert.match(errors.at(-1).textContent,/加载失败/);
});
