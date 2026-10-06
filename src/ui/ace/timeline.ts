export const ACE_LEAD_IN = .6;
const cue = (seconds:number) => seconds + ACE_LEAD_IN;
export const ACE_DURATION = cue(4.3);
export const ACE_HITS = [.18, .5, .82, 1.14, 1.5].map(cue);
export const ACE_REVEAL = cue(1.9);
export const clamp = (v: number) => Math.max(0, Math.min(1, v));
export const ease = (a: number, b: number, t: number) => { const x = clamp((t-a)/(b-a)); return 1-(1-x)**3; };
/** Elapsed seconds are the only animation state, including backwards seeking. */
export function aceTime(t: number) {
  const intro=clamp(t/.4);
  return { hits: ACE_HITS.filter(at => t >= at).length, reveal: ease(ACE_REVEAL, cue(2.06), t),
    flash: Math.max(0,...ACE_HITS.map((at,i)=>t>=at&&t<at+.10?(1-(t-at)/.10)*(i===4?1:.55):0)),
    identity: ease(cue(2.12), cue(2.4), t), lines: ease(cue(1.74), cue(1.94), t), fade: 1-ease(cue(4), ACE_DURATION, t),
    dim: .55*intro*intro*(3-2*intro)+.15*ease(cue(1.55),cue(1.8),t), done: t >= ACE_DURATION };
}
export function aceLayout(width: number, height: number) {
  const mobile = width < 600;
  const positions = mobile ? [[.25,.34],[.75,.40],[.27,.70],[.72,.71],[.5,.20]] : [[.29,.40],[.72,.48],[.33,.80],[.60,.81],[.5,.18]];
  const radius = mobile ? Math.min(25,width*.062) : Math.min(55,Math.min(width,height)*.074);
  return { positions, radius, mobile };
}
