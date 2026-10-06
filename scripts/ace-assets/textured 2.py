"""Blender builds a shallow, irregular glass surface carrying the reference-led detail texture."""
import bpy, math, random
from pathlib import Path
root=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
angles=72
radii=[0,.35,.5,.59,.67,.77,.9,1.15,1.55,2.2,3.2]
verts=[];uvs=[]
for j,r in enumerate(radii):
    for i in range(angles):
        a=i*math.tau/angles
        irregular=1+.045*math.sin(a*7)+.025*math.sin(a*13+1)
        rr=r*irregular if r<1.15 else r
        # Lip rises toward camera; the opening recedes behind the glass sheet.
        z=-.24 if r<.5 else (.22*math.exp(-((r-.7)/.17)**2))
        z+=math.sin(a*11+.4)*.038*math.exp(-((r-.72)/.3)**2)
        if j==len(radii)-1:rr=3.2/max(abs(math.cos(a)),abs(math.sin(a)))
        x,y=rr*math.cos(a),rr*math.sin(a)
        verts.append((x,y,z));uvs.append((x/6.4+.5,y/6.4+.5))
faces=[]
for j in range(len(radii)-1):
    for i in range(angles):
        n=(i+1)%angles;a=j*angles+i;b=j*angles+n;c=(j+1)*angles+n;d=(j+1)*angles+i
        if j==0:faces.append((a,c,d))
        else:faces.extend([(a,b,d),(b,c,d)])
mesh=bpy.data.meshes.new('Dimensional glass impact');mesh.from_pydata(verts,[],faces);mesh.update()
obj=bpy.data.objects.new('bullet_hole',mesh);bpy.context.collection.objects.link(obj)
uv=mesh.uv_layers.new(name='Photographic glass detail')
for poly in mesh.polygons:
    poly.use_smooth=True
    for li in poly.loop_indices:uv.data[li].uv=uvs[mesh.loops[li].vertex_index]
# Thin actual glass debris, each with a beveled edge.
for i in range(4):
    data=bpy.data.meshes.new('chip');s=.05+i*.009
    data.from_pydata([(-s,-s/2,0),(s,-s/3,0),(s*.2,s,0),(-s,-s/2,-.012),(s,-s/3,-.012),(s*.2,s,-.012)],[],[(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)])
    o=bpy.data.objects.new('debris_'+str(i),data);bpy.context.collection.objects.link(o)
bpy.ops.export_scene.gltf(filepath=str(root/'public/assets/highlights/ace/impact-real.glb'),export_format='GLB',export_yup=False,export_materials='NONE')
print('Surface triangles:',len(faces))
