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
    static.append(rounded('palm', (.22, .25, .085), (0, -.01, -.005), GLOVE, root, .38))
    static.append(rounded('back', (.20, .19, .045), (0, .0, .045), GLOVE, root, .45))
    guards = []
    guards.append(rounded('guard_plate', (.17, .15, .03), (0, .015, .075), GUARD, root, .4))
    for i in range(4): guards.append(rounded('guard_rib', (.036, .15, .022), (-.058 + i * .039, .015, .094), GUARD, root, .45))
    for i, x in enumerate((-.07, -.025, .02, .065)): guards.append(rounded('knuckle', (.04, .035, .04), (x, .115, .045), GUARD, root, .4))
    # fingers: pivot empties at each joint so the runtime can bend them
    lengths = {0: (.10, .075, .062), 1: (.108, .082, .066), 2: (.1, .075, .06), 3: (.082, .06, .05)}
    width = {0: .046, 1: .048, 2: .045, 3: .04}
    for f, x in enumerate((-.07, -.025, .02, .065)):
        ax = x * sx * -1 if False else x * (1)  # same layout for both hands: the thumb decides the side
        px = x * sx * -1 if side == 'L' else x
        p1 = empty(f'{side}_f{f}_1', root, (px, .125, .0)); a, b, c = lengths[f]; w = width[f]
        rounded(f'seg1', (w, a, w * .95), (0, a / 2 - .004, 0), GLOVE if False else flat_mat(f'g{f}a', 0x1b1c1f + f * 0x010101, .82), p1, .42)
        p2 = empty(f'{side}_f{f}_2', p1, (0, a, 0)); rounded('seg2', (w * .97, b, w * .92), (0, b / 2 - .003, 0), flat_mat(f'g{f}b', 0x1b1c1f + f * 0x010101, .82), p2, .42)
        p3 = empty(f'{side}_f{f}_3', p2, (0, b, 0)); rounded('seg3', (w * .94, c, w * .88), (0, c / 2 - .002, 0), flat_mat(f'g{f}c', 0x1b1c1f + f * 0x010101, .82), p3, .46)
        ball_ = bmesh.new(); bmesh.ops.create_uvsphere(ball_, u_segments=12, v_segments=8, radius=w * .46); obj('tip', ball_, flat_mat(f'g{f}d', 0x1b1c1f, .82), p3, (0, c - .002, 0))
    # thumb on the inner side
    tx = -.115 if side == 'R' else .115
    t1 = empty(f'{side}_t_1', root, (tx, -.06, -.005)); t1.rotation_euler = (0, 0, math.radians(32) * (1 if side == 'R' else -1))
    rounded('thumb1', (.05, .1, .05), (0, .05, 0), flat_mat('gt1', 0x1d1e21, .82), t1, .42)
    t2 = empty(f'{side}_t_2', t1, (0, .1, 0)); rounded('thumb2', (.046, .085, .046), (0, .042, 0), flat_mat('gt2', 0x1d1e21, .82), t2, .44)
    tb = bmesh.new(); bmesh.ops.create_uvsphere(tb, u_segments=12, v_segments=8, radius=.021); obj('thumb_tip', tb, flat_mat('gt3', 0x1d1e21, .82), t2, (0, .085, 0))
    for o in static: o.data.materials[0] = GLOVE if 'sleeve' not in o.name else SLEEVE_F
    return root

size = lib.SIZE if lib.SIZE <= 1024 else 1024
L = hand('L', size); R = hand('R', size); L.location = (-.35, 0, 0); R.location = (.35, 0, 0)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type in {'MESH', 'EMPTY'}: o.select_set(True)
dst = os.path.join(lib.OUT, 'hands.glb')
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_cameras=False, export_lights=False, export_image_format='JPEG', export_jpeg_quality=84)
print('EXPORTED hands.glb triangles', sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == 'MESH' for p in o.data.polygons), 'bytes', os.path.getsize(dst))
