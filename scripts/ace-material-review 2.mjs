import {chromium} from 'playwright';
import {createServer} from 'vite';
import {mkdir} from 'node:fs/promises';
await mkdir('output/playwright/ace-material',{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:4187,strictPort:true,hmr:false,watch:null}});await server.listen();
const browser=await chromium.launch({channel:'chromium',args:['--enable-gpu','--use-angle=metal']});
try{const page=await browser.newPage({viewport:{width:900,height:900}});await page.goto('http://127.0.0.1:4187/?debug');
for(const angle of [false,true]){await page.evaluate(async angle=>{const module=await import('/scripts/ace-material-harness.tsx');window.stopMaterialReview=module.reviewMaterial(angle);},angle);await page.locator('canvas[data-ready="true"]').waitFor();await page.screenshot({path:`output/playwright/ace-material/three-${angle?'angle':'front'}.png`});console.log(angle?'angle':'front',await page.locator('canvas[data-ready="true"]').getAttribute('data-triangles'));await page.evaluate(()=>window.stopMaterialReview());}
}finally{await browser.close();await server.close();}
