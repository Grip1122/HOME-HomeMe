import * as pc from './vendor/playcanvas.mjs';
import {loadScannerRobot} from './robot/robot.mjs';
const canvas=document.getElementById('scene'),message=document.getElementById('message');
const app=new pc.Application(canvas,{graphicsDeviceOptions:{antialias:false,alpha:false,powerPreference:'high-performance'}});
app.setCanvasFillMode(pc.FILLMODE_NONE);app.setCanvasResolution(pc.RESOLUTION_AUTO);app.graphicsDevice.maxPixelRatio=Math.min(devicePixelRatio,1.5);
const camera=new pc.Entity('Fixed45DegreePreview');camera.addComponent('camera',{projection:pc.PROJECTION_ORTHOGRAPHIC,orthoHeight:3.2,nearClip:.01,farClip:80,clearColor:new pc.Color(.09,.15,.17)});app.root.addChild(camera);
let closeup=false,zoom=1;
const target=new pc.Vec3(0,.8,0),offset=new pc.Vec3(7,Math.sqrt(98),7);
function position(){target.set(0,closeup?.55:.8,0);camera.setPosition(target.clone().add(offset));camera.lookAt(target);camera.camera.orthoHeight=(closeup?.9:3.2)*zoom;}
position();
const light=new pc.Entity('RobotKey');light.addComponent('light',{type:'directional',color:new pc.Color(1,.93,.82),intensity:1.3});light.setEulerAngles(45,20,0);app.root.addChild(light);app.scene.ambientLight=new pc.Color(.45,.5,.53);
try{
 const asset=new pc.Asset('TeamHomeScene','gsplat',{url:'./team-scene/home-preview.compressed.ply'});app.assets.add(asset);
 const load=new Promise((resolve,reject)=>{asset.ready(resolve);asset.once('error',reject);app.assets.load(asset);});
 const [robot]=await Promise.all([loadScannerRobot(app,pc),load]);
 const scene=new pc.Entity('TeamHomeGaussian');scene.addComponent('gsplat',{asset});scene.setEulerAngles(180,0,0);app.root.addChild(scene);
 app.on('update',()=>{robot.update({xy:[0,0],yaw:0,height:Number(document.getElementById('height').value),tilt_deg:Number(document.getElementById('tilt').value),epoch:'team-resource-preview'});});
 const resize=()=>{const r=canvas.getBoundingClientRect();app.resizeCanvas(Math.round(r.width),Math.round(r.height));};new ResizeObserver(resize).observe(canvas);resize();app.start();
 message.hidden=true;canvas.dataset.loaded='yes';window.homeResourcePreview={robot,asset:'scene_main',calibrated:false,cameraProjection:'orthographic',pitchDegrees:45};
}catch(error){message.textContent='资源加载失败：'+error.message;console.error(error);}
document.getElementById('focus').onclick=()=>{closeup=!closeup;zoom=1;position();};
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.7,Math.min(1.5,zoom*Math.exp(e.deltaY*.001)));position();},{passive:false});
