/* Phase 3·5 — 집게. 발 세 개가 각각 실제 rigid body 이고, 중앙 몸통에 revolute
   joint 로 달려 있다. 닫는 동작은 애니메이션이 아니라 joint 모터가 '닫는 쪽으로
   토크를 거는' 것이다. 그래서 사이에 인형이 끼면 발은 중간 각도에서 멈춘다.

   윈치(줄)도 마찬가지로 prismatic joint 모터다. 힘이 유한해서, 집게가 인형에
   눌리면 목표 높이까지 내려가지 못하고 멈춘다 — 뚫고 내려가지 않는다. */
import * as THREE from 'three';
import { GROUP, members } from './world.js';

export const CLAW = {
  fingers: 3,
  hingeR: 0.044,        // 몸통 중심에서 경첩까지
  bodyR: 0.050,
  bodyH: 0.030,
  openAngle: 0.62,      // + 가 바깥쪽
  closedAngle: -0.30,   // - 가 안쪽(오므림)
  /* 모터는 force-based 스프링이다: 토크 = stiffness*(목표-현재) - damping*속도.
     stiffness 가 곧 집게 힘(GRIP_FORCE)이고, 유한하므로 인형이 버티면 못 닫는다. */
  /* 경첩에서 발끝까지 지렛대가 약 0.115m 다. stiffness 1.6 이면 발끝이 12N 으로
     눌러 0.83N 짜리 인형을 18mm 파고들었다. 발끝 힘이 2~3N 이 되게 낮춘다. */
  gripStiffness: 0.5,
  gripDamping: 0.05,
  openStiffness: 0.5,
  /* 줄 힘. 집게(약 0.42kg · 4.2N)를 들 만큼만 준다. 전에 900 이었을 땐 막혔을 때
     30N 넘게 밀어붙여 인형(0.83N)을 뚫었다 — 접촉이 이기도록 10N 선으로 낮춘다. */
  winchStiffness: 260,
  winchDamping: 26,
};

const CLAW_FILTER = members(GROUP.CLAW, GROUP.TOY | GROUP.WALL);

/* 발 하나의 모양 — 경첩이 원점, 아래로 내려가며 안쪽(-X)으로 휜다.
   마지막 tip 이 인형 표면에 걸리는 부분이라 제일 중요하다. */
const SEGMENTS = [
  { name: 'upper', r: 0.0095, h: 0.0275, pos: [0.0000, -0.0275, 0], rotZ: 0.0000 },
  { name: 'middle', r: 0.009, h: 0.0225, pos: [-0.0129, -0.0734, 0], rotZ: -0.6109 },
  { name: 'tip', r: 0.0085, h: 0.0190, pos: [-0.0437, -0.0984, 0], rotZ: -1.2217 },
];

export class ClawAssembly {
  /**
   * @param {PhysicsWorld} pw
   * @param {THREE.Scene} scene
   * @param {{x:number,y:number,z:number}} origin  캐리지(윈치 상단) 위치
   */
  constructor(pw, scene, origin, { cableLength = 0.46 } = {}) {
    const R = pw.R;
    this.pw = pw;
    this.origin = { ...origin };
    this.cableLength = cableLength;
    this.group = new THREE.Group();
    scene.add(this.group);

    const metal = new THREE.MeshStandardMaterial({ color: 0xf2c232, roughness: 0.32, metalness: 0.75 });
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
    const bodyCol = R.ColliderDesc.cylinder(CLAW.bodyH, CLAW.bodyR)
      .setDensity(900).setFriction(0.6).setRestitution(0.0)
      .setCollisionGroups(CLAW_FILTER).setContactSkin(0.001);
    this.bodyCollider = pw.world.createCollider(bodyCol, this.body);
    this.bodyCollider.userData = { claw: 'body' };

    const bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(CLAW.bodyR, CLAW.bodyR, CLAW.bodyH * 2, 20), metal);
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
    // 경첩 위치(몸통 기준): 바깥으로 hingeR, 몸통 아래쪽
    const hinge = new THREE.Vector3(Math.cos(yaw) * CLAW.hingeR, -CLAW.bodyH * 0.6, Math.sin(yaw) * CLAW.hingeR);
    const bodyPos = this.body.translation();
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -yaw, 0));

    const fb = pw.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(bodyPos.x + hinge.x, bodyPos.y + hinge.y, bodyPos.z + hinge.z)
        .setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
        .setCcdEnabled(true)
        .setSoftCcdPrediction(0.04)
        .setAngularDamping(1.2)
        .setCanSleep(false));

    const group = new THREE.Group();
    const colliders = [];
    for (const s of SEGMENTS) {
      const desc = R.ColliderDesc.capsule(s.h, s.r)
        .setTranslation(s.pos[0], s.pos[1], s.pos[2])
        .setDensity(1200)
        .setFriction(0.95)                 // 금속이지만 집게는 잘 무는 편
        .setRestitution(0.0)
        .setFrictionCombineRule(R.CoefficientCombineRule.Max)
        .setCollisionGroups(CLAW_FILTER)
        .setContactSkin(0.0005);
      if (s.rotZ) {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, s.rotZ));
        desc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
      }
      const col = pw.world.createCollider(desc, fb);
      col.userData = { claw: 'finger', finger: index, seg: s.name };
      colliders.push(col);

      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(s.r, s.h * 2, 6, 12), material);
      mesh.position.set(s.pos[0], s.pos[1], s.pos[2]);
      if (s.rotZ) mesh.rotation.z = s.rotZ;
      mesh.castShadow = true;
      group.add(mesh);
    }
    this.group.add(group);

    /* 경첩: 발이 Z 축(제 몸 기준) 둘레로만 돈다. 모터가 닫는 쪽으로 토크를 건다. */
    const jd = R.JointData.revolute(
      { x: hinge.x, y: hinge.y, z: hinge.z }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
    const joint = pw.world.createImpulseJoint(jd, this.body, fb, true);
    joint.setContactsEnabled(false);
    joint.configureMotorModel(R.MotorModel.ForceBased);
    /* 위쪽 한계를 넉넉히 둔다. 좁게 잡았더니 인형에 막힌 발이 한계각에 박혀
       더 벌어지지도 못하고, 그 자리에서 인형을 뚫고 있었다. 실제 집게도 걸리면
       바깥으로 밀려 벌어진다. */
    joint.setLimits(CLAW.closedAngle - 0.05, CLAW.openAngle + 0.60);

    return { index, yaw, body: fb, joint, colliders, group, hinge };
  }

  /** 윈치 목표 길이(m). 길수록 집게가 아래로 내려간다. */
  setWinch(length) {
    this.winchTarget = length;
    this.winch.configureMotorPosition(-length, CLAW.winchStiffness, CLAW.winchDamping);
  }

  /** 캐리지를 X/Z 로 옮긴다 (kinematic). */
  moveCarriage(x, z, y = this.origin.y) {
    this.origin.x = x; this.origin.z = z; this.origin.y = y;
    this.carriage.setNextKinematicTranslation({ x, y, z });
  }

  close() {
    this.targetAngle = CLAW.closedAngle;
    for (const f of this.fingers)
      f.joint.configureMotorPosition(CLAW.closedAngle, CLAW.gripStiffness, CLAW.gripDamping);
  }

  open(hard = false) {
    this.targetAngle = CLAW.openAngle;
    for (const f of this.fingers)
      f.joint.configureMotorPosition(CLAW.openAngle, hard ? CLAW.openStiffness * 3 : CLAW.openStiffness, CLAW.gripDamping);
  }

  /** 발의 실제 각도 — 몸통 기준 상대 회전에서 뽑는다. */
  fingerAngle(f) {
    const bq = this.body.rotation(), fq = f.body.rotation();
    const inv = new THREE.Quaternion(bq.x, bq.y, bq.z, bq.w).invert();
    const rel = new THREE.Quaternion(fq.x, fq.y, fq.z, fq.w).premultiply(inv);
    const e = new THREE.Euler().setFromQuaternion(rel, 'YZX');
    return e.z;
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
