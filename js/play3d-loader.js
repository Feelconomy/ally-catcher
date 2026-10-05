/* Keep module loading outside the legacy router and preserve result-screen context. */
let green3DRequest = 0;

/* 배경 초원은 9MB 라 인형통을 연 뒤에 받기 시작하면 폰에서 한참 뒤에야 깔린다.
   3D 로 놀 사람에게는 홈·기계 화면에 있는 동안 미리 받아 브라우저 캐시에 넣어
   둔다 — 화면에는 아무 일도 하지 않는다. 모듈(three·cannon)도 같이 데운다.
   데이터 절약이 켜져 있거나 느린 회선이면 건너뛴다. */
let warmed = false;
function warmGreen3D() {
  if (warmed || location.protocol === 'file:') return;
  const net = navigator.connection || {};
  if (Store.state.settings.dataSaver || net.saveData) return;
  if (net.effectiveType && net.effectiveType !== '4g') return;
  warmed = true;
  const idle = window.requestIdleCallback || (fn => setTimeout(fn, 1500));
  idle(() => {
    import('./play3d.js?v=211').catch(() => { warmed = false; });
    for (const f of ['higgsfield-meadow-detailed.glb', 'mint-machine.glb'])
      fetch('assets/3d/' + f, { priority: 'low' }).catch(() => {});
  });
}
/* 3D 를 받는 동안 보여줄 짧은 이야기: 친구 실루엣이 깡충깡충 뛰어와 인형통 위로
   쏙 들어간다. 한 번 들어갈 때마다 다른 친구로 바뀌고, 문구도 그 친구 것으로
   바뀐다(애니메이션이 한 바퀴 끝나 실루엣이 투명할 때 갈아 끼운다). */
const pick = list => list[Math.floor(Math.random() * list.length)];
document.addEventListener('animationiteration', e => {
  const char = e.target;
  if (!char.classList || !char.classList.contains('l3-olly')) return;
  // 관리자 미리보기에서 한 친구로 고정하면(data-fixed) 문구만 그 친구 것끼리 돈다
  const next = char.dataset.fixed ? char.dataset.id : pick(FRIEND_IDS.filter(id => id !== char.dataset.id));
  char.dataset.id = next;
  char.innerHTML = friendImage(next);
  const tip = document.getElementById('loading3dTip');
  if (!tip) return;
  tip.classList.add('out');
  setTimeout(() => { tip.textContent = pick(FRIENDS[next].lines); tip.classList.remove('out'); }, 260);
});
/* 실제 캐릭터 윤곽 마스크를 한 가지 색으로 칠한다(#l3sil). 발바닥 가운데가 (0,0). */
const friendImage = (id, h = 40) => `<image href="${friendMask(id)}" x="${-h * .55}" y="${-h}" width="${h * 1.1}" height="${h}" preserveAspectRatio="xMidYMax meet" filter="url(#l3sil)"/>`;
/** fixed: 한 친구만 계속 나오게(관리자 미리보기). 없으면 들어갈 때마다 바뀐다. */
function green3DLoading(fixed) {
  const first = FRIENDS[fixed] ? fixed : pick(FRIEND_IDS);
  return `<div class="green3d-loading l3" id="loading3d" role="status" aria-live="polite">
    <svg class="l3-scene" viewBox="0 -34 200 214" aria-hidden="true">
      <defs><filter id="l3sil"><feFlood flood-color="#0e4f2c"/><feComposite in2="SourceAlpha" operator="in"/></filter></defs>
      <ellipse class="l3-ground" cx="104" cy="172" rx="92" ry="6"/>
      <g class="l3-pile">${FRIEND_IDS.filter(id => id !== first).slice(0, 3).map((id, k) =>
        `<g transform="translate(${[114, 151, 132][k]} ${[118, 118, 112][k]})">${friendImage(id, 24)}</g>`).join('')}</g>
      <g class="l3-olly" data-id="${first}"${FRIENDS[fixed] ? ' data-fixed="1"' : ''}>${friendImage(first)}</g>
      <g class="l3-claw"><line x1="114" y1="46" x2="114" y2="62"/><path d="M106 70l2-6h12l2 6M108 64l-4 10M120 64l4 10"/></g>
      <path class="l3-cab" fill-rule="evenodd" d="M104 22h56a12 12 0 0 1 12 12v126a8 8 0 0 1-8 8H100a8 8 0 0 1-8-8V34a12 12 0 0 1 12-12ZM100 48v70h64V48Z"/>
      <rect class="l3-glass" x="100" y="48" width="64" height="70"/>
      <path class="l3-shine" d="M106 54l10 0-14 22v-14Z"/>
      <circle class="l3-bulb" cx="116" cy="35" r="3"/><circle class="l3-bulb" cx="132" cy="35" r="3"/><circle class="l3-bulb" cx="148" cy="35" r="3"/>
      <rect class="l3-chute" x="104" y="134" width="22" height="22" rx="5"/>
      <circle class="l3-btn" cx="150" cy="142" r="6"/>
    </svg>
    <p class="l3-tip"><span id="loading3dTip">${pick(FRIENDS[first].lines)}</span><i></i><i></i><i></i></p>
    <div class="l3-bar"><i id="loading3dBar"></i></div>
    <span class="l3-sub" id="loading3dText">3D 화면을 불러오고 있어요</span>
  </div>`;
}
/* 3D 를 못 받았을 때. kind: offline(인터넷 끊김) · server(그 밖의 실패) · local(file://) */
const GREEN3D_ERRORS = {
  offline: ['인터넷이 끊겼어요', '연결되면 다시 시도해 주세요.\n기본 모드는 인터넷 없이도 바로 할 수 있어요.'],
  server: ['인형통을 불러오지 못했어요', '잠시 뒤 다시 시도해 주세요.\n그동안 기본 모드로 놀 수 있어요.'],
  local: ['로컬 서버가 필요해요', '3D 모드는 파일로 열면 동작하지 않아요.\n로컬 서버로 열어 주세요.'],
};
function green3DError(kind) {
  const [title, body] = GREEN3D_ERRORS[kind] || GREEN3D_ERRORS.server;
  return `<div class="green3d-loading l3 l3-err" role="alert">
    ${friendIcon('olly', 92, 'peek')}
    <strong>${title}</strong>
    <p>${esc(body)}</p>
    <button class="btn btn--primary" id="retry3d">다시 시도</button>
    <button class="btn btn--text" id="fallback2d">기본 모드로 계속</button>
  </div>`;
}
async function startGreen3D(machine) {
  const request = ++green3DRequest;
  Play.stop();
  window.Play3D?.stop();
  Play.machine = machine;
  Play.skinId = 'arcade';
  setTheme('arcade');
  // 기계 연결 화면에서 넘어왔으면 그 준비 화면을 그대로 이어 쓴다 — 두 번 안 띄운다
  if (!document.getElementById('loading3d')) screenEl().innerHTML = green3DLoading();
  try {
    if (location.protocol === 'file:') throw new Error('LOCAL_SERVER_REQUIRED');
    const { Play3D } = await import('./play3d.js?v=211');
    if (request !== green3DRequest || App.route !== 'play') return;
    window.Play3D = Play3D;
    await Play3D.start(machine);
  } catch (error) {
    if (request !== green3DRequest || App.route !== 'play') return;
    window.Play3D?.stop();
    console.error('3D cabinet:', error);
    screenEl().innerHTML = green3DError(location.protocol === 'file:' ? 'local' : navigator.onLine ? 'server' : 'offline');
    document.getElementById('retry3d').onclick = () => startGreen3D(machine);
    document.getElementById('fallback2d').onclick = () => {
      Store.state.settings.skin = 'arcade'; Store.save(); Play.start(machine, 'arcade');
    };
  }
}

/* ── 3D 첫 판 튜토리얼 ───────────────────────────────────────────────
   2D 의 Play.coach() 와 같은 모양이지만 조작이 달라 단계가 다르다
   (레버 하나 → 조이스틱 + 드롭 버튼 + 시점 전환). 2D 를 먼저 해 봤더라도
   3D 는 처음이면 다시 보여 줘야 해서 플래그도 따로 쓴다. */
function coach3D(play) {
  const steps = [
    { sel: '#stick3d', t: '조이스틱으로 집게를 움직여요',
      d: '손가락으로 스틱을 밀면 그 방향으로 집게가 갑니다. 앞뒤로도 움직여요.' },
    { sel: '.green3d-target', t: '조준한 인형과 확률을 봐요',
      d: '집게 아래에 걸린 인형 이름과 이번 판 확률이 여기 뜹니다. 아무것도 없으면 빈손으로 올라와요.' },
    { sel: '.green3d-views', t: '시점을 바꿔 가며 맞춰요',
      d: '위에서 보면 앞뒤 위치가, 정면에서 보면 좌우 위치가 잘 보여요.' },
    { sel: '#drop3d', t: '드롭은 한 판에 한 번이에요',
      d: '자리를 잡았으면 드롭을 누르세요. 시간이 끝나면 그 자리에서 저절로 내려갑니다.' },
  ];

  play.coaching = true;
  const { node, close } = Overlay.open(`<div class="coach">
    <div class="hole coach-3d"></div>
    <div class="bubble">
      <div class="step"></div><div class="t"></div><div class="d"></div>
      <div class="ft">
        <div class="dots"></div>
        <button class="skip" data-act="skip">건너뛰기</button>
        <button class="next" data-act="next">다음</button>
      </div>
    </div>
  </div>`, null, { persistent: true });

  $('.scrim', node).style.background = 'transparent';
  const hole = $('.coach-3d', node), bubble = $('.bubble', node);
  let i = 0;

  /* 구멍과 말풍선 자리는 실제 요소를 재서 넣는다 — 조작대 높이가 기기마다 달라
     CSS 로 박아 두면 어긋난다. 말풍선은 강조한 자리를 가리지 않는 쪽에 붙인다. */
  const place = () => {
    const el = document.querySelector(steps[i].sel), shell = shellEl().getBoundingClientRect();
    if (!el) { hole.style.display = 'none'; return; }
    hole.style.display = '';
    const r = el.getBoundingClientRect();
    Object.assign(hole.style, {
      left: (r.left - shell.left - 6) + 'px', top: (r.top - shell.top - 6) + 'px',
      width: (r.width + 12) + 'px', height: (r.height + 12) + 'px',
    });
    const above = r.top - shell.top > shell.height * 0.5;
    const w = Math.min(250, shell.width - 32);
    bubble.style.width = w + 'px';
    bubble.style.left = Math.max(16, Math.min(
      r.left - shell.left + r.width / 2 - w / 2, shell.width - w - 16)) + 'px';
    bubble.style.top = above ? '' : (r.bottom - shell.top + 14) + 'px';
    bubble.style.bottom = above ? (shell.bottom - r.top + 14) + 'px' : '';
  };

  const paint = () => {
    $('.step', node).textContent = `STEP ${i + 1} / ${steps.length}`;
    $('.t', node).textContent = steps[i].t;
    $('.d', node).textContent = steps[i].d;
    $('.dots', node).innerHTML = steps.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('');
    $('.next', node).textContent = i === steps.length - 1 ? '시작' : '다음';
    place();
  };

  const done = () => {
    play.coaching = false;
    Store.state.coach3dDone = true; Store.save();
    window.removeEventListener('resize', place);
    close();
  };

  window.addEventListener('resize', place);
  bind(node, {
    skip: done,
    next: () => { if (i === steps.length - 1) done(); else { i++; paint(); } },
  });
  paint();
}
