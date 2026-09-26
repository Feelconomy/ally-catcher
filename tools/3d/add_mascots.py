"""Second Higgsfield edit: catalogue mascots and physical suspension cable."""
import bpy, math
from mathutils import Vector

def pos(p):return (p[0],-p[2],p[1])
def mat(name,color):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.92
    return m
lime=mat('Olly lime plush',(.57,.76,.16));yellow=mat('Chick yellow plush',(1,.76,.035));orange=mat('Tiger orange fleece',(.89,.37,.04))
ivory=bpy.data.materials['Warm ivory'];dark=bpy.data.materials['Soft charcoal'];pink=bpy.data.materials['Blush']
def group(name,p):
    o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=pos(p);return o
def ball(name,p,s,material,parent):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=14,location=pos(p));o=bpy.context.object;o.name=name;o.scale=(s[0],s[2],s[1]);o.parent=parent;o.data.materials.append(material)
    for face in o.data.polygons:face.use_smooth=True
    return o
for kind,base,location in [('Olly',lime,(.65,.35,.4)),('Tiger',yellow,(-.05,.35,.4))]:
    root=group('Toy'+kind,location)
    ball('Mascot body',(0,.03,0),(.22,.29,.18),base,root)
    ball('Cream belly',(0,-.07,.16),(.14,.15,.04),ivory,root)
    ball('Mascot head',(0,.24,0),(.235,.22,.185),base,root)
    for x in [-1,1]:
        ball('Mascot foot',(x*.145,-.22,.08),(.105,.10,.13),base,root)
        ball('Mascot arm',(x*.215,-.035,.03),(.07,.14,.08),base,root)
        ball('White eye',(x*.082,.28,.16),(.066,.086,.034),ivory,root)
        ball('Pupil',(x*.079,.278,.19),(.032,.043,.017),dark,root)
        ball('Eye glint',(x*.079-.009,.296,.204),(.011,.013,.007),ivory,root)
        ball('Pink cheek',(x*.16,.19,.162),(.035,.037,.015),pink,root)
    ball('Happy mouth',(0,.132,.18),(.074,.05,.025),dark,root)
    ball('Tongue',(0,.112,.201),(.043,.018,.009),pink,root)
    ball('Nose',(0,.205,.195),(.035,.026,.024),orange,root)
    if kind=='Olly':ball('Cream tuft',(0,.456,0),(.065,.047,.06),ivory,root)
    else:
        ball('Hood crown',(0,.415,-.015),(.25,.08,.19),orange,root)
        for x in [-1,1]:
            ball('Hood side',(x*.235,.25,0),(.06,.18,.16),orange,root)
            ball('Tiger ear',(x*.17,.46,-.005),(.08,.08,.055),orange,root)
            ball('Inner ear',(x*.17,.465,.043),(.045,.045,.014),pink,root)
            for y in [.28,.37]:ball('Tiger stripe',(x*.244,y,.132),(.027,.02,.029),dark,root)
        ball('Hood muzzle',(0,.415,.17),(.08,.03,.025),ivory,root)
        for x in [-.07,0,.07]:ball('Hood stripe',(x,.447,.14),(.014,.027,.03),dark,root)

# Give the duck a soft toy material instead of sharing the metallic claw material.
duck=bpy.data.objects['ToyDuck']
for o in duck.children:
    if o.type=='MESH' and o.active_material and o.active_material.name=='Gold claw':o.data.materials[0]=yellow
scene=bpy.context.scene
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_percentage=100
target=artifacts.file(name='mint-mascots-preview.png',media_type='image/png')
scene.render.filepath=str(target.path);scene.render.image_settings.file_format='PNG'
bpy.ops.render.render(write_still=True);target.publish()
result={'added':['ToyOlly','ToyTiger'],'objects':len(bpy.data.objects)}
