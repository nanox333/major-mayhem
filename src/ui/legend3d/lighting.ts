import * as T from 'three';
/** Small HDR probe: warm window strips and a cool softbox create specular highlights.
 * Unlike the old byte texture, bright reflections retain their range before tone mapping. */
export function highlightReflections(renderer:T.WebGLRenderer) {
  const w=256,h=128,pixels=new Float32Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++) {
    const u=x/w,v=y/h,i=(y*w+x)*4;
    const panel=(cx:number,cy:number,sx:number,sy:number)=>Math.exp(-Math.pow(Math.abs(u-cx)/sx,6)-Math.pow(Math.abs(v-cy)/sy,6));
    const cool=panel(.48,.25,.12,.18)*4.5,warm=panel(.19,.40,.025,.22)*7,rim=panel(.79,.39,.022,.18)*5;
    const base=.035+.05*Math.max(0,1-v*2);
    pixels.set([base+cool*.83+warm+rim,base+cool*.92+warm*.47+rim*.8,base+cool+warm*.18+rim*.63,1],i);
  }
  const texture=new T.DataTexture(pixels,w,h,T.RGBAFormat,T.FloatType);texture.mapping=T.EquirectangularReflectionMapping;texture.needsUpdate=true;
  const generator=new T.PMREMGenerator(renderer),map=generator.fromEquirectangular(texture);
  texture.dispose();generator.dispose();return map;
}
