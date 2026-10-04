import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';
import * as G from '../src/game/logic';
import { fresh, reducer, Run, roundOf, KEY, today } from '../src/game/state';
import { emptyStats, addRun, STATS_KEY } from '../src/game/stats';
import { answerFor, prosOn, compare, GUESS_KEY } from '../src/game/guess';
import { TIP_IDS } from '../src/ui/tips';
function draft(start: Run) {
  let s = start;
  while (s.phase === 'draft') {
    s = reducer(s, { type: 'spin' });
    if (roundOf(s) === 'coach') { s = reducer(s, { type: 'coach', rosterId: s.offer[0] }); continue; }
    const bench = roundOf(s) === 'bench';
    const r = s.offer.map(id => G.rosterById.get(id)!).find(r => r.players.some(p => bench ? !G.draftedIds(s.picks).has(p.id) : G.eligibleSlots(p, s.picks).length))!;
    const p = r.players.find(p => bench ? !G.draftedIds(s.picks).has(p.id) : G.eligibleSlots(p, s.picks).length)!;
    s = reducer(s, { type: 'team', id: r.id });
    s = reducer(s, bench ? { type: 'bench', player: p } : { type: 'draft', player: p, slot: G.eligibleSlots(p, s.picks)[0] });
  }
  return s;
}
function veto(s: Run) {
  while (G.vetoTurn(s.current!.veto)) s = reducer(s, { type: 'veto', map: G.vetoChoice(s.current!.veto, 'us', G.lineupFromPicks(s.picks), G.naturalLineup(G.rosterById.get(s.current!.opponentId)!)) });
  return s;
}
const start = { ...fresh('free'), seed: 'ui-followups' };
const opened = reducer(start, { type: 'spin' });
let live = veto(reducer(reducer(draft(start), { type: 'play' }), { type: 'start' }));
live = reducer(live, { type: 'side', side: G.autoSide(live.current!.next!) });
let final = reducer(draft(start), { type: 'play' });
while (final.phase !== 'final') {
  final = veto(reducer(final, { type: 'start' }));
  while (!final.current!.done) final = reducer(final, { type: 'side', side: G.autoSide(final.current!.next!) });
  final = reducer(final, { type: 'next' });
}


const out='docs/design/quick-wins';
const server=await preview({preview:{host:'127.0.0.1',port:4194,strictPort:true}});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
const day=today(), answer=answerFor(day), all=prosOn(day);
const choices=[...all.values()].filter(p=>p.id!==answer.id).sort((a,b)=>new Set(compare(b,answer).map(c=>c.state)).size-new Set(compare(a,answer).map(c=>c.state)).size).slice(0,3);
const matrices={protanopia:'0.152286 1.052583 -0.204868 0 0 0.114503 0.786281 0.099216 0 0 -0.003882 -0.048116 1.051998 0 0 0 0 0 1 0',deuteranopia:'0.367322 0.860646 -0.227968 0 0 0.280085 0.672501 0.047413 0 0 -0.011820 0.042940 0.968881 0 0 0 0 0 1 0',tritanopia:'1.255528 -0.076749 -0.178779 0 0 -0.078411 0.930809 0.147602 0 0 0.004733 0.691367 0.303900 0 0 0 0 0 1 0'};
try {
 for(const width of [320,375,768,1440,1920]) {
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:'dark',reducedMotion:'reduce'});const p=await context.newPage();
  await p.goto('http://127.0.0.1:4194');
  await p.evaluate(({key,statsKey,run,stats,tips})=>{localStorage.clear();localStorage.setItem(key,JSON.stringify(run));localStorage.setItem(statsKey,JSON.stringify(stats));localStorage.setItem('mm-tips',JSON.stringify(tips));},{key:KEY,statsKey:STATS_KEY,run:start,stats:addRun(emptyStats(),final),tips:TIP_IDS});await p.reload();
  assert.equal(await p.locator('.foot__group').count(),3);assert.equal(await p.locator('.stats-panel__tiles li').count(),4);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(width===375||width===1440)await p.screenshot({path:`${out}/home-${width}.png`,fullPage:true});
  const header=await p.locator('.topbar').boundingBox();assert(header&&header.height<=64);
  await p.evaluate(()=>document.documentElement.style.fontSize='200%');const overflowing=await p.evaluate(()=>[...document.querySelectorAll<HTMLElement>('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>[e.className,e.getBoundingClientRect().right]).slice(0,15));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),JSON.stringify({overflowing, metrics:await p.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth,bw:document.body.scrollWidth,els:[...document.querySelectorAll<HTMLElement>('body *')].filter(e=>e.scrollWidth>e.clientWidth+5).map(e=>[e.className,e.scrollWidth,e.clientWidth]).slice(0,12)}))}));await p.evaluate(()=>document.documentElement.style.fontSize='');
  await p.evaluate(({key,run})=>localStorage.setItem(key,JSON.stringify(run)),{key:KEY,run:opened});await p.reload();
  // Saved runs initially still open Home; enter through the run's navigation.
  const cont=p.getByRole('button',{name:/Continue free play/});if(await cont.count())await cont.click();
  assert(await p.locator('.case-card--revealed').count()>0,'reduced-motion static cue missing');
  assert.equal(await p.locator('.case-card--revealed .case-card__top').first().evaluate(el=>getComputedStyle(el).borderBottomWidth),'2px');
  await p.evaluate(({key,run})=>localStorage.setItem(key,JSON.stringify({...run,opts:{hard:true}})),{key:KEY,run:opened});await p.reload();
  const hardCont=p.getByRole('button',{name:/Continue free play/});if(await hardCont.count())await hardCont.click();assert.equal(await p.locator('.case-card--revealed').count(),0,'hard mode leaked rarity cue');
  await context.close();console.log('Home, 200% text and static cue verified',width);
 }
 if (!process.argv.includes('--home-only')) for(const palette of ['dark','dark-high']) {
  const context=await browser.newContext({viewport:{width:375,height:900},colorScheme:'dark',reducedMotion:'reduce'});const p=await context.newPage();await p.goto('http://127.0.0.1:4194');
  await p.evaluate(({key,day,ids,palette,tips})=>{localStorage.clear();localStorage.setItem(key,JSON.stringify({[day]:{guesses:ids,done:false,won:false}}));localStorage.setItem('mm-prefs',JSON.stringify({contrast:palette.endsWith('high')}));localStorage.setItem('mm-tips',JSON.stringify(tips));},{key:GUESS_KEY,day,ids:choices.map(p=>p.id),palette,tips:TIP_IDS});await p.reload();
  await p.getByRole('button',{name:'More',exact:true}).click();await p.locator('#topbar-menu').getByRole('button',{name:'Guess the pro',exact:true}).click();
  const search=p.getByRole('combobox');await search.fill([...all.values()].find(x=>!choices.some(c=>c.id===x.id))!.nick);
  const before=await p.evaluate(k=>localStorage.getItem(k),GUESS_KEY);await p.locator('.guess__row--preview').waitFor();await search.press('ArrowDown');assert.equal(await p.evaluate(k=>localStorage.getItem(k),GUESS_KEY),before,'preview consumed guess');await search.press('Escape');assert.equal(await p.locator('.guess__row--preview').count(),0);
  const states=new Set(await p.locator('.clue').evaluateAll(es=>es.map(e=>e.className.match(/clue--(\w+)/)![1])));assert(['hit','near','miss'].every(x=>states.has(x)));
  for(const name of ['normal',...Object.keys(matrices),'grayscale']) {
   await p.evaluate(({name,matrix})=>{document.getElementById('vision-filters')?.remove();const box=document.createElement('div');box.id='vision-filters';box.innerHTML=`<svg width="0" height="0" style="position:absolute"><filter id="cvd" color-interpolation-filters="linearRGB"><feColorMatrix ${name==='grayscale'?'type="saturate" values="0"':`type="matrix" values="${matrix}"`}/></filter></svg>`;document.body.append(box);document.querySelector<HTMLElement>('.gp')!.style.filter=name==='normal'?'none':'url(#cvd)';},{name,matrix:(matrices as Record<string,string>)[name]});
   await p.locator('.guess__grid').screenshot({path:`${out}/guess-${palette}-${name}.png`});
   for(const state of ['hit','near','miss']){const cell=p.locator(`.clue--${state}`).first();assert(await cell.getAttribute('aria-label'));assert((await cell.locator('.clue__mark').innerText()).trim());}
  }
  await context.close();console.log('Vision and non-submitting preview verified',palette);
 }
} finally {await browser.close();await new Promise<void>(r=>server.httpServer.close(()=>r()));}
