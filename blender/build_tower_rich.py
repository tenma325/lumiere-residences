"""
Lumière Residences — premium tower builder.

Generates a high-detail luxury-residence GLB and a Cycles preview still.
Tuned for real-time PBR rendering in three.js with an environment map (IBL):
  * curtain-wall glass reads as a deep, mirror-like skyscraper facade
  * gold accents use a physically correct brass (metallic=1, measured tint)
  * emissive window/lit bands keep their glow without breaking roughness/metalness

Geometry constants match `src/components/TowerScene.tsx` (TOWER constant) so the
unit markers and the camera fly-in targets stay aligned.
"""
import bpy, bmesh, math, random, sys, os
from mathutils import Vector

ROOT = "C:/Users/user/Documents/lumiere-residences"
GLB = ROOT + "/public/models/tower.glb"
PREVIEW = ROOT + "/blender/_tower_preview.jpg"
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
DO_PREVIEW = "nopreview" not in argv

os.makedirs(os.path.dirname(GLB), exist_ok=True)

# ---- dimensions (must match TowerScene.tsx TOWER constant) ----
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

# ------------------------------------------------------------------ material
def mat(name, base, rough=0.5, metal=0.0, emis=None, estr=1.0, transmission=0.0, ior=1.45, coat=0.0, coat_rough=0.1):
    """Principled BSDF helper. Fields are tuned so the exported glTF PBR data
    survives into three.js MeshStandardMaterial / MeshPhysicalMaterial intact."""
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
    # Clearcoat → glossy "sealed" sheen on stone/metal (becomes a subtle fresnel
    # boost in three.js via the KHR_materials_clearcoat extension).
    for k in ("Coat Weight", "Clearcoat"):
        if k in b.inputs:
            b.inputs[k].default_value = coat; break
    for k in ("Coat Roughness", "Clearcoat Roughness"):
        if k in b.inputs:
            b.inputs[k].default_value = coat_rough; break
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

def add_cylinder(bm, center, radius, depth, mi=0, segs=24):
    r = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                              radius1=radius, radius2=radius, depth=depth)
    vs = r["verts"]
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

FACES = [
    {"n": "Y", "s": 1, "off": D / 2, "wdt": W, "front": True},
    {"n": "Y", "s": -1, "off": D / 2, "wdt": W, "front": False},
    {"n": "X", "s": 1, "off": W / 2, "wdt": D, "front": False},
    {"n": "X", "s": -1, "off": W / 2, "wdt": D, "front": False},
]

def panel(bm, face, uc, zc, usz, zsz, depth, doff, mi):
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

    # ---- premium materials (tuned for PBR + IBL in three.js) ----
    # Curtain-wall glass: deep cool tint, near-mirror at night, mirror-sky by day.
    # metallic slightly >0 gives a crisp fresnel reflection off the env map.
    M_glass = mat("glass", col("#0c1620"), 0.04, 0.35, transmission=0.0, ior=1.50, coat=1.0, coat_rough=0.03)
    # Lit windows — warm interior glow. Emissive survives into glTF.
    M_litA = mat("litA", col("#1a1208"), 0.22, 0.0, emis=col("#ffcaa0"), estr=6.0)
    M_litB = mat("litB", col("#1a1208"), 0.22, 0.0, emis=col("#ffe6c2"), estr=4.0)
    M_litC = mat("litC", col("#0a1018"), 0.22, 0.0, emis=col("#c4d8ff"), estr=4.5)
    # Floor slab edge — dark anodised aluminium
    M_slab = mat("slab", col("#1c1f27"), 0.42, 0.6, coat=0.3, coat_rough=0.2)
    # Spandrel — polished graphite
    M_spandrel = mat("spandrel", col("#10131a"), 0.18, 0.85)
    # Mullions — bronze-anodised framing (the dark verticals)
    M_mull = mat("mullion", col("#181a20"), 0.28, 0.95)
    # Architectural metal — handrails, balcony frames
    M_metal = mat("metal", col("#22262e"), 0.30, 0.95)
    # Gold — measured polished brass (gold 24k tint, metallic=1, low roughness)
    M_gold = mat("gold", col("#c9a227"), 0.18, 1.0)
    M_gold_emit = mat("gold_emit", col("#c9a227"), 0.22, 1.0, emis=col("#ffcf6a"), estr=3.0)
    # Crown glow band — warm halo
    M_crownglow = mat("crownglow", col("#ffe9c8"), 0.40, 0.0, emis=col("#ffdfb0"), estr=10.0)
    # Lobby interior wash
    M_lobby = mat("lobby", col("#ffe6c4"), 0.35, 0.0, emis=col("#ffe2b0"), estr=6.0)
    # Aviation beacon
    M_beacon = mat("beacon", col("#ff2a2a"), 0.20, 0.0, emis=col("#ff2a2a"), estr=16.0)
    # Stone (plaza / cladding) — honed granite
    M_stone = mat("stone", col("#15171c"), 0.32, 0.25, coat=0.15, coat_rough=0.3)
    # Light stone (podium columns, cornices) — warm limestone
    M_stone_light = mat("stone_light", col("#cfc6b4"), 0.45, 0.05, coat=0.2, coat_rough=0.35)
    # Foliage / trunk
    M_plant = mat("plant", col("#243a20"), 0.85)
    M_trunk = mat("trunk", col("#211810"), 0.92)
    # Reflecting pool — still dark water
    M_water = mat("water", col("#070b12"), 0.02, 0.0, transmission=0.85, ior=1.33)
    # Bollard lights
    M_bollard = mat("bollard", col("#c9a227"), 0.20, 1.0, emis=col("#ffcf6a"), estr=5.0)

    def rnd_glass():
        r = RNG.random()
        if r < 0.62: return 0   # dark / reflective
        if r < 0.80: return 1   # warm A
        if r < 0.93: return 2   # warm B
        return 3                # cool

    # ---- CORE & MEGA FRAME ----
    bm_s = bmesh.new(); bm_frame = bmesh.new()
    add_box(bm_s, (0, 0, (BODY_Z0 + BODY_Z1) / 2), (W - 1.0, D - 1.0, FL * FH), 1)

    FRAME_THICK = 0.6
    for cx in (-W/2 + 0.1, W/2 - 0.1):
        for cy in (-D/2 + 0.1, D/2 - 0.1):
            add_box(bm_frame, (cx, cy, (BODY_Z0 + BODY_Z1) / 2), (FRAME_THICK, FRAME_THICK, FL * FH + 1.0), 0)

    obj_s = commit(bm_s, "facade_struct", [M_slab, M_spandrel])
    obj_frame = commit(bm_frame, "mega_frame", [M_stone_light])

    # ---- CURTAIN WALL WITH LOUVERS ----
    bm_g = bmesh.new(); bm_m = bmesh.new(); bm_gold = bmesh.new()
    SP = 0.30
    for face in FACES:
        wdt = face["wdt"] - FRAME_THICK*2
        bays = max(4, round(wdt / 1.2))
        bw = wdt / bays
        for f in range(FL):
            z0 = POD + f * FH
            z1 = z0 + FH
            panel(bm_m, face, 0, z0 + 0.02, wdt, 0.15, 0.16, 0.08, 0)            # floor slab
            for b in range(bays):
                uc = -wdt / 2 + (b + 0.5) * bw
                panel(bm_m, face, uc, z0 + SP / 2 + 0.15, bw - 0.02, SP, 0.1, -0.01, 0)  # spandrel
                gz0 = z0 + SP + 0.15; gz1 = z1
                panel(bm_g, face, uc, (gz0 + gz1) / 2, bw - 0.1, gz1 - gz0 - 0.04, 0.08, -0.04, rnd_glass())
                # Vertical gold accent louvers
                if b % 2 == 0:
                    panel(bm_gold, face, uc, (gz0 + gz1) / 2, 0.04, gz1 - gz0, 0.12, 0.12, 0)
        for b in range(bays + 1):                                                # mullions
            uc = -wdt / 2 + b * bw
            panel(bm_m, face, uc, (BODY_Z0 + BODY_Z1) / 2, 0.06, FL * FH, 0.22, 0.08, 0)

    # Lit reveal strips running up the mega frame
    for cx in (-W/2 + 0.1 + FRAME_THICK/2 + 0.05, W/2 - 0.1 - FRAME_THICK/2 - 0.05):
        add_box(bm_gold, (cx, D/2 + 0.1, (BODY_Z0 + BODY_Z1)/2), (0.05, 0.05, FL * FH), 1)
        add_box(bm_gold, (cx, -D/2 - 0.1, (BODY_Z0 + BODY_Z1)/2), (0.05, 0.05, FL * FH), 1)

    obj_g = commit(bm_g, "facade_glass", [M_glass, M_litA, M_litB, M_litC])
    obj_m = commit(bm_m, "mullions", [M_mull])
    obj_gold = commit(bm_gold, "gold_accents", [M_gold, M_gold_emit])

    # ---- BALCONIES (DYNAMIC) ----
    bm_b = bmesh.new(); bm_bg = bmesh.new()
    for face in FACES:
        wdt = face["wdt"] - FRAME_THICK*2
        for f in range(FL):
            if f % 3 == 0: continue
            z = POD + f * FH
            is_right = (f // 2) % 2 == 0
            b_width = wdt * 0.6
            offset_x = (wdt - b_width)/2 * (1 if is_right else -1)
            depth = 1.0
            panel(bm_b, face, offset_x, z + 0.04, b_width, 0.08, depth, depth/2, 0)
            panel(bm_bg, face, offset_x, z + 0.55, b_width, 0.94, 0.04, depth - 0.02, 0)
            panel(bm_b, face, offset_x, z + 1.05, b_width, 0.06, 0.1, depth - 0.02, 0)
            if face["n"] == "Y":
                add_box(bm_bg, (offset_x - b_width/2*face["s"], face["s"] * (face["off"] + depth/2), z + 0.55), (0.04, depth, 0.94), 0)
                add_box(bm_bg, (offset_x + b_width/2*face["s"], face["s"] * (face["off"] + depth/2), z + 0.55), (0.04, depth, 0.94), 0)
                add_box(bm_b, (offset_x - b_width/2*face["s"], face["s"] * (face["off"] + depth/2), z + 1.05), (0.04, depth, 0.06), 0)
                add_box(bm_b, (offset_x + b_width/2*face["s"], face["s"] * (face["off"] + depth/2), z + 1.05), (0.04, depth, 0.06), 0)
            else:
                add_box(bm_bg, (face["s"] * (face["off"] + depth/2), offset_x - b_width/2*face["s"], z + 0.55), (depth, 0.04, 0.94), 0)
                add_box(bm_bg, (face["s"] * (face["off"] + depth/2), offset_x + b_width/2*face["s"], z + 0.55), (depth, 0.04, 0.94), 0)
                add_box(bm_b, (face["s"] * (face["off"] + depth/2), offset_x - b_width/2*face["s"], z + 1.05), (depth, 0.04, 0.06), 0)
                add_box(bm_b, (face["s"] * (face["off"] + depth/2), offset_x + b_width/2*face["s"], z + 1.05), (depth, 0.04, 0.06), 0)

    obj_b = commit(bm_b, "balconies", [M_metal])
    obj_bg = commit(bm_bg, "balcony_glass", [M_glass])

    # ---- CROWN (LUXURY TIERED) ----
    bm_cr = bmesh.new(); bm_crg = bmesh.new(); bm_crgold = bmesh.new()
    ct = BODY_Z1
    add_box(bm_crgold, (0, 0, ct + 0.3), (W + 0.8, D + 0.8, 0.6), 0)
    add_box(bm_crg, (0, 0, ct + 0.8), (W - 0.2, D - 0.2, 0.4), 0)
    add_box(bm_cr, (0, 0, ct + 2.0), (W * 0.85, D * 0.85, 2.0), 0)
    add_box(bm_crgold, (0, 0, ct + 3.1), (W * 0.9, D * 0.9, 0.2), 0)
    add_box(bm_cr, (0, 0, ct + 4.5), (W * 0.6, D * 0.6, 2.6), 0)
    add_box(bm_cr, (0, 0, ct + 4.5), (W * 0.5, D * 0.7, 2.6), 0)
    add_box(bm_cr, (0, 0, ct + 4.5), (W * 0.7, D * 0.5, 2.6), 0)
    add_box(bm_crgold, (0, 0, ct + 5.9), (W * 0.65, D * 0.65, 0.2), 0)
    r = bmesh.ops.create_cone(bm_crgold, cap_ends=True, segments=24, radius1=1.2, radius2=0.05, depth=7.0)
    bmesh.ops.translate(bm_crgold, vec=Vector((0, 0, ct + 9.5)), verts=r["verts"])
    add_box(bm_crg, (0, 0, ct + 13.0), (0.2, 0.2, 0.4), 0)
    obj_cr = commit(bm_cr, "crown_glass", [M_glass])
    obj_crg = commit(bm_crg, "crown_glow", [M_crownglow])
    obj_crgold = commit(bm_crgold, "crown_gold", [M_gold])

    bm_be = bmesh.new()
    rb = bmesh.ops.create_uvsphere(bm_be, u_segments=16, v_segments=12, radius=0.25)
    bmesh.ops.translate(bm_be, vec=Vector((0, 0, ct + 13.5)), verts=rb["verts"])
    obj_be = commit(bm_be, "beacon", [M_beacon])

    # ---- PODIUM (GRAND LOBBY) ----
    bm_p = bmesh.new(); bm_pg = bmesh.new(); bm_pl = bmesh.new(); bm_pgold = bmesh.new()
    add_box(bm_p, (0, 0, 0.2), (W + 3.0, D + 3.0, 0.4), 0)
    for cx in (-W/2 - 0.5, W/2 + 0.5):
        for cy in (-D/2 - 0.5, D/2 + 0.5):
            add_cylinder(bm_p, (cx, cy, POD/2 + 0.2), 0.6, POD - 0.4, 0)
            add_cylinder(bm_pgold, (cx, cy, POD - 0.1), 0.7, 0.2, 0)
            add_cylinder(bm_pgold, (cx, cy, 0.5), 0.7, 0.2, 0)
    for face in FACES:
        wdt = face["wdt"]
        if face["front"]:
            panel(bm_pg, face, 0, 1.7, wdt - 1.0, 2.6, 0.05, 0.5, 0)
            panel(bm_pl, face, 0, 1.6, wdt - 0.8, 2.4, 0.05, 0.3, 0)
            panel(bm_pgold, face, 0, 3.2, wdt + 4.0, 0.4, 4.0, 2.5, 0)
            panel(bm_pl, face, 0, 3.0, wdt + 3.0, 0.05, 3.5, 2.5, 0)
            for bx in (-2, -1, 1, 2):
                panel(bm_pgold, face, bx * 1.5, 1.7, 0.15, 2.6, 0.3, 0.65, 0)
        else:
            panel(bm_p, face, 0, 1.7, wdt + 1.0, 2.6, 0.6, 0.5, 0)
            panel(bm_pl, face, 0, 1.7, 0.2, 2.0, 0.65, 0.55, 0)
    obj_p = commit(bm_p, "podium", [M_stone_light])
    obj_pg = commit(bm_pg, "podium_glass", [M_glass])
    obj_pl = commit(bm_pl, "podium_glow", [M_lobby])
    obj_pgold = commit(bm_pgold, "podium_gold", [M_gold])

    # ---- PLAZA & LANDSCAPE ----
    bm_pl2 = bmesh.new()
    add_box(bm_pl2, (0, 0, 0.02), (70, 70, 0.04), 0)
    add_box(bm_pl2, (0, 10, 0.03), (4, 20, 0.05), 1)
    obj_plaza = commit(bm_pl2, "plaza", [M_stone, M_stone_light])

    bm_w = bmesh.new()
    add_box(bm_w, (-6, 12, 0.05), (6, 10, 0.06), 0)
    add_box(bm_w, (6, 12, 0.05), (6, 10, 0.06), 0)
    obj_wat = commit(bm_w, "pool", [M_water])

    bm_tr = bmesh.new(); bm_tc = bmesh.new()
    tree_spots = [(-12, 10), (12, 10), (-12, 16), (12, 16), (-16, 4), (16, 4), (-16, -4), (16, -4)]
    for (tx, ty) in tree_spots:
        rt = bmesh.ops.create_cone(bm_tr, cap_ends=True, segments=12, radius1=0.25, radius2=0.15, depth=2.5)
        bmesh.ops.translate(bm_tr, vec=Vector((tx, ty, 1.25)), verts=rt["verts"])
        for (oz, rr) in [(2.8, 1.5), (3.6, 1.2), (3.2, 1.4), (4.2, 0.9)]:
            rc = bmesh.ops.create_icosphere(bm_tc, subdivisions=3, radius=rr)
            bmesh.ops.translate(bm_tc, vec=Vector((tx + RNG.uniform(-0.3, 0.3), ty + RNG.uniform(-0.3, 0.3), oz)), verts=rc["verts"])
    obj_tr = commit(bm_tr, "trunks", [M_trunk])
    obj_tc = commit(bm_tc, "canopies", [M_plant])

    bm_pln = bmesh.new(); bm_bo = bmesh.new()
    for (tx, ty) in tree_spots:
        add_box(bm_pln, (tx, ty, 0.3), (2.2, 2.2, 0.6), 0)
    for i in range(-4, 5):
        if abs(i) > 1:
            add_box(bm_bo, (i * 2.0, 16.0, 0.5), (0.15, 0.15, 1.0), 0)
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
    sc.cycles.samples = 128
    sc.cycles.use_adaptive_sampling = True
    try:
        sc.cycles.use_denoising = True; sc.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        pass
    try:
        sc.view_settings.look = "AgX - Medium High Contrast"
    except Exception:
        pass
    sc.view_settings.exposure = -0.1
    sc.render.resolution_x = 1200; sc.render.resolution_y = 1500
    sc.render.image_settings.file_format = "JPEG"; sc.render.image_settings.quality = 95
    w = bpy.data.worlds.new("W"); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (*col("#05050a"), 1)
    bg.inputs["Strength"].default_value = 0.5
    for (rot, en, c) in [((math.radians(60), 0, math.radians(45)), 3.0, "#aaccff"),
                         ((math.radians(75), 0, math.radians(220)), 2.0, "#ffbba0")]:
        L = bpy.data.lights.new("sun", "SUN"); L.energy = en; L.color = col(c); L.angle = math.radians(2)
        o = bpy.data.objects.new("sun", L); sc.collection.objects.link(o); o.rotation_euler = rot
    cam = bpy.data.cameras.new("cam"); cam.lens = 32
    co = bpy.data.objects.new("cam", cam); sc.collection.objects.link(co); sc.camera = co
    co.location = (25, 45, 12)
    d = Vector((0, 0, 18)) - Vector(co.location)
    co.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = PREVIEW

def export():
    # Export PBR materials with all extensions so three.js gets transmission /
    # clearcoat / emissive intact. Flatten transforms for the Web pipeline.
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
