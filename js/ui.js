/* Rendering helpers, chrome fragments, and the overlay layer
   (sheets, dialogs, toasts) shared by every screen. */

const $  = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

const screenEl   = () => document.getElementById('screen');
const overlayEl  = () => document.getElementById('overlays');
const shellEl    = () => document.getElementById('shell');

/** Escapes interpolated text so doll and player names can never inject markup. */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Dolls can carry per-moment artwork. A doll with an `art` map swaps image as
   it moves through a play: sitting in the bed, gripped by the claw, tumbling
   after a slip, and celebrating on the win screen. Dolls without an `art` map
   use their single SVG for every state. */
const DOLL_STATES = ['idle', 'grabbed', 'drop', 'win'];

/** Resolves the image file for `id` in `state`, falling back to idle art. */
function dollArt(id, state) {
  const d = DOLLS[id];
  if (d && d.art) return d.art[state] || d.art.idle;
  return `dolls/${id}.svg`;
}

/** `state` is one of DOLL_STATES; omit it for the resting pose. */
function dollImg(id, size, extra, state) {
  const px = size || 84;
  const src = dollArt(id, state || 'idle');
  /* 관리자 인형 화면은 img 가 90개(내려받기 15MB · 디코딩 35MB)나 되는데 그중
     절반은 화면 밖이다. 폰 사파리는 디코딩 예산을 넘기면 뒤쪽·큰 그림부터 조용히
     안 그린다 — 곰돌이 단지가 안 보이던 이유. 보이는 것만 받아 그린다. */
  return `<img src="${esc(src)}" alt="" width="${px}" height="${px}" loading="lazy" decoding="async"
    style="width:${px}px;height:${px}px;object-fit:contain${extra ? ';' + extra : ''}">`;
}

/** 프로필 대표로 쓸 수 있는 인형 id 목록 (차단 6종 제외, 실제 존재하는 것만). */
function avatarIds() {
  return DOLL_IDS.filter((id) => !BLOCKED_AVATARS.includes(id) && DOLLS[id]);
}

/** 주어진 avatar가 허용/존재하면 그대로, 아니면 안전한 기본 아바타로 보정. */
function safeAvatar(id) {
  if (id && !BLOCKED_AVATARS.includes(id) && DOLLS[id]) return id;
  const ok = avatarIds();
  return ok.includes(DEFAULT_AVATAR) ? DEFAULT_AVATAR : (ok[0] || DEFAULT_AVATAR);
}

/* 간소화한 캐릭터 실루엣. 로딩·빈 화면·축하처럼 '보여줄 것'이 있는 순간에
   그림 대신 쓴다. 모두 발바닥 가운데가 (0,0), 키는 약 40. 눈(.eye)은 뚫려 보이고,
   겹치면 묻히는 귀·코(.edge)에는 같은 색으로 얇은 테를 둘러 떼어 보이게 한다.
   lines 는 3D 로딩 화면에서 그 친구가 들어갈 때 함께 나오는 문구. */
const FRIENDS = {
  olly: { name: '올리', lines: ['올리가 인형통에 들어가는 중이에요', '올리가 집게를 반짝반짝 닦고 있어요'],
    svg: '<ellipse cx="-6" cy="-3.5" rx="6" ry="3.8"/><ellipse cx="6" cy="-3.5" rx="6" ry="3.8"/><path d="M-11-5C-15-15-14-29-6-34C-2-36 2-36 6-34C14-29 15-15 11-5Z"/><ellipse cx="0" cy="-35.5" rx="3.6" ry="3.2"/><ellipse cx="-14" cy="-21" rx="3.4" ry="6.2" transform="rotate(-28 -14 -21)"/><ellipse cx="14" cy="-21" rx="3.4" ry="6.2" transform="rotate(28 14 -21)"/><circle class="eye" cx="-4.6" cy="-24" r="2.1"/><circle class="eye" cx="4.6" cy="-24" r="2.1"/>' },
  pig: { name: '단지', lines: ['단지가 꽃핀을 고쳐 꽂고 들어가요', '단지가 폭신한 자리를 고르는 중이에요'],
    svg: '<ellipse cx="-7" cy="-3.8" rx="6.5" ry="4"/><ellipse cx="7" cy="-3.8" rx="6.5" ry="4"/><ellipse cx="-8" cy="-32" rx="4.6" ry="8" transform="rotate(-14 -8 -32)"/><ellipse cx="8" cy="-32" rx="4.6" ry="8" transform="rotate(14 8 -32)"/><circle cx="0" cy="-18" r="15.5"/><circle cx="12" cy="-31" r="3.6"/><ellipse cx="-15" cy="-11" rx="3.4" ry="5" transform="rotate(-22 -15 -11)"/><ellipse cx="15" cy="-11" rx="3.4" ry="5" transform="rotate(22 15 -11)"/><circle class="eye" cx="-5.6" cy="-21" r="2"/><circle class="eye" cx="5.6" cy="-21" r="2"/><ellipse class="eye" cx="0" cy="-15" rx="4" ry="2.6"/>' },
  woni: { name: '원이', lines: ['원이가 뒤뚱뒤뚱 입장하는 중이에요', '원이가 새싹에 물을 주고 있어요'],
    svg: '<ellipse cx="-8" cy="-2.8" rx="7" ry="3.2"/><ellipse cx="8" cy="-2.8" rx="7" ry="3.2"/><path d="M-15-4C-18-17-15-31 0-33C15-31 18-17 15-4Z"/><ellipse cx="0" cy="-36" rx="2.4" ry="4"/><ellipse cx="-3.6" cy="-34.6" rx="2.2" ry="3.4" transform="rotate(-38 -3.6 -34.6)"/><ellipse cx="3.6" cy="-34.6" rx="2.2" ry="3.4" transform="rotate(38 3.6 -34.6)"/><ellipse cx="-16" cy="-14" rx="3.4" ry="6" transform="rotate(-14 -16 -14)"/><ellipse cx="16" cy="-14" rx="3.4" ry="6" transform="rotate(14 16 -14)"/><circle class="eye" cx="-5" cy="-22" r="2.2"/><circle class="eye" cx="5" cy="-22" r="2.2"/><ellipse class="eye" cx="0" cy="-16" rx="5" ry="2.4"/>' },
  kori: { name: '코리', lines: ['코리가 서류가방을 내려놓는 중이에요', '코리가 코로 조명을 켜고 있어요'],
    svg: '<ellipse cx="-5.5" cy="-3.5" rx="4.6" ry="4"/><ellipse cx="5.5" cy="-3.5" rx="4.6" ry="4"/><path d="M-11-5C-12-12-11-18-7-21L7-21C11-18 12-12 11-5Z"/><ellipse cx="-12.5" cy="-29" rx="7" ry="8.5"/><ellipse cx="12.5" cy="-29" rx="7" ry="8.5"/><circle class="edge" cx="0" cy="-27" r="10"/><path class="edge" d="M2-24C10-24 16-29 18-37L22-35.5C19-25 11-19.5 2-20Z"/><rect x="11" y="-10" width="7" height="5.5" rx="1.2"/><circle class="eye" cx="-3.8" cy="-29" r="1.9"/><circle class="eye" cx="3.8" cy="-29" r="1.9"/>' },
  dali: { name: '달리', lines: ['달리가 꼬리 흔들며 들어가는 중이에요', '달리가 행운을 킁킁 찾고 있어요'],
    svg: '<ellipse cx="-7" cy="-3.5" rx="6.5" ry="4"/><ellipse cx="7" cy="-3.5" rx="6.5" ry="4"/><path d="M-13-5C-16-16-14-31 0-33C14-31 16-16 13-5Z"/><ellipse cx="-14" cy="-11" rx="3.4" ry="5" transform="rotate(-22 -14 -11)"/><ellipse cx="14" cy="-11" rx="3.4" ry="5" transform="rotate(22 14 -11)"/><ellipse class="edge" cx="-14.5" cy="-24" rx="5" ry="9" transform="rotate(24 -14.5 -24)"/><ellipse class="edge" cx="14.5" cy="-24" rx="5" ry="9" transform="rotate(-24 14.5 -24)"/><circle class="eye" cx="-5" cy="-23" r="2.1"/><circle class="eye" cx="5" cy="-23" r="2.1"/><ellipse class="eye" cx="0" cy="-17.5" rx="2.6" ry="1.8"/>' },
};
const FRIEND_IDS = Object.keys(FRIENDS);

/** 실루엣 하나를 담은 작은 svg. cls 로 색·애니메이션을 준다. */
function friendSvg(id, size = 40, cls = '', style = '') {
  return `<svg class="friend ${cls}" viewBox="-22 -42 44 44" width="${size}" height="${size}" style="${style}" aria-hidden="true">${(FRIENDS[id] || FRIENDS.olly).svg}</svg>`;
}

/** 다섯 친구가 차례로 깡충 뛰는 줄. 스플래시·축하·빈 화면에서 쓴다. */
function friendParade(size = 40, cls = '') {
  return `<div class="parade ${cls}">${FRIEND_IDS.map((id, k) => friendSvg(id, size, 'hop', `animation-delay:${k * .14}s`)).join('')}</div>`;
}

/** Sets the shell background tone the screen wants (cream / dark / green / yellow). */
const THEME_BG = { dark: '#141414', green: '#00A650', yellow: '#FFD400', arcade: '#EDF7F0' };

/* 폰에서는 주소창이 접혔다 펴질 때 100dvh 가 실제로 보이는 높이와 어긋나, 셸이
   화면보다 짧아지면서 아래로 앱 바깥 배경(베이지)이 비칠 때가 있다. 뒷배경까지
   화면 색으로 칠해 두면 그 틈이 보이지 않는다. 데스크톱은 셸을 폰처럼 가운데
   띄워 보여주는 화면이라 바깥을 칠하면 안 되므로 좁은 화면에서만 칠한다. */
const narrow = window.matchMedia('(max-width: 479px)');

function paintBackdrop(name) {
  // body 에 칠한다. html 에 칠하면 body 가 자기 배경(--canvas)으로 그 위를 덮어
  // 틈이 그대로 베이지로 보인다. 데스크톱에서는 인라인 값을 지워, 폰처럼 가운데
  // 띄워 보여주는 --canvas 바탕을 되돌린다.
  document.body.style.background = narrow.matches ? (THEME_BG[name] || '#FFFBEF') : '';
}

function setTheme(name) {
  shellEl().dataset.theme = name || '';
  const bg = THEME_BG[name] || '#FFFBEF';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = bg;
  paintBackdrop(name);
}

// 창 크기가 데스크톱↔모바일 경계를 넘나들면 뒷배경도 따라간다
narrow.addEventListener('change', () => paintBackdrop(shellEl().dataset.theme));

// 상단 여백 스페이서 (노치/안전영역 확보용). 가짜 시간·통신 표시는 제거함.
// offline 인자는 호출부 호환용으로 남겨둠(현재 미사용).
function statusbar(offline) {
  return `<div class="statusbar"></div>`;
}

// 공통 링크 공유: 모바일 네이티브 공유 시트 → 클립보드 복사 폴백.
// 반환: 'shared'(공유 시트로 완료) | 'copied'(클립보드 복사) | 'cancel'(사용자 취소) | 'fail'
async function shareLink(opts) {
  const o = opts || {};
  const url = o.url || (location.origin + location.pathname);
  const text = o.text || '올리캐쳐 · AI 인형뽑기';
  const title = o.title || '올리캐쳐';
  const file = o.file || null;   // 자랑카드처럼 이미지까지 함께 보낼 때

  // 1) 네이티브 공유 시트
  //   url을 '별도 필드'로 넘긴다 → 카톡은 URL을 본문 텍스트로 쓰지 않고
  //   OG 썸네일 카드만 만든다(본문엔 문구만, 링크는 카드로). 카드가 메시지 위에
  //   붙는 건 카톡 렌더링이라 제어 불가.
  if (navigator.share) {
    const withFile = file && navigator.canShare && navigator.canShare({ files: [file] });
    try {
      await navigator.share(withFile ? { files: [file], title, text, url } : { title, text, url });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancel';
      /* 그 외 실패 → 복사 폴백 */
    }
  }
  // 2) 클립보드 복사 (데스크톱 등) — 여기선 카드가 없으니 링크를 문구와 함께 담는다
  const clip = `${text}\n${url}`;
  try {
    await navigator.clipboard.writeText(clip);
    return 'copied';
  } catch (_) {}
  // 3) 구형/비보안 컨텍스트 폴백
  try {
    const ta = document.createElement('textarea');
    ta.value = clip;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (ok) return 'copied';
  } catch (_) {}
  return 'fail';
}

function appbar(title, opts) {
  const o = opts || {};
  return `<div class="appbar">
    ${o.noBack ? '' : `<button class="iconbtn ${o.ghost ? 'ghost' : ''}" data-act="back" aria-label="뒤로">${icon('chevronLeft3', 20)}</button>`}
    <span class="appbar-title" ${o.ghost ? 'style="color:#fff"' : ''}>${esc(title)}</span>
    ${o.meta ? `<span class="appbar-meta">${esc(o.meta)}</span>` : ''}
  </div>`;
}

const TABS = [
  { id: 'home',    label: '홈',     on: 'homeFill',       off: 'home' },
  { id: 'mission', label: '미션',   on: 'checkThick',     off: 'check' },
  { id: 'storage', label: '보관함', on: 'storageFill',    off: 'storage' },
  { id: 'my',      label: '마이',   on: 'faceSmileFill',  off: 'faceSmile' },
];

function tabbar(active) {
  return `<nav class="tabbar">${TABS.map(t => `
    <button class="tab" data-tab="${t.id}" ${t.id === active ? 'aria-current="page"' : ''}>
      ${icon(t.id === active ? t.on : t.off, 24)}<span>${t.label}</span>
    </button>`).join('')}</nav>`;
}

function walletChip(onDark) {
  return `<button class="wallet ${onDark ? 'onDark' : ''}" data-act="wallet" aria-label="티켓 ${Store.state.tickets}장">
    <span class="tk">${icon('ticketFill', onDark ? 18 : 20)}</span>
    <span class="n">${Store.state.tickets}</span>
    ${onDark ? '' : `<span class="plus">${icon('plusThick', 14)}</span>`}
  </button>`;
}

function meter(pct, cls) {
  return `<div class="meter ${cls || ''}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
}

function gradeBadge(grade) {
  return `<span class="badge ${GRADE_CLASS[grade]}">${grade}</span>`;
}

/* ---------------------------------------------------------------- overlays */

const Overlay = {
  stack: [],

  /** Mounts `html` above the screen. `onMount(node, close)` wires its buttons. */
  open(html, onMount, opts) {
    const o = opts || {};
    const node = document.createElement('div');
    node.className = 'overlay-layer';
    node.innerHTML = `<div class="scrim ${o.scrim || ''}"></div>${html}`;
    overlayEl().appendChild(node);
    this.stack.push(node);

    const close = () => this.close(node);
    if (!o.persistent) {
      $('.scrim', node).addEventListener('click', close);
      $$('[data-close]', node).forEach(b => b.addEventListener('click', close));
    }
    if (onMount) onMount(node, close);
    return { node, close };
  },

  close(node) {
    const target = node || this.stack[this.stack.length - 1];
    if (!target) return;
    const i = this.stack.indexOf(target);
    if (i >= 0) this.stack.splice(i, 1);
    target.remove();
  },

  closeAll() { while (this.stack.length) this.close(); },
};

/** Bottom sheet. `body` is the markup below the grab handle. */
function sheet(body, onMount, opts) {
  return Overlay.open(`<div class="sheet" role="dialog" aria-modal="true">
    <div class="grab"></div>${body}
  </div>`, onMount, opts);
}

/** Centred dialog. `body` is everything inside the card. */
function dialog(body, onMount, opts) {
  const o = opts || {};
  return Overlay.open(`<div class="dialog ${o.wide ? 'wide' : ''}" role="dialog" aria-modal="true">${body}</div>`,
    onMount, opts);
}

/* Toasts: black pill at the bottom, optional trailing action.
   Each toast owns its dismissal timer — a single shared one meant a second
   toast cancelled the first one's timer and left it on screen forever. */
const TOAST_MAX = 3;

function toast(message, opts) {
  const o = opts || {};
  let stack = $('.toast-stack', overlayEl());
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    overlayEl().appendChild(stack);
  }
  const node = document.createElement('div');
  node.className = 'toast' + (o.mini ? ' mini' : '');
  node.setAttribute('role', 'status');
  node.innerHTML = o.mini
    ? esc(message)
    : `${o.tone ? `<span class="ic ${o.tone === 'error' ? 'err' : 'ok'}">${icon(o.tone === 'error' ? 'circleExclamation' : 'circleCheck', 19)}</span>` : ''}
       <span class="tx">${esc(message)}</span>
       ${o.action ? `<button class="act">${esc(o.action)}</button>` : ''}`;
  // Retire the oldest so a burst of toasts cannot pile up off-screen.
  while (stack.children.length >= TOAST_MAX) dismissToast(stack.firstElementChild);
  stack.appendChild(node);

  node._timer = setTimeout(() => dismissToast(node), o.duration || 2600);

  if (o.action && o.onAction) {
    $('.act', node).addEventListener('click', () => { dismissToast(node); o.onAction(); });
  }
  return node;
}

function dismissToast(node) {
  if (!node) return;
  clearTimeout(node._timer);
  node.remove();
}

/* --------------------------------------------------------------- utilities */

function haptic(ms) {
  if (Store.state.settings.haptics && navigator.vibrate) navigator.vibrate(ms || 12);
}

function mmss(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function dateLabel(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** Wires `data-act` / `data-tab` / `data-route` clicks inside a root node. */
function bind(root, handlers) {
  $$('[data-act]', root).forEach(el => {
    const fn = handlers[el.dataset.act];
    if (fn) el.addEventListener('click', ev => fn(el, ev));
  });
  $$('[data-route]', root).forEach(el => {
    el.addEventListener('click', () => go(el.dataset.route, el.dataset.arg));
  });
  $$('[data-tab]', root).forEach(el => {
    el.addEventListener('click', () => go(el.dataset.tab));
  });
}
