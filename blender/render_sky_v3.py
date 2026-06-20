"""Minimal sky render — sky texture -> background, Filmic tonemapping.
Camera oriented to look at horizon (center of equirect = horizon line).
"""
import bpy
import math
import os

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "sky")
os.makedirs(OUTPUT_DIR, exist_ok=True)

def render_sky(name, elev, rot, sun_int, turbidity, sun_size, aerosol, exposure):
    scene = bpy.context.scene
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    cam_data = bpy.data.cameras.new("SkyCam")
    cam_data.type = 'PANO'
    cam_data.panorama_type = 'EQUIRECTANGULAR'
    cam = bpy.data.objects.new("SkyCam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (0, 0, 0)
    # In Blender, camera looks down -Z by default.
    # Rotate 90° around X to look at horizon (forward = +Y becomes center of equirect).
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = cam

    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'
    scene.cycles.samples = 128
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 4096
    scene.render.resolution_y = 2048
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 92
    scene.render.image_settings.color_mode = 'RGB'
    scene.view_settings.view_transform = 'Filmic'
    scene.view_settings.look = 'Medium High Contrast'
    scene.view_settings.exposure = exposure

    if scene.world is None:
        scene.world = bpy.data.worlds.new("SkyWorld")
    scene.world.use_nodes = True
    nt = scene.world.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)

    sky = nt.nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'HOSEK_WILKIE'
    sky.sun_elevation = math.radians(elev)
    sky.sun_rotation = math.radians(rot)
    sky.air_density = 1.0
    sky.aerosol_density = aerosol
    sky.sun_size = math.radians(sun_size)
    sky.sun_intensity = sun_int
    sky.sun_disc = True
    sky.turbidity = turbidity
    sky.ground_albedo = 0.3

    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = 1.0

    out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])

    out_path = os.path.join(OUTPUT_DIR, f"{name}.jpg")
    scene.render.filepath = out_path
    print(f"  Rendering {name} (elev={elev} rot={rot} sun_int={sun_int} turb={turbidity} exp={exposure})...")
    bpy.ops.render.render(write_still=True)
    sz = os.path.getsize(out_path) if os.path.exists(out_path) else 0
    print(f"    OK: {sz:,} bytes")
    return out_path

if __name__ == "__main__":
    print("=== SKY RENDER v3 (minimal, horizon-oriented) ===")
    # Day — vivid blue sky, sun at 25° elevation, golden hour warmth
    render_sky("day", elev=25, rot=145, sun_int=10, turbidity=2.0, sun_size=3.0, aerosol=0.8, exposure=2.0)
    # Night — twilight, sun just below horizon
    render_sky("night", elev=-5, rot=145, sun_int=5, turbidity=3.0, sun_size=2.0, aerosol=2.0, exposure=2.5)
    print("=== DONE ===")
