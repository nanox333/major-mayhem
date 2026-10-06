// Browser lifecycle fixture, never imported by the application.
import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Stage } from '../src/ui/legend3d/Stage';
export function mountNoscope() {
  const container=document.createElement('div');container.style.cssText='position:fixed;inset:0;z-index:100000';document.body.append(container);
  const root=createRoot(container);let completed=0;
  root.render(<StrictMode><Stage kind="noscope" onEnded={()=>completed++}/></StrictMode>);
  return {completed:()=>completed,unmount:()=>{root.unmount();container.remove();}};
}
