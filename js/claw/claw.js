/* Phase 3·5 — 집게. 발 세 개가 각각 실제 rigid body 이고, 중앙 몸통에 revolute
   joint 로 달려 있다. 닫는 동작은 애니메이션이 아니라 joint 모터가 '닫는 쪽으로
   토크를 거는' 것이다. 그래서 사이에 인형이 끼면 발은 중간 각도에서 멈춘다.

   윈치(줄)도 마찬가지로 prismatic joint 모터다. 힘이 유한해서, 집게가 인형에
   눌리면 목표 높이까지 내려가지 못하고 멈춘다 — 뚫고 내려가지 않는다. */
import * as THREE from 'three';
import { GROUP, members } from './world.js';

export const CLAW = {
  fingers: 3,
  /* 벌린 폭이 인형 몸통(지름 0.156m)을 감쌀 만큼은 돼야 한다. 전에는 폭이
     0.076m 라 인형의 1/8 크기여서 무엇도 감싸지 못했다.
     경첩 반경 0.09 + 벌림 1.0rad → 발끝 반경 0.145, 발끝 사이 폭 0.25m. */
  hingeR: 0.090,        // 몸통 중심에서 경첩까지
  bodyR: 0.075,
  bodyH: 0.032,
  openAngle: 1.00,      // + 가 바깥쪽
  closedAngle: -0.10,   // - 가 안쪽(오므림). 발이 길어져 이 각도면 발끝이 중심에서 만난다
  /* 모터는 force-based 스프링이다: 토크 = stiffness*(목표-현재) - damping*속도.
     stiffness 가 곧 집게 힘(GRIP_FORCE)이고, 유한하므로 인형이 버티면 못 닫는다. */
  /* 경첩에서 발끝까지 지렛대가 약 0.115m 다. stiffness 1.6 이면 발끝이 12N 으로
     눌러 0.83N 짜리 인형을 18mm 파고들었다. 발끝 힘이 2~3N 이 되게 낮춘다. */
  /* 집는 힘. 1.2 에서는 대부분 들어올리다 미끄러졌다. 접촉 강성을 올린 뒤로는
     세게 줘도 파고들지 않는다. 실측 성공률: 1.2→0/5, 3.0→1/5, 6.0→3/5
     (관통은 6.0 에서도 3.8mm 로 허용치 4mm 이내). 실험실 슬라이더로 조절 가능. */
  gripStiffness: 6.0,
  gripDamping: 0.12,
  /* 벌림은 세게. 0.5 였을 땐 목표가 1.0rad 인데도 제 무게에 눌려 0.61 에서
     멈춰, 벌린 폭이 0.076m 밖에 안 나왔다(인형 몸통 0.156m 을 못 감쌈). */
  openStiffness: 2.5,
  /* 줄 힘. 집게(약 0.42kg · 4.2N)를 들 만큼만 준다. 전에 900 이었을 땐 막혔을 때
     30N 넘게 밀어붙여 인형(0.83N)을 뚫었다 — 접촉이 이기도록 10N 선으로 낮춘다. */
  winchStiffness: 260,
  winchDamping: 26,
};

const CLAW_FILTER = members(GROUP.CLAW, GROUP.TOY | GROUP.WALL);

/* 발 하나의 모양 — 경첩이 원점, 아래로 내려가며 안쪽(-X)으로 휜다.
   마지막 tip 이 인형 표면에 걸리는 부분이라 제일 중요하다. */
const SEGMENTS = [
  { name: 'upper', r: 0.0135, h: 0.0440, pos: [0.0000, -0.0440, 0], rotZ: 0.0000 },
  { name: 'middle', r: 0.0125, h: 0.0360, pos: [-0.0206, -0.1175, 0], rotZ: -0.6109 },
  { name: 'tip', r: 0.0115, h: 0.0305, pos: [-0.0700, -0.1574, 0], rotZ: -1.2217 },
];

export class ClawAssembly {
  /**
   * @param {PhysicsWorld} pw
   * @param {THREE.Scene} scene
   * @param {{x:number,y:number,z:number}} origin  캐리지(윈치 상단) 위치
   */
  constructor(pw, scene, origin, { cableLength = 0.46, scale = 1, color = 0xf2c232, grip = CLAW.gripStiffness } = {}) {
    const R = pw.R;
    this.pw = pw;
    this.origin = { ...origin };
    this.cableLength = cableLength;
    /* 실험실(인형 0.3m)과 게임(인형 0.64) 처럼 세계 크기가 다르므로 치수를 통째로
       늘리고 줄인다. 힘(강성)은 지렛대 길이에 비례해 같이 키워야 체감이 같다. */
    this.scale = scale;
    /* 힘을 어떻게 키울지: 관절 토크는 '무게 x 지렛대' 라 크기의 4제곱으로 커진다
       (무게는 부피 = k^3, 지렛대 = k). 전에 k 배만 키웠더니 1.7배 세계에서
       발이 제 무게도 못 이겨 아예 안 벌어졌다. 줄(직선 모터)은 힘/거리 라 k^2. */
    this.torqueScale = scale ** 4;
    this.forceScale = scale ** 2;
    this.grip = grip * this.torqueScale;
    this.dims = {
      hingeR: CLAW.hingeR * scale, bodyR: CLAW.bodyR * scale, bodyH: CLAW.bodyH * scale,
    };
    this.group = new THREE.Group();
    scene.add(this.group);

    const metal = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.75 });
    this.metal = metal;

    /* 캐리지: 위치를 코드가 정하는 kinematic. X/Z 이동과 윈치의 기준점이다. */
    this.carriage = pw.world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(origin.x, origin.y, origin.z));

    /* 집게 몸통: dynamic. 윈치 joint 로 캐리지에 매달린다. */
    this.body = pw.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(origin.x, origin.y - cableLength, origin.z)
        .setCcdEnabled(true)
        .setSoftCcdPrediction(0.05)
        .setLinearDamping(1.4)
        .setAngularDamping(3.0)
        /* 재우면 안 된다 — 잠든 사이에 윈치 모터 목표를 바꿔도 깨지 않아서
           집게가 가만히 있었다(하강 명령이 먹지 않던 원인). */
        .setCanSleep(false));
    const bodyCol = R.ColliderDesc.cylinder(this.dims.bodyH, this.dims.bodyR)
      .setDensity(900).setFriction(0.6).setRestitution(0.0)
      .setCollisionGroups(CLAW_FILTER).setContactSkin(0.001);
    this.bodyCollider = pw.world.createCollider(bodyCol, this.body);
    this.bodyCollider.userData = { claw: 'body' };

    const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(this.dims.bodyR, this.dims.bodyR, this.dims.bodyH * 2, 20), metal);
    bodyMesh.castShadow = true;
    this.bodyMesh = bodyMesh;
    this.group.add(bodyMesh);

    /* 윈치: 캐리지와 몸통을 잇는 prismatic(Y) 모터. 목표 길이까지 당기되
       힘이 유한해서 막히면 멈춘다. */
    const winch = R.JointData.prismatic({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    this.winch = pw.world.createImpulseJoint(winch, this.carriage, this.body, true);
    this.winch.setContactsEnabled(false);
    this.winch.configureMotorModel(R.MotorModel.ForceBased);
    this.setWinch(cableLength);

    // ---- 발 세 개
    this.fingers = [];
    for (let i = 0; i < CLAW.fingers; i++) {
      const yaw = (i / CLAW.fingers) * Math.PI * 2;
      this.fingers.push(this._makeFinger(i, yaw, metal));
    }
    this.targetAngle = CLAW.openAngle;
    this.open(true);
    this.sync();
  }

  _makeFinger(index, yaw, material) {
    const R = this.pw.R;
    const pw = this.pw;
    /* 발은 제 몸을 Y 로 돌려 세우지 않는다. 돌려 세웠더니 경첩 축 (0,0,1) 이
       발의 로컬 축으로 해석돼 같이 돌아갔고, 세 발이 120도로 갈라지지 않고
       전부 한 방향으로 꺾였다. 대신 120도 회전을 collider 좌표에 구워 넣고,
       경첩 축만 발마다 다른 '접선 방향'으로 준다. */
    const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -yaw, 0));
    const out = new THREE.Vector3(Math.cos(yaw), 0, Math.sin(yaw));     // 바깥 반지름 방향
    const axis = new THREE.Vector3(-Math.sin(yaw), 0, Math.cos(yaw));   // 경첩 축(접선)

    const hinge = out.clone().multiplyScalar(this.dims.hingeR).setY(-this.dims.bodyH * 0.6);
    const bodyPos = this.body.translation();

    const fb = pw.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(bodyPos.x + hinge.x, bodyPos.y + hinge.y, bodyPos.z + hinge.z)
        .setCcdEnabled(true)
        .setSoftCcdPrediction(0.04)
        .setAngularDamping(1.2)
        .setCanSleep(false));

    const group = new THREE.Group();
    const colliders = [];
    for (const s of SEGMENTS) {
      // 로컬 (x, y) 를 그 발의 방향으로 돌려 놓는다: +x 가 바깥, -x 가 안쪽
      const k = this.scale;
      const pos = new THREE.Vector3(s.pos[0] * k, s.pos[1] * k, s.pos[2] * k).applyQuaternion(spin);
      const rot = spin.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, s.rotZ)));
      const desc = R.ColliderDesc.capsule(s.h * k, s.r * k)
        .setTranslation(pos.x, pos.y, pos.z)
        .setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w })
        .setDensity(1200)
        .setFriction(0.95)                 // 금속이지만 집게는 잘 무는 편
        .setRestitution(0.0)
        .setFrictionCombineRule(R.CoefficientCombineRule.Max)
        .setCollisionGroups(CLAW_FILTER)
        .setContactSkin(0.0005);
      const col = pw.world.createCollider(desc, fb);
      col.userData = { claw: 'finger', finger: index, seg: s.name };
      colliders.push(col);

      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(s.r * k, s.h * 2 * k, 6, 12), material);
      mesh.position.copy(pos);
      mesh.quaternion.copy(rot);
      mesh.castShadow = true;
      group.add(mesh);
    }
    this.group.add(group);

    /* 경첩: 발마다 제 접선 축 둘레로만 돈다. 두 몸체 모두 회전이 없으므로
       같은 월드 축을 그대로 양쪽 로컬 축으로 쓸 수 있다. */
    const jd = R.JointData.revolute(
      { x: hinge.x, y: hinge.y, z: hinge.z }, { x: 0, y: 0, z: 0 },
      { x: axis.x, y: axis.y, z: axis.z });
    const joint = pw.world.createImpulseJoint(jd, this.body, fb, true);
    joint.setContactsEnabled(false);
    joint.configureMotorModel(R.MotorModel.ForceBased);
    /* 위쪽 한계를 넉넉히 둔다. 좁게 잡았더니 인형에 막힌 발이 한계각에 박혀
       더 벌어지지도 못하고, 그 자리에서 인형을 뚫고 있었다. 실제 집게도 걸리면
       바깥으로 밀려 벌어진다. */
    joint.setLimits(CLAW.closedAngle - 0.05, CLAW.openAngle + 0.60);

    return { index, yaw, axis, body: fb, joint, colliders, group, hinge };
  }

  /** 윈치 목표 길이(m). 길수록 집게가 아래로 내려간다. */
  setWinch(length) {
    this.winchTarget = length;
    this.winch.configureMotorPosition(-length, CLAW.winchStiffness * this.forceScale, CLAW.winchDamping * this.forceScale);
  }

  /** 캐리지를 X/Z 로 옮긴다 (kinematic). */
  moveCarriage(x, z, y = this.origin.y) {
    this.origin.x = x; this.origin.z = z; this.origin.y = y;
    this.carriage.setNextKinematicTranslation({ x, y, z });
  }

  setGrip(stiffness) { this.grip = stiffness * this.torqueScale; if (this.targetAngle === CLAW.closedAngle) this.close(); }

  close() {
    this.targetAngle = CLAW.closedAngle;
    for (const f of this.fingers)
      f.joint.configureMotorPosition(CLAW.closedAngle, this.grip, CLAW.gripDamping * this.torqueScale);
  }

  open(hard = false) {
    this.targetAngle = CLAW.openAngle;
    for (const f of this.fingers)
      f.joint.configureMotorPosition(CLAW.openAngle, (hard ? CLAW.openStiffness * 3 : CLAW.openStiffness) * this.torqueScale, CLAW.gripDamping * this.torqueScale);
  }

  /** 발이 지금 얼마나 빨리 여닫히는지 (제 경첩 축 기준, rad/s). */
  fingerSpeed(f) {
    const w = f.body.angvel();
    return Math.abs(w.x * f.axis.x + w.y * f.axis.y + w.z * f.axis.z);
  }

  /** 발의 실제 각도 — 몸통 기준 상대 회전을 그 발의 경첩 축에 투영해서 읽는다. */
  fingerAngle(f) {
    const bq = this.body.rotation(), fq = f.body.rotation();
    const inv = new THREE.Quaternion(bq.x, bq.y, bq.z, bq.w).invert();
    const rel = new THREE.Quaternion(fq.x, fq.y, fq.z, fq.w).premultiply(inv);
    const v = new THREE.Vector3(rel.x, rel.y, rel.z);
    return 2 * Math.atan2(v.dot(f.axis), rel.w);
  }

  get clawY() { return this.body.translation().y; }

  sync() {
    const t = this.body.translation(), r = this.body.rotation();
    this.bodyMesh.position.set(t.x, t.y, t.z);
    this.bodyMesh.quaternion.set(r.x, r.y, r.z, r.w);
    for (const f of this.fingers) {
      const ft = f.body.translation(), fr = f.body.rotation();
      f.group.position.set(ft.x, ft.y, ft.z);
      f.group.quaternion.set(fr.x, fr.y, fr.z, fr.w);
    }
  }
}
