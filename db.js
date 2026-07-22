// ══════════════════════════════════════════
// Supabase REST 클라이언트 (SDK 없이 fetch만 사용)
// 테이블: players(id, nickname, pin, tickets, total_pts, attempt_count)
//         pulls(id, player_id, doll_key, name, story, rarity, pts, created_at)
// ══════════════════════════════════════════
window.DB = (function() {
  'use strict';

  var cfg = window.CLAW_CONFIG || {};
  var URL = (cfg.SUPABASE_URL || '').replace(/\/$/, '');
  var KEY = cfg.SUPABASE_ANON_KEY || '';
  var enabled = !!(URL && KEY);

  function headers(extra) {
    var h = {
      'apikey': KEY,
      'Authorization': 'Bearer ' + KEY,
      'Content-Type': 'application/json'
    };
    if (extra) for (var k in extra) h[k] = extra[k];
    return h;
  }

  function req(method, path, body, extra) {
    return fetch(URL + '/rest/v1/' + path, {
      method: method,
      headers: headers(extra),
      body: body ? JSON.stringify(body) : undefined
    }).then(function(r) {
      if (!r.ok) return r.text().then(function(t) { throw new Error('DB ' + r.status + ': ' + t); });
      if (r.status === 204) return null;
      return r.json();
    });
  }

  // 닉네임으로 플레이어 조회 (없으면 null)
  function findByNickname(nickname) {
    return req('GET', 'players?nickname=eq.' + encodeURIComponent(nickname) + '&select=*')
      .then(function(rows) { return rows && rows.length ? rows[0] : null; });
  }

  function findById(id) {
    return req('GET', 'players?id=eq.' + encodeURIComponent(id) + '&select=*')
      .then(function(rows) { return rows && rows.length ? rows[0] : null; });
  }

  function createPlayer(nickname, pin) {
    return req('POST', 'players', {
      nickname: nickname, pin: pin,
      tickets: 5, total_pts: 0, attempt_count: 0
    }, { 'Prefer': 'return=representation' })
    .then(function(rows) { return rows[0]; });
  }

  var saveTimer = null;
  var pending = null; // { id, fields } — 아직 전송 안 된 최신 상태

  function writeNow(id, fields, useBeacon) {
    var path = 'players?id=eq.' + encodeURIComponent(id);
    // 앱 종료 순간엔 sendBeacon으로 (fetch는 취소될 수 있음)
    if (useBeacon && navigator.sendBeacon) {
      try {
        var blob = new Blob([JSON.stringify(fields)], { type: 'application/json' });
        // PATCH가 필요하지만 beacon은 POST만 → REST의 merge-duplicates로 대체
        navigator.sendBeacon(
          URL + '/rest/v1/' + path + '&apikey=' + encodeURIComponent(KEY), blob);
        return;
      } catch(e) {}
    }
    req('PATCH', path, fields, { 'Keep-Alive': 'timeout=5' })
      .catch(function(e) { console.warn('저장 실패(다음 저장 때 재시도):', e.message); });
  }

  // 상태 저장 (0.8초 디바운스 — 연타해도 마지막 상태만 전송)
  function savePlayer(id, fields) {
    pending = { id: id, fields: fields };
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function() {
      var p = pending; pending = null; saveTimer = null;
      if (p) writeNow(p.id, p.fields, false);
    }, 800);
  }

  // 즉시 전송 (뽑기 성공 직후 / 앱 종료 시 대기 중인 저장을 밀어냄)
  function flush(useBeacon) {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    if (pending) {
      var p = pending; pending = null;
      writeNow(p.id, p.fields, !!useBeacon);
    }
  }

  function addPull(playerId, pull) {
    return req('POST', 'pulls', {
      player_id: playerId,
      doll_key: pull.key, name: pull.name, story: pull.story,
      rarity: pull.rarity, pts: pull.pts
    }).catch(function(e) { console.warn('뽑기 기록 실패:', e.message); });
  }

  function getPulls(playerId) {
    return req('GET', 'pulls?player_id=eq.' + encodeURIComponent(playerId) +
      '&select=doll_key,name,story,rarity,pts,created_at&order=created_at.desc&limit=200');
  }

  // ── 로그인 세션 (기기에 기억)
  var LOGIN_KEY = 'claw_login';
  function rememberLogin(p) {
    try { localStorage.setItem(LOGIN_KEY, JSON.stringify({ id: p.id, nickname: p.nickname })); } catch(e) {}
  }
  function forgetLogin() {
    try { localStorage.removeItem(LOGIN_KEY); } catch(e) {}
  }
  function autoLogin() {
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem(LOGIN_KEY) || 'null'); } catch(e) {}
    if (!saved || !saved.id) return Promise.resolve(null);
    return findById(saved.id).catch(function() { return null; });
  }

  // 로그인 겸 가입: 닉네임 없으면 새로 만들고, 있으면 PIN 확인
  function loginOrSignup(nickname, pin) {
    return findByNickname(nickname).then(function(p) {
      if (!p) {
        return createPlayer(nickname, pin).then(function(np) {
          rememberLogin(np);
          return { player: np, isNew: true };
        });
      }
      if (String(p.pin) !== String(pin)) {
        throw new Error('PIN_MISMATCH');
      }
      rememberLogin(p);
      return { player: p, isNew: false };
    });
  }

  return {
    enabled: enabled,
    loginOrSignup: loginOrSignup,
    autoLogin: autoLogin,
    forgetLogin: forgetLogin,
    savePlayer: savePlayer,
    flush: flush,
    addPull: addPull,
    getPulls: getPulls
  };
})();
