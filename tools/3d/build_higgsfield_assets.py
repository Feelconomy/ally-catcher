"""Run in Higgsfield 3D Jutsu (Blender 5.2). Coordinates below are Y-up metres."""
import bpy, math
from mathutils import Vector

def pos(p): return (p[0], -p[2], p[1])
def material(name, color, metallic=0, roughness=.4, alpha=1):
    m=bpy.data.materials.new(name); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value=(*color,alpha)
    p.inputs['Metallic'].default_value=metallic
    p.inputs['Roughness'].default_value=roughness
    p.inputs['Alpha'].default_value=alpha
    if alpha<1: m.surface_render_method='DITHERED'
    return m
mint=material('Mint enamel',(.25,.68,.48),.25,.26)
edge=material('Pale mint trim',(.66,.91,.77),.15,.28)
floor=material('Mint floor',(.46,.76,.60),.12,.38)
gold=material('Gold claw',(.95,.66,.08),.72,.24)
chrome=material('Steel',(.63,.72,.72),.8,.22)
glass=material('Clear acrylic',(.83,.98,.92),.05,.12,.12)
white=material('Warm ivory',(.98,.92,.73),0,.8)
black=material('Soft charcoal',(.035,.052,.043),.1,.45)
pink=material('Blush',(.98,.39,.40),0,.8)
fur=material('Honey plush',(.79,.46,.20),0,.95)
green=material('Green joystick',(.015,.42,.18),.2,.18)
lamp=material('Lamp diffuser', (1,.97,.70),0,.25)
lp=lamp.node_tree.nodes.get('Principled BSDF');lp.inputs['Emission Color'].default_value=(1,.91,.6,1);lp.inputs['Emission Strength'].default_value=2

def group(name, location=(0,0,0)):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=pos(location);return o
def finish(o,name,mat,parent):
    o.name=name;o.data.materials.append(mat)
    if parent:o.parent=parent
    return o
def box(name, location, size, mat, parent=None, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos(location));o=bpy.context.object
    o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        b=o.modifiers.new('Soft edges','BEVEL');b.width=bevel;b.segments=3
        o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return finish(o,name,mat,parent)
def ball(name,location,size,mat,parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=pos(location));o=bpy.context.object
    o.scale=(size[0],size[2],size[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for p in o.data.polygons:p.use_smooth=True
    return finish(o,name,mat,parent)
def rod(name,a,b,r,mat,parent):
    va,vb=Vector(pos(a)),Vector(pos(b));d=vb-va
    bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=r,depth=d.length,location=(va+vb)/2)
    o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return finish(o,name,mat,parent)

cab=group('Cabinet')
box('Floor',(0,-.08,0),(2.65,.16,1.95),floor,cab)
box('Back wall',(0,1.68,-.94),(2.65,3.5,.10),floor,cab)
box('Ceiling',(0,3.45,0),(2.7,.14,1.95),mint,cab)
for x in [-1.28,1.28]:
    for z in [-.9,.9]: box('Frame post',(x,1.7,z),(.10,3.45,.10),mint,cab,.04)
    box('Side glass',(x,1.72,0),(.025,3.28,1.77),glass,cab,.008)
for y in [0,3.40]:
    box('Front rim',(0,y,.92),(2.62,.10,.10),edge,cab)
for x in [-.7,.7]:
    ball('Ceiling lamp',(x,3.33,0),(.19,.04,.19),lamp,cab)
    bpy.ops.object.light_add(type='POINT',location=pos((x,3.15,.1)))
    bpy.context.object.data.energy=35;bpy.context.object.data.color=(1,.92,.7)
box('Control deck',(0,-.31,1.01),(2.7,.38,.65),mint,cab,.09)
box('Console inlay',(0,-.10,1.04),(2.42,.035,.49),edge,cab,.04)

chute=group('Chute',(-.91,0,.53))
for x in [-.31,.31]:box('Chute side',(x,.36,0),(.025,.72,.62),glass,chute,.006)
for z in [-.30,.30]:box('Chute face',(0,.36,z),(.64,.72,.025),glass,chute,.006)
for x in [-.31,.31]:
    for z in [-.3,.3]: rod('Acrylic corner',(x,.01,z),(x,.72,z),.012,edge,chute)
for y in [.02,.72]:
    for z in [-.3,.3]:rod('Acrylic rim',(-.31,y,z),(.31,y,z),.014,edge,chute)
    for x in [-.31,.31]:rod('Acrylic rim',(x,y,-.3),(x,y,.3),.014,edge,chute)

gantry=group('Gantry',(0,3.06,0))
rod('Cross rail',(-1.18,0,0),(1.18,0,0),.035,chrome,gantry)
carriage=group('Carriage',(0,3.06,0));box('Motor housing',(0,0,0),(.27,.17,.22),edge,carriage)
claw=group('Claw',(0,2.72,0))
ball('Claw housing',(0,0,0),(.16,.08,.16),gold,claw)
rod('Spindle',(0,.02,0),(0,.17,0),.035,chrome,claw)
for i in range(3):
    angle=i*math.tau/3
    g=group('Finger'+str(i));g.parent=claw
    def radial(r,y):return (math.cos(angle)*r,y,math.sin(angle)*r)
    rod('Finger upper',radial(.12,-.035),radial(.24,-.22),.022,gold,g)
    rod('Finger lower',radial(.24,-.22),radial(.22,-.38),.022,gold,g)
    rod('Finger tip',radial(.22,-.38),radial(.14,-.43),.026,gold,g)

joystick=group('Joystick',(-.82,-.04,1.05))
ball('Joystick base',(0,0,0),(.20,.045,.15),chrome,joystick)
handle=group('JoystickHandle');handle.parent=joystick
rod('Joystick shaft',(0,0,0),(0,.25,0),.025,chrome,handle)
ball('Joystick ball',(0,.28,0),(.10,.10,.10),green,handle)
button=group('DropButton',(.82,-.03,1.05));ball('Button bezel',(0,0,0),(.18,.035,.18),chrome,button);ball('Button cap',(0,.035,0),(.145,.055,.145),gold,button)

for kind,color,loc in [('Bear',fur,(.0,.32,.0)),('Bunny',white,(.5,.32,-.3)),('Duck',gold,(-.4,.32,-.25))]:
    toy=group('Toy'+kind,loc)
    ball('Body',(0,-.03,0),(.20,.23,.16),color,toy)
    ball('Head',(0,.20,.02),(.205,.185,.16),color,toy)
    for x in [-.13,.13]:
        if kind!='Duck':ball('Ear',(x,.38,.01),(.063,.15 if kind=='Bunny' else .07,.055),color,toy)
        ball('Foot',(x,-.20,.09),(.085,.065,.105),color,toy)
        ball('Arm',(x*1.55,-.02,0),(.075,.11,.075),color,toy)
    for x in [-.075,.075]:
        ball('Eye',(x,.23,.164),(.022,.029,.012),black,toy)
        ball('Eye shine',(x-.006,.24,.175),(.006,.009,.006),white,toy)
        ball('Cheek',(x*1.5,.16,.157),(.033,.02,.009),pink,toy)
    ball('Muzzle',(0,.14,.16),(.081,.055,.042),white if kind!='Duck' else pink,toy)
    if kind!='Duck':ball('Nose',(0,.167,.205),(.022,.016,.012),black,toy)

scene=bpy.context.scene
scene.world=bpy.data.worlds.new('Mint studio')
scene.world.color=(.36,.42,.38)
for name,location,power in [('Key',(2.5,5,4),550),('Fill',(-3,3,2),300)]:
    bpy.ops.object.light_add(type='POINT',location=pos(location));o=bpy.context.object;o.name=name;o.data.energy=power;o.data.shadow_soft_size=2
    o.rotation_euler=(Vector(pos((0,1.5,0)))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=pos((4,3.7,7)))
camera=bpy.context.object;camera.rotation_euler=(Vector(pos((0,1.4,0)))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=5.1;scene.camera=camera
scene.render.engine='BLENDER_EEVEE'
scene.render.resolution_x=600;scene.render.resolution_y=800;scene.render.resolution_percentage=100
target=artifacts.file(name='mint-asset-preview.png',media_type='image/png')
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(target.path)
bpy.ops.render.render(write_still=True);target.publish()
result={'assets':['Cabinet','Chute','Gantry','Carriage','Claw','Joystick','DropButton','ToyBear','ToyBunny','ToyDuck'],'objects':len(bpy.data.objects)}
