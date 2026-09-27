/* Keep module loading outside the legacy router and preserve result-screen context. */
let green3DRequest = 0;
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
    const { Play3D } = await import('./play3d.js?v=150');
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
      Store.state.settings.skin = 'classic'; Store.save(); Play.start(machine);
    };
  }
}
