import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdir,stat } from 'node:fs/promises';
const server=process.env.UI_BASE_URL?null:await createServer({server:{host:'127.0.0.1',port:4185,strictPort:true,hmr:false,watch:null}});
await server?.listen();
const base=process.env.UI_BASE_URL??'http://127.0.0.1:4185';
const browser=await chromium.launch(process.env.ACE_GPU ? {channel:'chromium',args:['--enable-gpu','--use-angle=metal']} : {});
await mkdir('output/playwright/ace',{recursive:true});
const errors=[];
async function effects(viewport,reducedMotion='no-preference',fail=false){
  const page=await browser.newPage({viewport,reducedMotion});
  page.on('pageerror',e=>errors.push(e.message));
  if(fail)await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args);};});
  await page.goto(`${base}/?debug`);
  await page.evaluate(()=>{window.aceMounts=0;new MutationObserver(records=>{for(const r of records)for(const node of r.addedNodes)if(node instanceof Element&&(node.matches('.ace-highlight')||node.querySelector('.ace-highlight')))window.aceMounts++;}).observe(document.body,{childList:true,subtree:true});});
  await page.getByRole('button',{name:'Debug',exact:true}).click();
  await page.getByRole('tab',{name:'Effects',exact:true}).click();return page;
}
try{
  assert.ok((await stat('public/assets/highlights/ace/impact-real.glb')).size+(await stat('public/assets/highlights/ace/glass-detail.webp')).size<1_000_000);
  for(const [name,viewport] of [['desktop',{width:1280,height:720}],['phone',{width:390,height:844}],['tablet',{width:768,height:1024}]]){
    const page=await effects(viewport);
    await page.getByRole('button',{name:'Ace',exact:true}).nth(1).click();
    const highlight=page.locator('.ace-highlight');
    await highlight.waitFor();
    await page.waitForFunction(()=>window.__mmAce?.last.triangles>2000);
    await page.waitForTimeout(150);
    for(const [t,hits,reveal] of [[.6,0,false],[.85,1,false],[1.2,2,false],[1.5,3,false],[1.8,4,false],[2.2,5,false],[2.7,5,true],[3,5,true]]){
      await page.getByRole('slider',{name:'Time'}).fill(String(t));
      await page.waitForFunction(({hits,reveal})=>{const el=document.querySelector('.ace-highlight');return el?.dataset.hits===String(hits)&&el?.dataset.reveal===String(reveal);},{hits,reveal});
      if(t===3){assert.ok(await page.locator('.ace-person strong').textContent());assert.equal(await page.locator('.ace-surface').evaluate(el=>getComputedStyle(el).transform),'none');}
      if(t===.6||t===.85||t===2.7||t===3)await page.screenshot({path:`output/playwright/ace/${name}-${t}.png`});
    }
    assert.equal(await highlight.getAttribute('data-mode'),'webgl');
    const stats=await page.evaluate(()=>window.__mmAce);
    assert.ok(stats.last.calls<20,JSON.stringify(stats));assert.ok(stats.last.triangles<10000,JSON.stringify(stats));
    assert.ok(stats.last.textures<=5);assert.equal(stats.last.dpr,name==='phone'?1:1);
    console.log(name,JSON.stringify(stats.last));
    if(name==='desktop')console.log('WebGL device',await page.locator('.ace-canvas').evaluate(c=>{const gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable';}));
    // Resize the mounted orthographic overlay and seek backwards.
    await page.setViewportSize({width:320,height:700});
    await page.getByRole('slider',{name:'Time'}).fill('1.2');
    assert.equal(await highlight.getAttribute('data-hits'),'2');
    await page.getByRole('button',{name:'Close',exact:true}).last().click();
    for(let i=0;i<4;i++){
      const mounts=await page.evaluate(()=>window.aceMounts);
      await page.getByRole('button',{name:'Ace',exact:true}).first().click();
      assert.equal(await page.evaluate(()=>window.aceMounts),mounts+1);
      await page.locator('.legend').waitFor({state:'detached',timeout:6500});
      if(i===3) console.log(name,'playback fps',await page.evaluate(()=>window.__mmAce.last.fps.toFixed(1)));
      assert.equal(await page.locator('.ace-canvas').count(),0);
      assert.deepEqual(await page.evaluate(()=>{const {renderers,loops,observers}=window.__mmAce;return {renderers,loops,observers};}),{renderers:0,loops:0,observers:0});
    }
    await page.getByRole('button',{name:'Knife kill',exact:true}).first().click();
    assert.equal(await page.locator('.ace-highlight').count(),0);
    await page.getByRole('button',{name:'Continue',exact:true}).click();
    await page.locator('.legend').waitFor({state:'detached'});
    await page.close();
  }
  for(const [motion,fail] of [['no-preference',true],['reduce',false]]){
    const page=await effects({width:390,height:844},motion,fail);
    await page.getByRole('button',{name:'Ace',exact:true}).first().click();
    await page.locator('.ace-highlight[data-mode="fallback"]').waitFor();
    await page.waitForTimeout(2850);
    await page.screenshot({path:`output/playwright/ace/${fail?'fallback':'reduced'}.png`});
    await page.locator('.legend').waitFor({state:'detached',timeout:6500});
    assert.deepEqual(await page.evaluate(()=>{const {renderers,loops,observers}=window.__mmAce;return {renderers,loops,observers};}),{renderers:0,loops:0,observers:0});
    await page.close();
  }
  const lifecycle=await effects({width:1280,height:720});
  await lifecycle.evaluate(async()=>{const module=await import('/scripts/ace-harness.tsx');window.aceFixture=module.mountAce();});
  await lifecycle.waitForFunction(()=>window.aceFixture.completed()===1);
  await lifecycle.waitForTimeout(150);
  assert.equal(await lifecycle.evaluate(()=>window.aceFixture.completed()),1);
  await lifecycle.evaluate(()=>window.aceFixture.unmount());
  // Early unmount cancels callbacks as well as the renderer, observer and clock.
  await lifecycle.evaluate(async()=>{const module=await import('/scripts/ace-harness.tsx');window.aceFixture=module.mountAce();});
  await lifecycle.waitForFunction(()=>window.__mmAce.renderers===1);
  await lifecycle.evaluate(()=>window.aceFixture.unmount());
  await lifecycle.waitForTimeout(5100);
  assert.equal(await lifecycle.evaluate(()=>window.aceFixture.completed()),0);
  assert.deepEqual(await lifecycle.evaluate(()=>{const {renderers,loops,observers}=window.__mmAce;return {renderers,loops,observers};}),{renderers:0,loops:0,observers:0});
  assert.equal(await lifecycle.evaluate(async()=>{const m=await import('/scripts/ace-harness.tsx');return m.checkFixedHoles();}),true);
  await lifecycle.close();
  const match=await browser.newPage({viewport:{width:1280,height:720},recordVideo:{dir:'output/playwright/ace/recordings',size:{width:1280,height:720}}});
  match.on('pageerror',e=>errors.push(e.message));
  await match.goto(`${base}/?debug&scenario=live-legend-ace`);
  await match.getByRole('button',{name:/^Next round/}).waitFor();
  assert.equal(await match.locator('.ace-highlight').count(),0);
  await match.evaluate(async()=>{const module=await import('/scripts/ace-harness.tsx');window.reviewAce=module.mountAceAt(3.1);});
  await match.waitForFunction(()=>document.querySelector('.ace-highlight')?.dataset.hits==='5');
  await match.waitForTimeout(100);
  await match.screenshot({path:'output/playwright/ace/match-reveal.png'});
  await match.evaluate(()=>window.reviewAce.unmount());
  await match.getByRole('button',{name:/^Next round/}).click();
  await match.locator('.ace-highlight').waitFor();
  await match.screenshot({path:'output/playwright/ace/match-impact.png'});
  await match.waitForFunction(()=>Number(document.querySelector('.ace-highlight')?.dataset.time)>=3.1);
  assert.ok(await match.locator('.ace-person strong').textContent());
  assert.ok(await match.locator('.ace-person__portrait img').evaluate(img=>img.complete&&img.naturalWidth>0));
  await match.screenshot({path:'output/playwright/ace/match-player.png'});
  await match.locator('.legend').waitFor({state:'detached',timeout:6500});
  const before=await match.evaluate(()=>JSON.parse(localStorage.getItem('mm-seen')).n);
  await match.getByRole('button',{name:/^Next round/}).click();
  await match.waitForFunction(before=>JSON.parse(localStorage.getItem('mm-seen')).n>before,before);
  assert.equal(await match.locator('.ace-highlight').count(),0);
  await match.close();
  await match.video().saveAs('output/playwright/ace/ace-playback.webm');
  assert.deepEqual(errors,[]);console.log('ACE lifecycle, sequencing, layouts, fallback and reduced motion passed');
}finally{await browser.close();await server?.close();}
