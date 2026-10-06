"""Builds the 1v5 CLUTCH highlight's environment and exports it as GLB for the game:

    Blender -b -P scripts/legend-3d/clutch_assets.py -- <out dir>

  The survivor and the five enemies are the operator from the no-scope kit (public/assets/highlights/noscope/kit.glb), so no character is made here.
  arena.glb    the whole environment: a floor, a back wall with a wide opening, two side structures, two pillars and a painted line. Seven or eight
               large pieces in three meshes (`ground`, `wall`, `trim`). Material colours are re-set by the game; the glTF colours are placeholders.

Authored facing -Y in Blender (that is +Z in glTF); the arena runs toward +Y (-Z in glTF). Metres. Fixed values, so the same command makes the same files.
"""
import bpy, math, os, sys
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def material(name, colour, rough=.7, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = colour; b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    return m

def select_only(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o

def box(loc, size, mat, rot=(0, 0, 0), bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object; o.scale = size; o.rotation_euler = rot; select_only(o)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        m = o.modifiers.new('b', 'BEVEL'); m.width = bevel; m.segments = 1; m.limit_method = 'ANGLE'
        select_only(o); bpy.ops.object.modifier_apply(modifier='b')
    o.data.materials.append(mat); return o

def sphere(loc, size, mat, seg=10, rings=7):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=loc)
    o = bpy.context.active_object; o.scale = size; select_only(o); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.shade_smooth(); o.data.materials.append(mat); return o

def limb(a, b, ra, rb, mat, seg=8):
    """A tapered cylinder from point a to point b."""
    a, b = Vector(a), Vector(b); d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=seg, radius1=ra, radius2=rb, depth=d.length, location=(a + b) / 2)
    o = bpy.context.active_object
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = d.to_track_quat('Z', 'Y')   # the cone's axis (Z) along the limb
    select_only(o); bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    bpy.ops.object.shade_smooth(); o.data.materials.append(mat); return o

def join(parts, name, pivot):
    select_only(parts[0])
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.active_object; o.name = name; o.data.name = name
    scene.cursor.location = pivot; select_only(o); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return o

def export(path, sel):
    bpy.ops.object.select_all(action='DESELECT')
    for o in sel: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_apply=True, export_yup=True)

def join(parts, name, pivot):
    select_only(parts[0])
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    o = bpy.context.active_object; o.name = name; o.data.name = name
    scene.cursor.location = pivot; select_only(o); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return o

# ---------------------------------------------------------------- the arena
GROUND = material('ground', (.11, .105, .1, 1), .95)
WALL = material('wall', (.1, .095, .09, 1), .9)
TRIM = material('trim', (.16, .14, .12, 1), .8)

ground = [box((0, 18, -.25), (60, 80, .5), GROUND, bevel=0)]
ground.append(box((0, 8, .002), (14, .12, .004), TRIM, bevel=0))   # a faint painted line across the floor
wall = [
    box((-11, 24, 4.5), (14, 1.6, 9), WALL, bevel=.03), box((11, 24, 4.5), (14, 1.6, 9), WALL, bevel=.03),     # the back wall, either side of the opening
    box((0, 24, 7.3), (8, 1.6, 3.4), WALL, bevel=.03),                                                         # the lintel
    box((-13.5, 11, 3.3), (7, 12, 6.6), WALL, rot=(0, 0, math.radians(-4)), bevel=.03),                         # the two side structures
    box((13.5, 10, 2.6), (7, 14, 5.2), WALL, rot=(0, 0, math.radians(5)), bevel=.03),
]
trim = [
    box((-4.7, 22.9, 3.2), (.9, .9, 6.4), TRIM, bevel=.02), box((4.7, 22.9, 3.2), (.9, .9, 6.4), TRIM, bevel=.02),   # the pillars at the opening
    box((-9.8, 11, 6.7), (.5, 11.5, .5), TRIM, bevel=.02), box((10.1, 10, 5.3), (.5, 13, .5), TRIM, bevel=.02),
]
ground = join(ground, 'ground', (0, 0, 0)); wall = join(wall, 'wall', (0, 0, 0)); trim = join(trim, 'trim', (0, 0, 0))
export(os.path.join(OUT, 'arena.glb'), [ground, wall, trim])
print('arena: ~', sum(len(o.data.polygons) for o in (ground, wall, trim)), 'polygons')

