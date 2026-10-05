import React, { useEffect, useRef, useState } from 'react';
import type { LegendKind } from '../../game/match';

/** Native Blender renders, downloaded only when their moment is shown. */
export const CINEMATICS: Partial<Record<LegendKind, { landscape: string; portrait: string; duration: number }>> = {
  noscope: { landscape: 'legend/noscope.mp4', portrait: 'legend/noscope-portrait.mp4', duration: 146 / 30 },
};
export const hasCinematic = (kind: LegendKind) => !!CINEMATICS[kind];
export const CINEMATIC_FPS = 30;

type CinematicCanvas = HTMLCanvasElement & { cinematicVideo?: HTMLVideoElement };

/** Decode off the DOM and draw to canvas: hover media extensions cannot discover a video element or its URL. */
export function Stage({ kind, at, onReady, onError, onFrame, onEnded }: {
  kind: LegendKind; at?: number | null; onReady?: (duration: number) => void; onError?: () => void;
  onFrame?: (time: number) => void; onEnded?: () => void;
}) {
  const ref = useRef<CinematicCanvas>(null);
  const media = useRef<HTMLVideoElement | null>(null);
  const callbacks = useRef({ onReady, onError, onFrame, onEnded }); callbacks.current = { onReady, onError, onFrame, onEnded };
  const time = useRef(at); time.current = at;
  const [portrait] = useState(() => window.matchMedia('(orientation: portrait)').matches);
  const clip = CINEMATICS[kind];
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !clip) return;
    if (!ctx) { callbacks.current.onError?.(); return; }
    const video = document.createElement('video');
    video.muted = true; video.playsInline = true; video.preload = 'auto';
    video.disablePictureInPicture = true;
    media.current = video; canvas.cinematicVideo = video;
    let dead = false, ready = false, failed = false, frame = 0, raf = 0;
    const draw = () => {
      if (dead || failed || video.readyState < 2) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (time.current == null) callbacks.current.onFrame?.(video.currentTime);
    };
    const fit = () => {
      if (!video.videoWidth) return;
      const bounds = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      // Keep the decoded aspect ratio; CSS cover/contain handles viewport framing.
      const scale = Math.min(1, Math.max(bounds.width * dpr / video.videoWidth, bounds.height * dpr / video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      draw();
    };
    const fail = () => {
      if (dead || failed) return;
      failed = true; video.pause(); clearTimeout(timeout); callbacks.current.onError?.();
    };
    const started = () => {
      if (dead || ready || failed) return;
      ready = true; clearTimeout(timeout); draw(); callbacks.current.onReady?.(clip.duration);
    };
    const seek = () => {
      if (dead || failed || time.current == null || video.readyState < 2 || video.seeking) return;
      const target = Math.min(clip.duration - 1 / CINEMATIC_FPS, Math.max(0, time.current));
      if (Math.abs(video.currentTime - target) > 0.001) video.currentTime = target;
    };
    const seeked = () => { draw(); seek(); };
    const loaded = () => {
      if (dead || failed) return;
      fit();
      if (time.current != null) { seek(); started(); }
      else video.play().catch(fail);
    };
    const ended = () => { draw(); callbacks.current.onEnded?.(); };
    const timeout = window.setTimeout(fail, 12000);
    const ro = new ResizeObserver(fit); ro.observe(canvas);
    video.addEventListener('loadeddata', loaded); video.addEventListener('playing', started);
    video.addEventListener('error', fail); video.addEventListener('seeked', seeked); video.addEventListener('ended', ended);
    if ('requestVideoFrameCallback' in video) {
      const tick = () => { draw(); if (!dead) frame = video.requestVideoFrameCallback(tick); };
      frame = video.requestVideoFrameCallback(tick);
    } else {
      const tick = () => { draw(); if (!dead) raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }
    video.src = `${import.meta.env.BASE_URL}${portrait ? clip.portrait : clip.landscape}`;
    video.load();
    return () => {
      dead = true; clearTimeout(timeout); ro.disconnect(); cancelAnimationFrame(raf);
      if (frame) video.cancelVideoFrameCallback(frame);
      video.removeEventListener('loadeddata', loaded); video.removeEventListener('playing', started);
      video.removeEventListener('error', fail); video.removeEventListener('seeked', seeked); video.removeEventListener('ended', ended);
      video.pause(); video.removeAttribute('src'); video.load();
      delete canvas.cinematicVideo; media.current = null;
    };
  }, [kind, clip, portrait]);
  useEffect(() => {
    const video = media.current;
    if (at == null || !video || !clip || video.readyState < 2 || video.seeking) return;
    video.currentTime = Math.min(clip.duration - 1 / CINEMATIC_FPS, Math.max(0, at));
  }, [at, clip]);
  if (!clip) return null;
  return <canvas ref={ref} className="lg3d" aria-hidden="true" />;
}
