import {chromium} from 'playwright';
import {createServer} from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:4188,strictPort:true,hmr:false,watch:null}});await server.listen();
const browser=await chromium.launch({channel:'chromium',args:['--enable-gpu','--use-angle=metal']});
try{for(const [name,viewport] of [['desktop',{width:1280,height:720}],['phone',{width:390,height:844}]]){
const page=await browser.newPage({viewport});await page.goto('http://127.0.0.1:4188/?debug&scenario=live-legend-ace');await page.getByRole('button',{name:/^Next round/}).waitFor();
for(const at of [.2,.4,.6,.85,3.1]){await page.evaluate(async at=>{const m=await import('/scripts/ace-harness.tsx');window.smokeReview=m.mountAceAt(at);},at);await page.waitForFunction(()=>window.__mmAce?.last.triangles>7000);await page.waitForTimeout(250);
await page.screenshot({path:`output/playwright/ace/smoke-${name}-${at}.png`});await page.evaluate(()=>window.smokeReview.unmount());}await page.close();}}
finally{await browser.close();await server.close();}
