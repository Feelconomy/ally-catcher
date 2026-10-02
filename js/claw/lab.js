/* 집게 물리 실험실 — 게임과 분리해서 Phase 1~9 를 눈으로 확인하는 곳.
   요구 22·23: 콜라이더/접촉점/법선/힘을 그리고, 관통이 생기면 경고를 띄운다. */
import * as THREE from 'three';
import { initRapier, PhysicsWorld, GROUP, members, FIXED_DT } from './world.js?v=39435';
import { Toy } from './toy.js?v=39435';
import { ClawAssembly, CLAW } from './claw.js?v=39435';
import { GrabAnalyzer, GRIP } from './analyzer.js?v=39435';
import { ClawController, STATE } from './controller.js?v=39435';

const hud = document.getElementById('hud');
const testlog = document.getElementById('testlog');

// ---------------------------------------------------------------- 장면
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('view').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11161b);
const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 50);
camera.position.set(0.95, 0.80, 1.25);
camera.lookAt(0, 0.26, 0);

scene.add(new THREE.HemisphereLight(0xcfe4ff, 0x20262c, 1.1));
const key = new THREE.DirectionalLight(0xffffff, 2.0);
key.position.set(0.8, 1.6, 0.9);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.near = 0.3; key.shadow.camera.far = 4;
key.shadow.camera.left = -1; key.shadow.camera.right = 1;
key.shadow.camera.top = 1; key.shadow.camera.bottom = -1;
scene.add(key);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

// ---------------------------------------------------------------- 물리
await initRapier();
const pw = new PhysicsWorld();
const R = pw.R;

const BOX = { w: 1.20, d: 0.92, wallH: 0.62 };         // 기계 내부 (m). 집게 폭 0.32 보다 넉넉해야 벽에 안 걸린다
const CHUTE = { x: -0.38, z: 0.26, r: 0.115 };   // 집게가 닿는 범위(±0.41, ±0.27) 안이어야 한다

function staticBox(cx, cy, cz, hx, hy, hz, group = GROUP.WALL) {
  const b = pw.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(cx, cy, cz));
  const c = R.ColliderDesc.cuboid(hx, hy, hz).setFriction(0.5).setRestitution(0.0)
    .setCollisionGroups(members(group, GROUP.TOY | GROUP.CLAW)).setContactSkin(0.001);
  pw.world.createCollider(c, b);
  return b;
}
// 바닥 (배출구 구멍은 아래 sensor 로 표현하고, 바닥은 구멍 둘레만 막는다)
staticBox(0, -0.01, 0, BOX.w / 2, 0.01, BOX.d / 2);
// 벽 네 면
staticBox(-BOX.w / 2 - 0.01, 0.31, 0, 0.01, BOX.wallH / 2, BOX.d / 2);
staticBox( BOX.w / 2 + 0.01, 0.31, 0, 0.01, BOX.wallH / 2, BOX.d / 2);
staticBox(0, 0.31, -BOX.d / 2 - 0.01, BOX.w / 2, BOX.wallH / 2, 0.01);
staticBox(0, 0.31,  BOX.d / 2 + 0.01, BOX.w / 2, BOX.wallH / 2, 0.01);

const floorMesh = new THREE.Mesh(
  new THREE.BoxGeometry(BOX.w, 0.02, BOX.d),
  new THREE.MeshStandardMaterial({ color: 0x2b343d, roughness: 0.95 }));
floorMesh.position.y = -0.01; floorMesh.receiveShadow = true; scene.add(floorMesh);

// Phase 9 — 배출구 센서. 인형이 실제로 여기 떨어져야 성공이다.
const chuteBody = pw.world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(CHUTE.x, 0.02, CHUTE.z));
const chuteCol = pw.world.createCollider(
  R.ColliderDesc.cylinder(0.02, CHUTE.r).setSensor(true)
    .setCollisionGroups(members(GROUP.CHUTE, GROUP.TOY)), chuteBody);
const chuteRing = new THREE.Mesh(new THREE.TorusGeometry(CHUTE.r, 0.004, 8, 32),
  new THREE.MeshStandardMaterial({ color: 0x4ad991, emissive: 0x16623f }));
chuteRing.rotation.x = -Math.PI / 2; chuteRing.position.set(CHUTE.x, 0.005, CHUTE.z); scene.add(chuteRing);

// ---------------------------------------------------------------- 인형들
const COLORS = [0x8fd14f, 0xff9ec4, 0xffd166, 0x7cc4ff, 0xc9a6ff, 0xffa36c];
let toys = [];
function spawnToys() {
  for (const t of toys) { scene.remove(t.group); pw.world.removeRigidBody(t.body); }
  toys = [];
  /* 인형 폭이 약 0.25m 라 겹치지 않게 벌려 세우고, 위에 몇 개를 얹어 더미를 만든다.
     겹친 채로 만들면 첫 프레임에 서로를 밀어내며 깊은 관통이 생긴다. */
  /* 한 겹으로 벌려 둔다. 2층으로 쌓으면 더미 꼭대기가 0.33m 라 집게가 그 위에
     얹힌 채 멈춰서(발끝 0.31m) 인형 옆으로 내려갈 틈이 없었다. */
  /* 한 겹으로 벌려 둔다. 2층으로 쌓으면 더미 꼭대기가 집게 발끝보다 높아
     집게가 그 위에 얹힌 채 멈춘다. */
  const spots = [
    [-0.34, 0.004, -0.22], [0, 0.004, -0.22], [0.34, 0.004, -0.22],
    [-0.34, 0.004,  0.22], [0, 0.004,  0.22], [0.34, 0.004,  0.22],
  ];
  spots.forEach((p, i) => {
    toys.push(new Toy(pw, scene, {
      id: `Toy_${String(i + 1).padStart(2, '0')}`,
      position: [p[0] + (Math.random() - 0.5) * 0.01, p[1], p[2] + (Math.random() - 0.5) * 0.01],
      color: COLORS[i % COLORS.length],
    }));
  });
  pw.stepTimes(600);         // 더미가 완전히 가라앉을 때까지 (쓰러지는 데 2초 넘게 걸린다)
}
spawnToys();

// ---------------------------------------------------------------- 집게
const claw = new ClawAssembly(pw, scene, { x: 0, y: 0.86, z: 0 }, { cableLength: 0.12 });
const analyzer = new GrabAnalyzer(pw, claw, toys);
/* 집게 반경이 0.18 이라 벽에 닿지 않는 범위로 가둔다. 안 그러면 가장자리
   인형을 노릴 때 발이 벽에 걸려 내려가다 멈춘다. */
const REACH = 0.19;
const clampX = (x) => Math.max(-BOX.w / 2 + REACH, Math.min(BOX.w / 2 - REACH, x));
const clampZ = (z) => Math.max(-BOX.d / 2 + REACH, Math.min(BOX.d / 2 - REACH, z));
const rawMove = claw.moveCarriage.bind(claw);
claw.moveCarriage = (x, z, y) => rawMove(clampX(x), clampZ(z), y);

const controller = new ClawController(claw, analyzer, {
  restLength: 0.12, maxLength: 0.62,
  chute: { x: CHUTE.x, z: CHUTE.z }, home: { x: 0, z: 0 },
});

// 레일 + 줄 (보이기만)
const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 6),
  new THREE.MeshStandardMaterial({ color: 0x9aa7b2, metalness: .5, roughness: .5 }));
scene.add(cable);

// ---------------------------------------------------------------- 디버그 렌더
const dbgGeo = new THREE.BufferGeometry();
const dbgMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85 });
const dbgLines = new THREE.LineSegments(dbgGeo, dbgMat);
dbgLines.frustumCulled = false;
scene.add(dbgLines);

const contactGeo = new THREE.BufferGeometry();
const contactMat = new THREE.LineBasicMaterial({ color: 0xff4d4d });
const contactLines = new THREE.LineSegments(contactGeo, contactMat);
contactLines.frustumCulled = false;
scene.add(contactLines);

let showDebug = true;
function drawDebug() {
  dbgLines.visible = contactLines.visible = showDebug;
  if (!showDebug) return;
  const { vertices, colors } = pw.world.debugRender();
  dbgGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  dbgGeo.setAttribute('color', new THREE.BufferAttribute(colors, 4));

  // 접촉점에서 법선 방향으로 선을 그린다
  const pts = [];
  for (const c of analyzer.contacts) {
    const t = c.toy.body.translation();
    const len = Math.min(0.08, 0.012 + c.impulse * 40);
    pts.push(t.x, t.y, t.z, t.x + c.normal.x * len, t.y + c.normal.y * len, t.z + c.normal.z * len);
  }
  contactGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
}

// ---------------------------------------------------------------- 성공 판정
let caught = null;
function checkChute() {
  pw.world.intersectionPairsWith(chuteCol, (other) => {
    const toy = other.userData && other.userData.toy;
    if (toy && !caught) caught = toy;
  });
}

// ---------------------------------------------------------------- 루프
let slow = false, last = performance.now(), warnCooldown = 0;
// 배출 기록은 '다음 판을 시작할 때' 지운다. RETURN 에서 지웠더니 방금 떨어뜨린 걸 지워버렸다.
controller.onState = (s) => { if (s === STATE.DESCENDING) caught = null; };

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000) * (slow ? 0.25 : 1);
  last = now;

  pw.onStep[0] = (fdt) => controller.tick(fdt);
  const n = pw.advance(dt);
  if (n) {
    analyzer.update();
    checkChute();
    if (analyzer.penetrations.length && now - warnCooldown > 400) {
      warnCooldown = now;
      analyzer.reportPenetrations(controller.state);
    }
  }

  claw.sync();
  for (const t of toys) t.sync();

  // 줄 그리기
  const top = claw.origin, bot = claw.body.translation();
  const mid = new THREE.Vector3((top.x + bot.x) / 2, (top.y + bot.y) / 2, (top.z + bot.z) / 2);
  const dir = new THREE.Vector3(bot.x - top.x, bot.y - top.y, bot.z - top.z);
  cable.position.copy(mid);
  cable.scale.y = Math.max(0.001, dir.length());
  cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());

  drawDebug();
  renderer.render(scene, camera);
  updateHud();
  requestAnimationFrame(frame);
}

function fmt(n, d = 3) { return (n ?? 0).toFixed(d); }
function updateHud() {
  const a = analyzer;
  const held = a.heldToy;
  const lines = [];
  lines.push(`STATE: <b>${controller.state}</b>   grip: <b>${a.state}</b>`);
  lines.push(`winch target ${fmt(claw.winchTarget)} / now ${fmt(controller.lengthNow())}`);
  lines.push(`motor target ${fmt(claw.targetAngle, 2)} rad`);
  for (const f of claw.fingers) {
    const s = a.byFinger[f.index] || {};
    lines.push(`Finger ${'ABC'[f.index]}  angle ${fmt(claw.fingerAngle(f), 2)}`);
    lines.push(`  contact: ${s.toy ? s.toy.id : 'none'}${s.parts && s.parts.size ? ' [' + [...s.parts].join(',') + ']' : ''}`);
    lines.push(`  force: ${fmt((s.impulse || 0) / FIXED_DT, 2)} N   pts ${s.points || 0}`);
  }
  if (held) {
    const v = held.body.linvel(), w = held.body.angvel();
    lines.push(`${held.id}  mass ${fmt(held.mass)} kg`);
    lines.push(`  vel ${fmt(v.x, 2)} ${fmt(v.y, 2)} ${fmt(v.z, 2)}`);
    lines.push(`  angvel ${fmt(w.x, 1)} ${fmt(w.y, 1)} ${fmt(w.z, 1)}`);
  }
  lines.push(`caught in chute: ${caught ? caught.id : '-'}`);
  if (a.maxPenetration > 0)
    lines.push(`<span class="warn">PENETRATION ${(a.maxPenetration * 1000).toFixed(1)}mm</span>`);
  lines.push(`steps ${pw.steps}`);
  hud.innerHTML = lines.join('\n');
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- 조작
document.getElementById('btnDrop').onclick = () => controller.drop();
document.getElementById('btnReset').onclick = () => { spawnToys(); analyzer.toys = toys; caught = null; controller.set(STATE.IDLE); claw.open(true); claw.setWinch(0.12); claw.moveCarriage(0, 0); };
document.getElementById('btnDebug').onclick = (e) => { showDebug = !showDebug; e.target.classList.toggle('on', showDebug); };
document.getElementById('btnSlow').onclick = (e) => { slow = !slow; e.target.classList.toggle('on', slow); };
addEventListener('keydown', (e) => {
  const step = 0.02;
  if (e.key === 'ArrowLeft') claw.moveCarriage(claw.origin.x - step, claw.origin.z);
  if (e.key === 'ArrowRight') claw.moveCarriage(claw.origin.x + step, claw.origin.z);
  if (e.key === 'ArrowUp') claw.moveCarriage(claw.origin.x, claw.origin.z - step);
  if (e.key === 'ArrowDown') claw.moveCarriage(claw.origin.x, claw.origin.z + step);
  if (e.key === ' ') { e.preventDefault(); controller.drop(); }
  if (e.key === 'd') { showDebug = !showDebug; }
});

// ---------------------------------------------------------------- 테스트 (요구 28)
/* 한 판을 끝까지 돌리면서 관통 깊이·들린 높이·집힘 상태를 기록한다.
   물리를 건드리지 않고 '관찰'만 한다. */
function runDrop(x, z, maxSteps = 3600) {
  controller.set(STATE.IDLE); claw.open(true);
  controller.winchCmd = controller.restLength; claw.setWinch(controller.restLength);
  if (x !== undefined) claw.moveCarriage(x, z);
  pw.stepTimes(90); caught = null;
  const before = toys.map(t => { const p = t.body.translation(); return { id: t.id, x: p.x, y: p.y, z: p.z }; });
  controller.drop();
  let maxPen = 0, worst = null, liftPeak = 0, liftId = null;
  const seen = new Set();
  for (let i = 0; i < maxSteps; i++) {
    pw.stepTimes(1); analyzer.update();
    for (const c of analyzer.contacts) if (c.depth > maxPen) {
      maxPen = c.depth;
      worst = { f: 'ABC'[c.finger], seg: c.seg, toy: c.toy.id, part: c.part, mm: +(c.depth * 1000).toFixed(1), state: controller.state };
    }
    const h = analyzer.heldToy;
    if (h) { const b = before.find(o => o.id === h.id); const dy = h.body.translation().y - b.y; if (dy > liftPeak) { liftPeak = dy; liftId = h.id; } }
    seen.add(analyzer.state);
    if (controller.state === STATE.IDLE && i > 80) break;
  }
  const moved = toys.filter((t, i) => {
    const p = t.body.translation(), b = before[i];
    return Math.hypot(p.x - b.x, p.z - b.z) > 0.005;
  }).length;
  return { penMM: +(maxPen * 1000).toFixed(1), worst, liftMM: +(liftPeak * 1000).toFixed(0), liftId,
    grip: [...seen].join(' > '), caught: caught ? caught.id : null, moved };
}

function resetPile() { spawnToys(); analyzer.toys = toys; caught = null; controller.set(STATE.IDLE); claw.open(true); claw.setWinch(controller.restLength); controller.winchCmd = controller.restLength; claw.moveCarriage(0, 0); pw.stepTimes(240); }

const TOLERANCE_MM = 4;      // 이 이상 파고들면 실패로 본다
async function runTests() {
  const rows = [];
  const show = () => { testlog.innerHTML = rows.join('<br>'); };
  rows.push('<span class="run">실행 중…</span>'); show();
  const out = [];
  const spots = ['Toy_05', 'Toy_02', 'Toy_04', 'Toy_01', 'Toy_06'];
  rows.length = 0;
  for (const id of spots) {
    resetPile();
    const t = toys.find(x => x.id === id); if (!t) continue;
    const p = t.body.translation();
    const r = runDrop(p.x, p.z);
    out.push(r);
    const ok = r.penMM <= TOLERANCE_MM;
    rows.push(`<span class="${ok ? 'pass' : 'fail'}">${ok ? 'PASS' : 'FAIL'}</span> ${id} 위 · 관통 ${r.penMM}mm`);
    rows.push(`&nbsp;&nbsp;${r.grip}`);
    rows.push(`&nbsp;&nbsp;들림 ${r.liftMM}mm${r.liftId ? ' (' + r.liftId + ')' : ''} · 밀린 인형 ${r.moved}개${r.caught ? ' · 배출 ' + r.caught : ''}`);
    show();
    await new Promise(r2 => setTimeout(r2, 30));
  }
  // TEST 2: 중심에서 벗어나 내리면 인형이 밀리거나 돌아야 한다
  resetPile();
  const t2 = toys.find(x => x.id === 'Toy_02'); const p2 = t2.body.translation();
  const off = runDrop(p2.x + 0.05, p2.z);
  rows.push(`<span class="${off.moved > 0 ? 'pass' : 'fail'}">${off.moved > 0 ? 'PASS' : 'FAIL'}</span> 빗겨 내리기 · 밀린 인형 ${off.moved}개 · 관통 ${off.penMM}mm`);
  const worstPen = Math.max(...out.map(o => o.penMM), off.penMM);
  rows.push(`<br><b>최대 관통 ${worstPen}mm</b> (허용 ${TOLERANCE_MM}mm)`);
  show();
  return { runs: out, worstPen };
}
document.getElementById('btnTests').onclick = () => runTests();


/* toys 는 리셋 때마다 새 배열로 바뀐다. 참조로 들고 있으면 이미 지운 body 를
   건드려 wasm 이 죽으므로 getter 로 항상 현재 것을 준다. */
window.LAB = { pw, claw, analyzer, controller, scene, spawnToys, resetPile, runDrop, runTests, STATE, GRIP, CLAW,
  get toys() { return toys; },
  get caught() { return caught; }, set caught(v) { caught = v; },
  settle(steps = 120) { pw.stepTimes(steps); analyzer.update(); },
  log(html) { testlog.innerHTML = html; } };
