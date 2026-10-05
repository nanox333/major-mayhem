"""Run with Blender -b -P verify-pose.py to check every production frame."""
import sys
from pathlib import Path
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
import noscope as n
from lib import *
from mathutils.bvhtree import BVHTree
n.lib.clear_scene(); setup_render((960, 540), 16)
S=n.make(); scene=bpy.context.scene
body=[o for o in S.me['root'].children_recursive if o.type=='MESH']
gun=[o for o in S.gun.children_recursive if o.type=='MESH']
def tree(o):
    ev=o.evaluated_get(bpy.context.evaluated_depsgraph_get()); mesh=ev.to_mesh()
    result=BVHTree.FromPolygons([ev.matrix_world @ v.co for v in mesh.vertices], [tuple(p.vertices) for p in mesh.polygons])
    ev.to_mesh_clear(); return result
for f in range(146):
    n.update(S,f/30); bpy.context.view_layer.update()
    gt=[(o.name,tree(o)) for o in gun]
    for o in body:
        bt=tree(o)
        for name,t in gt:
            assert not bt.overlap(t), (f,o.name,name)
    for arm,x,target,ls in [(S.armR,.36,V(0,-.24,-.2),.84),(S.armL,-.36,V(-.04,0,-.07),1.)]:
        shoulder=S.me['torso'].matrix_world @ V(x,0,1.42)
        hand=S.gun.matrix_world @ target
        assert (hand-shoulder).length < ls, (f,'arm out of reach',x,(hand-shoulder).length)
print('PASS: no weapon/body intersections or unreachable grips across all 146 frames')
