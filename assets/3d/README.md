# Green Mode 3D

Branch: `codex/green-mode-3d`.

`mint-machine.glb` was authored and exported through Higgsfield 3D Jutsu, not generated locally as a substitute.

- Project: https://higgsfield.ai/3d-jutsu/3654a529-14bb-4863-ac62-6e15e4fe4a59
- Committed revision: 2
- Operations: `build-mint-pack-02`, `add-mascots-03`
- Authoring sources: `tools/3d/build_higgsfield_assets.py`, `tools/3d/add_mascots.py`
- Preview: `higgsfield-preview.png` (Higgsfield Eevee render)

Editable named roots: Cabinet, Chute, Gantry, Carriage, Claw (Finger0-2), Joystick (JoystickHandle), DropButton, ToyBear, ToyBunny, ToyDuck, ToyOlly, ToyTiger.

Models use metre units and export Y-up. Blender scripts accept Y-up input and convert to Blender coordinates. The game reuses the GLB parts; the cable and aiming ring are small runtime geometries. Toys use compound sphere colliders in cannon-es. Grasp and carriage movement are scripted; released toys use gravity and collisions. Success still uses the existing machine odds and awards the original catalogue prize only after the toy reaches the chute.

Five stylized toy bases are included. Other catalogue costumes and admin-added characters currently reuse the closest base; their original art/name remains in the target readout and reward screen. These are not exact 3D scans of all existing illustrations.

## Run

From the repository root: `python3 -m http.server 4173 --bind 127.0.0.1`, then open http://127.0.0.1:4173/ and select Green 3D. HTTP is required for modules and GLB loading; file URLs show a recovery screen. The basic 2D mode is retained.

Move with the two-axis joystick or arrow/WASD keys; drop with the button or Space. Drag the cabinet to orbit; use the camera tabs for fixed views. Leaving a game disposes the WebGL renderer and cancels pending animations.

## Verify

Install Playwright in a test environment, then run `node tools/3d/test-game.cjs` with the server running. `PLAYWRIGHT_PATH` can point at an existing Playwright installation; `TEST_URL` overrides the server URL. Tests use an isolated browser and block external requests.

Checks cover nonblank canvas pixels at desktop/mobile sizes, GLB geometry, four-axis input, release, camera switching, win/slip/miss, timeout, exit cancellation and the classic mode. Screenshots go to the OS temporary directory.

## Dependencies

Three.js 0.180.0 and cannon-es 0.20.0 are vendored in `vendor/` with their MIT licenses. The only vendor adjustment is GLTFLoader's relative BufferGeometryUtils import. No CDN request is needed to run the 3D game.
