/* Keep module loading outside the legacy router and preserve result-screen context. */
let green3DRequest = 0;
async function startGreen3D(machine) {
  const request = ++green3DRequest;
  Play.stop();
  window.Play3D?.stop();
  Play.machine = machine;
  Play.skinId = 'arcade';
  setTheme('arcade');
  screenEl().innerHTML = `<div class="green3d-loading" role="status">인형통 준비 중…</div>`;
  try {
    if (location.protocol === 'file:') throw new Error('LOCAL_SERVER_REQUIRED');
    const { Play3D } = await import('./play3d.js?v=119');
    if (request !== green3DRequest || App.route !== 'play') return;
    window.Play3D = Play3D;
    await Play3D.start(machine);
  } catch (error) {
    if (request !== green3DRequest || App.route !== 'play') return;
    window.Play3D?.stop();
    console.error('3D cabinet:', error);
    screenEl().innerHTML = `<div class="green3d-loading">
      <p>${location.protocol === 'file:' ? '3D 모드는 로컬 서버에서 열어주세요.' : '3D 인형통을 불러오지 못했어요.'}</p>
      <button class="btn btn--primary" id="retry3d">다시 시도</button>
      <button class="btn btn--neutral" id="fallback2d">기본 모드로 계속</button>
    </div>`;
    document.getElementById('retry3d').onclick = () => startGreen3D(machine);
    document.getElementById('fallback2d').onclick = () => {
      Store.state.settings.skin = 'classic'; Store.save(); Play.start(machine);
    };
  }
}
