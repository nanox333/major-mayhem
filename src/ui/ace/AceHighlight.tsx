import React, { useEffect, useRef, useState } from 'react';
import * as T from 'three';
import { play } from '../sound';
import type { Lineup } from '../../game/lineup';
import { Avatar, TeamBadge } from '../art';
const hole=`${import.meta.env.BASE_URL}assets/highlights/ace/glass-detail.webp`;
import { createAceScene } from './scene';
import { legendHold } from '../legend3d/hold';
import { AceMark } from './AceMark';
import { Title3D } from '../endcard/Title3D';
import { ACE_DURATION, ACE_HITS, ACE_LEAD_IN, ACE_REVEAL, aceLayout, aceTime } from './timeline';

export const aceDiagnostics = { renderers:0, loops:0, observers:0, last:{calls:0,triangles:0,geometries:0,textures:0,fps:0,dpr:0} };
if(typeof location!=='undefined' && location.search.includes('debug')) Object.assign(window,{__mmAce:aceDiagnostics});

/** Transparent screen-space highlight. The same clock drives WebGL, HTML, fallback and scrubbing. */
export function AceHighlight({onComplete,at,still=false,who,map,round}: {onComplete?:()=>void;at?:number|null;still?:boolean;who?:Lineup;map?:string;round?:number}) {
  const root=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);
  const [fallback,setFallback]=useState(false);
  const callbacks=useRef(onComplete);callbacks.current=onComplete;
  const time=useRef(at);time.current=at;
  const redraw=useRef<(()=>void)|null>(null);
  useEffect(()=>{
    const el=root.current,c=canvas.current;if(!el||!c)return;
    let renderer:T.WebGLRenderer|undefined,world:ReturnType<typeof createAceScene>|undefined;
    let dead=false,finished=false,raf=0,loop=false,frames=0,width=1,height=1,lastTime=0;
    let start=performance.now();const cues=new Set<number>(),stops:(()=>void)[]=[];
    const grain=document.createElement('canvas');grain.width=grain.height=128;
    const grainCtx=grain.getContext('2d');
    if(grainCtx){const pixels=grainCtx.createImageData(128,128);let seed=172;
      for(let i=0;i<pixels.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const value=seed>>>24;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=100;}
      grainCtx.putImageData(pixels,0,0);el.style.setProperty('--ace-grain',`url(${grain.toDataURL()})`);
    }
    const stop=()=>{cancelAnimationFrame(raf);if(loop){loop=false;aceDiagnostics.loops--;}};
    const release=()=>{
      world?.dispose();world=undefined;
      if(renderer){
        const retired=renderer;retired.dispose();renderer=undefined;aceDiagnostics.renderers--;
        // React StrictMode reuses the canvas during its effect replay. Lose the context
        // only after the canvas actually leaves the DOM, so the next setup can reuse it.
        queueMicrotask(()=>{if(!c.isConnected)retired.forceContextLoss();});
      }
    };
    const fail=()=>{release();setFallback(true);};
    const lost=(event:Event)=>{event.preventDefault();fail();};c.addEventListener('webglcontextlost',lost);
    const fit=()=>{
      const r=el.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);
      const layout=aceLayout(width,height);
      el.style.setProperty('--ace-radius',`${layout.radius}px`);
      el.querySelectorAll<HTMLElement>('.ace-fallback__hit').forEach((hit,i)=>{hit.style.left=`${layout.positions[i][0]*100}%`;hit.style.top=`${layout.positions[i][1]*100}%`;const diameter=layout.radius*(.9+i*.075)*(i===4?1.3:1)*6.4;hit.style.width=hit.style.height=`${diameter}px`;});
      if(renderer){renderer.setPixelRatio(layout.mobile?1:Math.min(devicePixelRatio||1,1.5));renderer.setSize(width,height,false);world?.resize(width,height);}
    };
    const draw=(seconds:number)=>{
      if(dead)return;
      const t=still?2.5+ACE_LEAD_IN:seconds,state=aceTime(t);lastTime=t;
      el.dataset.time=t.toFixed(4);el.dataset.hits=String(state.hits);el.dataset.reveal=String(state.reveal>0);
      el.style.setProperty('--ace-fade',String(state.fade));el.style.setProperty('--ace-dim',String(state.dim));
      el.style.setProperty('--ace-person',String(state.identity));el.style.setProperty('--ace-person-y',`${(1-state.identity)*18}px`);
      el.style.setProperty('--ace-reveal',String(state.reveal));el.style.setProperty('--endcard-age',String(t-ACE_REVEAL));el.style.setProperty('--ace-lines',String(state.lines));
      el.style.setProperty('--ace-flash',String(still?0:state.flash));
      el.style.setProperty('--ace-blur',`${(1-state.reveal)*3}px`);el.style.setProperty('--ace-scale',String(1+(1-state.reveal)*.32));
      el.querySelectorAll<HTMLElement>('.ace-fallback__hit').forEach((hit,i)=>{
        const age=t-ACE_HITS[i];hit.style.opacity=age>=0?'1':'0';
        hit.style.setProperty('--hit-scale','1');
        hit.style.setProperty('--hit-flash',age>=0&&age<.055?'1':'0');
      });
      if(renderer&&world){world.update(t);renderer.render(world.scene,world.camera);aceDiagnostics.last={calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,fps:seconds>0?frames/seconds:0,dpr:renderer.getPixelRatio()};}
      if(time.current==null&&!still){
        ACE_HITS.forEach((when,i)=>{if(t>=when&&!cues.has(i)){cues.add(i);stops.push(play('shot',{pitch:i===4?.83:1.08-i*.035}));}});
        if(t>=ACE_REVEAL&&!cues.has(5)){cues.add(5);stops.push(play('clutch'));}
      }
    };
    try{
      if(still)throw new Error('Reduced motion');
      renderer=new T.WebGLRenderer({canvas:c,alpha:true,antialias:true,powerPreference:'low-power'});aceDiagnostics.renderers++;
      renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;
      world=createAceScene(renderer,()=>redraw.current?.());
    }catch{fail();}
    fit();
    const observer=new ResizeObserver(()=>{try{fit();draw(time.current??lastTime);}catch{fail();}});observer.observe(el);aceDiagnostics.observers++;
    redraw.current=()=>{try{draw(time.current??0);}catch{fail();draw(time.current??0);}};
    const tick=(now:number)=>{
      if(dead)return;frames++;if(legendHold.on)start=now;
      const t=Math.max(0,Math.min((now-start)/1000,ACE_DURATION));
      try{draw(t);}catch{fail();}
      if(t>=ACE_DURATION){stop();if(!finished){finished=true;callbacks.current?.();}}
      else raf=requestAnimationFrame(tick);
    };
    redraw.current();
    if(time.current==null){loop=true;aceDiagnostics.loops++;raf=requestAnimationFrame(tick);}
    return()=>{dead=true;stop();redraw.current=null;observer.disconnect();aceDiagnostics.observers--;c.removeEventListener('webglcontextlost',lost);release();stops.forEach(fn=>fn());};
  },[still]);
  useEffect(()=>{redraw.current?.();},[at]);
  return <div ref={root} className={`ace-highlight${who?' ace-highlight--person':''}`} data-highlight="ace" data-mode={fallback?'fallback':'webgl'} aria-hidden="true">
    <div className="ace-grade" /><div className="ace-dim" /><div className="ace-screen-flash" />
    <div className="ace-surface">
      <canvas ref={canvas} className="ace-canvas" style={{display:fallback?'none':undefined}} />
      {<div className="ace-fallback" style={{display:fallback?'block':'none'}}>{ACE_HITS.map((_,i)=><div className={`ace-fallback__hit ace-fallback__hit--${i}`} key={i}><img src={hole} alt="" /><i /></div>)}</div>}
      <div className="ace-frame" /><Title3D name="ace" fallback={<div className="ace-title"><AceMark /></div>} />
      {who && <div className="ace-person">
        <div className="ace-person__portrait"><Avatar player={who.player} roster={who.roster} /></div>
        <div className="ace-person__info"><span className="ace-person__kicker">Five kills. One player.</span><strong>{who.player.nick}</strong>
          <span className="ace-person__team"><TeamBadge roster={who.roster} size={20} />{who.roster.org} · {who.roster.year}</span>
          {map && <span className="ace-person__round">{map}{round!=null?` · Round ${round}`:''}</span>}
        </div>
        <span className="ace-person__kills" aria-hidden="true">{ACE_HITS.map((_,i)=><i key={i}/>)}</span>
      </div>}

    </div>
    <div className="ace-vignette" /><div className="ace-grain" />
  </div>;
}
