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
const REST_CORD = 76;        // idle cord length, px
const CLAW_W = 104;          // rendered claw width, px

/* The heap. Two overlapping rows — a back row and a front row nestled into its
   gaps — so the bed reads as a pile of plush rather than a tidy line. Every
   slot clears the chute mouth on the left, so nothing ever sits on the hole it
   is supposed to fall through. */
const BED = [
  // back row: smaller, higher up, partly hidden by the front row
  { x: 0.345, layer: 0, size: 54, bottom: 32 },
  { x: 0.465, layer: 0, size: 56, bottom: 29 },
  { x: 0.585, layer: 0, size: 54, bottom: 33 },
  { x: 0.705, layer: 0, size: 57, bottom: 29 },
  { x: 0.825, layer: 0, size: 54, bottom: 32 },
  // front row: larger, sitting lower and overlapping the back row
  { x: 0.405, layer: 1, size: 63, bottom: 7 },
  { x: 0.525, layer: 1, size: 61, bottom: 10 },
  { x: 0.645, layer: 1, size: 64, bottom: 6 },
  { x: 0.765, layer: 1, size: 61, bottom: 9 },
];

const BED_MIN_X = 0.345;     // leftmost slot — a slipped doll never lands left of this
const CHUTE_X = 0.155;       // claw position over the chute mouth
const START_X = 0.60;        // claw starts over the middle of the pile

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
  stickActive: false,

  /** Lays out a fresh cabinet for `machine` and renders the screen. */
  start(machine) {
    this.machine = machine;
    this.x = START_X;
    this.busy = false; this.over = false; this.dropped = false;
    this.left = PLAY_SECONDS;
    this.stickActive = false;

    const pool = machine.pool;
    this.dolls = BED.map((slot, i) => ({
      dollId: pool[i % pool.length],
      x: slot.x,
      layer: slot.layer,
      size: slot.size,
      bottom: slot.bottom,
      rot: (i % 2 ? 1 : -1) * (5 + (i * 7) % 14),
      taken: false,
    }));
    this.render();
  },

  stop() {
    clearInterval(this.timer); this.timer = null;
    if (this.keys) { window.removeEventListener('keydown', this.keys); this.keys = null; }
  },

  render() {
    setTheme('dark');
    const m = this.machine;
    screenEl().innerHTML = `<div class="screen">
      ${statusbar()}
      <div class="play-head">
        <button class="iconbtn ghost" data-act="exit" aria-label="나가기">${icon('chevronLeft3', 20)}</button>
        <div>
          <div class="nm">${esc(m.name)}</div>
          <div class="mt">난이도 ${esc(m.difficulty)} · 집게 힘 ${esc(m.grip)}</div>
        </div>
        ${walletChip(true)}
      </div>

      <div class="cabinet" id="cabinet">
        <div class="state"><i></i><span id="stateTxt">READY</span></div>
        <div class="backwall"></div>
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
        <div class="pit" id="pit"></div>
        <div class="play-foot">
          <div class="chute" id="chute">
            <div class="glow"></div>
            <div class="sign">PRIZE OUT</div>
            <div class="slot"></div>
          </div>
          <div class="odds">
            <div class="l">이번 판 확률</div>
            <div class="v"><b id="oddsNum">0%</b><span>집게 힘 ${esc(m.grip)}</span></div>
            ${meter(0, 'onDark')}
          </div>
        </div>
      </div>

      <div class="controls">
        <div class="timerrow">
          <span class="l">남은 시간</span>
          <span class="t" id="clock">${mmss(this.left)}</span>
        </div>
        ${meter(100, 'onDark')}
        <div class="stick" id="stick">
          <button class="dpad left"  data-dir="left"  aria-label="왼쪽">${icon('chevronLeft3', 20)}</button>
          <div class="track"></div>
          <div class="knob" id="knob"></div>
          <button class="dpad right" data-dir="right" aria-label="오른쪽">${icon('chevronRight3', 20)}</button>
        </div>
        <button class="btn lg btn--accent drop-btn" id="dropBtn" data-act="drop">집게 내리기</button>
      </div>
    </div>`;

    this.paintPit();
    this.paintClaw();
    this.paintOdds();
    this.wire();
    this.tick();

    if (!Store.state.coachDone) this.coach();
  },

  wire() {
    const root = screenEl();
    bind(root, {
      exit: () => this.confirmExit(),
      drop: () => this.drop(),
      wallet: () => go('mission'),
    });

    // Hold-to-move on the two direction buttons.
    $$('.dpad', root).forEach(btn => {
      let hold = null;
      const begin = ev => {
        ev.preventDefault();
        if (!this.canMove()) return;
        btn.dataset.active = '1';
        this.nudge(btn.dataset.dir);
        hold = setInterval(() => this.nudge(btn.dataset.dir), 60);
      };
      const end = () => { clearInterval(hold); hold = null; delete btn.dataset.active; };
      btn.addEventListener('pointerdown', begin);
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(e => btn.addEventListener(e, end));
    });

    this.bindStick($('#stick', root), $('#knob', root));

    this.keys = ev => {
      if (!this.canMove()) return;
      if (ev.key === 'ArrowLeft')  { ev.preventDefault(); this.nudge('left'); }
      if (ev.key === 'ArrowRight') { ev.preventDefault(); this.nudge('right'); }
      if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); this.drop(); }
    };
    window.addEventListener('keydown', this.keys);
  },

  /** The lever slides along its track; how far you push it sets the speed. */
  bindStick(stick, knob) {
    let dragging = false, raf = null, vx = 0;

    const apply = () => {
      if (!dragging) { raf = null; return; }
      if (Math.abs(vx) > 0.04) this.move(vx * 0.020);
      raf = requestAnimationFrame(apply);
    };

    const track = ev => {
      if (!dragging) return;
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const max = r.width / 2 - 26;
      const dx = Math.max(-max, Math.min(max, ev.clientX - cx));
      knob.style.transform = `translateX(${dx}px)`;
      vx = dx / max;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const release = () => {
      if (!dragging) return;
      dragging = false; this.stickActive = false; vx = 0;
      if (raf) { cancelAnimationFrame(raf); raf = null; }
      this.paintKnob();
    };

    stick.addEventListener('pointerdown', ev => {
      if (ev.target.closest('.dpad') || !this.canMove()) return;
      dragging = true; this.stickActive = true;
      stick.setPointerCapture(ev.pointerId);
      track(ev);
    });
    stick.addEventListener('pointermove', track);
    ['pointerup', 'pointercancel'].forEach(e => stick.addEventListener(e, release));
  },

  canMove() { return !this.busy && !this.over && !this.dropped; },

  nudge(dir) { this.move(dir === 'left' ? -0.038 : 0.038); },

  move(delta) {
    if (!this.canMove()) return;
    const next = Math.max(0.08, Math.min(0.92, this.x + delta));
    if (next === this.x) return;
    this.x = next;
    haptic(5);
    this.paintClaw();
    this.paintOdds();
  },

  /* ------------------------------------------------------------- painting */

  paintClaw() {
    const rig = document.getElementById('rig');
    const mount = document.getElementById('railMount');
    if (!rig) return;
    rig.style.left = (this.x * 100) + '%';
    if (mount) mount.style.left = (this.x * 100) + '%';
    this.paintKnob();
  },

  paintKnob() {
    // While the lever is held, the knob follows the finger, not the claw.
    if (this.stickActive) return;
    const knob = document.getElementById('knob');
    const stick = document.getElementById('stick');
    if (!knob || !stick) return;
    const max = stick.getBoundingClientRect().width / 2 - 26;
    knob.style.transform = `translateX(${(this.x - 0.5) * 2 * max}px)`;
  },

  paintPit() {
    const pit = document.getElementById('pit');
    if (!pit) return;
    // Rotation lives on the image so the wrapper's transform stays free for
    // the drop-back animation.
    pit.innerHTML = this.dolls.map((d, i) => `
      <div class="doll ${d.taken ? 'taken' : ''}" data-i="${i}"
        style="left:calc(${d.x * 100}% - ${d.size / 2}px);bottom:${d.bottom}px;z-index:${2 + d.layer * 2}">
        ${dollImg(d.dollId, d.size, `transform:rotate(${d.rot}deg)`)}
      </div>`).join('');
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
        // Both grabbable — prefer the higher layer, then the closer one.
        if (d.layer > best.d.layer || (d.layer === best.d.layer && dist < best.dist)) best = { i, d, dist };
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
    const bar = $('.odds .meter > i', screenEl());
    if (bar) bar.style.width = n + '%';
  },

  setState(text) {
    const el = document.getElementById('stateTxt');
    if (el) el.textContent = text;
  },

  tick() {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.over || this.dropped) return;
      this.left -= 0.1;
      const clock = document.getElementById('clock');
      if (clock) {
        clock.textContent = mmss(this.left);
        clock.classList.toggle('warn', this.left <= 5);
      }
      const bar = $('.controls .meter > i', screenEl());
      if (bar) bar.style.width = (this.left / PLAY_SECONDS * 100) + '%';
      if (this.left <= 0) {
        clearInterval(this.timer);
        this.setState('TIME UP');
        toast('시간이 다 됐어요', { tone: 'error', duration: 1400 });
        setTimeout(() => this.finish(false, null), 700);
      }
    }, 100);
  },

  /* ---------------------------------------------------------------- drop */

  async drop() {
    if (this.busy || this.over || this.dropped) return;

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
    cord.style.transition = 'height .55s cubic-bezier(.4,0,.6,1)';
    cord.style.height = reach + 'px';
    await wait(600);

    rig.dataset.grip = '1';
    haptic(14);
    await wait(300);

    let carried = null;
    if (grips) {
      this.dolls[near.i].taken = true;
      this.paintPit();
      carried = near.d;
      document.getElementById('held').innerHTML = dollImg(carried.dollId, carried.size, '', 'grabbed');
    }

    // Lift.
    this.setState(grips ? 'LIFTING' : 'MISSED');
    if (failMode === 'slipLift' && grips) {
      cord.style.transition = 'height .3s ease-out';
      cord.style.height = (reach * 0.55) + 'px';
      await wait(340);
      await this.releaseInto(carried, this.x, 'slip');
      cord.style.transition = 'height .45s ease-out';
      cord.style.height = REST_CORD + 'px';
      await wait(500);
      this.finish(false, null);
      return;
    }

    cord.style.transition = 'height .55s ease-out';
    cord.style.height = REST_CORD + 'px';
    await wait(600);

    if (!grips) { this.finish(false, null); return; }

    // Carry to the chute.
    this.setState('CARRYING');
    const overChute = (CHUTE_X * 100) + '%';
    rig.style.transition = 'left .75s ease-in-out';
    rig.style.left = overChute;
    const mount = document.getElementById('railMount');
    if (mount) { mount.style.transition = 'left .75s ease-in-out'; mount.style.left = overChute; }

    if (failMode === 'slipCarry') {
      await wait(430);                       // let go partway across
      // Never land a slipped doll on the chute mouth — it would look like a win.
      const dropX = Math.max(BED_MIN_X, CHUTE_X + (this.x - CHUTE_X) * 0.5);
      await this.releaseInto(carried, dropX, 'slip');
      await wait(360);
      this.finish(false, null);
      return;
    }

    await wait(800);
    delete rig.dataset.grip;
    document.getElementById('held').innerHTML = '';
    const chute = document.getElementById('chute');
    chute.insertAdjacentHTML('beforeend', dollImg(carried.dollId, 56, '', 'drop'));
    this.setState('GOT IT');
    haptic(40);
    await wait(620);
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

    let targetY;
    if (inRange && near) {
      const el = $(`.doll[data-i="${near.i}"]`, cabinet);
      // Sink the tips a little into the doll so the grip looks committed.
      targetY = el ? el.getBoundingClientRect().top + 18 : cabRect.bottom - 190;
    } else {
      targetY = cabRect.bottom - 152;          // clean miss: reach the bed floor
    }

    const current = parseFloat(cord.style.height) || REST_CORD;
    const reach = current + (targetY - tipsNow);
    return Math.max(REST_CORD + 20, Math.min(reach, cabRect.height - 120));
  },

  /** Opens the claw and drops `doll` back onto the bed at `x`. */
  async releaseInto(doll, x, reason) {
    const rig = document.getElementById('rig');
    delete rig.dataset.grip;
    document.getElementById('held').innerHTML = '';

    const idx = this.dolls.findIndex(d => d === doll);
    if (idx >= 0) {
      this.dolls[idx].taken = false;
      // Clamp back onto the bed, clear of the chute mouth.
      this.dolls[idx].x = Math.max(BED_MIN_X, Math.min(0.9, x));
      this.dolls[idx].rot = Math.round((Math.random() - 0.5) * 26);
      this.paintPit();
      const el = $(`.doll[data-i="${idx}"]`, screenEl());
      if (el) {
        el.classList.add('dropping');
        // Show the tumbling pose while it falls, then let it settle back.
        const img = $('img', el);
        const d = this.dolls[idx];
        if (img) {
          img.src = dollArt(d.dollId, 'drop');
          setTimeout(() => {
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
    this.stop();
    Store.recordPlay(this.machine, won, dollId);
    go(won ? 'win' : 'lose', dollId || '');
  },

  confirmExit() {
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
      { t: '레버로 집게를 움직여요', d: '좌우로 밀거나 화살표를 눌러 집게를 인형 위에 맞추세요.' },
      { t: '확률을 보고 타이밍을 잡아요', d: '집게가 인형에 정확히 겹칠수록 이번 판 확률이 올라가요.' },
      { t: '집게는 한 번만 내려가요', d: `${PLAY_SECONDS}초 안에 위치를 잡고 내리세요. 잡아도 올리다가 놓칠 수 있어요.` },
    ];
    let i = 0;
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

    const paint = () => {
      $('.step', node).textContent = `STEP ${i + 1} / ${steps.length}`;
      $('.t', node).textContent = steps[i].t;
      $('.d', node).textContent = steps[i].d;
      $('.dots', node).innerHTML = steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
      $('.next', node).textContent = i === steps.length - 1 ? '시작' : '다음';
    };
    const done = () => { Store.state.coachDone = true; Store.save(); close(); };

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
