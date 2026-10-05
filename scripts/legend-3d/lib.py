"""Shared helpers for the legendary-moment scenes made in Blender (run with: Blender -b -P <scene>.py -- <args>).

Coordinates: X right, Y down the alley (away from the shooter), Z up. Every scene is a function of time `t`; render.py sets the scene
to that time and renders a frame, so any frame can be redone on its own. The look is a cel shade (three bands of light) with Freestyle ink."""
import bpy, bmesh, math, sys
from mathutils import Vector, Euler, Matrix, Quaternion

INK = (0.078, 0.067, 0.059)

def clamp(v, a=0.0, b=1.0): return max(a, min(b, v))
def lerp(a, b, k): return a + (b - a) * k
def smooth(t, a, b):
    k = clamp((t - a) / (b - a)); return k * k * (3 - 2 * k)
def rnd(n):
    x = math.sin(n * 127.1 + 311.7) * 43758.5453; return x - math.floor(x)
def V(x, y, z): return Vector((x, y, z))
def hexrgb(h): return (((h >> 16) & 255) / 255.0, ((h >> 8) & 255) / 255.0, (h & 255) / 255.0)
def srgb_to_lin(c): return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def lin(h):
    r, g, b = hexrgb(h); return (srgb_to_lin(r), srgb_to_lin(g), srgb_to_lin(b), 1.0)

_mats = {}
def toon(color_hex, bands=(0.16, 0.52), rim=False):
    """A three-band cel material: the colour, a cooler darker shade, a brighter light. Cached by colour."""
    key = (color_hex, bands, rim)
    if key in _mats: return _mats[key]
    r, g, b, _ = lin(color_hex)
    dark = (r * 0.22, g * 0.28, min(1, b * 0.40 + 0.008), 1)
    lit = (min(1, r * 1.12 + 0.02), min(1, g * 1.1 + 0.02), min(1, b * 1.04 + 0.01), 1)
    m = bpy.data.materials.new(f'toon{color_hex:06x}'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    d = nt.nodes.new('ShaderNodeBsdfDiffuse'); d.inputs[0].default_value = (1, 1, 1, 1)
    s = nt.nodes.new('ShaderNodeShaderToRGB')
    ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.color_ramp.interpolation = 'EASE'
    el = ramp.color_ramp.elements
    el[0].position = 0.0; el[0].color = dark
    el[1].position = bands[0]; el[1].color = (r, g, b, 1)
    e3 = el.new(bands[1]); e3.color = lit
    em = nt.nodes.new('ShaderNodeEmission'); o = nt.nodes.new('ShaderNodeOutputMaterial')
    lk = nt.links.new
    lk(d.outputs[0], s.inputs[0])
    # use the brightness of the lit result, not its colour
    bw = nt.nodes.new('ShaderNodeRGBToBW'); lk(s.outputs[0], bw.inputs[0]); lk(bw.outputs[0], ramp.inputs[0])
    lk(ramp.outputs[0], em.inputs[0])
    # Keep the illustrated palette, with physical light response on bevels and metal.
    p = nt.nodes.new('ShaderNodeBsdfPrincipled'); p.inputs['Base Color'].default_value = (r, g, b, 1)
    p.inputs['Roughness'].default_value = 0.58
    mix = nt.nodes.new('ShaderNodeMixShader'); mix.inputs[0].default_value = 0.88
    lk(em.outputs[0], mix.inputs[1]); lk(p.outputs[0], mix.inputs[2]); lk(mix.outputs[0], o.inputs[0])
    _mats[key] = m; return m

_flat = {}
def flat(color_hex, alpha=1.0, name=None):
    """Unlit colour (an emission), with a Fac input you can animate for a fade."""
    key = (color_hex, alpha, name)
    if key in _flat: return _flat[key]
    m = bpy.data.materials.new(name or f'flat{color_hex:06x}'); m.use_nodes = True
    nt = m.node_tree; nt.nodes.clear()
    em = nt.nodes.new('ShaderNodeEmission'); em.inputs[0].default_value = lin(color_hex); em.inputs[1].default_value = 1.0
    tr = nt.nodes.new('ShaderNodeBsdfTransparent')
    mx = nt.nodes.new('ShaderNodeMixShader'); mx.name = 'fade'; mx.inputs[0].default_value = 1.0 - alpha
    o = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(em.outputs[0], mx.inputs[1]); nt.links.new(tr.outputs[0], mx.inputs[2]); nt.links.new(mx.outputs[0], o.inputs[0])
    m.surface_render_method = 'BLENDED' if hasattr(m, 'surface_render_method') else None
    _flat[key] = m; return m

def fade(obj, alpha):
    """Set how opaque a flat() object is (1 = solid)."""
    m = obj.active_material or obj.data.materials[0]
    m.node_tree.nodes['fade'].inputs[0].default_value = 1.0 - alpha

INK_COLL = None
def link(o, parent=None, ink=None):
    """Link into the scene. Toon-shaded things go in the 'ink' collection, which is the only thing Freestyle outlines."""
    global INK_COLL
    if ink is None: ink = bool(o.data and getattr(o.data, 'materials', None) and len(o.data.materials) and o.data.materials[0].name.startswith('toon'))
    if ink and INK_COLL is not None: INK_COLL.objects.link(o)
    else: bpy.context.scene.collection.objects.link(o)
    if parent is not None: o.parent = parent
    return o

def mesh_obj(name, bm, mat, parent=None, loc=(0, 0, 0)):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    if mat is not None: me.materials.append(mat)
    o.location = loc
    return link(o, parent)

def _bevel(o, width, segs=2):
    if width <= 0: return
    b = o.modifiers.new('bev', 'BEVEL'); b.width = width; b.segments = segs; b.limit_method = 'ANGLE'; b.harden_normals = True
    n = o.modifiers.new('weighted face normals', 'WEIGHTED_NORMAL'); n.keep_sharp = True; n.weight = 50
    for p in o.data.polygons: p.use_smooth = True

def box(name, size, loc, mat, parent=None, bevel=0.015):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    o = mesh_obj(name, bm, mat, parent, loc); _bevel(o, bevel); return o

def tapered(name, bottom, top, height, loc, mat, parent=None, bevel=0.025):
    """A bevelled tapered solid: shoulders and limbs have a human silhouette."""
    bm = bmesh.new()
    low = [bm.verts.new((x * bottom[0] / 2, y * bottom[1] / 2, -height / 2)) for x, y in ((-1,-1),(1,-1),(1,1),(-1,1))]
    high = [bm.verts.new((x * top[0] / 2, y * top[1] / 2, height / 2)) for x, y in ((-1,-1),(1,-1),(1,1),(-1,1))]
    bm.faces.new(tuple(reversed(low))); bm.faces.new(high)
    for i in range(4): bm.faces.new((low[i], low[(i+1)%4], high[(i+1)%4], high[i]))
    o = mesh_obj(name, bm, mat, parent, loc); _bevel(o, bevel, 3); return o

def cyl(name, r1, r2, length, loc, mat, parent=None, axis='Y', seg=20, bevel=0.0):
    """A cone/cylinder lying along `axis` (default Y, the way barrels point), centred."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2, depth=length)
    o = mesh_obj(name, bm, mat, parent, loc)
    if axis == 'Y': o.rotation_euler = (math.pi / 2, 0, 0)
    elif axis == 'X': o.rotation_euler = (0, math.pi / 2, 0)
    for p in o.data.polygons: p.use_smooth = True
    return o

def sphere(name, r, loc, mat, parent=None, seg=24, scale=(1, 1, 1)):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(8, seg // 2), radius=r)
    o = mesh_obj(name, bm, mat, parent, loc); o.scale = scale
    for p in o.data.polygons: p.use_smooth = True
    return o

def star(name, points, outer, inner, mat, parent=None):
    """A flat spiky star in the XZ plane (faces -Y, towards a camera looking down +Y)."""
    bm = bmesh.new(); vs = []
    for i in range(points * 2):
        a = i / (points * 2) * math.tau; r = outer if i % 2 == 0 else inner
        vs.append(bm.verts.new((math.cos(a) * r, 0, math.sin(a) * r)))
    c = bm.verts.new((0, 0, 0))
    for i in range(len(vs)): bm.faces.new((c, vs[(i + 1) % len(vs)], vs[i]))
    return mesh_obj(name, bm, mat, parent)

def ring(name, inner, mat, parent=None, seg=40):
    bm = bmesh.new(); bmesh.ops.create_circle(bm, segments=seg, radius=1.0)
    o = mesh_obj(name, bm, mat, parent)
    bm2 = bmesh.new(); bm2.from_mesh(o.data)
    bmesh.ops.delete(bm2, geom=list(bm2.faces), context='FACES_ONLY') if False else None
    bm2.free()
    # a circle outline as a thin torus-like band: scale a flat annulus
    o.data.clear_geometry(); b = bmesh.new()
    for i in range(seg):
        a0, a1 = i / seg * math.tau, (i + 1) / seg * math.tau
        vv = [b.verts.new((math.cos(a) * r, 0, math.sin(a) * r)) for a, r in ((a0, 1), (a1, 1), (a1, inner), (a0, inner))]
        b.faces.new(vv)
    b.to_mesh(o.data); b.free(); return o

def place_between(o, a, b, thick=None):
    """Orient a unit-height (along Z) object so it spans from point a to point b."""
    d = b - a; L = d.length
    o.location = (a + b) / 2
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    s = o.scale; o.scale = (s.x if thick is None else thick, s.y if thick is None else thick, L)

def look_at(obj, target, roll=0.0):
    d = (target - obj.location)
    q = d.to_track_quat('-Z', 'Y'); obj.rotation_mode = 'QUATERNION'; obj.rotation_quaternion = q
    if roll: obj.rotation_quaternion = q @ Quaternion((0, 0, 1), roll)

def set_fov(cam, fov_deg_vertical):
    cam.data.sensor_fit = 'VERTICAL'; cam.data.sensor_height = 24.0
    cam.data.lens = 12.0 / math.tan(math.radians(fov_deg_vertical) / 2)

def setup_render(res=(1280, 720), samples=128, ink=1.25):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE'
    sc.render.resolution_x, sc.render.resolution_y = res; sc.render.resolution_percentage = 100
    sc.eevee.taa_render_samples = samples
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
    sc.render.use_freestyle = True
    sc.render.line_thickness_mode = 'ABSOLUTE'; sc.render.line_thickness = ink * (res[1] / 720.0)
    vl = sc.view_layers[0]; vl.use_freestyle = True
    fs = vl.freestyle_settings; fs.crease_angle = math.radians(95)
    if not fs.linesets: fs.linesets.new('ink')
    ls = fs.linesets[0]
    ls.select_by_visibility = True; ls.select_by_edge_types = True; ls.visibility = 'VISIBLE'
    ls.select_silhouette = True; ls.select_border = True; ls.select_crease = True
    global INK_COLL
    INK_COLL = bpy.data.collections.new('ink'); sc.collection.children.link(INK_COLL)
    ls.select_by_collection = True; ls.collection = INK_COLL
    st = bpy.data.linestyles.new('ink'); st.color = INK; st.thickness = 1.0
    sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGB'
    sc.render.image_settings.compression = 15
    sc.render.film_transparent = False
    sc.render.compositor_device = 'GPU'
    sc.render.compositor_denoise_device = 'GPU'; ls.linestyle = st
    grade = bpy.data.node_groups.new('cinematic grade', 'CompositorNodeTree')
    grade.interface.new_socket(name='Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    sc.compositing_node_group = grade
    n, l = grade.nodes, grade.links.new
    image = n.new('CompositorNodeRLayers')
    denoise = n.new('CompositorNodeDenoise'); l(image.outputs['Image'], denoise.inputs['Image'])
    mask = n.new('CompositorNodeEllipseMask')
    mask.inputs['Position'].default_value = (0.50, 0.53)
    mask.inputs['Size'].default_value = (0.94, 0.90)
    blur = n.new('CompositorNodeBlur'); blur.inputs['Separable'].default_value = True; blur.inputs['Size'].default_value = (res[0] * 0.16, res[1] * 0.16)
    l(mask.outputs['Mask'], blur.inputs['Image'])
    level = n.new('ShaderNodeMath'); level.operation = 'MULTIPLY_ADD'
    level.inputs[1].default_value = 0.62; level.inputs[2].default_value = 0.38
    l(blur.outputs['Image'], level.inputs[0])
    multiply = n.new('ShaderNodeMix'); multiply.data_type = 'RGBA'; multiply.blend_type = 'MULTIPLY'
    multiply.inputs[0].default_value = 1.0
    glow = n.new('CompositorNodeGlare')
    glow.inputs['Type'].default_value = 'Fog Glow'; glow.inputs['Quality'].default_value = 'High'
    glow.inputs['Threshold'].default_value = 1.5; glow.inputs['Strength'].default_value = 0.35; glow.inputs['Size'].default_value = 0.25
    l(denoise.outputs['Image'], glow.inputs['Image'])
    l(glow.outputs['Image'], multiply.inputs[6]); l(level.outputs[0], multiply.inputs[7])
    output = n.new('NodeGroupOutput'); l(multiply.outputs[2], output.inputs['Image'])
    return sc

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for coll in (bpy.data.materials, bpy.data.meshes, bpy.data.objects): pass

def show(o, on):
    """Show or hide an object and everything parented under it (hiding an empty does not hide its children)."""
    for c in [o] + list(o.children_recursive): c.hide_render = not on
