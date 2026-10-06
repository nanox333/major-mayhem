import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { noscopeTime, NOSCOPE_CUT, NOSCOPE_HIT, NOSCOPE_SHOT } from './timeline';

/** Amber highlights, charcoal/cool shadows; bloom only above the HDR threshold. */
export function highlightPost(renderer:T.WebGLRenderer,scene:T.Scene,camera:T.Camera) {
  const target=new T.WebGLRenderTarget(1,1,{type:T.HalfFloatType});target.samples=4;
  const composer=new EffectComposer(renderer,target);
  const render=new RenderPass(scene,camera);
  const bloom=new UnrealBloomPass(new T.Vector2(1,1),.42,.35,1.35);
  const grade=new ShaderPass({
    uniforms:{tDiffuse:{value:null},impact:{value:0},clock:{value:0},flight:{value:0},quality:{value:1},fire:{value:0},cut:{value:0},rush:{value:0}},
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:`uniform sampler2D tDiffuse;uniform float impact;uniform float clock;uniform float flight;uniform float quality;uniform float fire;uniform float cut;uniform float rush;varying vec2 vUv;
      float noise(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
      void main(){
        vec2 center=vec2(.5,.46),radial=vUv-center;
        // Short impact aberration; subdued flight streaking, never a permanent blur.
        vec2 split=radial*impact*.006;
        // radial speed blur as the bullet rushes in; the impact fringe is applied to every tap so the channels always stay aligned
        vec3 c=vec3(0.0);float taps=1.0;
        c.r=texture2D(tDiffuse,vUv+split).r;c.g=texture2D(tDiffuse,vUv).g;c.b=texture2D(tDiffuse,vUv-split).b;
        if(rush>.01){for(int i=1;i<6;i++){vec2 o=radial*rush*.028*float(i);c.r+=texture2D(tDiffuse,vUv-o+split).r;c.g+=texture2D(tDiffuse,vUv-o).g;c.b+=texture2D(tDiffuse,vUv-o-split).b;taps+=1.0;}c/=taps;}
        float l=dot(c,vec3(.2126,.7152,.0722));
        c=mix(vec3(l),c,.85);
        float shade=1.0-smoothstep(.02,.5,l);
        c*=mix(vec3(1.22,1.02,.70),vec3(.82,.62,.48),shade);
        c=max(vec3(0.0),(c-.03)*1.22+.03);
        vec2 p=radial*vec2(1.0,.85);
        c*=1.0-smoothstep(.12,.62,length(p))*(.65+impact*.12);
        // ACE's smoky amber edge treatment, composed in the same finishing pass.
        float haze=exp(-dot((vUv-vec2(.06,.92))*vec2(1.6,2.0),(vUv-vec2(.06,.92))*vec2(1.6,2.0))*5.0);
        c+=vec3(.037,.012,.003)*haze;
        c+=(noise(gl_FragCoord.xy+floor(clock*12.0)*17.0)-.5)*.008;
        c+=vec3(.03,.008,.002)*impact*(1.0-length(radial)*.8);
        // muzzle flash and the hard cut: a white-hot punch, orange at the edges
        c+=vec3(.40,.18,.05)*fire*.6*(1.0-length(radial)*.9)+vec3(.40,.22,.10)*cut;
        gl_FragColor=vec4(max(c,vec3(0.0)),1.0);
      }`,
  });
  const output=new OutputPass(),smaa=new SMAAPass();
  for(const pass of [render,bloom,grade,output,smaa])composer.addPass(pass);
  return {
    resize(width:number,height:number,dpr:number,low:boolean) {
      bloom.enabled=!low;smaa.enabled=!low;grade.uniforms.quality.value=low?0:1;composer.readBuffer.samples=low?0:2;composer.writeBuffer.samples=low?0:2;
      composer.setPixelRatio(dpr);composer.setSize(width,height);
    },
    render(seconds:number) {
      const s=noscopeTime(seconds),elapsed=s.elapsed;
      const pulse=elapsed>=NOSCOPE_HIT?Math.exp(-(elapsed-NOSCOPE_HIT)*12):0;
      bloom.threshold=.95;bloom.radius=.6;bloom.strength=.70+pulse*.25+grade.uniforms.fire.value*.5;
      grade.uniforms.impact.value=pulse;grade.uniforms.clock.value=elapsed;
      grade.uniforms.flight.value=0;
      grade.uniforms.fire.value=elapsed>=NOSCOPE_SHOT&&elapsed<NOSCOPE_CUT?Math.exp(-s.shotAge*16):0;
      grade.uniforms.cut.value=elapsed>=NOSCOPE_CUT?Math.exp(-s.cutAge*70):0;grade.uniforms.rush.value=s.rush;
      renderer.info.reset();renderer.info.autoReset=false;
      composer.render();renderer.info.autoReset=true;
    },
    dispose() {for(const pass of [render,bloom,grade,output,smaa])pass.dispose();composer.dispose();},
  };
}
