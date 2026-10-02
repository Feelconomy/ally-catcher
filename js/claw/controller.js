/* Phase 8 — 집게 상태 기계.
   IDLE → DESCENDING → BOTTOM_REACHED → CLOSING → GRIP_SETTLE → LIFTING
        → TRANSPORT → RELEASE → RETURN → IDLE

   어느 단계에서도 인형을 집게에 붙이지 않는다. 인형은 끝까지 dynamic 이고,
   올라오는 이유는 접촉력과 마찰뿐이다. 성공 판정도 여기서 하지 않는다 —
   배출구 센서에 인형이 실제로 떨어졌을 때만 성공이다. */

export const STATE = {
  IDLE: 'IDLE', DESCENDING: 'DESCENDING', BOTTOM_REACHED: 'BOTTOM_REACHED',
  CLOSING: 'CLOSING', GRIP_SETTLE: 'GRIP_SETTLE', LIFTING: 'LIFTING',
  TRANSPORT: 'TRANSPORT', RELEASE: 'RELEASE', RETURN: 'RETURN',
};

export class ClawController {
  constructor(claw, analyzer, opts = {}) {
    this.claw = claw;
    this.analyzer = analyzer;
    this.state = STATE.IDLE;
    this.t = 0;
    this.restLength = opts.restLength ?? 0.10;    // 평소 줄 길이
    this.maxLength = opts.maxLength ?? 0.56;      // 윈치 최대 풀림 (하강 한계)
    this.chute = opts.chute ?? { x: -0.42, z: 0.30 };
    this.home = opts.home ?? { x: 0, z: 0 };
    this.settleTime = opts.settleTime ?? 0.25;    // 15번 요구: 0.15~0.35초
    /* 윈치는 '목표 길이로 순간 이동'이 아니라 줄을 일정 속도로 푼다/감는다.
       목표를 한 번에 바꾸면 모터 오차가 커져 집게를 내리꽂듯 밀어 넣고,
       그 힘이 접촉을 이겨 인형을 뚫는다(측정: 23mm). 속도로 내보내면
       모터 오차가 작게 유지돼 접촉이 이긴다. */
    this.transportTime = opts.transportTime ?? 3.2;   // 배출구까지 옮기는 시간(초)
    this.downSpeed = opts.downSpeed ?? 0.42;      // m/s
    this.upSpeed = opts.upSpeed ?? 0.34;
    this.winchCmd = claw.winchTarget;
    this.onState = opts.onState || (() => {});
    this.stuckFor = 0;
  }

  set(state) {
    this.state = state; this.t = 0; this.stuckFor = 0;
    if (state === STATE.IDLE) this.winchCmd = this.claw.winchTarget;
    if (state === STATE.TRANSPORT) this.rememberStart();
    this.onState(state);
  }

  drop() { if (this.state === STATE.IDLE) this.set(STATE.DESCENDING); }

  /** 줄을 목표 길이 쪽으로 dt 만큼만 풀거나 감는다. */
  _winchToward(target, speed, dt) {
    const d = target - this.winchCmd;
    const step = speed * dt;
    this.winchCmd += Math.abs(d) <= step ? d : Math.sign(d) * step;
    this.claw.setWinch(this.winchCmd);
    return Math.abs(target - this.winchCmd) < 1e-4;
  }

  /** 물리 스텝마다 호출 (고정 dt). */
  tick(dt) {
    const claw = this.claw;
    this.t += dt;
    const reached = Math.abs(claw.winchTarget - this.lengthNow()) < 0.012;

    switch (this.state) {
      case STATE.DESCENDING: {
        /* 윈치는 계속 '더 풀라'고 명령한다. 인형에 막히면 실제 길이가 따라오지
           못하고 멈추는데, 그건 물리가 막은 것이라 그대로 둔다. 명령 길이가
           최대에 닿고 더 내려가지 않으면 바닥으로 친다. */
        const done = this._winchToward(this.maxLength, this.downSpeed, dt);
        /* 줄은 계속 풀리는데 집게가 안 내려가면 = 인형/바닥에 막힌 것.
           그 상태로 더 밀지 않고 거기서 집는다. */
        const lag = this.winchCmd - this.lengthNow();
        const vy = Math.abs(claw.body.linvel().y);
        /* 막힌 판정은 '줄은 풀리는데 집게가 실제로 안 내려갈 때'만. 내려가기
           시작하는 0.25초 동안은 가속 때문에 자연히 뒤처지므로 세지 않는다. */
        if (this.t > 0.25 && lag > 0.02 && vy < 0.05) this.stuckFor += dt; else this.stuckFor = 0;
        if (done || this.stuckFor > 0.20 || this.t > 4.5) this.set(STATE.BOTTOM_REACHED);
        break;
      }
      case STATE.BOTTOM_REACHED:
        if (this.t > 0.12) this.set(STATE.CLOSING);
        break;

      case STATE.CLOSING: {
        claw.close();
        // 발이 더 못 닫히면(인형에 막혔거나 끝까지 닫혔으면) 다음 단계
        const moving = claw.fingers.some(f => Math.abs(f.body.angvel().z) > 0.25);
        if ((!moving && this.t > 0.22) || this.t > 1.1) this.set(STATE.GRIP_SETTLE);
        break;
      }
      case STATE.GRIP_SETTLE:
        // 압착된 채로 잠깐 둔다. 이 사이에 인형이 자리를 잡거나 빠진다.
        if (this.t > this.settleTime) this.set(STATE.LIFTING);
        break;

      case STATE.LIFTING: {
        const done = this._winchToward(this.restLength, this.upSpeed, dt);
        if ((done && reached) || this.t > 4.0) this.set(STATE.TRANSPORT);
        break;
      }

      case STATE.TRANSPORT: {
        // 배출구 위로 수평 이동. 관성 때문에 인형이 흔들리고, 약하면 떨어진다.
        const p = claw.origin;
        /* 천천히 옮긴다. 1.6초(최고 ~1.2m/s)에 옮겼더니 관성으로 인형이
           빠져나갔다. 들고 가는 동안 흔들리긴 해도 버틸 만큼 늦춘다. */
        const k = Math.min(1, this.t / this.transportTime);
        const ease = k * k * (3 - 2 * k);
        claw.moveCarriage(
          this.startX + (this.chute.x - this.startX) * ease,
          this.startZ + (this.chute.z - this.startZ) * ease, p.y);
        if (k >= 1 && this.t > this.transportTime + 0.5) this.set(STATE.RELEASE);
        break;
      }
      case STATE.RELEASE:
        /* 발을 벌리기만 한다. 인형을 떼어내거나 옮기지 않는다 —
           접촉이 사라지면 중력이 알아서 떨어뜨린다. */
        claw.open();
        if (this.t > 1.1) this.set(STATE.RETURN);
        break;

      case STATE.RETURN: {
        const k = Math.min(1, this.t / 1.2);
        const ease = k * k * (3 - 2 * k);
        claw.moveCarriage(
          this.chute.x + (this.home.x - this.chute.x) * ease,
          this.chute.z + (this.home.z - this.chute.z) * ease, claw.origin.y);
        if (k >= 1) this.set(STATE.IDLE);
        break;
      }
      default:
        break;
    }
  }

  /** 현재 실제로 풀린 줄 길이 */
  lengthNow() {
    return this.claw.origin.y - this.claw.body.translation().y;
  }

  /** TRANSPORT 시작점을 기억해 두기 위해 상태 진입 때 불린다. */
  rememberStart() {
    this.startX = this.claw.origin.x;
    this.startZ = this.claw.origin.z;
  }
}
