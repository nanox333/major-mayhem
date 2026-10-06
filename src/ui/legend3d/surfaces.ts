import * as T from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

/** One small planar capture, softly masked into damp patches rather than a mirror floor. */
export function reflectedFloor() {
  const shader=(Reflector as unknown as {ReflectorShader:{uniforms:Record<string,{value:unknown}>;vertexShader:string;fragmentShader:string}}).ReflectorShader;
  const floor=new Reflector(new T.PlaneGeometry(6.8,30),{
    textureWidth:256,textureHeight:256,multisample:0,clipBias:.003,color:0x68615a,
    shader:{...shader,
      vertexShader:shader.vertexShader.replace('varying vec4 vUv;','varying vec4 vUv; varying vec2 wetUv;').replace('vUv = textureMatrix * vec4( position, 1.0 );','vUv = textureMatrix * vec4( position, 1.0 );wetUv=uv;'),
      fragmentShader:shader.fragmentShader.replace('varying vec4 vUv;','varying vec4 vUv; varying vec2 wetUv;').replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );',`
        vec2 uv=vUv.xy/vUv.w;
        vec3 reflection=(base.rgb+texture2D(tDiffuse,uv+vec2(.004,0.)).rgb+texture2D(tDiffuse,uv-vec2(.004,0.)).rgb+texture2D(tDiffuse,uv+vec2(0.,.004)).rgb+texture2D(tDiffuse,uv-vec2(0.,.004)).rgb)/5.;
        vec2 p=wetUv*vec2(6.8,30.);
        float puddle=sin(p.x*2.3+sin(p.y*1.7))*.25+sin(p.y*2.7+p.x)*.18+.48;
        float edge=smoothstep(0.,.13,wetUv.x)*smoothstep(0.,.13,1.-wetUv.x)*smoothstep(0.,.06,wetUv.y)*smoothstep(0.,.06,1.-wetUv.y);
        gl_FragColor=vec4(reflection*.75,smoothstep(.38,.70,puddle)*edge*.36);
      `),
    },
  });
  floor.name='WetFloor';floor.rotation.x=-Math.PI/2;floor.position.set(0,.012,-13);
  (floor.material as T.ShaderMaterial).transparent=true;(floor.material as T.ShaderMaterial).depthWrite=false;
  return floor;
}
