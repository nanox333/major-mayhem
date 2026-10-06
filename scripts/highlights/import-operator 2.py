"""Import an artist-created Meshy operator into the lightweight highlight kit.
Preserves PBR UVs; reduces geometry and adds a small procedural reaction rig.
"""
import bpy
from mathutils import Vector

def import_operator(path, target):
    for child in list(target.children_recursive):
        bpy.data.objects.remove(child,do_unlink=True)
    before=set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    imported=set(bpy.data.objects)-before
    meshes=[o for o in imported if o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in meshes:
        o.parent=None;o.select_set(True)
    bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join()
    mesh=bpy.context.object;mesh.name='TexturedOperator'
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    low=min(v.co.z for v in mesh.data.vertices);high=max(v.co.z for v in mesh.data.vertices)
    scale=1.83/(high-low)
    for v in mesh.data.vertices:v.co=Vector((v.co.x*scale,v.co.y*scale,(v.co.z-low)*scale))
    dec=mesh.modifiers.new('Browser triangle budget','DECIMATE');dec.ratio=7400/len(mesh.data.polygons)
    bpy.ops.object.modifier_apply(modifier=dec.name)
    for p in mesh.data.polygons:p.use_smooth=True
    for material in mesh.data.materials:
        for node in material.node_tree.nodes:
            if node.type=='TEX_IMAGE' and node.image:
                image=node.image
                if max(image.size)>1024:image.scale(1024,1024)
                image.pack()
    for o in imported:
        if o!=mesh and o.name in bpy.data.objects:bpy.data.objects.remove(o,do_unlink=True)
    data=bpy.data.armatures.new('Operator reaction skeleton')
    rig=bpy.data.objects.new('OperatorRig',data);bpy.context.collection.objects.link(rig);rig.parent=target
    bpy.context.view_layer.objects.active=rig;rig.select_set(True);mesh.select_set(False)
    bpy.ops.object.mode_set(mode='EDIT')
    specs={'TargetBody':((0,0,.86),(0,0,1.45),None),
           'TargetHead':((0,0,1.47),(0,0,1.78),'TargetBody'),
           'LeftArm':((-.26,0,1.4),(-.33,0,1.05),'TargetBody'),
           'RightArm':((.26,0,1.4),(.33,-.18,1.05),'TargetBody'),
           'LeftLeg':((-.13,0,.87),(-.16,0,.47),None),
           'RightLeg':((.13,0,.87),(.16,0,.47),None),
           'LeftKnee':((-.16,0,.47),(-.17,0,.12),'LeftLeg'),
           'RightKnee':((.16,0,.47),(.17,0,.12),'RightLeg')}
    for name,(head,tail,parent) in specs.items():
        bone=data.edit_bones.new(name);bone.head=head;bone.tail=tail
        if parent:bone.parent=data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    groups={name:mesh.vertex_groups.new(name=name) for name in specs}
    for v in mesh.data.vertices:
        x,y,z=v.co
        # Smooth neck and hip transitions keep the source clothing continuous.
        leg=max(0,min(1,(.97-z)/.17));head=max(0,min(1,(z-1.44)/.14))
        arm=max(0,min(1,(abs(x)-.21)/.10))*max(0,min(1,(z-.85)/.25))*(1-head)
        knee=max(0,min(1,(.55-z)/.16))
        weights={'TargetHead':head,'LeftLeg' if x<0 else 'RightLeg':leg*(1-knee),
                 'LeftKnee' if x<0 else 'RightKnee':leg*knee,
                 'LeftArm' if x<0 else 'RightArm':arm*(1-leg),
                 'TargetBody':(1-head)*(1-leg)*(1-arm)}
        total=sum(weights.values())
        for name,w in weights.items():
            if w>0:groups[name].add([v.index],w/total,'REPLACE')
    mesh.parent=rig
    modifier=mesh.modifiers.new('Reaction rig','ARMATURE');modifier.object=rig
    return mesh
