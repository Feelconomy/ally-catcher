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
    import('./play3d.js?v=198').catch(() => { warmed = false; });
    for (const f of ['higgsfield-meadow-detailed.glb', 'mint-machine.glb'])
      fetch('assets/3d/' + f, { priority: 'low' }).catch(() => {});
  });
}
/* 3D 를 받는 동안 보여줄 짧은 이야기: 올리 실루엣이 깡충깡충 뛰어와 인형통 위로
   쏙 들어가고, 아래 문구가 무작위로 바뀐다. 타이머는 화면이 사라지면 스스로 멈춘다. */
const LOADING_TIPS = [
  '올리가 인형통에 들어가는 중이에요',
  '인형들이 줄 서서 입장하고 있어요',
  '집게를 반짝반짝 닦고 있어요',
  '폭신한 인형을 차곡차곡 쌓는 중이에요',
  '오늘의 행운을 살짝 뿌리는 중이에요',
];
let tipTimer = 0;
function cycleLoadingTip() {
  const el = document.getElementById('loading3dTip');
  if (!el) { clearInterval(tipTimer); tipTimer = 0; return; }
  const rest = LOADING_TIPS.filter(t => t !== el.textContent);
  el.classList.add('out');
  setTimeout(() => { el.textContent = rest[Math.floor(Math.random() * rest.length)]; el.classList.remove('out'); }, 260);
}
function green3DLoading() {
  if (!tipTimer) tipTimer = setInterval(cycleLoadingTip, 2600);
  const olly = '<ellipse cx="-6" cy="-3.5" rx="6" ry="3.8"/><ellipse cx="6" cy="-3.5" rx="6" ry="3.8"/><path d="M-11-5C-15-15-14-29-6-34C-2-36 2-36 6-34C14-29 15-15 11-5Z"/><ellipse cx="0" cy="-35.5" rx="3.6" ry="3.2"/><ellipse cx="-14" cy="-21" rx="3.4" ry="6.2" transform="rotate(-28 -14 -21)"/><ellipse cx="14" cy="-21" rx="3.4" ry="6.2" transform="rotate(28 14 -21)"/><circle class="l3-eye" cx="-4.6" cy="-24" r="2.1"/><circle class="l3-eye" cx="4.6" cy="-24" r="2.1"/>';
  return `<div class="green3d-loading l3" id="loading3d" role="status" aria-live="polite">
    <svg class="l3-scene" viewBox="0 -34 200 214" aria-hidden="true">
      <ellipse class="l3-ground" cx="104" cy="172" rx="92" ry="6"/>
      <g class="l3-pile"><circle cx="112" cy="112" r="10"/><circle cx="130" cy="114" r="9"/><circle cx="148" cy="111" r="10"/><circle cx="121" cy="104" r="8"/><circle cx="141" cy="102" r="8"/></g>
      <g class="l3-olly">${olly}</g>
      <g class="l3-claw"><line x1="114" y1="46" x2="114" y2="62"/><path d="M106 70l2-6h12l2 6M108 64l-4 10M120 64l4 10"/></g>
      <path class="l3-cab" fill-rule="evenodd" d="M104 22h56a12 12 0 0 1 12 12v126a8 8 0 0 1-8 8H100a8 8 0 0 1-8-8V34a12 12 0 0 1 12-12ZM100 48v70h64V48Z"/>
      <rect class="l3-glass" x="100" y="48" width="64" height="70"/>
      <path class="l3-shine" d="M106 54l10 0-14 22v-14Z"/>
      <circle class="l3-bulb" cx="116" cy="35" r="3"/><circle class="l3-bulb" cx="132" cy="35" r="3"/><circle class="l3-bulb" cx="148" cy="35" r="3"/>
      <rect class="l3-chute" x="104" y="134" width="22" height="22" rx="5"/>
      <circle class="l3-btn" cx="150" cy="142" r="6"/>
    </svg>
    <p class="l3-tip"><span id="loading3dTip">${LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)]}</span><i></i><i></i><i></i></p>
    <div class="l3-bar"><i id="loading3dBar"></i></div>
    <span class="l3-sub" id="loading3dText">3D 화면을 불러오고 있어요</span>
  </div>`;
}
async function startGreen3D(machine) {
  const request = ++green3DRequest;
  Play.stop();
  window.Play3D?.stop();
  Play.machine = machine;
  Play.skinId = 'arcade';
  setTheme('arcade');
  screenEl().innerHTML = green3DLoading();
  try {
    if (location.protocol === 'file:') throw new Error('LOCAL_SERVER_REQUIRED');
    const { Play3D } = await import('./play3d.js?v=198');
    if (request !== green3DRequest || App.route !== 'play') return;
    window.Play3D = Play3D;
    await Play3D.start(machine);
  } catch (error) {
    if (request !== green3DRequest || App.route !== 'play') return;
    window.Play3D?.stop();
    console.error('3D cabinet:', error);
    screenEl().innerHTML = `<div class="green3d-loading">
      <p>${location.protocol === 'file:' ? '3D 모드는 로컬 서버에서 열어주세요.'
        : navigator.onLine ? '3D 인형통을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.'
        : '인터넷 연결이 끊겨서 3D 인형통을 못 받았어요.'}</p>
      <button class="btn btn--primary" id="retry3d">다시 시도</button>
      <button class="btn btn--neutral" id="fallback2d">기본 모드로 계속</button>
    </div>`;
    document.getElementById('retry3d').onclick = () => startGreen3D(machine);
    document.getElementById('fallback2d').onclick = () => {
      Store.state.settings.skin = 'arcade'; Store.save(); Play.start(machine, 'arcade');
    };
  }
}
