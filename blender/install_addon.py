import bpy, zipfile, os

zip_path = r'C:\Users\user\Desktop\lumiere-residences\blender\building_tools.zip'

# Install / refresh add-on
bpy.ops.preferences.addon_install(filepath=zip_path, overwrite=True)

try:
    bpy.ops.preferences.addon_enable(module='building_tools')
    print('enabled building_tools OK')
except Exception as e:
    print('enable err', e)

# Verify
addons = [a.module for a in bpy.context.preferences.addons if a.module]
print('active addons:', addons)
print('building_tools active:', 'building_tools' in addons)
