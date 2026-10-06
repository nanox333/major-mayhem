"""Physical ACE glass asset prototype. Blender stills are asset QA, never an animation video."""
import bpy, bmesh, math, random
import numpy as np
from pathlib import Path
from mathutils import Vector
rng=random.Random(177)
root=Path(__file__).resolve().parents[2]
out=root/'public/assets/highlights/ace';out.mkdir(parents=True,exist_ok=True)
review=root/'shots/ace/material-review';review.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def material(name,color,alpha=1,rough=.16):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=.08
    p.inputs['Roughness'].default_value=rough;p.inputs['IOR'].default_value=1.52
    p.inputs['Coat Weight'].default_value=1;p.inputs['Coat Roughness'].default_value=.035
    p.inputs['Alpha'].default_value=1
    p.inputs['Transmission Weight'].default_value=.94
    p.inputs['Base Color'].default_value=(.91,.95,.98,1)
    return m
rim=material('Broken clear glass / polished fracture faces',(.50,.53,.56),.90,.12)
sheet=material('Thin peripheral glass cells',(.36,.39,.42),.22,.075)
# Packed fine surface detail. Physical normals and varied roughness replace painted facet colors.
size=256;yy,xx=np.mgrid[0:size,0:size].astype(np.float32)
rnd=np.random.default_rng(177)
height=rnd.normal(0,.04,(size,size)).astype(np.float32)
for i in range(36):
    angle=rnd.uniform(0,math.tau);dist=xx*np.cos(angle)+yy*np.sin(angle)-rnd.uniform(-200,350)
    height+=np.exp(-(dist/float(rnd.uniform(.3,1.2)))**2)*float(rnd.uniform(.1,.3))
dy,dx=np.gradient(height);norm=np.stack([-dx*.55,-dy*.55,np.ones_like(dx)],axis=-1);norm/=np.linalg.norm(norm,axis=-1,keepdims=True)
rgba=np.ones((size,size,4),dtype=np.float32);rgba[:,:,:3]=norm*.5+.5
img=bpy.data.images.new('Microscopic scuffs and chipped edge normal',width=size,height=size,alpha=True)
img.colorspace_settings.name='Non-Color';img.pixels.foreach_set(rgba.ravel());img.filepath_raw=str(review/'glass-normal.png');img.file_format='PNG';img.save();img.pack()
for m in [rim,sheet]:
    tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=img
    normal=m.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.18
    m.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color']);m.node_tree.links.new(normal.outputs['Normal'],m.node_tree.nodes.get('Principled BSDF').inputs['Normal'])

def polygon_solid(name,coords,thickness,mat,bevel=.008):
    bm=bmesh.new();verts=[bm.verts.new(Vector(v)) for v in coords];bm.faces.new(verts);bm.normal_update()
    extruded=bmesh.ops.extrude_face_region(bm,geom=list(bm.faces))
    back=[v for v in extruded['geom'] if isinstance(v,bmesh.types.BMVert)]
    bmesh.ops.translate(bm,verts=back,vec=Vector((0,0,-thickness)))
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    data=bpy.data.meshes.new(name);bm.to_mesh(data);bm.free()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);data.materials.append(mat)
    if bevel:
        mod=obj.modifiers.new('Real chipped glass bevel','BEVEL');mod.width=bevel;mod.segments=1;mod.affect='EDGES'
        bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

def combine(name,objects):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();obj=objects[0];obj.name=name
    uv=obj.data.uv_layers.new(name='Surface detail')
    for face in obj.data.polygons:
        for li in face.loop_indices:
            v=obj.data.vertices[obj.data.loops[li].vertex_index].co
            uv.data[li].uv=(v.x/3+.5,v.y/3+.5)
    return obj

def polar(a,r,z):return (math.cos(a)*r,math.sin(a)*r,z)
# Individually fractured, solid plate segments, with bevelled sidewalls and subtle lifted shards.
objects=[];sectors=15
bounds=[i*math.tau/sectors+rng.uniform(-.045,.045) for i in range(sectors)]
for i in range(sectors):
    a=bounds[i]+.004;b=(bounds[(i+1)%sectors]+(math.tau if i==sectors-1 else 0))-.004
    mid=(a+b)/2;inner=[rng.uniform(.58,.69) for _ in range(3)];outer=[rng.uniform(.89,1.14) for _ in range(3)]
    lift=rng.uniform(.012,.095)
    coords=[polar(a,inner[0],lift*.45),polar(mid,inner[1],lift),polar(b,inner[2],lift*.6),polar(b,outer[2],-.008),polar(mid,outer[1],.015),polar(a,outer[0],-.01)]
    # Reverse into front-facing orientation; extrusion closes every shard with actual side faces.
    objects.append(polygon_solid(f'glass lip {i}',list(reversed(coords)),rng.uniform(.045,.085),rim,.009))
body=combine('bullet_hole',objects)
# Black cavity. Its rim follows the uneven contour rather than an exact circle.
verts=[(0,0,-.17)]+[polar(i*math.tau/60,.68+rng.uniform(-.025,.025),-.17) for i in range(60)]
faces=[(0,i+1,(i+1)%60+1) for i in range(60)]
data=bpy.data.meshes.new('cavity');data.from_pydata(verts,[],faces);data.update();obj=bpy.data.objects.new('bullet_center',data);bpy.context.collection.objects.link(obj)
black=bpy.data.materials.new('Unlit black cavity');black.use_nodes=True;p=black.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.0003,.0004,.0004,1);p.inputs['Roughness'].default_value=1;obj.data.materials.append(black)
# Hairline fracture ridges, with narrow 3D bevels catching the studio light.
objects=[];fracture_mat=material('Fine glass fracture glints',(.68,.72,.76),1,.18)
for i in range(13):
    a=i*math.tau/13+rng.uniform(-.12,.12)
    chain=[polar(a,.89,.012),polar(a+rng.uniform(-.15,.15),1.25,.008),polar(a+rng.uniform(-.2,.2),1.8,.003),polar(a+rng.uniform(-.22,.22),rng.uniform(2.5,3.4),0)]
    for k,(start,end) in enumerate(zip(chain,chain[1:])):
        p,q=Vector(start),Vector(end);d=q-p;n=Vector((-d.y,d.x,0)).normalized();w=[.012,.008,.003][k]
        coords=[tuple(p-n*w),tuple(q-n*w*.3),tuple(q+n*w*.3),tuple(p+n*w)]
        objects.append(polygon_solid('fracture edge',coords,.006,fracture_mat,0))
    for k in [1,2]:
        p=Vector(chain[k]);q=p+Vector((math.cos(a+.6),math.sin(a+.6),0))*rng.uniform(.3,.7);d=q-p;n=Vector((-d.y,d.x,0)).normalized()*.004
        objects.append(polygon_solid('branch', [tuple(p-n),tuple(q),tuple(p+n)],.003,fracture_mat,0))
fracture=combine('fracture',objects)
# Translucent plate cells follow the fractures, with closed, bevelled geometry instead of flat triangles.
objects=[]
for i in range(9):
    a=i*math.tau/9+rng.uniform(-.12,.12);span=rng.uniform(.25,.43);r0=rng.uniform(1.03,1.18);r1=rng.uniform(1.4,1.85)
    coords=[polar(a-span/2,r0,.01),polar(a-span*.65,r1,.015),polar(a+span*.42,r1,.035),polar(a+span/2,r0,.02)]
    objects.append(polygon_solid('outer glass cell',coords,.018,sheet,.004))
combine('glass_shards',objects)
for i in range(4):
    a=i*.4;r=.06+i*.008
    polygon_solid(f'debris_{i}',[(-r,-r*.5,0),(r,-r*.2,.007),(r*.15,r,.013)],.02,rim,.003)
# GLB stores the real materials and normal texture. Runtime reuses them.
bpy.ops.export_scene.gltf(filepath=str(out/'impact-v2.glb'),export_format='GLB',export_yup=False,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
print('Prototype GLB bytes:',(out/'impact-v2.glb').stat().st_size)
print('Body triangles:',sum(len(p.vertices)-2 for p in body.data.polygons))
# Two stills to judge the asset itself. No movie or environment is delivered to the game.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=768;scene.render.resolution_y=768;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
world=bpy.data.worlds.new('Studio reflections');world.use_nodes=True;scene.world=world
tex=world.node_tree.nodes.new('ShaderNodeTexEnvironment');tex.image=bpy.data.images.load('/Applications/Blender.app/Contents/Resources/5.2/datafiles/studiolights/world/studio.exr')
world.node_tree.links.new(tex.outputs['Color'],world.node_tree.nodes.get('Background').inputs['Color']);world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.6
bpy.ops.object.camera_add(location=(0,0,8));camera=bpy.context.object;camera.rotation_euler=(0,0,0);camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=7.4;scene.camera=camera
# Remove loose debris from the centered QA view (it is reusable geometry at the origin).
for obj in bpy.data.objects:
    if obj.name.startswith('debris_'):obj.hide_render=True
# Keep the camera background charcoal while retaining the studio reflections.
nt=world.node_tree;env_background=nt.nodes.get('Background');output=nt.nodes.get('World Output')
black_background=nt.nodes.new('ShaderNodeBackground');black_background.inputs['Color'].default_value=(.003,.004,.005,1)
light_path=nt.nodes.new('ShaderNodeLightPath');mix=nt.nodes.new('ShaderNodeMixShader')
nt.links.new(light_path.outputs['Is Camera Ray'],mix.inputs[0]);nt.links.new(env_background.outputs[0],mix.inputs[1]);nt.links.new(black_background.outputs[0],mix.inputs[2]);nt.links.new(mix.outputs[0],output.inputs['Surface'])
for name,loc,power,color in [('white glass key',(-2,3,4),450,(1,.91,.78)),('amber reflected edge',(3,-1,2),170,(1,.32,.08))]:
    bpy.ops.object.light_add(type='AREA',location=loc);light=bpy.context.object;light.name=name;light.data.energy=power;light.data.shape='DISK';light.data.size=3;light.data.color=color;light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler()
scene.view_settings.view_transform='AgX' 
scene.render.filepath=str(review/'physical-front.png');bpy.ops.render.render(write_still=True)
camera.location=(2,-1,7);camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(review/'physical-angle.png');bpy.ops.render.render(write_still=True)
