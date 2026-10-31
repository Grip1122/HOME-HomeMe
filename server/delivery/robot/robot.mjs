/** RoomScan RS-01: articulated crawler, telescopic mast and ring-camera head. */
function studioReflections(app,pc){
  if(app.scene.envAtlas)return;
  // Procedural studio illumination: no HDR download or network dependency.
  const width=256,height=128,data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const latitude=(.5-y/height)*Math.PI,longitude=(x/width-.5)*Math.PI*2;
    const dx=Math.cos(latitude)*Math.cos(longitude),dy=Math.sin(latitude),dz=Math.cos(latitude)*Math.sin(longitude);
    const sky=.28+.35*Math.max(0,dy);
    const window=Math.pow(Math.max(0,dx*.45+dy*.75+dz*.48),36)*.62;
    const fill=Math.pow(Math.max(0,-dx*.65+dy*.55-dz*.52),12)*.24;
    const i=(y*width+x)*4;
    data[i]=Math.min(255,255*(sky*.92+window+fill*.75));data[i+1]=Math.min(255,255*(sky+window*.97+fill*.91));data[i+2]=Math.min(255,255*(sky*1.07+window*.9+fill));data[i+3]=255;
  }
  const source=new pc.Texture(app.graphicsDevice,{name:'RobotStudioIllumination',width,height,format:pc.PIXELFORMAT_RGBA8,projection:pc.TEXTUREPROJECTION_EQUIRECT,mipmaps:false,levels:[data]});
  const lighting=pc.EnvLighting.generateLightingSource(source,{size:64});
  app.scene.envAtlas=pc.EnvLighting.generateAtlas(lighting,{size:256,numReflectionSamples:64,numAmbientSamples:128});
  source.destroy();lighting.destroy();
}

export async function loadScannerRobot(app,pc){
  const assets=new URL('../assets/robot/',import.meta.url);
  const asset=new pc.Asset('RoomScan RS-01','container',{url:new URL('roomscan-rs01.glb',assets).href});
  app.assets.add(asset);
  const [metadata]=await Promise.all([fetch(new URL('manifest.json',assets)).then(r=>{if(!r.ok)throw new Error('Robot manifest unavailable');return r.json();}),new Promise((resolve,reject)=>{asset.ready(resolve);asset.once('error',reject);app.assets.load(asset);})]);
  studioReflections(app,pc);
  const root=asset.resource.instantiateRenderEntity({castShadows:true,receiveShadows:true});
  root.name='ScannerRobot';app.root.addChild(root);
  const stages=[1,2,3,4].map(i=>root.findByName('MastStage'+i));
  const head=root.findByName('CameraHead'),left=root.findByName('WheelLeft'),right=root.findByName('WheelRight');
  if(stages.some(s=>!s)||!head||!left||!right)throw new Error('Robot asset is missing articulated nodes');
  const tracks=metadata.tracks;
  const profile=tracks.profile,segments=profile.map((p,i)=>{const next=profile[(i+1)%profile.length];return {point:p,dx:next[0]-p[0],dz:next[1]-p[1],length:Math.hypot(next[0]-p[0],next[1]-p[1])};});
  const perimeter=segments.reduce((sum,s)=>sum+s.length,0);
  const links=['Left','Right'].map(side=>Array.from({length:tracks.links_per_side},(_,i)=>root.findByName('Tread'+side+String(i).padStart(2,'0'))));
  const rollers=['Left','Right'].map(side=>['Front','Rear'].map(suffix=>root.findByName('Wheel'+side+suffix)));
  let previous=null,leftAngle=0,rightAngle=0,leftTravel=0,rightTravel=0;
  const deg=180/Math.PI;
  const placeTrack=(nodes,offset,side)=>nodes.forEach((node,i)=>{
    if(!node)return;
    let distance=((i*perimeter/nodes.length-offset)%perimeter+perimeter)%perimeter;
    for(const s of segments){if(distance<=s.length){node.setLocalPosition(s.point[0]+s.dx*distance/s.length,s.point[1]+s.dz*distance/s.length,-side*tracks.center_y_m);node.setLocalEulerAngles(0,0,Math.atan2(s.dz,s.dx)*deg);break;}distance-=s.length;}
  });
  const update=pose=>{
    root.setPosition(pose.xy[0],0,-pose.xy[1]);root.setEulerAngles(0,(pose.yaw||0)*deg,0);
    const extension=(pose.height-.55)/4;
    stages.forEach((stage,i)=>stage.setLocalPosition(0,(i===0?.55:0)+extension,0));
    head.setLocalEulerAngles(0,0,-(pose.tilt_deg||0));
    if(previous&&previous.epoch===pose.epoch){
      const turn=Math.atan2(Math.sin((pose.yaw||0)-previous.yaw),Math.cos((pose.yaw||0)-previous.yaw));
      const mid=previous.yaw+turn/2;
      const travel=(pose.xy[0]-previous.xy[0])*Math.cos(mid)+(pose.xy[1]-previous.xy[1])*Math.sin(mid);
      if(Math.abs(travel)<.4&&Math.abs(turn)<.6){leftTravel+=travel-tracks.center_y_m*turn;rightTravel+=travel+tracks.center_y_m*turn;leftAngle=leftTravel/tracks.drive_radius_m;rightAngle=rightTravel/tracks.drive_radius_m;}
    }else{leftAngle=0;rightAngle=0;leftTravel=0;rightTravel=0;}
    left.setLocalEulerAngles(0,0,-leftAngle*deg);right.setLocalEulerAngles(0,0,-rightAngle*deg);
    rollers[0].forEach(w=>w?.setLocalEulerAngles(0,0,-leftTravel/tracks.roller_radius_m*deg));rollers[1].forEach(w=>w?.setLocalEulerAngles(0,0,-rightTravel/tracks.roller_radius_m*deg));
    placeTrack(links[0],leftTravel,1);placeTrack(links[1],rightTravel,-1);
    previous={xy:[...pose.xy],yaw:pose.yaw||0,epoch:pose.epoch};
  };
  update({xy:[0,0],height:1.15,yaw:0,tilt_deg:0,epoch:'preview'});
  return {root,update,head,stages,diagnostics:()=>({model:'RoomScan RS-01 Crawler',head:head.getPosition().toArray(),stages:stages.map(s=>s.getLocalPosition().y),leftAngle,rightAngle,leftTravel,rightTravel,trackLinks:links.map(s=>s.filter(Boolean).length)})};
}
