import * as T from 'three';
import { disposeKit } from './assets';
import { reflectedFloor } from './surfaces';
import { createRagdoll } from './ragdoll';
import { addGrit } from './grit';
import { noscopeTime, smooth, clamp, NOSCOPE_CUT, NOSCOPE_FALL, NOSCOPE_HIT, NOSCOPE_SHOT } from './timeline';

/** Small scene kit contract: later highlights can reuse the map, character and props. */
export interface HighlightScene { scene: T.Scene; camera: T.PerspectiveCamera; /** Where the target's head is on the screen (0..1), so the crosshair sits on the model. */ crosshair?: { x: number; y: number }; update(seconds: number): void; dispose(): void; setLowQuality(): void }
export function createNoscope(kit: T.Group): HighlightScene {
  const scene = new T.Scene(); scene.background = new T.Color('#1a120c'); scene.fog = new T.Fog('#7a4a1c', 22, 70);
  const camera = new T.PerspectiveCamera(58, 16 / 9, .05, 100);
  const hemi = new T.HemisphereLight('#c8883f', '#1c0e07', .6); scene.add(hemi);
  // The doorway behind the target glows: it backlights the silhouette and gives the corridor its warm end.
  const backlight = new T.PointLight('#ff8c2a', 60, 24, 1.6); backlight.position.set(0, 2.3, -27.6); scene.add(backlight);
  const bulletLight = new T.PointLight('#ff9a4a', 0, 11, 1.6); scene.add(bulletLight);
  const muzzleLight = new T.PointLight('#ffc27a', 0, 16, 1.4); scene.add(muzzleLight);
  const sun = new T.DirectionalLight('#ffb36e', 2.2); sun.position.set(-9, 14, -15); sun.target.position.set(0, 1, -24);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 21, bottom: -21, near: .1, far: 65 });
  sun.shadow.normalBias = .07; sun.shadow.bias = -.0006; scene.add(sun, sun.target);
  const environment = kit!.getObjectByName('Environment')!;
  // Keep the map recognizable, but match ACE's charcoal stage rather than daylight plaster.
  environment.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])
    if(m instanceof T.MeshStandardMaterial){m.color.multiply(new T.Color(.36,.30,.25));addGrit(m);}});
  const target = kit!.getObjectByName('Target')!;
  const rifle = kit!.getObjectByName('Rifle')!;
  const bullet = kit!.getObjectByName('Projectile')!;
  target.position.set(0,0,-24); const hold=new T.Group(); scene.add(environment,target,bullet,camera,hold); hold.add(rifle);
  rifle.position.set(.30,-.32,-.62); rifle.scale.setScalar(.75); bullet.scale.setScalar(.55);
  scene.traverse(o => { if (o instanceof T.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  const floor=reflectedFloor();scene.add(floor);
  target.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])
    if(m instanceof T.MeshStandardMaterial){m.roughness=.86;m.envMapIntensity=1.25;}});
  rifle.traverse(o=>{if(o instanceof T.Mesh)for(const m of Array.isArray(o.material)?o.material:[o.material])
    if(m instanceof T.MeshStandardMaterial&&m.metalness>0){m.roughness=.28;m.envMapIntensity=1.5;}});
  // The projectile's authored mesh stays available in the kit but is hidden by its exposure trail.
  bullet.traverse(o=>{if(o instanceof T.Mesh)o.visible=false;});
  const targetWeapon = target.getObjectByName('TargetWeapon');
  const body=target.getObjectByName('TargetBody'),head=target.getObjectByName('TargetHead');
  const leftArm=target.getObjectByName('LeftArm'),rightArm=target.getObjectByName('RightArm');
  const leftLeg=target.getObjectByName('LeftLeg'),rightLeg=target.getObjectByName('RightLeg');
  const leftKnee=target.getObjectByName('LeftKnee'),rightKnee=target.getObjectByName('RightKnee');
  const joints=[body,head,leftArm,rightArm,leftLeg,rightLeg,leftKnee,rightKnee].filter((o): o is T.Object3D => !!o);
  const bind=new Map(joints.map(o=>[o,o.quaternion.clone()]));
  const delta=new T.Quaternion(),angles=new T.Euler();
  function pose(o:T.Object3D|undefined,x:number,z=0) {if(o)o.quaternion.copy(bind.get(o)!).multiply(delta.setFromEuler(angles.set(x,0,z)));}
  const ragdoll=createRagdoll(target);
  let lift: number[]|undefined;
  /** How far the posed model dips below the floor at each point of the fall (sampled once; the fall is deterministic). */
  function floorClearance() {
    const box=new T.Box3(),out: number[]=[];
    for(let k=0;k<=28;k++){ragdoll.update(k/40);target.updateMatrixWorld(true);box.makeEmpty();box.expandByObject(target,true);out.push(box.isEmpty()?0:Math.max(0,-box.min.y+.012));}
    return out;
  }
  const skyGeo=new T.SphereGeometry(60,24,12),skyColors=new Float32Array(skyGeo.attributes.position.count*3);
  const skyTop=new T.Color('#120a06'),skyBottom=new T.Color('#4a2410'),skyColor=new T.Color();
  for(let i=0;i<skyGeo.attributes.position.count;i++)skyColor.copy(skyBottom).lerp(skyTop,Math.max(0,skyGeo.attributes.position.getY(i)/60)).toArray(skyColors,i*3);
  skyGeo.setAttribute('color',new T.BufferAttribute(skyColors,3));
  const sky=new T.Mesh(skyGeo,new T.MeshBasicMaterial({vertexColors:true,side:T.BackSide,fog:false,depthWrite:false}));scene.add(sky);

  const hit = new T.Vector3(0,1.58,-24);
  // The first-person pose, and the rifle that is held in it. The rifle lives in the world (not on the camera) so the close-up of the shot can leave it behind.
  const fpCam = new T.PerspectiveCamera(), fpAim = new T.Vector3(), muzzleLocal = new T.Vector3(.40,-.29,-1.66);
  { // the muzzle is the far end of the rifle model, on the barrel line
    const box = new T.Box3().setFromObject(rifle); if(!box.isEmpty()) muzzleLocal.set((box.min.x+box.max.x)/2, box.min.y+(box.max.y-box.min.y)*.35, box.min.z); }
  function placeFp(e: number) {
    fpCam.position.set(.1,1.65+Math.sin(e*9)*.012*(1-noscopeTime(e).walk),4.6-2*noscopeTime(e).walk);
    fpAim.set(-.9+.9*smooth(.45,1.05,e),1.52+.06*smooth(.45,1.05,e),-24);
    fpCam.lookAt(fpAim); fpCam.updateMatrixWorld(true);
  }
  placeFp(NOSCOPE_SHOT);
  // A dead straight line from the muzzle to the head: the bullet never bends.
  const path = new T.LineCurve3(muzzleLocal.clone().applyMatrix4(fpCam.matrixWorld), hit.clone().add(new T.Vector3(0,0,.12)));
  const pos = new T.Vector3(), tangent = new T.Vector3(), ride = new T.Vector3(), aim = new T.Vector3(), flightAim = new T.Vector3();
  const up = new T.Vector3(0,1,0);
  // Tiny generated radial sprite; no texture downloads or post-processing.
  const pixels = new Uint8Array(64*64*4);
  for (let y=0;y<64;y++) for(let x=0;x<64;x++) { const r = Math.hypot((x-31.5)/32,(y-31.5)/32); const i=(y*64+x)*4; pixels.set([255,235,180,Math.round(255*Math.pow(Math.max(0,1-r),2))],i); }
  const texture = new T.DataTexture(pixels,64,64); texture.needsUpdate = true;
  const flashMat = new T.SpriteMaterial({ map:texture, color:'#fff6df', transparent:true, depthWrite:false, blending:T.AdditiveBlending, toneMapped:false });
  flashMat.color.multiplyScalar(3);
  const flash = new T.Sprite(flashMat); scene.add(flash);
  const glowMat=new T.SpriteMaterial({map:texture,color:'#ff7a22',transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,opacity:.75});
  const glow=new T.Sprite(glowMat);glow.position.set(0,1.7,-26.4);glow.scale.set(9,7,1);scene.add(glow);
  const flarePixels=new Uint8Array(64*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<64;x++){
    const dx=(x-31.5)/32,dy=(y-31.5)/32,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx);
    const rays=Math.pow(Math.abs(Math.cos(a*5)),16);
    flarePixels.set([255,219,156,Math.round(255*Math.max(0,1-r)*Math.max(Math.pow(Math.max(0,1-r*4),2),rays*.75))],(y*64+x)*4);
  }
  const flareTexture=new T.DataTexture(flarePixels,64,64);flareTexture.needsUpdate=true;
  for(const tx of [texture,flareTexture]){tx.magFilter=T.LinearFilter;tx.minFilter=T.LinearFilter;tx.generateMipmaps=false;}
  flashMat.map=flareTexture;
  const streakMat=new T.MeshBasicMaterial({map:texture,color:'#ffae58',transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
  streakMat.color.multiplyScalar(.85);
  const streak=new T.InstancedMesh(new T.PlaneGeometry(1,1),streakMat,4);streak.name='ProjectileExposure';streak.frustumCulled=false;scene.add(streak);
  const exposurePose=new T.Object3D(),exposureColor=new T.Color(),exposureRight=new T.Vector3(),exposureUp=new T.Vector3();
  const impactMat = flashMat.clone(); impactMat.map=flareTexture;impactMat.depthTest=false; impactMat.color.set('#ff8c35').multiplyScalar(4.5); const impact = new T.Sprite(impactMat); impact.position.copy(hit).add(new T.Vector3(0,0,.23)); scene.add(impact);
  // Hit light: the helmet and face flare orange for a moment, and an anamorphic streak crosses the frame, as in the board.
  const hitLight=new T.PointLight('#ff5a2a',0,7,1.4);hitLight.position.copy(hit).add(new T.Vector3(0,.1,.6));scene.add(hitLight);
  const streakFlareMat=new T.SpriteMaterial({map:texture,color:'#ffb050',transparent:true,depthWrite:false,depthTest:false,blending:T.AdditiveBlending,toneMapped:false});
  streakFlareMat.color.multiplyScalar(2.2);const streakFlare=new T.Sprite(streakFlareMat);streakFlare.position.copy(hit).add(new T.Vector3(0,0,.3));scene.add(streakFlare);
  const sparkMat = new T.MeshBasicMaterial({color:'#ffb34e',transparent:true,depthWrite:false,depthTest:false,toneMapped:false});
  const sparks = new T.InstancedMesh(new T.BoxGeometry(.008,.045,.008),sparkMat,40); sparks.name='ImpactSparks';sparks.frustumCulled=false; scene.add(sparks);
  sparkMat.color.multiplyScalar(2);
  const debrisMat=new T.MeshBasicMaterial({color:"#9a1d14",transparent:true,depthWrite:false});
  const debris=new T.InstancedMesh(new T.BoxGeometry(.012,.03,.012),debrisMat,36);debris.frustumCulled=false;scene.add(debris);
  const ringMat=new T.MeshBasicMaterial({color:'#ffc477',transparent:true,depthWrite:false,depthTest:false,side:T.DoubleSide,toneMapped:false});
  const ring=new T.Mesh(new T.RingGeometry(.975,1,48),ringMat);ring.position.copy(hit).add(new T.Vector3(0,0,.25));scene.add(ring);
  const puffPositions=new Float32Array(34*3),puffGeo=new T.BufferGeometry();puffGeo.setAttribute('position',new T.BufferAttribute(puffPositions,3));
  const puffMat=new T.PointsMaterial({map:texture,color:'#7a0f0b',size:.16,transparent:true,depthWrite:false,opacity:.6});
  const puff=new T.Points(puffGeo,puffMat);puff.frustumCulled=false;scene.add(puff);
  const dummy = new T.Object3D();
  const linePositions = new Float32Array(12*6); const lineGeo = new T.BufferGeometry(); lineGeo.setAttribute('position',new T.BufferAttribute(linePositions,3));
  const lineMat = new T.LineBasicMaterial({color:'#fff5dc',transparent:true,opacity:.3,depthWrite:false}); const lines = new T.LineSegments(lineGeo,lineMat); lines.frustumCulled=false; scene.add(lines);
  const dustGeo = new T.BufferGeometry(); const dustPositions = new Float32Array(20*3);
  for(let i=0;i<20;i++) dustPositions.set([Math.sin(i*3.1)*3, .7+(i%7)*.45, -2-i*1.1],i*3);
  dustGeo.setAttribute('position',new T.BufferAttribute(dustPositions,3)); const dustMat = new T.PointsMaterial({color:'#f5dbb0',size:.025,transparent:true,opacity:.35,depthWrite:false}); scene.add(new T.Points(dustGeo,dustMat));
  // Embers hang in the corridor: in the slow motion they are what the eye reads as speed, passing the camera.
  const emberGeo=new T.BufferGeometry(),emberPositions=new Float32Array(40*3);emberGeo.setAttribute('position',new T.BufferAttribute(emberPositions,3));
  const emberMat=new T.PointsMaterial({map:texture,color:'#ff9a4a',size:.07,transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});
  const embers=new T.Points(emberGeo,emberMat);embers.frustumCulled=false;scene.add(embers);
  // Drifting orange smoke along the corridor, soft enough to read as haze in the light rather than as shapes.
  const smokeMat=new T.SpriteMaterial({map:texture,color:'#c0682c',transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,opacity:.11});
  const smoke=Array.from({length:9},(_,i)=>{const sp=new T.Sprite(smokeMat);scene.add(sp);return sp;});
  const ndc=new T.Vector3(),crosshair={x:.5,y:.46};
  const side=new T.Vector3(-.95,.08,.55),behind=new T.Vector3(),sway=new T.Vector3();
  const right = new T.Vector3(), offset = new T.Vector3();
  function update(seconds: number) {
    const s=noscopeTime(seconds), e=s.elapsed;
    const age=s.hitAge,hitActive=e>=NOSCOPE_HIT,chase=e>=NOSCOPE_CUT&&!hitActive;
    const cs=clamp((e-NOSCOPE_CUT)/(NOSCOPE_HIT-NOSCOPE_CUT));
    path.getPoint(s.flight,pos); path.getTangent(s.flight,tangent);
    bullet.position.copy(pos); bullet.quaternion.setFromUnitVectors(up,tangent); bullet.rotateY(e*13); bullet.visible=chase;
    const closeUp=e>=NOSCOPE_SHOT&&e<NOSCOPE_CUT;
    placeFp(Math.min(e,NOSCOPE_SHOT)); hold.position.copy(fpCam.position); hold.quaternion.copy(fpCam.quaternion); hold.updateMatrixWorld(true);
    if(e<NOSCOPE_SHOT) {
      // First person: walk in, spot the enemy at the end of the corridor, bring the crosshair onto it.
      camera.position.copy(fpCam.position); aim.copy(fpAim);
    } else if(closeUp) {
      // The shot, close on the muzzle: the rifle stays where it was held and the camera pushes in beside the barrel.
      const k=s.shotAge/(NOSCOPE_CUT-NOSCOPE_SHOT),m=muzzleLocal.clone().applyMatrix4(hold.matrixWorld);
      const r=new T.Vector3(1,0,0).applyQuaternion(fpCam.quaternion),u=new T.Vector3(0,1,0).applyQuaternion(fpCam.quaternion),f=new T.Vector3(0,0,-1).applyQuaternion(fpCam.quaternion);
      camera.position.copy(m).addScaledVector(r,-.4).addScaledVector(u,.17).addScaledVector(f,-.55+.25*k); aim.copy(m).addScaledVector(f,1.4).addScaledVector(r,.06);
    } else if(!hitActive) {
      // Slow motion: a profile of the bullet that swings round behind it as it speeds up, ending right on the head.
      behind.set(camera.aspect < .9 ? .28 : .5,.12,1.35);
      ride.copy(pos).add(sway.copy(side).lerp(behind,smooth(0,.8,cs)));
      flightAim.copy(pos).addScaledVector(tangent,3+3*cs).lerp(hit,smooth(.6,1,cs));
      camera.position.copy(ride); aim.copy(flightAim);
    } else {
      camera.position.set(.5,1.70,-22.53).lerp(new T.Vector3(.85,.85,-22.0),s.drop);
      // settle with the body low and to the right, clear of the title and the plate that follow
      aim.copy(hit).lerp(new T.Vector3(-1.5,.85,-24.45),s.fall);
      // a slow drift through the hold, so the final picture is never frozen
      const drift=clamp((e-NOSCOPE_FALL)/4);camera.position.x+=.1*drift;camera.position.z+=.12*drift;aim.x+=.08*drift;
    }
    const kick = e>=NOSCOPE_SHOT ? Math.exp(-s.shotAge*35)*Math.sin(s.shotAge*70)*.035 : 0;
    const shake = hitActive ? Math.exp(-age*19)*.13 : chase ? .003+.012*s.rush : 0;
    camera.position.x += Math.sin(age*99+.5)*shake; camera.position.y += Math.cos(age*81)*shake;
    sky.position.copy(camera.position); camera.lookAt(aim);camera.rotateZ(hitActive?Math.sin(age*55)*Math.exp(-age*16)*.025:chase?(-.04+.04*cs):0);
    // telephoto during the crawl, wide as the bullet rushes in, back to normal after the hit
    const base=camera.aspect < .9 ? 64 : 58, wide=camera.aspect < .9 ? 8 : 12;
    camera.fov = closeUp ? 44 : base + wide*s.rush - 7*Math.exp(-age*9)*(hitActive?1:0) - (e>=NOSCOPE_CUT&&e<NOSCOPE_HIT?wide*(1-s.rush)*smooth(NOSCOPE_CUT,NOSCOPE_CUT+.1,e):0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    ndc.copy(hit).project(camera);crosshair.x=ndc.x*.5+.5;crosshair.y=.5-ndc.y*.5;
    bulletLight.visible=chase;bulletLight.position.copy(pos).addScaledVector(tangent,.4);bulletLight.intensity=4+10*s.rush;
    muzzleLight.intensity=e>=NOSCOPE_SHOT&&e<NOSCOPE_CUT?90*Math.exp(-s.shotAge*22):0;muzzleLight.position.set(.4,-.2,-1.9).applyMatrix4(hold.matrixWorld);
    embers.visible=true;
    for(let i=0;i<40;i++)emberPositions.set([Math.sin(i*1.7)*1.7+Math.sin(e*.5+i)*.15,.5+((i*.37)%1.7)+Math.sin(e*.7+i*2)*.12,1.2-i*.62],i*3);
    emberGeo.attributes.position.needsUpdate=true;
    smoke.forEach((sp,i)=>{sp.visible=true;sp.position.set(Math.sin(i*2.1)*2.2+Math.sin(e*.25+i)*.5,1.1+(i%3)*.5+Math.sin(e*.3+i*1.3)*.15,2-i*2.4);sp.scale.setScalar(5+(i%3)*2.2);});
    streak.visible=bullet.visible;
    exposureRight.set(1,0,0).applyQuaternion(camera.quaternion);exposureUp.set(0,1,0).applyQuaternion(camera.quaternion);
    const trailLength=.12+.15*s.acceleration,trailAngle=Math.atan2(tangent.dot(exposureUp),tangent.dot(exposureRight));
    for(let i=0;i<4;i++){
      exposurePose.position.copy(pos).addScaledVector(tangent,-i*trailLength/4);
      exposurePose.quaternion.copy(camera.quaternion);exposurePose.rotateZ(trailAngle);
      exposurePose.scale.set(.45+trailLength*.2,.07+.02*s.acceleration+i*.004*s.acceleration,1);exposurePose.updateMatrix();streak.setMatrixAt(i,exposurePose.matrix);
      exposureColor.setRGB(1-i*.22,.85-i*.18,.60-i*.13);streak.setColorAt(i,exposureColor);
    }streak.instanceMatrix.needsUpdate=true;streak.instanceColor!.needsUpdate=true;
    const recoil=e>=NOSCOPE_SHOT?Math.exp(-s.shotAge*14):0;
    rifle.visible=e<NOSCOPE_CUT; rifle.position.z=-.62+recoil*.14; rifle.rotation.x=kick*2+recoil*.07;
    flash.visible=e>=NOSCOPE_SHOT&&s.shotAge<.11; flash.position.copy(muzzleLocal).applyMatrix4(hold.matrixWorld); flash.scale.setScalar(.7*(1-s.shotAge/.12));
    target.position.set(0,0,-24);target.rotation.set(0,0,0);
    for(const joint of joints)joint.quaternion.copy(bind.get(joint)!);
    if(hitActive){
      if(!lift)lift=floorClearance();
      ragdoll.update(s.rag);
      // the head whips back on the round: a fast snap that settles as the body folds, on top of the ragdoll
      if(head){const snap=(1-Math.exp(-age*45))*Math.exp(-age*3.4);head.rotateX(-.7*snap);head.rotateZ(.2*snap);head.updateMatrixWorld(true);}
      // the physics boxes are thinner than the model: lift the body by exactly what sank below the floor
      const u=clamp(s.rag/.7)*(lift.length-1),i=Math.floor(u);target.position.y+=lift[i]+(lift[Math.min(i+1,lift.length-1)]-lift[i])*(u-i);target.updateMatrixWorld(true);
    }
    else pose(body,Math.sin(e*3)*.004);
    if(targetWeapon)targetWeapon.rotation.set(0,0,0);
    // A head shot: a small flash where the round lands, a red mist that sprays out behind the head and fine droplets on a ballistic arc,
    // a few chips off the helmet, and the head snapping back (the ragdoll). No bursts of light, rings or lens streaks.
    impact.visible=hitActive&&age<.09;impact.scale.setScalar(.16+age*1.4);impactMat.opacity=1-smooth(.02,.09,age);
    streakFlare.visible=false;ring.visible=false;
    hitLight.intensity=hitActive?35*Math.exp(-age*12):0;
    const mist=Math.min(age,1.2);
    puff.visible=hitActive&&age<1.2;puffMat.opacity=.85*(1-smooth(.15,1.2,age))*Math.min(1,age*40);puffMat.size=.2+mist*.65;
    for(let i=0;i<34;i++){
      const a=i*2.399,r=((i*.618)%1),out=i%5===0?.25:-(.55+r*1.1),sp=1.1+r*.9;
      puffPositions.set([hit.x+Math.cos(a)*r*.45*mist*sp+.0,hit.y+.05+Math.sin(a)*r*.4*mist*sp+mist*.22-mist*mist*.15,hit.z+out*mist*sp*.9],i*3);
    }
    puffGeo.attributes.position.needsUpdate=true;
    sparks.visible=hitActive&&age<.3;sparks.count=10;sparkMat.opacity=1-smooth(.05,.3,age);
    for(let i=0;i<10;i++) {
      const a=i*2.399,speed=1.2+(i%4)*.5;
      dummy.position.copy(hit).add(new T.Vector3(Math.cos(a)*age*speed,Math.sin(a)*age*speed-age*age*3.4,.2+age*.5));
      dummy.rotation.set(0,0,a-Math.PI/2);dummy.scale.set(.5,(1.6+(i%3)*.6)*(1-smooth(.04,.3,age)),.5);dummy.updateMatrix();sparks.setMatrixAt(i,dummy.matrix);
    }sparks.instanceMatrix.needsUpdate=true;
    debris.visible=hitActive&&age<1;debrisMat.opacity=1-smooth(.5,1,age);
    for(let i=0;i<36;i++){
      const a=i*2.399,r=((i*.754)%1),vx=Math.cos(a)*(.5+r*1.4),vy=Math.sin(a)*(.4+r*1.1)+.8,vz=-(1.6+r*3.2);
      dummy.position.copy(hit).add(new T.Vector3(vx*age,vy*age-4.2*age*age,vz*age));
      dummy.rotation.set(0,0,Math.atan2(vy-8.4*age,vx));dummy.scale.set(.55,1.5+r*1.6,.55);dummy.updateMatrix();debris.setMatrixAt(i,dummy.matrix);
    }debris.instanceMatrix.needsUpdate=true;
    lines.visible=chase&&s.rush>.05;lineMat.opacity=.32*s.rush;
    right.set(1,0,0).applyQuaternion(camera.quaternion);
    for(let i=0;i<12;i++) { const a=i*2.399, depth=1+((i*.731+s.elapsed*(2+s.rush*20))%1)*4; offset.copy(camera.position).addScaledVector(tangent,depth).addScaledVector(right,Math.cos(a)*(.8+depth*.3)); offset.y+=Math.sin(a)*(.5+depth*.22); offset.toArray(linePositions,i*6); offset.addScaledVector(tangent,.3+(i%4)*.22).toArray(linePositions,i*6+3); }
    lineGeo.attributes.position.needsUpdate=true;
  }
  // Cloned GLB resources belong to this scene; the cached source kit stays CPU-only.
  function dispose() { floor.getRenderTarget().dispose();disposeKit(scene); sun.shadow.dispose(); }
  return {scene,camera,crosshair,update,dispose,setLowQuality() { floor.visible=false;sun.shadow.mapSize.set(512,512); lineGeo.setDrawRange(0,16); dustGeo.setDrawRange(0,16); }};
}
