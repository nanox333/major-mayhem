// Isolated asset review. It does not mount or change game state.
import React,{useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createGlassLighting} from '../src/ui/ace/lighting';
function MaterialReview({angle}:{angle:boolean}){
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const renderer=new T.WebGLRenderer({canvas:ref.current!,alpha:true,antialias:true});renderer.setSize(768,768,false);renderer.setClearColor(0x07090b,1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
    const scene=new T.Scene(),probe=createGlassLighting(renderer);scene.environment=probe.texture;scene.environmentIntensity=1;
    const key=new T.DirectionalLight(0xffeed7,2.1);key.position.set(-3,4,6);scene.add(key);
    const camera=new T.OrthographicCamera(-3.7,3.7,3.7,-3.7,.1,100);camera.position.set(angle?2:0,angle?-1:0,8);camera.lookAt(0,0,0);
    let dead=false;
    new GLTFLoader().load('/assets/highlights/ace/impact-v2.glb',gltf=>{
      if(dead)return;
      gltf.scene.traverse(o=>{if(o instanceof T.Mesh){if(o.name.startsWith('debris_'))o.visible=false;
        for(const mat of Array.isArray(o.material)?o.material:[o.material]){mat.forceSinglePass=true;if(o.name==='bullet_center'){o.material=new T.MeshBasicMaterial({color:0x010202});mat.dispose();}}
      }});
      scene.add(gltf.scene);renderer.render(scene,camera);ref.current!.dataset.ready='true';ref.current!.dataset.triangles=String(renderer.info.render.triangles);
    });
    return()=>{dead=true;scene.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());}});probe.dispose();renderer.dispose();};
  },[angle]);
  return <canvas ref={ref} style={{width:'min(85vh,90vw)',height:'min(85vh,90vw)'}}/>;
}
export function reviewMaterial(angle=false){const el=document.createElement('div');el.style.cssText='position:fixed;inset:0;background:#07090b;display:grid;place-items:center;z-index:100000';document.body.append(el);const root=createRoot(el);root.render(<MaterialReview angle={angle}/>);return()=>{root.unmount();el.remove();};}
