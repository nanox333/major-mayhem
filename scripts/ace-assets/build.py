"""Blender asset generator: shallow screen impact + fractures + four pooled chips.
Run: /Applications/Blender.app/Contents/MacOS/Blender -b --python scripts/ace-assets/build.py
No environment, textures, rendering, or movie. All colors are vertex colors.
"""
import bpy, math, random
from pathlib import Path
from mathutils import Vector
random.seed(517)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
root=Path(__file__).resolve().parents[2]
out=root/'public/assets/highlights/ace';out.mkdir(parents=True,exist_ok=True)
def linear(hex):
    rgb=[int(hex[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(c/12.92 if c<.04045 else ((c+.055)/1.055)**2.4 for c in rgb)+(1,)
mat=bpy.data.materials.new('Impact vertex palette');mat.use_nodes=True
nodes=mat.node_tree.nodes; bs=nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=1
vc=nodes.new('ShaderNodeVertexColor');vc.layer_name='Color';mat.node_tree.links.new(vc.outputs['Color'],bs.inputs['Base Color'])
def mesh(name,verts,faces,colors):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);data.materials.append(mat)
    color=data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for poly in data.polygons:
        for li in poly.loop_indices: color.data[li].color=linear(colors[poly.index%len(colors)])
    return obj
# A punched hole in a thin glass surface: narrow broken bevels, never a solid stone ring.
n=56
angles=[i*math.tau/n for i in range(n)]
inner=[.67+random.uniform(-.055,.055) for _ in range(n)]
outer=[inner[i]+random.uniform(.10,.22) for i in range(n)]
verts=[(0,0,-.13)];faces=[];colors=[];center_faces=[]
lip=[r+.055 for r in inner]
for radius,z in [(inner,-.13),(lip,.18),(outer,-.015)]:
    for i,a in enumerate(angles):verts.append((math.cos(a)*radius[i],math.sin(a)*radius[i],z+random.uniform(-.014,.014)))
for i in range(n):
    j=(i+1)%n;center_faces.append((0,i+1,j+1))
    faces.extend([(i+1,n+i+1,n+j+1),(i+1,n+j+1,j+1),(n+i+1,2*n+i+1,2*n+j+1),(n+i+1,2*n+j+1,n+j+1)])
    # Bright, thin faces alternate with recessed dark facets and a few warm chipped edges.
    colors.extend([random.choice(['fff1dc','e7d7bd','b8a58a','f5e6ce','7f6953']),random.choice(['514536','897156','e4bf91','a88b6a']),random.choice(['aa9377','e5cbae','786047']),random.choice(['514336','aa937a','f1d7b4'])])
    if i%3!=0:
        a=angles[i];r=outer[i];length=random.uniform(.12,.46);k=len(verts)
        verts.extend([(math.cos(a-.028)*r,math.sin(a-.028)*r,.028),(math.cos(a+.032)*r,math.sin(a+.032)*r,.028),(math.cos(a+.025)*(r+length),math.sin(a+.025)*(r+length),.012)])
        faces.append((k,k+1,k+2));colors.append(random.choice(['cbb99b','776856','3e332b']))
mesh('bullet_center',verts,center_faces,['020303'])
mesh('bullet_hole',verts,faces,colors)
# Sparse radial fracture network and broken arcs. Bright hairlines taper into the screen.
verts=[];faces=[];colors=[]
def strip(a,b,width,color):
    offset=Vector((b[1]-a[1],a[0]-b[0],0)).normalized()*width
    j=len(verts);verts.extend([tuple(Vector(a)+offset),tuple(Vector(a)-offset),b]);faces.append((j,j+1,j+2));colors.append(color)
def point(angle,r):return (math.cos(angle)*r,math.sin(angle)*r,-.01)
branches=[]
for i in range(11):
    angle=i*math.tau/11+random.uniform(-.20,.20)
    radii=[.80,random.uniform(1.05,1.30),random.uniform(1.55,1.9),random.uniform(2.15,3.4)]
    angles_b=[angle,angle+random.uniform(-.15,.15),angle+random.uniform(-.21,.21),angle+random.uniform(-.18,.18)]
    points=[point(a,r) for a,r in zip(angles_b,radii)]
    branches.append(points)
    for j in range(3):
        strip(points[j],points[j+1],[.032,.019,.009][j],random.choice(['eee1c9','d9c7a9','bea589']) if j<2 else '9b8266')
        if j<2:
            # Broken bevel glints on alternating sides of a fracture; no uniform star spokes.
            aa=Vector(points[j]);bb=Vector(points[j+1]);delta=bb-aa
            normal=Vector((delta.y,-delta.x,0)).normalized()
            for k in range(2):
                start=aa+delta*(.12+k*.36);end=start+delta*.16;tip=start+normal*random.uniform(.04,.12)
                q=len(verts);verts.extend([tuple(start),tuple(end),tuple(tip)]);faces.append((q,q+1,q+2));colors.append(random.choice(['e3c4a1','b79c79','594535']))
    for j in [1,2]:
        start=points[j];a=angles_b[j]+random.choice([-1,1])*.48
        end=tuple(Vector(start)+Vector((math.cos(a),math.sin(a),0))*random.uniform(.27,.65))
        strip(start,end,.012,'c1a98a')
for i in range(11):
    j=(i+1)%11
    for ring in [1,2]:
        if random.random()<.65:
            start,end=Vector(branches[i][ring]),Vector(branches[j][ring])
            mid=start.lerp(end,random.uniform(.35,.65))+Vector((random.uniform(-.09,.09),random.uniform(-.09,.09),0))
            strip(tuple(start),tuple(mid),.015 if ring==1 else .008,'e6d2b3' if ring==1 else 'a38b6f')
            strip(tuple(mid),tuple(end),.012 if ring==1 else .006,'b9a386' if ring==1 else '7f6b53')
mesh('fracture',verts,faces,colors)
verts=[];faces=[];colors=[]
for i in range(11):
    a=math.tau*i/11+random.uniform(-.12,.12);span=random.uniform(.18,.38)
    r0=random.uniform(.93,1.18);r1=random.uniform(1.35,1.8);k=len(verts)
    verts.extend([point(a-span/2,r0),point(a+span/2,r0),point(a+span*.42,r1),point(a-span*.65,r1)])
    for j in range(k,k+4):
        x,y,_=verts[j];verts[j]=(x,y,random.uniform(.015,.065))
    faces.extend([(k,k+1,k+2),(k,k+2,k+3)]);colors.extend(['e8d8bc','cbb897'])
mesh('glass_shards',verts,faces,colors)
for i in range(4):
    r=.07+i*.012
    mesh(f'debris_{i}',[(-r,-r*.5,0),(r,-r*.3,.02),(r*.2,r,0),(0,0,.07)],[(0,1,2),(0,3,1),(1,3,2),(2,3,0)],['8c7b65'])
bpy.ops.export_scene.gltf(filepath=str(out/'impact.glb'),export_format='GLB',export_yup=False,export_normals=True,export_texcoords=False,export_materials='EXPORT',export_cameras=False,export_lights=False)
print('ACE asset:',(out/'impact.glb').stat().st_size,'bytes')
print('Crater triangles:', sum(len(p.vertices)-2 for p in bpy.data.objects['bullet_hole'].data.polygons))
