"""Reference-guided model using the generated front, side and rear study images."""
import bpy, math, numpy as np
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
scene=bpy.context.scene
scene.world=bpy.data.worlds.new('Soft studio');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.65,.68,.72,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.5
root=bpy.data.objects.new('TigerDuckReference',None);scene.collection.objects.link(root)
normal=bpy.data.images.new('Tiger duck microfibre',width=256,height=256);normal.colorspace_settings.name='Non-Color'
rng=np.random.default_rng(32);pixels=np.ones((256,256,4),dtype=np.float32);pixels[:,:,:2]=.5+rng.normal(0,.07,(256,256,2))
normal.pixels.foreach_set(pixels.ravel());normal.update();normal.pack()

def mat(name,color,plush=True,rough=.9):
    m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough
    if plush:
        p.inputs['Sheen Weight'].default_value=.35;p.inputs['Specular IOR Level'].default_value=.18
        tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=normal
        bump=m.node_tree.nodes.new('ShaderNodeNormalMap');bump.inputs['Strength'].default_value=.35
        m.node_tree.links.new(tex.outputs['Color'],bump.inputs['Color']);m.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
    return m
yellow=mat('Duck yellow plush',(.98,.71,.025));orange=mat('Tiger orange fleece',(1,.36,.018))
cream=mat('Warm ivory plush',(.94,.85,.65));brown=mat('Chocolate tiger stripes',(.10,.035,.012))
pink=mat('Pink inner ears and blush',(.96,.27,.32));white=mat('Flat eye white',(.99,.97,.87),False,.65)
iris=mat('Brown iris',(.055,.018,.005),False,.5);black=mat('Deep pupil',(.006,.002,.001),False,.45)
beakmat=mat('Golden orange beak',(1,.43,.003),False,.7);mouthmat=mat('Mouth velvet',(.06,.003,.001),False)
tonguemat=mat('Warm rose tongue',(.65,.045,.035),False);footmat=mat('Orange padded feet',(.90,.40,.016))

def mesh(name,verts,faces,material,uvs=None):
    data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
    o=bpy.data.objects.new(name,data);scene.collection.objects.link(o);o.parent=root;data.materials.append(material)
    if uvs:
        uv=data.uv_layers.new(name='UVMap')
        for poly in data.polygons:
            for li in poly.loop_indices:uv.data[li].uv=uvs[data.loops[li].vertex_index]
    for p in data.polygons:p.use_smooth=True
    return o
def ball(name,p,s,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64,ring_count=40,location=p)
    o=bpy.context.object;o.name=name;o.scale=s;o.parent=root;o.data.materials.append(material)
    for poly in o.data.polygons:poly.use_smooth=True
    return o
def tube(name,points,radius,material):
    c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=radius;c.bevel_resolution=4
    sp=c.splines.new('POLY');sp.points.add(len(points)-1)
    for p,co in zip(sp.points,points):p.co=(*co,1)
    o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.parent=root;c.materials.append(material);return o
def front(x,z):
    t=(z-.90)/.85
    return -.58*(1-.05*t)*math.sqrt(max(.001,1-t*t-(x/(.67*(1-.035*t)))**2))
body=ball('Full yellow body',(0,0,.90),(1,1,1),yellow)
for v in body.data.vertices:
    x,y,z=v.co;v.co=(x*.67*(1-.035*z),y*.58*(1-.05*z),z*.85)

def disk(name,cx,cz,rx,rz,material,surf=front,offset=.004,puff=0):
    verts=[(cx,surf(cx,cz)-offset-puff,cz)];uvs=[(.5,.5)];faces=[];n=64;rings=12
    for j in range(1,rings+1):
        r=j/rings
        for k in range(n):
            a=k*2*math.pi/n;x=cx+rx*r*math.cos(a);z=cz+rz*r*math.sin(a)
            verts.append((x,surf(x,z)-offset-puff*(1-r*r)**2,z));uvs.append((.5+.5*r*math.cos(a),.5+.5*r*math.sin(a)))
    for k in range(n):faces.append((0,k+1,1+(k+1)%n))
    for j in range(rings-1):
        start=1+j*n;nxt=start+n
        for k in range(n):faces.append((start+k,nxt+k,nxt+(k+1)%n,start+(k+1)%n))
    return mesh(name,verts,faces,material,uvs)

disk('Ivory belly',0,.49,.32,.31,cream,puff=.035)
for sign in [-1,1]:
    disk('Duck white eye',sign*.225,1.29,.142,.177,white,offset=.006)
    disk('Duck iris',sign*.201,1.275,.076,.093,iris,offset=.009)
    disk('Duck pupil',sign*.199,1.275,.054,.067,black,offset=.011)
    disk('Eye catchlight',sign*.199+.021,1.312,.020,.021,white,offset=.013)
    disk('Pink cheek',sign*.407,1.064,.087,.09,pink,offset=.009,puff=.008)
    for i in [0,1]:
        pts=[]
        for t in np.linspace(0,1,12):
            x=sign*(.25+.04*i+.02*t);z=1.44+.065*t-i*.012;pts.append((x,front(x,z)-.008,z))
        tube('Embroidered eyelash',pts,.009,brown)

# Open beak: curved upper and lower shells around a recessed mouth.
def upper(x):return 1.055+.125*(1-(abs(x)/.24)**.65)
def lower(x):return 1.055-.175*math.sqrt(max(0,1-(x/.24)**2))
verts=[];faces=[];uvs=[];n=80;rows=16
for j in range(rows+1):
    t=j/rows
    for i in range(n+1):
        x=-.24+.48*i/n;z=lower(x)*(1-t)+upper(x)*t
        verts.append((x,-.755+.06*(x/.24)**2,z));uvs.append((i/n,t))
for j in range(rows):
    for i in range(n):
        a=j*(n+1)+i;faces.append((a,a+1,a+n+2,a+n+1))
mesh('Dark open smiling mouth',verts,faces,mouthmat,uvs)
for name,edge,top in [('Upper beak',upper,True),('Lower beak',lower,False)]:
    verts=[];faces=[];uvs=[]
    for j in range(9):
        t=j/8
        for i in range(n+1):
            x=-.24+.48*i/n;rim=edge(x)
            z=rim+(.038 if top else -.022)*math.sin(math.pi*t)
            y=(-.785+.075*(x/.24)**2)*(1-t)+(front(x,rim)+.015)*t
            verts.append((x,y,z));uvs.append((i/n,t))
    for j in range(8):
        for i in range(n):
            a=j*(n+1)+i;faces.append((a,a+1,a+n+2,a+n+1))
    shell=mesh(name,verts,faces,beakmat,uvs);solid=shell.modifiers.new('Soft beak thickness','SOLIDIFY');solid.thickness=.025
    tube(name+' rolled edge',[(x,-.785+.075*(x/.24)**2,edge(x)) for x in np.linspace(-.24,.24,81)],.021,beakmat)
ball('Small smiling tongue',(0,-.775,.915),(.102,.028,.043),tonguemat)

for sign in [-1,1]:
    wing=ball('Soft mitten wing',(sign*.50,-.285,.55),(.205,.24,.245),yellow)
    wing.rotation_euler[1]=sign*.4
    ball('Inner wing tip',(sign*.37,-.40,.57),(.11,.125,.115),yellow)
    cx=sign*.43;cy=-.30;cz=.225
    ball('Rounded foot',(cx,cy,cz),(.27,.39,.25),yellow)
    def sole(x,z):return cy-.39*math.sqrt(max(.001,1-((x-cx)/.27)**2-((z-cz)/.25)**2))
    disk('Orange sole',cx,cz,.235,.222,footmat,sole,.005,.032)
    disk('Heel cushion',cx,cz-.055,.12,.105,footmat,sole,.04,.028)
    for i in [-1,0,1]:disk('Toe cushion',cx+i*.104,cz+.12-abs(i)*.025,.063,.069,footmat,sole,.035,.022)

# Wrap the hood from the front arch around the side flaps and the upper back.
def hoodpoint(phi,t):
    bottom=.67+.94*max(math.cos(phi),0)**4+.15*max(-math.cos(phi),0)
    z=bottom+(1.96-bottom)*t;q=(z-1.03)/.94;r=math.sqrt(max(.00001,1-q*q))
    return (.79*r*math.sin(phi),-.69*r*math.cos(phi),z)
verts=[];uvs=[];faces=[];columns=192;rows=72
for j in range(rows+1):
    for i in range(columns+1):
        phi=2*math.pi*i/columns;verts.append(hoodpoint(phi,j/rows));uvs.append((i/columns,j/rows))
for j in range(rows):
    for i in range(columns):
        a=j*(columns+1)+i;faces.append((a,a+1,a+columns+2,a+columns+1))
hood=mesh('Tiger hood crown back and earflaps',verts,faces,orange,uvs);hood.data.materials.append(brown)
for poly in hood.data.polygons:
    p=poly.center;x,y,z=p
    back=y>.04;side=abs(x)>.51
    stripe=back and math.sin(19*z+1.2*math.cos(5*x))>.65
    stripe|=side and math.sin(21*z+2.2*y)>.70
    stripe|=y<-.05 and z>1.78 and abs(x)<(.17 if int(z*35)%2==0 else .10)
    if stripe:poly.material_index=1
solid=hood.modifiers.new('Stuffed hood thickness','SOLIDIFY');solid.thickness=.07
tube('Ivory hood opening rim',[hoodpoint(2*math.pi*i/256,0) for i in range(257)],.068,cream)

def hoodfront(x,z):return -.69*math.sqrt(max(.001,1-((z-1.03)/.94)**2-(x/.79)**2))
disk('Tiger ivory muzzle',0,1.736,.215,.098,cream,hoodfront,.018,.024)
for sign in [-1,1]:
    ball('Round tiger ear',(sign*.535,.015,1.98),(.25,.15,.255),orange)
    earfront=lambda x,z,s=sign:-.14-.025*math.sqrt(max(0,1-((x-s*.535)/.19)**2-((z-1.98)/.21)**2))
    disk('Pink inner ear',sign*.535,1.985,.125,.15,pink,earfront,.003,.012)
    # Dark ear tip is a fitted patch, not a detached sphere.
    disk('Brown ear tip',sign*.535,2.15,.15,.058,brown,lambda x,z,s=sign:-.15*math.sqrt(max(.001,1-((x-s*.535)/.25)**2-((z-1.98)/.255)**2)),.005)
    disk('Tiger embroidered eye',sign*.237,1.80,.040,.042,brown,hoodfront,.006)
    for k in range(2):
        points=[]
        for t in np.linspace(0,1,20):
            x=sign*(.32+.15*t);z=1.75-k*.075+.045*t
            points.append((x,hoodfront(x,z)-.01,z))
        tube('Tiger cheek stripe',points,.018,brown)
ball('Tiger nose',(0,hoodfront(0,1.813)-.03,1.813),(.070,.04,.040),brown)
for sign in [-1,1]:
    pts=[]
    for t in np.linspace(0,1,32):
        x=sign*.13*t;z=1.79-.06*math.sin(math.pi*t*.85)
        pts.append((x,hoodfront(x,z)-.065,z))
    tube('Tiger stitched smile',pts,.008,brown)

# One continuous tail with material bands, curving toward the character's right.
verts=[];faces=[];uvs=[];segments=80;sides=24
for j in range(segments+1):
    t=j/segments
    center=Vector((-.02-.94*t,.45+.19*math.sin(math.pi*t),.29+.19*t+.20*t*t))
    tangent=Vector((-.94,.19*math.pi*math.cos(math.pi*t),.19+.40*t)).normalized()
    right=tangent.cross(Vector((0,0,1))).normalized();up=right.cross(tangent).normalized()
    radius=.125*(.6+.4*math.sin(math.pi*min(1,t*1.3)))
    if t>.93:radius*=math.sqrt(max(.001,(1-t)/.07))
    for i in range(sides):
        a=2*math.pi*i/sides;p=center+radius*(math.cos(a)*right+math.sin(a)*up)
        verts.append(tuple(p));uvs.append((i/sides,t))
for j in range(segments):
    for i in range(sides):faces.append((j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i))
tail=mesh('Curved striped tiger tail',verts,faces,orange,uvs);tail.data.materials.append(brown);tail.data.materials.append(cream)
for p in tail.data.polygons:
    t=(p.index//sides+.5)/segments;p.material_index=2 if t>.85 else (1 if int(t*9)%2 else 0)

for name,loc,power,size in [('Key',(-3,-4,5),400,4),('Fill',(3,-2,3),180,3),('Rim',(0,3,4),320,3)]:
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();scene.camera=bpy.context.object;scene.camera.name='Tiger review camera';scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=2.7
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=525;scene.render.resolution_y=600;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.media_type='IMAGE'
if hasattr(scene.eevee,'taa_render_samples'):scene.eevee.taa_render_samples=16
scene.view_settings.view_transform='Standard';scene.view_settings.exposure=-.5
for name,loc in [('tiger-front.png',(0,-5,1.1)),('tiger-side.png',(-5,0,1.1)),('tiger-back.png',(0,5,1.1)),('tiger-angle.png',(3,-5,1.3))]:
    scene.camera.location=loc;scene.camera.rotation_euler=(Vector((0,0,1.1))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    target=artifacts.file(name=name,media_type='image/png');scene.render.filepath=str(target.path);bpy.ops.render.render(write_still=True);target.publish()
root['reference_views']='front,side,back';root['source_method']='manual geometry based on generated three-view study'
result={'root':root.name,'parts':len(root.children),'reference_views':['front','side','back'],'normal_sample':list(normal.pixels[:4])}
