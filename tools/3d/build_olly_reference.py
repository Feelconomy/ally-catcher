"""Standalone approval model, manually shaped from the supplied front reference."""
import bpy, math, numpy as np
from mathutils import Vector

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.world = bpy.data.worlds.new('Soft studio')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.65, .68, .72, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = .45

# An embedded normal map keeps the short-pile textile detail in the GLB.
rng = np.random.default_rng(24)
normal = bpy.data.images.new('Embedded microfibre normal', width=256, height=256)
normal.colorspace_settings.name = 'Non-Color'
pixels = np.ones((256, 256, 4), dtype=np.float32)
pixels[:, :, 0:2] = .5 + rng.normal(0, .075, (256, 256, 2))
pixels[:, :, 2] = 1
normal.pixels.foreach_set(pixels.ravel())
normal.update()
normal.pack()

def material(name, color, plush=False, roughness=.8):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    if plush:
        p.inputs['Sheen Weight'].default_value = .32
        uv = m.node_tree.nodes.new('ShaderNodeTexCoord')
        mapping = m.node_tree.nodes.new('ShaderNodeVectorMath'); mapping.operation = 'SCALE'
        mapping.inputs[3].default_value = 7
        tex = m.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = normal
        bump = m.node_tree.nodes.new('ShaderNodeNormalMap'); bump.inputs['Strength'].default_value = .24
        m.node_tree.links.new(uv.outputs['UV'], mapping.inputs[0])
        m.node_tree.links.new(mapping.outputs[0], tex.inputs['Vector'])
        m.node_tree.links.new(tex.outputs['Color'], bump.inputs['Color'])
        m.node_tree.links.new(bump.outputs['Normal'], p.inputs['Normal'])
    return m

lime = material('Lime short pile plush', (.55, .69, .055), True)
ivory = material('Ivory fabric', (.91, .85, .62), True)
white = material('Eye warm white', (.96, .94, .81), False, .45)
brown = material('Chestnut iris', (.085, .037, .009), False, .24)
black = material('Deep pupil', (.008, .004, .002), False, .2)
mouthmat = material('Mouth embroidered velvet', (.07, .006, .001), False, .95)
pink = material('Pink cheek fabric', (.92, .25, .29), True)
tongue = material('Rose tongue', (.65, .045, .09), False, .85)
nose = material('Honey nose', (.72, .40, .075), True)
pad = material('Lime foot pads', (.47, .60, .055), True)
seam = material('Subtle lime seams', (.43, .56, .055), True)

root = bpy.data.objects.new('OllyReference', None); scene.collection.objects.link(root)
def ball(name, loc, scale, mat, tilt=0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=32, location=loc)
    o = bpy.context.object; o.name = name; o.scale = scale; o.rotation_euler[1] = tilt
    o.parent = root; o.data.materials.append(mat)
    for p in o.data.polygons: p.use_smooth = True
    return o

body = ball('Continuous pear shaped body', (0,0,.90), (1,1,1), lime)
for v in body.data.vertices:
    x,y,z = v.co
    width = .69 * (1 - .17*z)
    v.co = (x*width, y*.44*(1-.06*z), z*.79)
ball('Ivory top tuft', (0,.005,1.715), (.175,.15,.16), ivory)

for sign in [-1,1]:
    ball('Soft hanging arm', (sign*.655,-.015,.64), (.185,.23,.355), lime, sign*-.22)
    ball('Rounded mitten', (sign*.70,-.14,.45), (.16,.20,.16), lime)
    ball('Thumb', (sign*.607,-.295,.47), (.075,.072,.10), lime, sign*-.5)
    foot = ball('Forward seated foot', (sign*.43,-.29,.225), (.275,.30,.25), lime, sign*-.20)
    ball('Inset sole seam', (sign*.445,-.542,.224), (.222,.032,.205), seam, sign*-.20)
    ball('Padded sole', (sign*.445,-.568,.224), (.206,.04,.187), lime, sign*-.20)
    ball('Round heel cushion', (sign*.445,-.605,.178), (.12,.027,.108), pad)
    for i in [-1,0,1]:
        ball('Soft toe cushion', (sign*.445+i*.10,-.594,.328-abs(i)*.024), (.065,.024,.055), lime)

ball('Large ivory belly patch', (0,-.409,.495), (.355,.055,.305), ivory)
for sign in [-1,1]:
    ball('Large oval eye white', (sign*.215,-.383,1.30), (.147,.068,.185), white, sign*-.08)
    ball('Brown oval iris', (sign*.189,-.449,1.29), (.078,.035,.103), brown)
    ball('Black pupil', (sign*.184,-.476,1.29), (.054,.016,.077), black)
    ball('Eye highlight', (sign*.184+.022,-.491,1.333), (.022,.008,.025), white)
    ball('Round blush patch', (sign*.413,-.346,1.06), (.089,.026,.101), pink, sign*-.12)

ball('Small golden oval nose', (0,-.465,1.178), (.069,.052,.046), nose)

# A shaped smile surface, rather than an oval stuck on the body.
def smile(name, points, depth, mat):
    verts = [(x,depth,z) for x,z in points]
    mesh = bpy.data.meshes.new(name); mesh.from_pydata(verts, [], [tuple(range(len(verts)))])
    mesh.update(); o = bpy.data.objects.new(name,mesh); scene.collection.objects.link(o)
    o.parent=root; o.data.materials.append(mat)
    solid=o.modifiers.new('Fabric thickness','SOLIDIFY'); solid.thickness=.012
    bevel=o.modifiers.new('Soft stitched edge','BEVEL'); bevel.width=.012; bevel.segments=3
    return o

outline=[(-.213,1.08),(-.202,1.108),(-.173,1.113),(-.105,1.098),(0,1.09),(.105,1.098),(.173,1.113),(.202,1.108),(.213,1.08),(.207,1.02),(.174,.967),(.12,.929),(.057,.907),(0,.901),(-.057,.907),(-.12,.929),(-.174,.967),(-.207,1.02)]
smile('Wide happy mouth',outline,-.450,mouthmat)
smile('Small upper tooth',[(-.088,1.094),(.088,1.094),(.074,1.075),(.045,1.067),(-.045,1.067),(-.074,1.075)],-.465,white)
smile('Visible smiling tongue',[(-.133,.945),(-.118,.966),(-.070,.983),(0,.99),(.070,.983),(.118,.966),(.133,.945),(.10,.927),(.05,.913),(0,.908),(-.05,.913),(-.10,.927)],-.468,tongue)

def curve(name, points, radius, mat):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.bevel_depth=radius; c.bevel_resolution=2
    s=c.splines.new('POLY'); s.points.add(len(points)-1)
    for p,co in zip(s.points,points):p.co=(*co,1)
    o=bpy.data.objects.new(name,c);scene.collection.objects.link(o);o.parent=root;o.data.materials.append(mat)

curve('Top fabric centre seam',[(0,-.44*math.sqrt(max(0,1-t*t))-.001,.9+.79*t) for t in np.linspace(.65,.995,40)],.0016,seam)

floor = material('Studio floor',(.78,.79,.76),False,.95)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.027)); bpy.context.object.name='Studio ground'; bpy.context.object.data.materials.append(floor)
def area(name,loc,power,size):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=loc
    o.rotation_euler=(Vector((0,0,.85))-o.location).to_track_quat('-Z','Y').to_euler()
area('Large left softbox',(-3,-4,5),400,4)
area('Right fill',(3,-2,2.7),180,3)
area('Back rim',(0,3,4),320,3)
bpy.ops.object.camera_add(location=(0,-5,.95));camera=bpy.context.object;camera.name='Approval camera';scene.camera=camera
camera.data.type='ORTHO';camera.data.ortho_scale=2.25
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=700;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.image_settings.media_type='IMAGE'
scene.view_settings.view_transform='Standard'
for name,loc in [('olly-front.png',(0,-5,.95)),('olly-side.png',(5,0,.95)),('olly-three-quarter.png',(3,-5,1.1))]:
    camera.location=loc;camera.rotation_euler=(Vector((0,0,.91))-camera.location).to_track_quat('-Z','Y').to_euler()
    target=artifacts.file(name=name,media_type='image/png');scene.render.filepath=str(target.path)
    bpy.ops.render.render(write_still=True);target.publish()
result={'model':'OllyReference','approach':'reference-guided manual geometry, not image reconstruction','vertices':sum(len(o.data.vertices) for o in root.children if o.type=='MESH'),'views':['front','side','three-quarter']}
