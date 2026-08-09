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

function dollImg(id, size, extra) {
  const px = size || 84;
  return `<img src="dolls/${esc(id)}.svg" alt="" width="${px}" height="${px}"
    style="width:${px}px;height:${px}px${extra ? ';' + extra : ''}">`;
}

/** Sets the shell background tone the screen wants (cream / dark / green / yellow). */
function setTheme(name) {
  shellEl().dataset.theme = name || '';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = { dark: '#141414', green: '#00A650', yellow: '#FFD400' }[name] || '#FFFBEF';
}

function statusbar(offline) {
  return `<div class="statusbar"><span>9:41</span><span class="net">${offline ? '✕' : 'LTE'} ▮▮▮</span></div>`;
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

/* Toasts: black pill at the bottom, optional trailing action. */
let toastTimer = null;

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
  stack.appendChild(node);

  if (o.action && o.onAction) {
    $('.act', node).addEventListener('click', () => { node.remove(); o.onAction(); });
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.remove(), o.duration || 2600);
  return node;
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
