import * as pc from '/vendor/playcanvas.mjs';
import {PoseBuffer} from '/motion.mjs';
import {RawCameraRig} from '/raw-camera.mjs';
import {loadScannerRobot} from '/robot.mjs';

let app=null,camera=null,splat=null,robot=null,marker=null,loaded=false,loading=false,current=null;
let visible=false,follow=true,detail=false,drag=null,lastSize='';
let target=new pc.Vec3(0,.8,0),yaw=.7,pitch=.72,distance=5.8;
const poses=new PoseBuffer(100);
let rawRig=null,traceLines=[],lastMapTime=0,renderCount=0,poseCount=0;
const canvas=document.getElementById('restaurant-view');
const placeholder=document.getElementById('scene-placeholder');
const status=message=>{if(visible){placeholder.textContent=message;placeholder.hidden=!message;}};

function material(color){const m=new pc.StandardMaterial();m.diffuse=new pc.Color(...color);m.emissive=new pc.Color(...color.map(x=>x*.25));m.metalness=.25;m.useMetalness=true;m.update();return m;}
function primitive(name,type,scale,color,parent){const entity=new pc.Entity(name);entity.addComponent('render',{type,material:material(color)});entity.setLocalScale(...scale);parent.addChild(entity);return entity;}
function positionCamera(){if(!camera)return;const cp=Math.cos(pitch);camera.setPosition(target.x+Math.cos(yaw)*distance*cp,target.y+Math.sin(pitch)*distance,target.z+Math.sin(yaw)*distance*cp);camera.lookAt(target);}
function resize(){if(!app||!visible)return;const r=document.getElementById('viewport').getBoundingClientRect(),size=`${Math.round(r.width)}x${Math.round(r.height)}`;if(r.width&&r.height&&size!==lastSize){app.resizeCanvas(Math.round(r.width),Math.round(r.height));lastSize=size;}}
function demand(){if(app){camera.enabled=visible;app.autoRender=visible||Boolean(rawRig?.busy);}}

async function initialize(info){
  if(app||loading)return;loading=true;status('正在加载真实餐厅高斯场景（约 11 MB）…');
  try{
    app=new pc.Application(canvas,{graphicsDeviceOptions:{antialias:false,alpha:false,powerPreference:'high-performance'}});
    app.setCanvasFillMode(pc.FILLMODE_NONE);
    app.setCanvasResolution(pc.RESOLUTION_AUTO);
    app.graphicsDevice.maxPixelRatio=1;
    camera=new pc.Entity('ViewCamera');camera.addComponent('camera',{clearColor:new pc.Color(.045,.065,.075),nearClip:.05,farClip:100,fov:60});app.root.addChild(camera);
    rawRig=new RawCameraRig(app,pc,demand);rawRig.accept(current);
    const light=new pc.Entity('RobotLight');light.addComponent('light',{type:'directional',color:new pc.Color(.9,1,1),intensity:1.5});light.setEulerAngles(45,20,0);app.root.addChild(light);app.scene.ambientLight=new pc.Color(.5,.5,.5);
    robot=await loadScannerRobot(app,pc);
    marker=primitive('NextScan','sphere',[.14,.14,.14],[1,.67,.22],app.root);marker.enabled=false;
    app.on('update',dt=>{
      if(!current)return;
      rawRig?.pump();
      const pose=poses.sample()||current;
      if(!visible)return;
      renderCount++;window.roomscanDisplayPose=pose;
      robot.update(pose);
      if(current.target){marker.enabled=true;marker.setPosition(current.target.xy[0],.08,-current.target.xy[1]);}else marker.enabled=false;
      if(follow){target.lerp(target,new pc.Vec3(pose.xy[0],detail?pose.height*.48:.8,-pose.xy[1]),1-Math.exp(-Math.min(dt,.1)*8));if(detail)distance=Math.max(1.6,pose.height*1.4);}
      positionCamera();
      if(traceLines.length)app.drawLines(traceLines,new pc.Color(.3,1,.75));
      if(performance.now()-lastMapTime>65){window.dispatchEvent(new Event('render-pose'));lastMapTime=performance.now();}
    });
    // Standard PLY values are in the source frame. Rx(180°) maps [x,y,z] -> [x,-y,-z].
    // The backend uses [x,z,-y+0.07], and converts simulation coordinates to [x,z,-y] here.
    const asset=new pc.Asset('RestaurantGaussian','gsplat',{url:info.visual_url});
    app.assets.add(asset);
    await new Promise((resolve,reject)=>{asset.ready(resolve);asset.once('error',reject);app.assets.load(asset);});
    splat=new pc.Entity('RestaurantSplat');splat.setEulerAngles(180,0,0);splat.setPosition(0,.07,0);splat.addComponent('gsplat',{asset});app.root.addChild(splat);
    loaded=true;loading=false;canvas.dataset.loaded='yes';target.set(current.xy[0],.8,-current.xy[1]);positionCamera();resize();demand();app.start();status('');
  }catch(error){loading=false;canvas.dataset.error=String(error);status('原景加载失败，可切换“几何代理”查看服务器画面。');console.error('Restaurant renderer:',error);if(app){app.destroy();app=null;}}
}

window.restaurantRenderer={
  show(value){visible=value;canvas.hidden=!value;document.getElementById('restaurant-controls').hidden=!value;if(value){resize();if(!loaded)status('正在加载真实餐厅高斯场景…');else status('');}demand();},
  get loaded(){return loaded;},
  diagnostics(){return {renderCount,poseCount,bufferSize:poses.samples.length,displayPose:window.roomscanDisplayPose,rawCaptures:rawRig?.captures||0,robot:robot?.diagnostics()};}
};
window.addEventListener('scan-state',event=>{const s=event.detail;if(s.scene!=='restaurant'){visible=false;canvas.hidden=true;rawRig?.clear();demand();return;}current=s;if(!poses.samples.length&&s.server_time)poses.push(s);rawRig?.accept(s);traceLines=[];const trace=s.trace||[],stride=Math.max(1,Math.floor(trace.length/150));for(let i=stride;i<trace.length;i+=stride)traceLines.push(new pc.Vec3(trace[i-stride][0],.035,-trace[i-stride][1]),new pc.Vec3(trace[i][0],.035,-trace[i][1]));if(!app)initialize(s.scene_info);});
async function pollPose(){try{const response=await fetch('/api/pose');if(response.ok){const pose=await response.json();if(pose.scene==='restaurant'&&poses.push(pose))poseCount++;}}catch{}setTimeout(pollPose,50);}
pollPose();
new ResizeObserver(resize).observe(document.getElementById('viewport'));
canvas.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY,pan:event.shiftKey||event.button===2};canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointermove',event=>{if(!drag)return;follow=false;document.getElementById('follow-robot').textContent='跟随机器人';const dx=event.clientX-drag.x,dy=event.clientY-drag.y;if(drag.pan){target.x-=dx*.004*distance;target.z-=dy*.004*distance;}else{yaw-=dx*.006;pitch=Math.max(.05,Math.min(1.5,pitch+dy*.006));}drag.x=event.clientX;drag.y=event.clientY;positionCamera();});
canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',event=>{event.preventDefault();distance=Math.max(1,Math.min(35,distance*Math.exp(event.deltaY*.001)));positionCamera();},{passive:false});
document.getElementById('follow-robot').onclick=()=>{detail=false;follow=!follow;document.getElementById('follow-robot').textContent=follow?'跟随机器人 ✓':'跟随机器人';distance=5.8;pitch=.72;};
document.getElementById('robot-closeup').onclick=()=>{detail=true;follow=true;yaw=.6;pitch=.23;document.getElementById('follow-robot').textContent='跟随机器人 ✓';};
document.getElementById('restaurant-home').onclick=()=>{if(!current)return;detail=false;follow=false;document.getElementById('follow-robot').textContent='跟随机器人';target.set(-.5,.8,-1.7);distance=19;pitch=1.1;positionCamera();};
