/* ══════════════════════════════════════════════════════════════════
   생일파티 배경 — 분홍 파티장에 선물이 쌓여 있는 풍경.

   들판(higgsfield-meadow-detailed.glb)은 9.25MB 에 248만 삼각형이라
   폰에서 가장 무거운 짐이다. 이 배경은 내려받을 파일 없이 three.js
   기본 도형으로 그 자리에서 조립한다 — 같은 자리를 채우면서 삼각형이
   1만대로 떨어진다.

   같은 모양이 여러 번 나오는 것(선물·풍선·색종이)은 InstancedMesh 로
   한 번에 그린다. 그래서 선물 40개가 draw call 2개다.

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
function giftParts() {
  const box = new THREE.BoxGeometry(1, 1, 1);
  /* 리본은 상자보다 아주 조금 크게 둘러 Z-fighting 을 피한다. 두 줄을 한
     지오메트리로 합쳐 두면 인스턴스 하나에 draw call 하나로 끝난다. */
  const a = new THREE.BoxGeometry(.2, 1.07, 1.07);
  const b = new THREE.BoxGeometry(1.07, 1.07, .2);
  const ribbon = mergeBoxes([a, b]);
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
export function buildPartyBackdrop() {
  const g = new THREE.Group();
  g.name = 'Party';
  const rnd = seeded(20261016);

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
     같은 상자를 40개 쓰되 색·크기·각도만 다르게 해서 draw call 2 로 끝낸다. */
  const spots = giftSpots(rnd, 110);
  const { box, ribbon } = giftParts();
  const boxes = new THREE.InstancedMesh(box, std('#fff', { roughness: .34 }), spots.length);
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
    new THREE.SphereGeometry(.5, 14, 10), std('#fff', { roughness: .22 }), 26);
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
