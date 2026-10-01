/* Phase 2 — 인형. 박스 하나가 아니라 생김새를 따라가는 compound collider.
   머리·몸통·팔·다리를 각각 collider 로 붙여야 집게 발이 머리 밑이나 겨드랑이,
   다리 사이에 '걸릴' 수 있다. ragdoll 이 아니라 rigid body 하나에 여러 collider. */
import * as THREE from 'three';
import { GROUP, members } from './world.js';

/* 기준 치수(m). 인형 전체 높이 ≈ 0.30 — 실제 인형뽑기 기계 안의 중형 인형. */
export const TOY = {
  head: 0.070,        // 머리 반지름
  torsoR: 0.078,      // 몸통 반지름
  torsoH: 0.052,      // 몸통 캡슐의 직선 구간 절반
  limbR: 0.030,       // 팔다리 반지름
  armLen: 0.030,
  legLen: 0.026,
};

const TOY_FILTER = members(GROUP.TOY, GROUP.TOY | GROUP.CLAW | GROUP.WALL | GROUP.CHUTE);

/** 머리 아래·팔 옆 같은 오목한 곳이 실제로 생기도록 부위를 배치한다. */
function partLayout() {
  const { head, torsoR, torsoH, limbR, armLen, legLen } = TOY;
  const torsoY = legLen + limbR + torsoH + 0.012;
  const headY = torsoY + torsoH + head * 0.82;      // 머리가 몸통에 살짝 묻힌다
  return [
    { name: 'head',  kind: 'ball',    r: head,  pos: [0, headY, 0] },
    { name: 'torso', kind: 'capsule', r: torsoR, h: torsoH, pos: [0, torsoY, 0] },
    // 팔은 몸통 옆에서 바깥으로 — 겨드랑이 틈이 집게 발이 걸리는 자리다
    { name: 'armL',  kind: 'capsule', r: limbR, h: armLen, pos: [-(torsoR + limbR * 0.55), torsoY + 0.010, 0], rot: [0, 0, 1.15] },
    { name: 'armR',  kind: 'capsule', r: limbR, h: armLen, pos: [ (torsoR + limbR * 0.55), torsoY + 0.010, 0], rot: [0, 0, -1.15] },
    { name: 'legL',  kind: 'capsule', r: limbR, h: legLen, pos: [-0.042, legLen + limbR, 0.012], rot: [0, 0, 0] },
    { name: 'legR',  kind: 'capsule', r: limbR, h: legLen, pos: [ 0.042, legLen + limbR, 0.012], rot: [0, 0, 0] },
  ];
}

export class Toy {
  /** @param {PhysicsWorld} pw @param {THREE.Scene} scene */
  constructor(pw, scene, { id, position, color = 0x8fd14f, mass = 0.085, friction = 0.85 }) {
    const R = pw.R;
    this.id = id;
    this.pw = pw;

    const bodyDesc = R.RigidBodyDesc.dynamic()
      .setTranslation(position[0], position[1], position[2])
      .setCcdEnabled(true)                 // 집게·바닥을 뚫고 지나가지 않게
      .setLinearDamping(0.22)
      .setAngularDamping(0.5)
      .setSoftCcdPrediction(0.03);
    this.body = pw.world.createRigidBody(bodyDesc);

    this.colliders = [];
    this.group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02 });
    this.material = mat;

    const parts = partLayout();
    // 부위 부피 합으로 밀도를 역산해 전체 질량이 mass 가 되게 한다
    let volume = 0;
    for (const p of parts) {
      volume += p.kind === 'ball'
        ? (4 / 3) * Math.PI * p.r ** 3
        : Math.PI * p.r ** 2 * (2 * p.h) + (4 / 3) * Math.PI * p.r ** 3;
    }
    const density = mass / volume;

    for (const p of parts) {
      const desc = p.kind === 'ball' ? R.ColliderDesc.ball(p.r) : R.ColliderDesc.capsule(p.h, p.r);
      desc.setTranslation(p.pos[0], p.pos[1], p.pos[2]);
      if (p.rot) {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(p.rot[0], p.rot[1], p.rot[2]));
        desc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
      }
      desc.setDensity(density)
        .setFriction(friction)
        .setRestitution(0.03)                      // 봉제인형은 튀지 않는다
        .setFrictionCombineRule(R.CoefficientCombineRule.Average)
        .setCollisionGroups(TOY_FILTER)
        .setContactSkin(0.0005);
      const col = pw.world.createCollider(desc, this.body);
      col.userData = { toy: this, part: p.name };
      this.colliders.push(col);

      // 보이는 mesh 는 collider 와 정확히 같은 자리·같은 크기
      const geo = p.kind === 'ball'
        ? new THREE.SphereGeometry(p.r, 18, 14)
        : new THREE.CapsuleGeometry(p.r, p.h * 2, 8, 16);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p.pos[0], p.pos[1], p.pos[2]);
      if (p.rot) mesh.rotation.set(p.rot[0], p.rot[1], p.rot[2]);
      mesh.castShadow = true;
      this.group.add(mesh);
    }
    scene.add(this.group);
    this.sync();
  }

  get mass() { return this.body.mass(); }
  get position() { return this.body.translation(); }
  get linvel() { return this.body.linvel(); }

  hasCollider(c) { return this.colliders.includes(c); }

  sync() {
    const t = this.body.translation(), r = this.body.rotation();
    this.group.position.set(t.x, t.y, t.z);
    this.group.quaternion.set(r.x, r.y, r.z, r.w);
  }
}
