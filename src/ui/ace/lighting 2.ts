import * as T from 'three';
let pixels:Float32Array|undefined;
/** A tiny HDR studio light probe, not a visible environment. Supplies real specular reflections. */
export function createGlassLighting(renderer:T.WebGLRenderer) {
  const w=256,h=128;
  if(!pixels){
    pixels=new Float32Array(w*h*4);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const u=x/w,v=y/h,index=(y*w+x)*4;
      const softbox=(cx:number,cy:number,sx:number,sy:number)=>Math.exp(-Math.pow(Math.abs(u-cx)/sx,8)-Math.pow(Math.abs(v-cy)/sy,8));
      const key=softbox(.48,.28,.10,.18)*9;
      const strip=softbox(.79,.45,.018,.23)*6;
      const amber=softbox(.18,.56,.045,.19)*5;
      const base=.025+.045*Math.exp(-(((v-.5)/.2)**2));
      pixels[index]=base+key+strip+amber;pixels[index+1]=base+key*.97+strip*.86+amber*.34;pixels[index+2]=base+key*.90+strip*.7+amber*.09;pixels[index+3]=1;
    }
  }
  const source=new T.DataTexture(pixels,w,h,T.RGBAFormat,T.FloatType);source.mapping=T.EquirectangularReflectionMapping;source.needsUpdate=true;
  const generator=new T.PMREMGenerator(renderer),target=generator.fromEquirectangular(source);
  source.dispose();generator.dispose();
  return {texture:target.texture,dispose:()=>target.dispose()};
}
