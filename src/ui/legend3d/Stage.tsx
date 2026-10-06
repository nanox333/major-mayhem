import React, { useEffect, useRef } from 'react';
import * as T from 'three';
import type { LegendKind } from '../../game/match';
import type { Lineup } from '../../game/lineup';
import { NoscopeCard } from './NoscopeCard';
import { highlightPost } from './post';
import { highlightReflections } from './lighting';
import { instantiateNoscope, disposeKit } from './assets';
import { createNoscope } from './noscope';
import { legendHold } from './hold';
import { NOSCOPE_CUT, NOSCOPE_DURATION, NOSCOPE_HIT, NOSCOPE_SHOT, noscopeTime, noscopeTitleAge } from './timeline';

/** Extend this registry when another real-time highlight is implemented. */
export const CINEMATICS: Partial<Record<LegendKind, { duration: number }>> = { noscope: { duration: NOSCOPE_DURATION } };
export const hasCinematic = (kind: LegendKind) => !!CINEMATICS[kind];
export const CINEMATIC_FPS = 60; // Scrubber step size; playback always uses elapsed time.
export const highlightDiagnostics = { renderers: 0, loops: 0, observers: 0, last: { frames: 0, fps: 0, calls: 0, triangles: 0, geometries: 0, textures: 0, dpr: 0, quality: 'high' } };
if (typeof window !== 'undefined' && location.search.includes('debug')) Object.assign(window, { __mmHighlights: highlightDiagnostics });

export function Stage({ kind, at, who, map, round, onReady, onError, onFrame, onEnded }: {
  kind: LegendKind; at?: number | null; who?: Lineup; map?: string; round?: number; onReady?: (duration: number) => void; onError?: () => void;
  onFrame?: (time: number) => void; onEnded?: () => void;
}) {
  const title=useRef<HTMLDivElement>(null),cross=useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const callbacks = useRef({ onReady, onError, onFrame, onEnded }); callbacks.current = { onReady, onError, onFrame, onEnded };
  const time = useRef(at); time.current = at;
  const redraw = useRef<(() => void) | null>(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas || !hasCinematic(kind)) return;
    let renderer: T.WebGLRenderer | undefined, world: ReturnType<typeof createNoscope> | undefined, observer: ResizeObserver | undefined, reflections: T.WebGLRenderTarget | undefined;
    let post: ReturnType<typeof highlightPost> | undefined;
    let warming = false, dead = false, failed = false, raf = 0, start = 0, previous = 0, total = 0, frames = 0, low = false, activeLoop = false;
    const stopLoop = () => { cancelAnimationFrame(raf); if (activeLoop) { activeLoop = false; highlightDiagnostics.loops--; } };
    const fail = () => { if (dead || failed) return; failed = true; clearTimeout(loadingTimeout); stopLoop(); callbacks.current.onError?.(); };
    const loadingTimeout = setTimeout(fail, 4500);
    const lost = (event: Event) => { event.preventDefault(); fail(); };
    canvas.addEventListener('webglcontextlost', lost);
    const fit = () => {
      if (!renderer || !world) return;
      const r = canvas.getBoundingClientRect(); const mobile = r.width < 600 || matchMedia('(pointer: coarse)').matches;
      low ||= mobile || (navigator.hardwareConcurrency || 4) <= 4;
      renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio || 1, 1.5));
      renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);
      world.camera.aspect = r.width / Math.max(1,r.height); world.camera.updateProjectionMatrix();
      if (low) world.setLowQuality();
      post?.resize(Math.max(1,r.width),Math.max(1,r.height),renderer.getPixelRatio(),low);
    };
    const draw = (t: number) => {
      if (dead || failed || !renderer || !world) return;
      world.update(t); post!.render(t);
      const state=noscopeTime(t);
      title.current?.style.setProperty('--reveal',String(state.reveal));title.current?.style.setProperty('--endcard-age',String(noscopeTitleAge(t)));
      title.current?.style.setProperty('--title-pop',String(state.titleScale));
      canvas.dataset.time = t.toFixed(4); canvas.dataset.phase = t < NOSCOPE_SHOT ? 'aim' : t < NOSCOPE_CUT ? 'shot' : t < NOSCOPE_HIT ? 'flight' : state.reveal < .5 ? 'impact' : 'reveal';
      cross.current?.style.setProperty('--cross',String(state.cross));
      if(world.crosshair){cross.current?.style.setProperty('--cx',`${world.crosshair.x*100}%`);cross.current?.style.setProperty('--cy',`${world.crosshair.y*100}%`);}
      highlightDiagnostics.last = {frames,fps: total ? frames/total : 0,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,dpr:renderer.getPixelRatio(),quality:low?'low':'high'};
      if (!warming) callbacks.current.onFrame?.(t);
    };
    redraw.current = () => draw(time.current ?? 0);
    const tick = (n: number) => {
      if (dead || failed) return;
      if (legendHold.on) start = n;
      const t = (n-start)/1000; frames++; total = t;
      if (frames > 20 && !low && n-previous > 30 && frames/Math.max(t,.01) < 45) { low = true; fit(); }
      previous=n; draw(Math.min(t,NOSCOPE_DURATION));
      if (noscopeTime(t).done) { stopLoop(); callbacks.current.onEnded?.(); }
      else raf = requestAnimationFrame(tick);
    };
    try {
      renderer = new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
      highlightDiagnostics.renderers++;
      renderer.outputColorSpace = T.SRGBColorSpace; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure=.82;
      renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFShadowMap;
      instantiateNoscope().then(async kit => {
        if (dead || failed) { disposeKit(kit); return; }
        world=createNoscope(kit); reflections=highlightReflections(renderer!); world.scene.environment=reflections.texture; world.scene.environmentIntensity=.65; post=highlightPost(renderer!,world.scene,world.camera); fit(); world.update(time.current??0);
        observer=new ResizeObserver(()=>{fit(); if(time.current!=null)draw(time.current);}); observer.observe(canvas); highlightDiagnostics.observers++;
        await renderer!.compileAsync(world.scene,world.camera);
        if(dead || failed)return; clearTimeout(loadingTimeout);
        // draw the beats once (shot, flight, impact, fall) so every effect's shader is compiled and uploaded before the clock starts; the sound cues are skipped
        warming=true; try { for (const w of [1.4, 2.5, NOSCOPE_HIT + .05, NOSCOPE_HIT + .5, NOSCOPE_DURATION - .3]) draw(w); } finally { warming=false; }
        draw(time.current??0); callbacks.current.onReady?.(NOSCOPE_DURATION);
        if(time.current==null) {start=previous=performance.now(); activeLoop=true; highlightDiagnostics.loops++; raf=requestAnimationFrame(tick);}
      }).catch(fail);
    } catch { fail(); }
    return () => {
      dead=true; clearTimeout(loadingTimeout); stopLoop(); redraw.current=null; canvas.removeEventListener('webglcontextlost',lost);
      if(observer) {observer.disconnect(); highlightDiagnostics.observers--;}
      post?.dispose(); world?.dispose(); reflections?.dispose(); if(renderer) {renderer.dispose();
        // StrictMode reuses the connected canvas for its second effect. Losing that
        // context would also kill the replacement renderer on the following frame.
        if (!canvas.isConnected) renderer.forceContextLoss();
        highlightDiagnostics.renderers--;}
    };
  }, [kind]);
  useEffect(() => { redraw.current?.(); },[at]);
  return <><canvas ref={ref} className="lg3d" data-highlight="noscope" aria-hidden="true" /><div className="lg3d-vignette" aria-hidden="true" /><div ref={cross} className="lg3d-cross" aria-hidden="true"><i /><i /><i /><i /></div><div className="lg3d-frame" aria-hidden="true" />{at!=null&&<div ref={title} className="lg3d-title lg3d-title--card" aria-hidden="true"><NoscopeCard who={who} map={map} round={round} /></div>}</>;
}
