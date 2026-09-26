/* Screen 03 — the claw machine.

   Single axis, like the cabinet the design draws: the claw slides left and
   right along one rail and that is the only thing the player steers. The
   dolls are heaped in two overlapping rows, so lining up is purely horizontal
   and the claw takes whatever sits on top of the pile.

   One drop per credit. The timer is thinking time — pressing 집게 내리기
   commits the attempt and stops the clock.

   Aim is necessary but not sufficient. The claw can close on a doll and still
   lose it on the way up or on the way across, exactly like a weak grip on a
   real machine; the doll then falls back onto the bed where it was dropped. */

const GRAB_RADIUS = 0.07;    // how close in x the claw must be to close on a doll
const AIM_FALLOFF = 0.10;    // distance over which the displayed odds decay
const CLAW_W = 104;          // rendered claw width, px
const CLAW_H = Math.round(CLAW_W * 116 / 120);   // rendered claw height, px

/* 플레이 화면 스킨은 둘이다.

     classic — 원래의 어두운 캐비닛. 확률 패널이 유리 안을 차지해 인형통이 얕고
               인형이 9마리다. 가로 레버 + 전체폭 버튼.
     arcade  — 밝은 캐비닛. 확률 패널을 유리 밖으로 빼서 그 자리를 전부 통에
               내주고 큰 인형 16마리를 무더기로 쌓는다. 아케이드 스틱 + 별도 드롭 버튼.

   어느 쪽을 쓸지는 관리자 페이지에서 고르고, 값은 서버 카탈로그에 실린다.
   아래 수치는 첫 측정 전의 기본값 — Play.layout() 이 실제 높이를 재서
   이 안에서 다시 계산한다. */

/* 그린 모드 더미 — 정면에서 본 인형 무더기. 큰 인형이 네 줄로 쌓이고 앞줄이 뒷줄을
   가려서, 뒷줄은 앞 인형 머리 너머로 얼굴만 빼꼼 보인다. 위로 갈수록 좁아져 가운데가
   볼록하다.

   layer 가 클수록 앞(아래) 줄이다 — 기본 모드와 같은 규칙이라 z-index(2 + layer×2)
   그대로 앞줄이 위에 그려진다. 집게는 닿는 인형 중 머리가 가장 높은 것, 즉 더미
   꼭대기부터 문다 (SKINS.arcade.pickTop). */
const ARCADE_DOLL = 100;      // 몸통을 겹치되 얼굴은 드러내는 기준 크기
const arcadeRow = (layer, xs, base, bumps) =>
  xs.map((x, i) => ({ x, layer, size: ARCADE_DOLL, bottom: base + bumps[i] }));
const BED_ARCADE = [
  ...arcadeRow(0, [0.47, 0.63, 0.79],             128, [2, 6, 0]),        // 꼭대기 — 가운데만
  ...arcadeRow(1, [0.39, 0.55, 0.71, 0.87],        88, [0, 4, 2, 5]),     // 뒷줄
  ...arcadeRow(2, [0.33, 0.47, 0.63, 0.79, 0.90],  44, [3, 0, 5, 1, 4]),  // 가운뎃줄
  ...arcadeRow(3, [0.39, 0.55, 0.71, 0.87],         0, [3, 0, 4, 1]),     // 앞줄
];

const BED_CLASSIC = [
  // 뒷줄 — 작고 높이 올라앉아 앞줄에 반쯤 가린다
  { x: 0.345, layer: 0, size: 54, bottom: 32 },
  { x: 0.465, layer: 0, size: 56, bottom: 29 },
  { x: 0.585, layer: 0, size: 54, bottom: 33 },
  { x: 0.705, layer: 0, size: 57, bottom: 29 },
  { x: 0.825, layer: 0, size: 54, bottom: 32 },
  // 앞줄 — 크고 낮게, 뒷줄에 겹쳐 앉는다
  { x: 0.405, layer: 1, size: 63, bottom: 7 },
  { x: 0.525, layer: 1, size: 61, bottom: 10 },
  { x: 0.645, layer: 1, size: 64, bottom: 6 },
  { x: 0.765, layer: 1, size: 61, bottom: 9 },
];

const SKINS = {
  classic: {
    label: '기본', theme: 'dark', bed: BED_CLASSIC, bedMinX: 0.345,
    tilt: 26,
    cab: {
      railTop:  { min: 14, max: 46, share: 0.11 },
      bedH:     { min: 72, max: 118, share: 0.27 },
      footH:    { min: 84, max: 118, share: 0.31 },
      cordMax: 76, cordMin: 16, clearance: 12, clawMin: 30,
    },
  },
  arcade: {
    label: '그린', theme: 'arcade', bed: BED_ARCADE, bedMinX: 0.330,
    pickTop: true,       // 더미 꼭대기(머리가 가장 높은 인형)부터 문다
    tilt: 10,            // 인형을 ±5° 정도만 기울인다 — 반듯하게 앉은 무더기
    cab: {
      railTop:  { min: 10, max: 40, share: 0.10 },
      bedH:     { min: 78, max: 246, share: 0.46 },
      footH:    { min: 12, max: 26, share: 0.05 },
      // 통이 커지면 집게가 그만큼 낮게 매달려 빈 공간이 줄어든다
      cordMax: 150, cordMin: 16, clearance: 22, clawMin: 30,
    },
  },
};

const DEFAULT_SKIN = 'arcade';

/* 고른 스킨의 값으로 start() 에서 갈아끼운다. PILE_H 는 더미가 자연 크기로
   차지하는 높이 — 통이 이보다 낮으면 그 비율로 인형을 줄인다. */
let CAB, BED, BED_MIN_X, PILE_H;

function useSkin(id) {
  const skin = SKINS[id] || SKINS[DEFAULT_SKIN];
  CAB = skin.cab;
  BED = skin.bed;
  BED_MIN_X = skin.bedMinX;
  PILE_H = Math.max(...BED.map(s => s.bottom + s.size));
  return skin;
}
useSkin(DEFAULT_SKIN);

const CHUTE_X = 0.155;       // claw position over the chute mouth
const START_X = 0.60;        // claw starts over the middle of the pile
const STICK_TILT = 24;       // 레버가 끝까지 기울었을 때의 각도(도)

const Play = {
  machine: null,
  dolls: [],          // { dollId, x, layer, size, bottom, rot, taken }
  x: START_X,         // claw across the cabinet, 0..1 — the only axis
  busy: false,
  over: false,
  dropped: false,     // the one attempt has been spent
  left: PLAY_SECONDS,
  timer: null,
  keys: null,
  coaching: false,     // 튜토리얼(코치마크) 표시 중엔 타이머를 멈춘다
  stickActive: false,
  restCord: CAB.cordMax,
  refilled: false,
  session: 0,          // bumped per play; a drop from an older session must not write

  clawScale: 1,
  dollScale: 1,
  onResize: null,

  /** Lays out a fresh cabinet for `machine` and renders the screen. */
  start(machine) {
    this.stop();
    // Any drop still animating from a previous play belongs to an older
    // session and must stop touching the screen once this one begins.
    this.session += 1;
    // 스킨마다 통 크기와 자리 수가 달라, 인형을 놓기 전에 먼저 정한다.
    // 플레이어가 기계 화면에서 고른 모드가 먼저, 없으면 관리자가 정한 기본값.
    const want = Store.state.settings.skin || Store.state.admin.skin;
    this.skinId = SKINS[want] ? want : DEFAULT_SKIN;
    this.skin = useSkin(this.skinId);
    this.machine = machine;
    this.x = START_X;
    this.busy = false; this.over = false; this.dropped = false;
    this.left = PLAY_SECONDS;
    this.coaching = false;
    this.stickActive = false;
    this.targetI = -2;          // -1(없음)과도 달라야 첫 그리기가 돈다

    /* Keep each remaining doll in its saved slot until the machine is empty. */
    const { dolls: stock, refilled } = Store.machineStock(machine, BED.length);
    this.refilled = refilled;

    const slots = shuffle(BED.map((_, i) => i))
      .slice(0, Math.min(stock.length, BED.length))
      .sort((a, b) => a - b);
    const order = shuffle(stock.slice());

    this.dolls = Store.machineLayout(machine, this.skinId, stock, () => slots.map((slotIdx, k) => {
      const slot = BED[slotIdx];
      return {
        dollId: order[k],
        // 자리마다 좌우로 조금씩 흔들어 격자가 아니라 더미로 보이게
        x: Math.max(BED_MIN_X, slot.x + (Math.random() - 0.5) * 0.03),
        layer: slot.layer,
        size: slot.size,
        bottom: slot.bottom,
        rot: Math.round((Math.random() - 0.5) * this.skin.tilt),
        taken: false,
      };
    }));
    this.render();
  },

  stop() {
    this.session += 1;
    this.releaseControls?.();
    cancelAnimationFrame(this.motionFrame);
    this.motionFrame = null;
    if (this.keyUp) window.removeEventListener('keyup', this.keyUp);
    if (this.releaseControls) window.removeEventListener('blur', this.releaseControls);
    if (this.onVisibility) document.removeEventListener('visibilitychange', this.onVisibility);
    clearInterval(this.timer); this.timer = null;
    clearTimeout(this.flickTimer);
    if (this.keys) { window.removeEventListener('keydown', this.keys); this.keys = null; }
    if (this.onResize) {
      window.removeEventListener('resize', this.onResize);
      window.removeEventListener('orientationchange', this.onResize);
      this.onResize = null;
    }
  },

  render() {
    setTheme(this.skin.theme);
    const m = this.machine;
    const arcade = this.skinId === 'arcade';

    // 유리 안(레일·집게·통·조준빔·인형)은 두 스킨이 똑같고, 바깥 껍데기만 다르다.
    const inner = `
        <div class="state"><i></i><span id="stateTxt">READY</span></div>
        ${arcade ? '<div class="glass"></div>' : '<div class="backwall"></div>'}
        <div class="rail"><i class="rail-mount" id="railMount"></i></div>
        <div class="claw-rig" id="rig">
          <div class="cord" id="cord"></div>
          <div class="claw" id="claw">
            <div class="held" id="held"></div>
            ${clawSvg()}
          </div>
        </div>
        <div class="bed">
          <div class="hole" id="hole">
            <span class="lip"></span>
            <span class="arrow">${icon('caretDown', 16)}</span>
          </div>
        </div>
        <div class="aim" id="aim"></div>
        <div class="pit" id="pit"></div>`;

    screenEl().innerHTML = `<div class="screen ${arcade ? 'arcade' : 'classic'}">
      ${statusbar()}
      ${arcade ? this.headArcade() : this.headClassic(m)}
      <div class="cabinet" id="cabinet">
        ${inner}
        ${arcade ? `<div class="chute" id="chute">
          <div class="glow"></div>
          <div class="sign">여기로<br>쏙!</div>
        </div>` : `<div class="play-foot">
          <div class="chute" id="chute">
            <div class="glow"></div>
            <div class="sign">PRIZE OUT</div>
            <div class="slot"></div>
          </div>
          <div class="odds">
            <div class="l">이번 판 확률</div>
            <div class="v"><b id="oddsNum">0%</b><span>집게 힘 ${esc(m.grip)}</span></div>
            <div class="meter onDark"><i id="oddsBar" style="width:0"></i></div>
          </div>
        </div>`}
      </div>
      ${arcade ? this.controlsArcade() : this.controlsClassic()}
    </div>`;

    this.layout();
    this.warm();
    this.paintPit();
    this.paintClaw();
    this.paintOdds();
    this.wire();
    this.tick();

    if (!Store.state.coachDone) this.coach();
    else if (this.refilled) toast('인형을 새로 채운 기계예요', { tone: 'ok', duration: 2200 });
  },

  headClassic(m) {
    return `<div class="play-head">
      <button class="iconbtn ghost" data-act="exit" aria-label="나가기">${icon('chevronLeft3', 20)}</button>
      <div>
        <div class="nm">${esc(m.name)}</div>
        <div class="mt">난이도 ${esc(m.difficulty)} · 집게 힘 ${esc(m.grip)}</div>
      </div>
      ${walletChip(true)}
    </div>`;
  },

  headArcade() {
    // 보유 티켓을 여기서도 보여 준다 — 한 판에 티켓이 빠져나가는데 화면에
    // 잔액이 없으면 몇 장 남았는지 모르고 계속 누르게 된다.
    return `<div class="play-head">
      <button class="iconbtn arc-btn" data-act="exit" aria-label="나가기">${icon('chevronLeft3', 20)}</button>
      <div class="arc-wallet" role="status" aria-label="보유 티켓 ${Store.state.tickets}장">
        <span class="tk">${icon('ticketFill', 16)}</span><span class="n">${Store.state.tickets}</span>
      </div>
    </div>`;
  },

  controlsClassic() {
    return `<div class="controls">
      <div class="timerrow">
        <span class="l">남은 시간</span>
        <span class="t" id="clock">${mmss(this.left)}</span>
      </div>
      <div class="meter onDark"><i id="timeBar" style="width:100%"></i></div>
      <div class="stick" id="stick">
        <button class="dpad left"  data-dir="left"  aria-label="왼쪽">${icon('chevronLeft3', 20)}</button>
        <div class="track"></div>
        <div class="knob" id="knob"></div>
        <button class="dpad right" data-dir="right" aria-label="오른쪽">${icon('chevronRight3', 20)}</button>
      </div>
      <button class="btn lg btn--accent drop-btn" id="dropBtn" data-act="drop">집게 내리기</button>
    </div>`;
  },

  /* 조작대: 왼쪽 스틱 · 가운데 계기판 · 오른쪽 드롭 버튼.
     레버와 드롭을 갈라 놓아 실제 기계처럼 두 손으로 쓰게 한다. */
  controlsArcade() {
    return `<div class="controls">
      <div class="console">
        <div class="lever">
          <div class="stick" id="stick">
            <span class="base"></span>
            <span class="shaft" id="knob"><span class="ball"></span></span>
          </div>
          <div class="padrow">
            <button class="dpad left" data-dir="left" aria-label="왼쪽">${icon('chevronLeft3', 14)}</button>
            <span>이동하기</span>
            <button class="dpad right" data-dir="right" aria-label="오른쪽">${icon('chevronRight3', 14)}</button>
          </div>
        </div>

        <div class="gauge">
          <div class="timerrow">
            <span class="l">남은 시간</span>
            <span class="t" id="clock">${mmss(this.left)}</span>
          </div>
          <div class="bar"><i id="timeBar" style="width:100%"></i></div>
        </div>

        <div class="dropwrap">
          <button class="drop-btn" id="dropBtn" data-act="drop" aria-label="집게 내리기">
            <span class="ic">${icon('caretDown', 24)}</span>
            <span class="tx">드롭</span>
          </button>
          <span class="cap">뽑기 시작!</span>
        </div>
      </div>
      <!-- 조준한 인형과 이번 판 확률. 아무것도 안 겹쳤을 땐 조작 안내가 뜬다. -->
      <div class="tipbar odds" id="target">
        <span class="th"></span>
        <b class="tip">TIP</b>
        <span class="n" id="targetName">레버로 위치를 맞추고 드롭 버튼을 눌러보세요!</span>
        <b class="pc" id="oddsNum">0%</b>
      </div>
    </div>`;
  },

  /** Fits the cabinet's vertical parts to the height actually available.

      The claw hangs from the rail and must finish clear of the bed, but a
      phone browser with visible toolbars can leave the cabinet barely 260px
      tall — with fixed pixels the claw ends up sitting inside the pile, which
      makes it impossible to tell what you are aiming at. Everything below is
      derived from the measured height and re-derived whenever it changes. */
  layout() {
    const cab = document.getElementById('cabinet');
    if (!cab) return;
    const H = cab.getBoundingClientRect().height;
    if (!H) return;

    const fit = spec =>
      Math.round(Math.max(spec.min, Math.min(spec.max, H * spec.share)));

    const railTop = fit(CAB.railTop);
    const bedH    = fit(CAB.bedH);
    const footH   = fit(CAB.footH);

    /* Everything between the rail and the bed has to hold the cord plus the
       claw plus a little clearance. Rather than hope a fixed-size claw fits,
       size the claw from the space that is actually there — so the tips are
       always above the pile, on any device. */
    const bedTop = H - footH - bedH;
    const available = bedTop - (railTop + 10) - CAB.clearance;
    const clawH = Math.min(CLAW_H, Math.max(CAB.clawMin, Math.round(available * 0.72)));
    this.clawScale = clawH / CLAW_H;
    this.restCord = Math.max(CAB.cordMin, Math.min(CAB.cordMax, available - clawH));
    /* 인형은 통 높이에 맞춰 줄인다. 기준은 통의 최대치가 아니라 더미가 실제로
       쓰는 높이(PILE_H) — 그래야 어느 기기에서도 뒷줄이 통 밖으로 안 나간다.
       집게보다 지나치게 크면 잡힌 모양이 어색해지므로 그것도 상한으로 둔다. */
    this.dollScale = Math.max(0.42, Math.min(
      1, (bedH - 6) / PILE_H, this.clawScale * 1.15));
    if (this.skinId === 'arcade') {
      this.dollScale = Math.min(cab.clientWidth * .24 / ARCADE_DOLL, (bedH - 6) / PILE_H);
    }

    cab.style.setProperty('--rail-top', railTop + 'px');
    cab.style.setProperty('--bed-h', bedH + 'px');
    cab.style.setProperty('--foot-h', footH + 'px');
    cab.style.setProperty('--claw-scale', this.clawScale.toFixed(3));

    const cord = document.getElementById('cord');
    // Never fight an in-flight drop animation.
    if (cord && !this.busy) cord.style.height = this.restCord + 'px';

    if (!this.onResize) {
      this.onResize = () => {
        if (App.route !== 'play') return;
        this.layout();
        // 인형 크기는 통 높이에서 나오므로 통이 바뀌면 더미도 다시 그린다.
        // 집게가 내려가는 중엔 건드리지 않는다 — 애니메이션이 끊긴다.
        if (!this.busy) this.paintPit();
        this.paintClaw();
      };
      window.addEventListener('resize', this.onResize);
      window.addEventListener('orientationchange', this.onResize);
    }
  },

  wire() {
    const root = screenEl();
    bind(root, { exit: () => this.confirmExit(), drop: () => this.drop(), wallet: () => go('mission') });
    const pressed = new Set();
    let pointer = null;
    this.input = 0;
    this.velocity = 0;
    const steer = value => {
      this.input = this.canMove() ? value : 0;
      this.stickActive = !!this.input;
      this.tilt(this.input);
    };
    this.releaseControls = () => {
      pointer = null;
      pressed.clear();
      steer(0);
      $$('.dpad', root).forEach(btn => delete btn.dataset.active);
    };
    $$('.dpad', root).forEach(btn => {
      btn.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        if (!this.canMove() || pointer !== null) return;
        pointer = ev.pointerId;
        btn.setPointerCapture(pointer);
        btn.dataset.active = '1';
        steer(btn.dataset.dir === 'left' ? -1 : 1);
        haptic(8);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type =>
        btn.addEventListener(type, ev => { if (ev.pointerId === pointer) this.releaseControls(); }));
    });
    const stick = $('#stick', root);
    const track = ev => {
      if (ev.pointerId !== pointer) return;
      const r = stick.getBoundingClientRect();
      const value = Math.max(-1, Math.min(1, (ev.clientX - r.left - r.width / 2) / (r.width / 2 - 10)));
      steer(Math.abs(value) < 0.12 ? 0 : value);
    };
    stick.addEventListener('pointerdown', ev => {
      if (ev.target.closest('.dpad') || !this.canMove() || pointer !== null) return;
      ev.preventDefault();
      pointer = ev.pointerId;
      stick.setPointerCapture(pointer);
      track(ev);
      haptic(8);
    });
    stick.addEventListener('pointermove', track);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type =>
      stick.addEventListener(type, ev => { if (ev.pointerId === pointer) this.releaseControls(); }));
    this.keys = ev => {
      if (!this.canMove() || ev.target.closest('button, input, textarea, select')) return;
      if (['ArrowLeft', 'ArrowRight'].includes(ev.key)) {
        ev.preventDefault();
        pressed.add(ev.key);
        steer(Number(pressed.has('ArrowRight')) - Number(pressed.has('ArrowLeft')));
      } else if ((ev.key === ' ' || ev.key === 'Enter') && !ev.repeat) {
        ev.preventDefault();
        this.drop();
      }
    };
    this.keyUp = ev => {
      if (!pressed.has(ev.key)) return;
      pressed.delete(ev.key);
      steer(Number(pressed.has('ArrowRight')) - Number(pressed.has('ArrowLeft')));
    };
    this.onVisibility = () => { if (document.hidden) this.releaseControls(); };
    window.addEventListener('keydown', this.keys);
    window.addEventListener('keyup', this.keyUp);
    window.addEventListener('blur', this.releaseControls);
    document.addEventListener('visibilitychange', this.onVisibility);
    let previous = performance.now();
    const frame = now => {
      const dt = Math.min(0.04, (now - previous) / 1000);
      previous = now;
      const target = this.canMove() ? this.input * 0.42 : 0;
      this.velocity += (target - this.velocity) * (1 - Math.exp(-dt * 14));
      if (Math.abs(this.velocity) > 0.0005) this.move(this.velocity * dt);
      const claw = $('#claw', root);
      if (claw && !this.busy) claw.style.setProperty('--sway', (-this.velocity * 13).toFixed(2) + 'deg');
      this.motionFrame = requestAnimationFrame(frame);
    };
    this.motionFrame = requestAnimationFrame(frame);
  },

  canMove() { return !this.busy && !this.over && !this.dropped && !this.coaching && this.left > 0; },

  nudge(dir) { this.move(dir === 'left' ? -0.038 : 0.038); },

  move(delta) {
    if (!this.canMove()) return;
    const next = Math.max(0.08, Math.min(0.92, this.x + delta));
    if (next === this.x) return;
    this.x = next;
    this.paintClaw();
    this.paintOdds();
  },

  /* ------------------------------------------------------------- painting */

  paintClaw() {
    const rig = document.getElementById('rig');
    const mount = document.getElementById('railMount');
    if (!rig) return;
    rig.style.left = (this.x * 100) + '%';
    if (mount) mount.style.left = `calc(${this.x * 100}% + ${(this.x - 0.5) * (this.skinId === 'arcade' ? 48 : 32)}px)`;
    this.paintAim();
    this.paintKnob();
  },

  /** Beam down the claw's column, and a spotlight under the doll it would
      close on — so the alignment reads the same on any screen height. */
  paintAim() {
    const aim = document.getElementById('aim');
    if (aim) {
      aim.style.left = (this.x * 100) + '%';
      if (this.busy || this.over || this.dropped) aim.dataset.off = '1';
      else delete aim.dataset.off;
    }
    const near = this.nearest();
    const hit = near && near.dist < GRAB_RADIUS ? near.i : -1;
    $$('.pit .doll', screenEl()).forEach(el => {
      el.classList.toggle('targeted', Number(el.dataset.i) === hit && !this.busy && !this.dropped);
    });
    if (hit !== this.targetI) { this.targetI = hit; this.paintTarget(hit); }
  },

  /** 계기판의 '조준한 인형' 칸. 바뀔 때만 다시 그린다 — 레버를 밀고 있는
      동안 paintAim 이 초당 수십 번 불리기 때문이다. */
  paintTarget(i) {
    const box = document.getElementById('target');
    if (!box) return;
    const d = i >= 0 && this.dolls[i] ? DOLLS[this.dolls[i].dollId] : null;
    box.classList.toggle('on', !!d);
    $('.th', box).innerHTML = d ? dollImg(d.id, 30) : '';
    $('#targetName', box).textContent = d ? d.name : '조준 대기';
  },

  /** 레버를 -1..1 만큼 민 모습으로 그린다.
      arcade 는 밑동을 축으로 기울고, classic 은 손잡이가 가로로 미끄러진다. */
  tilt(v) {
    const knob = document.getElementById('knob');
    if (!knob) return;
    if (this.skinId === 'arcade') {
      knob.style.transform = `rotate(${(v * STICK_TILT).toFixed(1)}deg)`;
      return;
    }
    const stick = document.getElementById('stick');
    const max = stick ? stick.getBoundingClientRect().width / 2 - 26 : 0;
    knob.style.transform = `translateX(${(v * max).toFixed(1)}px)`;
  },

  /** 손을 뗐을 때의 모습. arcade 스틱은 실제 기계처럼 중립으로 돌아오고,
      classic 손잡이는 집게가 선 자리를 그대로 가리킨다. */
  paintKnob() {
    if (this.stickActive) return;   // 미는 중엔 손가락이 각도를 쥐고 있다
    this.tilt(this.skinId === 'arcade' ? 0 : (this.x - 0.5) * 2);
  },

  /** 화살표 버튼·키보드로 움직일 때도 그쪽으로 잠깐 기울여 준다. */
  flick(dir) {
    clearTimeout(this.flickTimer);
    this.tilt(dir === 'left' ? -1 : 1);
    this.flickTimer = setTimeout(() => { if (!this.stickActive) this.tilt(0); }, 150);
  },

  /* 잡힌·떨어진·뽑힌 포즈는 그 순간에 처음 요청되는데, 폰에서는 내려받고
     디코딩하는 사이 이미지가 한 프레임 비어 보인다. 판이 시작될 때 이 기계에
     들어 있는 인형의 네 포즈를 미리 받아 디코딩해두고, 참조를 들고 있어
     디코딩 결과가 버려지지 않게 한다. */
  warm() {
    this.warmed = [];
    for (const id of new Set(this.dolls.map(d => d.dollId))) {
      for (const state of DOLL_STATES) {
        const im = new Image();
        im.src = dollArt(id, state);
        if (im.decode) im.decode().catch(() => {});
        this.warmed.push(im);
      }
    }
  },

  paintPit() {
    const pit = document.getElementById('pit');
    if (!pit) return;
    // Rotation lives on the image so the wrapper's transform stays free for
    // the drop-back animation.
    const k = this.dollScale || 1;
    pit.innerHTML = this.dolls.map((d, i) => {
      const size = Math.round(d.size * k);
      return `
      <div class="doll ${d.taken ? 'taken' : ''}" data-i="${i}"
        style="left:calc(${d.x * 100}% - ${size / 2}px);bottom:${Math.round(d.bottom * k)}px;z-index:${2 + d.layer * 2}">
        ${dollImg(d.dollId, size, `transform:rotate(${d.rot}deg)`)}
      </div>`;
    }).join('');
    this.paintAim();
  },

  /** Live odds = machine odds scaled by how well the claw is lined up. */
  liveOdds() {
    const base = Store.odds(this.machine);
    const near = this.nearest();
    if (!near || near.dist > AIM_FALLOFF) return 0;
    const aim = Math.max(0, 1 - near.dist / AIM_FALLOFF);
    return Math.round(base * (0.25 + 0.75 * aim));
  },

  /** What the claw would close on: in a heap it takes whatever is on top,
      so a front-row doll wins over a back-row one when both are in reach. */
  nearest() {
    let best = null;
    this.dolls.forEach((d, i) => {
      if (d.taken) return;
      const dist = Math.abs(d.x - this.x);
      if (!best) { best = { i, d, dist }; return; }

      const reachable = dist < GRAB_RADIUS;
      const bestReachable = best.dist < GRAB_RADIUS;
      if (reachable && bestReachable) {
        // 둘 다 닿으면 — 그린 모드는 머리가 더 높은 인형(더미 꼭대기), 기본 모드는
        // 앞줄(높은 layer)을 먼저 문다. 같으면 더 가까운 쪽.
        const rank = x => this.skin.pickTop ? x.bottom + x.size : x.layer;
        const r = rank(d), rb = rank(best.d);
        if (r > rb || (r === rb && dist < best.dist)) best = { i, d, dist };
      } else if (reachable && !bestReachable) {
        best = { i, d, dist };
      } else if (!bestReachable && dist < best.dist) {
        best = { i, d, dist };
      }
    });
    return best;
  },

  paintOdds() {
    const n = this.liveOdds();
    const num = document.getElementById('oddsNum');
    if (num) num.textContent = n + '%';
  },

  setState(text) {
    const el = document.getElementById('stateTxt');
    if (el) el.textContent = text;
  },

  tick() {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.over || this.dropped || this.coaching) return; // 튜토리얼 중엔 시간 정지
      this.left -= 0.1;
      const clock = document.getElementById('clock');
      if (clock) {
        clock.textContent = mmss(this.left);
        clock.classList.toggle('warn', this.left <= 5);
      }
      const bar = document.getElementById('timeBar');
      if (bar) bar.style.width = (this.left / PLAY_SECONDS * 100) + '%';
      if (this.left <= 0) {
        clearInterval(this.timer);
        this.setState('TIME UP');
        toast('시간이 다 됐어요', { tone: 'error', duration: 1400 });
        App.lastAttempt = { dollId: null, accuracy: 0, kind: 'timeout' };
        const session = this.session;
        setTimeout(() => { if (this.session === session) this.finish(false, null); }, 700);
      }
    }, 100);
  },

  /* ---------------------------------------------------------------- drop */

  async drop() {
    if (!this.canMove()) return;
    this.releaseControls?.();
    this.velocity = 0;

    const session = this.session;
    const alive = () => this.session === session;
    const near = this.nearest();
    this.dropped = true;
    this.busy = true;
    clearInterval(this.timer);

    const rig = document.getElementById('rig');
    const cord = document.getElementById('cord');
    const btn = document.getElementById('dropBtn');
    btn.disabled = true;
    btn.classList.add('btn--disabled');
    rig.dataset.busy = '1';
    this.setState('DROPPING');
    haptic(20);

    const chance = this.liveOdds();
    const inRange = !!near && near.dist < GRAB_RADIUS;
    const won = inRange && Math.random() * 100 < chance;

    // How well the claw was lined up, for the fail screen's feedback.
    App.lastAttempt = {
      dollId: near ? near.d.dollId : null,
      accuracy: near ? Math.max(0, Math.round((1 - near.dist / GRAB_RADIUS) * 100)) : 0,
      kind: 'miss',
    };

    // A miss is not always a clean miss — a real claw often closes on the doll
    // and then loses it on the way up or on the way across.
    let failMode = 'miss';
    if (!won && inRange) {
      const r = Math.random();
      failMode = r < 0.34 ? 'miss' : r < 0.72 ? 'slipLift' : 'slipCarry';
    }
    const grips = won || failMode !== 'miss';

    // Lower until the talon tips reach the doll (or the bed on a clean miss).
    const reach = this.reachFor(near, inRange);
    cord.style.transition = 'height .8s cubic-bezier(.4,0,.6,1)';
    cord.style.height = reach + 'px';
    await wait(850);
    if (!alive()) return;

    rig.dataset.grip = '1';
    haptic(14);
    await wait(300);
    if (!alive()) return;

    let carried = null;
    if (grips) {
      this.dolls[near.i].taken = true;
      this.paintPit();
      carried = near.d;
      document.getElementById('held').innerHTML =
        dollImg(carried.dollId, Math.round(carried.size * (this.dollScale || 1)), '', 'grabbed');
    }

    // Lift.
    this.setState(grips ? 'LIFTING' : 'MISSED');
    if (failMode === 'slipLift' && grips) {
      cord.style.transition = 'height .3s ease-out';
      cord.style.height = (reach * 0.55) + 'px';
      await wait(340);
      if (!alive()) return;
      await this.releaseInto(carried, this.x, 'slip');
      if (!alive()) return;
      cord.style.transition = 'height .45s ease-out';
      cord.style.height = this.restCord + 'px';
      await wait(500);
      if (!alive()) return;
      App.lastAttempt.kind = 'slip';
      this.finish(false, carried.dollId);
      return;
    }

    cord.style.transition = 'height .55s ease-out';
    cord.style.height = this.restCord + 'px';
    await wait(600);
    if (!alive()) return;

    if (!grips) { this.finish(false, near ? near.d.dollId : null); return; }

    // Carry to the chute.
    this.setState('CARRYING');
    const overChute = (CHUTE_X * 100) + '%';
    rig.style.transition = 'left .75s ease-in-out';
    rig.style.left = overChute;
    const mount = document.getElementById('railMount');
    if (mount) { mount.style.transition = 'left .75s ease-in-out'; mount.style.left = `calc(${CHUTE_X * 100}% + ${(CHUTE_X - 0.5) * (this.skinId === 'arcade' ? 48 : 32)}px)`; }

    if (failMode === 'slipCarry') {
      await wait(430);                       // let go partway across
      if (!alive()) return;
      // Never land a slipped doll on the chute mouth — it would look like a win.
      const dropX = Math.max(BED_MIN_X, CHUTE_X + (this.x - CHUTE_X) * 0.5);
      await this.releaseInto(carried, dropX, 'slip');
      if (!alive()) return;
      await wait(360);
      if (!alive()) return;
      App.lastAttempt.kind = 'slip';
      this.finish(false, carried.dollId);
      return;
    }

    await wait(800);
    if (!alive()) return;
    delete rig.dataset.grip;
    const heldImage = document.querySelector('#held img');
    const heldSize = heldImage.offsetWidth;
    const heldRect = heldImage.getBoundingClientRect();
    document.getElementById('held').innerHTML = '';
    const chute = document.getElementById('chute');
    chute.insertAdjacentHTML('beforeend', dollImg(carried.dollId, heldSize,
      `max-width:none;left:50%;margin-left:${-heldSize / 2}px`, 'drop'));
    const prize = chute.lastElementChild;
    const landing = prize.getBoundingClientRect();
    prize.animate([
      { transform: `translate(${heldRect.left - landing.left}px, ${heldRect.top - landing.top}px) rotate(-8deg)` },
      { transform: 'translate(0, 0) rotate(6deg)' }
    ], { duration: 780, easing: 'cubic-bezier(.42,0,1,1)' });
    this.setState('GOT IT');
    haptic(40);
    await wait(920);
    if (!alive()) return;
    this.finish(true, carried.dollId);
  },

  /** How far the cord must extend for the talon tips to meet the target. */
  reachFor(near, inRange) {
    const cabinet = document.getElementById('cabinet');
    const claw = document.getElementById('claw');
    const cord = document.getElementById('cord');
    if (!cabinet || !claw) return 170;

    const cabRect = cabinet.getBoundingClientRect();
    // Measure the talon itself — the SVG box extends past the tips.
    const talon = $('.claw-svg .t-right', claw);
    const tipsNow = (talon || claw).getBoundingClientRect().bottom;

    // 인형통 바닥을 기준으로 잡는다 — 통 높이가 기기마다 달라서 캐비닛
    // 아래에서 몇 px 같은 고정값을 쓰면 헛집게가 허공에서 멈춘다.
    const bedRect = $('.bed', cabinet).getBoundingClientRect();
    let targetY;
    if (inRange && near) {
      const el = $(`.doll[data-i="${near.i}"]`, cabinet);
      /* 정수리에서 16px 고정이라 인형이 클수록 머리를 스치기만 했다. 높이 비율로
         잡아 어느 크기에서도 같은 깊이로 문다. 0.26 은 아직 머리만 스쳐 보여서,
         집게 팁이 몸통 한가운데까지 내려가도록 0.46 으로 둔다. */
      const r = el && el.getBoundingClientRect();
      targetY = r ? r.top + r.height * 0.46 : bedRect.bottom - 56;
    } else {
      targetY = bedRect.bottom - 26;           // clean miss: reach the bed floor
    }

    const current = parseFloat(cord.style.height) || this.restCord;
    const reach = current + (targetY - tipsNow);
    return Math.max(this.restCord + 16, Math.min(reach, cabRect.height - 60));
  },

  /** Opens the claw and drops `doll` back onto the bed at `x`. */
  async releaseInto(doll, x, reason) {
    const session = this.session;
    const heldRect = document.getElementById('held').getBoundingClientRect();
    const rig = document.getElementById('rig');
    delete rig.dataset.grip;
    document.getElementById('held').innerHTML = '';

    const idx = this.dolls.findIndex(d => d === doll);
    if (idx >= 0) {
      this.dolls[idx].taken = false;
      // Clamp back onto the bed, clear of the chute mouth.
      this.dolls[idx].x = Math.max(BED_MIN_X, Math.min(0.9, x));
      this.dolls[idx].rot = Math.round((Math.random() - 0.5) * 26);
      Store.saveLayout(this.machine, this.skinId, this.dolls.map(d => ({...d, taken:false})));
      this.paintPit();
      const el = $(`.doll[data-i="${idx}"]`, screenEl());
      if (el) {
        const landing = el.getBoundingClientRect();
        el.animate([
          { transform: `translate(${heldRect.left - landing.left}px, ${heldRect.top - landing.top}px) rotate(-12deg)` },
          { transform: 'translate(0, 0) rotate(0deg)' }
        ], { duration: 420, easing: 'cubic-bezier(.42,0,1,1)' });
        // Show the tumbling pose while it falls, then let it settle back.
        const img = $('img', el);
        const d = this.dolls[idx];
        if (img) {
          img.src = dollArt(d.dollId, 'drop');
          setTimeout(() => {
            if (this.session !== session) return;
            const still = $(`.doll[data-i="${idx}"] img`, screenEl());
            if (still) still.src = dollArt(d.dollId, 'idle');
          }, 420);
        }
      }
    }
    if (reason === 'slip') {
      this.setState('DROPPED');
      haptic(30);
      toast('집게에서 미끄러졌어요', { mini: true, duration: 1300 });
    }
    await wait(260);
  },

  finish(won, dollId) {
    if (this.over) return;
    this.over = true;
    Store.saveLayout(this.machine, this.skinId, this.dolls.filter(d => !won || !d.taken).map(d => ({...d, taken:false})));
    this.stop();
    // `dollId` on a loss is the doll that slipped, so the fail screen can show it.
    App.levelUpTo = Store.recordPlay(this.machine, won, won ? dollId : null);
    go(won ? 'win' : 'lose', dollId || '');
  },

  confirmExit() {
    this.releaseControls?.();
    if (this.over) { go('home'); return; }
    const spent = this.dropped ? '이번 판은 이미 집게를 내렸어요.' :
      `사용한 티켓 ${this.machine.cost}장은 돌려받을 수 없어요.<br>남은 시간 ${Math.ceil(this.left)}초 안에 도전해 보세요.`;
    dialog(`
      <h3 style="margin-top:0">지금 나가면 티켓이 사라져요</h3>
      <p>${spent}</p>
      <div class="actions">
        <button class="btn md btn--primary" data-close>계속 플레이</button>
        <button class="btn sm btn--danger-text" data-act="leave">그래도 나가기</button>
      </div>`,
      (node, close) => bind(node, { leave: () => { close(); this.over = true; this.stop(); go('home'); } }),
      { scrim: 'black' });
  },

  /** First-run coach mark over the lever (screen 25). */
  coach() {
    const steps = [
      { t: '레버로 집게를 움직여요', d: '왼쪽 레버를 좌우로 밀거나 화살표를 눌러 집게를 인형 위에 맞추세요.' },
      { t: '확률을 보고 타이밍을 잡아요', d: '집게가 인형에 정확히 겹칠수록 이번 판 확률이 올라가요.' },
      { t: '집게는 한 번만 내려가요', d: `${PLAY_SECONDS}초 안에 위치를 잡고 오른쪽 드롭 버튼을 누르세요. 잡아도 올리다가 놓칠 수 있어요.` },
    ];
    let i = 0;
    this.coaching = true;   // 튜토리얼이 뜬 동안 타이머 정지
    const { node, close } = Overlay.open(`<div class="coach">
      <div class="hole coach-lever"></div>
      <div class="bubble" style="left:24px;bottom:calc(180px + var(--safe-b))">
        <div class="step"></div><div class="t"></div><div class="d"></div>
        <div class="ft">
          <div class="dots"></div>
          <button class="skip" data-act="skip">건너뛰기</button>
          <button class="next" data-act="next">다음</button>
        </div>
      </div>
    </div>`, null, { persistent: true });

    $('.scrim', node).style.background = 'transparent';

    // 강조할 자리는 조작대의 실제 위치에서 잰다 — CSS 상수로 박아 두면
    // 조작대 높이가 바뀔 때마다 구멍이 어긋난다.
    const box = $('.controls', screenEl());
    if (box) {
      const r = box.getBoundingClientRect();
      const shell = shellEl().getBoundingClientRect();
      Object.assign($('.coach-lever', node).style, {
        left: (r.left - shell.left - 4) + 'px',
        top: (r.top - shell.top - 4) + 'px',
        width: (r.width + 8) + 'px',
        height: (r.height + 8) + 'px',
        bottom: 'auto', right: 'auto',
      });
    }

    const paint = () => {
      $('.step', node).textContent = `STEP ${i + 1} / ${steps.length}`;
      $('.t', node).textContent = steps[i].t;
      $('.d', node).textContent = steps[i].d;
      $('.dots', node).innerHTML = steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
      $('.next', node).textContent = i === steps.length - 1 ? '시작' : '다음';
    };
    const done = () => { this.coaching = false; Store.state.coachDone = true; Store.save(); close(); };

    bind(node, {
      skip: done,
      next: () => { if (i === steps.length - 1) done(); else { i++; paint(); } },
    });
    paint();
  },
};

/** A three-talon crane claw: spindle, housing, and hooked arms.
    Talons pivot at the housing rim (x 40 / 60 / 80, y 38) so that open they
    clear a doll and closed they bite into its shoulders. */
function clawSvg() {
  const arm = 'M0 0 C 4 15, 6 31, 1 44';
  const tip = 'M1 44 l -7 12 l 9.5 -3 z';
  return `<svg class="claw-svg" width="${CLAW_W}" viewBox="0 0 120 116" aria-hidden="true">
    <defs>
      <linearGradient id="clawArm" x1="0" y1="0" x2="1" y2="0.4">
        <stop offset="0" stop-color="#FFEE9B"/><stop offset=".5" stop-color="#FFD400"/><stop offset="1" stop-color="#B98F00"/>
      </linearGradient>
      <linearGradient id="clawHead" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#B98F00"/><stop offset=".26" stop-color="#FFE87A"/>
        <stop offset=".6" stop-color="#FFD400"/><stop offset="1" stop-color="#9E7700"/>
      </linearGradient>
      <linearGradient id="clawCap" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#FFF3B8"/><stop offset=".55" stop-color="#FFDE3D"/><stop offset="1" stop-color="#D9A800"/>
      </linearGradient>
    </defs>

    <!-- spindle -->
    <rect x="54" y="0" width="12" height="18" rx="5" fill="url(#clawCap)"/>
    <!-- rear talon, tucked behind the housing -->
    <g class="talon t-back">
      <path d="${arm}" fill="none" stroke="#9A7600" stroke-width="10" stroke-linecap="round"/>
      <path d="${tip}" fill="#876600"/>
    </g>
    <!-- housing -->
    <path d="M32 20 v14 a28 10 0 0 0 56 0 V20 z" fill="url(#clawHead)"/>
    <ellipse cx="60" cy="20" rx="28" ry="10" fill="url(#clawCap)"/>
    <ellipse cx="60" cy="34" rx="20" ry="7" fill="#9E7700" opacity=".5"/>
    <!-- front talons -->
    <g class="talon t-left">
      <path d="${arm}" fill="none" stroke="url(#clawArm)" stroke-width="12" stroke-linecap="round"/>
      <path d="${tip}" fill="#C79A00"/>
    </g>
    <g class="talon t-right">
      <path d="${arm}" fill="none" stroke="url(#clawArm)" stroke-width="12" stroke-linecap="round"/>
      <path d="${tip}" fill="#C79A00"/>
    </g>
  </svg>`;
}

const wait = ms => new Promise(r => setTimeout(r, ms));
