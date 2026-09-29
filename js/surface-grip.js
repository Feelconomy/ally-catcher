import * as THREE from 'three';

// Clip a triangle to the width of a metal finger, not an axis-aligned toy box.
function clip(poly, axis, limit, sign) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const da = sign * (a[axis] - limit), db = sign * (b[axis] - limit);
    if (da <= 0) out.push(a);
    if ((da <= 0) !== (db <= 0)) out.push(a.clone().lerp(b, da / (da - db)));
  }
  return out;
}

export function pickSurface(toys, x, z) {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, 4, z), new THREE.Vector3(0, -1, 0));
  let result = null;
  for (const toy of toys) {
    toy.mesh.updateWorldMatrix(true, true);
    const hit = ray.intersectObject(toy.mesh, true)[0];
    if (hit && (!result || hit.distance < result.hit.distance)) {
      const center = new THREE.Box3().setFromObject(toy.mesh).getCenter(new THREE.Vector3());
      result = { toy, hit, distance: Math.min(.28, Math.hypot(x - center.x, z - center.z)) };
    }
  }
  return result;
}

export function surfaceGrip(mesh, x, z, yaw, material) {
  mesh.updateWorldMatrix(true, true);
  const triangles = [], bounds = new THREE.Box3();
  const inverse = new THREE.Matrix4().makeRotationY(-yaw)
    .multiply(new THREE.Matrix4().makeTranslation(-x, 0, -z));
  mesh.traverse(o => {
    if (!o.isMesh) return;
    const transform = inverse.clone().multiply(o.matrixWorld);
    const positions = o.geometry.attributes.position, index = o.geometry.index;
    const vertices = Array.from({ length: positions.count }, (_, i) => {
      const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(transform);
      bounds.expandByPoint(p);
      return p;
    });
    for (let i = 0; i < (index ? index.count : positions.count); i += 3) {
      triangles.push([0, 1, 2].map(j => vertices[index ? index.getX(i + j) : i + j]));
    }
  });
  const top = bounds.max.y, bottom = (bounds.min.y + top) / 2 - .025;
  const down = top + .13, count = 10, step = (top - bottom) / count;
  const group = new THREE.Group(); group.name = 'SurfaceFingers';
  const fingers = [];
  const rodGeometry = new THREE.CylinderGeometry(.022, .022, 1, 12);
  const jointGeometry = new THREE.SphereGeometry(.023, 12, 8);
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3;
    const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
    const tangent = new THREE.Vector3(-direction.z, 0, direction.x);
    const radii = Array(count).fill(.10);
    let contact = false;
    for (const triangle of triangles) {
      let poly = triangle.map(p => new THREE.Vector3(p.dot(direction), p.y, p.dot(tangent)));
      poly = clip(clip(poly, 'z', .045, 1), 'z', -.045, -1);
      if (!poly.length) continue;
      const lo = Math.min(...poly.map(p => p.y)), hi = Math.max(...poly.map(p => p.y));
      const radius = Math.max(...poly.map(p => p.x));
      if (radius <= 0 || hi < bottom || lo > top) continue;
      contact = true;
      // Include the whole triangle's projected extent in every band it crosses.
      // Taking adjacent maxima keeps rods outside the surface between samples too.
      for (let j = 0; j < count; j++) {
        if (hi >= top - (j + 1) * step - .025 && lo <= top - j * step + .025)
          radii[j] = Math.max(radii[j], radius + .03);
      }
    }
    const points = [direction.clone().multiplyScalar(.12).setY(-.015)];
    for (let j = 0; j <= count; j++) {
      const radius = Math.max(radii[Math.max(0, j - 1)], radii[Math.min(count - 1, j)]);
      points.push(direction.clone().multiplyScalar(radius).setY(top + (j === 0 ? .045 : -j * step) - down));
    }
    const rods = [], joints = [];
    for (let j = 0; j < points.length - 1; j++) {
      const rod = new THREE.Mesh(rodGeometry, material); rod.castShadow = true;
      group.add(rod); rods.push(rod);
      const joint = new THREE.Mesh(jointGeometry, material); group.add(joint); joints.push(joint);
    }
    fingers.push({ points, direction, rods, joints, contact });
  }
  return {
    group, down, fingers,
    valid: fingers.every(f => f.contact && f.points.every(p => Math.hypot(p.x, p.z) < .65)),
    pose(open) {
      for (const f of fingers) {
        const openRadius = Math.max(...f.points.map(p => Math.hypot(p.x, p.z))) + .10;
        const points = f.points.map((p, i) => p.clone().addScaledVector(f.direction,
          i ? open * (openRadius - Math.hypot(p.x, p.z)) : 0));
        f.rods.forEach((rod, i) => {
          const delta = points[i + 1].clone().sub(points[i]);
          rod.position.copy(points[i]).add(points[i + 1]).multiplyScalar(.5);
          rod.scale.y = delta.length();
          rod.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
          f.joints[i].position.copy(points[i + 1]);
        });
      }
    },
    dispose() { group.removeFromParent(); rodGeometry.dispose(); jointGeometry.dispose(); }
  };
}
