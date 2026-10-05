"""Shared helpers for the NINJA DEFUSE assets: the bomb, modelled and surface-baked in Blender, exported as GLB for three.js (nothing here is rendered to video).
Run: Blender -b -P ninja_bomb.py -- <out dir> [--size 2048]
Z up here; the glTF export turns it into Y up. Parts the runtime drives keep their names: lcd, led, led_green, key_<row>_<col>, antenna.
Each material class (painted case, steel, fabric, ground) is joined into one mesh, unwrapped, and its procedural look (wear on the edges,
scratches, grime in the crevices) is baked into a texture, so the GLB is plain PBR with no node tricks."""
import bpy, bmesh, math, os, sys
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else '/tmp/ninja'
SIZE = int(argv[argv.index('--size') + 1]) if '--size' in argv else 2048
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
root = None   # set by the scene script: the empty the baked meshes are parented to

def lin(h):
    f = lambda c: c / 12.92 if c <= .04045 else ((c + .055) / 1.055) ** 2.4
    return (f(((h >> 16) & 255) / 255), f(((h >> 8) & 255) / 255), f((h & 255) / 255), 1.0)

def flat_mat(name, hexc, rough=.7, metal=0.0, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = lin(hexc)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if emit: b.inputs['Emission Color'].default_value = lin(hexc); b.inputs['Emission Strength'].default_value = emit
    return m

PLACE = {k: flat_mat(k, 0x808080) for k in ('paint', 'steel', 'fabric', 'ground')}   # replaced by baked materials below
FLAT = dict(glass=flat_mat('glass', 0x05070a, .12, .0), rubber=flat_mat('rubber', 0x1b1d1e, .62), led=flat_mat('led', 0xff2a1a, .4, 0, 4.0),
            ledg=flat_mat('led_green', 0x2bff6a, .4, 0, 4.0), rod=flat_mat('rod', 0x0b0c0d, .5, .2), screen=flat_mat('lcd', 0x0b0d0e, .3),
            w_red=flat_mat('w_red', 0xb3261e, .55), w_yel=flat_mat('w_yel', 0xd1a21f, .55), w_blu=flat_mat('w_blu', 0x2f5fa8, .55),
            w_grn=flat_mat('w_grn', 0x2f8a3d, .55), w_wht=flat_mat('w_wht', 0xc2c2ba, .55), w_blk=flat_mat('w_blk', 0x101112, .5))

def obj(name, bm, m, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), smooth=True):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); me.materials.append(m)
    for p in me.polygons: p.use_smooth = smooth
    o = bpy.data.objects.new(name, me); o.location = loc; o.rotation_euler = rot
    sc.collection.objects.link(o)
    if parent: o.parent = parent
    return o

def box(name, size, loc, m, parent=None, bevel=.014, rot=(0, 0, 0), seg=2):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0); bmesh.ops.scale(bm, vec=Vector(size), verts=bm.verts)
    if bevel > 0: bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=seg, affect='EDGES', profile=.7)
    return obj(name, bm, m, parent, loc, rot)

def cyl(name, r1, r2, depth, loc, m, parent=None, rot=(0, 0, 0), seg=16, caps=True):
    bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=caps, segments=seg, radius1=r1, radius2=r2, depth=depth)
    return obj(name, bm, m, parent, loc, rot)

def tube(name, pts, r, m, sides=8):
    bm = bmesh.new(); rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        a = Vector((0, 0, 1)) if abs(t.z) < .9 else Vector((1, 0, 0)); u = t.cross(a).normalized(); v = t.cross(u).normalized()
        rings.append([bm.verts.new(p + (u * math.cos(k / sides * math.tau) + v * math.sin(k / sides * math.tau)) * r) for k in range(sides)])
    for i in range(len(rings) - 1):
        for k in range(sides): bm.faces.new((rings[i][k], rings[i][(k + 1) % sides], rings[i + 1][(k + 1) % sides], rings[i + 1][k]))
    return obj(name, bm, m)

def bezier(p0, p1, p2, n=12): return [p0 * (1 - t) ** 2 + p1 * 2 * t * (1 - t) + p2 * t * t for t in [i / (n - 1) for i in range(n)]]


# ================================================================== baking
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24; sc.cycles.use_denoising = False
sc.render.bake.margin = 10; sc.render.bake.use_clear = True

def look(m, kind):
    """The procedural surface for a material class: colour and roughness, driven by edge pointiness, a thin scratch pattern, noise and AO."""
    nt = m.node_tree; nt.nodes.clear(); L = nt.links.new
    n = lambda t: nt.nodes.new(t)
    geo = n('ShaderNodeNewGeometry'); tc = n('ShaderNodeTexCoord')
    def ramp(a, b, src, ca=(0, 0, 0, 1), cb=(1, 1, 1, 1)):
        r = n('ShaderNodeValToRGB'); r.color_ramp.elements[0].position = a; r.color_ramp.elements[0].color = ca; r.color_ramp.elements[1].position = b; r.color_ramp.elements[1].color = cb
        L(src, r.inputs[0]); return r.outputs[0]
    def noise(scale, detail=6, rough=.6):
        t = n('ShaderNodeTexNoise'); t.inputs['Scale'].default_value = scale; t.inputs['Detail'].default_value = detail; t.inputs['Roughness'].default_value = rough
        L(tc.outputs['Object'], t.inputs['Vector']); return t.outputs['Fac']
    def mix(fac, a, b):
        x = n('ShaderNodeMix'); x.data_type = 'RGBA'; L(fac, x.inputs['Factor']); L(a, x.inputs['A']) if not isinstance(a, tuple) else setattr(x.inputs['A'], 'default_value', a)
        L(b, x.inputs['B']) if not isinstance(b, tuple) else setattr(x.inputs['B'], 'default_value', b); return x.outputs['Result']
    def val_mix(fac, a, b):
        x = n('ShaderNodeMix'); x.data_type = 'FLOAT'; L(fac, x.inputs['Factor']); x.inputs['A'].default_value = a; x.inputs['B'].default_value = b; return x.outputs['Result']
    ao = n('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value = .12; ao.samples = 8
    # edges: how far the bevel-smoothed normal departs from the face normal (per pixel, so it works on low-poly faces)
    bev = n('ShaderNodeBevel'); bev.inputs['Radius'].default_value = .025; bev.samples = 10
    dot = n('ShaderNodeVectorMath'); dot.operation = 'DOT_PRODUCT'; L(bev.outputs['Normal'], dot.inputs[0]); L(geo.outputs['Normal'], dot.inputs[1])
    inv = n('ShaderNodeMath'); inv.operation = 'SUBTRACT'; inv.inputs[0].default_value = 1.0; L(dot.outputs['Value'], inv.inputs[1])
    edge = ramp(.004, .05, inv.outputs[0])
    # scratches: long thin streaks (a stretched voronoi edge), kept to patches by a low-frequency noise so they do not read as cells
    stretch = n('ShaderNodeVectorMath'); stretch.operation = 'MULTIPLY'; stretch.inputs[1].default_value = (46, 5, 46); L(tc.outputs['Object'], stretch.inputs[0])
    scr = n('ShaderNodeTexVoronoi'); scr.feature = 'DISTANCE_TO_EDGE'; scr.inputs['Scale'].default_value = 1.0; L(stretch.outputs[0], scr.inputs['Vector'])
    thin = ramp(.0, .03, scr.outputs['Distance'], (1, 1, 1, 1), (0, 0, 0, 1)); patch = ramp(.56, .64, noise(4.5, 3, .5))
    sm = n('ShaderNodeMath'); sm.operation = 'MULTIPLY'; L(thin, sm.inputs[0]); L(patch, sm.inputs[1]); scratch = sm.outputs[0]
    chip = ramp(.62, .66, noise(18, 8, .7)); grime = ramp(.3, .75, noise(3.2, 5, .7)); fine = noise(80, 2, .5)
    def e_wear():
        r = n('ShaderNodeMath'); r.operation = 'MULTIPLY'; L(edge, r.inputs[0]); r.inputs[1].default_value = .55; return r.outputs[0]
    if kind == 'paint':
        base = mix(grime, lin(0x4d5340), lin(0x394029)); metal = lin(0x8a8f92)
        wear = n('ShaderNodeMath'); wear.operation = 'MAXIMUM'; L(edge, wear.inputs[0]); L(chip, wear.inputs[1])
        wear2 = n('ShaderNodeMath'); wear2.operation = 'MAXIMUM'; L(wear.outputs[0], wear2.inputs[0]); wear2.inputs[1].default_value = 0.0
        sw = n('ShaderNodeMath'); sw.operation = 'MULTIPLY'; L(scratch, sw.inputs[0]); sw.inputs[1].default_value = .8
        wmax = n('ShaderNodeMath'); wmax.operation = 'MAXIMUM'; L(wear2.outputs[0], wmax.inputs[0]); L(sw.outputs[0], wmax.inputs[1])
        col = mix(wmax.outputs[0], base, metal); rough = val_mix(wmax.outputs[0], .78, .42)
    elif kind == 'steel':
        base = mix(grime, lin(0x4a4d50), lin(0x2c2e30)); hi = lin(0x9ea3a6)
        e2 = n('ShaderNodeMath'); e2.operation = 'MAXIMUM'; L(edge, e2.inputs[0]); L(scratch, e2.inputs[1])
        col = mix(e2.outputs[0], base, hi); rough = val_mix(e2.outputs[0], .5, .32)
    elif kind in ('fabric', 'glove'):
        wv = n('ShaderNodeTexWave'); wv.inputs['Scale'].default_value = 90; wv.inputs['Distortion'].default_value = 2; L(tc.outputs['Object'], wv.inputs['Vector'])
        wv2 = n('ShaderNodeTexWave'); wv2.wave_profile = 'SIN'; wv2.rings_direction = 'Z'; wv2.inputs['Scale'].default_value = 90; L(tc.outputs['Object'], wv2.inputs['Vector'])
        weave = n('ShaderNodeMath'); weave.operation = 'MULTIPLY'; L(wv.outputs['Fac'], weave.inputs[0]); L(wv2.outputs['Fac'], weave.inputs[1])
        dark, light = (lin(0x131415), lin(0x2a2b2e)) if kind == 'glove' else (lin(0x0b0c0d), lin(0x1e2021))
        col = mix(weave.outputs[0], dark, light); col = mix(grime, col, lin(0x34312c)); col = mix(e_wear(), col, lin(0x4a4a4c)) if kind == 'glove' else col; rough = val_mix(grime, .9, .96)
    else:   # ground: dusty concrete
        base = mix(grime, lin(0x4a4034), lin(0x2a241d)); fine_c = mix(ramp(.45, .6, fine), base, lin(0x5d5143))
        col = mix(ramp(.7, .74, noise(7, 8, .65)), fine_c, lin(0x1d1914)); rough = val_mix(grime, .93, .98)
    # darken the crevices
    ao_f = n('ShaderNodeMix'); ao_f.data_type = 'RGBA'; L(ao.outputs['AO'], ao_f.inputs['Factor']); ao_f.inputs['A'].default_value = (.25, .25, .25, 1); ao_f.inputs['B'].default_value = (1, 1, 1, 1)
    out_c = n('ShaderNodeMix'); out_c.data_type = 'RGBA'; out_c.blend_type = 'MULTIPLY'; out_c.inputs['Factor'].default_value = 1.0; L(col, out_c.inputs['A']); L(ao_f.outputs['Result'], out_c.inputs['B'])
    pb = n('ShaderNodeBsdfPrincipled'); L(out_c.outputs['Result'], pb.inputs['Base Color']); L(rough, pb.inputs['Roughness'])
    o = n('ShaderNodeOutputMaterial'); L(pb.outputs[0], o.inputs[0])
    return out_c.outputs['Result'], rough

def bake_class(kind, objs, size, metallic, rough):
    """Join the parts, unwrap, bake colour and roughness to images, and hand back one mesh with a plain PBR material that uses them."""
    for o in objs:
        for md in list(o.modifiers): pass
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join(); ob = bpy.context.view_layer.objects.active; ob.name = kind; ob.parent = root if kind != 'ground' else None
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(62), island_margin=.004); bpy.ops.object.mode_set(mode='OBJECT')
    mat = bpy.data.materials.new(kind + '_bake'); mat.use_nodes = True; ob.data.materials.clear(); ob.data.materials.append(mat)
    look(mat, kind)
    imgs = {}
    for what in ('COLOR',):
        im = bpy.data.images.new(f'{kind}_{what.lower()}', size, size, alpha=False); im.colorspace_settings.name = 'sRGB' if what == 'COLOR' else 'Non-Color'
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = im; mat.node_tree.nodes.active = tex
        bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
        if what == 'COLOR': bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, margin=10)
        else: bpy.ops.object.bake(type='ROUGHNESS', margin=10)
        imgs[what] = im; mat.node_tree.nodes.remove(tex)
    # the final, plain material
    fin = bpy.data.materials.new(kind); fin.use_nodes = True; nt = fin.node_tree; b = nt.nodes['Principled BSDF']
    t1 = nt.nodes.new('ShaderNodeTexImage'); t1.image = imgs['COLOR']; nt.links.new(t1.outputs[0], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metallic
    ob.data.materials.clear(); ob.data.materials.append(fin)
    return ob

