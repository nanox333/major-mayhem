"""Builds the end-card title as real 3D letters and exports it as a GLB for the game to animate.

    Blender -b -P scripts/legend-3d/title3d.py -- <out.glb> <noscope|ninja|ace|knife|clutch>

Each word is set in Saira Condensed ExtraBold (the site's display face), sheared to an italic, split into letters, thickened and bevelled, then split into one mesh per letter (so the game can slam them in
one by one). Slashing cuts and chips are then Boolean-subtracted from the letters, so the damage is real geometry, not a texture.
Objects are named a_0, a_1... (the first word) and b_0, b_1... (the second); materials are `tint` and `cream`, which the game re-skins.
The seed is fixed: the same command always produces the same title.
"""
import bpy, bmesh, math, os, random, sys
from mathutils import Vector

FONT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'SairaCondensed-ExtraBold.ttf')   # the site's display face (OFL), converted from src/fonts
args = sys.argv[sys.argv.index('--') + 1:]
OUT, WHICH = args[0], args[1]
WORDS = {'noscope': ('NO', 'SCOPE'), 'ninja': ('NINJA', 'DEFUSE'), 'ace': ('ACE', ''), 'knife': ('KNIFE', 'KILL'), 'clutch': ('1V5', 'CLUTCH')}[WHICH]   # an empty second word is a one-word title
rnd = random.Random(7 if WHICH == 'noscope' else 11)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def material(name, colour):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = colour
    return m
MATS = {'a': material('tint', (1, .35, .08, 1)), 'b': material('cream', (.95, .92, .86, 1))}

def select_only(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o

def fix_normals(p):
    select_only(p); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=1e-5); bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')

def extent(p):
    vs = [v.co for v in p.data.vertices]
    return (max(v.x for v in vs) - min(v.x for v in vs), max(v.y for v in vs) - min(v.y for v in vs)) if vs else (0, 0)

def word_pieces(text, tag, height, spacing):
    cu = bpy.data.curves.new(tag, 'FONT'); cu.body = text; cu.font = bpy.data.fonts.load(FONT)
    cu.size = 1; cu.extrude = 0; cu.align_x = 'CENTER'; cu.space_character = spacing; cu.fill_mode = 'BOTH'
    o = bpy.data.objects.new(tag, cu); scene.collection.objects.link(o); select_only(o)
    bpy.ops.object.convert(target='MESH')
    bm = bmesh.new(); bm.from_mesh(o.data)
    for v in bm.verts: v.co.x += v.co.y * .2          # italic shear
    bm.to_mesh(o.data); bm.free()
    o.data.update()
    k = height / o.dimensions.y; o.scale = (k, k, k); select_only(o); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.separate(type='LOOSE'); bpy.ops.object.mode_set(mode='OBJECT')
    pieces = [p for p in bpy.context.scene.objects if p.type == 'MESH' and p.name.startswith(tag)]
    print('pieces', tag, text, [(p.name, len(p.data.polygons), tuple(round(d,2) for d in p.dimensions)) for p in pieces])
    pieces.sort(key=lambda p: sum((p.matrix_world @ Vector(c)).x for c in p.bound_box) / 8)
    for i, p in enumerate(pieces):
        select_only(p); bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS'); p.name = f'{tag}_{i}'; p.data.name = f'{tag}_{i}'
        sol = p.modifiers.new('solid', 'SOLIDIFY'); sol.thickness = .3; sol.offset = 0
        select_only(p); bpy.ops.object.modifier_apply(modifier='solid')
        mod = p.modifiers.new('bevel', 'BEVEL'); mod.width = .03; mod.segments = 2; mod.limit_method = 'ANGLE'; mod.angle_limit = math.radians(35)
        select_only(p); bpy.ops.object.modifier_apply(modifier='bevel')
        fix_normals(p)
        p.data.materials.append(MATS[tag])
    return pieces

a = word_pieces(WORDS[0], 'a', 1.0 if WORDS[1] else 1.25, 1.06)
b = word_pieces(WORDS[1], 'b', 1.2, 1.04) if WORDS[1] else []
# stack the words: the second sits lower, overlapping the first's feet a little, both centred
def span(ps):
    xs = [(p.matrix_world @ Vector(c)).x for p in ps for c in p.bound_box]; return min(xs), max(xs)
for ps, y in (((a, .7), (b, -.52)) if b else ((a, 0),)):
    lo, hi = span(ps)
    for p in ps: p.location.x -= (lo + hi) / 2; p.location.y += y

def cutter(centre, length, width, angle):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centre)
    c = bpy.context.active_object; c.scale = (length, width, 1.0); c.rotation_euler = (0, 0, angle); return c

def extent_of(mesh):
    vs = [v.co for v in mesh.vertices]
    return (max(v.x for v in vs) - min(v.x for v in vs), max(v.y for v in vs) - min(v.y for v in vs)) if vs else (0, 0)

def overlaps(p, c):
    cp = [p.matrix_world @ Vector(v) for v in p.bound_box]; cc = [c.matrix_world @ Vector(v) for v in c.bound_box]
    return all(min(q[i] for q in cp) < max(q[i] for q in cc) and max(q[i] for q in cp) > min(q[i] for q in cc) for i in (0, 1))

def carve(p, c):
    if not overlaps(p, c): return
    backup = p.data.copy()
    mod = p.modifiers.new('cut', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = c; mod.solver = 'EXACT'
    select_only(p); bpy.ops.object.modifier_apply(modifier='cut')
    ex, ey = extent(p); bx, by = extent_of(backup)
    if len(p.data.vertices) < 8 or ex < bx * .9 or ey < by * .9:   # a failed Boolean: keep the letter as it was
        p.data = backup
    else:
        bpy.data.meshes.remove(backup)

for ps in (() if WHICH == 'knife' else ((a, b) if b else (a,))):
    lo, hi = span(ps)
    ys = [(p.matrix_world @ Vector(c)).y for p in ps for c in p.bound_box]; y0, y1 = min(ys), max(ys)
    # long slashes through the whole word: up-and-right, a few reversed
    for i in range(2 if ps is b else 1):
        cx = rnd.uniform(lo, hi); cy = rnd.uniform(y0, y1)
        ang = math.radians(rnd.choice([36, 42, 48]) + rnd.uniform(-3, 3))
        c = cutter((cx, cy, 0), rnd.uniform(.9, 1.7), rnd.uniform(.02, .034), ang)
        for p in ps: carve(p, c)
        bpy.data.objects.remove(c)
    # chips knocked out of the outline
    for p in ps:
        for _ in range(0):
            vs = [p.matrix_world @ v.co for v in p.data.vertices]
            if not vs: continue
            v = max(rnd.sample(vs, min(24, len(vs))), key=lambda q: abs(q.y - (y0 + y1) / 2) + rnd.random() * .15)
            c = cutter((v.x, v.y, 0), rnd.uniform(.05, .12), rnd.uniform(.03, .07), rnd.uniform(0, math.pi))
            carve(p, c); bpy.data.objects.remove(c)

# the knife kill: every letter is sliced in two on the slash line (28 degrees, up and to the right), so the game can slide the halves in along the cut
CUT = math.radians(28)
def halves(p):
    nx, ny = -math.sin(CUT), math.cos(CUT)
    out = []
    for side, tag in ((1, 'p'), (-1, 'q')):
        q = p.copy(); q.data = p.data.copy(); scene.collection.objects.link(q)
        # a big block covering one side of the cut (offset a hair so the halves do not touch), subtracted from this copy
        bpy.ops.mesh.primitive_cube_add(size=1, location=(p.location.x + nx * (4.0 + .006) * side, p.location.y + ny * (4.0 + .006) * side, p.location.z))
        c = bpy.context.active_object; c.scale = (9, 8, 3); c.rotation_euler = (0, 0, CUT)
        mod = q.modifiers.new('half', 'BOOLEAN'); mod.operation = 'DIFFERENCE'; mod.object = c; mod.solver = 'EXACT'
        select_only(q); bpy.ops.object.modifier_apply(modifier='half'); bpy.data.objects.remove(c)
        q.name = f'{p.name}_{tag}'; q.data.name = q.name; out.append(q)
    bpy.data.objects.remove(p)
    return out

if WHICH == 'knife':
    a = [h for p in a for h in halves(p)]; b = [h for p in b for h in halves(p)]

# upright for glTF (text faces +Z there), smooth shading by angle, then export
meshes = [o for o in scene.objects if o.type == 'MESH']
for o in meshes:
    o.location = (o.location.x, 0, o.location.y)           # the title's y becomes the glTF up axis
    select_only(o); o.rotation_euler = (math.radians(90), 0, 0); bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(35))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=False, export_apply=True, export_yup=True)
print('title3d:', WHICH, len(meshes), 'letters', sum(len(o.data.polygons) for o in meshes), 'faces ->', OUT)

# optional flat preview (workbench render, front view) to check the letters: ... <noscope|ninja|ace|knife> <preview.png>
if len(args) > 2:
    cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = 6.4
    co = bpy.data.objects.new('cam', cam); scene.collection.objects.link(co); co.location = (0, -10, 0); co.rotation_euler = (math.radians(90), 0, 0); scene.camera = co
    scene.render.engine = 'BLENDER_WORKBENCH'; scene.render.resolution_x = 1600; scene.render.resolution_y = 900
    scene.display.shading.light = 'STUDIO'; scene.display.shading.color_type = 'MATERIAL'
    scene.render.filepath = args[2]; bpy.ops.render.render(write_still=True)
