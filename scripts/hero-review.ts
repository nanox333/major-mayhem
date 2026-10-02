import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { preview } from 'vite';
import { fresh, KEY } from '../src/game/state';
import { TIP_IDS } from '../src/ui/tips';
const server = await preview({preview:{host:'127.0.0.1',port:4197,strictPort:true}});
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH});
const out='docs/design/arena-hero';
try {
  for(const width of [320,375,768,1440,1920]) for(const palette of ['dark','light','dark-high','light-high']) {
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    const p=await context.newPage();await p.goto('http://127.0.0.1:4197');
    await p.evaluate(({key,run,tips,palette})=>{localStorage.clear();localStorage.setItem(key,JSON.stringify(run));localStorage.setItem('mm-tips',JSON.stringify(tips));localStorage.setItem('mm-prefs',JSON.stringify({theme:palette.startsWith('light')?'light':'dark',contrast:palette.endsWith('high')}));},{key:KEY,run:fresh('free'),tips:TIP_IDS,palette});await p.reload();
    const fits=async()=>assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');await fits();
    const action=p.locator('.home__daily'), box=await action.boundingBox();assert(box&&box.height>=44);
    if(width<768){assert(box.y+box.height<=900,'mobile action below first viewport');assert(!(await p.locator('.home-invitation > .home-lineup-art').isVisible()));}
    if(width===1440) for(const selector of ['.home-invitation h1 > span','.home-invitation h1 > em'])assert(await p.locator(selector).evaluate(e=>e.getBoundingClientRect().height<=parseFloat(getComputedStyle(e).lineHeight)+1),'headline wrapped beyond two lines');
    if(width===375||width===1440) await p.screenshot({path:`${out}/${palette}-${width}.png`,fullPage:true});
    await p.evaluate(()=>document.documentElement.style.fontSize='200%');await fits();await p.evaluate(()=>document.documentElement.style.fontSize='');
    await action.focus();await p.keyboard.press('Tab');await p.keyboard.press('Shift+Tab');assert.equal(await action.evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
    const before=await p.evaluate(k=>localStorage.getItem(k),KEY);
    await p.addStyleTag({content:'.home-invitation::before { background-image: none !important; }'});await fits();assert.equal(await p.evaluate(k=>localStorage.getItem(k),KEY),before);
    if(width===1440&&palette==='dark')await p.screenshot({path:`${out}/art-unavailable-1440.png`,fullPage:true});
    await p.emulateMedia({forcedColors:'active'});assert.equal(await p.locator('.home-invitation').evaluate(e=>getComputedStyle(e,'::before').display),'none');
    await context.close();console.log('Hero layout, themes, text scaling and fallback:',width,palette);
  }
  const context=await browser.newContext({viewport:{width:375,height:900},timezoneId:'Europe/Stockholm',reducedMotion:'reduce'});const p=await context.newPage();
  await p.clock.install({time:new Date('2026-10-01T21:59:58Z')});await p.goto('http://127.0.0.1:4197');
  assert((await p.locator('.home-kicker').innerText()).includes('#4'));await p.clock.fastForward(3000);assert((await p.locator('.home-kicker').innerText()).includes('#5'));assert((await p.locator('.daily-ready').innerText()).includes('#5'));
  await p.screenshot({path:`${out}/midnight-rollover-375.png`,fullPage:true});await context.close();console.log('Stockholm local midnight advances #4 to #5 without reload');
}finally{await browser.close();await new Promise<void>((resolve,reject)=>server.httpServer.close(e=>e?reject(e):resolve()));}
