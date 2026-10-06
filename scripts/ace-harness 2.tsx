// Browser lifecycle fixture. Loaded only by ace-e2e, never by the application.
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as G from '../src/game/logic';
import { draftedRun } from '../src/ui/debug/scenarios';
import { ACE_HITS } from '../src/ui/ace/timeline';
import { AceHighlight } from '../src/ui/ace/AceHighlight';
export function mountAce(still=false) {
  const container=document.createElement('div');container.style.cssText='position:fixed;inset:0;z-index:100000';document.body.append(container);
  const root=createRoot(container);let completed=0;
  root.render(<StrictMode><AceHighlight still={still} onComplete={()=>completed++}/></StrictMode>);
  return {completed:()=>completed,unmount:()=>{root.unmount();container.remove();}};
}

export function mountAceAt(at:number) {
  const container=document.createElement('div');container.style.cssText='position:fixed;inset:0;z-index:100000';document.body.append(container);
  const root=createRoot(container);root.render(<AceHighlight at={at} who={G.lineupFromPicks(draftedRun(7).picks)[0]} map="Mirage" round={14}/>);
  return {unmount:()=>{root.unmount();container.remove();}};
}

export async function checkFixedHoles(){
  const T=await import('three');const {createAceScene,preloadAce}=await import('../src/ui/ace/scene');
  await preloadAce();const renderer=new T.WebGLRenderer({alpha:true});const world=createAceScene(renderer);world.resize(1280,720);
  await Promise.resolve();const hole=world.scene.children.find(o=>o.name==='ace-impact-glass') as import('three').InstancedMesh;
  world.update(ACE_HITS[0]);const before=new T.Matrix4();hole.getMatrixAt(0,before);world.update(2.5);const after=new T.Matrix4();hole.getMatrixAt(0,after);
  const fixed=before.equals(after);world.dispose();renderer.dispose();renderer.forceContextLoss();return fixed;
}
