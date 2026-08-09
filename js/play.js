/* Screen 03 — the claw machine.

   Modelled on a real cabinet rather than a flat lane:

   - The gantry moves on two axes. Left/right slides the claw along the rail;
     up/down drives the rail itself toward the back or the front glass. Depth
     is projected as vertical position + scale, so pushing the stick up really
     does send the claw further into the cabinet.
   - One drop per credit. The timer is thinking time — pressing 집게 내리기
     commits the attempt and stops the clock.
   - Getting the aim right is necessary but not sufficient. The claw can close
     on the doll and still lose it while lifting or while carrying it to the
     chute, exactly like a weak grip on a real machine. The doll then falls
     back into the pit wherever it was dropped.
   - A carried doll hangs inside the prongs and rides with the claw. */

/* Cabinet projection. depth 0 = back wall, 1 = front glass. */
const CAB = {
  railTop:   d => 34 + d * 30,          // px from the top of the cabinet
  clawScale: d => 0.86 + d * 0.28,
  dollBottom: (d, spread) => 84 - d * (spread || 58),   // px from the pit floor
  dollSize:  d => Math.round(52 + d * 24),
};

/* Where the dolls sit in the bed: a back row of three and a front row of two,
   interleaved so neither row hides the other. */
const BED = [
  { x: 0.17, depth: 0.18 },
  { x: 0.50, depth: 0.18 },
  { x: 0.83, depth: 0.18 },
  { x: 0.33, depth: 0.86 },
  { x: 0.67, depth: 0.86 },
];

const GRAB_RADIUS = 0.20;   // how close the claw must be to close on a doll
const REST_CORD = 82;       // idle cord length, px

const Play = {
  machine: null,
  dolls: [],          // { dollId, x, depth, rot, taken }
  x: 0.5,             // claw across the cabinet, 0..1
  depth: 0.55,        // claw reach, 0 = back, 1 = front
  busy: false,
  over: false,
  dropped: false,     // the one attempt has been spent
  left: PLAY_SECONDS,
  timer: null,
  keys: null,
  view: 'front',
  stickActive: false,

  /** Lays out a fresh cabinet for `machine` and renders the screen. */
  start(machine) {
    this.machine = machine;
    this.x = 0.5; this.depth = 0.55;
    this.busy = false; this.over = false; this.dropped = false;
    this.left = PLAY_SECONDS;
    this.view = 'front';
    this.stickActive = false;

    const pool = machine.pool;
    this.dolls = BED.map((slot, i) => ({
      dollId: pool[i % pool.length],
      x: slot.x,
      depth: slot.depth,
      rot: (i % 2 ? 1 : -1) * (4 + (i * 5) % 10),
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
        <div class="views">
          <button data-act="view" data-v="front" aria-pressed="true">정면</button>
          <button data-act="view" data-v="side" aria-pressed="false">측면</button>
        </div>
        <div class="backwall"></div>
        <div class="rail" id="rail"></div>
        <div class="claw-rig" id="rig">
          <div class="cord" id="cord"></div>
          <div class="claw">
            <div class="held" id="held"></div>
            <div class="bar"></div>
            <div class="prongs"><i></i><i></i></div>
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
        <div class="stick" id="stick">
          <button class="dpad up"    data-dir="up"    aria-label="안쪽으로">${icon('caretUp', 18)}</button>
          <button class="dpad down"  data-dir="down"  aria-label="앞쪽으로">${icon('caretDown', 18)}</button>
          <button class="dpad left"  data-dir="left"  aria-label="왼쪽">${icon('chevronLeft3', 18)}</button>
          <button class="dpad right" data-dir="right" aria-label="오른쪽">${icon('chevronRight3', 18)}</button>
          <div class="knob" id="knob"></div>
        </div>
        <div class="grow" style="display:flex;flex-direction:column;gap:12px">
          <div class="timerrow">
            <span class="l">남은 시간</span>
            <span class="t" id="clock">${mmss(this.left)}</span>
          </div>
          ${meter(100, 'onDark')}
          <button class="btn lg btn--accent drop-btn" id="dropBtn" data-act="drop">집게 내리기</button>
        </div>
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
      view: el => {
        this.view = el.dataset.v;
        $$('.views button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === this.view)));
        $('#cabinet', root).dataset.view = this.view;
        this.paintPit();
        this.paintClaw();
      },
    });

    // Hold-to-move on the d-pad.
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
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
      if (map[ev.key]) { ev.preventDefault(); this.nudge(map[ev.key]); }
      if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); this.drop(); }
    };
    window.addEventListener('keydown', this.keys);
  },

  /** Dragging the knob steers continuously, like leaning on a real stick. */
  bindStick(stick, knob) {
    let dragging = false, raf = null, vx = 0, vy = 0;

    const apply = () => {
      if (!dragging) { raf = null; return; }
      if (Math.abs(vx) > 0.02) this.move('x', vx * 0.022);
      if (Math.abs(vy) > 0.02) this.move('depth', vy * 0.022);
      raf = requestAnimationFrame(apply);
    };

    const track = ev => {
      if (!dragging) return;
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const max = r.width / 2 - 22;
      let dx = ev.clientX - cx, dy = ev.clientY - cy;
      const len = Math.hypot(dx, dy) || 1;
      const clamped = Math.min(len, max);
      dx = (dx / len) * clamped; dy = (dy / len) * clamped;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      vx = dx / max; vy = -dy / max;              // pushing up sends the claw back
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const release = () => {
      if (!dragging) return;
      dragging = false; this.stickActive = false; vx = vy = 0;
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

  nudge(dir) {
    const step = 0.042;
    if (dir === 'left')  this.move('x', -step);
    if (dir === 'right') this.move('x', step);
    if (dir === 'up')    this.move('depth', -step * 1.15);
    if (dir === 'down')  this.move('depth', step * 1.15);
  },

  move(axis, delta) {
    if (!this.canMove()) return;
    const range = axis === 'x' ? [0.08, 0.92] : [0.06, 0.96];
    const next = Math.max(range[0], Math.min(range[1], this[axis] + delta));
    if (next === this[axis]) return;
    this[axis] = next;
    haptic(5);
    this.paintClaw();
    this.paintOdds();
  },

  /* ------------------------------------------------------------- painting */

  paintClaw() {
    const rig = document.getElementById('rig');
    const rail = document.getElementById('rail');
    if (!rig || !rail) return;
    const top = CAB.railTop(this.depth) * this.depthGain();
    rail.style.top = top + 'px';
    rig.style.top = (top + 8) + 'px';
    rig.style.left = (this.x * 100) + '%';
    rig.style.setProperty('--claw-scale', CAB.clawScale(this.depth));
    this.paintKnob();
  },

  paintKnob() {
    // While the stick is held, the knob follows the finger, not the claw.
    if (this.stickActive) return;
    const knob = document.getElementById('knob');
    if (!knob) return;
    knob.style.transform =
      `translate(${(this.x - 0.5) * 30}px, ${-(this.depth - 0.5) * 30}px)`;
  },

  /** 측면 view exaggerates depth so it is easier to judge the back row. */
  depthGain() { return this.view === 'side' ? 1.55 : 1; },

  paintPit() {
    const pit = document.getElementById('pit');
    if (!pit) return;
    const spread = this.view === 'side' ? 92 : 58;
    // Rotation lives on the image so the wrapper's transform stays free for
    // the drop-back animation.
    pit.innerHTML = this.dolls.map((d, i) => {
      const size = CAB.dollSize(d.depth);
      return `<div class="doll ${d.taken ? 'taken' : ''}" data-i="${i}"
        style="left:calc(${d.x * 100}% - ${size / 2}px);bottom:${CAB.dollBottom(d.depth, spread)}px;
               z-index:${Math.round(d.depth * 10)}">
        ${dollImg(d.dollId, size, `transform:rotate(${d.rot}deg)`)}
      </div>`;
    }).join('');
  },

  /** Live odds = machine odds scaled by how well the claw is lined up. */
  liveOdds() {
    const base = Store.odds(this.machine);
    const near = this.nearest();
    if (!near || near.dist > GRAB_RADIUS * 2.4) return 0;
    const aim = Math.max(0, 1 - near.dist / (GRAB_RADIUS * 1.6));
    return Math.round(base * (0.28 + 0.72 * aim));
  },

  /** Nearest untaken doll in cabinet space (x and depth weigh equally). */
  nearest() {
    let best = null;
    this.dolls.forEach((d, i) => {
      if (d.taken) return;
      const dist = Math.hypot(d.x - this.x, (d.depth - this.depth) * 0.8);
      if (!best || dist < best.dist) best = { i, d, dist };
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

    // Lower until the prongs reach the doll (or the pit floor on a clean miss).
    const reach = this.reachFor(near, inRange);
    cord.style.transition = 'height .55s cubic-bezier(.4,0,.6,1)';
    cord.style.height = reach + 'px';
    await wait(600);

    rig.dataset.grip = '1';
    haptic(14);
    await wait(280);

    let carried = null;
    if (grips) {
      this.dolls[near.i].taken = true;
      this.paintPit();
      carried = near.d;
      document.getElementById('held').innerHTML = dollImg(carried.dollId, CAB.dollSize(carried.depth));
    }

    // Lift.
    this.setState(grips ? 'LIFTING' : 'MISSED');
    if (failMode === 'slipLift' && grips) {
      cord.style.transition = 'height .3s ease-out';
      cord.style.height = (reach * 0.55) + 'px';
      await wait(340);
      await this.releaseInto(carried, this.x, near.d.depth, 'slip');
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
    rig.style.transition = 'left .75s ease-in-out, top .75s ease-in-out';
    rig.style.left = '18%';

    if (failMode === 'slipCarry') {
      await wait(430);                       // let go partway across
      const dropX = 0.18 + (this.x - 0.18) * 0.45;
      await this.releaseInto(carried, dropX, near.d.depth, 'slip');
      await wait(360);
      this.finish(false, null);
      return;
    }

    await wait(800);
    delete rig.dataset.grip;
    document.getElementById('held').innerHTML = '';
    const chute = document.getElementById('chute');
    chute.insertAdjacentHTML('beforeend', dollImg(carried.dollId, 56));
    this.setState('GOT IT');
    haptic(40);
    await wait(620);
    this.finish(true, carried.dollId);
  },

  /** How far the cord must extend for the prongs to meet the target. */
  reachFor(near, inRange) {
    const cabinet = document.getElementById('cabinet');
    const rig = document.getElementById('rig');
    if (!cabinet || !rig) return 150;
    const cabRect = cabinet.getBoundingClientRect();
    const rigTop = rig.getBoundingClientRect().top - cabRect.top;

    let targetTop;
    if (inRange && near) {
      const el = $(`.doll[data-i="${near.i}"]`, cabinet);
      targetTop = el
        ? el.getBoundingClientRect().top - cabRect.top
        : cabRect.height - 200;
    } else {
      targetTop = cabRect.height - 190;          // clean miss: reach the bed
    }
    // The prongs hang ~52px below the cord's end at rest scale.
    const reach = targetTop - rigTop - 30;
    return Math.max(REST_CORD + 20, Math.min(reach, cabRect.height - 150));
  },

  /** Opens the claw and drops `doll` back into the pit at (x, depth). */
  async releaseInto(doll, x, depth, reason) {
    const rig = document.getElementById('rig');
    delete rig.dataset.grip;
    document.getElementById('held').innerHTML = '';

    const idx = this.dolls.findIndex(d => d === doll);
    if (idx >= 0) {
      this.dolls[idx].taken = false;
      this.dolls[idx].x = Math.max(0.12, Math.min(0.88, x));
      this.dolls[idx].depth = depth;
      this.dolls[idx].rot = Math.round((Math.random() - 0.5) * 26);
      this.paintPit();
      const el = $(`.doll[data-i="${idx}"]`, screenEl());
      if (el) el.classList.add('dropping');
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

  /** First-run coach mark over the joystick (screen 25). */
  coach() {
    const steps = [
      { t: '조이스틱으로 집게를 움직여요', d: '좌우로 밀면 집게가 옆으로, 위아래로 밀면 기계 안쪽과 앞쪽으로 이동해요.' },
      { t: '확률을 보고 타이밍을 잡아요', d: '집게가 인형에 정확히 겹칠수록 이번 판 확률이 올라가요.' },
      { t: '집게는 한 번만 내려가요', d: `${PLAY_SECONDS}초 안에 위치를 잡고 내리세요. 잡아도 올리다가 놓칠 수 있어요.` },
    ];
    let i = 0;
    const { node, close } = Overlay.open(`<div class="coach">
      <div class="hole" style="left:20px;bottom:calc(30px + var(--safe-b));width:132px;height:132px"></div>
      <div class="bubble" style="left:24px;bottom:calc(186px + var(--safe-b))">
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

const wait = ms => new Promise(r => setTimeout(r, ms));
