import * as T from 'three';

/** World-space surface detail for the flat low-poly map: cut stone courses on the walls, flagstones on the ground, plaster mottling, soot and
 *  damp near the base, and a normal bump from the same height, so the light rakes across real-looking relief. No texture files; it is one
 *  patch of the standard material, so it costs a few noise taps per pixel. */
export function addGrit(m: T.MeshStandardMaterial, strength = 1) {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uGrit = { value: strength };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGW=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vGW;uniform float uGrit;
float gh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float gn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(gh(i),gh(i+vec2(1.0,0.0)),f.x),mix(gh(i+vec2(0.0,1.0)),gh(i+vec2(1.0,1.0)),f.x),f.y);}
float gf(vec2 p){float a=.5,s=0.0;for(int i=0;i<5;i++){s+=a*gn(p);p=p*2.03+17.0;a*=.5;}return s;}
/* uv on the surface plane, a block size, and a running-bond offset; returns the mortar mask (0 in the joint) and the block id */
float courses(vec2 uv,vec2 size,float w,out float id){
  float row=floor(uv.y/size.y);vec2 q=vec2(uv.x/size.x+mod(row,2.0)*.5,uv.y/size.y);vec2 c=floor(q),f=fract(q);id=gh(c+row*7.3);
  float edge=min(min(f.x,1.0-f.x)*size.x,min(f.y,1.0-f.y)*size.y);return smoothstep(.004,.02+w*1.5,edge);
}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
vec3 gnrm=normalize(cross(dFdx(vGW),dFdy(vGW)));
float gH=0.0;
{
  bool floorLike=abs(gnrm.y)>.6;
  vec2 uv=floorLike?vGW.xz:(abs(gnrm.x)>abs(gnrm.z)?vec2(vGW.z,vGW.y):vec2(vGW.x,vGW.y));
  float id;float w=max(fwidth(uv.x),fwidth(uv.y));float far=clamp(1.0-w*14.0,.2,1.0);
  float joint=courses(uv,floorLike?vec2(1.15,.85):vec2(.62,.31),w,id);
  float mottle=gf(uv*1.7)*.6+gf(uv*9.0)*.4;
  float soot=exp(-max(vGW.y,0.0)*.55)*gf(uv*.8+3.0);
  float stain=smoothstep(.55,.9,gf(vec2(uv.x*.9,uv.y*.25)+9.0));
  gH=joint*(.55+.35*mottle)+(1.0-joint)*.0+gf(uv*11.0)*.05;
  vec3 tint=vec3(.78+.4*id)*(.62+.6*mottle);
  tint*=1.0-.55*soot-.25*stain;
  tint=mix(vec3(.55,.42,.32),tint,joint*.85+.15);
  diffuseColor.rgb*=mix(vec3(1.0),mix(vec3(.85),tint*1.25,far),uGrit);
  gH*=far;
}`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(.5-gH)*.35*uGrit,.35,1.0);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
{
  vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition);vec3 r1=cross(sy,normal),r2=cross(normal,sx);float det=dot(sx,r1);
  vec3 grad=sign(det)*(dFdx(gH)*r1+dFdy(gH)*r2);normal=normalize(abs(det)*normal-grad*.35*uGrit);
}`);
  };
  m.customProgramCacheKey = () => 'grit';
}
