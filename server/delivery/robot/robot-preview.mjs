import * as pc from '../vendor/playcanvas.mjs';
import {loadScannerRobot} from './robot.mjs';

const canvas=document.getElementById('robot-preview'),status=document.getElementById('model-status');
const app=new pc.Application(canvas,{graphicsDeviceOptions:{antialias:true,alpha:true,powerPreference:'high-performance'}});
app.setCanvasFillMode(pc.FILLMODE_NONE);app.setCanvasResolution(pc.RESOLUTION_AUTO);app.graphicsDevice.maxPixelRatio=Math.min(devicePixelRatio,2);
app.scene.ambientLight=new pc.Color(.48,.53,.57);
const camera=new pc.Entity('StudioCamera');camera.addComponent('camera',{clearColor:new pc.Color(.09,.14,.16,0),fov:36,nearClip:.01,farClip:20});app.root.addChild(camera);
let yaw=.65,pitch=.19,distance=2.65,drag=null,automatic=false,start=0,currentHeight=1.15,currentTilt=0;
const target=new pc.Vec3(0,.72,0);
function light(name,angle,color,intensity,shadows=false){const entity=new pc.Entity(name);entity.addComponent('light',{type:'directional',color:new pc.Color(...color),intensity,castShadows:shadows,shadowResolution:2048,shadowDistance:5,shadowBias:.15,normalOffsetBias:.03,shadowType:pc.SHADOW_PCF5});entity.setEulerAngles(...angle);app.root.addChild(entity);}
light('WarmKey',[38,32,0],[1,.91,.76],1.3,true);light('CoolFill',[25,-125,0],[.64,.82,1],.45);light('Rim',[65,160,0],[1,.87,.66],.7);
const floor=new pc.Entity('StudioFloor');floor.addComponent('render',{type:'cylinder'});floor.setLocalScale(.78,.025,.78);floor.setPosition(0,-.018,0);
const mat=new pc.StandardMaterial();mat.diffuse=new pc.Color(.12,.17,.18);mat.emissive=new pc.Color(.025,.035,.04);mat.metalness=.15;mat.useMetalness=true;mat.gloss=.3;mat.update();floor.render.material=mat;floor.render.castShadows=false;app.root.addChild(floor);
const heightInput=document.getElementById('mast-height'),tiltInput=document.getElementById('head-tilt');
function setInputs(){document.getElementById('height-value').value=currentHeight.toFixed(2)+' m';document.getElementById('tilt-value').value=Math.round(currentTilt)+'°';}
function stopAnimation(){automatic=false;document.getElementById('animate-mast').textContent='演示伸缩 ↕';}
heightInput.oninput=()=>{stopAnimation();currentHeight=Number(heightInput.value);setInputs();};tiltInput.oninput=()=>{stopAnimation();currentTilt=Number(tiltInput.value);setInputs();};
document.getElementById('animate-mast').onclick=()=>{automatic=!automatic;start=performance.now();document.getElementById('animate-mast').textContent=automatic?'暂停演示 Ⅱ':'演示伸缩 ↕';};
try{
  const robot=await loadScannerRobot(app,pc);
  window.robotPreview={robot,setPose:(height,tilt=0)=>{stopAnimation();currentHeight=height;currentTilt=tilt;heightInput.value=height;tiltInput.value=tilt;setInputs();}};
  status.textContent='履带机器人已载入 · 拖动查看细节';canvas.dataset.loaded='yes';
  app.on('update',dt=>{
    if(automatic){const time=(performance.now()-start)/1000;currentHeight=.55+1.75*(.5-.5*Math.cos(time*.65));currentTilt=25*Math.sin(time*.55);heightInput.value=currentHeight;tiltInput.value=currentTilt;setInputs();}
    robot.update({xy:[0,0],yaw:0,height:currentHeight,tilt_deg:currentTilt,epoch:'studio'});
    const wide=canvas.clientWidth>650;target.lerp(target,new pc.Vec3(0,currentHeight*.48,0),1-Math.exp(-dt*6));
    const d=distance*Math.max(.65,currentHeight/1.35)*(wide?1:1.15),cp=Math.cos(pitch);
    camera.setPosition(d*Math.cos(yaw)*cp,target.y+d*Math.sin(pitch),d*Math.sin(yaw)*cp);camera.lookAt(target);
  });
  const resize=()=>{const r=canvas.parentElement.getBoundingClientRect();app.resizeCanvas(Math.round(r.width),Math.round(r.height));};new ResizeObserver(resize).observe(canvas.parentElement);resize();app.start();
}catch(error){status.textContent='机器人模型加载失败';const message=document.getElementById('error');message.textContent=String(error);message.hidden=false;console.error(error);}
canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw-=(e.clientX-drag.x)*.007;pitch=Math.max(-.05,Math.min(1.2,pitch+(e.clientY-drag.y)*.005));drag={x:e.clientX,y:e.clientY};});
canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(1.8,Math.min(7,distance*Math.exp(e.deltaY*.001)));},{passive:false});
