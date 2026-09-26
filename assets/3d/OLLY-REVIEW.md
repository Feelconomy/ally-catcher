# Olly Reference Review

The approved revision 5 model is now loaded separately by Green 3D for the `olly` catalogue prize. The cabinet and other toys still use `mint-machine.glb` unchanged. The original-scale asset and comparison page remain available.

- Source: user-supplied front-view PNG, retained as `olly-reference.png`.
- Higgsfield project: https://higgsfield.ai/3d-jutsu/c0f13a29-8ae8-48ac-85b1-dd5f3f6b8daf
- Authoring: `tools/3d/build_olly_reference.py`, then `tools/3d/refine_olly_reference.py`, then `tools/3d/fix_olly_texture.py`.
- Approach: reference-guided manual Blender geometry through Higgsfield 3D Jutsu, NOT automatic image-to-3D reconstruction. The catalog lists Meshy but the connected tool surface does not expose its required `generate_3d` action. The attempted image-tool submission was rejected and created no generation job.
- Side/back geometry is inferred from the single front image.
- Fine fibre detail is a lightweight embedded normal texture, not individual fur strands. It is an approximation and will not reproduce the reference's photographed plush surface exactly.
- This approval mesh is not yet optimized for twelve simultaneous game instances.

## Volume Revision

`tools/3d/round_olly_reference.py` continues from Higgsfield revision 3. Body depth increases from 0.88 to 1.30 units without widening the front silhouette. Eye layers follow the body surface with only 0.002-0.005 units of clearance to prevent flicker. Each arm is a continuous shoulder-to-hand mesh. Each foot/leg is one deep rounded volume, with softly raised pads instead of a flat sole disc. The game asset remains unchanged.

## Taller Torso And Hands

`tools/3d/elongate_olly_hands.py` continues from revision 4. The torso is 14% taller with its approved width/depth retained. Feet stay unchanged. Each hand has three short plush fingers and an inner thumb, fused into the existing arm with a voxel remesh and smoothed transitions. UVs are regenerated for the embedded fabric normal. The game scales a parented instance to 0.64 units tall once at load, preserving its proportions, materials and scale throughout grasp and release.

Run the existing local server and open `/assets/3d/olly-preview.html` for source/model comparison, orbit, and front/side/three-quarter views. All render dependencies are local.

Validation: `PLAYWRIGHT_PATH=/path/to/playwright node tools/3d/test-olly-preview.cjs` checks geometry, nonblank pixels, all three viewpoints, mobile/desktop layout, and page errors.
