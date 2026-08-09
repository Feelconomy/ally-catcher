/* Router and boot. Routes are hash-based so back/forward work in the browser
   and the whole thing still runs off `file://` or any static host. */

const App = {
  route: null,
  arg: null,
  homeFilter: '전체',
  storageFilter: 'all',
  entryFilter: 'all',
  searchTerm: '',
  searchDebounce: null,
  pendingProvider: null,
  guest: false,
  adTimer: null,

  /** Routes that need an account before they will render. */
  guarded: ['play', 'loading', 'mission', 'exchange', 'entries', 'nh-link', 'settings', 'notif'],
};

function go(route, arg) {
  const next = arg ? `${route}/${encodeURIComponent(arg)}` : route;
  if (location.hash.slice(1) === next) render(route, arg);
  else location.hash = next;
}

function render(route, arg) {
  // Leaving the machine tears down its timers and key handlers.
  if (App.route === 'play' && route !== 'play') Play.stop();
  if (App.adTimer) { clearInterval(App.adTimer); App.adTimer = null; }
  Overlay.closeAll();
  shellEl().style.background = '';

  if (!Screens[route] && route !== 'play') route = 'home';

  if (App.guarded.includes(route) && !Store.state.account && !App.guest) {
    route = 'login'; arg = null;
  }

  App.route = route;
  App.arg = arg;
  Screens[route](arg);
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
