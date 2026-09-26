"""Set image color space before writing pixels; changing it afterwards resets them."""
import bpy, numpy as np
from mathutils import Vector
image=bpy.data.images['Embedded microfibre normal']
image.colorspace_settings.name='Non-Color'
rng=np.random.default_rng(24)
pixels=np.ones((256,256,4),dtype=np.float32)
pixels[:,:,:2]=.5+rng.normal(0,.075,(256,256,2))
image.pixels.foreach_set(pixels.ravel());image.update();image.pack()
assert .1<image.pixels[0]<.9 and image.pixels[2]>.99
for mat in bpy.data.materials:
    if not mat.use_nodes:continue
    for node in mat.node_tree.nodes:
        if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.4
scene=bpy.context.scene
scene.view_settings.view_transform='Standard'
scene.view_settings.exposure=-.5
camera=scene.camera
for name,loc in [('olly-front.png',(0,-5,.95)),('olly-side.png',(5,0,.95)),('olly-three-quarter.png',(3,-5,1.1))]:
    camera.location=loc;camera.rotation_euler=(Vector((0,0,.91))-camera.location).to_track_quat('-Z','Y').to_euler()
    target=artifacts.file(name=name,media_type='image/png');scene.render.filepath=str(target.path)
    bpy.ops.render.render(write_still=True);target.publish()
result={'normal_pixels':list(image.pixels[:4]),'embedded_normal_verified':True}
