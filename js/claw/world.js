/* Phase 1 — Rapier 물리 월드.
   Three.js 는 그리기만 하고, 충돌·마찰·접촉힘은 전부 여기서 계산한다.
   고정 timestep 으로 돌리고, 남는 시간은 다음 프레임으로 넘긴다(accumulator).
   집게가 인형을 뚫지 않는 것이 최우선이라 substep 과 solver 반복을 넉넉히 준다. */
import RAPIER from '../../vendor/rapier3d-compat.js';

export const FIXED_DT = 1 / 240;       // 집게 발이 얇아서 60·120·180Hz 로는 파고든다
export const MAX_STEPS_PER_FRAME = 16;  // 탭을 멈췄다 돌아와도 폭주하지 않게

/** 충돌 그룹 — Rapier 는 (membership << 16) | filter 형태의 32bit 값을 쓴다. */
export const GROUP = { WALL: 1, TOY: 2, CLAW: 4, CHUTE: 8 };
export const members = (mine, hits) => ((mine << 16) | hits) >>> 0;

export async function initRapier() {
  await RAPIER.init();
  return RAPIER;
}

export class PhysicsWorld {
  /* 비용은 timestep·solver 반복에 거의 비례한다. 실험실은 물체가 작아(발끝 8mm)
     촘촘해야 안 뚫리지만, 게임은 1.7배라 더 성글어도 된다 — 그래서 월드마다
     따로 준다. 실측(인형 26마리가 모두 깨어 있을 때, 프레임당):
       1/240 · 28회 = 7.2ms (관통 0.3mm)   1/180 · 16회 = 3.5ms (1.0mm)
       1/120 · 16회 = 2.4ms (3.3mm) */
  constructor(gravity = { x: 0, y: -9.81, z: 0 }, opts = {}) {
    this.R = RAPIER;
    this.world = new RAPIER.World(gravity);
    this.dt = opts.dt ?? FIXED_DT;
    this.maxSteps = opts.maxSteps ?? MAX_STEPS_PER_FRAME;
    this.world.timestep = this.dt;
    /* 접촉을 단단하게: 반복 횟수를 올리면 집게가 인형을 파고드는 깊이가 줄고
       압착이 버틴다. 숫자는 Phase 4 에서 관통 측정으로 맞췄다. */
    this.world.numSolverIterations = opts.solverIterations ?? 28;
    this.world.numAdditionalFrictionIterations = opts.frictionIterations ?? 8;
    this.world.numInternalPgsIterations = opts.pgsIterations ?? 4;
    /* 접촉 강성. 기본 30Hz 는 우리 크기(발끝 반지름 8mm)에선 너무 물러서
       인형 무게 0.83N 에도 발끝이 20mm 씩 파고들었다. 측정값:
       30Hz→20mm, 120Hz(dt 1/180)→13.5mm, 180Hz(dt 1/240)→0.7mm. */
    this.world.integrationParameters.contact_natural_frequency = opts.contactFrequency ?? 180;
    this.events = new RAPIER.EventQueue(true);
    this.accumulator = 0;
    this.steps = 0;
    this.onStep = [];                // 매 고정 스텝마다 부를 콜백 (모터 제어 등)
  }

  /** 렌더 프레임에서 흐른 시간만큼 물리를 고정 간격으로 따라잡는다. */
  advance(dtSeconds) {
    this.accumulator += Math.min(dtSeconds, 0.25);
    let n = 0;
    while (this.accumulator >= this.dt && n < this.maxSteps) {
      for (const fn of this.onStep) fn(this.dt);
      this.world.step(this.events);
      this.accumulator -= this.dt;
      this.steps++; n++;
    }
    if (n === this.maxSteps) this.accumulator = 0;   // 밀린 건 버린다
    return n;
  }

  /** 정해진 횟수만큼 즉시 돌린다 (테스트·settle 용). */
  stepTimes(n) {
    for (let i = 0; i < n; i++) {
      for (const fn of this.onStep) fn(this.dt);
      this.world.step(this.events);
      this.steps++;
    }
  }

  /** 두 collider 사이의 가장 깊은 침투 깊이(m). 관통 자동 검증용. */
  deepestPenetration(colliderA, colliderB) {
    let worst = 0;
    this.world.contactPair(colliderA, colliderB, (manifold) => {
      for (let i = 0; i < manifold.numContacts(); i++) {
        // Rapier 의 거리는 떨어져 있으면 +, 파고들면 -
        const d = manifold.contactDist(i);
        if (d < 0 && -d > worst) worst = -d;
      }
    });
    return worst;
  }

  free() {
    this.events.free();
    this.world.free();
  }
}
