"""Round the hood opening and replace stepped face-material stripes with a smooth map."""
import bpy, math, numpy as np
from mathutils import Vector
scene=bpy.context.scene;hood=bpy.data.objects['Tiger hood crown back and earflaps']
def hoodpoint(phi,t):
    bottom=.67+.94*max(math.cos(phi),0)**.7+.15*max(-math.cos(phi),0)
    z=bottom+(1.96-bottom)*t;q=(z-1.03)/.94;r=math.sqrt(max(.00001,1-q*q))
    return (.79*r*math.sin(phi),-.69*r*math.cos(phi),z)
for j in range(73):
    for i in range(193):hood.data.vertices[j*193+i].co=hoodpoint(2*math.pi*i/192,j/72)
rim=bpy.data.objects['Ivory hood opening rim']
for i,p in enumerate(rim.data.splines[0].points):p.co=(*hoodpoint(2*math.pi*i/256,0),1)

size=1024
u,v=np.meshgrid((np.arange(size)+.5)/size,(np.arange(size)+.5)/size)
phi=u*2*np.pi;c=np.cos(phi)
bottom=.67+.94*np.maximum(c,0)**.7+.15*np.maximum(-c,0)
z=bottom+(1.96-bottom)*v;r=np.sqrt(np.maximum(.00001,1-((z-1.03)/.94)**2))
x=.79*r*np.sin(phi);y=-.69*r*c
soft=lambda a:np.clip(a/.025+.5,0,1)
back=soft(y-.02)*soft(np.sin(19*z+.25*np.cos(4*x))-.64)
side=soft(np.abs(x)-.51)*soft(np.sin(19*z+1.3*y)-.65)
forehead=soft(-y-.05)*soft(z-1.775)*soft(1.905-z)*soft(.15-np.abs(x))*soft(np.sin(110*z)-.05)
stripe=np.maximum.reduce([back,side,forehead])
rgba=np.ones((size,size,4),dtype=np.float32)
orange=np.array([1,.63,.15]);brown=np.array([.31,.15,.075])
rgba[:,:,:3]=orange[None,None,:]*(1-stripe[:,:,None])+brown[None,None,:]*stripe[:,:,None]
image=bpy.data.images.new('Smooth tiger hood stripes',width=size,height=size);image.colorspace_settings.name='sRGB'
image.pixels.foreach_set(rgba.ravel());image.update();image.pack()
material=bpy.data.materials['Tiger orange fleece'].copy();material.name='Textured continuous tiger hood'
tex=material.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
material.node_tree.links.new(tex.outputs['Color'],material.node_tree.nodes['Principled BSDF'].inputs['Base Color'])
hood.data.materials.clear();hood.data.materials.append(material)
for p in hood.data.polygons:p.material_index=0

for o in bpy.data.objects['TigerDuckReference'].children:
    if not o.name.startswith(('Pink inner ear','Brown ear tip')):continue
    sign=1 if sum(v.co.x for v in o.data.vertices)>0 else -1
    for point in o.data.vertices:
        x,_,z=point.co
        point.co.y=.015-.15*math.sqrt(max(.001,1-((x-sign*.535)/.25)**2-((z-1.98)/.255)**2))-.004

scene.view_settings.view_transform='Standard';scene.view_settings.exposure=-.5
for name,loc in [('tiger-front.png',(0,-5,1.1)),('tiger-side.png',(5,0,1.1)),('tiger-back.png',(0,5,1.1)),('tiger-angle.png',(3,-5,1.3))]:
    scene.camera.location=loc;scene.camera.rotation_euler=(Vector((0,0,1.1))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    target=artifacts.file(name=name,media_type='image/png');scene.render.filepath=str(target.path);bpy.ops.render.render(write_still=True);target.publish()
result={'hood_opening':'rounded, wide face reveal','stripes':'embedded 1024px antialiased texture','ears':'surface fitted','source_views':['front','side','back']}
