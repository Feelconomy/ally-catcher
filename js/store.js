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
  bookmarks: [],
  recent: RECENT_SEEDS.slice(),
  nhLinked: false,
  settings: { haptics: true, sfx: false, dataSaver: false },
  notifications: { osGranted: false, missions: false, raffle: false, newMachine: false, marketing: false },
  coachDone: false,
  day: null,
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
    this.rollDay();
    return this.state;
  },

  save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(this.state)); } catch (_) { /* private mode */ }
    // 서버 저장(티켓·포인트). hydrate 중에는 되쓰기 방지를 위해 스킵.
    if (window.Sync && Sync.enabled && !Sync.suspended) Sync.savePlayer();
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

  recordPlay(machine, won, dollId) {
    this.state.plays += 1;
    this.bumpMission('plays');
    if (won) {
      this.state.wins += 1;
      this.state.failStreak = 0;
      this.addPrize(dollId);
      if (DOLLS[dollId].grade !== 'N') this.bumpMission('rare');
    } else {
      this.state.failStreak += 1;
    }
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

  level() { return Math.max(1, Math.floor(this.state.wins / 6) + 1); },

  codexOwned() { return this.ownedIds().length; },

  codexPercent() { return Math.round((this.codexOwned() / CODEX_TOTAL) * 100); },

  convertibleNH() {
    return this.state.points >= NH_MIN ? Math.floor(this.state.points / 10) * 10 : 0;
  },
};

/** 1234 → "1,234" */
function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
