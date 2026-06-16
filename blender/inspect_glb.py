import bpy
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r'C:\Users\user\Desktop\lumiere-residences\public\models\tower.glb')
objs = bpy.context.scene.collection.objects
print('OBJECTS', len(objs))
verts = sum(len(o.data.vertices) for o in objs if o.type=='MESH')
faces = sum(len(o.data.polygons) for o in objs if o.type=='MESH')
print('VERTS', verts, 'FACES', faces)
for o in objs:
    print(o.name, o.type, o.location)
