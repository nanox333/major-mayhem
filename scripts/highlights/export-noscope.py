"""Blender -b -P scripts/highlights/export-noscope.py -- --out public/assets/highlights/noscope
Economical, atlas-textured GLB scene kit. Blender +Y becomes browser -Z; Z becomes up.
"""
import bpy, math, argparse, sys, os, json
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(name, rgb, metal=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*rgb,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=(*rgb,1); p.inputs['Roughness'].default_value=.82 if metal==0 else .38; p.inputs['Metallic'].default_value=metal
    return m
def color(h):
    vals=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    return [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in vals]
sand=mat('Sandstone',color('c99a68')); pale=mat('Limestone',color('ddbd8c')); wood=mat('Wood and trim',color('73553c')); dark=mat('Charcoal',color('282b2e')); brass=mat('Brass',color('d6a048'),.35)
atlas=bpy.data.images.load(os.path.join(os.path.dirname(os.path.abspath(__file__)),'assets','atlas.png'))
for material in [sand,pale,wood,dark]:
    nodes=material.node_tree.nodes; image=nodes.new('ShaderNodeTexImage');image.image=atlas
    material.node_tree.links.new(image.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])

cloth=mat('Woven slate uniform',color('536975')); armor=mat('Olive ballistic panels',color('6f7658')); hardware=mat('Worn graphite metal',color('41474b'),.45)
lens=mat('Muted blue goggles',color('547b8a'),.25);lens.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value=.24
stone=mat('Cut arch stone',color('cfbc98'))
character_atlas=bpy.data.images.load(os.path.join(os.path.dirname(os.path.abspath(__file__)),'assets','character.png'))
character_normal=bpy.data.images.load(os.path.join(os.path.dirname(os.path.abspath(__file__)),'assets','character-normal.png'));character_normal.colorspace_settings.name='Non-Color'
for material in [cloth,armor,hardware]:
    nodes=material.node_tree.nodes;image=nodes.new('ShaderNodeTexImage');image.image=character_atlas
    material.node_tree.links.new(image.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])
    normal_image=nodes.new('ShaderNodeTexImage');normal_image.image=character_normal
    normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.55
    material.node_tree.links.new(normal_image.outputs['Color'],normal.inputs['Color']);material.node_tree.links.new(normal.outputs['Normal'],nodes.get('Principled BSDF').inputs['Normal'])

def group(name,parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.parent=parent; return o
parts={}
def box(name,size,loc,m,parent,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=bpy.context.object; o.name=name; o.dimensions=size; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('Edge catches','BEVEL'); mod.width=bevel; mod.segments=1; bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.append(m)
    # Box faces use the full tile; Blender's default cube cross unwrap wastes atlas area.
    uv=o.data.uv_layers.active
    for face in o.data.polygons:
        axis=max(range(3),key=lambda i:abs(face.normal[i])); axes=[i for i in range(3) if i!=axis]
        for index in face.loop_indices:
            co=o.data.vertices[o.data.loops[index].vertex_index].co
            uv.data[index].uv=(co[axes[0]]/size[axes[0]]+.5,co[axes[1]]/size[axes[1]]+.5)
    o.parent=parent; parts.setdefault(parent.name,[]).append(o); return o
def cylinder(name,r,length,loc,m,parent,axis='Y',vertices=10):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=length,location=loc); o=bpy.context.object; o.name=name
    if axis=='Y': o.rotation_euler.x=math.pi/2
    elif axis=='X': o.rotation_euler.y=math.pi/2
    o.data.materials.append(m);o.parent=parent;parts.setdefault(parent.name,[]).append(o);return o
def between(name,a,b,width,m,parent):
    a,b=Vector(a),Vector(b); o=box(name,(width,width,(b-a).length),(a+b)/2,m,parent,.018); o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def merge(parent):
    objects=parts.get(parent.name,[])
    if not objects:return
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join();o=bpy.context.object;o.name=parent.name+'Mesh'
    # Collapse material slots: one primitive/draw call per palette color.
    slots=list(o.data.materials); unique=[]
    for m in slots:
        if m not in unique:unique.append(m)
    indices=[unique.index(slots[p.material_index]) for p in o.data.polygons]
    o.data.materials.clear()
    for m in unique:o.data.materials.append(m)
    for p,i in zip(o.data.polygons,indices):p.material_index=i
    return o
E=group('Environment')
box('Floor',(18,62,.18),(0,24,-.09),pale,E,0)
box('Left wall',(1,28,5.6),(-4.2,12,2.8),sand,E,.04)
box('Right wall',(1,29,5.0),(4.2,12.5,2.5),sand,E,.04)
for x in [-4.2,4.2]:
    box('Wall foot',(1.12,28,.3),(x,12,.15),wood,E,.02)
    box('Wall coping',(1.16,28,.18),(x,12,5.05 if x>0 else 5.65),pale,E,.02)
    for y in [5,12,19]:
        xx=x-math.copysign(.515,x)
        box('Shutter recess',(.025,.85,1.25),(xx,y,3.5),dark,E,0)
        box('Window sill',(.24,1,.12),(xx,y,2.84),pale,E,.01)
for x,y,w,h in [(-5,31,3,7),(5,31,3,6.2),(0,45,10,6)]:
    box('Background building',(w,4,h),(x,y,h/2),sand,E,.04)
    box('Roof trim',(w+.2,4.2,.18),(x,y,h),pale,E,.02)
# Twelve segments form a simple open arch; no boolean or dense subdivisions.
for x in [-1.7,1.7]:box('Arch pier',(1, .8,2.8),(x,26,1.4),stone,E,.04)
verts=[];faces=[];N=12
for i in range(N+1):
    a=math.pi*i/N
    for y in [25.6,26.4]:
        for r in [1.2,2.2]:verts.append((math.cos(a)*r,y,2.8+math.sin(a)*r))
for i in range(N):
    k=i*4;n=k+4
    faces.extend([(k,n,n+1,k+1),(k+2,k+3,n+3,n+2),(k,k+2,n+2,n),(k+1,n+1,n+3,k+3)])
faces.extend([(0,1,3,2),(N*4,N*4+2,N*4+3,N*4+1)])
mesh=bpy.data.meshes.new('Arch');mesh.from_pydata(verts,[],faces);o=bpy.data.objects.new('Arch',mesh);bpy.context.collection.objects.link(o);o.parent=E;mesh.materials.append(stone);parts.setdefault(E.name,[]).append(o)
for x in [-3.1,3.1]:box('Arch flank',(1.8,.8,5.1),(x,26,2.55),sand,E,.025)
for i,(x,y,size) in enumerate([(-2.75,4,1.2),(2.8,8,1.25),(-2.9,12,.95),(2.8,16,1.4),(-2.85,20,1.2),(2.9,24,.85)]):
    box('Crate',(size,size,size),(x,y,size/2),wood,E,.025)
    for z in [.2,size-.2]:box('Crate band',(size+.04,size+.04,.075),(x,y,z),pale,E,.008)
for y in [7,16,23]:
    between('Overhead cable',(-3.7,y,4.9),(3.7,y+.3,4.6),.04,wood,E)
box('Short balcony',(.55,2.1,.16),(-3.5,10,3),pale,E,.025)
# Recessed shutters, structural pillars and exposed masonry break up the big walls.
for x in [-3.68,3.68]:
    for y in [5,12,19]:
        for dy in [-.29,-.10,.10,.29]:box('Shutter slat',(.04,.12,1.16),(x,y+dy,3.5),wood,E,.01)
    for y in [1,9,18]:
        box('Wall buttress',(.24,.42,2.1),(x,y,1.05),sand,E,.03)
    for y in [3,6,14,21]:
        for row in range(2):
            box('Exposed foundation',(.08,.65,.23),(x,y+row*.22,.45+row*.25),pale,E,.012)
# A few economical roof beams cast readable angled bands across the corridor.
for y in [10,10.8,11.6,19,19.8]:between('Roof beam',(-3.7,y,4.8),(-.6,y+.4,4.8),.14,wood,E)
# Leaning crate braces are part of the same mesh and material batch.
for x,y,z in [(-2.75,4,1.2),(2.8,16,1.4)]:
    between('Crate diagonal',(x-z*.4,y-z*.51,.2),(x+z*.4,y-z*.51,z-.2),.06,pale,E)
# Inset doors and upper facades give the corridor a lived-in architectural rhythm.
for x,y in [(-3.66,7),(3.66,13)]:
    box('Door surround',(.16,1.25,2.55),(x,y,1.275),stone,E,.03)
    box('Recessed timber door',(.18,1.05,2.30),(x-math.copysign(.04,x),y,1.15),wood,E,.02)
    for z in [.22,1.12,2.07]:box('Door crossbar',(.2,1.08,.08),(x-math.copysign(.06,x),y,z),wood,E,.008)
for x,y,w,h in [(-5,31,3,7),(5,31,3,6.2),(0,45,10,6)]:
    for xx in [-.65,.65]:
        box('Far window',(.65,.05,1.05),(x+xx,y-2.03,h-.95),dark,E,.015)
        box('Far sill',(.78,.15,.10),(x+xx,y-2.06,h-1.5),stone,E,.01)
merge(E)

def oval(name,loc,scale,m,parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8,radius=1,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale;o.parent=parent;o.data.materials.append(m)
    for face in o.data.polygons:face.use_smooth=True
    parts.setdefault(parent.name,[]).append(o);return o

def tapered(name,a,b,ra,rb,m,parent):
    a,b=Vector(a),Vector(b)
    bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=ra,radius2=rb,depth=(b-a).length,location=(a+b)/2)
    o=bpy.context.object;o.name=name;o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();o.parent=parent;o.data.materials.append(m)
    for face in o.data.polygons:face.use_smooth=len(face.vertices)==4
    parts.setdefault(parent.name,[]).append(o);return o

def torso(parent):
    rings=[(.82,.21,.12),(.95,.23,.135),(1.28,.29,.16),(1.41,.27,.125),(1.46,.19,.10)]
    verts=[];faces=[];n=12
    for z,rx,ry in rings:
        for j in range(n):
            a=j*math.tau/n;verts.append((math.cos(a)*rx,math.sin(a)*ry,z))
    for row in range(len(rings)-1):
        for j in range(n):faces.append((row*n+j,row*n+(j+1)%n,(row+1)*n+(j+1)%n,(row+1)*n+j))
    faces.extend([tuple(range(n-1,-1,-1)),tuple(range((len(rings)-1)*n,len(rings)*n))])
    mesh=bpy.data.meshes.new('Tailored torso');mesh.from_pydata(verts,[],faces);mesh.materials.append(cloth)
    o=bpy.data.objects.new('Tailored torso',mesh);bpy.context.collection.objects.link(o);o.parent=parent
    uv=mesh.uv_layers.new()
    for f in mesh.polygons:
        f.use_smooth=len(f.vertices)==4
        for i in f.loop_indices:
            index=mesh.loops[i].vertex_index;uv.data[i].uv=((index%n)/n,(index//n)/(len(rings)-1))
    parts.setdefault(parent.name,[]).append(o)

def pivot(parent,at):
    parent.location=at
    for child in parent.children:child.location-=Vector(at)

C=group('Target'); B=group('TargetBody',C);torso(B)
box('Plate carrier',(.45,.15,.39),(0,-.13,1.21),armor,B,.055)
box('Back panel',(.41,.12,.43),(0,.15,1.2),armor,B,.045)
for x in [-.20,.20]:
    box('Shoulder harness',(.065,.34,.055),(x,0,1.42),hardware,B,.015)
for x in [-.14,0,.14]:box('Magazine pouch',(.12,.085,.19),(x,-.24,1.12),armor,B,.02)
box('Belt',(.47,.31,.08),(0,0,.88),hardware,B,.018)
box('Belt buckle',(.08,.025,.065),(0,-.17,.88),hardware,B,.01)
merge(B)
H=group('TargetHead',B)
oval('Balaclava',(0,0,1.63),(.137,.125,.177),cloth,H)
oval('Helmet shell',(0,.013,1.74),(.171,.163,.111),armor,H)
box('Helmet front rim',(.32,.065,.028),(0,-.118,1.73),hardware,H,.012)
for x in [-.087,.087]:
    box('Goggle frame',(.15,.055,.075),(x,-.116,1.655),hardware,H,.02)
    box('Goggle lens',(.115,.013,.044),(x,-.15,1.659),lens,H,.015)
box('Mask seam',(.09,.025,.13),(0,-.127,1.53),cloth,H,.015)
merge(H);pivot(H,(0,0,1.56))
for side,x in [('Left',-.29),('Right',.29)]:
    arm=group(side+'Arm',B)
    a=(x,0,1.39);b=(-.37,-.23,1.19) if x<0 else (.37,-.12,1.19);c=(-.04,-.62,1.19) if x<0 else (.12,-.40,1.20)
    tapered(side+' sleeve',a,b,.105,.08,cloth,arm)
    oval('Shoulder padding',(x,.015,1.385),(.12,.115,.115),armor,arm)
    tapered(side+' forearm',b,c,.083,.064,cloth,arm)
    oval('Glove',c,(.077,.083,.063),hardware,arm)
    box('Elbow patch',(.125,.035,.12),(b[0],b[1]+.06,b[2]),armor,arm,.025)
    merge(arm);pivot(arm,a)
for side,x in [('Left',-.15),('Right',.15)]:
    leg=group(side+'Leg',C);a=(x,0,.86);b=(x*1.18,-.015,.47);c=(x*1.3,.045,.13)
    tapered('Trouser thigh',a,b,.115,.09,cloth,leg);tapered('Trouser calf',b,c,.095,.068,cloth,leg)
    box('Knee guard',(.145,.065,.145),(b[0],-.098,.47),armor,leg,.035)
    box('Boot',(.17,.30,.17),(c[0],-.043,.09),hardware,leg,.035)
    merge(leg);pivot(leg,a)
pivot(B,(0,0,.89))
W=group('TargetWeapon',C)
box('Held receiver',(.10,.4,.12),(.12,-.52,1.2),hardware,W,.018)
box('Held stock',(.09,.24,.14),(.12,-.38,1.2),armor,W,.02)
cylinder('Held barrel',.025,.55,(.12,-.91,1.21),hardware,W,vertices=12)
box('Held magazine',(.08,.1,.16),(.12,-.54,1.08),hardware,W,.015)
merge(W);pivot(W,(.12,-.52,1.2))
R=group('Rifle')
box('Machined receiver',(.13,.55,.15),(0,0,0),hardware,R,.024)
box('Composite stock',(.13,.38,.18),(0,-.39,-.04),armor,R,.03)
box('Rubber butt',(.135,.025,.18),(0,-.59,-.04),hardware,R,.02)
box('Grip',(.085,.09,.17),(0,-.18,-.13),hardware,R,.02)
box('Magazine',(.09,.13,.19),(0,.08,-.12),hardware,R,.018)
cylinder('Fluted barrel',.027,.8,(0,.65,0),hardware,R,vertices=16)
cylinder('Muzzle',.045,.12,(0,1.08,0),hardware,R,vertices=16)
cylinder('Scope body',.058,.46,(0,.01,.19),hardware,R,vertices=16)
cylinder('Scope front',.084,.13,(0,.27,.19),hardware,R,vertices=16)
cylinder('Scope rear ring',.075,.023,(0,-.235,.19),hardware,R,vertices=16)
cylinder('Scope rear glass',.061,.004,(0,-.249,.19),lens,R,vertices=16)
cylinder('Scope dial',.028,.038,(.075,0,.19),hardware,R,'X',12)
for y in [-.13,.14]:box('Scope mount',(.06,.06,.1),(0,y,.10),hardware,R,.01)
for y in [.05,.12,.19]:box('Receiver rail',(.15,.025,.027),(0,y,.083),hardware,R,.005)
oval('Trigger glove',(.025,-.15,-.14),(.07,.10,.075),hardware,R)
oval('Support glove',(-.015,.46,-.04),(.085,.12,.07),hardware,R)
merge(R)
P=group('Projectile')
cylinder('Brass body',.065,.25,(0,0,0),brass,P,'Z',12)
bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.065,radius2=0,depth=.16,location=(0,0,.205));o=bpy.context.object;o.parent=P;o.data.materials.append(brass);parts[P.name].append(o)
cylinder('Brass rim',.073,.025,(0,0,-.125),brass,P,'Z',16)
cylinder('Primer',.025,.004,(0,0,-.14),dark,P,'Z',12)
cylinder('Projectile shoulder',.068,.025,(0,0,.105),brass,P,'Z',16)
merge(P)
a=argparse.ArgumentParser();a.add_argument('--out',required=True);a.add_argument('--character');args=a.parse_args(sys.argv[sys.argv.index('--')+1:]);os.makedirs(args.out,exist_ok=True)
if args.character:
    import importlib.util
    spec=importlib.util.spec_from_file_location('operator_import',os.path.join(os.path.dirname(os.path.abspath(__file__)),'import-operator.py'))
    adapter=importlib.util.module_from_spec(spec);spec.loader.exec_module(adapter);adapter.import_operator(args.character,C)
# Atlas quadrants share one embedded image; no per-prop texture downloads.
regions={sand:(0,0),pale:(1,0),wood:(0,1),dark:(1,1),cloth:(0,0),armor:(1,0),hardware:(0,1)}
for o in bpy.data.objects:
    if o.type!='MESH':continue
    uv=o.data.uv_layers.active or o.data.uv_layers.new()
    for poly in o.data.polygons:
        material=o.data.materials[poly.material_index]
        if material not in regions:continue
        qx,qy=regions[material]
        for i in poly.loop_indices:
            coord=uv.data[i].uv.copy()
            if coord.length==0:coord=Vector((.37,.37))
            uv.data[i].uv=((qx+min(1,max(0,coord.x))*.98+.01)/2, 1-(qy+min(1,max(0,coord.y))*.98+.01)/2)
# Consistent outward normals prevent patterned self-shadowing on the arch.
for o in bpy.data.objects:
    if o.type!='MESH':continue
    bpy.context.view_layer.objects.active=o
    bpy.ops.object.select_all(action='DESELECT');o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
report={}
for root in [E,C,R,P]:
    report[root.name]=sum(len(p.vertices)-2 for o in root.children_recursive if o.type=='MESH' for p in o.data.polygons)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(os.path.dirname(os.path.abspath(__file__)),'assets','noscope.blend'))
bpy.ops.export_scene.gltf(filepath=os.path.join(args.out,'kit.glb'),export_format='GLB',export_image_format='JPEG',export_image_quality=88,export_animations=False,export_cameras=False,export_lights=False,export_yup=True,export_apply=False)
report['bytes']=os.path.getsize(os.path.join(args.out,'kit.glb'))
with open(os.path.join(args.out,'budget.json'),'w') as f:json.dump(report,f,indent=2)
print('ASSET BUDGET',report)
