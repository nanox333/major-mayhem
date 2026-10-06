import sharp from 'sharp';
import {mkdir} from 'node:fs/promises';
const size=1024, pixels=Buffer.alloc(size*size*3);
const noise=(x,y)=>{let v=Math.imul(x+179,y+431)^Math.imul(x,73471)^Math.imul(y,19349663);v^=v>>>13;return (v&255)/255-.5;};
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 const u=x%512,v=y%512,q=(x>=512?1:0)+(y>=512?2:0);let c;
 if(q===0){const cloud=Math.sin(u*.031)*Math.sin(v*.024)*3+Math.sin(u*.071+v*.039)*1.8+noise(u,v)*1;c=[201+cloud,154+cloud,104+cloud];}
 if(q===1){const row=Math.floor(v/20),col=Math.floor((u+(row%2)*16)/32);const joint=v%20<1||(u+(row%2)*16)%32<1;const n=noise(col,row)*10+noise(u,v)*.7;c=joint?[155,132,103]:[216+n,187+n,143+n];}
 if(q===2){const plank=u%64<2;const grain=Math.sin(u*.22+Math.sin(v*.032)*2)*2+Math.sin(u*.85+Math.sin(v*.013)*4)*1.3+noise(u,v)*.7;c=plank?[75,57,40]:[118+grain,87+grain,56+grain];}
 if(q===3){const n=noise(u,v)*.7+Math.sin(u*.16)*.7;c=[43+n,47+n,50+n];}
 const i=(y*size+x)*3;for(let k=0;k<3;k++)pixels[i+k]=Math.max(0,Math.min(255,Math.round(c[k])));
}
await mkdir('scripts/highlights/assets',{recursive:true});await sharp(pixels,{raw:{width:size,height:size,channels:3}}).blur(.5).png().toFile('scripts/highlights/assets/atlas.png');

// Separate character sheet: visible twill, padded panels, stitches and worn hardware.
// Paired tangent normals give cloth surface detail without subdividing the character.
const cloth=Buffer.alloc(size*size*3), normals=Buffer.alloc(size*size*3);
const height=(u,v,q)=> q===0 ? Math.sin((u+v)*1.57)*.13+Math.sin(u*.058+v*.037)*1.2 : q===1 ? ((v%64)<8?.9:0)+Math.sin(u*.025)*.3 : Math.sin(v*.16)*.15;
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
 const u=x%512,v=y%512,q=(x>=512?1:0)+(y>=512?2:0);
 const bases=[[83,105,117],[111,118,88],[65,71,75],[136,118,85]];
 const seam=u<12||u>499||v<12||v>499;
 const stitch=seam && (u%12<6||v%12<6);
 const weave=Math.sin((u+v)*1.57)*2.2+Math.sin((u-v)*1.57)*1.3;
 const wear=Math.sin(u*.029)*Math.sin(v*.036)*5+noise(u,v)*5;
 const fold=q===0?Math.sin(u*.058+v*.037)*8:q===1?(v%64<8?-17:0):Math.sin(v*.12)*2;
 const edge=seam?(stitch?8:-13):0;
 const i=(y*size+x)*3;
 for(let k=0;k<3;k++)cloth[i+k]=Math.max(0,Math.min(255,Math.round(bases[q][k]+weave+wear+fold+edge)));
 const dx=(height(u+1,v,q)-height(u-1,v,q))*.32,dy=(height(u,v+1,q)-height(u,v-1,q))*.32;
 const len=Math.hypot(dx,dy,1);normals[i]=Math.round((-.5*dx/len+.5)*255);normals[i+1]=Math.round((.5*dy/len+.5)*255);normals[i+2]=Math.round((.5/len+.5)*255);
}
await sharp(cloth,{raw:{width:size,height:size,channels:3}}).png().toFile('scripts/highlights/assets/character.png');
await sharp(normals,{raw:{width:size,height:size,channels:3}}).png().toFile('scripts/highlights/assets/character-normal.png');
