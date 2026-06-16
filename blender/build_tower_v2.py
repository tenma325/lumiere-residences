"""
Build a maximum-fidelity LUMIÈRE tower (curtain wall, balconies, illuminated
crown + spire, double-height lobby podium, landscaped plaza) and export GLB to
public/models/tower.glb for use in TowerScene.tsx.

Built in Blender Z-up with the FRONT facing +Y. The glTF exporter (+Y up) maps
Blender +Y → glTF -Z, so TowerScene rotates the model 180° about Y to put the
front at +Z (matching the unit markers / fly-in). Dimensions match the TOWER
constants in TowerScene.tsx so markers land on the right floors/windows.

Usage:
  blender -b --python build_tower.py            # build + preview render + export
  blender -b --python build_tower.py -- nopreview
"""
import bpy, bmesh, math, random, sys
from mathutils import Vector

ROOT = "C:/Users/user/Desktop/lumiere-residences"
GLB = ROOT + "/public/models/tower.glb"
PREVIEW = ROOT + "/blender/_tower_preview.jpg"
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
DO_PREVIEW = "nopreview" not in argv

# ---- match TowerScene.tsx TOWER constants ----
FL = 34          # floors
FH = 1.0         # floor height
POD = 3.0        # podium height
W = 9.0          # body width (x)
D = 9.0          # body depth (y)
BODY_Z0 = POD
BODY_Z1 = POD + FL * FH       # 37
RNG = random.Random(20260615)

# ------------------------------------------------------------------ colour
def s2l(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
def col(h):
    h = h.lstrip("#")
    return tuple(s2l(int(h[i:i+2], 16) / 255) for i in (0, 2, 4))

def mat(name, base, rough=0.5, metal=0.0, emis=None, estr=1.0, transmission=0.0, ior=1.45):
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
    if emis is not None:
        if "Emission Color" in b.inputs:
            b.inputs["Emission Color"].default_value = (*emis, 1)
        if "Emission Strength" in b.inputs:
            b.inputs["Emission Strength"].default_value = estr
    return m

# ------------------------------------------------------------------ bmesh helpers
def add_box(bm, center, size, mi=0):
    r = bmesh.ops.create_cube(bm, size=1.0)
    vs = r["verts"]
    bmesh.ops.scale(bm, vec=Vector(size), verts=vs)
    bmesh.ops.translate(bm, vec=Vector(center), verts=vs)
    faces = set()
    for v in vs:
        for f in v.link_faces:
            faces.add(f)
    for f in faces:
        f.material_index = mi

def commit(bm, name, materials):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for mt in materials:
        me.materials.append(mt)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob

# Faces of the body. n = normal axis, s = sign, off = plane offset, wdt = in-plane width.
FACES = [
    {"n": "Y", "s": 1, "off": D / 2, "wdt": W, "front": True},
    {"n": "Y", "s": -1, "off": D / 2, "wdt": W, "front": False},
    {"n": "X", "s": 1, "off": W / 2, "wdt": D, "front": False},
    {"n": "X", "s": -1, "off": W / 2, "wdt": D, "front": False},
]

def panel(bm, face, uc, zc, usz, zsz, depth, doff, mi):
    """Place a thin panel on a face. doff = outward offset from the face plane."""
    if face["n"] == "Y":
        center = (uc, face["s"] * (face["off"] + doff), zc)
        size = (usz, depth, zsz)
    else:
        center = (face["s"] * (face["off"] + doff), uc, zc)
        size = (depth, usz, zsz)
    add_box(bm, center, size, mi)

# ------------------------------------------------------------------ build
def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # materials
    M_glass = mat("glass", col("#0a0e18"), 0.05, 0.9)
    M_litA = mat("litA", col("#1a1206"), 0.3, 0.0, emis=col("#ffcaa0"), estr=3.2)
    M_litB = mat("litB", col("#1a1206"), 0.3, 0.0, emis=col("#ffe0b0"), estr=2.2)
    M_litC = mat("litC", col("#0c121c"), 0.3, 0.0, emis=col("#bcd4ff"), estr=2.6)
    M_slab = mat("slab", col("#1c1d24"), 0.55, 0.35)
    M_spandrel = mat("spandrel", col("#101117"), 0.5, 0.6)
    M_mull = mat("mullion", col("#1b1c22"), 0.4, 0.95)
    M_metal = mat("metal", col("#202126"), 0.4, 0.9)
    M_gold = mat("gold", col("#caa45c"), 0.22, 1.0, emis=col("#3a2c12"), estr=0.6)
    M_crownglow = mat("crownglow", col("#ffe2b0"), 0.4, 0.0, emis=col("#ffd9a0"), estr=5.0)
    M_lobby = mat("lobby", col("#ffe6c0"), 0.4, 0.0, emis=col("#ffdca0"), estr=3.2)
    M_beacon = mat("beacon", col("#ff5a4a"), 0.4, 0.0, emis=col("#ff5a4a"), estr=8.0)
    M_stone = mat("stone", col("#0b0b0f"), 0.32, 0.4)
    M_plant = mat("plant", col("#2e4a2b"), 0.85)
    M_trunk = mat("trunk", col("#26201a"), 0.8)
    M_water = mat("water", col("#0a1018"), 0.03, 0.0)
    M_bollard = mat("bollard", col("#ffdca0"), 0.4, 0.0, emis=col("#ffdca0"), estr=6.0)

    def rnd_glass():
        r = RNG.random()
        if r < 0.58: return 0   # dark
        if r < 0.74: return 1   # warm A
        if r < 0.87: return 2   # warm B
        return 3                # cool

    # ---- curtain wall ----
    bm_g = bmesh.new(); bm_s = bmesh.new(); bm_m = bmesh.new()
    SP = 0.34  # spandrel height
    for face in FACES:
        wdt = face["wdt"]
        bays = max(4, round(wdt / 1.4))
        bw = wdt / bays
        for f in range(FL):
            z0 = POD + f * FH
            z1 = z0 + FH
            panel(bm_s, face, 0, z0 + 0.02, wdt, 0.13, 0.14, 0.07, 0)  # slab band
            for b in range(bays):
                uc = -wdt / 2 + (b + 0.5) * bw
                panel(bm_s, face, uc, z0 + SP / 2 + 0.13, bw - 0.04, SP, 0.08, -0.02, 1)  # spandrel
                gz0 = z0 + SP + 0.13; gz1 = z1
                panel(bm_g, face, uc, (gz0 + gz1) / 2, bw - 0.16, gz1 - gz0 - 0.06, 0.06, -0.05, rnd_glass())
        for b in range(bays + 1):  # full-height vertical mullions
            uc = -wdt / 2 + b * bw
            panel(bm_m, face, uc, (BODY_Z0 + BODY_Z1) / 2, 0.09, FL * FH, 0.18, 0.06, 0)
    # corner fins (gold accent)
    bm_corner = bmesh.new()
    for cx in (-W / 2, W / 2):
        for cy in (-D / 2, D / 2):
            add_box(bm_corner, (cx, cy, (BODY_Z0 + BODY_Z1) / 2), (0.34, 0.34, FL * FH + 0.3), 0)
    # opaque core (so it never looks see-through)
    add_box(bm_s, (0, 0, (BODY_Z0 + BODY_Z1) / 2), (W - 0.5, D - 0.5, FL * FH), 1)

    obj_g = commit(bm_g, "facade_glass", [M_glass, M_litA, M_litB, M_litC])
    obj_s = commit(bm_s, "facade_struct", [M_slab, M_spandrel])
    obj_m = commit(bm_m, "mullions", [M_mull])
    obj_c = commit(bm_corner, "corner_fins", [M_gold])

    # ---- balconies (front + sides) ----
    bm_b = bmesh.new(); bm_bg = bmesh.new()
    for face in FACES[:1] + FACES[2:]:  # front, +X, -X
        wdt = face["wdt"]
        for f in range(FL):
            z = POD + f * FH
            panel(bm_b, face, 0, z + 0.03, wdt - 0.5, 0.07, 0.75, 0.37, 0)         # slab
            panel(bm_bg, face, 0, z + 0.5, wdt - 0.5, 0.86, 0.02, 0.72, 0)          # glass rail
            panel(bm_b, face, 0, z + 0.96, wdt - 0.5, 0.05, 0.09, 0.72, 0)          # top rail
    obj_b = commit(bm_b, "balconies", [M_metal])
    obj_bg = commit(bm_bg, "balcony_glass", [M_glass])

    # ---- crown ----
    bm_cr = bmesh.new(); bm_crg = bmesh.new(); bm_crgold = bmesh.new()
    ct = BODY_Z1
    add_box(bm_crgold, (0, 0, ct + 0.25), (W + 0.5, D + 0.5, 0.5), 0)               # parapet ring (gold)
    add_box(bm_crg, (0, 0, ct + 0.45), (W - 0.2, D - 0.2, 0.25), 0)                 # crown glow band
    # two setbacks (glass volumes)
    add_box(bm_cr, (0, 0, ct + 1.6), (W * 0.78, D * 0.78, 2.2), 0)
    add_box(bm_cr, (0, 0, ct + 3.4), (W * 0.5, D * 0.5, 1.6), 0)
    add_box(bm_crgold, (0, 0, ct + 4.3), (W * 0.5 + 0.2, D * 0.5 + 0.2, 0.18), 0)
    # spire
    r = bmesh.ops.create_cone(bm_crgold, cap_ends=True, segments=16, radius1=0.9, radius2=0.08, depth=4.0)
    bmesh.ops.translate(bm_crgold, vec=Vector((0, 0, ct + 6.3)), verts=r["verts"])
    add_box(bm_crg, (0, 0, ct + 8.5), (0.16, 0.16, 0.3), 0)                         # beacon mount
    obj_cr = commit(bm_cr, "crown_glass", [M_glass])
    obj_crg = commit(bm_crg, "crown_glow", [M_crownglow])
    obj_crgold = commit(bm_crgold, "crown_gold", [M_gold])
    # beacon
    bm_be = bmesh.new()
    rb = bmesh.ops.create_uvsphere(bm_be, u_segments=12, v_segments=8, radius=0.18)
    bmesh.ops.translate(bm_be, vec=Vector((0, 0, ct + 8.8)), verts=rb["verts"])
    obj_be = commit(bm_be, "beacon", [M_beacon])

    # ---- podium (double-height lobby) ----
    bm_p = bmesh.new(); bm_pg = bmesh.new(); bm_pl = bmesh.new(); bm_pgold = bmesh.new()
    add_box(bm_p, (0, 0, 0.2), (W + 2.2, D + 2.2, 0.4), 0)                          # plinth
    # podium opaque sides
    for face in FACES:
        wdt = face["wdt"]
        if face["front"]:
            # lobby glazing + fins
            bays = 6; bw = (wdt + 1.4) / bays
            for b in range(bays):
                uc = -(wdt + 1.4) / 2 + (b + 0.5) * bw
                panel(bm_pg, face, uc, 1.7, bw - 0.12, 2.4, 0.05, 1.12, 0)
                panel(bm_pgold, face, -(wdt + 1.4) / 2 + b * bw, 1.7, 0.1, 2.6, 0.16, 1.16, 0)
            panel(bm_pgold, face, (wdt + 1.4) / 2, 1.7, 0.1, 2.6, 0.16, 1.16, 0)
            panel(bm_pl, face, 0, 1.6, wdt + 1.0, 2.2, 0.05, 1.0, 0)                # lobby glow
            # entrance canopy
            panel(bm_pgold, face, 0, 2.7, 6.0, 0.16, 1.7, 1.9, 0)
            panel(bm_pl, face, 0, 2.6, 5.2, 0.06, 0.05, 2.5, 0)                     # canopy downlight
        else:
            panel(bm_p, face, 0, 1.7, wdt + 1.4, 2.6, 0.4, 1.0, 0)                  # stone wall
    obj_p = commit(bm_p, "podium", [M_stone])
    obj_pg = commit(bm_pg, "podium_glass", [M_glass])
    obj_pl = commit(bm_pl, "podium_glow", [M_lobby])
    obj_pgold = commit(bm_pgold, "podium_gold", [M_gold])

    # ---- plaza + landscape ----
    bm_pl2 = bmesh.new()
    add_box(bm_pl2, (0, 0, 0.02), (60, 60, 0.04), 0)                               # plaza
    obj_plaza = commit(bm_pl2, "plaza", [M_stone])
    bm_w = bmesh.new()
    add_box(bm_w, (0, 11, 0.05), (14, 5, 0.06), 0)                                 # reflecting pool (front)
    obj_wat = commit(bm_w, "pool", [M_water])
    # trees
    bm_tr = bmesh.new(); bm_tc = bmesh.new()
    tree_spots = [(-13, 9), (13, 9), (-15, -4), (15, -4), (-10, 15), (10, 15)]
    for (tx, ty) in tree_spots:
        rt = bmesh.ops.create_cone(bm_tr, cap_ends=True, segments=10, radius1=0.22, radius2=0.16, depth=2.2)
        bmesh.ops.translate(bm_tr, vec=Vector((tx, ty, 1.1)), verts=rt["verts"])
        for (oz, rr) in [(2.6, 1.3), (3.3, 1.0), (3.0, 1.1)]:
            rc = bmesh.ops.create_icosphere(bm_tc, subdivisions=2, radius=rr)
            bmesh.ops.translate(bm_tc, vec=Vector((tx + RNG.uniform(-0.2, 0.2), ty, oz)), verts=rc["verts"])
    obj_tr = commit(bm_tr, "trunks", [M_trunk])
    obj_tc = commit(bm_tc, "canopies", [M_plant])
    # planters + bollards
    bm_pln = bmesh.new(); bm_bo = bmesh.new()
    for (tx, ty) in tree_spots:
        add_box(bm_pln, (tx, ty, 0.25), (1.8, 1.8, 0.5), 0)
    for i in range(-3, 4):
        add_box(bm_bo, (i * 1.8, 8.0, 0.45), (0.12, 0.12, 0.9), 0)
    obj_pln = commit(bm_pln, "planters", [M_stone])
    obj_bo = commit(bm_bo, "bollards", [M_bollard])

    print("BUILD_OK objects:", len(bpy.context.scene.collection.objects))

def setup_preview():
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
                sc.cycles.device = "GPU"; print("GPU", ct); break
    except Exception as e:
        print("gpu err", e)
    sc.cycles.samples = 64
    sc.cycles.use_adaptive_sampling = True
    try:
        sc.cycles.use_denoising = True; sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    try:
        sc.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    sc.view_settings.exposure = -0.2
    sc.render.resolution_x = 1200; sc.render.resolution_y = 1500
    sc.render.image_settings.file_format = "JPEG"; sc.render.image_settings.quality = 90
    # world
    w = bpy.data.worlds.new("W"); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (*col("#070710"), 1)
    bg.inputs["Strength"].default_value = 0.4
    # key + rim
    for (rot, en, c) in [((math.radians(62), 0, math.radians(35)), 2.0, "#9fb0d8"),
                         ((math.radians(70), 0, math.radians(210)), 1.0, "#ffd9a0")]:
        L = bpy.data.lights.new("sun", "SUN"); L.energy = en; L.color = col(c); L.angle = math.radians(3)
        o = bpy.data.objects.new("sun", L); sc.collection.objects.link(o); o.rotation_euler = rot
    # camera 3/4 view
    cam = bpy.data.cameras.new("cam"); cam.lens = 38
    co = bpy.data.objects.new("cam", cam); sc.collection.objects.link(co); sc.camera = co
    co.location = (34, -42, 24)
    # aim at mid tower
    d = Vector((0, 0, 20)) - Vector(co.location)
    co.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = PREVIEW

def export():
    try:
        bpy.ops.export_scene.gltf(
            filepath=GLB, export_format="GLB", export_apply=True,
            use_selection=False, export_materials="EXPORT", export_yup=True,
        )
    except TypeError:
        bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB")
    print("EXPORT_OK", GLB)

build()
if DO_PREVIEW:
    setup_preview()
    import time as _t
    t0 = _t.time()
    bpy.ops.render.render(write_still=True)
    print("PREVIEW_OK in %.1fs" % (_t.time() - t0))
export()
print("ALL_DONE")
