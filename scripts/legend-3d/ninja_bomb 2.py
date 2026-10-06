"""NINJA DEFUSE: the bomb. Run: Blender -b -P ninja_bomb.py -- <out dir> [--size 2048]  (helpers and the bake live in ninja_lib.py)"""
import os, sys, math, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ninja_lib as lib
from ninja_lib import *
# ================================================================== the bomb
root = bpy.data.objects.new('bomb', None); sc.collection.objects.link(root); lib.root = root
P, S, F, G = PLACE['paint'], PLACE['steel'], PLACE['fabric'], PLACE['ground']
paint, steel, fabric, ground = [], [], [], []
def add(lst, o): lst.append(o); return o

# shells: lower and upper halves with a dark seam between them, and a raised top plate
add(paint, box('lower', (1.0, .64, .20), (0, 0, .10), P, root, .035, seg=3))
add(paint, box('upper', (.98, .62, .13), (0, 0, .265), P, root, .03, seg=3))
add(paint, box('top', (.90, .56, .035), (0, 0, .345), P, root, .014))
add(steel, box('seam', (1.012, .652, .018), (0, 0, .2), S, root, .004, seg=1))
for sx in (-1, 1):                                    # raised ribs on the ends of the lid
    add(paint, box('rib', (.04, .50, .03), (sx * .46, 0, .37), P, root, .01))
# display bay: a steel frame, a dark glass window and the runtime's screen plane on it
tilt = (math.radians(12), 0, 0)
add(steel, box('bezel', (.55, .30, .06), (-.21, .06, .385), S, root, .014, tilt))
# the window sits on the bezel along the bezel's own tilted normal (a plain offset would let the two planes cross)
glass = box('window', (.45, .22, .03), (-.21, .06 - math.sin(math.radians(12)) * .0245, .385 + math.cos(math.radians(12)) * .0245), FLAT['glass'], root, .006, tilt)
scr = bmesh.new(); vs = [scr.verts.new(v) for v in ((-.215, -.095, 0), (.215, -.095, 0), (.215, .095, 0), (-.215, .095, 0))]
f = scr.faces.new(vs); uv = scr.loops.layers.uv.new()
for lp, c in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))): lp[uv].uv = c
lcd = obj('lcd', scr, FLAT['screen'], glass, (0, 0, .03), smooth=False)
# LED in a steel ring, red and green on the same spot
cyl('led_ring', .034, .034, .02, (.105, .205, .385), S, root, seg=20); steel.append(bpy.data.objects['led_ring'])
for nm, key in (('led', 'led'), ('led_green', 'ledg')):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=.026); obj(nm, bm, FLAT[key], root, (.105, .205, .396))
# keypad: a steel bay and twelve separate keys that can be pressed
add(steel, box('keybay', (.38, .38, .03), (.27, -.02, .357), S, root, .012))
for r in range(4):
    for c in range(3):
        box(f'key_{r}_{c}', (.08, .062, .036), (.165 + c * .105, -.135 + r * .085, .386), FLAT['rubber'], root, .012)
# connector block, power cable conduit and the antenna
add(steel, box('block', (.20, .17, .11), (.37, .20, .40), S, root, .02))
add(steel, cyl('nozzle', .05, .045, .08, (.37, .2, .49), S, root, seg=20))
cyl('antenna', .018, .008, .24, (.40, .2, .62), FLAT['rod'], root, seg=14)
add(steel, cyl('ant_base', .04, .04, .05, (.40, .2, .525), S, root, seg=20))
tube('conduit', bezier(Vector((.30, .20, .44)), Vector((.05, .24, .50)), Vector((-.02, .17, .43))), .028, FLAT['rubber'], 12)
for i, (m, off) in enumerate((('w_red', -.012), ('w_blk', 0), ('w_yel', .012))):
    tube(f'cond_wire{i}', bezier(Vector((.30, .20 + off, .45)), Vector((.05, .24 + off, .53)), Vector((-.01, .17 + off, .45))), .008, FLAT[m], 6)
# straps wrapping over the lid and down the sides, with stitched edges and steel buckle plates
for x in (-.38, .06):
    add(fabric, box('strap', (.10, .67, .35), (x, 0, .175), F, root, .016))
    for sx in (-1, 1): add(fabric, box('stitch', (.012, .672, .352), (x + sx * .042, 0, .175), F, root, .003, seg=1))
    add(steel, box('buckle', (.12, .13, .026), (x, -.12, .372), S, root, .008))
    add(steel, box('buckle_bar', (.014, .13, .034), (x, -.12, .383), S, root, .004, seg=1))
# corner guards: chunky steel angle brackets with bolts
for sx in (-1, 1):
    for sy in (-1, 1):
        add(steel, box('guard', (.13, .13, .34), (sx * .475, sy * .295, .17), S, root, .03, rot=(0, 0, math.radians(0))))
        add(steel, box('guard_cap', (.15, .15, .05), (sx * .475, sy * .295, .335), S, root, .02))
        for bz in (.09, .25): add(steel, cyl('bolt', .018, .018, .016, (sx * .475 + (.068 if sx > 0 else -.068), sy * .295, bz), S, root, rot=(0, math.pi / 2, 0), seg=10))
# front latches and a carry bar
for x in (-.27, .27):
    add(steel, box('latch', (.10, .05, .15), (x, -.335, .2), S, root, .015))
    add(steel, cyl('hinge', .02, .02, .12, (x, -.335, .12), S, root, rot=(0, math.pi / 2, 0), seg=14))
add(steel, cyl('carry', .026, .026, .62, (0, -.42, .12), S, root, rot=(0, math.pi / 2, 0), seg=16))
for x in (-.28, .28): add(steel, box('carry_arm', (.05, .09, .05), (x, -.375, .12), S, root, .012))
# screws: a row along each lid edge, and a few on the faces
for i in range(9):
    for sy in (-.255, .255): add(steel, cyl('screw', .011, .011, .012, (-.42 + i * .105, sy, .366), S, root, seg=10))
for sx, sy in ((-.2, -.1), (.1, -.16), (-.1, .1)): add(steel, cyl('screw', .016, .016, .012, (sx, sy, .366), S, root, seg=10))
# rubber feet and the ground slab with pebbles
for fx in (-.4, .4):
    for fy in (-.25, .25): box('foot', (.1, .1, .03), (fx, fy, .005), FLAT['rubber'], root, .01)
add(ground, box('ground', (5.0, 4.0, .3), (0, 0, -.15), G, None, .02))
import random; random.seed(7)
for i in range(46):
    x, y = random.uniform(-2.2, 2.2), random.uniform(-1.7, 1.7)
    if abs(x) < .75 and abs(y) < .55: continue
    s = random.uniform(.025, .09)
    add(ground, box('pebble', (s * random.uniform(1, 1.8), s * random.uniform(1, 1.6), s * .7), (x, y, s * .3), G, None, s * .3, rot=(0, 0, random.uniform(0, 3))))
# loose wires from the block down to the dirt in front
for i, (m, x0, x1) in enumerate((('w_red', .34, .62), ('w_yel', .36, .74), ('w_blu', .38, .82), ('w_grn', -.46, -.78), ('w_wht', -.44, -.7))):
    side = 1 if x0 > 0 else -1
    tube(f'wire{i}', bezier(Vector((x0, .32 if side > 0 else -.3, .3)), Vector((x1 * 1.05, .18 + i * .1 if side > 0 else -.55, .06)), Vector((x1, .05 + i * .14 if side > 0 else -.45, .014))), .011, FLAT[m], 8)


bake_class('paint', paint, SIZE, .15, .62); bake_class('steel', steel, SIZE // 2, .8, .45); bake_class('fabric', fabric, SIZE // 2, 0.0, .92); bake_class('ground', ground, SIZE // 2, 0.0, .96)


# ================================================================== export
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type in {'MESH', 'EMPTY'}: o.select_set(True)
dst = os.path.join(OUT, 'bomb.glb')
bpy.ops.export_scene.gltf(filepath=dst, export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_cameras=False, export_lights=False,
                          export_image_format='JPEG', export_jpeg_quality=84)
tris = sum(len(p.vertices) - 2 for o in bpy.data.objects if o.type == 'MESH' for p in o.data.polygons)
print('EXPORTED bomb.glb triangles', tris, 'bytes', os.path.getsize(dst))
