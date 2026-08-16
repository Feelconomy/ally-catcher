/* ══════════════════════════════════════════════════════════════════
   Supabase 동기화 (SDK 없이 fetch만)
   - 식별: 익명 기기 ID(localStorage). 로그인은 나중에 nickname으로 연결.
   - 저장 범위: 티켓 · 포인트 · 인형(prizes)  ← store.js 의 save()/addPrize()/tradeDuplicate() 에서 호출
   - config.js 가 비어 있으면 Sync.enabled=false → 원본 로컬 모드 그대로
   ══════════════════════════════════════════════════════════════════ */
const Sync = (function () {
  const cfg = window.CLAW_CONFIG || {};
  const URL = (cfg.SUPABASE_URL || '').replace(/\/$/, '');
  const KEY = cfg.SUPABASE_ANON_KEY || '';
  const enabled = !!(URL && KEY);

  const DEVICE_KEY = 'ppopgiwang.device';
  let deviceId = null;
  let playerId = null;
  let suspended = false;   // hydrate 중 서버 되쓰기(피드백 루프) 방지

  function getDeviceId() {
    if (deviceId) return deviceId;
    try { deviceId = localStorage.getItem(DEVICE_KEY); } catch (_) {}
    if (!deviceId) {
      deviceId = (window.crypto && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'dev-' + Date.now() + '-' + Math.random().toString(16).slice(2);
      try { localStorage.setItem(DEVICE_KEY, deviceId); } catch (_) {}
    }
    return deviceId;
  }

  function headers(extra) {
    const h = {
      apikey: KEY,
      Authorization: 'Bearer ' + KEY,
      'Content-Type': 'application/json',
    };
    if (extra) Object.assign(h, extra);
    return h;
  }

  function req(method, path, body, extra, opts) {
    const init = { method, headers: headers(extra) };
    if (body !== undefined) init.body = JSON.stringify(body);
    if (opts && opts.keepalive) init.keepalive = true;
    return fetch(URL + '/rest/v1/' + path, init).then((r) => {
      if (!r.ok) return r.text().then((t) => { throw new Error('DB ' + r.status + ': ' + t); });
      if (r.status === 204) return null;
      return r.json();
    });
  }

  // ── 플레이어 저장 (티켓·포인트) ──────────────────────────────────────
  // 직렬화: 한 번에 하나의 PATCH만 날려 순서 뒤바뀜(늦게 온 옛 값이 덮는) 방지.
  // 항상 Store의 '현재' 값을 읽어 보내므로, 밀린 호출은 최신 상태로 수렴한다.
  let writing = false;
  let dirty = false;

  function doWrite(keepalive) {
    const body = { tickets: Store.state.tickets | 0, points: Store.state.points | 0 };
    return req('PATCH', 'players?device_id=eq.' + encodeURIComponent(getDeviceId()),
      body, null, { keepalive: !!keepalive })
      .catch((e) => console.warn('플레이어 저장 실패:', e.message));
  }

  function savePlayer() {
    if (!enabled || !playerId) return;
    if (writing) { dirty = true; return; }   // 진행 중이면 끝나고 한 번 더
    writing = true;
    doWrite(false).then(() => {
      writing = false;
      if (dirty) { dirty = false; savePlayer(); } // 마지막 상태를 반드시 반영
    });
  }

  // 종료/백그라운드 시: 최신 상태를 즉시(keepalive) 저장. PATCH는 절대값이라 중복 무해.
  function flush(keepalive) {
    if (!enabled || !playerId) return;
    doWrite(!!keepalive);
  }

  // ── 인형(prizes) ────────────────────────────────────────────────────
  function recordPrize(dollId) {
    if (!enabled || !playerId) return;
    req('POST', 'prizes', { player_id: playerId, doll_id: dollId })
      .catch((e) => console.warn('인형 저장 실패:', e.message));
    savePlayer();          // 승리 직후 티켓/포인트도 즉시 반영 (앱 닫아도 안전)
  }

  // 중복 교환 등으로 목록이 바뀌면 서버 prizes 를 로컬과 일치시킴 (드묾)
  function reconcilePrizes() {
    if (!enabled || !playerId) return Promise.resolve();
    return req('DELETE', 'prizes?player_id=eq.' + encodeURIComponent(playerId))
      .then(() => {
        const rows = Store.state.prizes.map((p) => ({ player_id: playerId, doll_id: p.dollId }));
        if (!rows.length) return null;
        return req('POST', 'prizes', rows);
      })
      .then(() => savePlayer())
      .catch((e) => console.warn('인형 목록 동기화 실패:', e.message));
  }

  // ── 로그인 시(=지금은 부팅 시) 서버에서 불러오기 ────────────────────
  function hydrate() {
    if (!enabled) return Promise.resolve('disabled');
    const dev = getDeviceId();
    return req('GET', 'players?device_id=eq.' + encodeURIComponent(dev) + '&select=*')
      .then((rows) => {
        if (rows && rows.length) {
          // 기존 기기: 서버가 원본. 로컬 상태를 서버 값으로 채움.
          const p = rows[0];
          playerId = p.id;
          return req('GET', 'prizes?player_id=eq.' + encodeURIComponent(playerId) +
            '&select=doll_id,won_at&order=won_at.asc&limit=1000')
            .then((prizes) => {
              suspended = true;
              Store.state.tickets = p.tickets | 0;
              Store.state.points = p.points | 0;
              Store.state.prizes = (prizes || []).map((r) => ({
                dollId: r.doll_id, at: Date.parse(r.won_at) || Date.now(),
              }));
              Store.save();          // 로컬에도 반영(서버 push는 suspended로 스킵)
              suspended = false;
              return 'existing';
            });
        }
        // 새 기기: 현재 로컬 상태로 행 생성 (기존 로컬 진행분이 있으면 업로드)
        const acc = Store.state.account;
        return req('POST', 'players', {
          device_id: dev,
          nickname: acc ? acc.nickname : null,
          tickets: Store.state.tickets | 0,
          points: Store.state.points | 0,
        }, { Prefer: 'return=representation' }).then((created) => {
          playerId = created[0].id;
          return Store.state.prizes.length ? reconcilePrizes().then(() => 'created') : 'created';
        });
      });
  }

  // 회원 탈퇴/초기화: 서버 행 삭제 + 새 기기 ID 발급
  function wipe() {
    if (!enabled) return Promise.resolve();
    // 저장 큐를 비운다. 진행 중인 PATCH가 있어도 아래에서 playerId를 지우므로
    // savePlayer()가 조기 반환하고, dirty를 내려 재시도도 막는다.
    dirty = false;
    const dev = deviceId;
    const done = () => {
      playerId = null; deviceId = null;
      try { localStorage.removeItem(DEVICE_KEY); } catch (_) {}
    };
    if (!dev) { done(); return Promise.resolve(); }
    return req('DELETE', 'players?device_id=eq.' + encodeURIComponent(dev))
      .catch((e) => console.warn('서버 초기화 실패:', e.message))
      .then(done);
  }

  // 앱 종료/백그라운드 시 대기 중인 저장 밀어내기
  if (enabled) {
    window.addEventListener('pagehide', () => flush(true));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush(true);
    });
  }

  return {
    enabled,
    get suspended() { return suspended; },
    hydrate, savePlayer, recordPrize, reconcilePrizes, flush, wipe,
  };
})();

// const 전역은 window 프로퍼티가 안 되므로 명시적으로 노출
// (store.js 등에서 window.Sync 가드로 참조)
window.Sync = Sync;

// 부팅: app.js 의 초기 렌더가 끝난 뒤(스크립트 순서상 이 리스너가 나중에 실행됨)
// 서버 데이터를 불러와 화면을 갱신한다.
document.addEventListener('DOMContentLoaded', () => {
  if (!Sync.enabled) return;
  Sync.hydrate().then((res) => {
    if (res !== 'existing') return;
    const refreshable = ['home', 'storage', 'mine', 'codex', 'exchange', 'mission'];
    if (typeof render === 'function' && refreshable.includes(App.route)) {
      render(App.route, App.arg);
    }
  }).catch((e) => console.warn('sync hydrate 실패:', e.message));
});
