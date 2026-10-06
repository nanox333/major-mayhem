"""NINJA DEFUSE: the gloved hands, made from a Meshy image-to-3D sculpt (meshy-glove-raw.glb, from hand-reference.png, which ChatGPT drew).
Run: Blender -b -P ninja_glove.py -- <out dir> [--size 1024] [--tris 16000] [--debug]
The sculpt is 117k untextured triangles, so it is: turned so the fingers point +Y with the back of the hand up (+Z), scaled and moved so the wrist is the origin,
reduced to a few thousand triangles, unwrapped, given a fabric look baked from ninja_lib.look('glove'), and exported twice (hand_R, and a mirrored hand_L).
Each hand is one rigid mesh: the runtime moves it as a whole."""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
import ninja_lib as lib
from ninja_lib import *

argv = lib.argv
TRIS = int(argv[argv.index('--tris') + 1]) if '--tris' in argv else 16000
SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'meshy-glove-raw.glb')
FLIP_UP = '--flipup' in argv; FLIP_FWD = '--flipfwd' in argv

bpy.ops.import_scene.gltf(filepath=SRC)
src = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in src: o.select_set(True)
bpy.context.view_layer.objects.active = src[0]
if len(src) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active; ob.name = 'glove'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = ob.data
co = np.array([v.co[:] for v in me.vertices])
# principal axis of the shape: the hand is long from the cuff to the fingertip
c = co.mean(0); u, s, vt = np.linalg.svd(co - c, full_matrices=False)
axis = vt[0]; proj = (co - c) @ axis
lo, hi = proj.min(), proj.max()
def width_at(p, band=.06):
    sel = co[np.abs(proj - p) < band * (hi - lo)]
    if len(sel) < 10: return 1e9
    d = sel - c - np.outer((sel - c) @ axis, axis); return float(np.sqrt((d ** 2).sum(1)).mean())
fwd = axis if width_at(hi) < width_at(lo) else -axis      # the narrower end is the finger; point the fingers along +fwd
if FLIP_FWD: fwd = -fwd
# the back of the hand is the side the knuckle guard is on: the side along the second axis with more mass away from the centre line
side = vt[1]; ps = (co - c) @ side
up = side if abs(ps.max()) > abs(ps.min()) else -side
if FLIP_UP: up = -up
up = up - fwd * (up @ fwd); up /= np.linalg.norm(up)
right = np.cross(fwd, up)
R = np.stack([right, fwd, up])           # rows: new X, Y, Z in the old frame
co2 = (co - c) @ R.T
ext = co2[:, 1].max() - co2[:, 1].min(); scale = 0.95 / ext      # wrist-to-fingertip about 0.95
co2 *= scale; co2[:, 1] -= co2[:, 1].min() - (-.2)                # the wrist end a little behind the origin
for v, p in zip(me.vertices, co2): v.co = p.tolist()
me.update()
for p in me.polygons: p.use_smooth = True
tri0 = sum(len(p.vertices) - 2 for p in me.polygons)
mod = ob.modifiers.new('dec', 'DECIMATE'); mod.ratio = min(1.0, TRIS / tri0); mod.use_collapse_triangulate = True
bpy.ops.object.modifier_apply(modifier='dec')
print('GLOVE tris', tri0, '->', sum(len(p.vertices) - 2 for p in ob.data.polygons), 'dims', tuple(round(x, 3) for x in ob.dimensions))

hand_R = bpy.data.objects.new('hand_R', None); sc.collection.objects.link(hand_R); ob.parent = hand_R; lib.root = hand_R
bake_class('glove', [ob], lib.SIZE if lib.SIZE <= 2048 else 2048, 0.0, .8)
ob = [o for o in bpy.data.objects if o.name == 'glove'][0]; ob.name = 'glove_R'
# the mirrored twin shares the baked image
twin = ob.copy(); twin.data = ob.data.copy(); twin.name = 'glove_L'; sc.collection.objects.link(twin)
hand_L = bpy.data.objects.new('hand_L', None); sc.collection.objects.link(hand_L); twin.parent = hand_L; twin.scale = (-1, 1, 1)
bm = bmesh.new(); bm.from_mesh(twin.data); bmesh.ops.reverse_faces(bm, faces=bm.faces[:]); bm.to_mesh(twin.data); bm.free()

hand_R.location = (.4, 0, 0); hand_L.location = (-.4, 0, 0)   # side by side in the file; the runtime places them
if '--debug' in argv:
    bpy.ops.object.select_all(action='DESELECT'); hand_L.hide_set(True)
dst = os.path.join(lib.OUT, 'glove.glb')
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type in {'MESH', 'EMPTY'}: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_cameras=False, export_lights=False, export_image_format='JPEG', export_jpeg_quality=86)
print('EXPORTED glove.glb', os.path.getsize(dst))
