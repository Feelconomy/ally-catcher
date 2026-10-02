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
    import('./play3d.js?v=216').catch(() => { warmed = false; });
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
function green3DError(kind, detail) {
  const [title, body] = GREEN3D_ERRORS[kind] || GREEN3D_ERRORS.server;
  return `<div class="green3d-loading l3 l3-err" role="alert">
    ${friendIcon('olly', 92, 'peek')}
    <strong>${title}</strong>
    <p>${esc(body)}</p>
    ${detail ? `<code class="l3-why">${esc(detail)}</code>` : ''}
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
    const { Play3D } = await import('./play3d.js?v=216');
    if (request !== green3DRequest || App.route !== 'play') return;
    window.Play3D = Play3D;
    await Play3D.start(machine);
  } catch (error) {
    if (request !== green3DRequest || App.route !== 'play') return;
    window.Play3D?.stop();
    console.error('3D cabinet:', error);
    /* 무엇 때문에 실패했는지 화면에도 남긴다 — 로그를 못 보는 상황에서
       '다시 시도'만 반복하지 않도록. */
    const why = String(error && (error.message || error)).slice(0, 120);
    screenEl().innerHTML = green3DError(
      location.protocol === 'file:' ? 'local' : navigator.onLine ? 'server' : 'offline', why);
    document.getElementById('retry3d').onclick = () => startGreen3D(machine);
    document.getElementById('fallback2d').onclick = () => {
      Store.state.settings.skin = 'arcade'; Store.save(); Play.start(machine, 'arcade');
    };
  }
}
