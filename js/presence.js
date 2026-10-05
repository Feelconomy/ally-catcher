/* ══════════════════════════════════════════════════════════════════
   지금 몇 명이 들어와 있나 (Supabase Realtime Presence)

   테이블을 쓰지 않는다. 앱이 켜지면 'online' 채널에 자기 기기를 올리고,
   탭을 닫거나 인터넷이 끊기면 소켓이 끊기면서 저절로 빠진다. 그래서
   heartbeat 를 찍고 '최근 1분' 을 세는 방식과 달리 쓰기 요청이 없고,
   숫자도 지연 없이 맞는다. 대신 기록이 안 남아 '어제 몇 명' 은 못 본다.

   세는 단위는 기기 하나다 — 같은 사람이 탭 두 개를 열어도 한 명.
   그래서 presence key 로 Sync 의 기기 ID 를 쓴다.

   Realtime 이 꺼져 있거나 연결이 안 되면 count 가 null 로 남는다.
   부르는 쪽은 null 을 '모름' 으로 그려야 한다 — 0 으로 그리면 아무도
   없는 것처럼 보인다.
   ══════════════════════════════════════════════════════════════════ */
const Presence = (function () {
  const CHANNEL = 'online';
  let channel = null;
  let count = null;             // null = 아직 모름 / 연결 실패
  let state = 'idle';           // idle · connecting · live · off
  const listeners = new Set();

  const notify = () => listeners.forEach(fn => { try { fn(count, state); } catch (_) {} });

  function key() {
    if (window.Sync && Sync.enabled && Sync.deviceId) return Sync.deviceId();
    try { return localStorage.getItem('ppopgiwang.device') || 'anon'; } catch (_) { return 'anon'; }
  }

  function start() {
    const sb = window.Auth && Auth.client;
    if (!sb || channel) return;
    state = 'connecting'; notify();

    channel = sb.channel(CHANNEL, { config: { presence: { key: key() } } });

    channel.on('presence', { event: 'sync' }, () => {
      count = Object.keys(channel.presenceState()).length;
      state = 'live';
      notify();
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // track 에 담은 값은 다른 참가자도 본다 — 식별되는 건 담지 않는다.
        channel.track({ at: Date.now() }).catch(() => {});
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // Realtime 이 꺼져 있거나 막혔다. 조용히 '모름' 으로 둔다.
        state = status === 'CLOSED' ? 'off' : 'off';
        count = null;
        notify();
      }
    });
  }

  function stop() {
    if (!channel) return;
    try { channel.unsubscribe(); } catch (_) {}
    channel = null; count = null; state = 'idle';
  }

  return {
    /** 지금 접속자 수. 아직 모르거나 연결이 안 됐으면 null. */
    get count() { return count; },
    get state() { return state; },

    /** 숫자가 바뀔 때마다 부른다. 해지 함수를 돌려준다. */
    watch(fn) {
      listeners.add(fn);
      fn(count, state);
      return () => listeners.delete(fn);
    },

    start, stop,
  };
})();

window.Presence = Presence;

/* 로그인 여부와 상관없이 집계한다 — auth 가 준비돼야 Supabase 클라이언트가
   있으므로 그 뒤에 붙는다. 탭을 닫으면 소켓이 끊기며 저절로 빠진다. */
window.addEventListener('auth-ready', () => Presence.start());
