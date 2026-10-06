import * as T from 'three';
import { ease } from './timeline';

// Original implementation of the scrolling-noise / twisted-ribbon technique discussed at
// https://garden.bradwoods.io/notes/javascript/three-js/shaders/shaders-103-smoke
// Noise is generated locally; there are no downloaded smoke images or external requests.
let pixels:Uint8Array|undefined;
function noisePixels(){
  if(pixels)return pixels;
  const size=256;pixels=new Uint8Array(size*size*4);let seed=173;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const grids=[4,8,16,32,64].map(n=>({n,data:Float32Array.from({length:n*n},random)}));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let sum=0,weight=0;
    grids.forEach(({n,data},o)=>{
      const xx=x/size*n,yy=y/size*n,ix=Math.floor(xx),iy=Math.floor(yy),fx=xx-ix,fy=yy-iy;
      const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),w=2**-o;
      const at=(a:number,b:number)=>data[(b%n)*n+a%n];
      sum+=((at(ix,iy)*(1-u)+at(ix+1,iy)*u)*(1-v)+(at(ix,iy+1)*(1-u)+at(ix+1,iy+1)*u)*v)*w;weight+=w;
    });
    const i=(y*size+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=Math.round(sum/weight*255);pixels[i+3]=255;
  }
  return pixels;
}
export function createImpactSmoke(){
  const texture=new T.DataTexture(noisePixels(),256,256,T.RGBAFormat);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.magFilter=texture.minFilter=T.LinearFilter;texture.needsUpdate=true;
  const geometry=new T.PlaneGeometry(1,1,6,18);geometry.translate(0,.5,0);
  const ages=new T.InstancedBufferAttribute(new Float32Array(5),1),strengths=new T.InstancedBufferAttribute(new Float32Array(5),1),seeds=new T.InstancedBufferAttribute(Float32Array.from([.1,.37,.62,.83,1.16]),1);
  geometry.setAttribute('smokeAge',ages);geometry.setAttribute('smokeStrength',strengths);geometry.setAttribute('smokeSeed',seeds);
  const material=new T.ShaderMaterial({uniforms:{noise:{value:texture}},transparent:true,depthWrite:false,depthTest:false,side:T.DoubleSide,
    vertexShader:`
      uniform sampler2D noise;
      attribute float smokeAge; attribute float smokeStrength; attribute float smokeSeed;
      varying vec2 smokeUv; varying float age; varying float strength; varying float phase;
      void main(){
        smokeUv=uv; age=smokeAge; strength=smokeStrength; phase=smokeSeed;
        float curl=texture2D(noise,vec2(smokeSeed,uv.y*.65-smokeAge*.12)).r-.5;
        float twist=curl*5.0*uv.y;
        vec3 p=position;
        p.x=position.x*cos(twist)+curl*uv.y*.52;
        p.z=position.x*sin(twist)*.3;
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(p,1.0);
      }`,
    fragmentShader:`
      uniform sampler2D noise;
      varying vec2 smokeUv; varying float age; varying float strength; varying float phase;
      void main(){
        vec2 flow=vec2(smokeUv.x*.8+phase,smokeUv.y*.75-age*.2);
        float n=texture2D(noise,flow).r;
        float fine=texture2D(noise,flow*2.7+vec2(age*.025,phase)).r;
        float density=smoothstep(.38,.67,n*.72+fine*.28);
        float width=mix(.065,.32,pow(smokeUv.y,.8));
        float ribbon=1.0-smoothstep(width*.22,width,abs(smokeUv.x-.5));
        float ends=smoothstep(0.0,.07,smokeUv.y)*(1.0-smoothstep(.58,1.0,smokeUv.y));
        float alpha=density*ribbon*ends*strength;
        gl_FragColor=vec4(mix(vec3(.48,.47,.44),vec3(.82,.81,.77),fine),alpha);
        #include <colorspace_fragment>
      }`});material.forceSinglePass=true;
  const mesh=new T.InstancedMesh(geometry,material,5);mesh.name='ace-barrel-smoke';mesh.frustumCulled=false;mesh.renderOrder=2;
  const dummy=new T.Object3D();
  return {mesh,update(i:number,x:number,y:number,base:number,t:number){
    const active=t>=0;
    ages.setX(i,Math.max(0,t));strengths.setX(i,active?.52*ease(.01,.1,t)*(1-ease(.75,2.35,t)):0);
    dummy.position.set(x,y,30);dummy.rotation.set(0,0,(i%2?1:-1)*.075);
    dummy.scale.set(base*1.05,base*(.65+1.55*ease(0,1.15,t)),1);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    ages.needsUpdate=strengths.needsUpdate=mesh.instanceMatrix.needsUpdate=true;
  },dispose(){mesh.dispose();geometry.dispose();material.dispose();texture.dispose();}};
}
