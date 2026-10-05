"""The no-scope, rendered in Blender. Four cuts: a player fires an AWP from the hip (both scope caps still on); the camera rides the bullet
down a long alley; it reaches one head far away and the world all but stops; a wide shot from behind the rifle as the target falls.
Usage: Blender -b -P noscope.py -- --out DIR [--frames 0-291] [--res 3840x2160] [--samples 128] [--fps 60] [--portrait]"""
import sys, os, math, argparse
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *
import lib

SLOW = 1.25
DURATION = 3.9
FIRE, CUT_B, HIT, CUT_D = 0.4, 1.0, 2.3, 3.1
CUT_C = HIT - 0.12
FOE_Y = 46.0           # how far down the alley the target stands
GUN_Z, HEAD_Z = 1.14, 1.65
FPS = 60
TOTAL = int(round(DURATION * SLOW * FPS))

SAND, SAND_D, SAND_L, BLUE, CAP = 0xd9b784, 0xb78c60, 0xe5cca3, 0x376b8d, 0xd8322b

def P(x, up, z): return V(x, -z, up)   # port from the (x, up, towards-camera) layout the web version used

def bullet_y(t):
    u = clamp((t - CUT_B) / (HIT - CUT_B)); return lerp(3.0, FOE_Y - 0.15, 1 - (1 - u) ** 1.7)
def world_clock(t):
    s = t - HIT
    return t if s < 0 else HIT + (0.15 * s if s < 0.35 else 0.0525 + (s - 0.35))

# ---------------------------------------------------------------- the world
def build_world():
    w = bpy.data.worlds.new('sky'); w.use_nodes = True; bpy.context.scene.world = w
    nt = w.node_tree; nt.nodes.clear(); L = nt.links.new
    tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeVectorMath'); nz.operation = 'NORMALIZE'; L(tc.outputs['Generated'], nz.inputs[0])
    sep = nt.nodes.new('ShaderNodeSeparateXYZ'); L(nz.outputs[0], sep.inputs[0])
    # Dusk gradient: warm horizon, cool overhead; clouds stay subdued.
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.interpolation = 'EASE'
    cols = [0xd2a37d, 0xb7907d, 0x897f85, 0x566779, 0x354f65, 0x243c53, 0x1c3048, 0x16253c]
    el = ramp.color_ramp.elements; el[0].position = 0; el[0].color = lin(cols[0]); el[1].position = 0.0
    el[1].color = lin(cols[0])
    for i, c in enumerate(cols[1:], 1): e = el.new(i / len(cols) * 0.62); e.color = lin(c)
    L(sep.outputs['Z'], ramp.inputs[0])
    # clouds: soft noise cut hard into flat shapes, only above the horizon
    nz3 = nt.nodes.new('ShaderNodeTexNoise'); nz3.inputs['Scale'].default_value = 2.6; nz3.inputs['Detail'].default_value = 2.0
    mul = nt.nodes.new('ShaderNodeVectorMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = (1.0, 1.0, 2.6); L(nz.outputs[0], mul.inputs[0]); L(mul.outputs[0], nz3.inputs['Vector'])
    cr = nt.nodes.new('ShaderNodeValToRGB'); cr.color_ramp.interpolation = 'CONSTANT'; cr.color_ramp.elements[0].position = 0.0; cr.color_ramp.elements[0].color = (0, 0, 0, 1)
    cr.color_ramp.elements[1].position = 0.60; cr.color_ramp.elements[1].color = (1, 1, 1, 1); L(nz3.outputs['Fac'], cr.inputs[0])
    band = nt.nodes.new('ShaderNodeMath'); band.operation = 'GREATER_THAN'; band.inputs[1].default_value = 0.12; L(sep.outputs['Z'], band.inputs[0])
    cm = nt.nodes.new('ShaderNodeMath'); cm.operation = 'MULTIPLY'; L(cr.outputs[0], cm.inputs[0]); L(band.outputs[0], cm.inputs[1])
    mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'; L(cm.outputs[0], mix.inputs['Factor']); L(ramp.outputs[0], mix.inputs[6]); mix.inputs[7].default_value = lin(0x748496)
    # sun disc
    sd = nt.nodes.new('ShaderNodeVectorMath'); sd.operation = 'DOT_PRODUCT'; sd.inputs[1].default_value = Vector((-0.45, 0.8, 0.4)).normalized(); L(nz.outputs[0], sd.inputs[0])
    sg = nt.nodes.new('ShaderNodeMath'); sg.operation = 'GREATER_THAN'; sg.inputs[1].default_value = 0.992; L(sd.outputs['Value'], sg.inputs[0])
    sh = nt.nodes.new('ShaderNodeMath'); sh.operation = 'GREATER_THAN'; sh.inputs[1].default_value = 0.975; L(sd.outputs['Value'], sh.inputs[0])
    mix2 = nt.nodes.new('ShaderNodeMix'); mix2.data_type = 'RGBA'; L(sh.outputs[0], mix2.inputs['Factor']); L(mix.outputs[2], mix2.inputs[6]); mix2.inputs[7].default_value = lin(0xfff0c8)
    mix3 = nt.nodes.new('ShaderNodeMix'); mix3.data_type = 'RGBA'; L(sg.outputs[0], mix3.inputs['Factor']); L(mix2.outputs[2], mix3.inputs[6]); mix3.inputs[7].default_value = (1, 1, 1, 1)
    bg = nt.nodes.new('ShaderNodeBackground'); bg.inputs['Strength'].default_value = 0.6; L(mix3.outputs[2], bg.inputs['Color'])
    out = nt.nodes.new('ShaderNodeOutputWorld'); L(bg.outputs[0], out.inputs[0])
    sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 0.9; sun.color = hexrgb(0xffc88d); sun.angle = math.radians(5)
    so = bpy.data.objects.new('sun', sun); link(so, ink=False); so.rotation_euler = (math.radians(72), math.radians(8), math.radians(-48))
    def area(name, location, aim, energy, color, size):
        light = bpy.data.lights.new(name, 'AREA'); light.energy = energy
        light.color = hexrgb(color); light.shape = 'DISK'; light.size = size
        obj = bpy.data.objects.new(name, light); obj.location = location
        link(obj, ink=False); look_at(obj, V(*aim))
    for y in (-1, FOE_Y):
        area('warm key', (3.2, y - 2.5, 4.5), (0, y, 1.2), 260, 0xffbe82, 3.2)
        area('cool rim', (-2.0, y + 2.8, 3.5), (0, y, 1.4), 600, 0x89c8ff, 2.0)
    # Low-density atmospheric perspective hides distant block edges and gives light depth.
    fog = bpy.data.materials.new('dust atmosphere'); fog.use_nodes = True
    nodes = fog.node_tree.nodes; nodes.clear()
    scatter = nodes.new('ShaderNodeVolumeScatter'); scatter.inputs['Color'].default_value = lin(0xbbcbd6)
    scatter.inputs['Density'].default_value = 0.005; scatter.inputs['Anisotropy'].default_value = 0.3
    output = nodes.new('ShaderNodeOutputMaterial'); fog.node_tree.links.new(scatter.outputs[0], output.inputs['Volume'])
    box('atmosphere', (34, 130, 22), (0, 48, 8), fog, bevel=0)
    bpy.context.scene.eevee.volumetric_samples = 32
    bpy.context.scene.eevee.volumetric_tile_size = '16'


def build_alley():
    # A shaded background for the opening hero shot, beyond the shooter.
    box('opening facade', (1.2, 22, 6.5), (-7, 1, 3.25), toon(SAND_D), bevel=0.08)
    for y in (-5, 0, 5):
        box('opening recess', (0.12, 1.3, 1.9), (-6.35, y, 3.0), toon(0x273844), bevel=0.04)
        box('opening sill', (0.4, 1.5, 0.18), (-6.3, y, 2.0), toon(SAND_L), bevel=0.025)
    g = box('ground', (60, 260, 0.2), (0, 100, -0.1), toon(SAND), bevel=0)
    for x, w, c in ((-1.6, 1.1, SAND_D), (1.9, 0.8, SAND_D), (0, 0.5, SAND_L)):
        box('stripe', (w, 220, 0.02), (x, 100, 0.005), toon(c), bevel=0)
    def wall(x, y0, y1, h):
        box('wall', (1.2, abs(y1 - y0), h), (x, (y0 + y1) / 2, h / 2), toon(SAND_D), bevel=0.05)
        box('plinth', (1.28, abs(y1 - y0), 0.5), (x - math.copysign(0.03, x), (y0 + y1) / 2, 0.25), toon(0xb07a45), bevel=0.04)
        box('cap', (1.4, abs(y1 - y0), 0.25), (x, (y0 + y1) / 2, h + 0.1), toon(SAND_L), bevel=0.05)
    wall(-5.2, 16, 120, 8); wall(5.4, -6, 22, 6.5); wall(5.4, 28, 120, 7.5)
    for i in range(5):
        y = 18 + i * 4.6
        box('win', (0.2, 1.2, 1.6), (-4.52, y, 4.4), toon(0x2b3f63), bevel=0.03); box('sill', (0.9, 1.4, 0.22), (-4.5, y, 3.5), toon(SAND_L), bevel=0.03)
        box('shutter', (0.16, 0.3, 1.6), (-4.5, y - 0.75, 4.4), toon(0x7a4f2a), bevel=0.02)
    for i in range(6):
        y = 33 + i * 4.4; box('win', (0.2, 1.0, 1.4), (4.7, y, 4.8), toon(0x2b3f63), bevel=0.03)
    for i in range(6):
        y = 9 + i * 7.2
        box('beam', (10.2, 0.6, 0.36), (0, y, 6.3), toon(0x7a4f2a), bevel=0.04)
        box('post', (0.3, 0.3, 0.9), (-3.4, y, 5.8), toon(0x7a4f2a), bevel=0.03)
        bn = box('banner', (0.9, 0.06, 1.5), (1.6 if i % 2 else -1.7, y, 5.4), toon([CAP, BLUE, 0xe8b23a][i % 3]), bevel=0.02); bn.rotation_euler = (0, math.radians(3 if i % 2 else -3), 0)
        bn.rotation_euler.y = math.radians(3 if i % 2 else -3)
    for x, y, s, c in ((-3.1, 9, 1.2, 0xa4743c), (-3.0, 10.3, 0.8, 0xa4743c), (3.4, 15, 1.4, 0xb8824a), (-3.2, 24, 1.5, 0xa4743c), (3.0, 34, 1.1, 0xb8824a), (-2.8, 37, 1.0, 0xa4743c), (2.2, 41, 0.9, 0xa4743c)):
        cr = box('crate', (s, s, s), (x, y, s / 2), toon(c), bevel=0.05); cr.rotation_euler.z = x * y * 0.07
        box('slat', (s * 1.02, s * 0.14, s * 1.02), (x, y, s / 2), toon(0x7a5230), bevel=0.02).rotation_euler.z = x * y * 0.07
    for y in range(38, 70, 5):
        box('win2', (0.2, 1.2, 1.5), (-4.52, y, 4.2), toon(0x2b3f63), bevel=0.03); box('sill2', (0.9, 1.4, 0.2), (-4.5, y, 3.4), toon(SAND_L), bevel=0.03)
        box('shut2', (0.16, 0.34, 1.5), (-4.5, y - 0.8, 4.2), toon(0x7a4f2a), bevel=0.02)
    box('door2', (0.25, 1.7, 2.7), (-4.5, 47.5, 1.35), toon(0x6a4528), bevel=0.04); box('doorframe', (0.3, 2.1, 0.3), (-4.5, 47.5, 2.85), toon(SAND_L), bevel=0.04)
    for z0 in (0.5, 1.4): box('plank', (0.28, 1.72, 0.05), (-4.46, 47.5, z0), toon(0x4a2f18), bevel=0.01)
    for i, y in enumerate((43, 51.5)):
        box('barrel', (0.8, 0.8, 1.0), (-3.9, y, 0.5), toon(0x8a5a30), bevel=0.12); box('hoop', (0.84, 0.84, 0.08), (-3.9, y, 0.3), toon(0x2a2a2a), bevel=0.02); box('hoop2', (0.84, 0.84, 0.08), (-3.9, y, 0.72), toon(0x2a2a2a), bevel=0.02)
    box('facade', (9, 3, 9), (0, 53, 4.5), toon(SAND_L), bevel=0.08)
    box('door', (3.3, 0.5, 4.1), (0, 51.4, 2.05), toon(BLUE), bevel=0.06)
    box('lintel', (4.2, 0.7, 0.5), (0, 51.2, 4.3), toon(SAND_D), bevel=0.05)
    # Soft architectural edges; reserve the ink pass for the action silhouettes.
    for obj in list(lib.INK_COLL.objects):
        lib.INK_COLL.objects.unlink(obj); bpy.context.scene.collection.objects.link(obj)

# ---------------------------------------------------------------- people
def person(prefix, look):
    cloth, vest, dark, skin, scarf = look
    root = bpy.data.objects.new(prefix + '_root', None); link(root, ink=False)
    def part(kind, name, size, loc, col, parent=None, bevel=0.02):
        return box(prefix + name, size, loc, toon(col), parent or root, bevel)
    legs = [part('b', 'legL', (0.22, 0.26, 0.8), (-0.14, 0, 0.4), cloth), part('b', 'legR', (0.22, 0.26, 0.8), (0.14, 0, 0.4), cloth)]
    for x in (-0.14, 0.14):
        part('b', 'boot', (0.2, 0.34, 0.1), (x, 0.05, 0.05), dark); part('b', 'pad', (0.25, 0.3, 0.17), (x, 0.06, 0.5), vest)
    torso = bpy.data.objects.new(prefix + '_torso', None); torso.parent = root; link(torso, ink=False); torso.location = (0, 0, 0)
    tapered(prefix + 'chest', (0.48, 0.32), (0.65, 0.36), 0.74, (0, 0, 1.17), toon(cloth), torso, 0.05)
    tapered(prefix + 'plate', (0.46, 0.37), (0.56, 0.41), 0.54, (0, 0.015, 1.21), toon(vest), torso, 0.035)
    for sx in (-1, 1):
        part('b', 'strap', (0.085, 0.04, 0.52), (sx * 0.21, 0.23, 1.24), dark, torso, 0.01)
        part('b', 'buckle', (0.07, 0.055, 0.05), (sx * 0.21, 0.24, 1.17), 0x8b8e82, torso, 0.008)
    part('b', 'radio', (0.10, 0.08, 0.18), (0.27, 0.245, 1.32), dark, torso, 0.016)
    cyl(prefix + 'antenna', 0.008, 0.008, 0.19, (0.27, 0.245, 1.5), toon(dark), torso, axis='Z')
    part('b', 'belt', (0.68, 0.38, 0.09), (0, 0, 0.84), dark, torso, 0.015)
    for px in (-0.17, 0, 0.17): part('b', 'pouch', (0.13, 0.09, 0.15), (px, 0.24, 1.0), dark, torso, 0.015)
    part('b', 'neck', (0.2, 0.2, 0.18), (0, 0, 1.55), scarf, torso)
    for sx in (-1, 1): part('b', 'shoulder', (0.2, 0.36, 0.15), (sx * 0.36, 0, 1.5), vest, torso, 0.03)
    head = bpy.data.objects.new(prefix + '_head', None); head.parent = torso; link(head, ink=False); head.location = (0, 0, HEAD_Z + 0.03)
    sphere(prefix + 'skull', 0.22, (0, 0, 0), toon(skin), head, seg=48, scale=(0.88, 0.9, 1.1))
    sphere(prefix + 'nose', 0.055, (0, 0.195, -0.005), toon(skin), head, seg=20, scale=(0.65, 0.8, 0.9))
    part('b', 'balaclava', (0.31, 0.08, 0.12), (0, 0.16, -0.12), scarf, head, 0.025)
    for sx in (-1, 1):
        sphere(prefix + 'ear', 0.045, (sx * 0.19, 0, -0.015), toon(skin), head, seg=20, scale=(0.55, 0.85, 1))
    part('b', 'goggles', (0.3, 0.06, 0.1), (0, 0.19, 0.02), dark, head, 0.01)
    return dict(root=root, torso=torso, head=head)

def helmet(prefix, col, stripe=0xf1ece0):
    h = bpy.data.objects.new(prefix + '_helmet', None); link(h, ink=False)
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=0.25)
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, -0.04), plane_no=(0, 0, 1), clear_inner=True)
    o = mesh_obj(prefix + 'dome', bm, toon(col), h); [setattr(p, 'use_smooth', True) for p in o.data.polygons]
    box(prefix + 'brim', (0.45, 0.47, 0.035), (0, 0, -0.03), toon(0x2a2420), h, 0.012)
    for sx in (-1, 1):
        box(prefix + 'rail', (0.025, 0.25, 0.05), (sx * 0.24, 0, 0.05), toon(0x20232a), h, 0.01)
        box(prefix + 'earguard', (0.07, 0.13, 0.16), (sx * 0.21, 0, -0.075), toon(col), h, 0.025)
    box(prefix + 'mount', (0.07, 0.04, 0.08), (0, 0.23, 0.055), toon(0x20232a), h, 0.01)
    return h

def two_bone(S, T, l1, l2, pole):
    d = T - S; dist = clamp(d.length, 0.05, l1 + l2 - 0.001); dn = d.normalized()
    a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist); hgt = math.sqrt(max(0.0, l1 * l1 - a * a))
    pv = (pole - dn * pole.dot(dn)); pv = pv.normalized() if pv.length > 1e-6 else Vector((0, 0, 1))
    return S + dn * a + pv * hgt

class Arm:
    def __init__(self, prefix, col, glove):
        self.up = tapered(prefix + 'upper', (0.21, 0.20), (0.14, 0.14), 1.0, (0, 0, 0), toon(col), bevel=0.035)
        self.lo = tapered(prefix + 'fore', (0.17, 0.16), (0.12, 0.12), 1.0, (0, 0, 0), toon(col), bevel=0.028)
        self.hand = box(prefix + 'glove', (0.13, 0.15, 0.13), (0, 0, 0), toon(glove), bevel=0.02)
        self.elbow = sphere(prefix + 'elbow', 0.095, (0, 0, 0), toon(col))
    def set(self, S, T, pole, l1=0.42, l2=0.42):
        E = two_bone(S, T, l1, l2, pole)
        place_between(self.up, S, E); place_between(self.lo, E, T); self.elbow.location = E
        self.hand.location = T; self.hand.rotation_mode = 'QUATERNION'; self.hand.rotation_quaternion = self.lo.rotation_quaternion

# ---------------------------------------------------------------- the gun
def build_gun():
    g = bpy.data.objects.new('gun', None); link(g, ink=False)
    OD, BK, ST = 0x6f7f4c, 0x20232a, 0x929aa6
    m = lambda c: toon(c)
    box('recv', (0.1, 0.5, 0.13), (0, 0, 0), m(OD), g, 0.015); b = box('stock', (0.085, 0.55, 0.17), (0, -0.5, -0.03), m(OD), g, 0.02); b.rotation_euler.x = math.radians(-6)
    box('cheek', (0.07, 0.3, 0.05), (0, -0.55, 0.09), m(BK), g, 0.015); box('butt', (0.09, 0.04, 0.2), (0, -0.78, -0.03), m(BK), g, 0.015)
    gr = box('grip', (0.06, 0.09, 0.2), (0, -0.24, -0.15), m(BK), g, 0.02); gr.rotation_euler.x = math.radians(16)
    box('mag', (0.06, 0.12, 0.12), (0, 0.02, -0.11), m(BK), g, 0.015)
    cyl('barrel', 0.024, 0.02, 0.9, (0, 0.7, 0.01), m(BK), g)
    cyl('brake', 0.04, 0.04, 0.15, (0, 1.2, 0.01), m(ST), g, bevel=0)
    for dy in (1.16, 1.22): box('slot', (0.1, 0.03, 0.018), (0, dy, 0.01), m(BK), g, 0)
    sc = bpy.data.objects.new('scope', None); sc.parent = g; link(sc, ink=False); sc.location = (0, 0.02, 0.15)
    cyl('tube', 0.038, 0.038, 0.42, (0, 0, 0), m(BK), sc)
    cyl('objective', 0.055, 0.04, 0.12, (0, 0.27, 0), m(BK), sc); cyl('eyepiece', 0.04, 0.05, 0.1, (0, -0.26, 0), m(BK), sc)
    cyl('capF', 0.058, 0.058, 0.03, (0, 0.35, 0), m(CAP), sc); cyl('capB', 0.05, 0.05, 0.03, (0, -0.33, 0), m(CAP), sc)
    box('mount1', (0.04, 0.06, 0.05), (0, 0.14, 0.09), m(ST), g, 0.01); box('mount2', (0.04, 0.06, 0.05), (0, -0.1, 0.09), m(ST), g, 0.01)
    bh = cyl('bolt', 0.01, 0.01, 0.13, (0.07, -0.12, 0.02), m(ST), g, axis='X'); sphere('knob', 0.024, (0.14, -0.12, 0.02), m(BK), g)
    # Scope turrets, rail slots, trigger guard and receiver fasteners.
    cyl('turretTop', 0.03, 0.03, 0.045, (0, 0.02, 0.205), m(BK), g, axis='Z', seg=32)
    cyl('turretSide', 0.025, 0.025, 0.04, (0.06, 0.02, 0.15), m(BK), g, axis='X', seg=32)
    for dy in (-0.17, -0.08, 0.0, 0.1, 0.2):
        box('railSlot', (0.11, 0.018, 0.015), (0, dy, 0.065), m(BK), g, 0.003)
    for side in (-1, 1):
        for dy in (-0.12, 0.13):
            cyl('receiverScrew', 0.009, 0.009, 0.008, (side * 0.055, dy, 0.008), m(ST), g, axis='X', seg=16)
    box('triggerGuard', (0.055, 0.17, 0.02), (0, -0.20, -0.19), m(BK), g, 0.006)
    box('trigger', (0.01, 0.025, 0.07), (0, -0.16, -0.13), m(ST), g, 0.003)
    bp = cyl('bipod', 0.008, 0.008, 0.5, (-0.03, 0.62, -0.05), m(BK), g)
    return g, sc

# ---------------------------------------------------------------- the scene
class Scene:
    pass

def make():
    S = Scene()
    build_world(); build_alley()
    S.gun, S.scope = build_gun()
    S.me = person('me_', (0x3d5a8c, 0x1f2a45, 0x16181f, 0xe0a878, 0x2b3f63)); S.me['root'].rotation_euler.z = 0   # faces +Y already
    S.myhelm = helmet('me_', 0x2c4a80); S.myhelm.parent = S.me['head']; S.myhelm.location = (0, 0, 0.02)
    S.armR = Arm('meR_', 0x3d5a8c, 0x1d1f26); S.armL = Arm('meL_', 0x3d5a8c, 0x1d1f26)
    S.foe = person('foe_', (0x9b7f4e, 0x3a2e22, 0x3a2e22, 0xe0a878, 0xb3322b))
    fr = S.foe['root']; fr.rotation_euler.z = math.pi   # faces the shooter (-Y)
    S.foehelm = helmet('foe_', 0xb3322b)
    S.foeArmL = Arm('foeL_', 0x9b7f4e, 0x1d1f26); S.foeArmR = Arm('foeR_', 0x9b7f4e, 0x1d1f26)
    S.rifle = bpy.data.objects.new('foe_rifle', None); link(S.rifle, ink=False)
    box('frifle', (0.11, 1.0, 0.14), (0, 0, 0), toon(0x3a2e22), S.rifle, 0.015); box('fstock', (0.08, 0.3, 0.2), (0, -0.35, -0.06), toon(0x3a2e22), S.rifle, 0.015)
    # shadow of the target, soft dark disc
    sh = cyl('shadow', 0.8, 0.8, 0.01, (0, FOE_Y, 0.03), flat(0x6e4a22, 0.35, 'shadow'), None, axis='Z', seg=32)
    sh.rotation_euler = (0, 0, 0); S.shadow = sh
    # bullet
    S.bullet = bpy.data.objects.new('bullet', None); link(S.bullet, ink=False)
    cyl('b_body', 0.06, 0.06, 0.26, (0, -0.05, 0), toon(0xf3b44d), S.bullet, seg=24)
    cyl('b_tip', 0.0, 0.06, 0.22, (0, 0.19, 0), toon(0xe08a2e), S.bullet, seg=24); cyl('b_base', 0.064, 0.064, 0.05, (0, -0.2, 0), toon(0xc9892e), S.bullet, seg=24)
    cyl('b_band', 0.0625, 0.0625, 0.02, (0, 0.07, 0), toon(0x7a4f2a), S.bullet, seg=24)
    S.bullet.scale = (1.7, 1.7, 1.7)
    S.streak = cyl('streak', 0.0, 0.05, 2.6, (0, -1.5, 0), flat(0xfff3d0, 0.8, 'streak'), S.bullet, seg=14)
    S.lines = []
    for i in range(42):
        a = rnd(i) * math.tau; d = 2.3 + rnd(i + 40) * 3.4; ln = 5 + rnd(i + 80) * 12
        o = box('wind', (0.012 + rnd(i + 5) * 0.014, ln, 0.01), (math.cos(a) * d, 2 + rnd(i + 120) * 50, HEAD_Z - 0.3 + math.sin(a) * d * 0.55), flat(0xfffaee, 0.9, f'wind{i}'), None, 0)
        S.lines.append(o)
    # flashes and effects: each is a star on a black backing
    def badge(name, pts, outer, inner, col, edge=0.07):
        grp = bpy.data.objects.new(name, None); link(grp, ink=False)
        b = star(name + 'k', pts, outer * (1 + edge), inner * (1 + edge), flat(0x14110f, 1, name + 'kk'), grp); b.location.y = 0.004
        f = star(name + 'f', pts, outer, inner, flat(col, 1, name + 'ff'), grp)
        return grp
    S.mz1 = badge('mz1', 9, 1, 0.42, 0xffd24a); S.mz2 = badge('mz2', 7, 0.62, 0.3, 0xffffff, 0)
    S.hit1 = badge('hit1', 12, 1, 0.5, 0xffffff); S.hit2 = badge('hit2', 8, 0.66, 0.32, 0xffd24a, 0)
    S.shock = ring('shock', 0.9, flat(0xffffff, 0.9, 'shock')); S.hring = ring('hring', 0.9, flat(0xffffff, 0.9, 'hring'))
    S.puffs = []
    for i in range(6):
        p = sphere(f'puff{i}', 0.2, (0, 0, 0), flat(0xf6ead4, 1, f'puff{i}'), None, 12, (1, 0.1, 1)); S.puffs.append((p, rnd(i + 3) * 6.28, 0.35 + rnd(i + 11) * 0.5))
    S.casing = cyl('casing', 0.012, 0.012, 0.09, (0, 0, 0), toon(0xe0b24a), None)
    S.shards = [(box(f'shard{i}', (0.1, 0.1, 0.1), (0, 0, 0), toon(0xf3b44d if i % 3 else 0x2e2418), None, 0.01), V((rnd(i) - .5) * 4, (rnd(i + 40) - .3) * 3.2, 1.2 + rnd(i + 20) * 3), rnd(i + 60) * 9) for i in range(8)]
    S.mark = bpy.data.objects.new('mark', None); link(S.mark, ink=False)
    for k in range(4):
        a = math.radians(45 + 90 * k); cx, cz = math.cos(a) * 0.27, math.sin(a) * 0.27
        bk = box(f'mkb{k}', (0.42, 0.01, 0.16), (cx, 0.004, cz), flat(0x14110f, 1, 'mkb'), S.mark, 0); bk.rotation_euler.y = -a
        fr = box(f'mkf{k}', (0.34, 0.01, 0.09), (cx, 0, cz), flat(0xffffff, 1, 'mkf'), S.mark, 0); fr.rotation_euler.y = -a
    S.veil = box('veil', (14, 0.01, 14), (0, 0, 0), flat(0xffffff, 1, 'veil'), None, 0)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); link(cam, ink=False); bpy.context.scene.camera = cam; S.cam = cam
    cam.data.clip_start = 0.1; cam.data.clip_end = 300
    cam.data.dof.use_dof = True; cam.data.dof.aperture_blades = 7
    S.veil.parent = cam
    return S

def face_camera(o, cam, roll=0.0, scale=1.0):
    d = (cam.location - o.location).normalized()
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = V(0, -1, 0).rotation_difference(d) @ Quaternion((0, -1, 0), roll)
    o.scale = (scale, scale, scale)

def update(S, t_real, portrait=False):
    t = clamp(t_real / SLOW, 0, DURATION)
    w = world_clock(t); dt = max(0.0, w - HIT); s = max(0.0, t - HIT)
    inA, inB, inC = t < CUT_B, CUT_B <= t < CUT_C, CUT_C <= t < CUT_D
    fd = max(0.0, t - FIRE); sl = fd * 0.55
    kick = smooth(fd, 0, 0.035) * math.exp(-fd * 6.5) if fd > 0 else 0.0
    settle = smooth(t, 0, FIRE) if t < FIRE else 1.0
    cam = S.cam
    # rifle and shooter
    S.gun.location = V(0, kick * -0.2, GUN_Z + (1 - settle) * -0.05 + math.sin(t * 3.2) * 0.004)
    S.gun.rotation_euler = (kick * 0.18, 0, 0)
    S.me['root'].location = V(-0.18, -0.55 - kick * 0.1, 0); S.me['root'].rotation_euler.x = -kick * 0.05
    S.me['torso'].rotation_euler.x = kick * 0.1 - (1 - settle) * 0.02
    bpy.context.view_layer.update()
    mw = S.gun.matrix_world
    rootp = S.me['root'].location
    S.armR.set(V(rootp.x + 0.36, rootp.y, 1.42), mw @ V(0, -0.24, -0.2), V(0.4, -0.3, -1.0))
    S.armL.set(V(rootp.x - 0.36, rootp.y, 1.42), mw @ V(0, 0.10, -0.07), V(-0.3, -0.2, -1.0), l1=0.46, l2=0.46)
    muzzle = mw @ V(0, 1.3, 0.01)
    # muzzle flash, shock ring, smoke, casing
    on = 0 < fd < 0.17; bk = clamp(fd / 0.17)
    for g in (S.mz1, S.mz2):
        show(g, on); g.location = muzzle
        face_camera(g, cam, bk * 1.0 + 0.0, 0.16 + math.sin(bk * 1.6) * 0.25)
    S.mz2.location = muzzle + (cam.location - muzzle).normalized() * 0.02
    S.shock.hide_render = not (0 < fd < 0.3); S.shock.location = muzzle; face_camera(S.shock, cam, 0, 0.15 + fd * 4.2); fade(S.shock, 0.9 * (1 - fd / 0.3) if fd < 0.3 else 0)
    for p, a, d in S.puffs:
        k = clamp(sl * 0.8 - 0.02); p.hide_render = not (fd > 0 and k < 1)
        p.location = muzzle + V(math.cos(a) * k * 0.5 * d, k * 0.55 * d + 0.1, math.sin(a) * k * 0.4 * d + k * 0.15)
        face_camera(p, cam, 0, 0.4 + k * 1.8); fade(p, (1 - k) * 0.95)
    S.casing.hide_render = not (0 < fd < 1.6)
    S.casing.location = V(0.14 + sl * 0.9, kick * -0.2 + 0.1 + sl * 0.3, GUN_Z + 0.12 + sl * 1.1 - sl * sl * 2.6)
    S.casing.rotation_euler = (sl * 11, sl * 7, sl * 5)
    # bullet and wind
    u = clamp((t - CUT_B) / (HIT - CUT_B))
    by = (1.34 + max(0.0, t - FIRE - 0.06) * 26) if inA else bullet_y(min(t, HIT)); bz = lerp(GUN_Z + 0.01, HEAD_Z + 0.03, smooth(u, 0.05, 1))
    S.bullet.location = V(0, by, bz); show(S.bullet, FIRE + 0.06 <= t < HIT)
    S.streak.hide_render = not (t < HIT - 0.12) or not (FIRE + 0.06 <= t < HIT); S.streak.scale = (1, 1, lerp(1, 0.5, smooth(u, 0.8, 1)) if not inA else clamp((by - 1.5) / 3.0, 0.02, 1))
    for l in S.lines:
        l.hide_render = not inB
        if inB: fade(l, 0.5 * (1 - smooth(u, 0.78, 1)))
    # the target
    foe = S.foe
    snap = smooth(s, 0, 0.06) * (1 - 0.55 * smooth(s, 0.25, 0.9)) if s > 0 else 0.0
    foe['head'].rotation_euler.x = snap * 0.6     # snaps back (local frame is turned round)
    fall = smooth(dt, 0.05, 1.0) * 1.5
    foe['root'].location = V(0, FOE_Y + fall * 0.55, math.sin(clamp(dt * 3, 0, math.pi)) * 0.1)
    foe['torso'].rotation_euler.x = 0
    # fall by tipping the whole figure about the feet: use a parent-less rotation about local X with the figure turned round
    foe['root'].rotation_mode = 'XYZ'; foe['root'].rotation_euler = (fall, 0, math.pi)
    bpy.context.view_layer.update()
    fm = foe['torso'].matrix_world
    S.foeArmR.set(fm @ V(0.36, 0, 1.42), fm @ V(0.1, 0.36, 1.18), V(0.4, 0, -1)); S.foeArmL.set(fm @ V(-0.36, 0, 1.42), fm @ V(0.0, 0.7, 1.28), V(-0.4, 0, -1))
    show(S.rifle, True); S.rifle.location = fm @ V(0.05, 0.52, 1.22) if s <= 0 else V(0.1, FOE_Y - 0.5 + 1.5 * dt, max(0.12, 1.2 + 2.2 * dt - 4.9 * dt * dt))
    if s <= 0: S.rifle.rotation_euler = (0, 0, math.pi)
    else:
        air = S.rifle.location.z > 0.13; S.rifle.rotation_euler = (dt * 6 if air else 1.4, dt * 3 if air else 0.5, math.pi + (dt * 4 if air else 0.2))
    hz = HEAD_Z + 0.2 + (3.1 * dt - 4.9 * dt * dt if dt > 0 else 0)
    S.foehelm.location = V(0.5 * dt, FOE_Y + 0.9 * dt, max(0.14, hz)) if dt > 0 else foe['head'].matrix_world.translation + V(0, 0, 0.17)
    S.foehelm.rotation_euler = (dt * 7, dt * 4, dt * 6) if dt > 0 else (fall, 0, math.pi)
    S.shadow.location = V(0, FOE_Y + fall * 0.3, 0.03); S.shadow.hide_render = False
    # hit star, ring, shards
    hk = clamp(s / 0.5)
    on = s > 0 and hk < 1
    for g in (S.hit1, S.hit2):
        show(g, on); g.location = V(0.04, FOE_Y + 0.25, HEAD_Z + 0.05)
        face_camera(g, cam, 0, 0.12 + smooth(hk, 0, 0.18) * 0.62 * (1 - smooth(hk, 0.35, 1)))
    S.hit2.location = S.hit1.location + (cam.location - S.hit1.location).normalized() * 0.02
    S.hring.hide_render = not (0 < s < 0.45); S.hring.location = V(0, FOE_Y - 0.1, HEAD_Z + 0.05); face_camera(S.hring, cam, 0, 0.2 + s * 5); fade(S.hring, 0.9 * (1 - s / 0.45) if s < 0.45 else 0)
    for o, v, spin in S.shards:
        o.hide_render = not (0 < dt < 1.3)
        o.location = V(v.x * dt * 0.6, FOE_Y + v.y * dt * 0.5, max(0.08, HEAD_Z + v.z * dt - 4.9 * dt * dt)); o.rotation_euler = (dt * spin, dt * spin * 0.7, 0)
        o.scale = (1 - smooth(dt, 0.8, 1.3),) * 3
    # hit marker: four ticks, pops in the wide shot
    mk_on = t >= CUT_D + 0.45; mk = clamp((t - CUT_D - 0.45) / 0.35)
    # cameras
    roll = 0.0; vfov = 40.0
    if inA:
        push = smooth(t, 0, CUT_B)
        cam.location = P(3.05 - push * 0.28, 1.02, -0.5 + push * 0.15)
        aim = P(-0.05, 1.30, 0.1 + kick * 0.06); vfov = 36 - push * 2; roll = -0.04
        cam.location.x += math.sin(t * 90) * kick * 0.014; cam.location.z += math.cos(t * 70) * kick * 0.014
    elif inB:
        near = smooth(u, 0.5, 1)
        cam.location = V(lerp(0.7, 1.1, near), by - lerp(2.3, 3.3, near), bz + lerp(0.5, 0.1, near))
        aim = V(0.05, by + lerp(4, 0.5, near), lerp(bz - 0.12, HEAD_Z, near)); vfov = lerp(lerp(84, 54, smooth(u, 0, 0.22)), 30, near)
        roll = math.sin(u * 8) * 0.02 + near * 0.05
    elif inC:
        k = smooth(s, 0, 0.8)
        cam.location = V(lerp(3.7, 3.4, k), FOE_Y + lerp(0.05, -2.6, smooth(k, 0.15, 1)), lerp(1.7, 1.4, k))
        aim = V(0, FOE_Y + lerp(0.0, 0.5, k), lerp(1.85, 1.3, k)); vfov = lerp(30, 38, k); roll = -0.03
        if s > 0: cam.location.x += math.sin(t * 80) * 0.03 * (1 - smooth(s, 0, 0.3))
    else:
        k = smooth(t, CUT_D, DURATION)
        cam.location = V(0.8, -1.9, 1.28); aim = V(lerp(-0.15, 0, smooth(k, 0, 1)), FOE_Y, lerp(1.3, 1.0, k)); vfov = lerp(38, 7.5, smooth(k, 0.1, 1)); roll = 0.02
    set_fov(cam, vfov * (1.95 if inA else 1.65) if portrait else vfov)
    look_at(cam, aim, roll)
    cam.data.shift_y = -0.06
    # Focus follows the storytelling subject, never the empty alley or background props.
    focus = S.gun.location + V(0, 0.15, 0.12) if inA else S.bullet.location if inB else V(0, FOE_Y, HEAD_Z if inC else 0.75)
    cam.data.dof.focus_distance = (focus - cam.location).length
    cam.data.dof.aperture_fstop = 1.4 if inA else 2.0 if inB else 1.8 if inC else 3.2
    # veil flash on impact and on the last cut
    vq = max(0.85 * (1 - clamp((t - HIT) / 0.07)) if t >= HIT else 0, 0.9 * (1 - clamp((t - CUT_D) / 0.11)) if t >= CUT_D else 0)
    S.veil.hide_render = vq < 0.01
    S.veil.matrix_parent_inverse = Matrix.Identity(4); S.veil.location = V(0, 0, -0.6)
    S.veil.rotation_euler = (math.radians(90), 0, 0); fade(S.veil, vq)
    # Re-orient billboards after this frame's camera has been set (including cuts).
    for group in (S.mz1, S.mz2, S.hit1, S.hit2):
        face_camera(group, cam, bk if group in (S.mz1, S.mz2) else 0, group.scale.x)
    face_camera(S.shock, cam, 0, S.shock.scale.x); face_camera(S.hring, cam, 0, S.hring.scale.x)
    for puff, _, _ in S.puffs: face_camera(puff, cam, 0, puff.scale.x)
    S.mz2.location = muzzle + (cam.location - muzzle).normalized() * 0.02
    S.hit2.location = S.hit1.location + (cam.location - S.hit1.location).normalized() * 0.02
    # hit marker: four ticks over the target, sized to the screen so it reads at any zoom
    show(S.mark, mk_on)
    if mk_on:
        S.mark.location = V(0, FOE_Y + 0.4, 1.0)
        dist = (cam.location - S.mark.location).length
        face_camera(S.mark, cam, 0, dist * math.tan(math.radians(cam.data.angle_y / math.pi * 180) / 2) * (0.2 + smooth(mk, 0, 0.15) * 0.08) * (1 - smooth(mk, 0.7, 1) * 0.4))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True); ap.add_argument('--frames', default=''); ap.add_argument('--res', default='3840x2160')
    ap.add_argument('--ink', action='store_true', help='Optional comic ink pass; shaded production renders use clean bevels')
    ap.add_argument('--fps', type=int, default=FPS)
    ap.add_argument('--list', default=''); ap.add_argument('--samples', type=int, default=128); ap.add_argument('--portrait', action='store_true')
    a = ap.parse_args(sys.argv[sys.argv.index('--') + 1:])
    w, h = [int(x) for x in a.res.split('x')]
    lib.clear_scene(); setup_render((w, h), a.samples)
    bpy.context.scene.render.use_freestyle = a.ink
    S = make()
    f0, f1 = [int(x) for x in a.frames.split('-')] if a.frames else (0, round(DURATION * SLOW * a.fps) - 1)
    os.makedirs(a.out, exist_ok=True)
    scene = bpy.context.scene
    scene.render.fps = a.fps
    if a.list:
        for f in [int(x) for x in a.list.split(',')]:
            update(S, f / a.fps, a.portrait)
            scene.render.filepath = os.path.join(a.out, f'f{f:04d}.png')
            bpy.ops.render.render(write_still=True)
    else:
        # One animation render keeps the GPU engine alive between frames, avoiding
        # hundreds of shader/scene startups. The scene is still evaluated by time.
        def evaluate_frame(scene): update(S, scene.frame_current / a.fps, a.portrait)
        bpy.app.handlers.frame_change_pre.append(evaluate_frame)
        scene.frame_start, scene.frame_end = f0, f1
        scene.render.filepath = os.path.join(a.out, 'f')
        try: bpy.ops.render.render(animation=True)
        finally: bpy.app.handlers.frame_change_pre.remove(evaluate_frame)
    print('RENDERED', f0, f1)

main()
