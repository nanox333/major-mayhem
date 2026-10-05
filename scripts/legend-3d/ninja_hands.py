"""NINJA DEFUSE: two gloved hands, modelled in Blender and exported as hands.glb. Run: Blender -b -P ninja_hands.py -- <out dir> [--size 1024]
Each hand is a tree of named empties (hand_L / hand_R at the wrist, then L_f0_1, L_f0_2, L_f0_3 ... for the four fingers and L_t_1, L_t_2 for the thumb)
so the runtime can curl and press them. Fingers point along +Y with the palm facing down (-Z); a rotation about X bends a finger."""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ninja_lib as lib
from ninja_lib import *

GLOVE = flat_mat('glove_flat', 0x1b1c1f, .82); GUARD = flat_mat('guard', 0x141517, .5, .15); SLEEVE_F = flat_mat('sleeve_flat', 0x2a2c2d, .95)

def rounded(name, size, loc, mat, parent, frac=.42, seg=2):
    return box(name, size, loc, mat, parent, bevel=min(size) * frac, seg=seg)

def pod(name, w, length, h, mat, parent, grow=1.5):
    """A rounded finger segment: an ellipsoid from y = 0 to `length`, a little longer than the joint spacing so neighbours overlap and bending never shows a gap."""
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=10, radius=1.0)
    for v in bm.verts: v.co.x *= w / 2; v.co.y = v.co.y * length * grow / 2 + length / 2 - .003; v.co.z *= h / 2
    return obj(name, bm, mat, parent, (0, 0, 0))

def empty(name, parent, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None); sc.collection.objects.link(e); e.parent = parent; e.location = loc; return e

def sleeve_mesh(side):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=.108, radius2=.138, depth=.6)
    for v in bm.verts:   # soft folds in the fabric
        ang = math.atan2(v.co.y, v.co.x); k = 1 + .05 * math.sin(ang * 3 + v.co.z * 16) + .03 * math.sin(ang * 5 - v.co.z * 9)
        v.co.x *= k; v.co.y *= k
    return bm

def hand(side, size):
    sx = -1 if side == 'L' else 1
    root = empty(f'hand_{side}', None); lib.root = root
    static = []
    sl = obj(f'sleeve_{side}', sleeve_mesh(side), SLEEVE_F, root, (0, -.52, 0), (math.pi / 2, 0, 0)); static.append(sl)
    static.append(box('cuff', (.25, .12, .17), (0, -.2, 0), GLOVE, root, .035, seg=3))
    static.append(box('strap', (.262, .06, .185), (0, -.2, 0), GLOVE, root, .02, seg=2))
    static.append(rounded('palm', (.2, .25, .08), (0, -.01, -.005), GLOVE, root, .46, 4))
    static.append(rounded('back', (.19, .19, .04), (0, .0, .04), GLOVE, root, .5, 3))
    guards = []
    guards.append(rounded('guard_plate', (.16, .14, .024), (0, .02, .066), GUARD, root, .5, 3))
    for i in range(3): guards.append(rounded('guard_rib', (.034, .12, .016), (-.04 + i * .04, .02, .082), GUARD, root, .5, 2))
    
    # fingers: pivot empties at each joint so the runtime can bend them (slightly spread, longer and slimmer than before)
    lengths = {0: (.112, .08, .066), 1: (.12, .088, .07), 2: (.112, .08, .064), 3: (.092, .064, .052)}
    width = {0: .048, 1: .05, 2: .047, 3: .041}
    for f, x in enumerate((-.072, -.026, .02, .066)):
        px = x * sx * -1 if side == 'L' else x
        fm = flat_mat(f'gf{f}', 0x1b1c1f + f * 0x010101, .84)
        p1 = empty(f'{side}_f{f}_1', root, (px + (f - 1.5) * .003, .125, .0)); a, b2, c = lengths[f]; w = width[f]
        pod('seg1', w, a, w * .98, fm, p1)
        p2 = empty(f'{side}_f{f}_2', p1, (0, a, 0)); pod('seg2', w * .96, b2, w * .93, fm, p2)
        p3 = empty(f'{side}_f{f}_3', p2, (0, b2, 0)); pod('seg3', w * .94, c, w * .9, fm, p3, 1.4)
    tx = -.118 if side == 'R' else .118
    t1 = empty(f'{side}_t_1', root, (tx, -.05, -.008)); t1.rotation_euler = (0, 0, math.radians(34) * (1 if side == 'R' else -1))
    tm = flat_mat('gt', 0x1d1e21, .84)
    pod('thumb1', .058, .1, .056, tm, t1); t2 = empty(f'{side}_t_2', t1, (0, .1, 0)); pod('thumb2', .05, .082, .048, tm, t2, 1.4)
    bake_class('glove', static, size, 0.0, .86)
    for o in guards: o.data.materials[0] = GUARD
    return root

size = lib.SIZE if lib.SIZE <= 1024 else 1024
L = hand('L', size); R = hand('R', size); L.location = (-.35, 0, 0); R.location = (.35, 0, 0)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type in {'MESH', 'EMPTY'}: o.select_set(True)
dst = os.path.join(lib.OUT, 'hands.glb')
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_cameras=False, export_lights=False, export_image_format='JPEG', export_jpeg_quality=84)
print('EXPORTED hands.glb triangles', sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == 'MESH' for p in o.data.polygons), 'bytes', os.path.getsize(dst))
