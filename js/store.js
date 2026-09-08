/* Player state. Everything lives in localStorage — there is no backend in this
   build, so the ledger the design describes (tickets earned only from missions
   and attendance, points earned only from prizes) is enforced here. */

const STORE_KEY = 'ppopgiwang.v1';

const DEFAULT_STATE = {
  onboarded: false,
  account: null,          // { provider, nickname, avatar }
  terms: { service: false, privacy: false, age: false, marketing: false },
  tickets: 0,
  points: 0,
  prizes: [],             // { dollId, at }
  plays: 0,
  wins: 0,
  failStreak: 0,
  missions: {},           // id -> progress count
  claimed: [],            // mission ids already collected
  bonusClaimed: false,
  adsWatchedToday: 0,
  attendance: 5,
  entries: [],            // raffle entries
  stock: {},              // machineId -> 남아 있는 인형 [dollId] (뽑으면 줄고, 비면 리필)
  bookmarks: [],
  recent: RECENT_SEEDS.slice(),
  nhLinked: false,
  settings: { haptics: true, sfx: false, dataSaver: false },
  notifications: { osGranted: false, missions: false, raffle: false, newMachine: false, marketing: false },
  coachDone: false,
  day: null,
  // 관리자 페이지(이스터 에그)에서 만든 것들. dolls·machines 는 덮어쓴 필드만,
  // custom 은 관리자가 직접 추가한 인형(포즈 이미지는 data URL).
  admin: { dolls: {}, machines: {}, custom: {} },
};

const Store = {
  state: null,

  load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (_) { saved = null; }
    // Deep-copy the defaults — a shallow merge would share DEFAULT_STATE's
    // arrays, so prizes from one session would survive a reset.
    this.state = Object.assign(JSON.parse(JSON.stringify(DEFAULT_STATE)), saved || {});
    // Nested objects need their own merge so new keys survive an upgrade.
    for (const k of ['terms', 'settings', 'notifications']) {
      this.state[k] = Object.assign({}, DEFAULT_STATE[k], (saved && saved[k]) || {});
    }
    this.state.missions = Object.assign({}, (saved && saved.missions) || {});
    this.state.admin = Object.assign({ dolls: {}, machines: {}, custom: {} }, (saved && saved.admin) || {});
    this.applyAdmin();
    this.rollDay();
    return this.state;
  },

  /* --- 관리자 덮어쓰기 ----------------------------------------------------
     카탈로그(DOLLS·MACHINES)는 상수라 편집값을 그 위에 얹는다. 저장하는 건
     바뀐 필드뿐이라, 되돌리기는 저장분을 비우고 새로고침하면 끝. */
  applyAdmin() {
    const a = this.state.admin;
    for (const id in a.custom) DOLLS[id] = Object.assign({ id }, a.custom[id]);
    for (const id in a.dolls) if (DOLLS[id]) Object.assign(DOLLS[id], a.dolls[id]);
    for (const id in a.machines) {
      const m = MACHINES.find(x => x.id === id);
      if (m) Object.assign(m, a.machines[id]);
    }
    // DOLL_IDS 는 const 배열이라 통째로 갈 수 없어 내용만 갈아끼운다.
    DOLL_IDS.length = 0;
    DOLL_IDS.push.apply(DOLL_IDS, Object.keys(DOLLS));
  },

  /** `kind`는 'dolls' 또는 'machines'. */
  setAdmin(kind, id, patch) {
    const bag = this.state.admin[kind];
    bag[id] = Object.assign(bag[id] || {}, patch);
    this.applyAdmin();
    return this.save();
  },

  /** 관리자가 추가한 인형. 실패하면 false (보통 localStorage 용량 초과). */
  addCustomDoll(doll) {
    const before = this.state.admin.custom[doll.id];
    this.state.admin.custom[doll.id] = doll;
    if (this.save()) { this.applyAdmin(); return true; }
    if (before) this.state.admin.custom[doll.id] = before;
    else delete this.state.admin.custom[doll.id];
    return false;
  },

  /** 추가한 인형 삭제 — 기계 구성과 이미 뽑은 목록에서도 빼준다. */
  removeCustomDoll(id) {
    delete this.state.admin.custom[id];
    delete this.state.admin.dolls[id];
    delete DOLLS[id];
    for (const m of MACHINES) {
      const keep = x => x !== id;
      const pool = m.pool.filter(keep);
      this.setAdmin('machines', m.id, {
        pool, contents: m.contents.filter(keep),
        hero: m.hero === id ? (pool[0] || Object.keys(DOLLS)[0]) : m.hero,
      });
    }
    this.state.prizes = this.state.prizes.filter(p => p.dollId !== id);
    for (const k in this.state.stock) {
      this.state.stock[k] = this.state.stock[k].filter(x => x !== id);
    }
    this.applyAdmin();
    this.save();
  },

  /** 저장 성공 여부를 돌려준다 — 시크릿 모드나 용량 초과면 false. */
  save() {
    let ok = true;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this.state)); } catch (_) { ok = false; }
    // 서버 저장(티켓·포인트). hydrate 중에는 되쓰기 방지를 위해 스킵.
    if (window.Sync && Sync.enabled && !Sync.suspended) Sync.savePlayer();
    return ok;
  },

  reset() {
    if (window.Sync && Sync.enabled) Sync.wipe(); // 서버 데이터도 삭제
    try { localStorage.removeItem(STORE_KEY); } catch (_) {}
    this.load();
  },

  /** Daily missions reset at the start of each local day. */
  rollDay() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.state.day === today) return;
    const firstRun = !this.state.day;
    const streak = this.state.missions.streak || this.state.attendance;
    this.state.day = today;
    // A returning player's attendance advances one day; a fresh install starts where it is.
    this.state.missions = { streak: Math.min(streak + (firstRun ? 0 : 1), 7) };
    this.state.claimed = [];
    this.state.bonusClaimed = false;
    this.state.adsWatchedToday = 0;
    this.save();
  },

  // --- currency ----------------------------------------------------------

  addTickets(n) { this.state.tickets = Math.max(0, this.state.tickets + n); this.save(); },
  addPoints(n)  { this.state.points  = Math.max(0, this.state.points  + n); this.save(); },

  canAfford(cost) { return this.state.tickets >= cost; },

  // --- prizes ------------------------------------------------------------

  addPrize(dollId) {
    this.state.prizes.push({ dollId, at: Date.now() });
    this.addPoints(DOLLS[dollId].points);
    this.save();
    if (window.Sync && Sync.enabled) Sync.recordPrize(dollId); // 서버에 인형 1개 추가
  },

  /** Counts per doll id, e.g. { bear: 3, duck: 1 }. */
  prizeCounts() {
    const out = {};
    for (const p of this.state.prizes) out[p.dollId] = (out[p.dollId] || 0) + 1;
    return out;
  },

  ownedIds() { return Object.keys(this.prizeCounts()); },

  duplicatesOf(dollId) { return Math.max(0, (this.prizeCounts()[dollId] || 0) - 1); },

  /** Trades one duplicate away for its point value. Returns points gained. */
  tradeDuplicate(dollId) {
    if (this.duplicatesOf(dollId) < 1) return 0;
    const idx = this.state.prizes.map(p => p.dollId).lastIndexOf(dollId);
    if (idx < 0) return 0;
    this.state.prizes.splice(idx, 1);
    const gained = DOLLS[dollId].points;
    this.addPoints(gained);
    this.save();
    if (window.Sync && Sync.enabled) Sync.reconcilePrizes(); // 서버 인형 목록 맞추기
    return gained;
  },

  firstAcquired(dollId) {
    const hit = this.state.prizes.filter(p => p.dollId === dollId).sort((a, b) => a.at - b.at)[0];
    return hit ? hit.at : null;
  },

  // --- missions ----------------------------------------------------------

  missionProgress(id) { return this.state.missions[id] || 0; },

  bumpMission(id, by) {
    const m = MISSIONS.find(x => x.id === id);
    if (!m) return;
    const next = Math.min(m.goal, this.missionProgress(id) + (by || 1));
    this.state.missions[id] = next;
    this.save();
  },

  missionComplete(id) {
    const m = MISSIONS.find(x => x.id === id);
    return !!m && this.missionProgress(id) >= m.goal;
  },

  missionClaimed(id) { return this.state.claimed.includes(id); },

  claimMission(id) {
    const m = MISSIONS.find(x => x.id === id);
    if (!m || !this.missionComplete(id) || this.missionClaimed(id)) return 0;
    this.state.claimed.push(id);
    this.addTickets(m.reward);
    this.save();
    return m.reward;
  },

  allMissionsClaimed() { return MISSIONS.every(m => this.missionClaimed(m.id)); },

  claimMissionBonus() {
    if (!this.allMissionsClaimed() || this.state.bonusClaimed) return 0;
    this.state.bonusClaimed = true;
    this.addTickets(MISSION_BONUS_TICKETS);
    this.save();
    return MISSION_BONUS_TICKETS;
  },

  remainingMissions() {
    return MISSIONS.filter(m => !this.missionClaimed(m.id)).length;
  },

  claimableTickets() {
    return MISSIONS.filter(m => !this.missionClaimed(m.id)).reduce((s, m) => s + m.reward, 0);
  },

  adsLeft() { return Math.max(0, AD_DAILY_LIMIT - this.state.adsWatchedToday); },

  // --- play --------------------------------------------------------------

  /** Success chance for this machine right now, per the design's streak rule. */
  odds(machine) {
    return Math.min(MAX_RATE, machine.baseRate + this.state.failStreak * FAIL_BONUS);
  },

  /** Returns the new level if this play pushed the player up one, else 0. */
  recordPlay(machine, won, dollId) {
    const before = this.level();
    this.state.plays += 1;
    this.bumpMission('plays');
    if (won) {
      this.state.wins += 1;
      this.state.failStreak = 0;
      this.addPrize(dollId);
      this.takeFromMachine(machine, dollId);
      if (DOLLS[dollId].grade !== 'N') this.bumpMission('rare');
    } else {
      this.state.failStreak += 1;
    }
    this.save();
    const after = this.level();
    return after > before ? after : 0;
  },

  // --- machine stock -----------------------------------------------------

  /* Each machine keeps its own bed between visits: dolls you have already won
     are gone when you come back, and the machine is restocked once emptied.
     `slots` is how many the bed can hold. */
  machineStock(machine, slots) {
    const cur = this.state.stock[machine.id];
    if (Array.isArray(cur) && cur.length) return { dolls: cur, refilled: false };
    // Only call it a restock if the player actually emptied it — a first visit
    // is just the machine being stocked for the first time.
    const emptied = Array.isArray(cur) && cur.length === 0;
    return { dolls: this.refillMachine(machine, slots), refilled: emptied };
  },

  refillMachine(machine, slots) {
    const n = Math.max(1, slots || 9);
    const filled = [];
    if (!machine.pool.length) { this.state.stock[machine.id] = filled; return filled; }
    for (let i = 0; i < n; i++) filled.push(machine.pool[i % machine.pool.length]);
    shuffle(filled);
    this.state.stock[machine.id] = filled;
    this.save();
    return filled;
  },

  /** Removes one won doll from that machine's bed. */
  takeFromMachine(machine, dollId) {
    const cur = this.state.stock[machine.id];
    if (!Array.isArray(cur)) return;
    const i = cur.indexOf(dollId);
    if (i >= 0) cur.splice(i, 1);
    this.save();
  },

  // --- raffles -----------------------------------------------------------

  enterRaffle(raffle, count) {
    const cost = raffle.cost * count;
    if (this.state.points < cost) return false;
    this.addPoints(-cost);
    this.state.entries.unshift({
      id: 'e' + Date.now(),
      raffle: raffle.id,
      name: raffle.name,
      icon: raffle.icon, bg: raffle.bg, color: raffle.iconColor,
      meta: `${count}회 응모 · ${fmt(cost)}P`,
      status: 'wait',
      announce: raffle.announce,
    });
    this.save();
    return true;
  },

  allEntries() { return this.state.entries.concat(SEED_ENTRIES); },

  pendingEntries() { return this.allEntries().filter(e => e.status === 'wait').length; },

  // --- misc --------------------------------------------------------------

  toggleBookmark(id) {
    const i = this.state.bookmarks.indexOf(id);
    if (i >= 0) this.state.bookmarks.splice(i, 1); else this.state.bookmarks.push(id);
    this.save();
    return i < 0;
  },

  isBookmarked(id) { return this.state.bookmarks.includes(id); },

  pushRecent(term) {
    const t = term.trim();
    if (!t) return;
    this.state.recent = [t].concat(this.state.recent.filter(x => x !== t)).slice(0, 8);
    this.save();
  },

  // --- levelling ---------------------------------------------------------

  level() { return Math.max(1, Math.floor(this.state.wins / WINS_PER_LEVEL) + 1); },

  /** Rank name for `lv` (defaults to the current level). */
  levelTitle(lv) {
    const n = lv || this.level();
    let title = LEVEL_TITLES[0].title;
    for (const t of LEVEL_TITLES) if (n >= t.from) title = t.title;
    return title;
  },

  /** Progress inside the current level: wins done, wins needed, percent. */
  levelProgress() {
    const done = this.state.wins % WINS_PER_LEVEL;
    return {
      done,
      need: WINS_PER_LEVEL,
      left: WINS_PER_LEVEL - done,
      percent: Math.round((done / WINS_PER_LEVEL) * 100),
    };
  },

  codexOwned() { return this.ownedIds().length; },

  codexPercent() { return Math.round((this.codexOwned() / CODEX_TOTAL) * 100); },

  convertibleNH() {
    return this.state.points >= NH_MIN ? Math.floor(this.state.points / 10) * 10 : 0;
  },
};

/** Fisher-Yates, in place. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 1234 → "1,234" */
function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
