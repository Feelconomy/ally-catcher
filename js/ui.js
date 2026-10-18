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

/* 인형 그림마다 캔버스 여백이 달라, 같은 상자에 object-fit:contain 으로 넣어도
   어떤 인형은 작아 보인다(올리가 상자의 75%, 원이는 100%). 그림의 투명 영역을 뺀
   실제 크기를 재서, 상자를 넘지 않는 선에서 키워 눈에 보이는 크기를 맞춘다.
   값 = min(상자/그림높이, 상자/그림너비). 그림을 바꾸면 다시 재야 한다 —
   캔버스에 그려 알파 > 12 인 픽셀의 경계상자를 재면 나온다. 없는 id 는 1. */
const ART_FIT = {
  olly: 1.33, kori: 1.00, tiger: 1.04, hanbok: 1.04, snorkel: 1.04,
  summer: 1.04, acorn: 1.04, ski: 1.04, pig: 1.03, bunny: 1.02,
  spring: 1.02, santa: 1.02, hanbokkori: 1.01,
};

/** `state` is one of DOLL_STATES; omit it for the resting pose. */
function dollImg(id, size, extra, state) {
  const px = size || 84;
  const src = dollArt(id, state || 'idle');
  /* transform 은 자리를 차지하지 않아, 격자·목록의 칸 크기는 그대로 둔 채 그림만 맞춘다.
     더미의 인형은 extra 로 rotate 를 받으므로 둘을 합쳐야 한다 — 따로 쓰면 뒤엣것이 이긴다. */
  const rest = (extra || '').replace(/transform\s*:\s*[^;]*;?/g, '');
  const rot = /transform\s*:\s*([^;]+)/.exec(extra || '');
  const tf = [ART_FIT[id] ? `scale(${ART_FIT[id]})` : '', rot ? rot[1].trim() : ''].filter(Boolean).join(' ');
  /* 관리자 인형 화면은 img 가 90개(내려받기 15MB · 디코딩 35MB)나 되는데 그중
     절반은 화면 밖이다. 폰 사파리는 디코딩 예산을 넘기면 뒤쪽·큰 그림부터 조용히
     안 그린다 — 곰돌이 단지가 안 보이던 이유. 보이는 것만 받아 그린다. */
  return `<img src="${esc(src)}" alt="" width="${px}" height="${px}" loading="lazy" decoding="async"
    style="width:${px}px;height:${px}px;object-fit:contain${tf ? ';transform:' + tf : ''}${rest ? ';' + rest : ''}">`;
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

/* 캐릭터 실루엣. 실제 인형 그림의 윤곽(assets/friends/*.png, 알파만 남긴 4KB
   마스크)을 그대로 써서 도형으로 흉내 내지 않는다. 로딩·빈 화면·축하처럼
   '보여줄 것'이 있는 순간에 그림 대신 쓴다. 색은 currentColor.
   lines 는 3D 로딩 화면에서 그 친구가 들어갈 때 함께 나오는 문구. */
const FRIENDS = {
  olly: { name: '올리', lines: ['올리가 인형통에 들어가는 중이에요', '올리가 집게를 반짝반짝 닦고 있어요'] },
  pig:  { name: '단지', lines: ['단지가 꽃핀을 고쳐 꽂고 들어가요', '단지가 폭신한 자리를 고르는 중이에요'] },
  woni: { name: '원이', lines: ['원이가 뒤뚱뒤뚱 입장하는 중이에요', '원이가 새싹에 물을 주고 있어요'] },
  kori: { name: '코리', lines: ['코리가 서류가방을 내려놓는 중이에요', '코리가 코로 조명을 켜고 있어요'] },
  dali: { name: '달리', lines: ['달리가 꼬리 흔들며 들어가는 중이에요', '달리가 행운을 킁킁 찾고 있어요'] },
};
const FRIEND_IDS = Object.keys(FRIENDS);
const friendMask = id => `assets/friends/${FRIENDS[id] ? id : 'olly'}.png`;

/** 실루엣 하나. cls 로 색·애니메이션을 준다. */
function friendIcon(id, size = 40, cls = '', style = '') {
  const url = friendMask(id);
  return `<span class="friend ${cls}" aria-hidden="true" style="width:${size}px;height:${size}px;-webkit-mask-image:url(${url});mask-image:url(${url});${style}"></span>`;
}

/** 아무 인형이나 실제 그림 윤곽 그대로 실루엣(도감의 아직 못 모은 칸 등). */
function dollSilhouette(id, size = 56, cls = '') {
  const url = esc(dollArt(id));
  return `<span class="friend ${cls}" aria-hidden="true" style="width:${size}px;height:${size}px;-webkit-mask-image:url(${url});mask-image:url(${url})"></span>`;
}

/** 다섯 친구가 차례로 깡충 뛰는 줄. 스플래시·축하·빈 화면에서 쓴다. */
function friendParade(size = 40, cls = '') {
  return `<div class="parade ${cls}">${FRIEND_IDS.map((id, k) => friendIcon(id, size, 'hop', `animation-delay:${k * .14}s`)).join('')}</div>`;
}

/** Sets the shell background tone the screen wants (cream / dark / green / yellow). */
const THEME_BG = { dark: '#141414', green: '#00A650', yellow: '#FFD400', arcade: '#EDF7F0' };

/* 폰에서는 주소창이 접혔다 펴질 때 100dvh 가 실제로 보이는 높이와 어긋나, 셸이
   화면보다 짧아지면서 아래로 앱 바깥 배경(베이지)이 비칠 때가 있다. 뒷배경까지
   화면 색으로 칠해 두면 그 틈이 보이지 않는다. 데스크톱은 셸을 폰처럼 가운데
   띄워 보여주는 화면이라 바깥을 칠하면 안 되므로 좁은 화면에서만 칠한다.

   조건은 app.css 의 '폰 카드' 미디어쿼리와 짝이다 — 카드로 띄우지 않는 크기면
   바깥도 화면 색으로 칠한다. 둘이 어긋나면 모서리가 각진 셸 옆으로 베이지가
   비쳐 색이 안 칠해진 것처럼 보인다. */
const narrow = window.matchMedia('(max-width: 479px), (max-height: 599px)');

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
  clearArcadeTone();            // 화면이 바뀌면 기계 색감은 떨군다
}

/* ── 2D 그린 스킨 색감 ──────────────────────────────────────────────
   그린 스킨은 --arc-* 토큰 한 벌과 민트색 캐비닛 사진(green-cabinet-empty.png)
   으로 칠해져 있다. 사진은 색을 바꿀 수 없으니 같은 각도만큼 hue-rotate 로 돌린다
   — 사진은 빈 div(.glass)의 배경이고 인형·집게는 형제라 사진만 돌아간다.
   토큰도 같은 각도로 돌려 끼워 틀·조작대까지 한 색으로 맞춘다.
   색감이 초록이면 아무것도 넣지 않는다 — 원래 CSS 그대로다. */
const ARC_TOKENS = ['--arc-bg', '--arc-body', '--arc-body-lit', '--arc-body-deep',
  '--arc-glass', '--arc-glass-lit', '--arc-accent', '--arc-accent-lit',
  '--arc-edge', '--arc-edge-lit', '--arc-deep', '--arc-ink', '--arc-ink-soft'];
const CAB_HUE = 149;            // 캐비닛 사진의 민트 색상(픽셀에서 잰 값 148.8)

/** '#rrggbb' · 'rgb(a)(...)' 를 [r,g,b,a] 로. 못 읽으면 null. */
function readColor(css) {
  const v = (css || '').trim();
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (m) {
    const h = m[1].length === 3 ? [...m[1]].map(c => c + c).join('') : m[1];
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).concat(1);
  }
  m = /^rgba?\(([^)]+)\)$/i.exec(v);
  if (!m) return null;
  const n = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return n.length >= 3 ? [n[0], n[1], n[2], n.length > 3 ? n[3] : 1] : null;
}

/** 색상(hue)만 deg 만큼 돌린다 — 채도·밝기·투명도는 그대로 둔다. */
function rotateHue(css, deg) {
  const c = readColor(css);
  if (!c) return css;
  const [r, g, b, a] = c, mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255;
  const l = (mx + mn) / 2, d = mx - mn;
  if (!d) return css;                                  // 무채색은 돌릴 것이 없다
  const sat = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r / 255 ? ((g - b) / 255 / d) % 6
        : mx === g / 255 ? (b - r) / 255 / d + 2 : (r - g) / 255 / d + 4;
  h = (((h * 60 + deg) % 360) + 360) % 360;
  const cc = (1 - Math.abs(2 * l - 1)) * sat, x = cc * (1 - Math.abs((h / 60) % 2 - 1)), m0 = l - cc / 2;
  const [rr, gg, bb] = [[cc, x, 0], [x, cc, 0], [0, cc, x], [0, x, cc], [x, 0, cc], [cc, 0, x]][Math.floor(h / 60) % 6];
  const out = [rr, gg, bb].map(v => Math.round((v + m0) * 255));
  return a < 1 ? `rgba(${out.join(', ')}, ${a})` : '#' + out.map(v => v.toString(16).padStart(2, '0')).join('');
}

const hueOf = (css) => {
  const c = readColor(css); if (!c) return CAB_HUE;
  const [r, g, b] = c.map(v => v / 255), mx = Math.max(r, g, b), d = mx - Math.min(r, g, b);
  if (!d) return CAB_HUE;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((h * 60) % 360 + 360) % 360;
};

function clearArcadeTone() {
  const st = shellEl().style;
  for (const k of [...ARC_TOKENS, '--arc-shift']) st.removeProperty(k);
}

function applyArcadeTone(m) {
  clearArcadeTone();
  const t = machineTone(m);
  if (t.id === 'green') return;               // 기본 초록은 원본 그대로
  const st = shellEl().style, base = getComputedStyle(document.documentElement);
  const deg = Math.round((((hueOf(t.mid) - CAB_HUE) % 360) + 360) % 360);
  st.setProperty('--arc-shift', `hue-rotate(${deg}deg)`);
  for (const k of ARC_TOKENS) st.setProperty(k, rotateHue(base.getPropertyValue(k), deg));
  st.setProperty('--arc-edge', t.mid);        // 3D 조작 색과 같은 값으로 맞춘다
  st.setProperty('--arc-ink', t.ink);
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
  const res = Overlay.open(`<div class="sheet" role="dialog" aria-modal="true">
    <div class="grab"></div>${body}
  </div>`, onMount, opts);
  attachSheetSwipe(res.node, res.close);
  return res;
}

/* 아래로 쓸어 내려 시트를 닫는다. 시트/내부 목록이 스크롤 가능한 경우, 그 스크롤이
   '맨 위'일 때만 닫기 제스처로 인식한다 — 아니면 평범한 스크롤로 둔다. */
function attachSheetSwipe(node, close) {
  const el = $('.sheet', node);
  if (!el) return;
  let startY = 0, dy = 0, active = false;
  // 터치 지점에서 가장 가까운 스크롤 영역이 맨 위에 있는지 (아니면 스크롤 우선)
  const canDrag = (target) => {
    let n = target;
    while (n && n !== el.parentElement) {
      if (n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) {
        return n.scrollTop <= 0;
      }
      n = n.parentElement;
    }
    return true;
  };
  el.addEventListener('touchstart', (e) => {
    active = canDrag(e.target);
    startY = e.touches[0].clientY; dy = 0;
    if (active) el.style.transition = 'none';
  }, { passive: true });
  el.addEventListener('touchmove', (e) => {
    if (!active) return;
    dy = e.touches[0].clientY - startY;
    if (dy <= 0) { el.style.transform = ''; return; }   // 위로 끌면 무효
    e.preventDefault();                                  // 당기는 동안 스크롤 막기
    el.style.transform = `translateY(${dy}px)`;
  }, { passive: false });
  const end = () => {
    if (!active) return;
    active = false;
    el.style.transition = '';
    if (dy > 90) { el.style.transform = 'translateY(100%)'; setTimeout(close, 200); }
    else el.style.transform = '';
  };
  el.addEventListener('touchend', end);
  el.addEventListener('touchcancel', end);
}

/** Centred dialog. `body` is everything inside the card. */
function dialog(body, onMount, opts) {
  const o = opts || {};
  return Overlay.open(`<div class="dialog ${o.wide ? 'wide' : ''} ${o.cls || ''}" role="dialog" aria-modal="true">${body}</div>`,
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
    : `${(o.tone || o.icon) ? `<span class="ic ${o.tone === 'error' ? 'err' : 'ok'}"${o.iconColor ? ` style="color:${o.iconColor}"` : ''}>${icon(o.icon || (o.tone === 'error' ? 'circleExclamation' : 'circleCheck'), 19)}</span>` : ''}
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
