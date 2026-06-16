"""
Render high-fidelity 360° interiors per PLAN (A/B/C) from blender/plans.json.
For each plan we render two viewpoints (LDK + bedroom) in both DAY and NIGHT,
so every available unit of that plan gets a rich, lived-in walkthrough that
holds up when you drag to look around.

Outputs: public/panoramas/<plan>_<room>_<time>.jpg  (e.g. A_ldk_night.jpg)
Also writes src/data/viewpoints.json (camera positions + file paths) for the site.

Usage:
  blender -b --python render_interiors.py                       # all: 3x2x2 = 12
  blender -b --python render_interiors.py -- A ldk night 1280 48   # test subset
  (args: plansCSV roomsCSV timesCSV resX samples ; resY = resX/2)
"""
import bpy, bmesh, json, math, os, sys, random
import mathutils
from mathutils import Vector

ROOT = "C:/Users/user/Desktop/lumiere-residences"
DATA = json.load(open(ROOT + "/blender/plans.json", encoding="utf-8"))
OUT = ROOT + "/public/panoramas"
VP_JSON = ROOT + "/src/data/viewpoints.json"
os.makedirs(OUT, exist_ok=True)

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ONLY_PLANS = argv[0].split(",") if len(argv) > 0 and argv[0] else ["A", "B", "C"]
ONLY_ROOMS = argv[1].split(",") if len(argv) > 1 and argv[1] else ["ldk", "bed"]
ONLY_TIMES = argv[2].split(",") if len(argv) > 2 and argv[2] else ["night", "day"]
RESX = int(argv[3]) if len(argv) > 3 else 4096
SAMPLES = int(argv[4]) if len(argv) > 4 else 256

WALL_T = 0.11
DOOR_H = 2.12
TIME = "night"  # set per render; gates night-only practical lights

def s2l(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def col(h):
    h = h.lstrip("#")
    return tuple(s2l(int(h[i:i+2], 16) / 255) for i in (0, 2, 4))

# ------------------------------------------------------------------ materials
def mat(name, base, rough=0.6, metal=0.0, emis=None, estr=1.0, transmission=0.0, ior=1.45,
        coat=0.0, coat_r=0.1):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*base, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    for k in ("Transmission Weight", "Transmission"):
        if k in b.inputs:
            b.inputs[k].default_value = transmission; break
    if "IOR" in b.inputs:
        b.inputs["IOR"].default_value = ior
    if coat > 0:
        if "Coat Weight" in b.inputs:
            b.inputs["Coat Weight"].default_value = coat
        if "Coat Roughness" in b.inputs:
            b.inputs["Coat Roughness"].default_value = coat_r
    if emis is not None:
        if "Emission Color" in b.inputs:
            b.inputs["Emission Color"].default_value = (*emis, 1)
        if "Emission Strength" in b.inputs:
            b.inputs["Emission Strength"].default_value = estr
    return m

def add_detail(m, lo=0.45, hi=0.8, scale=14.0):
    """Vary roughness with procedural noise so surfaces aren't plastic-flat."""
    try:
        nt = m.node_tree
        b = nt.nodes.get("Principled BSDF")
        tex = nt.nodes.new("ShaderNodeTexNoise")
        tex.inputs["Scale"].default_value = scale
        if "Detail" in tex.inputs:
            tex.inputs["Detail"].default_value = 4.0
        mr = nt.nodes.new("ShaderNodeMapRange")
        mr.inputs["To Min"].default_value = lo
        mr.inputs["To Max"].default_value = hi
        nt.links.new(tex.outputs["Fac"], mr.inputs["Value"])
        nt.links.new(mr.outputs["Result"], b.inputs["Roughness"])
    except Exception as ex:
        print("detail err", ex)
    return m

def add_color_var(m, scale=8.0, lo=0.88, hi=1.1, detail=6.0):
    """Tint the flat base colour with procedural noise → kills the plastic look."""
    try:
        nt = m.node_tree; b = nt.nodes.get("Principled BSDF")
        base = list(b.inputs["Base Color"].default_value)
        n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = scale
        if "Detail" in n.inputs: n.inputs["Detail"].default_value = detail
        cr = nt.nodes.new("ShaderNodeValToRGB")
        cr.color_ramp.elements[0].color = (base[0]*lo, base[1]*lo, base[2]*lo, 1)
        cr.color_ramp.elements[1].color = (min(1, base[0]*hi), min(1, base[1]*hi), min(1, base[2]*hi), 1)
        nt.links.new(n.outputs["Fac"], cr.inputs["Fac"])
        nt.links.new(cr.outputs["Color"], b.inputs["Base Color"])
    except Exception as ex:
        print("colvar err", ex)
    return m

def add_bump(m, scale=40.0, strength=0.1, detail=6.0):
    """Micro surface relief so flat planes catch grazing light."""
    try:
        nt = m.node_tree; b = nt.nodes.get("Principled BSDF")
        n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = scale
        if "Detail" in n.inputs: n.inputs["Detail"].default_value = detail
        bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = strength
        nt.links.new(n.outputs["Fac"], bp.inputs["Height"])
        nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    except Exception as ex:
        print("bump err", ex)
    return m

def wood_mat(name, base, rough=0.45, coat=0.0):
    m = mat(name, base, rough, 0.0, coat=coat)
    try:
        nt = m.node_tree; b = nt.nodes.get("Principled BSDF")
        wave = nt.nodes.new("ShaderNodeTexWave"); wave.wave_type = "BANDS"
        try: wave.bands_direction = "Y"
        except Exception: pass
        wave.inputs["Scale"].default_value = 1.6
        wave.inputs["Distortion"].default_value = 7.0
        if "Detail" in wave.inputs: wave.inputs["Detail"].default_value = 3.0
        cr = nt.nodes.new("ShaderNodeValToRGB")
        cr.color_ramp.elements[0].color = (base[0]*0.68, base[1]*0.68, base[2]*0.68, 1)
        cr.color_ramp.elements[1].color = (min(1, base[0]*1.12), min(1, base[1]*1.12), min(1, base[2]*1.12), 1)
        nt.links.new(wave.outputs["Fac"], cr.inputs["Fac"])
        nt.links.new(cr.outputs["Color"], b.inputs["Base Color"])
        bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.16
        nt.links.new(wave.outputs["Fac"], bp.inputs["Height"])
        nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    except Exception as ex:
        print("wood err", ex); add_color_var(m); add_bump(m, strength=0.12)
    return m

def marble_mat(name, base, rough=0.1, coat=0.3):
    m = mat(name, base, rough, 0.0, coat=coat)
    try:
        nt = m.node_tree; b = nt.nodes.get("Principled BSDF")
        n = nt.nodes.new("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = 3.0
        if "Detail" in n.inputs: n.inputs["Detail"].default_value = 9.0
        cr = nt.nodes.new("ShaderNodeValToRGB")
        e0 = cr.color_ramp.elements[0]; e1 = cr.color_ramp.elements[1]
        e0.position = 0.40; e0.color = (min(1, base[0]*1.02), min(1, base[1]*1.02), min(1, base[2]*1.02), 1)
        e1.position = 0.52; e1.color = (base[0]*0.6, base[1]*0.6, base[2]*0.62, 1)
        nt.links.new(n.outputs["Fac"], cr.inputs["Fac"])
        nt.links.new(cr.outputs["Color"], b.inputs["Base Color"])
        bp = nt.nodes.new("ShaderNodeBump"); bp.inputs["Strength"].default_value = 0.03
        nt.links.new(n.outputs["Fac"], bp.inputs["Height"])
        nt.links.new(bp.outputs["Normal"], b.inputs["Normal"])
    except Exception as ex:
        print("marble err", ex); add_color_var(m, scale=4)
    return m

def fab(name, color, rough=0.95):
    """Cloth: roughness + colour variation + woven micro-bump."""
    m = mat(name, color, rough)
    add_detail(m, 0.85, 1.0, 40); add_color_var(m, 55, 0.9, 1.08, 4); add_bump(m, 130, 0.4, 4)
    return m

def plaster(name, color, rough=0.88):
    m = mat(name, color, rough)
    add_color_var(m, 5, 0.97, 1.03, 3); add_bump(m, 45, 0.04, 4)
    return m

# ------------------------------------------------------------------ geometry helpers
def _bevel(o, w=0.012, seg=2):
    if o.type != "MESH":
        return
    md = o.modifiers.new("bvl", "BEVEL")
    md.width = w; md.segments = seg; md.limit_method = "ANGLE"; md.angle_limit = math.radians(50)

def cube(size, loc, material, parent=None, rot=0.0, bevel=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    o = bpy.context.active_object
    o.scale = size
    o.location = loc
    if rot:
        o.rotation_euler = (0, 0, rot)
    if material:
        o.data.materials.append(material)
    if parent:
        o.parent = parent
        o.matrix_parent_inverse = mathutils.Matrix()
    if bevel if bevel is not None else (parent is not None):
        _bevel(o)
    return o

def rounded_box(size, loc, material, parent=None, rot=0.0, bw=0.07, bseg=4, sub=1):
    """A cube softened with bevel + subdivision → plump cushion / upholstery."""
    o = cube(size, loc, material, parent, rot=rot, bevel=False)
    try:
        m1 = o.modifiers.new("rb", "BEVEL"); m1.width = bw; m1.segments = bseg
        m1.limit_method = "ANGLE"; m1.angle_limit = math.radians(60)
        if sub > 0:
            m2 = o.modifiers.new("ss", "SUBSURF"); m2.levels = sub; m2.render_levels = sub
        bpy.ops.object.shade_smooth()
    except Exception as ex:
        print("rbox err", ex)
    return o

def cyl(r, h, loc, material, parent=None, verts=24, bevel=True):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=verts, location=(0, 0, 0))
    o = bpy.context.active_object
    o.location = loc
    bpy.ops.object.shade_smooth()
    if material:
        o.data.materials.append(material)
    if parent:
        o.parent = parent
        o.matrix_parent_inverse = mathutils.Matrix()
    return o

def sphere(r, loc, material, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(0, 0, 0), segments=24, ring_count=16)
    o = bpy.context.active_object
    o.location = loc
    bpy.ops.object.shade_smooth()
    if material:
        o.data.materials.append(material)
    if parent:
        o.parent = parent
        o.matrix_parent_inverse = mathutils.Matrix()
    return o

def empty(loc, rot):
    e = bpy.data.objects.new("furn", None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.rotation_euler = (0, 0, rot)
    return e

# ------------------------------------------------------------------ furniture (richer)
def f_sofa(e, M, wide):
    w = 2.7 if wide else 2.0
    cube((w, 0.95, 0.18), (0, 0, 0.22), M["fabric_dk"], e)  # plinth base
    n = 3 if wide else 2
    for i in range(n):  # plump seat cushions
        cx = -w/2 + (w/n) * (i + 0.5)
        rounded_box((w/n - 0.06, 0.82, 0.24), (cx, 0.04, 0.46), M["fabric"], e, bw=0.06, sub=1)
    for i in range(n):  # back cushions
        cx = -w/2 + (w/n) * (i + 0.5)
        rounded_box((w/n - 0.08, 0.22, 0.5), (cx, -0.4, 0.64), M["fabric"], e, bw=0.06, sub=1)
    rounded_box((0.24, 0.98, 0.55), (-w/2 + 0.12, 0, 0.5), M["fabric"], e, bw=0.08, sub=1)  # arms
    rounded_box((0.24, 0.98, 0.55), (w/2 - 0.12, 0, 0.5), M["fabric"], e, bw=0.08, sub=1)
    for (x, m, r) in [(-0.7, "throw", 0.3), (-0.15, "fabric_dk", -0.2), (0.45, "throw2", 0.25)]:
        rounded_box((0.42, 0.16, 0.42), (x, -0.22, 0.76), M[m], e, rot=r, bw=0.07, sub=1)
    rounded_box((0.9, 0.5, 0.07), (-w/2 + 0.34, 0.1, 0.62), M["throw"], e, rot=0.2, bw=0.04, sub=0)  # blanket
    if wide:  # chaise
        cube((0.95, 1.5, 0.18), (w/2 + 0.35, 0.45, 0.22), M["fabric_dk"], e)
        rounded_box((0.9, 1.4, 0.24), (w/2 + 0.35, 0.45, 0.46), M["fabric"], e, bw=0.06, sub=1)
    for x in (-w/2 + 0.2, w/2 - 0.2):
        for y in (-0.36, 0.36):
            cyl(0.04, 0.14, (x, y, 0.07), M["gold"], e, verts=10)

def f_coffee(e, M):
    cube((1.15, 0.66, 0.05), (0, 0, 0.36), M["marble"], e)
    cube((1.0, 0.52, 0.3), (0, 0, 0.18), M["gold"], e)
    cube((0.36, 0.26, 0.05), (-0.26, 0.07, 0.42), M["book_b"], e, rot=0.18)
    cube((0.33, 0.23, 0.045), (-0.26, 0.07, 0.47), M["book_c"], e, rot=0.1)
    cube((0.3, 0.2, 0.045), (-0.24, 0.1, 0.52), M["book_a"], e, rot=0.22)
    cyl(0.06, 0.2, (0.33, -0.04, 0.49), M["ceramic"], e)
    cube((0.34, 0.22, 0.02), (0.3, 0.12, 0.4), M["walnut"], e)
    cyl(0.05, 0.07, (0.18, 0.16, 0.43), M["ceramic2"], e, verts=14)  # candle

def f_rug(e, M, s):
    cube((3.2*s, 2.4*s, 0.02), (0, 0, 0.012), M["rug"], e, bevel=False)
    cube((2.5*s, 1.8*s, 0.024), (0, 0, 0.016), M["rug2"], e, bevel=False)

def f_tv(e, M):
    cube((2.0, 0.44, 0.36), (0, 0, 0.2), M["walnut"], e)
    cube((1.4, 0.04, 0.8), (0, 0.02, 0.82), M["screen"], e)
    cube((0.42, 0.16, 0.04), (0, 0.02, 0.4), M["metal_dk"], e)
    cube((0.16, 0.13, 0.24), (0.62, 0.1, 0.5), M["green"], e)
    cube((0.18, 0.16, 0.16), (-0.6, 0.1, 0.46), M["ceramic"], e)

def f_dining(e, M, s):
    cube((1.5*s, 1.0*s, 0.05), (0, 0, 0.74), M["darkwood"], e)
    for sx in (-0.6, 0.6):
        for sy in (-0.4, 0.4):
            cube((0.06, 0.06, 0.74), (sx*s, sy*s, 0.37), M["darkwood"], e)
    for sx in (-0.5, 0.5):
        for sy in (-0.66, 0.66):
            rounded_box((0.44, 0.46, 0.09), (sx*s, sy*s, 0.46), M["fabric"], e, bw=0.04, sub=1)
            rounded_box((0.44, 0.09, 0.52), (sx*s, sy*s + (0.2 if sy > 0 else -0.2), 0.72), M["fabric"], e, bw=0.04, sub=1)
            for lx in (-0.18, 0.18):
                for ly in (-0.18, 0.18):
                    cyl(0.02, 0.46, (sx*s+lx, sy*s+ly, 0.23), M["darkwood"], e, verts=8)
    cyl(0.09, 0.3, (0, 0, 0.92), M["ceramic"], e)
    for a in range(6):
        cube((0.012, 0.012, 0.45), (math.sin(a)*0.05, math.cos(a)*0.05, 1.22), M["plant_stem"], e)
    for d in (-0.42, 0.42):
        cyl(0.13, 0.02, (d, 0, 0.78), M["ceramic2"], e, verts=20)  # plates

def f_island(e, M):
    cube((1.8, 0.9, 0.9), (0, 0, 0.45), M["darkwood"], e)
    cube((1.95, 1.0, 0.06), (0, 0, 0.93), M["marble"], e)
    cyl(0.13, 0.1, (0.5, 0, 1.0), M["ceramic"], e, verts=20)
    for i in range(5):
        sphere(0.05, (0.5+math.sin(i*1.3)*0.06, math.cos(i*1.3)*0.06, 1.07), M["green"], e)
    for bx in (-0.55, -0.2):
        cyl(0.05, 0.6, (bx, 0.55, 1.2), M["gold"], e, verts=8)  # bar stools nearby
        cube((0.34, 0.34, 0.06), (bx, 0.55, 0.62), M["fabric_dk"], e)

def f_kitchen(e, M):
    cube((2.4, 0.62, 0.9), (0, 0, 0.45), M["walnut"], e)
    cube((2.4, 0.64, 0.05), (0, 0, 0.93), M["marble"], e)
    cube((2.4, 0.08, 0.6), (0, -0.27, 1.5), M["walnut"], e)
    cube((0.5, 0.3, 0.03), (-0.6, 0, 0.96), M["metal_dk"], e)
    cyl(0.02, 0.35, (-0.6, 0.05, 1.12), M["gold"], e, verts=10)  # faucet
    cube((0.4, 0.25, 0.02), (0.7, 0, 0.96), M["screen"], e)

def f_bed(e, M, wide, s):
    w = (1.7 if wide else 1.1) * s
    cube((w, 2.05*s, 0.26), (0, 0, 0.16), M["walnut"], e)  # base
    rounded_box((w, 1.95*s, 0.26), (0, 0.05, 0.42), M["linen"], e, bw=0.05, sub=1)  # mattress + duvet
    rounded_box((w*1.02, 1.0, 0.18), (0, 0.7*s, 0.5), M["linen2"], e, bw=0.06, sub=1)  # folded throw
    rounded_box((w*0.55, 0.55, 0.4), (0, 0.45*s, 0.55), M["linen"], e, bw=0.1, sub=1)  # duvet bunch
    rounded_box((w + 0.1, 0.14, 0.92), (0, -1.02*s, 0.62), M["fabric_dk"], e, bw=0.05, sub=0)  # headboard
    for px in ((-0.4, 0.4) if wide else (0,)):
        rounded_box((0.54*s, 0.34, 0.18), (px*w, -0.7*s, 0.6), M["linen"], e, bw=0.08, sub=1)
        rounded_box((0.5*s, 0.3, 0.14), (px*w, -0.62*s, 0.72), M["linen2"], e, bw=0.08, sub=1)
    cube((w + 0.2, 0.16, 0.5), (0, 0.74*s, 0.4), M["fabric_dk"], e)  # bench

def f_nightstand(e, M):
    cube((0.5, 0.42, 0.45), (0, 0, 0.22), M["walnut"], e)
    cyl(0.08, 0.16, (0, 0, 0.5), M["ceramic"], e, verts=18)
    sphere(0.1, (0, 0, 0.62), M["lamp"], e)
    if TIME == "night":  # bedside lamp pools light
        lt = bpy.data.lights.new("nl", "POINT"); lt.energy = 22; lt.color = col("#ffcf8f"); lt.shadow_soft_size = 0.08
        lo = bpy.data.objects.new("nl", lt); bpy.context.scene.collection.objects.link(lo)
        lo.parent = e; lo.matrix_parent_inverse = mathutils.Matrix(); lo.location = (0, 0, 0.6)

def f_wardrobe(e, M, s):
    cube((1.8*s, 0.6, 2.3), (0, 0, 1.15), M["walnut"], e)
    for gx in (-0.45*s, 0.45*s):
        cube((0.03, 0.62, 1.9), (gx, 0, 1.15), M["gold"], e)

def f_desk(e, M, s):
    cube((1.4*s, 0.6, 0.05), (0, 0, 0.74), M["oak"], e)
    for sx in (-0.6*s, 0.6*s):
        cube((0.05, 0.55, 0.74), (sx, 0, 0.37), M["metal_dk"], e)
    cube((0.46, 0.46, 0.06), (0, 0.55, 0.46), M["fabric"], e)
    cube((0.46, 0.06, 0.5), (0, 0.73, 0.7), M["fabric"], e)
    cube((0.34, 0.22, 0.02), (-0.3, 0, 0.78), M["book_b"], e)

def f_shelf(e, M, s):
    cube((1.8*s, 0.32, 1.6), (0, 0, 0.8), M["walnut"], e)
    for i, z in enumerate((0.4, 0.9, 1.35)):
        cube((1.7*s, 0.3, 0.04), (0, 0.02, z), M["darkwood"], e)
        for k in range(4):
            cube((0.07, 0.2, 0.26), (-0.6+k*0.34+0.06*i, 0.0, z+0.15),
                 [M["book_a"], M["book_b"], M["book_c"]][(i+k) % 3], e)

def leafy(rr, loc, material, parent):
    """Organic canopy: an icosphere broken up by a Displace modifier."""
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=rr, location=(0, 0, 0))
    o = bpy.context.active_object; o.location = loc
    try:
        tx = bpy.data.textures.new("leaf", "CLOUDS"); tx.noise_scale = 0.25
        md = o.modifiers.new("disp", "DISPLACE"); md.texture = tx; md.strength = rr * 0.6; md.mid_level = 0.4
    except Exception as ex:
        print("leaf err", ex)
    bpy.ops.object.shade_smooth()
    if material:
        o.data.materials.append(material)
    if parent:
        o.parent = parent; o.matrix_parent_inverse = mathutils.Matrix()
    return o

def f_plant(e, M, s):
    cyl(0.27, 0.3, (0, 0, 0.15), M["pot"], e, verts=28)
    cyl(0.22, 0.34, (0, 0, 0.46), M["pot"], e, verts=28)
    for (sx, sy) in [(0, 0), (0.05, 0.04)]:
        cyl(0.022, 0.9, (sx, sy, 0.95), M["plant_stem"], e, verts=8)
    for (ox, oy, oz, rr) in [(0, 0, 1.15, 0.5), (0.28, 0.12, 1.45, 0.34),
                             (-0.22, -0.14, 1.36, 0.32), (0.06, 0.24, 1.6, 0.26)]:
        leafy(rr*s, (ox, oy, oz), M["green" if (oz < 1.45) else "green2"], e)

def f_lounge(e, M):
    cube((0.88, 0.88, 0.32), (0, 0, 0.32), M["fabric_dk"], e)
    cube((0.88, 0.18, 0.55), (0, -0.35, 0.6), M["fabric_dk"], e)
    cube((0.5, 0.16, 0.4), (0, -0.1, 0.5), M["throw"], e)

def f_artwork(e, M):
    cube((1.2, 0.05, 0.85), (0, 0, 1.62), M["darkwood"], e)
    cube((1.04, 0.04, 0.68), (0, 0.02, 1.62), M["art"], e)

def f_pendant(e, M):
    cyl(0.015, 0.6, (0, 0, 2.05), M["gold"], e, verts=10)
    cyl(0.26, 0.3, (0, 0, 1.72), M["gold"], e, verts=28)
    sphere(0.1, (0, 0, 1.62), M["lamp"], e)
    lt = bpy.data.lights.new("pend", "POINT")
    lt.energy = 150; lt.color = col("#ffcf8f"); lt.shadow_soft_size = 0.15
    lo = bpy.data.objects.new("pend", lt)
    bpy.context.scene.collection.objects.link(lo)
    lo.parent = e; lo.matrix_parent_inverse = mathutils.Matrix(); lo.location = (0, 0, 1.5)

FURN = {
    "sofa": lambda e, M, it: f_sofa(e, M, False),
    "sectional": lambda e, M, it: f_sofa(e, M, True),
    "coffeeTable": lambda e, M, it: f_coffee(e, M),
    "rug": lambda e, M, it: f_rug(e, M, it.get("scale", 1) or 1),
    "tv": lambda e, M, it: f_tv(e, M),
    "tvBoard": lambda e, M, it: f_tv(e, M),
    "diningTable": lambda e, M, it: f_dining(e, M, it.get("scale", 1) or 1),
    "island": lambda e, M, it: f_island(e, M),
    "kitchen": lambda e, M, it: f_kitchen(e, M),
    "bed": lambda e, M, it: f_bed(e, M, False, it.get("scale", 1) or 1),
    "bedDouble": lambda e, M, it: f_bed(e, M, True, it.get("scale", 1) or 1),
    "nightstand": lambda e, M, it: f_nightstand(e, M),
    "wardrobe": lambda e, M, it: f_wardrobe(e, M, it.get("scale", 1) or 1),
    "desk": lambda e, M, it: f_desk(e, M, it.get("scale", 1) or 1),
    "shelf": lambda e, M, it: f_shelf(e, M, it.get("scale", 1) or 1),
    "plant": lambda e, M, it: f_plant(e, M, it.get("scale", 1) or 1),
    "lounge": lambda e, M, it: f_lounge(e, M),
    "artwork": lambda e, M, it: f_artwork(e, M),
    "pendant": lambda e, M, it: f_pendant(e, M),
}

def solid_spans(w):
    if not w.get("door"):
        return [(w["a"], w["b"])]
    at = w["door"]["at"]; wd = w["door"]["width"]
    res = [(w["a"], at - wd/2), (at + wd/2, w["b"])]
    return [(s, e) for (s, e) in res if e - s > 0.02]

FLOOR = {"oak": "oak", "marble": "marble", "tile": "tile", "carpet": "carpet", "deck": "deck"}

def build_materials(time):
    M = {}
    # walls / ceiling — subtle plaster tooth + colour unevenness
    M["wall"] = plaster("wall", col("#ece8e1"))
    M["wall_ext"] = plaster("wall_ext", col("#e6e0d6"))
    M["ceil"] = plaster("ceil", col("#f3f0ea"), 0.92)
    # floors / stone — real grain & veining + clearcoat sheen for reflections
    M["oak"] = wood_mat("oak", col("#b09a78"), 0.32, coat=0.22)
    M["marble"] = marble_mat("marble", col("#ece8e0"), 0.1, coat=0.3)
    M["tile"] = marble_mat("tile", col("#d6d1c6"), 0.22, coat=0.18)
    M["carpet"] = fab("carpet", col("#7a7165"))
    M["deck"] = wood_mat("deck", col("#7a6a52"), 0.6)
    # upholstery & textiles
    M["fabric"] = fab("fabric", col("#b8b1a3"))
    M["fabric_dk"] = fab("fabric_dk", col("#6b6459"))
    M["throw"] = fab("throw", col("#9a6f55"))
    M["throw2"] = fab("throw2", col("#3f4d57"))
    M["linen"] = fab("linen", col("#ddd5c9"))
    M["linen2"] = fab("linen2", col("#c2b7a4"))
    # case goods (wood) + metals
    M["walnut"] = wood_mat("walnut", col("#5a4230"), 0.4, coat=0.18)
    M["darkwood"] = wood_mat("darkwood", col("#33271d"), 0.4)
    M["gold"] = mat("gold", col("#caa45c"), 0.22, 1.0)
    M["metal_dk"] = mat("metal_dk", col("#26262b"), 0.35, 0.9)
    M["screen"] = mat("screen", col("#08090c"), 0.05, 0.0, coat=0.5)  # off OLED, reflective
    M["glass"] = mat("glass", col("#eef2f4"), 0.0, 0.0, transmission=1.0, ior=1.45)
    M["green"] = add_bump(add_color_var(mat("green", col("#3f5e3a"), 0.6), 20, 0.8, 1.15, 6), 30, 0.2, 6)
    M["green2"] = add_bump(add_color_var(mat("green2", col("#34522f"), 0.6), 20, 0.8, 1.15, 6), 30, 0.2, 6)
    M["pot"] = add_color_var(mat("pot", col("#2c2a27"), 0.55), 6, 0.9, 1.1)
    M["ceramic"] = mat("ceramic", col("#cdb9a0"), 0.22, coat=0.25)
    M["ceramic2"] = mat("ceramic2", col("#d8ccbb"), 0.16, coat=0.25)
    M["rug"] = fab("rug", col("#8a8275"), 1.0)
    M["rug2"] = fab("rug2", col("#a99d88"), 1.0)
    M["art"] = mat("art", col("#a98f63"), 0.4, 0.0, emis=col("#1c150a"), estr=(0.2 if time == "night" else 0.0))
    M["plant_stem"] = mat("plant_stem", col("#5a6b3a"), 0.6)
    M["book_a"] = add_color_var(mat("book_a", col("#7a4a3a"), 0.7), 30)
    M["book_b"] = add_color_var(mat("book_b", col("#3f5161"), 0.7), 30)
    M["book_c"] = mat("book_c", col("#caa45c"), 0.45, coat=0.2)
    M["sheer"] = mat("sheer", col("#efe9dd"), 0.9, 0.0, transmission=0.6, ior=1.1)
    M["drape"] = fab("drape", col("#cfc6b5"), 0.9)
    # lamps glow only at night
    le = 40 if time == "night" else 0.0
    M["lamp"] = mat("lamp", col("#ffe7c4"), 0.4, 0.0, emis=col("#ffcf8f"), estr=le)
    M["warm"] = mat("warm", col("#ffe7c0"), 0.5, emis=col("#ffd9a0"), estr=(24 if time == "night" else 0.0))
    M["cove"] = mat("cove", col("#fff0d8"), 0.5, emis=col("#ffe6bd"), estr=(14 if time == "night" else 0.0))
    return M

def add_curtains(M, plan, wx, wy, habD):
    """Soft drapes bundled at the ends of the glazing — dressed, view still open."""
    W = plan["widthM"]; ceil = plan["ceilingM"]
    yy = wy(habD) - 0.18
    for sx in (-W/2 + 0.5, W/2 - 0.5):
        for k in range(3):
            cube((0.16, 0.12, ceil - 0.1), (sx + (k - 1) * 0.12, yy, ceil/2 - 0.05),
                 M["drape"], None, bevel=True)
    # a high valance across the top
    cube((W - 0.6, 0.14, 0.18), (0, yy, ceil - 0.12), M["drape"], None, bevel=False)

def build_interior(plan, M, time):
    W = plan["widthM"]; D = plan["depthM"]; ceil = plan["ceilingM"]
    def wx(x): return x - W/2
    def wy(z): return z - D/2

    for r in plan["rooms"]:
        m = M[FLOOR.get(r.get("floor", "oak"), "oak")]
        cube((r["w"] - 0.02, r["d"] - 0.02, 0.05), (wx(r["x"] + r["w"]/2), wy(r["z"] + r["d"]/2), -0.025), m, bevel=False)

    bal = next((r for r in plan["rooms"] if r["kind"] == "balcony"), None)
    habD = bal["z"] if bal else D
    cube((W, habD, 0.06), (0, wy(habD/2), ceil + 0.03), M["ceil"], bevel=False)
    cube((W - 1.0, 0.12, 0.04), (0, wy(habD - 0.4), ceil - 0.05), M["cove"], bevel=False)

    for w in plan["walls"]:
        if w["kind"] == "glass":
            L = w["b"] - w["a"]; mid = (w["a"] + w["b"]) / 2
            if w["dir"] == "z":
                cube((0.03, L, ceil), (wx(w["coord"]), wy(mid), ceil/2), M["glass"], bevel=False)
            else:
                cube((L, 0.03, ceil), (wx(mid), wy(w["coord"]), ceil/2), M["glass"], bevel=False)
            n = max(1, round(L / 1.5))
            for i in range(n + 1):
                off = -L/2 + i * L / n
                if w["dir"] == "z":
                    cube((0.06, 0.06, ceil), (wx(w["coord"]), wy(mid) + off, ceil/2), M["metal_dk"], bevel=False)
                else:
                    cube((0.06, 0.06, ceil), (wx(mid) + off, wy(w["coord"]), ceil/2), M["metal_dk"], bevel=False)
        elif w["kind"] == "rail":
            L = w["b"] - w["a"]; mid = (w["a"] + w["b"]) / 2
            if w["dir"] == "z":
                cube((0.02, L, 1.08), (wx(w["coord"]), wy(mid), 0.54), M["glass"], bevel=False)
                cube((0.08, L, 0.06), (wx(w["coord"]), wy(mid), 1.1), M["metal_dk"], bevel=False)
            else:
                cube((L, 0.02, 1.08), (wx(mid), wy(w["coord"]), 0.54), M["glass"], bevel=False)
                cube((L, 0.08, 0.06), (wx(mid), wy(w["coord"]), 1.1), M["metal_dk"], bevel=False)
        else:
            t = WALL_T * 1.5 if w["exterior"] else WALL_T
            wm = M["wall_ext"] if w["exterior"] else M["wall"]
            for (s, e) in solid_spans(w):
                L = e - s; mid = (s + e) / 2
                if w["dir"] == "z":
                    cube((t, L, ceil), (wx(w["coord"]), wy(mid), ceil/2), wm, bevel=False)
                else:
                    cube((L, t, ceil), (wx(mid), wy(w["coord"]), ceil/2), wm, bevel=False)
            if w.get("door"):
                d = w["door"]
                if w["dir"] == "z":
                    cube((t, d["width"], ceil - DOOR_H), (wx(w["coord"]), wy(d["at"]), (DOOR_H + ceil)/2), wm, bevel=False)
                else:
                    cube((d["width"], t, ceil - DOOR_H), (wx(d["at"]), wy(w["coord"]), (DOOR_H + ceil)/2), wm, bevel=False)

    for it in plan["furniture"]:
        fn = FURN.get(it["kind"])
        if not fn:
            continue
        e = empty((wx(it["x"]), wy(it["z"]), 0), -math.radians(it.get("rot", 0) or 0))
        fn(e, M, it)

    add_curtains(M, plan, wx, wy, habD)
    return wx, wy, habD

# ------------------------------------------------------------------ environment
def build_city(time, seed=11):
    rng = random.Random(seed)
    if time == "night":
        base = mat("city_base", col("#0a0d15"), 0.85)
        emis = [mat("ce", col(c), 0.6, emis=col(c), estr=st)
                for c, st in [("#ffce8f", 2.6), ("#ffbf90", 1.7), ("#bcd0f0", 2.3), ("#9fbcee", 1.3)]]
    else:
        base = mat("city_base", col("#aab4c4"), 0.5, 0.2)
        emis = [mat("ce", col(c), 0.4, 0.3) for c in ("#c4cedd", "#b6c2d4", "#cdd6e2", "#9fb0c8")]
    for ring_r, n, hmax in [(48, 28, 30), (74, 34, 50), (104, 40, 76)]:
        for i in range(n):
            a = (i / n) * math.tau + rng.uniform(-0.12, 0.12)
            r = ring_r + rng.uniform(-10, 10)
            h = rng.uniform(8, hmax); w = rng.uniform(6, 14); d = rng.uniform(6, 14)
            o = cube((w, h, d), (math.cos(a)*r, math.sin(a)*r, h/2 - 8), base, bevel=False)
            o.data.materials.append(rng.choice(emis))
            for p in o.data.polygons:
                p.material_index = 1
    cube((600, 600, 0.2), (0, 0, -8.1), mat("ground", col("#070a11" if time == "night" else "#3a3f47"), 1.0), bevel=False)

def setup_world(time):
    w = bpy.data.worlds.new("W"); bpy.context.scene.world = w; w.use_nodes = True
    nt = w.node_tree
    bg = nt.nodes.get("Background")
    if time == "day":
        try:
            sky = nt.nodes.new("ShaderNodeTexSky")
            sky.sky_type = "HOSEK_WILKIE"
            el = math.radians(30); az = math.radians(50)
            sky.sun_direction = (math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el))
            if hasattr(sky, "turbidity"):
                sky.turbidity = 2.2
            if hasattr(sky, "ground_albedo"):
                sky.ground_albedo = 0.35
            nt.links.new(sky.outputs[0], bg.inputs["Color"])
            bg.inputs["Strength"].default_value = 1.0
        except Exception as ex:
            print("sky err", ex)
            bg.inputs["Color"].default_value = (*col("#9fb6d8"), 1)
            bg.inputs["Strength"].default_value = 1.2
    else:
        bg.inputs["Color"].default_value = (*col("#090c14"), 1)
        bg.inputs["Strength"].default_value = 0.15

def add_lights(plan, wx, wy, habD, time):
    ceil = plan["ceilingM"]
    habit = [r for r in plan["rooms"] if r["kind"] in ("ldk", "master", "bedroom")]

    def area(name, loc, rot, sx, sy, en, c):
        lt = bpy.data.lights.new(name, "AREA"); lt.shape = "RECTANGLE"
        lt.size = sx; lt.size_y = sy; lt.energy = en; lt.color = c
        o = bpy.data.objects.new(name, lt); bpy.context.scene.collection.objects.link(o)
        o.location = loc; o.rotation_euler = rot
        for at in ("visible_camera", "visible_glossy"):
            try: setattr(o, at, False)
            except Exception: pass
        return o

    if time == "night":
        # layer 1 — large, dim, soft warm ambient fill per room (soft shadows)
        for r in habit:
            cx = wx(r["x"] + r["w"]/2); cy = wy(r["z"] + r["d"]/2)
            en = max(8, r["w"] * r["d"] * 0.42)
            area("ca", (cx, cy, ceil - 0.06), (0, 0, 0),
                 min(r["w"] - 0.3, 3.5), min(r["d"] - 0.3, 3.5), en, col("#ffd7a2"))
        # layer 2 — bright warm pools over the hero furniture (high contrast islands)
        for it in plan["furniture"]:
            if it["kind"] in ("coffeeTable", "diningTable", "island", "bedDouble", "bed"):
                area("pool", (wx(it["x"]), wy(it["z"]), 1.5), (0, 0, 0), 0.6, 0.6, 110, col("#ffd4a0"))
        # cove halo (up-facing strip near the window) + faint cool sill spill
        area("coveL", (0, wy(habD - 0.45), ceil - 0.2), (math.pi, 0, 0),
             plan["widthM"] - 1.0, 0.3, 32, col("#ffdcae"))
        area("sill", (0, wy(habD - 0.5), 1.2), (math.radians(-80), 0, 0),
             plan["widthM"] * 0.9, 1.4, 14, col("#9fb4d8"))
    else:
        # crisp sun + a metered daylight portal (window keeps sky/city detail)
        sun = bpy.data.lights.new("sun", "SUN"); sun.energy = 4.5; sun.color = col("#fff2dc"); sun.angle = math.radians(1.5)
        so = bpy.data.objects.new("sun", sun); bpy.context.scene.collection.objects.link(so)
        so.rotation_euler = (math.radians(55), 0, math.radians(30))
        area("portal", (0, wy(habD) + 0.5, ceil * 0.55), (math.radians(-90), 0, 0),
             plan["widthM"], ceil * 1.15, 120, col("#dfe9ff"))
        for r in habit:  # gentle neutral fill so deep corners aren't muddy
            cx = wx(r["x"] + r["w"]/2); cy = wy(r["z"] + r["d"]/2)
            area("df", (cx, cy, ceil - 0.08), (0, 0, 0),
                 min(r["w"] - 0.5, 2.6), min(r["d"] - 0.5, 1.8), 12, col("#fff4e6"))

def add_camera(spot, plan, wx, wy):
    gx, gz = spot
    cam_d = bpy.data.cameras.new("cam"); cam_d.type = "PANO"
    try:
        cam_d.panorama_type = "EQUIRECTANGULAR"
    except Exception:
        try: cam_d.cycles.panorama_type = "EQUIRECTANGULAR"
        except Exception as ex: print("pano err", ex)
    cam = bpy.data.objects.new("cam", cam_d); bpy.context.scene.collection.objects.link(cam)
    cam.location = (wx(gx), wy(gz), 1.2)  # seated/tripod height — furniture fills the frame
    cam.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.scene.camera = cam

def pick_spot(plan, room):
    items = [it for it in plan["furniture"]
             if room["x"] <= it["x"] <= room["x"] + room["w"]
             and room["z"] <= it["z"] <= room["z"] + room["d"]
             and it["kind"] not in ("rug", "artwork", "pendant")]
    best, bs = (room["x"] + room["w"]/2, room["z"] + room["d"]/2), -1.0
    steps = 12; pad = min(0.7, room["w"]/3, room["d"]/3)
    for i in range(steps):
        for j in range(steps):
            gx = room["x"] + pad + (room["w"] - 2*pad) * i / (steps - 1)
            gz = room["z"] + pad + (room["d"] - 2*pad) * j / (steps - 1)
            dmin = min((math.hypot(gx - it["x"], gz - it["z"]) for it in items), default=2.5)
            edge = min(gx - room["x"], room["x"] + room["w"] - gx, gz - room["z"], room["z"] + room["d"] - gz)
            sc = min(dmin, edge * 1.3)
            if sc > bs:
                bs, best = sc, (gx, gz)
    # bias the standpoint toward the seating/bed so it fills the foreground
    hero = next((it for it in items if it["kind"] in ("sectional", "sofa", "bedDouble", "bed")), None)
    if hero:
        best = (best[0] * 0.5 + hero["x"] * 0.5, best[1] * 0.5 + hero["z"] * 0.5)
    return best

def setup_render(time):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for ct in ("OPTIX", "CUDA", "HIP"):
            try:
                prefs.compute_device_type = ct; prefs.refresh_devices()
            except Exception:
                continue
            if any(d.type == ct for d in prefs.devices):
                for d in prefs.devices:
                    d.use = (d.type == ct)
                sc.cycles.device = "GPU"; break
    except Exception as ex:
        print("gpu err", ex)
    sc.cycles.samples = SAMPLES
    sc.cycles.use_adaptive_sampling = True
    try:
        sc.cycles.use_denoising = True; sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    try:
        sc.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    sc.view_settings.exposure = (-0.45 if time == "night" else -0.2)
    sc.render.resolution_x = RESX; sc.render.resolution_y = RESX // 2
    sc.render.image_settings.file_format = "JPEG"; sc.render.image_settings.quality = 92
    # (fog-glow bloom is applied at runtime in PanoramaViewer.tsx instead of the
    #  Blender compositor, which was reworked in Blender 5.x.)

def plan_viewpoints(plan):
    vps = []
    ldk = next((r for r in plan["rooms"] if r["kind"] == "ldk"), None)
    if ldk:
        vps.append(("ldk", "リビング", ldk))
    bedroom = next((r for r in plan["rooms"] if r["kind"] == "master"), None) \
        or next((r for r in plan["rooms"] if r["kind"] == "bedroom"), None)
    if bedroom:
        vps.append(("bed", "ベッドルーム", bedroom))
    return vps

def render_one(plan_id, room_key, label, room, time):
    global TIME
    TIME = time
    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup_render(time)
    setup_world(time)
    M = build_materials(time)
    plan = DATA["plans"][plan_id]
    wx, wy, habD = build_interior(plan, M, time)
    build_city(time)
    add_lights(plan, wx, wy, habD, time)
    spot = pick_spot(plan, room)
    add_camera(spot, plan, wx, wy)
    path = "%s/%s_%s_%s.jpg" % (OUT, plan_id, room_key, time)
    bpy.context.scene.render.filepath = path
    import time as _t
    t0 = _t.time()
    print("RENDERING", plan_id, room_key, time, "->", path)
    bpy.ops.render.render(write_still=True)
    print("DONE", plan_id, room_key, time, "in %.1fs" % (_t.time() - t0))
    return spot

# write viewpoints.json for ALL plans/rooms (paths only; positions filled as rendered)
def write_viewpoints():
    out = {}
    for pid, plan in DATA["plans"].items():
        arr = []
        for (rk, label, room) in plan_viewpoints(plan):
            spot = pick_spot(plan, room)
            arr.append({
                "room": rk, "roomId": room["id"], "label": label,
                "x": round(spot[0], 3), "z": round(spot[1], 3),
                "day": "/panoramas/%s_%s_day.jpg" % (pid, rk),
                "night": "/panoramas/%s_%s_night.jpg" % (pid, rk),
            })
        out[pid] = arr
    with open(VP_JSON, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("WROTE", VP_JSON)

write_viewpoints()
for pid in ONLY_PLANS:
    plan = DATA["plans"][pid]
    for (rk, label, room) in plan_viewpoints(plan):
        if rk not in ONLY_ROOMS:
            continue
        for tm in ONLY_TIMES:
            render_one(pid, rk, label, room, tm)
print("ALL_DONE")
