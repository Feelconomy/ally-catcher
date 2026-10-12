/* Router and boot. Routes are hash-based so back/forward work in the browser
   and the whole thing still runs off `file://` or any static host. */

const App = {
  route: null,
  arg: null,
  homeFilter: '전체',
  adminTab: 'dolls',
  storageFilter: 'all',
  entryFilter: 'all',
  searchTerm: '',
  searchDebounce: null,
  pendingProvider: null,
  guest: false,
  adTimer: null,
  adPlayer: null,
  heroTimer: null,
  splashTimers: null,
  levelUpTo: 0,
  lastAttempt: null,   // { dollId, accuracy, kind } from the last drop
  pendingRoute: null,  // 인증 확정을 기다리는 동안 보류한 목적지 { route, arg }

  /** Routes that need an account before they will render. */
  guarded: ['play', 'loading', 'mission', 'exchange', 'entries', 'nh-link', 'settings', 'notif'],
};

/* 카카오 세션 복원은 비동기라, 로그인 직후 새로고침된 화면에서는 account 가
   잠깐 비어 있다. 이 창에서 guarded 라우트로 가면 로그인 화면이 깜빡이므로,
   인증이 확정될 때까지(__authReady) 목적지를 보류했다가 다시 시도한다. */
function resolvePendingRoute() {
  const p = App.pendingRoute;
  App.pendingRoute = null;
  if (p) render(p.route, p.arg);   // 이번엔 account/guest 가 확정된 상태로 가드를 탄다
}

function go(route, arg) {
  const next = arg ? `${route}/${encodeURIComponent(arg)}` : route;
  if (location.hash.slice(1) === next) render(route, arg);
  else location.hash = next;
}

function render(route, arg) {
  // Leaving the machine tears down its timers and key handlers.
  if (App.route === 'play' && route !== 'play') { Play.stop(); window.Play3D?.stop(); }
  if (App.adTimer) { clearInterval(App.adTimer); App.adTimer = null; }
  if (App.adPlayer) { try { App.adPlayer.destroy(); } catch (_) {} App.adPlayer = null; }
  if (App.heroTimer) { clearInterval(App.heroTimer); App.heroTimer = null; }
  if (App.splashTimers) { App.splashTimers.forEach(clearInterval); App.splashTimers = null; }
  Overlay.closeAll();
  shellEl().style.background = '';

  // 뽑기 직후 보관함 상단에 '방금 뽑음 · 한 번 더' 바를 띄우는 플래그.
  // 보관함을 벗어나면(한 번 더/홈 등) 지워 다음 방문 때 재노출되지 않게 한다.
  if (route !== 'storage') App.justWon = null;

  if (!Screens[route] && route !== 'play') route = 'home';

  if (App.guarded.includes(route) && !Store.state.account && !Store.state.guest) {
    if (window.Auth && Auth.enabled && !Auth.ready) {
      // 인증 아직 확정 전 — 로그인으로 튕기지 말고 스플래시로 대기 후 원래 목적지로.
      App.pendingRoute = { route, arg };
      (window.__authReady || Promise.resolve()).then(resolvePendingRoute);
      route = 'splash'; arg = null;
    } else {
      route = 'login'; arg = null;
    }
  }

  App.route = route;
  App.arg = arg;
  Screens[route](arg);
  // 3D 로 놀 사람에게는 무거운 배경을 미리 받아 둔다 (한가할 때 한 번만)
  if ((route === 'home' || route === 'machine') && availablePlayMode(Store.state.settings.skin || Store.state.admin.skin) === 'green3d') warmGreen3D();
  screenEl().scrollTop = 0;
}

function readHash() {
  const raw = location.hash.slice(1);
  if (!raw) return { route: null, arg: null };
  const i = raw.indexOf('/');
  return i < 0
    ? { route: raw, arg: null }
    : { route: raw.slice(0, i), arg: decodeURIComponent(raw.slice(i + 1)) };
}

window.addEventListener('hashchange', () => {
  const { route, arg } = readHash();
  render(route || 'home', arg);
});

window.addEventListener('offline', () => {
  if (['play', 'loading'].includes(App.route)) return;   // play has its own handling
  toast('오프라인 상태예요', { tone: 'error', action: '확인', onAction: () => go('offline') });
});

window.addEventListener('online', () => toast('다시 연결됐어요', { tone: 'ok' }));

document.addEventListener('DOMContentLoaded', () => {
  Store.load();

  const { route, arg } = readHash();
  if (route) { render(route, arg); return; }

  if (!Store.state.account && !Store.state.onboarded) go('splash');
  else if (!Store.state.onboarded) go('onboarding');
  else go('home');
});
