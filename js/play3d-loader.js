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
    import('./play3d.js?v=170').catch(() => { warmed = false; });
    for (const f of ['higgsfield-meadow-detailed.glb', 'mint-machine.glb'])
      fetch('assets/3d/' + f, { priority: 'low' }).catch(() => {});
  });
}
function green3DLoading() {
  return `<div class="green3d-loading" id="loading3d" role="status" aria-live="polite"><img src="assets/logo.png" alt="" width="72" height="72"><span class="green3d-spinner" aria-hidden="true"></span><strong>인형통 준비 중</strong><span id="loading3dText">3D 화면을 불러오고 있어요</span></div>`;
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
    const { Play3D } = await import('./play3d.js?v=170');
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
