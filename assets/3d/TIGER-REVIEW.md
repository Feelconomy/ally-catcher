# Tiger Duck Three-View Study

The user-supplied front image was used to generate three modeling references BEFORE building the mesh:

- `tiger-reference-front.png`: straight front, preserving the original plush identity.
- `tiger-reference-side.png`: right-side study, bill facing left, showing body/hood depth.
- `tiger-reference-back.png`: rear study, yellow rump, orange hood and striped curled tail.

References were made with the built-in image generation tool. Side/rear shapes are inferred design choices, not measurements of a photographed physical object. The generated side study has slight perspective; it is a design reference, not an engineering orthographic drawing.

Prompt set: preserve the same seated yellow duck plush in an orange brown-striped tiger hood; cream hood rim and long earflaps, round pink inner ears, tiger embroidered forehead face, smiling orange bill, large white duck eyes, pink cheeks, ivory belly, yellow mitten wings, orange padded feet, and one striped cream-tipped tail. Neutral gray background and diffuse light. Front: match supplied identity. Side: turn 90 degrees, retain depth and seated pose. Rear: no face or belly patch, yellow lower back, hood over upper back, tail curls to character right.

3D authoring: `tools/3d/build_tiger_duck.py`, followed by `tools/3d/refine_tiger_duck.py`, executed through Higgsfield 3D Jutsu after visually inspecting all three reference images. This is reference-guided manual geometry, not automated multi-image reconstruction. Portable GLB contains embedded fabric normal and smooth hood-stripe textures, hood, beak, wings, feet, ears and a banded tail.

Higgsfield project: https://higgsfield.ai/3d-jutsu/30713215-de2a-4521-a15d-f596b6475702

Final earflap pass: `tools/3d/pad_tiger_earflaps.py` adds the long stuffed ivory/orange side panels and separates the ear patches. The resulting model is still a stylized interpretation; fine fur, exact embroidery and some hood seams differ from the generated reference images.

Open `/assets/3d/tiger-preview.html` on the local server to compare the corresponding reference and model from front, side, rear and an additional angled view. Existing game assets and the approved Olly remain unchanged until approval.
