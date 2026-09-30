/* Static catalogue for 올리캐쳐. Names, tags, costs and palettes come from the
   Claude Design spec's `renderVals()` block; grades and point values come from
   the doll-detail and exchange screens (SR 400P, 레어 +120P). */

/* 인형 그림 주소에 붙이는 판 번호. 그림을 같은 파일명으로 갈아끼우면 폰이
   캐시에 물고 있던 옛 그림을 계속 보여준다 — 나머지 파일들과 같은 방식으로
   판 번호를 붙여 둔다. 그림을 교체할 때마다 올린다. */
const ART_V = '?a=2';

const DOLLS = {
  bear:    { id: 'bear',    name: '말랑 곰돌이', grade: 'R',  points: 120, bg: '#FFF3DC', rate: 2.4 },
  dog:     { id: 'dog',     name: '쫀득 푸딩독', grade: 'N',  points: 60,  bg: '#FFF8E3', rate: 18 },
  rabbit:  { id: 'rabbit',  name: '한정판 우주토끼', grade: 'SR', points: 400, bg: '#EEF1FF', rate: 2.4 },
  cat:     { id: 'cat',     name: '뚱냥이',     grade: 'N',  points: 60,  bg: '#F0F3F6', rate: 18 },
  penguin: { id: 'penguin', name: '솜사탕펭',   grade: 'R',  points: 120, bg: '#EAF1F7', rate: 6 },
  duck:    { id: 'duck',    name: '레몬덕',     grade: 'N',  points: 60,  bg: '#FFF7D6', rate: 18 },

  /* The mascots. Unlike the SVG dolls these carry a pose per moment of a play —
     see dollArt() in ui.js for how the states are picked. */
  olly: {
    id: 'olly', name: '말랑 올리', grade: 'SR', points: 400, bg: '#EAF7DE', rate: 1.8,
    art: {
      idle:    'dolls/olly-idle.png' + ART_V,     // 기계 안에 놓여 있을 때
      grabbed: 'dolls/olly-grabbed.png' + ART_V,  // 집게에 잡혔을 때
      drop:    'dolls/olly-drop.png' + ART_V,     // 미끄러지거나 배출구로 떨어질 때
      win:     'dolls/olly-win.png' + ART_V,      // 성공적으로 뽑았을 때
    },
  },
  bunny: {
    id: 'bunny', name: '토끼모자 올리', grade: 'SR', points: 400, bg: '#F2F7E6', rate: 2.0,
    art: {
      idle:    'dolls/bunny-idle.png' + ART_V,
      grabbed: 'dolls/bunny-grabbed.png' + ART_V,
      drop:    'dolls/bunny-drop.png' + ART_V,
      win:     'dolls/bunny-win.png' + ART_V,
    },
  },
  ...poseDolls([
    { id: 'tiger',   name: '호랑이모자 올리', grade: 'SR', points: 400, bg: '#FFF3D2', rate: 1.8 },
    { id: 'hanbok',  name: '한복 원이',      grade: 'R',  points: 120, bg: '#EAF2F7', rate: 2.4 },
    { id: 'spring',  name: '벚꽃 원이',      grade: 'R',  points: 120, bg: '#FDEDF2', rate: 2.4 },
    { id: 'snorkel', name: '물놀이 원이',    grade: 'R',  points: 120, bg: '#E6F3FB', rate: 2.6 },
    { id: 'summer',  name: '수박 원이',      grade: 'R',  points: 120, bg: '#FFF0EC', rate: 2.6 },
    { id: 'autumn',  name: '단풍 원이',      grade: 'R',  points: 120, bg: '#FBEFE2', rate: 2.4, model3d: 'ToyAutumn' },
    { id: 'acorn',   name: '도토리 원이',    grade: 'R',  points: 120, bg: '#F5EEE2', rate: 2.4, model3d: 'ToyAcorn' },
    { id: 'ski',     name: '눈싸움 원이',    grade: 'R',  points: 120, bg: '#E8F1FB', rate: 2.4, model3d: 'ToySki' },
    { id: 'santa',   name: '산타 원이',      grade: 'R',  points: 120, bg: '#FBE9E9', rate: 2.2, model3d: 'ToySanta' },
    { id: 'pig',     name: '단지',        grade: 'R',  points: 120, bg: '#FDECF1', rate: 2.4 },
    { id: 'dali',    name: '달리',        grade: 'R',  points: 120, bg: '#F6EEDC', rate: 2.4 },
    // 3D 모델이 따로 있는 인형은 model3d 로 짝을 지어 준다 (없으면 id 로 짐작 → 곰)
    { id: 'hanbokolly', name: '한복 올리',  grade: 'SR', points: 400, bg: '#E8F3EE', rate: 1.8, model3d: 'ToyHanbokOlly' },
    { id: 'hanbokpig',  name: '한복 단지',  grade: 'R',  points: 120, bg: '#FBE9EF', rate: 2.4, model3d: 'ToyHanbokPig' },
    { id: 'bearpig',    name: '곰돌이 단지', grade: 'R',  points: 120, bg: '#F7ECE4', rate: 2.4, model3d: 'ToyBearPig' },
    { id: 'hanbokdali', name: '한복 달리',  grade: 'R',  points: 120, bg: '#EAF0F7', rate: 2.4, model3d: 'ToyHanbokDali' },
    { id: 'kori',       name: '코리',       grade: 'R',  points: 120, bg: '#E7F1FA', rate: 2.4, model3d: 'ToyKori' },
    { id: 'frogdali',   name: '개구리 달리', grade: 'R',  points: 120, bg: '#EAF5E2', rate: 2.4 },
  ]),
};

/* 4포즈 세트를 쓰는 인형은 파일명 규칙이 같으므로 art 맵을 만들어 붙인다. */
function poseDolls(list) {
  const out = {};
  for (const d of list) {
    out[d.id] = Object.assign({}, d, {
      art: {
        idle:    `dolls/${d.id}-idle.png${ART_V}`,
        grabbed: `dolls/${d.id}-grabbed.png${ART_V}`,
        drop:    `dolls/${d.id}-drop.png${ART_V}`,
        win:     `dolls/${d.id}-win.png${ART_V}`,
      },
    });
  }
  return out;
}

const DOLL_IDS = Object.keys(DOLLS);

/* 3D 인형통에서 쓸 수 있는 입체 모양. 관리자 화면에서 인형을 추가해도 여기서
   하나를 골라 붙일 수 있게 이름을 밖에 내둔다 — 안 그러면 새로 추가한 인형은
   전부 곰 모양으로만 나온다. 앞의 다섯은 전용 모델, 뒤 셋은 기계에 들어 있다. */
const TOY_SHAPES = {
  ToyOlly: '올리', ToyTiger: '호랑이모자 올리', ToyRabbit: '토끼모자 올리',
  ToyPig: '단지', ToyDali: '달리', ToyBearPig: '곰돌이단지', ToyHanbokPig: '한복단지',
  ToyHanbokOlly: '한복올리', ToyHanbokDali: '한복달리', ToyAcorn: '도토리올리',
  ToyAutumn: '단풍올리', ToySummerWoni: '여름원이', ToyKori: '코리',
  ToySki: '눈싸움올리', ToySanta: '산타올리',
  ToyBear: '곰', ToyBunny: '토끼', ToyDuck: '오리',
};

/** 인형 id 로 3D 모양 고르기. 관리자가 지정했으면 그걸, 없으면 이름으로 짐작한다.
    `inferOnly` 는 저장된 지정을 무시하고 짐작만 한다 — 관리자 화면에서 '짐작과
    같은 값'을 굳이 저장하지 않으려고 쓴다. */
function toyShape(id, inferOnly) {
  /* 우선순위: 관리자 지정 → 카탈로그가 원래 달고 나온 짝 → id 로 짐작.
     inferOnly 는 관리자 지정만 건너뛴다 (관리자 화면에서 '어차피 같은 값'을
     굳이 저장하지 않으려고 쓴다). */
  const base = DOLL_BASE[id];
  const picked = (!inferOnly && DOLLS[id] && DOLLS[id].model3d) || (base && base.model3d);
  if (TOY_SHAPES[picked]) return picked;
  return id === 'olly' ? 'ToyOlly' : id === 'tiger' ? 'ToyTiger' : id === 'pig' ? 'ToyPig'
    : id === 'bunny' ? 'ToyRabbit' : id === 'dali' ? 'ToyDali'
    : /bunny|rabbit|spring|hanbok|ski|santa/.test(id) ? 'ToyBunny'
    : /duck|summer|snorkel/.test(id) ? 'ToyDuck' : 'ToyBear';
}

/* 원본 카탈로그 사본. 관리자가 기본 인형을 지우거나 포즈 그림을 바꿔도 되돌릴 수
   있도록, Store.applyAdmin() 은 기본 인형을 매번 여기서 다시 세운 뒤 수정분을 얹는다. */
const DOLL_BASE = JSON.parse(JSON.stringify(DOLLS));

/** 기본 인형의 원래 포즈 네 장. SVG 인형은 한 장을 네 포즈에 같이 쓴다. */
function baseArt(id) {
  const b = DOLL_BASE[id];
  if (b && b.art) return Object.assign({}, b.art);
  const svg = `dolls/${id}.svg${ART_V}`;
  return { idle: svg, grabbed: svg, drop: svg, win: svg };
}

// 프로필 대표 이미지로 쓸 수 없는 옛 인형들 (신규 올리 시리즈만 허용)
const BLOCKED_AVATARS = ['bear', 'dog', 'rabbit', 'cat', 'penguin', 'duck'];
const DEFAULT_AVATAR = 'olly';

const GRADE_CLASS = { N: 'badge--n', R: 'badge--r', SR: 'badge--sr' };

const MACHINES = [
  {
    id: 'bear3',
    name: '말랑 곰돌이 3호기',
    short: '곰돌이 3호기',
    tag: '인기', tagClass: 'badge--pop',
    cost: 2, difficulty: '쉬움', baseRate: 38, grip: '강',
    bg: '#FFF3DC', hero: 'bear',
    blurb: '집게 힘이 강해 초보자도 잡기 쉬운 기계예요. 레어 등급 곰돌이가 3마리 들어 있어요.',
    contents: ['bear', 'duck', 'cat', 'dog', 'penguin', 'rabbit', 'tiger', 'hanbok', 'pig'],
    pool: ['bear', 'bear', 'bear', 'duck', 'cat', 'dog', 'tiger', 'hanbok', 'pig'],
    reward: 120,
    open: true,
  },
  {
    id: 'pudding',
    name: '쫀득 푸딩독',
    short: '푸딩독',
    tag: '쉬움', tagClass: 'badge--easy',
    cost: 2, difficulty: '쉬움', baseRate: 44, grip: '보통',
    bg: '#FFF8E3', hero: 'dog',
    blurb: '넓은 배출구 덕분에 실수해도 인형이 잘 떨어져요. 토끼모자 올리도 한 자리 섞여 있어요.',
    contents: ['bunny', 'dog', 'duck', 'cat', 'bear', 'summer', 'snorkel', 'dali'],
    pool: ['dog', 'bunny', 'duck', 'dali', 'cat', 'summer', 'snorkel', 'dali'],
    reward: 80,
    open: true,
  },
  {
    id: 'space',
    name: '한정판 우주토끼',
    short: '우주토끼',
    tag: '한정', tagClass: 'badge--limited',
    cost: 3, difficulty: '어려움', baseRate: 22, grip: '약',
    bg: '#EEF1FF', hero: 'rabbit',
    blurb: '시즌1 한정 SR 인형이 들어 있는 기계예요. 집게 힘이 약해 위치를 정확히 맞춰야 해요.',
    contents: ['rabbit', 'bunny', 'olly', 'penguin', 'cat', 'bear', 'spring', 'santa'],
    pool: ['rabbit', 'bunny', 'olly', 'penguin', 'cat', 'bear', 'spring', 'santa'],
    reward: 400,
    open: false,
    downNote: '오늘 오후 6시에 다시 열려요. 알림을 켜두면 열리는 즉시 알려드릴게요.',
  },
  {
    id: 'penguin1',
    name: '솜사탕 펭귄',
    short: '솜사탕 펭귄',
    tag: '신규', tagClass: 'badge--new',
    cost: 1, difficulty: '보통', baseRate: 34, grip: '보통',
    bg: '#EAF1F7', hero: 'penguin',
    blurb: '이번 주 새로 문을 연 기계예요. 마스코트 말랑 올리가 딱 한 자리 섞여 있어요.',
    contents: ['olly', 'penguin', 'duck', 'rabbit', 'cat', 'autumn', 'acorn', 'ski'],
    pool: ['penguin', 'olly', 'duck', 'penguin', 'cat', 'rabbit', 'autumn', 'acorn', 'ski'],
    reward: 120,
    open: true,
  },
];

const HOME_FILTERS = ['전체', '인기', '한정판', '쉬움', '신규'];

/* Missions. `kind` drives what tapping the action button does. */
const MISSIONS = [
  { id: 'share',  title: '친구 초대하기', reward: 1, goal: 1, kind: 'share',
    icon: 'share',      iconBg: '#E5FBEC', iconColor: '#00863F', btn: '초대', btnClass: 'btn--primary' },
  { id: 'ad',     title: '광고 보고 티켓 받기',   reward: 1, goal: 3, kind: 'ad',
    icon: 'play',       iconBg: '#FFF4C2', iconColor: '#8A6A00', btn: '시청', btnClass: 'btn--accent' },
  { id: 'rare',   title: '레어 등급 인형 뽑기',   reward: 2, goal: 1, kind: 'play',
    icon: 'star',       iconBg: '#FFF0F3', iconColor: '#D24A6A', btn: '도전', btnClass: 'btn--primary' },
  { id: 'plays',  title: '오늘 3판 플레이',       reward: 1, goal: 3, kind: 'play',
    icon: 'checkThick', iconBg: '#E5FBEC', iconColor: '#00863F', btn: '도전', btnClass: 'btn--primary' },
  { id: 'streak', title: '7일 연속 출석',         reward: 3, goal: 7, kind: 'passive',
    icon: 'calendar',   iconBg: '#EEF1FF', iconColor: '#4A5AC8', btn: '진행중', btnClass: 'btn--neutral' },
];

const MISSION_BONUS_TICKETS = 2;

const RAFFLES = [
  { id: 'fest',  name: '뮤직 페스티벌 2인권', note: '추첨 12명 · 응모 3,204', cost: 300,
    icon: 'musicMicrophone', bg: '#FFF0F3', iconColor: '#D24A6A', winners: 12, announce: '08.14' },
  { id: 'cafe',  name: '카페 모바일 기프티콘', note: '추첨 200명 · 응모 8,910', cost: 100,
    icon: 'coffee', bg: '#FFF4C2', iconColor: '#8A6A00', winners: 200, announce: '08.21' },
];

/* Seeded entry history so 응모 내역 has the three states the design shows. */
const SEED_ENTRIES = [
  { id: 'e1', raffle: 'cafe', name: '카페 모바일 기프티콘', icon: 'coffee', bg: '#E5FBEC', color: '#00863F',
    meta: '2026.08.01 응모 · 100P', status: 'win', claimDays: 5 },
  { id: 'e2', raffle: 'movie', name: '영화 예매권', icon: 'ticket', bg: '#F0F1F3', color: '#8A8D94',
    meta: '2026.07.20 응모 · 200P', status: 'lost' },
];

const MY_MENU = [
  { id: 'exchange', label: '포인트 교환소',        icon: 'ticketFill', route: 'exchange' },
  { id: 'entries',  label: '추첨 응모 내역',        icon: 'inbox',      route: 'entries' },
  { id: 'nh',       label: 'NH멤버스 계정 연동',    icon: 'link',       route: 'nh-link' },
  { id: 'invite',   label: '친구 초대하기', icon: 'personPlus', action: 'invite' },
  { id: 'notif',    label: '알림 설정',            icon: 'bell',       route: 'notif' },
  { id: 'support',  label: '고객센터',             icon: 'bubble',     action: 'support' },
];

const NH_RATE = 0.8;          // 100P → 80 멤버스P
const NH_MIN = 1000;          // 최소 전환 포인트
const CODEX_TOTAL = 35;       // 시즌1 도감 정원
const CODEX_REWARD_TICKETS = 10;
const SIGNUP_TICKETS = 10;
const AD_TICKETS = 1;
const AD_DAILY_LIMIT = 3;
const AD_SECONDS = 30;
const AD_SKIP_AFTER = 5;                              // 건너뛰기 가능 시점(초)
const AD_VIDEOS = ['sJSwiW9UKgE', 'AEsOaycX3w0'];     // 번갈아 재생할 유튜브 영상
const PLAY_SECONDS = 20;
const FAIL_BONUS = 8;         // 연속 실패 시 성공률 가산 (설계 22번 화면)
const MAX_RATE = 90;

/* Onboarding value props. Shared by the onboarding screen and the splash,
   which cycles the same lines while the app loads. */
const ONBOARDING = [
  { k: '기다림 없는 가상 인형뽑기', h: '한 손으로<br>집게를 내려요',
    p: '대기 없이 바로 시작.\n뽑은 인형은 보관함에 모으고,\n포인트는 교환소에서 바꿔요.',
    art: ['machine'] },
  { k: '티켓은 미션으로만', h: '현금 결제가<br>없는 뽑기',
    p: '티켓은 데일리 미션과 출석으로만 모아요.\n결제 없이도 매일 도전할 수 있어요.',
    art: ['ticket'] },
  { k: '모으고 바꾸고', h: '포인트는<br>진짜로 써요',
    p: '중복 인형은 포인트로 교환하고,\n추첨 응모나 NH멤버스 포인트 전환에 사용하세요.',
    art: ['exchange'] },
];

/* Levelling. Every WINS_PER_LEVEL successful grabs is one level; the title
   changes as the player climbs. */
const WINS_PER_LEVEL = 6;
const LEVEL_TITLES = [
  { from: 1,  title: '뽑기 입문' },
  { from: 3,  title: '뽑기 견습' },
  { from: 6,  title: '뽑기 고수' },
  { from: 10, title: '뽑기 마스터' },
  { from: 16, title: '집게의 전설' },
];

const NICK_SUGGESTIONS = ['올리캐쳐77', '집게마스터', '인형수집가'];
const RECENT_SEEDS = ['곰돌이', '한정판', '펭귄'];

const PLAY_TIPS = [
  '머리와 팔 사이를 노리면 성공률이 올라가요',
  '집게 힘이 약하면 쌓인 인형 가장자리를 노려보세요',
  '연속 실패하면 다음 판 확률이 올라가요',
];
