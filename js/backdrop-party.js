/* ══════════════════════════════════════════════════════════════════
   생일파티 배경 — 분홍 파티장에 선물이 쌓여 있는 풍경.

   둥근 포장상자, 볼륨 풍선, 생크림과 딸기를 실제 지오메트리로 만든다.
   반복되는 선물·풍선·색종이는 InstancedMesh 로 묶어 그린다.

   자리는 인형통(가로 2.6 · 높이 3.5)을 중심으로 잡는다. 카메라가
   (3, 2.95, 5) 에서 (0, 1.15, 0) 을 보므로, 뒤쪽은 넉넉히 채우고
   앞쪽 바닥은 비워 인형통을 가리지 않게 한다.
   ══════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

export const PARTY_SKY = '#FBA8CC';     // scene.background
export const PARTY_FOG = { color: '#F8C9DE', near: 22, far: 64 };

/* 참고 이미지의 색을 그대로 가져왔다. 선물·풍선이 이 중에서 색을 고른다. */
/* 상자 색과 그 상자에 어울리는 리본 색을 짝으로 묶어 둔다. 따로 뽑으면 흰
   상자에 흰 리본이 걸려 선물로 안 보인다. */
const GIFTS = [
  { box: '#FF3D8B', ribbon: '#FFD12E' },
  { box: '#FF6FAE', ribbon: '#FFFFFF' },
  { box: '#FFB3D1', ribbon: '#E01B6A' },
  { box: '#FFD12E', ribbon: '#FF3D8B' },
  { box: '#4FD9B0', ribbon: '#FFFFFF' },
  { box: '#A98BF0', ribbon: '#FFD12E' },
  { box: '#FFF0F6', ribbon: '#FF3D8B' },
  { box: '#38C6E8', ribbon: '#FFFFFF' },
];
const CANDY = GIFTS.map(g => g.box);

const pick = (arr, r) => arr[Math.floor(r * arr.length) % arr.length];

/* 같은 자리에 같은 풍경이 나와야 한다 — 기계를 다시 들어가도 선물이 춤추면
   배경이 아니라 효과처럼 보인다. 그래서 난수를 고정 씨앗으로 돌린다. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** 리본 두 줄이 교차한 선물 상자 한 개의 지오메트리(상자 + 리본). */
// Round edges in geometry so highlights follow wrapping paper instead of a sharp cube.
function roundedBox(width, height, depth, radius = .08) {
  const shape = new THREE.Shape(), x = width / 2 - radius, y = height / 2 - radius;
  shape.absarc(-x, -y, radius / 2, Math.PI, Math.PI * 1.5, false);
  shape.absarc(x, -y, radius / 2, Math.PI * 1.5, Math.PI * 2, false);
  shape.absarc(x, y, radius / 2, 0, Math.PI / 2, false);
  shape.absarc(-x, y, radius / 2, Math.PI / 2, Math.PI, false);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - radius, steps: 1, bevelEnabled: true,
    bevelSize: radius / 2, bevelThickness: radius / 2, bevelSegments: 3, curveSegments: 5,
  });
  geo.translate(0, 0, -depth / 2 + radius / 2);
  geo.setIndex(Array.from({length: geo.attributes.position.count}, (_, i) => i));
  return geo;
}

// Inflate both faces of a silhouette: foil balloons need a curved belly, not flat extrusion caps.
function inflatedShape(shape) {
  const outline = shape.getSpacedPoints(64).slice(0, -1), positions = [], indices = [];
  if (THREE.ShapeUtils.isClockWise(outline)) outline.reverse();
  const n = outline.length, rings = 12;
  for (const side of [1, -1]) for (let r = 0; r <= rings; r++) {
    const t = Math.max(.0001, r / rings);
    for (const p of outline) positions.push(p.x * t, p.y * t, side * .36 * Math.sqrt(1 - t * t));
  }
  for (let side = 0; side < 2; side++) for (let r = 0; r < rings; r++) for (let i = 0; i < n; i++) {
    const a = side * (rings + 1) * n + r * n + i, b = a - i + (i + 1) % n;
    const faces = [a, a + n, b, b, a + n, b + n];
    indices.push(...(side ? faces.reverse() : faces));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices); geo.computeVertexNormals(); return geo;
}

function creamSwirl() {
  const geo = new THREE.LatheGeometry(Array.from({ length: 25 }, (_, i) => {
    const t = i / 24;
    return new THREE.Vector2(.23 * Math.pow(1 - t, .7) * (1 + .12 * Math.sin(t * 15)), t * .5);
  }), 40);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const rib = 1 + .16 * Math.cos(Math.atan2(z, x) * 8 - y * 20);
    p.setXYZ(i, x * rib + .08 * Math.pow(y * 2, 3), y, z * rib);
  }
  geo.computeVertexNormals(); return geo;
}

function giftParts() {
  const box = roundedBox(1, 1, 1);
  /* 리본은 상자보다 아주 조금 크게 둘러 Z-fighting 을 피한다. 두 줄을 한
     지오메트리로 합쳐 두면 인스턴스 하나에 draw call 하나로 끝난다. */
  const a = new THREE.BoxGeometry(.2, 1.07, 1.07);
  const b = new THREE.BoxGeometry(1.07, 1.07, .2);
  const bow = [];
  for (const sign of [-1, 1]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, .57, 0), new THREE.Vector3(sign * .28, .85, .03),
      new THREE.Vector3(sign * .4, .7, .05), new THREE.Vector3(0, .57, 0),
    ]);
    const loop = new THREE.TubeGeometry(curve, 20, .065, 6, false);
    bow.push(loop);
  }
  const knot = roundedBox(.18, .15, .18, .06); knot.translate(0, .59, 0);
  const ribbon = mergeBoxes([a, b, ...bow, knot]);
  return { box, ribbon };
}

/** BufferGeometry 두 개를 하나로 잇는다 (BufferGeometryUtils 없이 쓰려고). */
function mergeBoxes(geos) {
  let vc = 0, ic = 0;
  for (const g of geos) { vc += g.attributes.position.count; ic += g.index.count; }
  const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3);
  const idx = new Uint16Array(ic);
  let vo = 0, io = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo;
    vo += g.attributes.position.count; io += g.index.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

/* 카메라는 (0,1.15,0) 둘레를 거리 4.7~10 으로 돌고, 앞쪽(+Z) 좌우 0.7 라디안
   안에서만 움직인다. 그 원뿔 안에 뭘 두면 화면을 가리므로 통째로 비운다. */
const inCameraWay = (x, z, rad) => z > .5 && rad < 13 && Math.atan2(x, z) > -1.1 && Math.atan2(x, z) < 1.1;

/** 인형통을 둘러 선물을 쌓는다. 카메라가 지나는 앞쪽은 비운다. */
function giftSpots(rnd, n) {
  const spots = [];
  for (let i = 0; i < n; i++) {
    const ang = rnd() * Math.PI * 2;
    /* 뒤쪽(-Z)은 유리 너머로 보이는 자리라 더 가까이·더 촘촘히 쌓는다. */
    const back = Math.sin(ang) < 0;
    const rad = (back ? 2.3 : 2.9) + rnd() * (back ? 4.2 : 5.2);
    const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
    if (inCameraWay(x, z, rad)) continue;
    // Leave the cake's silhouette visible instead of burying it behind tall presents.
    if (x > -4.9 && x < -1.5 && z > -5.5 && z < -.3) continue;
    const size = .55 + rnd() * .85;
    // 절반쯤은 다른 선물 위에 얹혀 더미가 된다
    const tier = rnd() > .5 ? size * (.75 + rnd() * .6) : 0;
    spots.push({ x, z, size, y: size / 2 + tier, rot: rnd() * Math.PI, r: rnd() });
  }
  return spots;
}

/**
 * 생일파티 배경을 만들어 THREE.Group 으로 돌려준다.
 * 호출한 쪽이 scene 에 넣고, 나갈 때 기존 disposeObject 로 정리하면 된다.
 */
// All decorations are geometry, kept behind the machine and outside the camera orbit.
function anniversaryDecor() {
  const group = new THREE.Group();
  group.name = 'AnniversaryDecor';
  const material = (color, glow = false) => new THREE.MeshPhysicalMaterial({
    color, roughness: .23, metalness: .12, clearcoat: 1, clearcoatRoughness: .12, envMapIntensity: 1.2,
    emissive: glow ? color : '#000000', emissiveIntensity: glow ? .75 : 0,
  });
  const pink = material('#FF4F99'), cream = material('#FFF1CE');
  const gold = material('#FFD139'), red = material('#F94A62');
  const light = material('#FFF1B0', true);
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const swirl = creamSwirl();
  const box = new THREE.BoxGeometry(1, 1, 1);
  function mesh(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, parent = group) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    parent.add(m); return m;
  }
  function tube(points, radius, mat, parent = group) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 8, false), mat);
    parent.add(m); return m;
  }
  // A layered strawberry cake sits to the rear-left, never in the claw's play volume.
  const cake = new THREE.Group(); cake.name = 'AnniversaryCake';
  cake.position.set(-3.15, 0, -3.8); cake.rotation.y = .25; cake.scale.setScalar(.85); group.add(cake);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 48);
  mesh(cylinder, pink, 0, .15, 0, 1.85, .3, 1.85, cake);
  mesh(cylinder, cream, 0, .8, 0, 1.65, 1.1, 1.65, cake);
  mesh(cylinder, pink, 0, 1.35, 0, 1.55, .12, 1.55, cake);
  mesh(cylinder, cream, 0, 1.65, 0, 1.2, .55, 1.2, cake);
  const green = material('#76C942');
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, x = Math.cos(a), z = Math.sin(a);
    mesh(sphere, cream, x * 1.54, 1.28, z * 1.54, .22, .24 + (i % 3) * .06, .22, cake);
    const dollop = mesh(swirl, cream, x, 1.93, z, 1, 1, 1, cake);
    dollop.rotation.y = a;
    if (i % 2 === 0) {
      mesh(sphere, red, x * 1.32, 1.62, z * 1.32, .18, .25, .18, cake);
      mesh(sphere, green, x * 1.32, 1.86, z * 1.32, .2, .045, .2, cake);
    }
  }
  // Seeds, leaves and tiny candy rods are instanced to keep the detail affordable.
  const seeds = new THREE.InstancedMesh(sphere, gold, 6 * 24);
  const seedMatrix = new THREE.Matrix4(), seedQ = new THREE.Quaternion();
  let seedIndex = 0;
  for (let berry = 0; berry < 6; berry++) {
    const angle = berry * Math.PI / 3, bx = Math.cos(angle) * 1.32, bz = Math.sin(angle) * 1.32;
    for (let j = 0; j < 24; j++) {
      const y = -.8 + Math.floor(j / 8) * .65, a = j * Math.PI / 4;
      const radius = Math.sqrt(1 - y * y);
      seedMatrix.compose(new THREE.Vector3(bx + Math.cos(a) * radius * .184, 1.62 + y * .25, bz + Math.sin(a) * radius * .184),
        seedQ, new THREE.Vector3(.012, .025, .012));
      seeds.setMatrixAt(seedIndex++, seedMatrix);
    }
    for (let leaf = 0; leaf < 5; leaf++) {
      const a = leaf * Math.PI * .4;
      const l = mesh(sphere, green, bx + Math.cos(a) * .09, 1.86, bz + Math.sin(a) * .09, .12, .025, .045, cake);
      l.rotation.y = -a;
    }
  }
  cake.add(seeds);
  const sprinkles = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.025, .11, 3, 5), cream, 70);
  const candyRnd = seeded(10);
  for (let i = 0; i < 70; i++) {
    const a = candyRnd() * Math.PI * 2, y = .4 + candyRnd() * .8;
    seedQ.setFromEuler(new THREE.Euler(0, -a, candyRnd() * Math.PI));
    seedMatrix.compose(new THREE.Vector3(Math.cos(a) * 1.66, y, Math.sin(a) * 1.66), seedQ, new THREE.Vector3(1, 1, 1));
    sprinkles.setMatrixAt(i, seedMatrix); sprinkles.setColorAt(i, new THREE.Color(pick(CANDY, candyRnd())));
  }
  cake.add(sprinkles);
  // Rounded wax strokes make a real, thick 3D "10", readable from the front.
  tube([[-.75, 2.65, .15], [-.45, 2.95, .15], [-.45, 2.05, .15]], .13, pink, cake);
  const zero = new THREE.Mesh(new THREE.TorusGeometry(.36, .13, 10, 32), pink);
  zero.position.set(.45, 2.5, .15); zero.scale.y = 1.35; cake.add(zero);
  for (const x of [-.45, .45]) {
    mesh(cylinder, cream, x, 3.05, .15, .025, .18, .025, cake);
    mesh(sphere, light, x, 3.22, .15, .085, .18, .085, cake);
  }
  // A lower marquee and layered candy-coloured arches remain visible in the portrait camera.
  const frame = roundedBox(1, 1, 1, .12);
  const panel = material('#8583DE');
  mesh(frame, panel, 0, 3.8, -11, 20, 7.6, .3);
  for (const x of [-6, 6]) {
    mesh(frame, gold, x, 3.3, -7, .36, 6.6, .4);
    mesh(frame, pink, x, 3.3, -6.7, .18, 6.6, .22);
  }
  mesh(frame, pink, 0, 6.3, -7, 12.8, .65, .65);
  mesh(frame, gold, 0, 6.3, -6.62, 12.3, .37, .08);
  for (let i = 0; i < 25; i++) mesh(sphere, light, -5.8 + i * .48, 6.3, -6.5, .16, .14, .09);
  for (let i = 0; i < 7; i++) {
    const x = -7.5 + i * 2.5;
    mesh(frame, material(i % 2 ? '#DC9CE4' : '#88CFE5'), x, 2.9, -10.7, 2.15, 5.5, .1);
    tube([[x - .85, .2, -10.5], [x - .85, 4.2, -10.5], [x, 5.2, -10.5],
      [x + .85, 4.2, -10.5], [x + .85, .2, -10.5]], .045, light);
  }
  // Bevelled hearts and stars have visible thickness when the camera turns.
  const heart = new THREE.Shape();
  heart.moveTo(0, -.55);
  heart.bezierCurveTo(-1, .05, -.75, .9, -.2, .65);
  heart.quadraticCurveTo(0, .55, 0, .4);
  heart.bezierCurveTo(.5, 1.25, 1.25, .2, 0, -.55);
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .32 : .68;
    if (!i) star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else star.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  star.closePath();
  const hearts = inflatedShape(heart), stars = inflatedShape(star);
  for (let i = 0; i < 8; i++) {
    const x = (i % 2 ? 1 : -1) * (2.7 + Math.floor(i / 2) * .8);
    const y = 3.4 + (i % 3) * .85, z = -3.5 - Math.floor(i / 2);
    const balloon = mesh(i % 3 ? hearts : stars, i % 3 ? pink : gold, x, y, z);
    balloon.rotation.z = (i % 2 ? 1 : -1) * .18;
    tube([[x, y - .6, z], [x + .12, y - 1.4, z], [x - .1, .6, z]], .012, cream);
    // Slim reflective patches and the neck seam give the foil a balloon-like finish.
    mesh(sphere, cream, x - .22, y + .22, z + .34, .045, .16, .012);
    mesh(sphere, i % 3 ? pink : gold, x, y - .63, z, .07, .1, .055);
    const curl = Array.from({length: 28}, (_, j) => {
      const t = j / 27; return [x + Math.sin(t * Math.PI * 4) * .13, y - .8 - t * 1.1, z + Math.cos(t * Math.PI * 4) * .13];
    });
    tube(curl, .022, i % 2 ? gold : pink);
  }
  return group;
}

/* 인형통은 바닥이 y = -0.5 에 있다(들판에서는 풀에 살짝 묻혀 서 있다).
   파티 바닥은 y ≈ 0 을 기준으로 짜여 있어서 그대로 두면 바닥면이 통의
   받침을 0.5 만큼 파고들어, 통이 파묻힌 것처럼 보였다. 안에 있는 것들은
   전부 '바닥 = 0' 기준으로 배치돼 있으므로 무리를 통째로 내려 맞춘다. */
const PARTY_FLOOR_Y = -0.5;

export function buildPartyBackdrop() {
  const g = new THREE.Group();
  g.name = 'Party';
  g.position.y = PARTY_FLOOR_Y;
  g.add(anniversaryDecor());
  const rnd = seeded(20261016);
  // Low rings and floor confetti decorate the visible foreground without blocking the toys.
  for (const [radius, color] of [[2.5, '#FF98C3'], [2.65, '#FFE9AB']]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, .035, 6, 96),
      new THREE.MeshStandardMaterial({color, roughness: .28, metalness: .3}));
    rim.rotation.x = -Math.PI / 2; rim.position.y = .015; g.add(rim);
  }
  const scatter = new THREE.InstancedMesh(new THREE.PlaneGeometry(.045, .1),
    new THREE.MeshStandardMaterial({side: THREE.DoubleSide, roughness: .3, metalness: .2}), 160);
  const scatterMatrix = new THREE.Matrix4(), scatterQ = new THREE.Quaternion();
  for (let i = 0; i < 160; i++) {
    const a = rnd() * Math.PI * 2, r = 2 + rnd() * 4;
    scatterQ.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, rnd() * Math.PI));
    scatterMatrix.compose(new THREE.Vector3(Math.cos(a) * r, .012, Math.sin(a) * r), scatterQ, new THREE.Vector3(1, 1, 1));
    scatter.setMatrixAt(i, scatterMatrix); scatter.setColorAt(i, new THREE.Color(pick(CANDY, rnd())));
  }
  g.add(scatter);

  const std = (color, extra) => new THREE.MeshStandardMaterial(
    Object.assign({ color: new THREE.Color(color), roughness: .42, metalness: 0 }, extra));

  /* ── 바닥 ──────────────────────────────────────────────────────
     인형통 그림자가 떨어지는 면이라 receiveShadow 를 켠다. */
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(34, 56),
    std('#EE7FAC', { roughness: .58 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -.02;
  floor.receiveShadow = true;
  g.add(floor);

  /* 바닥 가운데만 살짝 밝게 — 조명이 떨어진 자리처럼 보여 통이 떠 보이지 않는다 */
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(7.5, 48),
    new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFD9EA'), transparent: true, opacity: .5 }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = -.015;
  g.add(pool);

  /* ── 둘러싼 벽(사이클로라마) ────────────────────────────────────
     안쪽을 보는 큰 구. 위로 갈수록 연해져 천장이 트인 느낌을 준다. */
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(36, 30, 18, 0, Math.PI * 2, 0, Math.PI * .56),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PARTY_SKY), side: THREE.BackSide, fog: false }));
  g.add(dome);

  /* ── 선물 더미 ────────────────────────────────────────────────
     둥근 상자와 리본을 각각 인스턴스로 묶고 색·크기·각도를 다르게 한다. */
  const spots = giftSpots(rnd, 110);
  const { box, ribbon } = giftParts();
  const boxes = new THREE.InstancedMesh(box, new THREE.MeshPhysicalMaterial({ color: '#fff', roughness: .28, clearcoat: .7, clearcoatRoughness: .15 }), spots.length);
  const ribs = new THREE.InstancedMesh(ribbon, std('#fff', { roughness: .3 }), spots.length);
  boxes.castShadow = ribs.castShadow = true;
  boxes.receiveShadow = true;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3();
  spots.forEach((s, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.rot);
    v.set(s.x, s.y, s.z); one.set(s.size, s.size * (.85 + s.r * .3), s.size * (.9 + s.r * .2));
    m4.compose(v, q, one);
    boxes.setMatrixAt(i, m4); ribs.setMatrixAt(i, m4);
    const look = pick(GIFTS, s.r);
    boxes.setColorAt(i, new THREE.Color(look.box));
    ribs.setColorAt(i, new THREE.Color(look.ribbon));
  });
  boxes.instanceMatrix.needsUpdate = ribs.instanceMatrix.needsUpdate = true;
  g.add(boxes, ribs);

  /* ── 풍선 ──────────────────────────────────────────────────────
     살짝 눌린 구 + 아래로 뾰족한 꼭지. 통보다 높이 띄워 윗공간을 채운다. */
  const balloons = new THREE.InstancedMesh(
    new THREE.SphereGeometry(.5, 24, 16), new THREE.MeshPhysicalMaterial({ color: '#fff', roughness: .16, metalness: .18, clearcoat: 1, clearcoatRoughness: .08 }), 26);
  for (let i = 0; i < 26; i++) {
    let ang, rad, bx, bz, tries = 0;
    do { ang = rnd() * Math.PI * 2; rad = 9 + rnd() * 9;
         bx = Math.cos(ang) * rad; bz = Math.sin(ang) * rad; }
    while (inCameraWay(bx, bz, rad) && ++tries < 12);
    const s = .55 + rnd() * .6;
    v.set(bx, 4.2 + rnd() * 6.5, bz);
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), (rnd() - .5) * .5);
    one.set(s, s * 1.2, s);
    m4.compose(v, q, one);
    balloons.setMatrixAt(i, m4);
    balloons.setColorAt(i, new THREE.Color(pick(CANDY, rnd())));
  }
  balloons.instanceMatrix.needsUpdate = true;
  g.add(balloons);

  /* ── 색종이 ────────────────────────────────────────────────────
     공중에 흩뿌린 작은 조각. 양면으로 그려 어느 쪽에서 봐도 보인다. */
  const confetti = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(.17, .11),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: .92 }),
    140);
  for (let i = 0; i < 140; i++) {
    let ang, rad, cx2, cz2, tries = 0;
    do { ang = rnd() * Math.PI * 2; rad = 4 + rnd() * 11;
         cx2 = Math.cos(ang) * rad; cz2 = Math.sin(ang) * rad; }
    while (inCameraWay(cx2, cz2, rad) && ++tries < 12);
    v.set(cx2, 1.2 + rnd() * 8, cz2);
    q.setFromEuler(new THREE.Euler(rnd() * 6, rnd() * 6, rnd() * 6));
    one.set(1, 1, 1);
    m4.compose(v, q, one);
    confetti.setMatrixAt(i, m4);
    confetti.setColorAt(i, new THREE.Color(pick(CANDY, rnd())));
  }
  confetti.instanceMatrix.needsUpdate = true;
  g.add(confetti);

  return g;
}
