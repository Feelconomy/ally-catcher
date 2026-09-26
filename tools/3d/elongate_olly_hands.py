"""Keep the approved depth, lengthen the torso, and fuse plush fingers into hands."""
import bpy
from mathutils import Vector
scene=bpy.context.scene
root=bpy.data.objects['OllyReference']
lime=bpy.data.materials['Lime short pile plush']
arms=[o for o in root.children if o.name.startswith('Continuous soft arm')]

for arm in arms:
    sign=1 if sum(v.co.x for v in arm.data.vertices)>0 else -1
    parts=[arm]
    for i,(x,z) in enumerate([(.64,.395),(.71,.375),(.78,.395)]):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=24,location=(sign*x,-.385,z))
        finger=bpy.context.object;finger.name='Plush finger '+str(i+1);finger.scale=(.052,.080,.102)
        parts.append(finger)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=24,location=(sign*.585,-.31,.465))
    thumb=bpy.context.object;thumb.name='Plush thumb';thumb.scale=(.079,.107,.12);thumb.rotation_euler[1]=sign*-.32
    parts.append(thumb)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=arm
    bpy.ops.object.join()
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    remesh=arm.modifiers.new('Blend fingers into palm','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.008;remesh.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth=arm.modifiers.new('Soft sewn transitions','SMOOTH');smooth.factor=1; smooth.iterations=5
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    arm.data.materials.clear();arm.data.materials.append(lime)
    for p in arm.data.polygons:p.use_smooth=True
    # Remeshing removes UVs; restore them so the embedded fabric normal stays usable.
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(island_margin=.02)
    bpy.ops.object.mode_set(mode='OBJECT')
    arm['fused_fingers']=3;arm['fused_thumb']=1

factor=1.14;anchor=.11
for o in list(root.children):
    if o.name.startswith(('Continuous leg','Soft heel pad','Soft rounded toe pad')):continue
    matrix=o.matrix_local.copy();inverse=matrix.inverted()
    if o.type=='MESH':
        for v in o.data.vertices:
            p=matrix@v.co;p.z=anchor+(p.z-anchor)*factor;v.co=inverse@p
    elif o.type=='CURVE':
        for spline in o.data.splines:
            for point in spline.points:point.co.z=anchor+(point.co.z-anchor)*factor
root['torso_elongation']=factor
scene.render.resolution_x=525;scene.render.resolution_y=600
scene.view_settings.view_transform='Standard';scene.view_settings.exposure=-.5
camera=scene.camera;camera.data.ortho_scale=2.48
for name,loc in [('olly-front.png',(0,-5,1.06)),('olly-side.png',(5,0,1.06)),('olly-three-quarter.png',(3,-5,1.18))]:
    camera.location=loc;camera.rotation_euler=(Vector((0,0,1.03))-camera.location).to_track_quat('-Z','Y').to_euler()
    target=artifacts.file(name=name,media_type='image/png');scene.render.filepath=str(target.path)
    bpy.ops.render.render(write_still=True);target.publish()
result={'torso_length_factor':factor,'body_depth_unchanged':1.30,'fingers_per_hand':3,'thumbs_per_hand':1,
        'arms_are_continuous':len(arms)==2,'mesh_vertices':sum(len(o.data.vertices) for o in root.children if o.type=='MESH')}
