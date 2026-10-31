/** Full-scene Gaussian RGB captures at the authoritative, latched scan pose. */
export function scanCameraPose(pose,index){
  const a=index*Math.PI/2,yaw=pose.yaw||0,tilt=(pose.tilt_deg||0)*Math.PI/180;
  const ca=Math.cos(a),sa=Math.sin(a),cy=Math.cos(yaw),sy=Math.sin(yaw),ct=Math.cos(tilt),st=Math.sin(tilt);
  const f=[cy*ct*ca-sy*sa,sy*ct*ca+cy*sa,-st*ca],u=[cy*st,sy*st,ct];
  return {position:[pose.xy[0]+.105*f[0],pose.height+.105*f[2],-pose.xy[1]-.105*f[1]],forward:[f[0],f[2],-f[1]],up:[u[0],u[2],-u[1]]};
}

export class RawCameraRig {
  constructor(app,pc,demand){
    this.app=app;this.pc=pc;this.demand=demand;this.loaded=false;this.loading=false;this.pending=null;this.active=null;this.reading=false;this.generation=0;this.epoch=null;this.lastKey=null;this.frames=0;this.cameras=[];this.captures=0;
    this.canvas=document.getElementById('raw-ring');this.message=document.getElementById('sensor-empty');this.status=document.getElementById('sensor-status');
    this.app.on('postrender',()=>this.postrender());
    this.app.systems.gsplat.on('frame:ready',(camera,layer,ready)=>{if(this.active&&layer===this.layer&&camera===this.cameras[this.active.index]?.camera&&ready)this.active.ready=true;});
  }
  get busy(){return Boolean(this.pending||this.active||this.reading);}
  accept(state){
    if(state.scene!=='restaurant'){this.clear();return;}
    if(this.epoch!==state.epoch){this.clear();this.epoch=state.epoch;this.message.textContent='正在加载餐厅原景相机…';this.message.hidden=false;}
    if(!this.loaded&&!this.loading&&!this.failed)this.load(state.scene_info);
    const scan=state.scans||0,key=`${state.epoch}:${scan}`;
    if(key===this.lastKey||key===this.pending?.key||key===this.active?.key)return;
    const source=state.scan_pose||state.history?.at(-1)||state;
    this.pending={key,scan,epoch:state.epoch,pose:{xy:[...source.xy],height:source.height,tilt_deg:source.tilt_deg,yaw:source.yaw||0},generation:this.generation};
    this.status.textContent=scan?`正在渲染第 ${scan} 次原景观测`:'正在生成原景相机预览';
    this.demand();
  }
  clear(){
    this.generation++;this.pending=null;this.active=null;this.lastKey=null;
    for(const camera of this.cameras)camera.enabled=false;
    this.canvas.hidden=true;delete this.canvas.dataset.captureKey;
  }
  async load(info){
    this.loading=true;const pc=this.pc;
    try{
      this.layer=new pc.Layer({name:'OriginalRestaurantSensor'});this.app.scene.layers.push(this.layer);
      const asset=new pc.Asset('CompleteRestaurantSensorScene','gsplat',{url:info.full_visual_url});
      this.app.assets.add(asset);
      await new Promise((resolve,reject)=>{asset.ready(resolve);asset.once('error',reject);this.app.assets.load(asset);});
      this.environment=new pc.Entity('CompleteRestaurantGaussian');this.environment.setEulerAngles(180,0,0);this.environment.setPosition(0,.07,0);
      this.environment.addComponent('gsplat',{asset,layers:[this.layer.id]});this.app.root.addChild(this.environment);
      this.texture=new pc.Texture(this.app.graphicsDevice,{name:'OriginalCameraAtlas',width:1280,height:240,format:pc.PIXELFORMAT_R8_G8_B8_A8,mipmaps:false,minFilter:pc.FILTER_LINEAR,magFilter:pc.FILTER_LINEAR});
      this.target=new pc.RenderTarget({colorBuffer:this.texture,depth:true,samples:1});
      for(let i=0;i<4;i++){
        const entity=new pc.Entity('OriginalCamera'+i);
        entity.addComponent('camera',{renderTarget:this.target,layers:[this.layer.id],nearClip:.05,farClip:50,fov:75,
          aspectRatioMode:pc.ASPECT_MANUAL,aspectRatio:4/3,rect:new pc.Vec4(i/4,0,.25,1),scissorRect:new pc.Vec4(i/4,0,.25,1),
          priority:-10+i,clearColor:new pc.Color(.045,.065,.075),clearColorBuffer:true,clearDepthBuffer:true});
        entity.enabled=false;this.app.root.addChild(entity);this.cameras.push(entity);
      }
      this.loaded=true;this.loading=false;this.demand();
    }catch(error){
      this.loading=false;this.failed=true;this.pending=null;this.status.textContent='原景相机加载失败';this.message.textContent='原始餐厅相机暂不可用，请刷新重试。';this.message.hidden=false;
      console.error('Original camera asset:',error);this.demand();
    }
  }
  pump(){
    if(!this.loaded||this.active||this.reading||!this.pending)return;
    this.active=this.pending;this.pending=null;this.active.index=0;this.active.frames=0;this.active.started=performance.now();this.active.faceStarted=performance.now();
    for(let i=0;i<4;i++){
      const p=scanCameraPose(this.active.pose,i),entity=this.cameras[i];entity.setPosition(...p.position);
      entity.lookAt(new this.pc.Vec3(...p.position.map((v,j)=>v+p.forward[j])),new this.pc.Vec3(...p.up));
      entity.enabled=i===0;
    }
    this.demand();
  }
  postrender(){
    const job=this.active;
    if(!job||this.reading)return;
    job.frames++;
    // Let the asynchronous Gaussian camera sort settle, without blocking animation.
    if(!job.ready||job.frames<3||performance.now()-job.faceStarted<120)return;
    this.cameras[job.index].enabled=false;job.index++;job.ready=false;job.frames=0;job.faceStarted=performance.now();
    if(job.index<4){this.cameras[job.index].enabled=true;return;}
    this.active=null;this.reading=true;this.demand();
    this.app.graphicsDevice.readTextureAsync(this.texture,0,0,1280,240,{renderTarget:this.target,immediate:true}).then(pixels=>{
      if(job.generation!==this.generation)return;
      const rgba=new Uint8ClampedArray(pixels.length),stride=1280*4;
      for(let row=0;row<240;row++)rgba.set(pixels.subarray((239-row)*stride,(240-row)*stride),row*stride);
      this.canvas.getContext('2d').putImageData(new ImageData(rgba,1280,240),0,0);
      this.canvas.hidden=false;this.canvas.dataset.source='original-gaussian';this.canvas.dataset.captureKey=job.key;this.canvas.dataset.scan=String(job.scan);
      this.canvas.dataset.pose=JSON.stringify(job.pose);this.lastKey=job.key;this.captures++;
      this.message.hidden=true;this.status.textContent=job.scan?`第 ${job.scan} 次原景观测`:'原景相机预览 · 尚未扫描';
      window.dispatchEvent(new CustomEvent('raw-camera-ready',{detail:{key:job.key,scan:job.scan,pose:job.pose,elapsedMs:performance.now()-job.started}}));
    }).catch(error=>{console.error('Original camera capture:',error);this.status.textContent='原景图像读取失败';}).finally(()=>{this.reading=false;this.demand();});
  }
}
