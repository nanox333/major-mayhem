import { describe, expect, it } from 'vitest';
import { NOSCOPE_CUT, NOSCOPE_DURATION, NOSCOPE_FALL, NOSCOPE_HIT, NOSCOPE_REVEAL, NOSCOPE_SHOT, noscopeTime } from './timeline';
import { createRagdoll } from './ragdoll';
import { createNoscope } from './noscope';
import * as T from 'three';

describe('noscope replay', () => {
  it('finishes at the same elapsed time at 30, 60 and 120 fps', () => {
    for (const fps of [30,60,120]) {
      const done = Array.from({length:1200},(_,i)=>i/fps).find(t=>noscopeTime(t).done)!;
      expect(done).toBeGreaterThanOrEqual(NOSCOPE_DURATION);
      expect(done).toBeLessThan(NOSCOPE_DURATION+1/fps);
    }
  });
  it('fires in first person, cuts to the bullet, crawls, then rushes into the hit before the title',()=>{
    const advance=(t:number)=>noscopeTime(t+.05).flight-noscopeTime(t).flight;
    expect(NOSCOPE_SHOT).toBeLessThan(NOSCOPE_CUT);expect(NOSCOPE_CUT).toBeLessThan(NOSCOPE_HIT);
    expect(noscopeTime(NOSCOPE_CUT-.01)).toMatchObject({chase:0,flight:0});
    expect(noscopeTime(NOSCOPE_CUT+.01).chase).toBe(1);
    expect(noscopeTime(NOSCOPE_SHOT-.01).cross).toBeGreaterThan(.9);expect(noscopeTime(NOSCOPE_SHOT).cross).toBe(0);
    // slow motion keeps moving (never a dead stretch) and the final rush is much faster than the crawl
    expect(advance(NOSCOPE_CUT+.3)).toBeGreaterThan(.005);
    expect(advance(NOSCOPE_HIT-.1)).toBeGreaterThan(advance(NOSCOPE_CUT+.3)*8);
    expect(noscopeTime(NOSCOPE_HIT)).toMatchObject({flight:1,fall:0,reveal:0});
    expect(noscopeTime(NOSCOPE_HIT+.1)).toMatchObject({flight:1,rag:0,fall:0,reveal:0});
    expect(noscopeTime(NOSCOPE_FALL+.9).rag).toBeGreaterThan(.5);
    expect(noscopeTime(NOSCOPE_REVEAL-.2).reveal).toBe(0);
    expect(noscopeTime(NOSCOPE_REVEAL+.3)).toMatchObject({fall:1,reveal:1,done:false});
  });
  it('restores poses when scrubbing backwards and disposes every owned resource', () => {
    const kit=new T.Group();
    for(const name of ['Environment','Target','Rifle','Projectile']) {
      const group=new T.Group(); group.name=name;
      group.add(new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial()));kit.add(group);
    }
    const joint=new T.Bone();joint.name='TargetBody';joint.rotation.z=.35;
    kit.getObjectByName('Target')!.add(joint);const bind=joint.quaternion.clone();
    const world=createNoscope(kit);world.update(5.5);world.update(.5);
    world.update(0);
    expect(joint.quaternion.angleTo(bind)).toBeCloseTo(0);
    expect(world.scene.getObjectByName('Target')!.rotation.x).toBeCloseTo(0);
    world.update(2.5);
    expect(world.scene.getObjectByName('Projectile')!.visible).toBe(true);
    let allocated=0,disposed=0;
    const seen=new Set();
    world.scene.traverse(o=>{
      const resources=o instanceof T.Mesh||o instanceof T.LineSegments||o instanceof T.Points ? [o.geometry,...(Array.isArray(o.material)?o.material:[o.material])] : o instanceof T.Sprite ? [o.material] : [];
      for(const resource of resources) if(!seen.has(resource)){seen.add(resource);allocated++;resource.addEventListener('dispose',()=>disposed++);}
    });
    world.dispose();expect(disposed).toBe(allocated);
  });
  it('samples the same physical ragdoll at every frame rate and lands above the floor',()=>{
    const target=new T.Group();target.position.z=-24;
    const ragdoll=createRagdoll(target);
    for(const fps of [30,60,120]) {
      for(let frame=0;frame<=fps*.6;frame++)ragdoll.update(frame/fps);
      ragdoll.update(.6);
      const position=target.position.clone(),rotation=target.quaternion.clone();
      ragdoll.update(0);ragdoll.update(.6);
      expect(target.position.distanceTo(position)).toBeLessThan(1e-9);
      expect(target.quaternion.angleTo(rotation)).toBeLessThan(1e-7);
    }
    const landing=ragdoll.frames.at(-1)!;
    expect(landing[0].p.y).toBeLessThan(.4);
    for(const frame of ragdoll.frames)for(const body of frame){
      expect(body.p.y).toBeGreaterThan(-.02);
      expect(body.p.toArray().every(Number.isFinite)).toBe(true);
      expect(body.q.length()).toBeCloseTo(1);
    }
  });

  it('holds the title before smoothly fading back and advances the hit burst during hit-stop',()=>{
    expect(noscopeTime(NOSCOPE_REVEAL+.4)).toMatchObject({reveal:1,opacity:1,done:false});
    expect(noscopeTime(NOSCOPE_DURATION-.2).opacity).toBeGreaterThan(0);
    expect(noscopeTime(NOSCOPE_DURATION-.2).opacity).toBeLessThan(1);
    expect(noscopeTime(NOSCOPE_DURATION)).toMatchObject({opacity:0,done:true});
    const kit=new T.Group();
    for(const name of ['Environment','Target','Rifle','Projectile']){const group=new T.Group();group.name=name;kit.add(group);}
    const world=createNoscope(kit);
    const meshes: T.InstancedMesh[]=[];world.scene.traverse(o=>{if(o instanceof T.InstancedMesh)meshes.push(o);});
    world.update(NOSCOPE_HIT+.01);const before=meshes.find(o=>o.name==='ImpactSparks')!.instanceMatrix.array.slice();
    world.update(NOSCOPE_HIT+.1);
    expect(Array.from(meshes.find(o=>o.name==='ImpactSparks')!.instanceMatrix.array)).not.toEqual(Array.from(before));
    expect(world.scene.getObjectByName('Projectile')!.scale.x).toBeLessThan(1);
    world.dispose();
  });

  it('derives the projectile blur from the same flight curve, not from the frame rate',()=>{
    expect(noscopeTime(NOSCOPE_CUT-.1).acceleration).toBe(0);
    expect(noscopeTime(2.2).acceleration).toBeLessThan(noscopeTime(3.2).acceleration);
    expect(noscopeTime(3.2).acceleration).toBeLessThan(noscopeTime(3.9).acceleration);
    expect(noscopeTime(NOSCOPE_HIT).acceleration).toBe(0);
    const dt=.001,t=3.2,d=NOSCOPE_HIT-NOSCOPE_CUT;
    const physical=(noscopeTime(t+dt).flight-2*noscopeTime(t).flight+noscopeTime(t-dt).flight)/(dt*dt);
    expect(noscopeTime(t).acceleration).toBeCloseTo(physical*d*d/18,3);
  });
});
