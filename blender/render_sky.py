"""Render photoreal equirectangular sky images (day + night) with Blender Cycles
using the Nishita physically-based atmospheric scattering model.

Outputs:
  public/sky/day.jpg   — warm afternoon sky with sun glow
  public/sky/night.jpg — deep dusk/night gradient with horizon haze

Run headlessly:
  blender --background --python blender/render_sky.py
"""
import bpy
import math
import os
import sys

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "sky")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Scene / camera setup — equirectangular panoramic camera at origin looking up
# ---------------------------------------------------------------------------
def setup_scene():
    scene = bpy.context.scene

    # Remove default objects
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    # Camera — panoramic equirectangular
    cam_data = bpy.data.cameras.new("SkyCam")
    cam_data.type = 'PANO'
    cam_data.panorama_type = 'EQUIRECTANGULAR'
    cam = bpy.data.objects.new("SkyCam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (0, 0, 0)
    cam.rotation_euler = (0, 0, 0)  # look forward; equirect covers full sphere
    scene.camera = cam

    # Render settings — Cycles for physical sky
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'
    scene.cycles.samples = 128
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 4096
    scene.render.resolution_y = 2048
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    # Standard transform preserves the sky texture's vivid colors for web use.
    # AgX compresses sky-only renders into flat mid-tone gradients.
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0

    # Color management — sRGB output for direct web use
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 92
    scene.render.image_settings.color_mode = 'RGB'

    return scene


def set_sky(world, sun_elevation_deg, sun_rotation_deg, air_density, aerosol_density, sun_size_deg):
    """Configure physically-based sky texture on the world background.
    Uses MULTIPLE_SCATTERING model (most physically accurate in Blender 5.1)."""
    world.use_nodes = True
    nt = world.node_tree
    # Clear existing nodes
    for n in list(nt.nodes):
        nt.nodes.remove(n)

    sky = nt.nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'HOSEK_WILKIE'
    sky.sun_elevation = math.radians(sun_elevation_deg)
    sky.sun_rotation = math.radians(sun_rotation_deg)
    sky.air_density = air_density
    sky.aerosol_density = aerosol_density
    sky.sun_size = math.radians(sun_size_deg)
    sky.sun_intensity = 15.0
    sky.sun_disc = True
    sky.turbidity = 2.0
    sky.ground_albedo = 0.3

    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = 1.0

    out = nt.nodes.new('ShaderNodeOutputWorld')

    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])


def render_sky(name, sun_elevation, sun_rotation, air_density, aerosol_density, sun_size):
    scene = setup_scene()
    if scene.world is None:
        scene.world = bpy.data.worlds.new("SkyWorld")
    set_sky(scene.world, sun_elevation, sun_rotation, air_density, aerosol_density, sun_size)

    out_path = os.path.join(OUTPUT_DIR, f"{name}.jpg")
    scene.render.filepath = out_path

    print(f"  Rendering {name} -> {out_path} (sun_elev={sun_elevation}°, rot={sun_rotation}°)")
    bpy.ops.render.render(write_still=True)

    if os.path.exists(out_path):
        sz = os.path.getsize(out_path)
        print(f"    OK: {sz:,} bytes ({sz/1024:.0f} KB)")
    else:
        print(f"    FAILED: output not found")
    return out_path


if __name__ == "__main__":
    print("=== Photoreal Sky Render (Blender Cycles / Nishita) ===")

    # Day — warm late afternoon, sun mid-high, golden tones
    render_sky(
        "day",
        sun_elevation=28,      # sun well above horizon
        sun_rotation=145,      # sun from front-right
        air_density=1.0,
        aerosol_density=1.5,   # light haze
        sun_size=2.5,          # visible sun disc
    )

    # Night — sun below horizon, deep blue twilight with warm horizon glow
    render_sky(
        "night",
        sun_elevation=-6,      # just below horizon → twilight
        sun_rotation=145,
        air_density=1.0,
        aerosol_density=3.0,   # more haze → horizon glow
        sun_size=2.0,
    )

    print("=== Done ===")
