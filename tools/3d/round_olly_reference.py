"""Revision 4: flush eyes, continuous arms/feet, and a fuller body profile."""
import bpy, math
from mathutils import Vector
scene=bpy.context.scene
root=bpy.data.objects['OllyReference']
body=bpy.data.objects['Continuous pear shaped body']
lime=bpy.data.materials['Lime short pile plush']
pad=bpy.data.materials['Lime foot pads']

def surface(x,z,depth=.65):
    t=(z-.9)/.79
    return -depth*(1-.06*t)*math.sqrt(max(.0001,1-t*t-(x/(.69*(1-.025*t)))**2))

# Preserve each existing face/belly detail's distance from the fuller body.
for o in list(root.children):
    if o==body:continue
    if o.type=='MESH' and (o.name.startswith(('Round blush','Small golden','Large ivory')) or o.name in ['Wide happy mouth','Small upper tooth','Visible smiling tongue']):
        matrix=o.matrix_local.copy();inverse=matrix.inverted()
        for v in o.data.vertices:
            p=matrix@v.co;p.y+=surface(p.x,p.z)-surface(p.x,p.z,.44);v.co=inverse@p
    if o.name=='Top fabric centre seam':
        for spline in o.data.splines:
            for point in spline.points:
                point.co.y=surface(point.co.x,point.co.z)-.0016
    if o.name=='Ivory top tuft':o.scale.y*=1.35

# Resample the same front silhouette at higher resolution for flush facial patches.
bpy.ops.mesh.primitive_uv_sphere_add(segments=128,ring_count=96)
temp=bpy.context.object;body.data=temp.data.copy();bpy.data.objects.remove(temp,do_unlink=True)
body.data.materials.append(lime)
for v in body.data.vertices:
    x,y,z=v.co;v.co=(x*.69*(1-.025*z),y*.65*(1-.06*z),z*.79)
for p in body.data.polygons:p.use_smooth=True

remove_prefixes=('Large oval eye white','Brown oval iris','Black pupil','Eye highlight',
                 'Soft hanging arm','Rounded mitten','Thumb','Forward seated foot',
                 'Inset sole seam','Padded sole','Round heel cushion','Soft toe cushion')
for o in list(root.children):
    if o.name.startswith(remove_prefixes):bpy.data.objects.remove(o,do_unlink=True)

def patch(name,cx,cz,rx,rz,material,surface_fn,offset=.002,puff=0,tilt=0):
    vertices=[];faces=[];uvs=[];segments=64;rings=12
    def point(x,z,r):return (x,surface_fn(x,z)-offset-puff*(1-r*r)**2,z)
    vertices.append(point(cx,cz,0));uvs.append((.5,.5))
    for j in range(1,rings+1):
        r=j/rings
        for k in range(segments):
            a=2*math.pi*k/segments;dx=rx*r*math.cos(a);dz=rz*r*math.sin(a)
            x=cx+dx*math.cos(tilt)+dz*math.sin(tilt);z=cz-dx*math.sin(tilt)+dz*math.cos(tilt)
            vertices.append(point(x,z,r));uvs.append((.5+.5*r*math.cos(a),.5+.5*r*math.sin(a)))
    for i in range(segments):faces.append((0,1+i,1+(i+1)%segments))
    for j in range(rings-1):
        start=1+j*segments;nxt=start+segments
        for i in range(segments):faces.append((start+i,nxt+i,nxt+(i+1)%segments,start+(i+1)%segments))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    uv=mesh.uv_layers.new(name='UVMap')
    for poly in mesh.polygons:
        poly.use_smooth=True
        for li in poly.loop_indices:uv.data[li].uv=uvs[mesh.loops[li].vertex_index]
    obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);obj.parent=root;mesh.materials.append(material)
    return obj

for sign in [-1,1]:
    patch('Flush eye white',sign*.215,1.30,.147,.185,bpy.data.materials['Eye warm white'],surface,.002,tilt=sign*-.08)
    patch('Flush brown iris',sign*.189,1.29,.078,.103,bpy.data.materials['Chestnut iris'],surface,.003)
    patch('Flush pupil',sign*.184,1.29,.054,.077,bpy.data.materials['Deep pupil'],surface,.004)
    patch('Flush eye highlight',sign*.184+.022,1.333,.022,.025,bpy.data.materials['Eye warm white'],surface,.005)

    bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=48)
    arm=bpy.context.object;arm.name='Continuous soft arm';arm.parent=root;arm.data.materials.append(lime)
    for v in arm.data.vertices:
        x,y,z=v.co
        v.co=(sign*(.665-.05*z)+x*.18*(1-.10*z),-.14+.17*z+y*.25,.68+z*.39)
    for p in arm.data.polygons:p.use_smooth=True

    # A single deep ellipsoid runs from the buried upper leg to the rounded sole.
    cx=sign*.43;cy=-.30;cz=.255;rx=.275;ry=.46;rz=.285
    bpy.ops.mesh.primitive_uv_sphere_add(segments=96,ring_count=64)
    foot=bpy.context.object;foot.name='Continuous leg and padded foot';foot.parent=root;foot.data.materials.append(lime)
    for v in foot.data.vertices:
        x,y,z=v.co;v.co=(cx+x*rx,cy+y*ry,cz+z*rz)
    for p in foot.data.polygons:p.use_smooth=True
    def sole(x,z):return cy-ry*math.sqrt(max(.0001,1-((x-cx)/rx)**2-((z-cz)/rz)**2))
    patch('Soft heel pad',cx,cz-.045,.117,.105,pad,sole,.001,.026)
    for i in [-1,0,1]:
        patch('Soft rounded toe pad',cx+i*.098,cz+.114-abs(i)*.021,.061,.054,lime,sole,.001,.015)

scene.render.resolution_x=525;scene.render.resolution_y=600
scene.view_settings.view_transform='Standard';scene.view_settings.exposure=-.5
camera=scene.camera
for name,loc in [('olly-front.png',(0,-5,.95)),('olly-side.png',(5,0,.95)),('olly-three-quarter.png',(3,-5,1.1))]:
    camera.location=loc;camera.rotation_euler=(Vector((0,0,.91))-camera.location).to_track_quat('-Z','Y').to_euler()
    target=artifacts.file(name=name,media_type='image/png');scene.render.filepath=str(target.path)
    bpy.ops.render.render(write_still=True);target.publish()
result={'body_depth_before':.88,'body_depth_after':1.30,'eye_surface_offset_max':.005,
        'arms':'one continuous mesh each','feet':'one volumetric leg/foot mesh each, no flat sole disc',
        'normal_sample':list(bpy.data.images['Embedded microfibre normal'].pixels[:4])}
