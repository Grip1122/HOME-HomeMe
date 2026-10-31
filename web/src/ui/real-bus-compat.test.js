// @vitest-environment jsdom
import {afterEach,describe,expect,it} from 'vitest';
import {createHud} from './index.mjs';

// Match the production bus lifecycle contract; the opt-in restaurant verifier
// separately executes A's actual eventbus.js and executor at pinned commits.
class UnsubscribeBus {
  constructor(){this.handlers=new Map();}
  on(name,fn){if(!this.handlers.has(name))this.handlers.set(name,new Set());this.handlers.get(name).add(fn);return()=>this.handlers.get(name).delete(fn);}
  emit(name,payload){for(const fn of [...(this.handlers.get(name)||[])])fn(payload);return true;}
  count(){return [...this.handlers.values()].reduce((n,s)=>n+s.size,0);}
}
const active=[];
function mount(bus=new UnsubscribeBus()){const root=document.createElement('div');document.body.append(root);const hud=createHud({bus,root});active.push(hud);return {bus,hud};}
afterEach(()=>{for(const hud of active.splice(0))hud.destroy();document.body.innerHTML='';});
describe('HUD integration lifecycle and attempted-step counts',()=>{
  it('labels the executor script source in Chinese',()=>{const {bus,hud}=mount();bus.emit('plan:received',{source:'script',steps:[],latencyMs:0});expect(hud.el.querySelector('.ht-source-badge').textContent).toContain('预置脚本');});
  it('releases on() subscriptions when the bus exposes no off()',()=>{const {bus,hud}=mount();expect(bus.off).toBeUndefined();expect(bus.count()).toBeGreaterThan(0);const el=hud.el.querySelector('.ht-state-text');hud.destroy();const before=el.textContent;bus.emit('robot:state',{from:'idle',to:'walking',taskId:'late',step:0});expect(el.textContent).toBe(before);expect(bus.count()).toBe(0);});
  it('disposing one HUD leaves other consumers subscribed',()=>{const bus=new UnsubscribeBus(),a=mount(bus).hud,b=mount(bus).hud;const old=a.el.querySelector('.ht-state-text');a.destroy();const before=old.textContent;bus.emit('robot:state',{from:'idle',to:'walking',taskId:'other',step:0});expect(old.textContent).toBe(before);expect(b.el.querySelector('.ht-state-text').textContent).toContain('前往');expect(bus.count()).toBeGreaterThan(0);});
  it('keeps 0/1 when the first real action failed but end.steps counts the attempt',()=>{const {bus,hud}=mount();bus.emit('plan:received',{source:'script',steps:[{action:'drop'}]});bus.emit('task:start',{taskId:'fail',query:'放杯子',source:'script'});bus.emit('task:step',{taskId:'fail',index:0,action:'drop',target:'cup_red',ok:false,ms:30});bus.emit('task:end',{taskId:'fail',ok:false,steps:1,durationMs:50,corrected:false});expect(hud.el.querySelector('.ht-progress i').style.width).toBe('0%');expect(hud.el.querySelector('.ht-step-indicator').textContent).toContain('0/1');expect(hud.el.querySelector('.ht-timeline').textContent).toContain('0/1');});
  it('counts one success out of four rather than two attempted steps',()=>{const {bus,hud}=mount();bus.emit('plan:received',{source:'script',steps:[{},{},{},{}]});bus.emit('task:start',{taskId:'partial',query:'找杯子',source:'script'});bus.emit('task:step',{taskId:'partial',index:0,action:'go',target:'restaurant',ok:true,ms:20});bus.emit('task:step',{taskId:'partial',index:1,action:'grab',target:'cup_red',ok:false,ms:30});bus.emit('task:end',{taskId:'partial',ok:false,steps:2,durationMs:50,corrected:false});expect(hud.el.querySelector('.ht-progress i').style.width).toBe('25%');expect(hud.el.querySelector('.ht-timeline').textContent).toContain('1/4');});
});
