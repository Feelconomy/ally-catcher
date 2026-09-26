"""Add the stuffed long earflaps visible in all three reference studies."""
import bpy, math, numpy as np
from mathutils import Vector
scene=bpy.context.scene;root=bpy.data.objects['TigerDuckReference']
def ball(name,p,s,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=48,location=p)
    o=bpy.context.object;o.name=name;o.scale=s;o.parent=root;o.data.materials.append(bpy.data.materials[material])
    for f in o.data.polygons:f.use_smooth=True
    return o
for sign in [-1,1]:
    ball('Stuffed ivory earflap',(sign*.674,-.245,1.075),(.162,.205,.435),'Warm ivory plush')
    ball('Orange earflap face',(sign*.674,-.40,1.095),(.127,.090,.377),'Tiger orange fleece')
    for k in range(3):
        c=bpy.data.curves.new('Earflap stripe','CURVE');c.dimensions='3D';c.bevel_depth=.014;c.bevel_resolution=3
        sp=c.splines.new('POLY');sp.points.add(23)
        for j,p in enumerate(sp.points):
            t=j/23;x=sign*(.59+.15*t);z=1.19+k*.10-.035*t
            y=-.40-.09*math.sqrt(max(.001,1-((x-sign*.674)/.127)**2-((z-1.095)/.377)**2))-.008
            p.co=(x,y,z,1)
        o=bpy.data.objects.new('Earflap stripe',c);scene.collection.objects.link(o);o.parent=root;c.materials.append(bpy.data.materials['Chocolate tiger stripes'])
for o in list(root.children):
    if not o.name.startswith(('Pink inner ear','Brown ear tip')):continue
    sign=1 if sum(v.co.x for v in o.data.vertices)>0 else -1
    for v in o.data.vertices:
        if o.name.startswith('Pink'):v.co.z=1.975+(v.co.z-1.985)*.90
        else:v.co.z=2.163+(v.co.z-2.15)*.73
        x,_,z=v.co;v.co.y=.015-.15*math.sqrt(max(.001,1-((x-sign*.535)/.25)**2-((z-1.98)/.255)**2))-.008
scene.view_settings.view_transform='Standard';scene.view_settings.exposure=-.5
for name,loc in [('tiger-front.png',(0,-5,1.1)),('tiger-side.png',(5,0,1.1)),('tiger-back.png',(0,5,1.1)),('tiger-angle.png',(3,-5,1.3))]:
    scene.camera.location=loc;scene.camera.rotation_euler=(Vector((0,0,1.1))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    target=artifacts.file(name=name,media_type='image/png');scene.render.filepath=str(target.path);bpy.ops.render.render(write_still=True);target.publish()
result={'earflaps':'stuffed ivory rim and orange face','ear_panels':'non-overlapping, fitted'}
