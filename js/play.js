/* Screen 03 — the claw machine itself.

   The claw slides along the rail (left/right) and reaches forward or back
   (up/down). Dropping scores accuracy against the nearest doll, then rolls
   against the machine's live odds: base rate plus the consecutive-failure
   bonus the design describes on screen 22. */

const Play = {
  machine: null,
  dolls: [],          // { dollId, x, depth, taken }
  x: 0.5,             // claw position across the cabinet, 0..1
  depth: 0.5,         // claw reach, 0 = back row, 1 = front row
  held: null,
  busy: false,
  over: false,
  left: PLAY_SECONDS,
  timer: null,
  keys: null,
  view: 'front',

  /** Lays out a fresh cabinet for `machine` and renders the screen. */
  start(machine) {
    this.machine = machine;
    this.x = 0.5; this.depth = 0.5;
    this.held = null; this.busy = false; this.over = false;
    this.left = PLAY_SECONDS;
    this.view = 'front';

    const pool = machine.pool;
    const n = Math.min(5, pool.length);
    this.dolls = [];
    for (let i = 0; i < n; i++) {
      this.dolls.push({
        dollId: pool[i % pool.length],
        x: n === 1 ? 0.5 : 0.14 + (i / (n - 1)) * 0.72,
        depth: 0.25 + ((i * 0.37) % 0.6),
        rot: (i % 2 ? 1 : -1) * (4 + (i * 3) % 8),
        taken: false,
      });
    }
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
        <div class="state"><i></i><span>PLAYING</span></div>
        <div class="views">
          <button data-act="view" data-v="front" aria-pressed="true">정면</button>
          <button data-act="view" data-v="side" aria-pressed="false">측면</button>
        </div>
        <div class="rail"></div>
        <div class="claw-rig" id="rig" style="left:50%">
          <div class="cord" id="cord"></div>
          <div class="claw">
            <div class="bar"></div>
            <div class="prongs"><i></i><i></i></div>
          </div>
          <div class="held" id="held"></div>
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
          <button class="dpad up"    data-dir="up"    aria-label="뒤로">${icon('caretUp', 18)}</button>
          <button class="dpad down"  data-dir="down"  aria-label="앞으로">${icon('caretDown', 18)}</button>
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
    this.paintOdds();
    this.paintClaw();
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
      view: (el) => {
        this.view = el.dataset.v;
        $$('.views button', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === this.view)));
        this.paintPit();
      },
    });

    // Hold-to-move on the d-pad, both mouse and touch.
    $$('.dpad', root).forEach(btn => {
      let hold = null;
      const startMove = ev => {
        ev.preventDefault();
        if (this.busy || this.over) return;
        btn.dataset.active = '1';
        this.nudge(btn.dataset.dir);
        hold = setInterval(() => this.nudge(btn.dataset.dir), 70);
      };
      const endMove = () => { clearInterval(hold); hold = null; delete btn.dataset.active; };
      btn.addEventListener('pointerdown', startMove);
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(e => btn.addEventListener(e, endMove));
    });

    this.keys = ev => {
      if (this.busy || this.over) return;
      const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
      if (map[ev.key]) { ev.preventDefault(); this.nudge(map[ev.key]); }
      if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); this.drop(); }
    };
    window.addEventListener('keydown', this.keys);
  },

  nudge(dir) {
    const step = 0.045;
    if (dir === 'left')  this.x = Math.max(0.08, this.x - step);
    if (dir === 'right') this.x = Math.min(0.92, this.x + step);
    if (dir === 'up')    this.depth = Math.max(0, this.depth - step * 1.4);
    if (dir === 'down')  this.depth = Math.min(1, this.depth + step * 1.4);
    haptic(6);
    this.paintClaw();
    this.paintOdds();
  },

  paintClaw() {
    const rig = document.getElementById('rig');
    if (!rig) return;
    rig.style.left = (this.x * 100) + '%';
    const knob = document.getElementById('knob');
    if (knob) {
      knob.style.transform = `translate(${(this.x - 0.5) * 26}px, ${(this.depth - 0.5) * 26}px)`;
    }
  },

  paintPit() {
    const pit = document.getElementById('pit');
    if (!pit) return;
    const side = this.view === 'side';
    pit.innerHTML = this.dolls.map((d, i) => {
      const size = 64 + Math.round(d.depth * 14);
      const bottom = side ? 8 + d.depth * 62 : 8 + d.depth * 26;
      return `<div class="doll ${d.taken ? 'taken' : ''}" data-i="${i}"
        style="left:calc(${d.x * 100}% - ${size / 2}px);bottom:${bottom}px;
               transform:rotate(${d.rot}deg);z-index:${Math.round(d.depth * 10)}">
        ${dollImg(d.dollId, size)}
      </div>`;
    }).join('');
  },

  /** Live odds = machine odds, adjusted for how well the claw is lined up. */
  liveOdds() {
    const base = Store.odds(this.machine);
    const near = this.nearest();
    if (!near) return 0;
    const aim = Math.max(0, 1 - near.dist / 0.28);          // 1 = dead centre
    return Math.round(base * (0.45 + 0.55 * aim));
  },

  nearest() {
    let best = null;
    this.dolls.forEach((d, i) => {
      if (d.taken) return;
      const dx = d.x - this.x;
      const dd = (d.depth - this.depth) * 0.55;             // depth matters less than x
      const dist = Math.hypot(dx, dd);
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

  tick() {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.over) return;
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
        if (!this.busy) this.finish(false, null);
      }
    }, 100);
  },

  async drop() {
    if (this.busy || this.over) return;
    const near = this.nearest();
    if (!near) return;

    this.busy = true;
    const rig = document.getElementById('rig');
    const cord = document.getElementById('cord');
    const btn = document.getElementById('dropBtn');
    btn.disabled = true;
    btn.classList.add('btn--disabled');
    rig.dataset.busy = '1';
    haptic(20);

    const chance = this.liveOdds();
    const inRange = near.dist < 0.22;
    const won = inRange && Math.random() * 100 < chance;

    // Lower.
    cord.style.height = '150px';
    await wait(460);
    rig.dataset.grip = '1';
    await wait(240);

    if (won) {
      this.dolls[near.i].taken = true;
      this.paintPit();
      document.getElementById('held').innerHTML = dollImg(near.d.dollId, 62);
    }

    // Raise.
    cord.style.height = '82px';
    await wait(460);

    if (won) {
      // Carry to the chute and release.
      rig.style.left = '18%';
      await wait(520);
      delete rig.dataset.grip;
      document.getElementById('held').innerHTML = '';
      const chute = document.getElementById('chute');
      chute.insertAdjacentHTML('beforeend', dollImg(near.d.dollId, 56));
      haptic(40);
      await wait(520);
      this.finish(true, near.d.dollId);
      return;
    }

    delete rig.dataset.grip;
    delete rig.dataset.busy;
    this.busy = false;
    btn.disabled = false;
    btn.classList.remove('btn--disabled');

    if (this.left <= 0) this.finish(false, null);
    else toast('아깝게 놓쳤어요. 시간 안에 다시 도전!', { mini: true, duration: 1500 });
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
    dialog(`
      <h3 style="margin-top:0">지금 나가면 티켓이 사라져요</h3>
      <p>사용한 티켓 ${this.machine.cost}장은 돌려받을 수 없어요.<br>남은 시간 ${Math.ceil(this.left)}초 안에 도전해 보세요.</p>
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
      { t: '조이스틱으로 집게를 움직여요', d: '좌우로 밀어 위치를 맞추고, 위아래로 깊이를 조절하세요.' },
      { t: '확률을 보고 타이밍을 잡아요', d: '집게가 인형에 가까울수록 이번 판 확률이 올라가요.' },
      { t: '시간 안에 집게를 내리세요', d: `${PLAY_SECONDS}초가 지나면 티켓이 소모된 채로 끝나요.` },
    ];
    let i = 0;
    const { node, close } = Overlay.open(`<div class="coach">
      <div class="hole" style="left:20px;bottom:calc(30px + var(--safe-b));width:132px;height:132px"></div>
      <div class="bubble" style="left:24px;bottom:calc(186px + var(--safe-b))">
        <div class="step"></div>
        <div class="t"></div>
        <div class="d"></div>
        <div class="ft">
          <div class="dots"></div>
          <button class="skip" data-act="skip">건너뛰기</button>
          <button class="next" data-act="next">다음</button>
        </div>
      </div>
    </div>`, null, { persistent: true, scrim: 'transparent' });

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
