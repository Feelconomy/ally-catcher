/* Phase 6·12·13·24 — 접촉 분석기.
   여기서 '잡혔다'를 만들지 않는다. 물리 결과를 읽어서 설명만 한다:
   어느 발이 어느 인형의 어디에 닿아 있고, 얼마나 세게 누르고 있고,
   인형이 집게를 따라 올라오는지 미끄러지는지.

   파생 상태(NONE·TOUCHING·PINCHED·LIFTING·SLIPPING·LOST)는 전부 결과지
   원인이 아니다. 인형을 들어 올리는 건 접촉력과 마찰뿐이다. */
import * as THREE from 'three';

export const GRIP = { NONE: 'NONE', TOUCHING: 'TOUCHING', PINCHED: 'PINCHED', LIFTING: 'LIFTING', SLIPPING: 'SLIPPING', LOST: 'LOST' };

const EPS_IMPULSE = 1e-5;

export class GrabAnalyzer {
  constructor(pw, claw, toys) {
    this.pw = pw; this.claw = claw; this.toys = toys;
    this.contacts = [];        // 이번 스텝의 접촉 목록
    this.byFinger = [];        // 발별 요약
    this.state = GRIP.NONE;
    this.heldToy = null;
    this.penetrations = [];    // 관통 경고용
    this.maxPenetration = 0;
  }

  toyOf(collider) {
    const d = collider.userData;
    return d && d.toy ? d.toy : null;
  }

  /** 매 물리 스텝 뒤에 호출. 접촉을 모으고 상태를 다시 계산한다. */
  update() {
    const world = this.pw.world;
    this.contacts.length = 0;
    this.penetrations.length = 0;
    this.maxPenetration = 0;

    const perFinger = this.claw.fingers.map(f => ({
      finger: f.index, toy: null, points: 0, impulse: 0,
      normal: new THREE.Vector3(), parts: new Set(),
    }));

    /* Rapier 의 접촉 조회는 중첩하면 안 된다 — contactPairsWith 콜백 안에서
       contactPair 를 부르면 같은 객체를 두 번 빌려 wasm 이 죽는다.
       먼저 닿은 쌍만 모으고, 바깥에서 manifold 를 읽는다. */
    const pairs = [];
    for (const f of this.claw.fingers)
      for (const fc of f.colliders)
        world.contactPairsWith(fc, (other) => {
          const toy = this.toyOf(other);
          if (toy) pairs.push({ f, fc, other, toy });
        });

    for (const { f, fc, other, toy } of pairs) {
      const slot = perFinger[f.index];
      world.contactPair(fc, other, (manifold, flipped) => {
        const n = manifold.normal();
        // manifold 법선은 collider1 기준 — flipped 면 뒤집어서 '발 → 인형' 방향으로
        const nx = flipped ? -n.x : n.x, ny = flipped ? -n.y : n.y, nz = flipped ? -n.z : n.z;
        let impulse = 0, pts = 0, deepest = 0;
        for (let i = 0; i < manifold.numContacts(); i++) {
          const dist = manifold.contactDist(i);
          if (dist < 0 && -dist > deepest) deepest = -dist;
          const imp = manifold.contactImpulse(i);
          if (imp > EPS_IMPULSE) { impulse += imp; pts++; }
        }
        if (deepest > 0.004) {                 // 허용 오차 4mm 넘는 파고듦
          this.penetrations.push({ finger: f.index, seg: fc.userData.seg, toy: toy.id, depth: deepest, part: other.userData.part });
          if (deepest > this.maxPenetration) this.maxPenetration = deepest;
        }
        if (pts === 0 && deepest === 0) return;
        this.contacts.push({
          finger: f.index, seg: fc.userData.seg, toy, part: other.userData.part,
          impulse, points: pts, normal: { x: nx, y: ny, z: nz }, depth: deepest,
        });
        if (impulse >= slot.impulse) {
          slot.toy = toy;
          slot.normal.set(nx, ny, nz);
        }
        slot.impulse += impulse;
        slot.points += pts;
        slot.parts.add(other.userData.part);
      });
    }
    this.byFinger = perFinger;
    this._deriveState();
  }

  /** 접촉이 붙어 있는 인형 중 가장 세게 눌리는 하나 */
  _dominantToy() {
    const score = new Map();
    for (const c of this.contacts) score.set(c.toy, (score.get(c.toy) || 0) + c.impulse + 1e-6);
    let best = null, bv = 0;
    for (const [toy, v] of score) if (v > bv) { bv = v; best = toy; }
    return best;
  }

  _deriveState() {
    const toy = this._dominantToy();
    if (!toy) {
      this.state = this.heldToy ? GRIP.LOST : GRIP.NONE;
      this.heldToy = null;
      return;
    }
    const touching = this.byFinger.filter(s => s.toy === toy && s.points > 0);
    const pressing = touching.filter(s => s.impulse > EPS_IMPULSE * 20);

    /* 서로 '마주보는' 방향에서 눌러야 집는 힘이 된다 — 법선 내적이 음수인 쌍이
       있으면 양쪽에서 압착 중이라는 뜻. 발 하나라도 오목한 곳(겨드랑이·다리
       사이)에 걸려 있으면 그것도 지지로 본다. */
    let opposed = false;
    for (let i = 0; i < pressing.length && !opposed; i++)
      for (let j = i + 1; j < pressing.length; j++)
        if (pressing[i].normal.dot(pressing[j].normal) < -0.15) { opposed = true; break; }
    const hooked = this.contacts.some(c => c.toy === toy && c.seg === 'tip' && c.impulse > EPS_IMPULSE * 20
      && (c.part === 'armL' || c.part === 'armR' || c.part === 'legL' || c.part === 'legR' || c.part === 'head'));

    const toyV = toy.body.linvel();
    const clawV = this.claw.body.linvel();
    const rel = toyV.y - clawV.y;                    // 집게 기준 인형의 수직 속도

    if (opposed || (hooked && pressing.length >= 1)) {
      this.heldToy = toy;
      if (clawV.y > 0.02) this.state = rel < -0.04 ? GRIP.SLIPPING : GRIP.LIFTING;
      else this.state = GRIP.PINCHED;
    } else {
      if (this.heldToy === toy && clawV.y > 0.02 && rel < -0.04) this.state = GRIP.SLIPPING;
      else { this.state = touching.length ? GRIP.TOUCHING : GRIP.NONE; this.heldToy = null; }
    }
  }

  /** 개발 모드용 경고 — 집게가 인형을 뚫으면 정상 상태로 보지 않는다. */
  reportPenetrations(stateName) {
    for (const p of this.penetrations) {
      console.warn(`[PHYSICS WARNING]\nClaw Finger ${'ABC'[p.finger]} (${p.seg}) penetrated ${p.toy} (${p.part})\n  depth: ${(p.depth * 1000).toFixed(1)}mm\n  state: ${stateName}`);
    }
  }
}
