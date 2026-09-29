const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('https://**/*', r => r.abort());
    await page.goto(process.env.TEST_URL || 'http://127.0.0.1:4176/#home');
    await page.evaluate(() => { App.guest = true; Store.state.settings.skin = 'green3d'; render('play', MACHINES[0].id); });
    await page.waitForFunction(() => window.Play3D?.phase === 'aim');
    const result = await page.evaluate(async () => {
      const THREE = await import('/vendor/three.module.js');
      const { surfaceGrip, pickSurface } = await import('/js/surface-grip.js');
      const g = Play3D; g.time = 1000;
      const results = [];
      for (const [id, mesh] of Object.entries(g.assets).filter(([id]) => id.startsWith('Toy'))) {
        const toy = { id, mesh };
        const originalPosition = toy.mesh.position.clone(), originalRotation = toy.mesh.quaternion.clone();
        for (const rotation of [[0, 0, 0], [1.3, .7, .2], [.2, 1.4, 1.5]]) {
          toy.mesh.position.set(0, .6, 0); toy.mesh.rotation.set(...rotation); toy.mesh.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(toy.mesh, true), center = box.getCenter(new THREE.Vector3());
          const picked = pickSurface([toy], center.x, center.z);
          if (!picked) throw new Error('Missing surface at center: ' + toy.id);
          const grip = surfaceGrip(toy.mesh, center.x, center.z, .7, new THREE.MeshStandardMaterial());
          if (!grip.valid) throw new Error('Invalid grip: ' + toy.id);
          grip.group.position.set(center.x, grip.down, center.z); grip.group.rotation.y = .7;
          let penetrations = 0;
          // Cast along every rod, including parallel traces around its thickness.
          for (const [open, height] of [[1, .3], [1, .1], [1, 0], [.5, 0], [0, 0]]) {
          grip.pose(open); grip.group.position.y = grip.down + height; grip.group.updateMatrixWorld(true);
          for (const finger of grip.fingers) for (const rod of finger.rods) {
            for (const offset of [[0, 0, 0], [.02, 0, 0], [-.02, 0, 0], [0, .02, 0], [0, -.02, 0], [0, 0, .02], [0, 0, -.02]]) {
              const a = new THREE.Vector3(0, -.5, 0).applyMatrix4(rod.matrixWorld).add(new THREE.Vector3(...offset));
              const b = new THREE.Vector3(0, .5, 0).applyMatrix4(rod.matrixWorld).add(new THREE.Vector3(...offset));
              const delta = b.clone().sub(a), ray = new THREE.Raycaster(a, delta.clone().normalize(), 0, delta.length());
              if (ray.intersectObject(toy.mesh, true).length) penetrations++;
            }
          }
          }
          results.push({ id: toy.id, rotation, penetrations, housingClearance: grip.down - .08 - box.max.y });
          grip.dispose(); grip.group.children[0].material.dispose();
        }
        toy.mesh.position.copy(originalPosition); toy.mesh.quaternion.copy(originalRotation);
      }
      // Overlapping projections must pick the first actual visible surface.
      const material = new THREE.MeshBasicMaterial();
      const upper = { mesh: new THREE.Mesh(new THREE.SphereGeometry(.2, 24, 16), material) };
      const lower = { mesh: new THREE.Mesh(new THREE.SphereGeometry(.2, 24, 16), material) };
      upper.mesh.position.y = 1; lower.mesh.position.y = .3;
      if (pickSurface([lower, upper], 0, 0)?.toy !== upper) throw new Error('Occlusion selection');
      if (pickSurface([upper], .25, 0) !== null) throw new Error('Empty space selected a nearby toy');
      upper.mesh.geometry.dispose(); lower.mesh.geometry.dispose(); material.dispose();
      return results;
    });
    console.log(JSON.stringify(result));
    assert(result.length >= 3);
    assert(result.every(r => r.penetrations === 0 && r.housingClearance >= .049));
    await page.evaluate(() => {
      const g = Play3D, toy = g.toys.reduce((a, b) => a.body.position.y > b.body.position.y ? a : b);
      g.position.x = toy.body.position.x; g.position.z = toy.body.position.z;
      window.originalRandom = Math.random; Math.random = () => 0;
      g.drop().finally(() => { Math.random = window.originalRandom; });
    });
    await page.waitForFunction(() => Play3D.phase === 'lifting' && Play3D.held);
    const attached = await page.evaluate(() => {
      const g = Play3D;
      return { id: g.held.id, profile: !!g.surfaceGrip, offset: g.heldOffset.toArray(), q: g.heldQuat.toArray() };
    });
    assert(attached.profile);
    await page.screenshot({ path: path.join(os.tmpdir(), 'ally-surface-grip-mobile.png') });
    await page.waitForFunction(() => Play3D.phase === 'carrying');
    assert(await page.evaluate(async ({ offset, q }) => {
      const THREE = await import('/vendor/three.module.js');
      const g = Play3D;
      const expected = new THREE.Vector3(...offset).applyQuaternion(g.claw.quaternion).add(g.claw.position);
      const expectedQ = g.claw.quaternion.clone().multiply(new THREE.Quaternion(...q));
      const actualQ = new THREE.Quaternion().copy(g.held.body.quaternion);
      return expected.distanceTo(new THREE.Vector3().copy(g.held.body.position)) < 1e-6 &&
        expectedQ.angleTo(actualQ) < 1e-6 &&
        g.heldOffset.toArray().every((v, i) => Math.abs(v - offset[i]) < 1e-8) &&
        g.heldQuat.toArray().every((v, i) => Math.abs(v - q[i]) < 1e-8);
    }, attached));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: path.join(os.tmpdir(), 'ally-surface-grip-desktop.png') });
    await page.waitForFunction(() => App.route !== 'play', null, { timeout: 30000 });
    assert.deepEqual(errors, []);
    console.log('PASS: rotated model surfaces, rod thickness clearance, housing clearance, occlusion, empty aim, stable held transform, completed round');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
