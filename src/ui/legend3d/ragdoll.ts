import * as T from 'three';
import { Body, Box, ConeTwistConstraint, Plane, Vec3, World } from 'cannon-es';

/** Seven constrained bodies, floor collision only. Simulate once at a fixed rate;
 * playback samples that physical collapse by elapsed time, including backwards seeking. */
export function createRagdoll(target:T.Object3D) {
  target.updateMatrixWorld(true);
  const world=new World({gravity:new Vec3(0,-35,0)});
  world.defaultContactMaterial.friction=.65;world.defaultContactMaterial.restitution=.04;
  const floor=new Body({mass:0,shape:new Plane(),collisionFilterGroup:1,collisionFilterMask:2});
  floor.quaternion.setFromEuler(-Math.PI/2,0,0);world.addBody(floor);
  const specs=[
    {name:'pelvis',at:[0,.86,-24],half:[.19,.09,.12],mass:5},
    {name:'TargetBody',at:[0,1.18,-24],half:[.23,.27,.14],mass:9},
    {name:'TargetHead',at:[0,1.65,-24],half:[.13,.16,.13],mass:2},
    {name:'LeftArm',at:[-.29,1.16,-24.04],half:[.08,.23,.08],mass:1.5},
    {name:'RightArm',at:[.29,1.16,-24.04],half:[.08,.23,.08],mass:1.5},
    {name:'LeftLeg',at:[-.13,.47,-24],half:[.10,.38,.10],mass:3},
    {name:'RightLeg',at:[.13,.47,-24],half:[.10,.38,.10],mass:3},
  ];
  const bodies=specs.map(s=>{
    const body=new Body({mass:s.mass,shape:new Box(new Vec3(...s.half)),position:new Vec3(...s.at),
      collisionFilterGroup:2,collisionFilterMask:1,linearDamping:.16,angularDamping:.4});
    body.velocity.set(.12,0,-.65);body.angularVelocity.set(-3,0,.12);
    world.addBody(body);return body;
  });
  function joint(a:number,b:number,at:number[],angle:number) {
    const point=new Vec3(...at),pa=new Vec3(),pb=new Vec3();
    bodies[a].pointToLocalFrame(point,pa);bodies[b].pointToLocalFrame(point,pb);
    world.addConstraint(new ConeTwistConstraint(bodies[a],bodies[b],{
      pivotA:pa,pivotB:pb,axisA:new Vec3(0,1,0),axisB:new Vec3(0,1,0),
      angle,twistAngle:.15,collideConnected:false,maxForce:5000}));
  }
  joint(0,1,[0,.91,-24],.22);joint(1,2,[0,1.47,-24],.3);
  joint(1,3,[-.26,1.4,-24],.65);joint(1,4,[.26,1.4,-24],.65);
  joint(0,5,[-.13,.86,-24],.35);joint(0,6,[.13,.86,-24],.35);
  bodies[1].angularVelocity.x=-6;
  // a head shot: the head whips back and up, the torso folds after it
  bodies[2].applyImpulse(new Vec3(.2,.55,-3.4));bodies[1].applyImpulse(new Vec3(0,.3,-1.4));
  const fps=120,frames: {p:T.Vector3;q:T.Quaternion}[][]=[];
  for(let frame=0;frame<=108;frame++) {
    frames.push(bodies.map(b=>({p:new T.Vector3(b.position.x,b.position.y,b.position.z),q:new T.Quaternion(b.quaternion.x,b.quaternion.y,b.quaternion.z,b.quaternion.w)})));
    world.step(1/fps);
  }
  // No physics timer or world is retained after the short trajectory is generated.
  const bones=specs.map(s=>target.getObjectByName(s.name));
  const rest=bones.map(b=>b?.getWorldQuaternion(new T.Quaternion()));
  const q=new T.Quaternion(),parentQ=new T.Quaternion(),offset=new T.Vector3(),p=new T.Vector3();
  return {
    update(seconds:number) {
      const sample=Math.max(0,Math.min(frames.length-1,seconds*fps)),a=Math.floor(sample),b=Math.min(a+1,frames.length-1),u=sample-a;
      const pose=(i:number)=>{p.copy(frames[a][i].p).lerp(frames[b][i].p,u);q.copy(frames[a][i].q).slerp(frames[b][i].q,u);};
      pose(0);target.quaternion.copy(q);target.position.copy(p).add(offset.set(0,-.86,0).applyQuaternion(q));target.updateMatrixWorld(true);
      for(let i=1;i<bones.length;i++) {
        const bone=bones[i];if(!bone||!rest[i])continue;
        pose(i);q.multiply(rest[i]!);bone.parent!.getWorldQuaternion(parentQ);
        bone.quaternion.copy(parentQ.invert()).multiply(q);bone.updateMatrixWorld(true);
      }
    },
    /** Stable samples are exposed for deterministic trajectory tests. */
    frames,
  };
}
