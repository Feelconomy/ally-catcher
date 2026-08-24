/* ══════════════════════════════════════════════════════════════════
   카카오 로그인 (Supabase Auth · SDK)
   - 정적 호스팅이라 토큰 교환은 Supabase가 대신 처리 (signInWithOAuth 리다이렉트)
   - 로그인 성공 시 Store.account를 채우고 홈으로 이동, Sync가 인증 계정으로 데이터 연결
   - config.js 비어 있으면 Auth.enabled=false → 기존 익명 흐름 그대로
   ══════════════════════════════════════════════════════════════════ */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// 부팅 조율용: sync.js가 이 Promise를 기다린 뒤 hydrate 한다.
let markReady;
window.__authReady = new Promise((r) => { markReady = r; });

const cfg = window.CLAW_CONFIG || {};
const sb = (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY)
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
    })
  : null;

const Auth = {
  client: sb,
  enabled: !!sb,
  user: null,

  nickname() {
    const u = this.user;
    if (!u) return null;
    const m = u.user_metadata || {};
    return m.name || m.nickname || m.full_name || m.user_name
      || (u.email ? u.email.split('@')[0] : '카카오회원');
  },

  loginKakao() {
    if (!sb) return Promise.resolve();
    // 로그인 후 돌아올 주소 (현재 페이지). GitHub Pages·localhost 모두 동작.
    // 요청 스코프(닉네임/프로필/이메일)는 Supabase 기본값을 따르며,
    // 카카오 개발자콘솔의 '동의항목'에 등록돼 있어야 KOE205가 안 난다.
    const redirectTo = location.origin + location.pathname;
    return sb.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo } });
  },

  async logout() {
    if (!sb) return;
    try { await sb.auth.signOut(); } catch (_) {}
    this.user = null;
  },
};
window.Auth = Auth;

// 세션이 있으면 계정을 채우고, 로그인·스플래시 화면이면 홈으로 보낸다.
// (계정으로의 데이터 연결은 sync.js 의 부팅 hydrate 가 __authReady 후 담당 — 여기선 라우팅만)
function applySession(session) {
  Auth.user = session ? session.user : null;
  // Store 는 const 전역이라 window.Store 로는 안 잡힘 → bare 로 확인
  if (!Auth.user || typeof Store === 'undefined' || !Store.state) return;
  const prev = Store.state.account;
  Store.state.account = {
    provider: '카카오',
    nickname: Auth.nickname() || (prev && prev.nickname) || '카카오회원',
    avatar: (prev && prev.avatar) || 'cat',
  };
  Store.state.onboarded = true;
  Store.save();
  const curRoute = (typeof App !== 'undefined') ? App.route : null;
  if (typeof go === 'function' && ['login', 'splash', null, undefined].includes(curRoute)) {
    go('home');
  }
}

async function boot() {
  if (!sb) { markReady(); window.dispatchEvent(new Event('auth-ready')); return; }
  try {
    // 리다이렉트로 돌아온 경우 detectSessionInUrl 이 URL을 처리한 뒤 세션을 준다.
    const { data } = await sb.auth.getSession();
    applySession(data.session || null);
  } catch (e) {
    console.warn('auth getSession 실패:', e && e.message);
  }
  // OAuth 흔적(code/error) 제거 — 새로고침 시 '사용된 code' 재교환으로 꼬이는 것 방지
  if (/[?&](code|error|error_description)=/.test(location.search)) {
    history.replaceState(null, '', location.origin + location.pathname + location.hash);
  }
  // 로그인/로그아웃 상태 변화 반영
  sb.auth.onAuthStateChange((_evt, session) => { applySession(session); });
  markReady();
  window.dispatchEvent(new Event('auth-ready'));
}

boot();
