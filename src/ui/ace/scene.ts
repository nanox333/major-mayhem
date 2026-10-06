import * as T from 'three';
import { createImpactSmoke } from './smoke';
import { createGlassLighting } from './lighting';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ACE_HITS, ACE_REVEAL, aceLayout, aceTime, clamp, ease } from './timeline';

type Assets = { geometries:Record<string,T.BufferGeometry>; image:HTMLImageElement };
let assets: Promise<Assets | null> | undefined;
/** CPU geometry only is cached. Every mounted highlight owns and disposes its GPU copies. */
export function preloadAce() {
  return assets ??= Promise.all([new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}assets/highlights/ace/impact-real.glb`), new T.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}assets/highlights/ace/glass-detail.webp`)]).then(([gltf,texture]) => {
    const out: Record<string,T.BufferGeometry> = {};
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(obj => { if(obj instanceof T.Mesh) {
      out[obj.name]=obj.geometry.clone().applyMatrix4(obj.matrixWorld);
      obj.geometry.dispose();
      (Array.isArray(obj.material)?obj.material:[obj.material]).forEach(m=>m.dispose());
    } });
    if(!out.bullet_hole) throw new Error('Incomplete ACE asset');
    const image=texture.image as HTMLImageElement;texture.dispose();
    return {geometries:out,image};
  }).catch(()=> { assets=undefined; return null; });
}

export function createAceScene(renderer:T.WebGLRenderer,onAssetsReady?:()=>void) {
  const scene=new T.Scene();
  const probe=createGlassLighting(renderer);scene.environment=probe.texture;scene.environmentIntensity=.4;
  const keyLight=new T.DirectionalLight(0xffeedb,2.1);keyLight.position.set(-300,400,600);scene.add(keyLight);
  const camera=new T.OrthographicCamera(0,1,1,0,.1,1000); camera.position.z=200;
  let width=1,height=1,layout=aceLayout(1,1);
  const resources=new Set<T.BufferGeometry|T.Material>();
  const own=<A extends T.BufferGeometry|T.Material>(r:A):A=>{resources.add(r);return r;};
  const instances=(geo:T.BufferGeometry,mat:T.Material,n:number)=>{
    mat.forceSinglePass=true;
    const mesh=new T.InstancedMesh(own(geo),own(mat),n); mesh.frustumCulled=false; scene.add(mesh); return mesh;
  };
  // Immediate, low-cost crater placeholders, upgraded when the preloaded GLB is available.
  const hole=instances(new T.CircleGeometry(1,24),new T.MeshStandardMaterial({color:0x080909,roughness:.28,metalness:.06,flatShading:true}),5);
  hole.name='ace-impact-glass';
  const center=instances(new T.CircleGeometry(.67,32),new T.MeshBasicMaterial({color:0x020303}),5);
  const cracks=instances(new T.RingGeometry(1.06,1.09,16),new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide}),5);
  const glass=instances(new T.BufferGeometry(),new T.MeshStandardMaterial({color:0xeed5b1,transparent:true,opacity:.21,roughness:.3,metalness:.05,flatShading:true,side:T.DoubleSide,depthWrite:false}),5);
  const hot=instances(new T.RingGeometry(.78,.88,24),new T.MeshBasicMaterial({color:0xf37a30,side:T.DoubleSide,transparent:true,blending:T.AdditiveBlending,depthWrite:false,depthTest:false}),5);
  const pulse=instances(new T.RingGeometry(.96,1,24),new T.MeshBasicMaterial({color:0xf37a30,side:T.DoubleSide,transparent:true,blending:T.AdditiveBlending,depthWrite:false,depthTest:false}),5);
  const flashGeometry=new T.BufferGeometry(),flashVertices=[0,0,0],flashColors=[1,1,.92],flashIndices:number[]=[];
  for(let i=0;i<16;i++){const a=i*Math.PI/8,r=i%2?.22:1+(i%3)*.15;flashVertices.push(Math.cos(a)*r,Math.sin(a)*r,0);flashColors.push(1,.38,.07);flashIndices.push(0,i+1,(i+1)%16+1);}
  flashGeometry.setAttribute('position',new T.Float32BufferAttribute(flashVertices,3));flashGeometry.setAttribute('color',new T.Float32BufferAttribute(flashColors,3));flashGeometry.setIndex(flashIndices);
  const flashes=instances(flashGeometry,new T.MeshBasicMaterial({vertexColors:true,transparent:true,blending:T.AdditiveBlending,depthWrite:false,depthTest:false}),5);
  const chips=Array.from({length:4},(_,i)=>instances(new T.TetrahedronGeometry(.09),new T.MeshStandardMaterial({color:[0xe8d6b8,0xa78660,0xffb96b,0xff7927][i],roughness:.45,metalness:.08}),i<2?8:7));
  const lineGeo=own(new T.BufferGeometry());
  const lines=new T.LineSegments(lineGeo,own(new T.LineBasicMaterial({color:0xf37a30,transparent:true,opacity:.55,depthTest:false})));scene.add(lines);lines.frustumCulled=false;
  const smoke=createImpactSmoke();scene.add(smoke.mesh);
  const glowCanvas=document.createElement('canvas');glowCanvas.width=glowCanvas.height=128;
  const glowCtx=glowCanvas.getContext('2d')!,gradient=glowCtx.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,'rgba(255,243,208,1)');gradient.addColorStop(.13,'rgba(255,183,94,.8)');gradient.addColorStop(.36,'rgba(255,90,15,.3)');gradient.addColorStop(1,'rgba(255,72,0,0)');glowCtx.fillStyle=gradient;glowCtx.fillRect(0,0,128,128);
  const glowTexture=new T.CanvasTexture(glowCanvas);glowTexture.colorSpace=T.SRGBColorSpace;
  const glows=instances(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:glowTexture,transparent:true,blending:T.AdditiveBlending,depthWrite:false,depthTest:false}),5);
  const ember=instances(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:0xffb65a,transparent:true,blending:T.AdditiveBlending,depthWrite:false,depthTest:false}),50);
  const streak=instances(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({color:0xffd8a0,transparent:true,blending:T.AdditiveBlending,depthWrite:false,depthTest:false}),40);
  const dummy=new T.Object3D(),heatColor=new T.Color();
  const place=(mesh:T.InstancedMesh,i:number,x:number,y:number,s:number,z:number,rotation=0,tilt=0)=>{
    dummy.position.set(x,y,z);dummy.rotation.set(tilt,-tilt*.7,rotation);dummy.scale.setScalar(s);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
  };
  let dead=false,detailTexture:T.Texture|undefined;
  void preloadAce().then(asset=>{if(dead||!asset)return;
    const replace=(mesh:T.InstancedMesh,g:T.BufferGeometry)=>{resources.delete(mesh.geometry);mesh.geometry.dispose();mesh.geometry=own(g.clone());};
    const geometry=asset.geometries;
    replace(hole,geometry.bullet_hole);
    detailTexture=new T.Texture(asset.image);detailTexture.colorSpace=T.SRGBColorSpace;detailTexture.needsUpdate=true;detailTexture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    const old=hole.material as T.Material;resources.delete(old);old.dispose();
    hole.material=own(new T.MeshStandardMaterial({map:detailTexture,color:0x666666,emissiveMap:detailTexture,emissive:0xffffff,emissiveIntensity:.68,roughness:.22,metalness:.18,transparent:true,alphaTest:.025,depthWrite:false,side:T.DoubleSide}));hole.material.forceSinglePass=true;
    // The photograph's black cavity must absorb light, while its glass edges reflect.
    // Mask specular light by the detail plate rather than letting the recessed center
    // reflect the probe (which otherwise creates a bright radial star in the opening).
    (hole.material as T.MeshStandardMaterial).onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>', `
        outgoingLight *= smoothstep(0.002, 0.035, max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)));
        #include <opaque_fragment>
      `);
    };

    // Fine fractures are now carried by the continuous, raised glass surface.
    // Do not overlay the old opaque polygon rim or straight crack strips.
    [center,glass,cracks,hot,pulse].forEach(mesh=>mesh.visible=false);
    chips.forEach((mesh,i)=>{if(geometry[`debris_${i}`])replace(mesh,geometry[`debris_${i}`]);});
    onAssetsReady?.();
  });
  const resize=(w:number,h:number)=>{width=w;height=h;layout=aceLayout(w,h);camera.right=w;camera.top=h;camera.updateProjectionMatrix();};
  const update=(t:number)=>{
    const state=aceTime(t); // Damage stays fixed; only particles, light and typography animate.
    keyLight.intensity=.8+state.flash*3.5;
    keyLight.position.x=-300+Math.sin(t*1.7)*200;
    keyLight.color.setRGB(1,.94-state.flash*.18,.85-state.flash*.28);
    const points=layout.positions.map(([x,y])=>[x*width,(1-y)*height]);
    const counts=[0,0,0,0];
    points.forEach(([x,y],i)=>{
      const age=t-ACE_HITS[i],active=age>=0,base=layout.radius*(.9+i*.075)*(i===4?1.3:1);
      const rotation=[-.21,.4,1.2,-.65,.14][i];
      place(hole,i,x,y,active?base:0,0,rotation,[.05,-.06,.1,-.07,.06][i]);
      place(center,i,x,y,active?base:0,0,rotation,[.05,-.06,.1,-.07,.06][i]);
      place(glass,i,x,y,active?base*ease(.012,.1,age):0,0,rotation);
      place(cracks,i,x,y,active?base*ease(.02,.1,age):0,-.15,rotation);
      place(hot,i,x,y,active&&age<.42?base:0,1,rotation);
      hot.setColorAt(i,heatColor.setScalar(active?1.5*(1-clamp(age/.42)):0));
      place(flashes,i,x,y,active&&age<.055?base*(3.5-age*30):0,2,rotation);
      place(glows,i,x,y,active&&age<.09?base*(6-age*35):0,3);
      smoke.update(i,x,y,base,age);
      for(let k=0;k<10;k++){
        const a=k*2.399+i*.71,lifetime=1.15+(k%4)*.16,u=clamp(age/lifetime);
        const distance=base*(1.2+u*(2.6+(k%3)*.6));
        const xx=x+Math.cos(a)*distance,yy=y+Math.sin(a)*distance-age*age*18;
        dummy.position.set(xx,yy,8);dummy.rotation.set(0,0,a-age*.35);const scale=active&&age<lifetime?(1-u)*Math.min(1,age/.045):0;
        dummy.scale.set(1.1*scale,(2+k%3)*scale,1);dummy.updateMatrix();ember.setMatrixAt(i*10+k,dummy.matrix);
        if(k<8){const life=.28+(k%3)*.055,v=clamp(age/life),r=base*(.8+v*(3+k%3));dummy.position.set(x+Math.cos(a)*r,y+Math.sin(a)*r,10);dummy.rotation.z=a;
          const show=active&&age<life?(1-v):0;dummy.scale.set(base*.42*show,1*show,1);dummy.updateMatrix();streak.setMatrixAt(i*8+k,dummy.matrix);}
      }
      const p=clamp((t-ACE_REVEAL-.1)/.16);
      place(pulse,i,x,y,t>=ACE_REVEAL+.1&&p<1?base*(1+p*.10):0,1.5);
      for(let k=0;k<6;k++){
        const group=(i*6+k)%4,index=counts[group]++,a=k*2.399+i*.7;
        const lifetime=group>=2?.95:.38,u=clamp(age/lifetime),distance=(layout.mobile?40:75)*(1+k*.18)*(1-(1-u)**2)*(1+i*.08);
        place(chips[group],index,x+Math.cos(a)*distance,y+Math.sin(a)*distance-age*age*90,
          active&&age<lifetime?base*(1-u)**1.25:0,2+Math.sin(u*Math.PI)*7,k+age*(k%2?35:-31),k*.35+age*12);
      }
    });
    if(hot.instanceColor)hot.instanceColor.needsUpdate=true;
    (pulse.material as T.MeshBasicMaterial).opacity=1.5*(1-clamp((t-ACE_REVEAL-.1)/.16));
    [hole,center,glass,cracks,hot,pulse,flashes,glows,ember,streak,...chips].forEach(m=>{m.instanceMatrix.needsUpdate=true;});
    const vertices:number[]=[];
    const segment=(x:number,y:number,xx:number,yy:number)=>vertices.push(x,y,3,x+(xx-x)*state.lines,y+(yy-y)*state.lines,3);
    const centerY=height*.50;
    segment(width*.04,centerY,width*.34,centerY);segment(width*.67,centerY,width*.96,centerY);
    for(const x of [width*.033,width*.967]){segment(x-7,centerY,x+7,centerY);segment(x,centerY-9,x,centerY+9);}
    const crossY=height*.76;
    segment(width*.5-13,crossY,width*.5+13,crossY);segment(width*.5,crossY-10,width*.5,crossY+10);
    // One fixed-size buffer; no scene objects or geometry allocations per frame.
    let attr=lineGeo.getAttribute('position') as T.BufferAttribute|undefined;
    if(!attr){attr=new T.BufferAttribute(new Float32Array(vertices.length),3);lineGeo.setAttribute('position',attr);}
    (attr.array as Float32Array).set(vertices);attr.needsUpdate=true;lines.visible=state.lines>0;
  };
  return {scene,camera,resize,update,dispose:()=>{dead=true;[hole,center,glass,cracks,hot,pulse,flashes,glows,ember,streak,...chips].forEach(m=>m.dispose());resources.forEach(r=>r.dispose());detailTexture?.dispose();probe.dispose();smoke.dispose();glowTexture.dispose();scene.clear();}};
}
