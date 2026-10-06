import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir,stat } from 'node:fs/promises';
const server=process.env.UI_BASE_URL?null:await createServer({server:{host:'127.0.0.1',port:4183,strictPort:true,hmr:false}});
await server?.listen();
const base=process.env.UI_BASE_URL??'http://127.0.0.1:4183';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined});
await mkdir('shots/legend',{recursive:true});const errors=[];
async function effects(viewport,motion='no-preference',failure=''){
 const page=await browser.newPage({viewport,reducedMotion:motion});page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 if(failure==='webgl')await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args);};});
 if(failure==='asset')await page.route('**/noscope/kit.glb',route=>route.abort());
 await page.goto(`${base}/?debug`);await page.getByRole('button',{name:'Debug',exact:true}).click();await page.getByRole('tab',{name:'Effects',exact:true}).click();return page;
}
const zero=async p=>assert.deepEqual(await p.evaluate(()=>{const {renderers,loops,observers}=window.__mmHighlights;return {renderers,loops,observers};}),{renderers:0,loops:0,observers:0});
try{
 assert.ok((await stat('public/assets/highlights/noscope/kit.glb')).size<3_000_000);
 for(const [name,viewport] of [['desktop',{width:1280,height:720}],['phone',{width:390,height:844}]]){
  const p=await effects(viewport);await p.getByRole('button',{name:'No-scope',exact:true}).nth(1).click();await p.waitForFunction(()=>document.querySelector('.lg3d')?.dataset.time);
  assert.equal(await p.locator('video').count(),0);
  for(const t of [0,.8,2.15,2.6,3.3]){await p.getByRole('slider',{name:'Time'}).fill(String(t));await p.waitForFunction(t=>Math.abs(Number(document.querySelector('.lg3d').dataset.time)-t)<.001,t);await p.screenshot({path:`shots/legend/${name}-${t}.png`});}
  const stats=await p.evaluate(()=>window.__mmHighlights.last);assert.ok(stats.calls<50);assert.ok(stats.triangles<50000);assert.ok(stats.dpr<=1.5);console.log(name,stats);
  if(name==='desktop') {
   await p.getByRole('button',{name:'Close',exact:true}).last().click();await zero(p);
   await p.getByRole('button',{name:'No-scope',exact:true}).first().click();
   await p.waitForFunction(()=>Number(document.querySelector('.legend-noscope')?.style.getPropertyValue('--reveal'))>.9);
   await p.screenshot({path:'shots/legend/desktop-caption.png'});
   await p.waitForFunction(()=>!document.querySelector('.legend')||Number(getComputedStyle(document.querySelector('.legend')).opacity)<.5);
   await p.screenshot({path:'shots/legend/desktop-crossfade.png'});
   await p.locator('.legend').waitFor({state:'detached',timeout:20000});await zero(p);
   console.log('desktop bloom playback',await p.evaluate(()=>window.__mmHighlights.last));
   await p.getByRole('button',{name:'No-scope',exact:true}).nth(1).click();await p.waitForFunction(()=>document.querySelector('.lg3d')?.dataset.time);
  }
  await p.setViewportSize({width:320,height:700});await p.waitForFunction(()=>document.querySelector('.lg3d').width===document.documentElement.clientWidth&&document.documentElement.clientWidth<=320);await p.getByRole('slider',{name:'Time'}).fill('0.5');
  await p.getByRole('button',{name:'Close',exact:true}).last().click();await zero(p);
  for(let i=0;i<3;i++){
   await p.getByRole('button',{name:'No-scope',exact:true}).first().click();await p.waitForFunction(()=>Number(document.querySelector('.legend .lg3d')?.dataset.time)>.1);
   assert.equal(await p.locator('.legend .lg3d').count(),1);
   await p.waitForFunction(()=>Number(document.querySelector('.legend-noscope')?.style.getPropertyValue('--reveal'))>.9);
   await p.locator('.legend').waitFor({state:'detached',timeout:20000});await zero(p);
  }
  console.log(name,'elapsed playback',await p.evaluate(()=>window.__mmHighlights.last));await p.close();
 }
 for(const [motion,failure] of [['no-preference','webgl'],['no-preference','asset'],['reduce','']]){
  const p=await effects({width:390,height:844},motion,failure);await p.getByRole('button',{name:'No-scope',exact:true}).first().click();await p.locator('.legend.is-still').waitFor();assert.equal(await p.locator('.legend .lg3d').count(),0);await p.locator('.legend').waitFor({state:'detached',timeout:20000});await zero(p);await p.close();
 }
 const p=await effects({width:1280,height:720});
 await p.evaluate(async()=>{window.fixture=(await import('/scripts/noscope-harness.tsx')).mountNoscope();});await p.waitForFunction(()=>window.fixture.completed()===1);await p.waitForTimeout(100);assert.equal(await p.evaluate(()=>window.fixture.completed()),1);await p.evaluate(()=>window.fixture.unmount());await zero(p);
 await p.evaluate(async()=>{window.fixture=(await import('/scripts/noscope-harness.tsx')).mountNoscope();});await p.waitForFunction(()=>window.__mmHighlights.renderers===1);await p.evaluate(()=>window.fixture.unmount());await p.waitForTimeout(2000);assert.equal(await p.evaluate(()=>window.fixture.completed()),0);await zero(p);await p.close();
 const match=await browser.newPage({viewport:{width:1280,height:720}});match.setDefaultTimeout(60000);match.on('pageerror',e=>errors.push(e.message));await match.goto(`${base}/?debug&scenario=live-legend-noscope`);await match.getByRole('button',{name:/^Next round/}).waitFor();await match.getByRole('button',{name:/^Next round/}).click();await match.locator('.legend .lg3d').waitFor();
 const before=await match.evaluate(()=>JSON.parse(localStorage.getItem('mm-seen')).n);await match.waitForFunction(()=>Number(document.querySelector('.legend .lg3d')?.dataset.time)>.5);assert.equal(await match.evaluate(()=>JSON.parse(localStorage.getItem('mm-seen')).n),before);assert.equal(await match.locator('.match-live').getAttribute('data-play'),'paused');
 await match.locator('.legend').waitFor({state:'detached',timeout:30000});await match.getByRole('button',{name:/^Next round/}).click();await match.waitForFunction(before=>JSON.parse(localStorage.getItem('mm-seen')).n>before,before);await match.close();
 assert.deepEqual(errors,[]);console.log('Noscope scene, resize, completion, cleanup, repeat, fallback and match integration passed');
}catch(error){
 for(const [i,page] of browser.contexts().flatMap(c=>c.pages()).entries()){
  try{await page.screenshot({path:`shots/legend/failure-${i}.png`,timeout:10000});console.log('page',i,await page.evaluate(()=>({url:location.href,visibility:document.visibilityState,canvas:[...document.querySelectorAll('canvas')].map(c=>({cls:c.className,w:c.width,h:c.height,time:c.dataset.time})),legend:document.querySelector('.legend')?.className,diagnostics:window.__mmHighlights?{...window.__mmHighlights}:null,scrub:!!document.querySelector('.dbg-scrub')})));}catch(inner){console.log('page',i,'no diagnostics:',inner.message.split('\n')[0]);}
 }
 console.log('page errors',errors);throw error;
}finally{await browser.close();await server?.close();}
