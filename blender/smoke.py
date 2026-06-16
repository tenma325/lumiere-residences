import bpy, sys, time

print("BLENDER_VERSION:", bpy.app.version_string)

# Try to enable a GPU backend; fall back to CPU.
chosen = "CPU"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for ct in ("OPTIX", "CUDA", "HIP", "ONEAPI", "METAL"):
        try:
            prefs.compute_device_type = ct
        except Exception:
            continue
        try:
            prefs.refresh_devices()
        except Exception:
            pass
        devs = [d for d in prefs.devices if d.type == ct]
        if devs:
            for d in prefs.devices:
                d.use = (d.type == ct) or (d.type == "CPU" and False)
            chosen = ct
            print("GPU_BACKEND:", ct, "DEVICES:", [d.name for d in devs])
            break
except Exception as e:
    print("GPU_SETUP_ERR:", e)
print("CHOSEN_DEVICE:", chosen)

# Minimal scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "GPU" if chosen != "CPU" else "CPU"
scene.cycles.samples = 16
scene.render.resolution_x = 96
scene.render.resolution_y = 64
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = "C:/Users/user/Desktop/lumiere-residences/blender/_smoke.png"

mesh = bpy.data.meshes.new("c")
bpy.ops.mesh.primitive_cube_add(size=2, location=(0, 0, 0))
cam_data = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
cam.location = (5, -5, 4)
cam.rotation_euler = (1.1, 0, 0.78)
scene.camera = cam
light = bpy.data.lights.new("sun", "SUN")
light.energy = 4
lo = bpy.data.objects.new("sun", light)
scene.collection.objects.link(lo)
lo.rotation_euler = (0.6, 0.2, 0.3)

t0 = time.time()
bpy.ops.render.render(write_still=True)
print("RENDER_OK in %.1fs" % (time.time() - t0))
