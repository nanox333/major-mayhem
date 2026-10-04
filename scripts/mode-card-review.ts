import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { fresh, reducer, KEY, today } from '../src/game/state';
import { answerFor, prosOn, GUESS_KEY } from '../src/game/guess';
import * as G from '../src/game/logic';
import { TIP_IDS } from '../src/ui/tips';
const server = await preview({preview:{host:'127.0.0.1',port:4195,strictPort:true}});
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
const day=today(), answer=answerFor(day), wrong=[...prosOn(day).values()].filter(p=>p.id!==answer.id).slice(0,8).map(p=>p.id);
const states=[{name:'fresh',guesses:[],done:false,won:false,label:'Play now'}, {name:'progress',guesses:wrong.slice(0,2),done:false,won:false,label:'Keep guessing'}, {name:'solved',guesses:[answer.id],done:true,won:true,label:"See today's answer"}, {name:'failed',guesses:wrong,done:true,won:false,label:"See today's answer"}];
try {
 for(const width of [1440,375,320,768,1920]) for(const palette of ['dark','dark-high']) {
  const ctx=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});const p=await ctx.newPage(); const errors:string[]=[]; p.on('pageerror',e=>errors.push(e.message));
  await p.goto('http://127.0.0.1:4195');
  for(const state of states) {
   let run=reducer(fresh('daily'),{type:'spin'});
   const roster=G.rosterById.get(run.offer[0])!, player=roster.players.find(p=>G.eligibleSlots(p,run.picks).length)!;
   run=reducer(reducer(run,{type:'team',id:roster.id}),{type:'draft',player,slot:G.eligibleSlots(player,run.picks)[0]});
   await p.evaluate(({key,guessKey,day,run,state,palette,tips})=>{localStorage.clear();localStorage.setItem(key,JSON.stringify(run));localStorage.setItem(guessKey,JSON.stringify({[day]:state}));localStorage.setItem('mm-tips',JSON.stringify(tips));localStorage.setItem('mm-prefs',JSON.stringify({contrast:palette.endsWith('high')}));},{key:KEY,guessKey:GUESS_KEY,day,run,state,palette,tips:TIP_IDS});await p.reload(); if (!(await p.locator('.editorial-home').count())) await p.getByRole('button',{name:'Major Mayhem: home',exact:true}).click();
   const card=p.locator('.home-mode-card--guess'), button=card.getByRole('button',{name:state.label,exact:true});await button.waitFor();
   assert.equal(await button.locator('.sr').count(),0,'action hidden visually'); const box=await button.boundingBox();assert(box&&box.height>=44&&box.width>=44);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'overflow');
   assert(await p.locator('.home-mode-art img').evaluateAll(es=>es.every(e=>(e as HTMLImageElement).complete&&(e as HTMLImageElement).naturalWidth>0)),'image failed');
   assert.equal(await card.locator('.home-pro-question').innerText(),'?');
   if(state.name==='fresh' && (width===375||width===1440)) await p.locator('.home-secondary-modes').screenshot({path:`docs/design/mode-cards/${palette}-${width}.png`});
   const before=await p.evaluate(k=>localStorage.getItem(k),KEY);
   await button.focus(); await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab'); assert.equal(await button.evaluate(e=>getComputedStyle(e).outlineStyle),'solid'); await p.keyboard.press('Enter'); await p.locator('.gp').waitFor(); assert.equal(await p.evaluate(k=>localStorage.getItem(k),KEY),before,'Guess replaced Major');
   await p.reload(); if (!(await p.locator('.editorial-home').count())) await p.getByRole('button',{name:'Major Mayhem: home',exact:true}).click();
   await p.getByRole('button',{name:'Start free play',exact:true}).click();await p.locator('.home-mode-card--free [role=alert]').waitFor();assert.equal(await p.evaluate(k=>localStorage.getItem(k),KEY),before,'guard mutated run');await p.locator('.home-mode-card--free').getByRole('button',{name:'Keep it',exact:true}).click();assert.equal(await p.evaluate(k=>localStorage.getItem(k),KEY),before);
  }
  await p.evaluate(()=>document.documentElement.style.fontSize='200%');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'200% text overflow');if(width===375&&palette==='dark') await p.locator('.home-secondary-modes').screenshot({path:'docs/design/mode-cards/dark-375-text-200.png'}); await p.evaluate(()=>document.documentElement.style.fontSize='');
  const copy=await p.locator('.home-secondary-modes h2, .home-secondary-modes button').allTextContents(); await p.locator('.home-mode-art').evaluateAll(es=>es.forEach(e=>(e as HTMLElement).style.visibility='hidden')); assert.deepEqual(await p.locator('.home-secondary-modes h2, .home-secondary-modes button').allTextContents(),copy,'decorative artwork carried meaning');
  await p.emulateMedia({forcedColors:'active'}); assert.equal(await p.locator('.home-mode-art').first().evaluate(e=>getComputedStyle(e).display),'none');assert(await p.getByRole('button',{name:'Start free play',exact:true}).isVisible());assert.equal(errors.length,0,errors.join('\n'));
  await ctx.close(); console.log('Mode states, run guards, themes, text scale and forced colors:',width,palette);
 }
 // Starting a fresh Free Play still reaches the real filters and draft.
 const p=await browser.newPage();await p.goto('http://127.0.0.1:4195');await p.evaluate(({key,run})=>{localStorage.clear();localStorage.setItem(key,JSON.stringify(run));},{key:KEY,run:fresh('free')});await p.reload(); if (!(await p.locator('.editorial-home').count())) await p.getByRole('button',{name:'Major Mayhem: home',exact:true}).click();await p.getByRole('button',{name:'Start free play',exact:true}).click();assert(await p.locator('.home-mode-card--free .modes').isVisible());await p.getByRole('button',{name:'Open case',exact:true}).click();await p.locator('.case-card').first().waitFor(); console.log('Fresh Free Play setup and Open case preserved');
} finally {await browser.close();await new Promise<void>((resolve,reject)=>server.httpServer.close(e=>e?reject(e):resolve()));}
