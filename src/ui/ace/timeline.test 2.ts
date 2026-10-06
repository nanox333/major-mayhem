import { describe,expect,it } from 'vitest';
import { ACE_DURATION,ACE_LEAD_IN,ACE_HITS,aceTime,aceLayout } from './timeline';
describe('ACE screen-space clock',()=>{
  it('punches five marks in order and reveals ACE only after the fifth',()=>{
    expect(aceTime(0).hits).toBe(0);
    expect(aceTime(ACE_LEAD_IN)).toMatchObject({hits:0,dim:.55,flash:0});
    ACE_HITS.forEach((t,i)=>{expect(aceTime(t-.001).hits).toBe(i);expect(aceTime(t).hits).toBe(i+1);expect(aceTime(t).reveal).toBe(0);});
    expect(aceTime(2.06+ACE_LEAD_IN).reveal).toBe(1);
  });
  it('completes at the same elapsed time at 30, 60 and 120 fps',()=>{
    for(const fps of [30,60,120]){
      const firstDone=Array.from({length:Math.ceil((ACE_DURATION+1)*fps)},(_,i)=>i/fps).find(t=>aceTime(t).done)!;
      expect(firstDone).toBeGreaterThanOrEqual(ACE_DURATION);expect(firstDone).toBeLessThan(ACE_DURATION+1/fps);
      expect(aceTime(firstDone).fade).toBe(0);
    }
  });
  it('seeks backwards without retaining hit or reveal state',()=>{
    aceTime(2.4+ACE_LEAD_IN);expect(aceTime(.6+ACE_LEAD_IN)).toMatchObject({hits:2,reveal:0,done:false});
  });
  it('adapts composition and sizes to phones, tablets and desktop',()=>{
    for(const [w,h] of [[320,700],[390,844],[768,1024],[1280,720]]){
      const layout=aceLayout(w,h);expect(layout.positions).toHaveLength(5);
      for(const [x,y] of layout.positions){expect(x).toBeGreaterThan(.2);expect(x).toBeLessThan(.8);expect(y).toBeGreaterThan(.15);expect(y).toBeLessThan(.85);}
      expect(layout.radius*2).toBeLessThan(w*.2);
    }
    expect(aceLayout(390,844).positions).not.toEqual(aceLayout(1280,720).positions);
  });
  it('reveals the player after ACE and gives them time to be read',()=>{
    expect(aceTime(2.06+ACE_LEAD_IN).identity).toBe(0);
    expect(aceTime(2.4+ACE_LEAD_IN).identity).toBe(1);
    expect(aceTime(4+ACE_LEAD_IN).fade).toBe(1);
    expect(aceTime(.6+ACE_LEAD_IN).identity).toBe(0);
  });
});
