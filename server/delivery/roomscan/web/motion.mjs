/** Timestamped interpolation of authoritative poses; no prediction through obstacles. */
export class PoseBuffer {
  constructor(delay=100){this.delay=delay;this.samples=[];this.epoch=null;this.sequence=-1;this.offset=null;this.lastReceived=null;this.gap=50;}
  push(pose,received=performance.now()){
    if(!pose?.xy||!Number.isFinite(pose.server_time))return false;
    const epoch=pose.epoch??pose.scene;
    if(epoch!==this.epoch){this.samples=[];this.epoch=epoch;this.sequence=-1;this.offset=null;this.lastReceived=null;this.gap=50;}
    if(pose.sequence<=this.sequence)return false;
    this.sequence=pose.sequence;
    if(this.lastReceived!==null)this.gap=.65*this.gap+.35*Math.min(3000,received-this.lastReceived);
    this.lastReceived=received;
    const offset=received-pose.server_time*1000;
    this.offset=this.offset===null?offset:Math.min(this.offset,offset);
    this.samples.push({...pose,t:pose.server_time*1000});
    if(this.samples.length>90)this.samples.shift();
    return true;
  }
  sample(now=performance.now()){
    if(!this.samples.length)return null;
    const time=now-this.offset-Math.max(this.delay,Math.min(2500,this.gap>100?this.gap*1.8:0));
    while(this.samples.length>2&&this.samples[1].t<=time)this.samples.shift();
    const a=this.samples[0],b=this.samples[1];
    if(!b||time<=a.t)return a;
    if(time>=b.t)return b;
    const blend=Math.max(0,Math.min(1,(time-a.t)/(b.t-a.t)));
    const mix=(x,y)=>x+(y-x)*blend;
    const angle=((b.yaw-a.yaw+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
    return {...b,xy:[mix(a.xy[0],b.xy[0]),mix(a.xy[1],b.xy[1])],yaw:a.yaw+angle*blend,
      height:mix(a.height,b.height),tilt_deg:mix(a.tilt_deg,b.tilt_deg),interpolation:blend};
  }
}
