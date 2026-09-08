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
  let authUserId = null;   // 카카오 로그인 시 Supabase Auth 사용자 id
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
    // 행 id로 저장 → 로그인 후 다른 기기에서도(다른 device_id) 같은 계정 행을 정확히 갱신
    const body = { tickets: Store.state.tickets | 0, points: Store.state.points | 0 };
    return req('PATCH', 'players?id=eq.' + encodeURIComponent(playerId),
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

  // 서버 행 하나를 로컬 상태로 채움 (인형 목록 포함)
  function applyRow(p) {
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
        Store.prune();           // 서버에 없는 인형(관리자가 지운 것)이 섞여 오면 턴다
        Store.save();            // 로컬에도 반영(서버 push는 suspended로 스킵)
        suspended = false;
        return 'existing';
      });
  }

  // 현재 로컬 상태로 새 행 생성 (extra로 auth_user_id 등 추가)
  function createRow(extra) {
    const acc = Store.state.account;
    const body = Object.assign({
      device_id: getDeviceId(),
      nickname: acc ? acc.nickname : null,
      tickets: Store.state.tickets | 0,
      points: Store.state.points | 0,
    }, extra || {});
    return req('POST', 'players', body, { Prefer: 'return=representation' })
      .then((created) => {
        playerId = created[0].id;
        return (Store.state.prizes.length ? reconcilePrizes() : Promise.resolve()).then(() => 'created');
      });
  }

  // ── 관리자 카탈로그 (인형 · 기계) ───────────────────────────────────
  // 플레이어별이 아니라 서비스 전체가 공유하는 한 줄. 편집이 드물어 통째로
  // 주고받고, 마지막에 저장한 쪽이 이긴다. 테이블은 supabase/catalog.sql 참고.
  const CATALOG_ID = 'admin';

  function loadCatalog() {
    if (!enabled) return Promise.resolve(false);
    return req('GET', 'catalog?id=eq.' + CATALOG_ID + '&select=data')
      .then((rows) => {
        if (!rows || !rows.length || !rows[0].data) return false;
        Store.state.admin = Object.assign(
          { dolls: {}, machines: {}, custom: {} }, rows[0].data);
        Store.applyAdmin();          // 카탈로그를 덮어쓰고 없는 인형은 정리
        suspended = true; Store.save(); suspended = false;
        return true;
      })
      .catch((e) => { console.warn('카탈로그 불러오기 실패:', e.message); return false; });
  }

  /** 성공 여부를 돌려준다 — 테이블이 없으면(catalog.sql 미실행) false. */
  function saveCatalog() {
    if (!enabled) return Promise.resolve(false);
    return req('POST', 'catalog',
      { id: CATALOG_ID, data: Store.state.admin, updated_at: new Date().toISOString() },
      { Prefer: 'resolution=merge-duplicates' })
      .then(() => true)
      .catch((e) => { console.warn('카탈로그 저장 실패:', e.message); return false; });
  }

  // ── 부팅/로그인 시 서버에서 불러오기 ────────────────────────────────
  function hydrate() {
    if (!enabled) return Promise.resolve('disabled');
    const dev = getDeviceId();
    authUserId = (window.Auth && Auth.user) ? Auth.user.id : null;

    if (authUserId) {
      // 로그인 상태: 인증 계정의 행을 우선 조회
      return req('GET', 'players?auth_user_id=eq.' + encodeURIComponent(authUserId) + '&select=*')
        .then((rows) => {
          if (rows && rows.length) return applyRow(rows[0]);
          // 계정 행이 없으면: 이 기기의 익명 행을 계정으로 승계, 없으면 새로 생성
          return req('GET', 'players?device_id=eq.' + encodeURIComponent(dev) + '&select=*')
            .then((drows) => {
              if (drows && drows.length) {
                playerId = drows[0].id;
                const nick = (window.Auth && Auth.nickname && Auth.nickname()) || drows[0].nickname;
                return req('PATCH', 'players?id=eq.' + encodeURIComponent(playerId),
                  { auth_user_id: authUserId, nickname: nick })
                  .then(() => applyRow(drows[0]));
              }
              return createRow({ auth_user_id: authUserId });
            });
        });
    }

    // 비로그인(익명): 기기 행 조회 → 없으면 생성
    return req('GET', 'players?device_id=eq.' + encodeURIComponent(dev) + '&select=*')
      .then((rows) => (rows && rows.length) ? applyRow(rows[0]) : createRow({}));
  }

  // 회원 탈퇴/초기화: 서버 행 삭제 + 새 기기 ID 발급
  function wipe() {
    if (!enabled) return Promise.resolve();
    // 저장 큐를 비운다. 진행 중인 PATCH가 있어도 아래에서 playerId를 지우므로
    // savePlayer()가 조기 반환하고, dirty를 내려 재시도도 막는다.
    dirty = false;
    const pid = playerId, dev = deviceId;
    const done = () => {
      playerId = null; deviceId = null; authUserId = null;
      try { localStorage.removeItem(DEVICE_KEY); } catch (_) {}
    };
    const target = pid ? 'players?id=eq.' + encodeURIComponent(pid)
      : (dev ? 'players?device_id=eq.' + encodeURIComponent(dev) : null);
    if (!target) { done(); return Promise.resolve(); }
    return req('DELETE', target)
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
    loadCatalog, saveCatalog,
  };
})();

// const 전역은 window 프로퍼티가 안 되므로 명시적으로 노출
// (store.js 등에서 window.Sync 가드로 참조)
window.Sync = Sync;

// 부팅: app.js 의 초기 렌더가 끝난 뒤(스크립트 순서상 이 리스너가 나중에 실행됨)
// 서버 데이터를 불러와 화면을 갱신한다.
document.addEventListener('DOMContentLoaded', () => {
  if (!Sync.enabled) return;
  // 로그인 상태를 알아야 계정 기준으로 불러오므로 auth 준비를 기다린다.
  const ready = window.__authReady || Promise.resolve();
  ready.then(() => Promise.all([Sync.loadCatalog(), Sync.hydrate()])).then(([cat, res]) => {
    if (!cat && res !== 'existing') return;
    // 카탈로그가 바뀌었으면 인형 이름·기계 구성이 달라졌을 수 있어 어느 화면이든
    // 다시 그린다. 진행 중인 판만은 건드리지 않는다.
    const refreshable = ['home', 'storage', 'mine', 'codex', 'exchange', 'mission'];
    if (typeof render === 'function' && App.route !== 'play' &&
        (cat || refreshable.includes(App.route))) {
      render(App.route, App.arg);
    }
  }).catch((e) => console.warn('sync hydrate 실패:', e.message));
});
