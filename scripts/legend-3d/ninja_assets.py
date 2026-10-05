"""Real-time assets for the NINJA DEFUSE highlight, exported as GLB for three.js (not rendered).
Run: Blender -b -P ninja_assets.py -- <out dir>
Units are metres-ish, Z up in Blender (glTF export turns it into Y up). bomb.glb = bomb + ground slab; hands.glb = two gloved hands."""
import bpy, bmesh, math, os, sys
from mathutils import Vector

OUT = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/ninja'
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def srgb(c): return c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
def mat(name, hexc, rough=.8, metal=0.0, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    c = ((hexc >> 16) & 255) / 255, ((hexc >> 8) & 255) / 255, (hexc & 255) / 255
    b.inputs['Base Color'].default_value = (srgb(c[0]), srgb(c[1]), srgb(c[2]), 1)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit:
        b.inputs['Emission Color'].default_value = (srgb(c[0]), srgb(c[1]), srgb(c[2]), 1); b.inputs['Emission Strength'].default_value = emit
    return m

M = dict(case=mat('case', 0x4b503d, .78, .25), plate=mat('plate', 0x3a3e30, .7, .35), strap=mat('strap', 0x141516, .95),
         glass=mat('glass', 0x07090a, .25), keypad=mat('keypad', 0x1b1d1e, .7), metal=mat('metal', 0x75797c, .45, .85),
         led=mat('led', 0xff2a1a, .4, 0, 3.0), ledg=mat('led_green', 0x2bff6a, .4, 0, 3.0), rod=mat('rod', 0x0c0d0e, .6, .3),
         ground=mat('ground', 0x3b352d, .95), glove=mat('glove', 0x1d1e21, .88), sleeve=mat('sleeve', 0x2a2c2d, .95),
         cuff=mat('cuff', 0x111213, .8), screen=mat('lcd', 0x0b0d0e, .3),
         w_red=mat('w_red', 0xb3261e, .6), w_yel=mat('w_yel', 0xd1a21f, .6), w_blu=mat('w_blu', 0x2f5fa8, .6), w_grn=mat('w_grn', 0x2f8a3d, .6), w_wht=mat('w_wht', 0xbdbdb5, .6))

def obj(name, bm, m, parent=None, loc=(0, 0, 0), rot=(0, 0, 0)):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(m)
    for p in me.polygons: p.use_smooth = True
    o = bpy.data.objects.new(name, me); o.location = loc; o.rotation_euler = rot
    sc.collection.objects.link(o)
    if parent: o.parent = parent
    return o

def box(name, size, loc, m, parent=None, bevel=.012, rot=(0, 0, 0), seg=1):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel > 0: bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=seg, affect='EDGES')
    return obj(name, bm, m, parent, loc, rot)

def cyl(name, r1, r2, depth, loc, m, parent=None, rot=(0, 0, 0), seg=12):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=depth)
    return obj(name, bm, m, parent, loc, rot)

def ball(name, r, loc, m, parent=None, seg=12):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=r)
    return obj(name, bm, m, parent, loc)

def tube(name, pts, r, m, sides=6):
    bm = bmesh.new(); rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        a = Vector((0, 0, 1)) if abs(t.z) < .9 else Vector((1, 0, 0)); u = t.cross(a).normalized(); v = t.cross(u).normalized()
        rings.append([bm.verts.new(p + (u * math.cos(k / sides * math.tau) + v * math.sin(k / sides * math.tau)) * r) for k in range(sides)])
    for i in range(len(rings) - 1):
        for k in range(sides): bm.faces.new((rings[i][k], rings[i][(k + 1) % sides], rings[i + 1][(k + 1) % sides], rings[i + 1][k]))
    return obj(name, bm, m)

def bezier(p0, p1, p2, n=9): return [p0 * (1 - t) ** 2 + p1 * 2 * t * (1 - t) + p2 * t * t for t in [i / (n - 1) for i in range(n)]]

# ================================================================ the bomb
bomb = bpy.data.objects.new('bomb', None); sc.collection.objects.link(bomb)
box('body', (1.0, .62, .30), (0, 0, .17), M['case'], bomb, .028, seg=2)
box('top', (.94, .56, .05), (0, 0, .34), M['plate'], bomb, .015)
# display: a tilted bezel with a screen plane (UV 0..1) named lcd, so the runtime can draw digits on it
tilt = (math.radians(14), 0, 0)
bez = box('bezel', (.5, .27, .075), (-.22, .02, .395), M['glass'], bomb, .012, tilt)
bm = bmesh.new(); vs = [bm.verts.new(v) for v in ((-.2, -.075, 0), (.2, -.075, 0), (.2, .075, 0), (-.2, .075, 0))]
f = bm.faces.new(vs); uvl = bm.loops.layers.uv.new()
for lp, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): lp[uvl].uv = uv
lcd = obj('lcd', bm, M['screen'], bez, (0, 0, .0385))
ball('led', .032, (-.02, .2, .43), M['led'], bomb); ball('led_green', .032, (-.02, .2, .43), M['ledg'], bomb)
box('led_ring', (.085, .085, .02), (-.02, .2, .405), M['metal'], bomb, .008)
box('keypad_plate', (.36, .34, .03), (.27, -.02, .365), M['strap'], bomb, .01)
for r in range(4):
    for c in range(3): box(f'key{r}{c}', (.085, .06, .035), (.17 + c * .1, -.13 + r * .075, .39), M['keypad'], bomb, .008, rot=(0, 0, 0))
for x in (-.36, .36):
    box('strap', (.1, .66, .34), (x, 0, .17), M['strap'], bomb, .014)
    box('buckle', (.075, .1, .022), (x, -.04, .345), M['metal'], bomb, .006)
for sx in (-.43, -.12, .12, .43):
    for sy in (-.25, .25): cyl('screw', .02, .02, .015, (sx, sy, .372), M['metal'], bomb, seg=8)
cyl('ant_base', .035, .028, .05, (.43, .24, .39), M['rod'], bomb)
cyl('antenna', .011, .008, .5, (.45, .26, .62), M['rod'], bomb, rot=(math.radians(-8), math.radians(10), 0), seg=6)
for i, (m, x0, x1) in enumerate((('w_red', -.3, -.62), ('w_yel', -.2, -.35), ('w_blu', -.1, .05), ('w_grn', .02, .35), ('w_wht', .14, .62))):
    tube(f'wire{i}', bezier(Vector((x0, -.3, .2)), Vector((x0 + (x1 - x0) * .4, -.46 - i * .03, .1)), Vector((x1 * .7, -.52 - i * .04, .015))), .013, M[m])
box('ground', (4.2, 3.4, .2), (0, 0, -.1), M['ground'], None, .02)
for i, (x, y, s) in enumerate(((-.9, .45, .09), (.85, -.5, .07), (1.1, .5, .05), (-1.2, -.4, .06))):
    box(f'debris{i}', (s * 1.4, s, s * .6), (x, y, s * .3), M['plate'], None, .008, rot=(0, 0, i))

KEEP = ('lcd', 'led', 'led_green', 'ground')
def merge_by_material():
    """One mesh per material under each parent, so the scene draws a handful of meshes, not a hundred. The named ones stay apart so the runtime can drive them."""
    groups = {}
    for o in list(bpy.data.objects):
        if o.type != 'MESH' or o.name in KEEP: continue
        groups.setdefault((o.parent.name if o.parent else '', o.data.materials[0].name), []).append(o)
    for (par, mname), objs in groups.items():
        if len(objs) < 2: continue
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs: o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        objs[0].name = f'{par or "world"}_{mname}'

def export(name, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    for o in objs:
        for c in o.children_recursive: c.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, name), export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_cameras=False, export_lights=False)
    tris = sum(len(p.vertices) - 2 for o in bpy.context.selected_objects if o.type == 'MESH' for p in o.data.polygons)
    print('EXPORTED', name, 'triangles', tris, 'bytes', os.path.getsize(os.path.join(OUT, name)))

merge_by_material()
ground = [o for o in bpy.data.objects if o.name.startswith(('ground', 'world_', 'wire'))]
export('bomb.glb', [bomb] + ground)

# ================================================================ the hands (each at its wrist, fingers along +Y, palm down)
def hand(side):
    s = 1 if side == 'R' else -1
    root = bpy.data.objects.new(f'hand_{side}', None); sc.collection.objects.link(root)
    box('sleeve', (.17, .55, .15), (0, -.47, .0), M['sleeve'], root, .04, seg=2)
    box('cuff', (.15, .13, .13), (0, -.17, .0), M['cuff'], root, .035, seg=2)
    box('palm', (.14, .17, .06), (0, -.02, -.005), M['glove'], root, .028, seg=2)
    for i, (x, l) in enumerate(((-.05, .11), (-.017, .125), (.017, .12), (.05, .1))):
        box(f'f{i}a', (.03, l, .034), (x, .105 + l / 2 - .02, -.01), M['glove'], root, .012, seg=2)
        box(f'f{i}b', (.027, l * .8, .03), (x, .105 + l - .02 + l * .4 - .02, -.025), M['glove'], root, .011, rot=(math.radians(-18), 0, 0), seg=2)
    box('thumbA', (.034, .09, .036), (-.085 * s, .0, -.012), M['glove'], root, .012, rot=(0, 0, math.radians(30 * s)), seg=2)
    box('thumbB', (.03, .07, .032), (-.115 * s, .05, -.02), M['glove'], root, .011, rot=(0, 0, math.radians(18 * s)), seg=2)
    box('knuckles', (.15, .035, .045), (0, .085, .01), M['cuff'], root, .014, seg=2)
    return root
hands = [hand('L'), hand('R')]
merge_by_material()
export('hands.glb', hands)
