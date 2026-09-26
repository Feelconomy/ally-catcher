"""Conform sewn features to the body and remove the studio plane from export."""
import bpy, math
from mathutils import Vector
scene=bpy.context.scene
body=bpy.data.objects['Continuous pear shaped body']
for v in body.data.vertices:
    t=v.co.z/.79
    v.co.x *= (1-.025*t)/(1-.17*t)

def surface(x,z):
    t=(z-.9)/.79
    return -.44*(1-.06*t)*math.sqrt(max(.0001,1-t*t-(x/(.69*(1-.025*t)))**2))

def conform(o,offset):
    matrix=o.matrix_local.copy(); inverse=matrix.inverted()
    center_y=o.location.y
    for v in o.data.vertices:
        p=matrix@v.co
        p.y=surface(p.x,p.z)+(p.y-center_y)-offset
        v.co=inverse@p

for o in list(body.parent.children):
    if o.type!='MESH':continue
    if o.name.startswith('Large oval eye white'):conform(o,.012)
    elif o.name.startswith('Brown oval iris'):conform(o,.077)
    elif o.name.startswith('Black pupil'):conform(o,.106)
    elif o.name.startswith('Eye highlight'):conform(o,.123)
    elif o.name.startswith('Round blush patch'):conform(o,.007)
    elif o.name=='Large ivory belly patch':conform(o,.008)
    elif o.name=='Small golden oval nose':conform(o,.028)

# Sample a closed Catmull-Rom curve so the smile has a sewn, rounded contour.
for name,offset in [('Wide happy mouth',.009),('Small upper tooth',.019),('Visible smiling tongue',.020)]:
    o=bpy.data.objects[name]; points=[v.co.copy() for v in o.data.vertices]; smooth=[]
    for i in range(len(points)):
        a,b,c,d=[points[j%len(points)] for j in [i-1,i,i+1,i+2]]
        for step in range(6):
            t=step/6
            p=.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
            smooth.append(p)
    center=sum(smooth,Vector())/len(smooth)
    verts=[(center.x,surface(center.x,center.z)-offset,center.z)]
    # Concentric rings prevent planar n-gons from floating over a curved belly.
    n=len(smooth);rings=10
    for j in range(1,rings+1):
        for p in smooth:
            v=center.lerp(p,j/rings);verts.append((v.x,surface(v.x,v.z)-offset,v.z))
    faces=[(0,1+i,1+(i+1)%n) for i in range(n)]
    for j in range(rings-1):
        start=1+j*n;nxt=start+n
        for i in range(n):faces.append((start+i,nxt+i,nxt+(i+1)%n,start+(i+1)%n))
    mesh=bpy.data.meshes.new(name+' fitted');mesh.from_pydata(verts,[],faces);mesh.update()
    mat=o.data.materials[0];o.data=mesh;o.data.materials.append(mat)
    for p in mesh.polygons:p.use_smooth=True
    o.modifiers.clear()

for mat in bpy.data.materials:
    if not mat.use_nodes:continue
    p=mat.node_tree.nodes.get('Principled BSDF')
    if p and ('plush' in mat.name or 'fabric' in mat.name or 'pads' in mat.name):
        p.inputs['Roughness'].default_value=1
        p.inputs['Specular IOR Level'].default_value=.16
        p.inputs['Sheen Weight'].default_value=.5
    for node in list(mat.node_tree.nodes):
        if node.type=='NORMAL_MAP':node.inputs['Strength'].default_value=.65
        if node.type=='VECT_MATH' and node.operation=='SCALE':node.inputs[3].default_value=2

scene.render.resolution_x=525;scene.render.resolution_y=600
if hasattr(scene,'eevee') and hasattr(scene.eevee,'taa_render_samples'):scene.eevee.taa_render_samples=16
scene.view_settings.view_transform='AgX'
camera=scene.camera
for name,loc in [('olly-front.png',(0,-5,.95)),('olly-side.png',(5,0,.95)),('olly-three-quarter.png',(3,-5,1.1))]:
    camera.location=loc;camera.rotation_euler=(Vector((0,0,.91))-camera.location).to_track_quat('-Z','Y').to_euler()
    target=artifacts.file(name=name,media_type='image/png');scene.render.filepath=str(target.path)
    bpy.ops.render.render(write_still=True);target.publish()
bpy.data.objects.remove(bpy.data.objects['Studio ground'],do_unlink=True)
result={'model':'OllyReference','sewn_features':'conformed to body','studio_floor':'removed from portable model'}
