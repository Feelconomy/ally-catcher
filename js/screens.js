/* Every screen except the claw machine itself (see play.js).
   Each entry renders into #screen and wires its own handlers. */

const Screens = {

  /* --- 09 스플래시 ------------------------------------------------------- */
  splash() {
    setTheme('green');
    // The loading moment carries the onboarding pitch instead of a bare logo.
    screenEl().innerHTML = `<div class="screen splash">
      <div class="mark"><i></i></div>
      <div class="name">올리캐쳐</div>
      <img class="splash-art" src="assets/ollie.png" alt="" width="480" height="720">
      <div class="pitch">
        <div class="k" id="splashK">${esc(ONBOARDING[0].k)}</div>
        <div class="p" id="splashP">${esc(ONBOARDING[0].p)}</div>
      </div>
      <div class="bar">${meter(8, 'onGreen')}</div>
      <div class="ver">v1.0.0</div>
    </div>`;

    const bar = $('.splash .meter > i');
    let pct = 8;
    const load = setInterval(() => {
      pct = Math.min(100, pct + 7 + Math.random() * 9);
      if (bar) bar.style.width = pct + '%';
      if (pct >= 100) clearInterval(load);
    }, 150);

    // Rotate through the value props while it loads.
    let i = 0;
    const rotate = setInterval(() => {
      const k = document.getElementById('splashK');
      const p = document.getElementById('splashP');
      if (!k || !p) { clearInterval(rotate); return; }
      i = (i + 1) % ONBOARDING.length;
      const pitch = $('.splash .pitch');
      pitch.classList.remove('in');
      // Restart the fade by forcing a reflow between class swaps.
      void pitch.offsetWidth;
      k.textContent = ONBOARDING[i].k;
      p.textContent = ONBOARDING[i].p;
      pitch.classList.add('in');
    }, 1500);

    App.splashTimers = [load, rotate];

    setTimeout(() => {
      clearInterval(load); clearInterval(rotate);
      if (App.route !== 'splash') return;
      go(Store.state.account ? 'home' : 'login');
    }, 4600);
  },

  /* --- 10 로그인 --------------------------------------------------------- */
  login() {
    setTheme('');
    screenEl().innerHTML = `<div class="screen">
      ${statusbar()}
      <div class="login">
        <div class="brandmark l"><i></i></div>
        <h2>3초면 시작해요</h2>
        <p>간편 로그인으로 티켓과 인형을<br>기기 사이에서 안전하게 보관해요</p>
        ${dollImg('rabbit', 150, '')}
        <div class="actions">
          <button class="btn btn--kakao" data-act="sso" data-p="카카오">${icon('logoKakao', 20)}카카오로 시작하기</button>
          <button class="btn btn--naver" data-act="sso" data-p="네이버">네이버로 시작하기</button>
          <button class="btn btn--apple" data-act="sso" data-p="Apple">${icon('logoApple', 18)}Apple로 계속하기</button>
          <button class="btn sm btn--text" style="text-decoration:underline" data-act="peek">둘러보기</button>
        </div>
      </div>
    </div>`;
    $('.login img').classList.add('mascot');

    bind(screenEl(), {
      sso: el => { App.pendingProvider = el.dataset.p; Sheets.terms(); },
      peek: () => { App.guest = true; go('home'); },
    });
  },

  /* --- 12 프로필 설정 ---------------------------------------------------- */
  profile() {
    setTheme('');
    const taken = ['올리캐쳐', '집게왕', 'admin'];
    screenEl().innerHTML = `<div class="screen">
      ${statusbar()}
      ${appbar('프로필 설정', { meta: '2/3' })}
      <div class="scroll" style="padding:14px 24px 0">
        <div style="display:flex;flex-direction:column;align-items:center">
          <div style="position:relative;width:104px;height:104px;border-radius:34px;background:var(--yellow);display:flex;align-items:center;justify-content:center">
            <img id="avatar" src="dolls/cat.svg" alt="" width="78" height="78" style="width:78px;height:78px">
            <button data-act="shuffle" aria-label="아바타 바꾸기"
              style="position:absolute;right:-4px;bottom:-4px;width:34px;height:34px;border-radius:50%;background:var(--ink);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 3px var(--cream)">
              ${icon('camera', 16)}
            </button>
          </div>
        </div>
        <div style="margin-top:30px">
          <label class="field" id="nickField">
            <span class="lbl">닉네임</span>
            <span class="box">
              <input id="nick" type="text" maxlength="10" placeholder="닉네임을 입력하세요" autocomplete="off">
              <span class="count" id="nickCount">0/10</span>
            </span>
            <span class="err">${icon('circleExclamation', 15)}<span id="nickErr">이미 사용 중인 닉네임이에요</span></span>
          </label>
          <div style="margin-top:26px;font-size:13px;font-weight:700">추천 닉네임</div>
          <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px">
            ${NICK_SUGGESTIONS.map(n => `<button class="chip" data-act="suggest" data-n="${esc(n)}">${esc(n)}</button>`).join('')}
          </div>
        </div>
      </div>
      <div style="padding:16px 24px calc(34px + var(--safe-b))">
        <button class="btn btn--primary" id="next" data-act="next" disabled>다음</button>
      </div>
    </div>`;

    const input = $('#nick'), field = $('#nickField'), next = $('#next');
    let avatar = 'cat';

    const validate = () => {
      const v = input.value.trim();
      $('#nickCount').textContent = `${v.length}/10`;
      let err = '';
      if (v && v.length < 2) err = '2자 이상 입력해 주세요';
      else if (taken.includes(v)) err = '이미 사용 중인 닉네임이에요';
      if (err) { field.dataset.invalid = '1'; $('#nickErr').textContent = err; }
      else delete field.dataset.invalid;
      const ok = v.length >= 2 && !err;
      next.disabled = !ok;
      next.classList.toggle('btn--disabled', !ok);
      return ok;
    };
    input.addEventListener('input', validate);
    validate();

    bind(screenEl(), {
      back: () => go('login'),
      shuffle: () => {
        avatar = DOLL_IDS[(DOLL_IDS.indexOf(avatar) + 1) % DOLL_IDS.length];
        $('#avatar').src = `dolls/${avatar}.svg`;
      },
      suggest: el => { input.value = el.dataset.n; validate(); input.focus(); },
      next: () => {
        if (!validate()) return;
        Store.state.account = { provider: App.pendingProvider || '카카오', nickname: input.value.trim(), avatar };
        Store.save();
        Dialogs.permission();
      },
    });
  },

  /* --- 01 온보딩 --------------------------------------------------------- */
  onboarding() {
    setTheme('yellow');
    const slides = ONBOARDING;
    let i = 0;

    /** Each slide illustrates its own promise rather than repeating the tray. */
    const artFor = s => {
      if (s.art[0] === 'ollie') {
        return '<img class="onb-art-hero" src="assets/ollie.png" alt="집게에 매달린 올리" width="480" height="720">';
      }
      if (s.art[0] === 'ticket') {
        return `<div class="onb-art tickets">
          ${[0, 1, 2].map(k => `<span style="animation-delay:${k * .18}s">${icon('ticketFill', k === 1 ? 68 : 52)}</span>`).join('')}
          <b>+${SIGNUP_TICKETS}</b>
        </div>`;
      }
      if (s.art[0] === 'exchange') {
        return `<div class="onb-art swap">
          <span class="from">${dollImg('cat', 72)}</span>
          <span class="arw">${icon('arrowRight', 22)}</span>
          <span class="to"><b>400</b><i>POINT</i></span>
        </div>`;
      }
      return s.art.map((d, k) =>
        dollImg(d, 96, `animation:bob ${3.2 + k * 0.2}s ease-in-out infinite ${k * 0.25}s`)).join('');
    };

    const paint = () => {
      const s = slides[i];
      screenEl().innerHTML = `<div class="screen">
        ${statusbar()}
        <div class="onb">
          <div class="blob a"></div><div class="blob b"></div>
          <div class="kicker">${s.k}</div>
          <h2>${s.h}</h2>
          <p>${esc(s.p)}</p>
          <div class="tray ${s.art.length === 1 ? 'single' : ''} ${s.art[0] === 'ollie' ? 'bare' : ''}">${artFor(s)}</div>
          <div class="foot">
            <div class="dots">${slides.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
            <button class="btn btn--primary" data-act="next">
              ${i === slides.length - 1 ? `무료 티켓 ${SIGNUP_TICKETS}장 받고 시작` : '다음'}
            </button>
            <button class="btn sm btn--text" data-act="skip">${i === slides.length - 1 ? '이미 계정이 있어요' : '건너뛰기'}</button>
          </div>
        </div>
      </div>`;

      bind(screenEl(), {
        next: () => { if (i === slides.length - 1) Dialogs.welcome(); else { i++; paint(); } },
        skip: () => Dialogs.welcome(),
      });
    };
    paint();
  },

  /* --- 02 홈 ------------------------------------------------------------- */
  home() {
    setTheme('');
    const filter = App.homeFilter || '전체';
    const list = MACHINES.filter(m => {
      if (filter === '전체') return true;
      if (filter === '인기') return m.tag === '인기';
      if (filter === '한정판') return m.tag === '한정';
      if (filter === '쉬움') return m.difficulty === '쉬움';
      if (filter === '신규') return m.tag === '신규';
      return true;
    });
    const left = Store.remainingMissions();

    screenEl().innerHTML = `<div class="screen">
      ${statusbar()}
      <div class="home-head">
        <button class="brandmark s" data-act="egg" aria-label="올리캐쳐"><i></i></button>
        <button class="wordmark" data-act="egg">올리캐쳐</button>
        <button class="iconbtn plain" data-route="search" aria-label="검색">${icon('search', 22)}</button>
        ${walletChip()}
      </div>
      <div class="chiprow">
        ${HOME_FILTERS.map(f => `<button class="chip" data-act="filter" data-f="${f}" aria-pressed="${f === filter}">${f}</button>`).join('')}
      </div>
      <div class="scroll pad">
        <button class="promo" data-tab="mission">
          <span class="shine"></span>
          <span class="body">
            <span class="copy">
              <span class="eyebrow">DAILY MISSION</span>
              <span class="title">${left ? `오늘 미션 ${left}개 남음<br>티켓 ${Store.claimableTickets()}장 더 받기` : '오늘 미션 전부 완료!<br>내일 새 미션이 열려요'}</span>
            </span>
            <img class="mascot" src="assets/wonhee.png" alt="" width="360" height="540">
          </span>
        </button>

        <div class="section-head">
          <h3>지금 바로 플레이</h3>
          <button class="more" data-act="filter" data-f="전체">전체보기</button>
        </div>
        <div class="machine-grid">
          ${list.map(m => machineCard(m)).join('')}
        </div>
      </div>
      ${tabbar('home')}
    </div>`;

    bind(screenEl(), {
      wallet: () => go('mission'),
      filter: el => { App.homeFilter = el.dataset.f; Screens.home(); },
      machine: el => go('machine', el.dataset.id),
      egg: () => tapEasterEgg(),
    });
  },

  /* --- 16 / 17 검색 ------------------------------------------------------ */
  search() {
    setTheme('');

    // The chrome is rendered once; only #results repaints as you type, so the
    // caret and the on-screen keyboard stay put.
    screenEl().innerHTML = `<div class="screen">
      ${statusbar()}
      <div class="appbar">
        <button class="iconbtn plain" data-act="back" aria-label="뒤로">${icon('chevronLeft3', 20)}</button>
        <div class="searchbar">
          ${icon('search', 18)}
          <input id="q" type="search" value="${esc(App.searchTerm || '')}"
                 placeholder="기계나 인형을 검색해 보세요" autocomplete="off" enterkeyhint="search">
          <button class="clear" data-act="clear" aria-label="지우기" hidden>${icon('close', 11)}</button>
        </div>
      </div>
      <div class="scroll pad" id="results"></div>
    </div>`;

    const q = $('#q');
    const results = $('#results');
    const clearBtn = $('.searchbar .clear');

    const match = term => MACHINES.filter(m =>
      m.name.includes(term) || m.contents.some(d => DOLLS[d].name.includes(term)));

    const paint = () => {
      const term = q.value.trim();
      App.searchTerm = q.value;
      clearBtn.hidden = !q.value;

      if (!term) {
        results.innerHTML = `
          <div class="section-head">
            <h3 style="font-size:14px">최근 검색어</h3>
            ${Store.state.recent.length ? '<button class="more" data-act="clearRecent">전체 삭제</button>' : ''}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px">
            ${Store.state.recent.length
              ? Store.state.recent.map(r => `<button class="chip" data-act="recent" data-r="${esc(r)}">${esc(r)}</button>`).join('')
              : '<div class="sub">최근 검색 기록이 없어요</div>'}
          </div>
          <div style="margin-top:28px;font-size:14px;font-weight:700;margin-bottom:6px">인기 기계</div>
          ${MACHINES.filter(m => m.open).slice(0, 3).map(m => resultRow(m, '')).join('')}`;
      } else {
        const hits = match(term);
        results.innerHTML = hits.length
          ? `<div style="font-size:14px;font-weight:700;margin-bottom:6px">검색 결과 ${hits.length}</div>
             ${hits.map(m => resultRow(m, term)).join('')}`
          : `<div class="empty" style="padding-top:56px">
               ${dollImg('dog', 112, 'opacity:.35;filter:grayscale(1)')}
               <h3>'${esc(term)}' 결과가 없어요</h3>
               <p>다른 키워드로 찾아보거나<br>인기 기계를 둘러보세요</p>
               <button class="btn sm auto btn--primary" style="margin-top:22px" data-act="popular">인기 기계 보기</button>
             </div>`;
      }

      bind(results, {
        clearRecent: () => {
          const backup = Store.state.recent.slice();
          Store.state.recent = []; Store.save(); paint();
          toast('최근 검색어를 지웠어요', {
            action: '되돌리기',
            onAction: () => { Store.state.recent = backup; Store.save(); paint(); },
          });
        },
        recent: el => { q.value = el.dataset.r; paint(); },
        machine: el => { Store.pushRecent(q.value.trim()); go('machine', el.dataset.id); },
        popular: () => { App.searchTerm = ''; App.homeFilter = '인기'; go('home'); },
      });
    };

    q.addEventListener('input', paint);
    q.addEventListener('keydown', ev => { if (ev.key === 'Enter') { Store.pushRecent(q.value.trim()); q.blur(); } });

    bind(screenEl(), {
      back: () => { App.searchTerm = ''; go('home'); },
      clear: () => { q.value = ''; paint(); q.focus(); },
    });

    paint();
  },

  /* --- 18 / 19 기계 상세 ------------------------------------------------- */
  machine(id) {
    setTheme('');
    const m = MACHINES.find(x => x.id === id) || MACHINES[0];
    const marked = Store.isBookmarked(m.id);

    screenEl().innerHTML = `<div class="screen">
      <div class="hero ${m.open ? '' : 'down'}">
        ${statusbar()}
        <button class="back" data-act="back" aria-label="뒤로">${icon('chevronLeft3', 20)}</button>
        ${m.open ? `<button class="act" data-act="share" aria-label="공유">${icon('share', 18)}</button>` : ''}
        ${m.open
          ? `<div class="hero-carousel" id="carousel">
               ${m.contents.slice(0, 3).map((d, k) => `<div class="slide ${k ? '' : 'on'}">${dollImg(d, 168)}</div>`).join('')}
             </div>
             <div class="dots" id="heroDots">${m.contents.slice(0, 3).map((_, k) => `<i class="${k ? '' : 'on'}"></i>`).join('')}</div>`
          : `${dollImg(m.hero, 168)}<span class="pill">점검중</span>`}
      </div>

      <div class="scroll" style="padding:20px 20px 0">
        ${m.open ? `
          <div style="display:flex;align-items:center;gap:7px">
            <span class="badge ${m.tagClass}">${m.tag}</span>
            <span class="badge badge--easy">난이도 ${m.difficulty}</span>
          </div>
          <h2 class="h2" style="margin-top:10px">${esc(m.name)}</h2>
          <p style="margin-top:8px;font-size:13px;font-weight:600;line-height:1.6;color:rgba(23,23,23,.55)">${esc(m.blurb)}</p>
          <div class="card pad statgrid" style="margin-top:16px">
            <div class="st"><div class="n" style="font-size:17px">${Store.odds(m)}%</div><div class="l">이번 판 성공률</div></div>
            <div class="div"></div>
            <div class="st"><div class="n" style="font-size:17px">${m.contents.length}종</div><div class="l">인형 구성</div></div>
            <div class="div"></div>
            <div class="st"><div class="n" style="font-size:17px;color:var(--green)">+${m.reward}P</div><div class="l">성공 시 적립</div></div>
          </div>
          <div style="margin-top:18px;font-size:14px;font-weight:700">들어 있는 인형</div>
          <div class="doll-strip">
            ${m.contents.slice(0, 3).map(d => `<div>${dollImg(d, 56)}</div>`).join('')}
            ${m.contents.length > 3 ? `<div class="more">+${m.contents.length - 3}</div>` : ''}
          </div>` : `
          <h2 class="h2" style="color:var(--ink-45)">${esc(m.name)}</h2>
          <div style="margin-top:16px;padding:16px;border-radius:var(--r-xl);background:var(--yellow-soft);display:flex;gap:11px">
            <span style="color:var(--yellow-ink);display:flex;flex-shrink:0">${icon('triangleExclamation', 20)}</span>
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--yellow-ink)">기계 점검이 진행 중이에요</div>
              <div style="margin-top:5px;font-size:12px;font-weight:600;line-height:1.6;color:rgba(138,106,0,.85)">${esc(m.downNote)}</div>
            </div>
          </div>`}
        <div style="height:20px"></div>
      </div>

      <div class="detail-foot">
        ${m.open ? `
          <button class="bookmark" data-act="bookmark" aria-pressed="${marked}" aria-label="북마크">${icon('bookmark', 20)}</button>
          <button class="btn btn--primary" data-act="play">${icon('ticketFill', 18)}티켓 ${m.cost}장으로 시작</button>`
        : `
          <div style="flex:1;display:flex;flex-direction:column;gap:10px">
            <button class="btn btn--disabled" disabled>지금은 플레이할 수 없어요</button>
            <button class="btn sm btn--outline" data-act="notify">열리면 알림 받기</button>
          </div>`}
      </div>
    </div>`;

    // Cycle the hero through the dolls this machine actually holds.
    if (m.open) {
      const slides = $$('#carousel .slide');
      const dots = $$('#heroDots i');
      let at = 0;
      App.heroTimer = setInterval(() => {
        if (App.route !== 'machine' || !document.getElementById('carousel')) {
          clearInterval(App.heroTimer); return;
        }
        slides[at].classList.remove('on'); dots[at].classList.remove('on');
        at = (at + 1) % slides.length;
        slides[at].classList.add('on'); dots[at].classList.add('on');
      }, 2400);
    }

    bind(screenEl(), {
      back: () => go('home'),
      bookmark: el => {
        const on = Store.toggleBookmark(m.id);
        el.setAttribute('aria-pressed', String(on));
        toast(on ? '북마크에 담았어요' : '북마크를 해제했어요', { mini: true });
      },
      share: () => {
        Store.bumpMission('share');
        toast('기계 링크를 복사했어요', { tone: 'ok', action: '미션 보기', onAction: () => go('mission') });
      },
      notify: () => toast('열리면 알려드릴게요', { tone: 'ok' }),
      play: () => {
        if (!Store.canAfford(m.cost)) { Sheets.ticketShort(m); return; }
        go('loading', m.id);
      },
    });
  },

  /* --- 20 플레이 진입 로딩 ----------------------------------------------- */
  loading(id) {
    setTheme('dark');
    const m = MACHINES.find(x => x.id === id) || MACHINES[0];
    const tip = PLAY_TIPS[Math.floor(Math.random() * PLAY_TIPS.length)];

    screenEl().innerHTML = `<div class="screen loading">
      <div class="spinner-lg"></div>
      <div class="t">기계에 연결하는 중</div>
      <div class="s">티켓 ${m.cost}장이 사용됩니다</div>
      <div class="tip">TIP · ${esc(tip)}</div>
    </div>`;

    setTimeout(() => {
      if (App.route !== 'loading') return;
      // A flaky connection is part of the spec (screen 23); refund and explain.
      if (Math.random() < 0.06) { Dialogs.disconnected(m); return; }
      Store.addTickets(-m.cost);
      go('play', m.id);
    }, 1400);
  },

  /* --- 03 플레이 --------------------------------------------------------- */
  play(id) {
    const m = MACHINES.find(x => x.id === id) || MACHINES[0];
    Play.start(m);
  },

  /* --- 04 뽑기 성공 ------------------------------------------------------ */
  win(dollId) {
    setTheme('green');
    const d = DOLLS[dollId] || DOLLS.bear;
    const gradeLabel = { N: '노멀 등급', R: '레어 등급', SR: 'SR 등급' }[d.grade];

    screenEl().innerHTML = `<div class="screen" style="align-items:center">
      ${statusbar()}
      <div class="result">
        <div class="blob a"></div><div class="blob b"></div>
        <div class="kicker">GOT IT!</div>
        <h2>배출구에 떨어졌어요</h2>
        <div class="prize">${dollImg(d.id, 172, '', 'win')}</div>
        <div class="nm">${esc(d.name)}</div>
        <div class="tags">
          <span style="background:rgba(255,255,255,.2);color:#fff">${gradeLabel}</span>
          <span style="background:var(--yellow);color:var(--ink)">+${d.points}P 적립</span>
        </div>
        <div class="foot">
          <button class="btn btn--accent" data-act="keep">보관함에 담기</button>
          <div class="btn-row">
            <button class="btn md btn--translucent" data-act="brag">자랑하기</button>
            <button class="btn md btn--translucent" data-act="again">한 번 더</button>
          </div>
        </div>
      </div>
    </div>`;

    bind(screenEl(), {
      keep: () => { go('storage'); toast('보관함에 담았어요', { tone: 'ok', action: '보기', onAction: () => go('storage') }); },
      brag: () => Dialogs.brag(d.id),
      again: () => {
        const m = Play.machine || MACHINES[0];
        if (!Store.canAfford(m.cost)) { Sheets.ticketShort(m); return; }
        go('loading', m.id);
      },
    });

    // If this win pushed the player up a level, celebrate over the prize.
    if (App.levelUpTo) {
      const lv = App.levelUpTo;
      App.levelUpTo = 0;
      setTimeout(() => { if (App.route === 'win') Dialogs.levelUp(lv); }, 900);
    }
  },

  /* --- 22 뽑기 실패 ------------------------------------------------------ */
  lose(slippedId) {
    setTheme('dark');
    const m = Play.machine || MACHINES[0];
    const next = Store.odds(m);
    // If the claw actually had hold of a doll, show that one in its dropped
    // pose. A clean miss falls back to a machine prize, dimmed.
    const slipped = slippedId && DOLLS[slippedId];
    const target = slipped || DOLLS[m.pool[0]];

    screenEl().innerHTML = `<div class="screen" style="align-items:center;background:var(--dark-soft)">
      ${statusbar()}
      <div class="result fail">
        <div class="kicker">SO CLOSE</div>
        <h2>${slipped ? '집게에서 놓쳤어요' : '아깝게 놓쳤어요'}</h2>
        <div class="prize ${slipped ? 'slipped' : ''}">
          ${dollImg(target.id, 150, '', slipped ? 'drop' : 'idle')}
        </div>
        ${slipped ? `<div class="slip-name">${esc(target.name)}</div>` : ''}
        <div class="streak">
          <div class="top">
            <span class="l">연속 실패 보너스</span>
            <span class="v">+${Math.min(Store.state.failStreak * FAIL_BONUS, MAX_RATE - m.baseRate)}% 확률</span>
          </div>
          ${meter((next / MAX_RATE) * 100, 'onDark')}
          <div class="cap">다음 판 성공률 ${next}%로 올라갔어요</div>
        </div>
        <div class="foot">
          <button class="btn btn--accent" data-act="again">티켓 ${m.cost}장으로 한 번 더</button>
          <button class="btn md btn--translucent-dark" data-act="others">다른 기계 보기</button>
        </div>
      </div>
    </div>`;

    bind(screenEl(), {
      again: () => {
        if (!Store.canAfford(m.cost)) { Sheets.ticketShort(m); return; }
        go('loading', m.id);
      },
      others: () => go('home'),
    });
  },

  /* --- 05 / 26 보관함 ---------------------------------------------------- */
  storage() {
    setTheme('');
    const counts = Store.prizeCounts();
    const owned = Object.keys(counts);
    const total = Store.state.prizes.length;
    const filter = App.storageFilter || 'all';

    let shown = DOLL_IDS.filter(id => counts[id]);
    if (filter === 'rare') shown = shown.filter(id => DOLLS[id].grade !== 'N');
    if (filter === 'dupe') shown = shown.filter(id => counts[id] > 1);

    const rare = owned.filter(id => DOLLS[id].grade !== 'N').length;
    const dupes = owned.reduce((s, id) => s + Math.max(0, counts[id] - 1), 0);

    screenEl().innerHTML = `<div class="screen">
      ${statusbar()}
      <div class="storage-head">
        <h2 class="h2">보관함</h2>
        <p>${total ? `인형 ${total}마리 · 도감 완성도 ${Store.codexPercent()}%` : '아직 모은 인형이 없어요'}</p>
      </div>

      ${total ? `
        <div class="pointcard">
          <div style="flex:1">
            <div class="l">모은 포인트</div>
            <div class="v">${fmt(Store.state.points)}P</div>
          </div>
          <button class="go" data-route="exchange">교환소 가기</button>
        </div>
        <div class="chiprow">
          <button class="chip sm" data-act="f" data-v="all"  aria-pressed="${filter === 'all'}">전체 ${total}</button>
          <button class="chip sm" data-act="f" data-v="rare" aria-pressed="${filter === 'rare'}">레어 ${rare}</button>
          <button class="chip sm" data-act="f" data-v="dupe" aria-pressed="${filter === 'dupe'}">중복 ${dupes}</button>
          <button class="chip sm" data-route="codex">도감</button>
        </div>
        <div class="scroll pad">
          <div class="prize-grid">
            ${shown.map(id => `
              <button class="pcard" data-act="doll" data-id="${id}">
                <span class="box" style="display:flex">
                  ${dollImg(id, 74)}
                  <span class="badge ${GRADE_CLASS[DOLLS[id].grade]}">${DOLLS[id].grade}</span>
                  ${counts[id] > 1 ? `<span class="dupe">×${counts[id]}</span>` : ''}
                </span>
                <span class="nm" style="display:block">${esc(DOLLS[id].name)}</span>
              </button>`).join('')}
            ${shown.length === 0 ? '<div class="sub" style="grid-column:1/-1;text-align:center;padding:24px 0">해당하는 인형이 없어요</div>' : ''}
          </div>
        </div>`
      : `
        <div class="empty">
          <div class="art">${dollImg('penguin', 88, 'opacity:.22')}</div>
          <h3>첫 인형을 뽑아보세요</h3>
          <p>뽑은 인형은 여기에 모이고<br>등급에 따라 포인트가 적립돼요</p>
          <button class="btn md auto btn--primary" style="margin-top:24px" data-tab="home">기계 보러 가기</button>
          <button class="btn sm auto btn--text" data-tab="mission">티켓 받는 방법 알아보기</button>
        </div>`}
      ${tabbar('storage')}
    </div>`;

    bind(screenEl(), {
      f: el => { App.storageFilter = el.dataset.v; Screens.storage(); },
      doll: el => Sheets.dollDetail(el.dataset.id),
    });
  },

  /* --- 29 인형 도감 ------------------------------------------------------ */
  codex() {
    setTheme('');
    const counts = Store.prizeCounts();
    const owned = Store.codexOwned();
    // The season roster is larger than the dolls in play; the rest stay locked.
    const lockedSlots = Math.max(0, CODEX_TOTAL - DOLL_IDS.length);

    screenEl().innerHTML = `<div class="screen">
      ${statusbar()}
      ${appbar('인형 도감')}
      <div style="margin:0 20px 16px" class="card pad">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:13px;font-weight:700">완성도</span>
          <span style="font-size:16px;font-weight:700;color:var(--green)">${owned} / ${CODEX_TOTAL}</span>
        </div>
        <div style="margin-top:11px">${meter((owned / CODEX_TOTAL) * 100, 'tall')}</div>
        <div style="margin-top:9px;font-size:11px;font-weight:600;color:var(--ink-45)">시즌1 컬렉션 완성 시 티켓 ${CODEX_REWARD_TICKETS}장 지급</div>
      </div>
      <div class="scroll pad">
        <div class="codex-grid">
          ${DOLL_IDS.map(id => counts[id]
            ? `<button class="unlocked" data-act="doll" data-id="${id}">${dollImg(id, 56)}</button>`
            : `<div class="locked">${icon('lock', 20)}</div>`).join('')}
          ${Array.from({ length: lockedSlots }, () => `<div class="locked">${icon('lock', 20)}</div>`).join('')}
        </div>
        <div style="height:24px"></div>
      </div>
    </div>`;

    bind(screenEl(), {
      back: () => go('storage'),
      doll: el => Sheets.dollDetail(el.dataset.id),
    });
  },

  /* --- 06 / 31 데일리 미션 ----------------------------------------------- */
  mission() {
    setTheme('');
    const allDone = Store.allMissionsClaimed();
    const claimable = Store.claimableTickets();
    const doneCount = MISSIONS.filter(m => Store.missionClaimed(m.id)).length;
    const resetIn = resetCountdown();

    screenEl().innerHTML = `<div class="screen">
      ${statusbar()}
      <div class="appbar">
        <button class="iconbtn" data-act="back" aria-label="뒤로">${icon('chevronLeft3', 20)}</button>
        <span class="appbar-title">데일리 미션</span>
        <span class="appbar-meta">초기화까지 ${resetIn}</span>
      </div>

      ${allDone ? `
        <div class="ticketcard done">
          <div class="eyebrow">ALL CLEAR</div>
          <div class="n">오늘 미션 전부 완료!</div>
          <div class="cap">${Store.state.bonusClaimed ? `보너스 티켓 ${MISSION_BONUS_TICKETS}장까지 받았어요 · ` : ''}총 ${Store.state.tickets}장 보유</div>
        </div>`
      : `
        <div class="ticketcard">
          <div class="top"><span class="tk">${icon('ticketFill', 24)}</span><span class="l">보유 티켓</span></div>
          <div class="n">${Store.state.tickets}장</div>
          ${meter((doneCount / MISSIONS.length) * 100, 'onGreen')}
          <div class="cap">오늘 미션 ${doneCount}/${MISSIONS.length} 완료 · 모두 끝내면 보너스 티켓 ${MISSION_BONUS_TICKETS}장</div>
        </div>`}

      <div class="scroll pad" style="display:flex;flex-direction:column;gap:9px">
        ${MISSIONS.map(m => missionRow(m)).join('')}

        ${allDone && !Store.state.bonusClaimed ? `
          <button class="btn btn--accent" data-act="bonus" style="margin-top:4px">보너스 티켓 ${MISSION_BONUS_TICKETS}장 받기</button>` : ''}

        ${allDone && Store.state.bonusClaimed ? `
          <div class="card pad" style="margin-top:8px;padding:20px;text-align:center">
            ${dollImg('duck', 76, 'margin:0 auto')}
            <div style="margin-top:12px;font-size:15px;font-weight:700">내일 새 미션이 열려요</div>
            <div style="margin-top:6px;font-size:12px;font-weight:600;color:var(--ink-50)">알림을 켜두면 초기화되는 순간 알려드려요</div>
            <button class="btn sm auto btn--accent" style="margin:16px auto 0" data-act="notify">알림 켜기</button>
          </div>` : ''}

        <div class="note" style="margin-top:2px">티켓은 현금으로 구매할 수 없어요. 미션과 출석으로만 모을 수 있습니다.</div>
        <div style="height:16px"></div>
      </div>
      ${tabbar('mission')}
    </div>`;

    bind(screenEl(), {
      back: () => go('home'),
      notify: () => Dialogs.permission(true),
      bonus: () => {
        const n = Store.claimMissionBonus();
        if (n) Dialogs.reward(n, '오늘의 미션을 전부 완료했어요');
      },
      mission: el => {
        const m = MISSIONS.find(x => x.id === el.dataset.id);
        if (!m) return;
        if (Store.missionComplete(m.id) && !Store.missionClaimed(m.id)) {
          const n = Store.claimMission(m.id);
          Dialogs.reward(n, `${m.title} 미션을 완료했어요`);
          return;
        }
        if (m.kind === 'ad') {
          if (!Store.adsLeft()) { toast('오늘은 광고를 모두 시청했어요', { tone: 'error' }); return; }
          Dialogs.ad();
          return;
        }
        if (m.kind === 'share') {
          Store.bumpMission('share');
          toast('공유 링크를 복사했어요', { tone: 'ok' });
          Screens.mission();
          return;
        }
        if (m.kind === 'play') { go('home'); return; }
        toast('출석은 매일 자동으로 쌓여요', { mini: true });
      },
    });
    void claimable;
  },

  /* --- 07 포인트 교환소 -------------------------------------------------- */
  exchange() {
    setTheme('');
    const convertible = Store.convertibleNH();

    screenEl().innerHTML = `<div class="screen">
      ${statusbar()}
      ${appbar('포인트 교환소')}
      <div class="balance">
        <div style="flex:1">
          <div class="l">보유 포인트</div>
          <div class="v">${fmt(Store.state.points)}<span>P</span></div>
        </div>
        ${dollImg('duck', 62)}
      </div>

      <div class="scroll">
        <div class="pad" style="display:flex;align-items:center;justify-content:space-between;padding-bottom:12px">
          <span style="font-size:15px;font-weight:700;letter-spacing:-.01em">이번 주 추첨 응모</span>
          <span class="sub">D-3 마감</span>
        </div>
        <div class="pad raffle-row" style="padding-bottom:16px">
          ${RAFFLES.map(r => `
            <button class="raffle" data-act="raffle" data-id="${r.id}">
              <span class="art" style="background:${r.bg};color:${r.iconColor};display:flex">${icon(r.icon, 30)}</span>
              <span class="nm" style="display:block">${esc(r.name)}</span>
              <span class="nt" style="display:block">${esc(r.note)}</span>
              <span class="ft" style="display:flex">
                <span class="c">${fmt(r.cost)}P</span>
                <span class="go">응모하기</span>
              </span>
            </button>`).join('')}
        </div>

        <div class="pad" style="padding-bottom:12px;font-size:15px;font-weight:700;letter-spacing:-.01em">포인트 전환</div>
        <div class="nh-card">
          <button class="top" style="width:100%;text-align:left" data-act="nh">
            <span class="nh-logo nh-logo--sm">NH</span>
            <span style="flex:1">
              <span class="t" style="display:block">NH멤버스 포인트로 전환</span>
              <span class="s" style="display:block">농협 계열사 어디서나 현금처럼</span>
            </span>
            <span class="chev">${icon('chevronRight3', 16)}</span>
          </button>
          <div class="rate">
            <div style="flex:1">
              <div class="l">전환 비율</div>
              <div class="row2">
                <b>100P</b><span class="arw">→</span><b class="to">${Math.round(100 * NH_RATE)}멤버스P</b>
              </div>
            </div>
            <div style="text-align:right">
              <div style="font-size:11px;font-weight:600;color:var(--ink-45)">최소 전환</div>
              <div style="margin-top:4px;font-size:13px;font-weight:700">${fmt(NH_MIN)}P</div>
            </div>
          </div>
          <div class="cta">
            <button class="btn md ${convertible ? 'btn--nh' : 'btn--disabled'}" data-act="convert" ${convertible ? '' : 'disabled'}>
              ${convertible ? `${fmt(convertible)}P 전환하기` : `${fmt(NH_MIN)}P부터 전환할 수 있어요`}
            </button>
            <div class="fine">NH멤버스 앱 연동 후 전환됩니다. 전환된 포인트는 되돌릴 수 없어요.</div>
          </div>
        </div>
        <div style="height:24px"></div>
      </div>
      ${tabbar('storage')}
    </div>`;

    bind(screenEl(), {
      back: () => go('storage'),
      raffle: el => Sheets.raffle(el.dataset.id),
      nh: () => go('nh-link'),
      convert: () => {
        if (!Store.state.nhLinked) { go('nh-link'); return; }
        Dialogs.convert(convertible);
      },
    });
  },

  /* --- 41 응모 내역 ------------------------------------------------------ */
  entries() {
    setTheme('');
    const filter = App.entryFilter || 'all';
    const all = Store.allEntries();
    const list = filter === 'all' ? all : all.filter(e => e.status === filter);

    screenEl().innerHTML = `<div class="screen">
      ${statusbar()}
      ${appbar('응모 내역')}
      <div class="chiprow">
        <button class="chip sm dark" data-act="f" data-v="all"  aria-pressed="${filter === 'all'}">전체</button>
        <button class="chip sm dark" data-act="f" data-v="wait" aria-pressed="${filter === 'wait'}">발표 대기</button>
        <button class="chip sm dark" data-act="f" data-v="win"  aria-pressed="${filter === 'win'}">당첨</button>
      </div>
      <div class="scroll pad" style="display:flex;flex-direction:column;gap:10px">
        ${list.length ? list.map(e => `
          <div class="entry ${e.status === 'lost' ? 'lost' : ''}">
            <div class="top">
              <span class="ic" style="background:${e.bg};color:${e.color}">${icon(e.icon, 21)}</span>
              <span style="flex:1">
                <span class="nm" style="display:block">${esc(e.name)}</span>
                <span class="mt" style="display:block">${esc(e.meta)}</span>
              </span>
              <span class="st ${e.status}">${{ win: '당첨', wait: `${e.announce} 발표`, lost: '미당첨' }[e.status]}</span>
            </div>
            ${e.status === 'win' ? `<button class="claim" data-act="claim" data-id="${e.id}">쿠폰 받기 (D-${e.claimDays})</button>` : ''}
          </div>`).join('') : `
          <div class="empty" style="padding-top:60px">
            <div class="art">${icon('inbox', 46)}</div>
            <h3>아직 내역이 없어요</h3>
            <p>교환소에서 포인트로 추첨에 응모하면<br>결과가 여기에 쌓여요</p>
            <button class="btn md auto btn--primary" style="margin-top:24px" data-route="exchange">교환소 가기</button>
          </div>`}
        <div style="height:24px"></div>
      </div>
    </div>`;

    bind(screenEl(), {
      back: () => go('my'),
      f: el => { App.entryFilter = el.dataset.v; Screens.entries(); },
      claim: () => toast('쿠폰함으로 보냈어요', { tone: 'ok' }),
    });
  },

  /* --- 08 마이페이지 ----------------------------------------------------- */
  my() {
    setTheme('');
    const acc = Store.state.account;
    const values = {
      exchange: `${fmt(Store.state.points)}P`,
      entries: `${Store.pendingEntries()}건`,
      nh: Store.state.nhLinked ? '연동됨' : '미연동',
    };

    screenEl().innerHTML = `<div class="screen">
      ${statusbar()}
      <button class="profile" data-act="editName">
        <span class="av">${dollImg(acc ? acc.avatar : 'penguin', 48)}</span>
        <span style="flex:1;text-align:left">
          <span class="nm" style="display:block">${esc(acc ? acc.nickname : '게스트')}</span>
          <span class="lv">${esc(Store.levelTitle())} Lv.${Store.level()}</span>
        </span>
        <span style="color:var(--ink-30);display:flex">${icon('chevronRight3', 20)}</span>
      </button>

      <div class="card level-card">
        <div class="top">
          <span class="lv">Lv.${Store.level()}</span>
          <span class="title">${esc(Store.levelTitle())}</span>
          <span class="count">인형 ${Store.state.wins}마리</span>
        </div>
        ${meter(Store.levelProgress().percent)}
        <div class="cap">${Store.levelProgress().left}마리 더 뽑으면 Lv.${Store.level() + 1} · ${esc(Store.levelTitle(Store.level() + 1))}</div>
      </div>

      <div class="card statgrid" style="margin:0 20px 18px;padding:18px">
        <div class="st"><div class="n">${Store.state.plays}</div><div class="l">총 플레이</div></div>
        <div class="div"></div>
        <div class="st"><div class="n" style="color:var(--green)">${Store.state.wins}</div><div class="l">성공</div></div>
        <div class="div"></div>
        <div class="st"><div class="n">${fmt(Store.state.points)}</div><div class="l">포인트</div></div>
      </div>

      <div class="scroll pad">
        <div class="card list">
          ${MY_MENU.map(i => `
            <button class="row" style="width:100%" data-act="menu" data-id="${i.id}">
              <span class="lead">${icon(i.icon, 16)}</span>
              <span class="label" style="text-align:left">${esc(i.label)}</span>
              <span class="value">${esc(values[i.id] || '')}</span>
              <span class="chev">${icon('chevronRight3', 18)}</span>
            </button>`).join('')}
        </div>
        <div class="card list" style="margin-top:14px">
          <button class="row" style="width:100%" data-route="settings">
            <span class="lead">${icon('gear', 16)}</span>
            <span class="label" style="text-align:left">설정</span>
            <span class="chev">${icon('chevronRight3', 18)}</span>
          </button>
        </div>
        <div style="height:24px"></div>
      </div>
      ${tabbar('my')}
    </div>`;

    bind(screenEl(), {
      editName: () => Sheets.rename(),
      menu: el => {
        const item = MY_MENU.find(x => x.id === el.dataset.id);
        if (!item) return;
        if (item.route) { go(item.route); return; }
        if (item.action === 'invite') { toast('초대 링크를 복사했어요', { tone: 'ok' }); return; }
        toast('고객센터는 준비 중이에요', { mini: true });
      },
    });
  },

  /* --- 39 설정 ----------------------------------------------------------- */
  settings() {
    setTheme('');
    const s = Store.state.settings;
    const acc = Store.state.account;

    screenEl().innerHTML = `<div class="screen">
      ${statusbar()}
      ${appbar('설정')}
      <div class="scroll pad">
        <div class="settings-group">
          <div class="group-label">계정</div>
          <div class="card list">
            <div class="row"><span class="label">연결된 계정</span><span class="value">${esc(acc ? acc.provider : '게스트')}</span></div>
            <div class="row"><span class="label">NH멤버스 연동</span><span class="value" style="color:${Store.state.nhLinked ? 'var(--nh-green)' : ''}">${Store.state.nhLinked ? '연동됨' : '미연동'}</span></div>
            <button class="row" style="width:100%" data-act="rename"><span class="label" style="text-align:left">닉네임 변경</span><span class="chev">${icon('chevronRight3', 18)}</span></button>
          </div>
        </div>

        <div class="settings-group">
          <div class="group-label">앱</div>
          <div class="card list">
            ${toggleRow('haptics', '진동 피드백', s.haptics)}
            ${toggleRow('sfx', '효과음', s.sfx)}
            ${toggleRow('dataSaver', '데이터 절약 모드', s.dataSaver)}
            <button class="row" style="width:100%" data-act="cache"><span class="label" style="text-align:left">캐시 삭제</span><span class="value">34.2MB</span></button>
          </div>
        </div>

        <div class="settings-group">
          <div class="group-label">정보</div>
          <div class="card list">
            <button class="row" style="width:100%" data-act="terms"><span class="label" style="text-align:left">이용약관 · 개인정보 처리방침</span><span class="chev">${icon('chevronRight3', 18)}</span></button>
            <div class="row"><span class="label">버전</span><span class="value">1.0.0 (최신)</span></div>
          </div>
        </div>

        <div class="account-actions">
          <button data-act="logout">로그아웃</button>
          <button data-act="withdraw">회원 탈퇴</button>
        </div>
      </div>
    </div>`;

    bind(screenEl(), {
      back: () => go('my'),
      rename: () => Sheets.rename(),
      cache: () => toast('캐시를 삭제했어요', { tone: 'ok' }),
      terms: () => toast('약관 전문은 준비 중이에요', { mini: true }),
      toggle: el => {
        const k = el.dataset.k;
        Store.state.settings[k] = !Store.state.settings[k];
        Store.save();
        el.setAttribute('aria-checked', String(Store.state.settings[k]));
        if (k === 'haptics' && Store.state.settings[k]) haptic(20);
      },
      logout: () => {
        Store.state.account = null; Store.save();
        Overlay.closeAll(); go('login');
      },
      withdraw: () => Sheets.withdraw(),
    });
  },

  /* --- 40 알림 설정 ------------------------------------------------------ */
  notif() {
    setTheme('');
    const n = Store.state.notifications;

    screenEl().innerHTML = `<div class="screen">
      ${statusbar()}
      ${appbar('알림 설정')}
      ${n.osGranted ? '' : `
        <div style="margin:0 20px 16px" class="banner">
          <span class="ic">${icon('bell', 20)}</span>
          <div class="tx">
            <div style="font-size:13px;font-weight:700">기기 알림이 꺼져 있어요</div>
            <div style="margin-top:4px;font-size:11px;font-weight:600;color:rgba(138,106,0,.85)">허용하면 아래 알림을 받을 수 있어요</div>
          </div>
          <button class="pillbtn btn--dark" data-act="grant">설정 열기</button>
        </div>`}
      <div class="scroll pad">
        <div class="card list" style="${n.osGranted ? '' : 'opacity:.55'}">
          ${notifRow('missions', '데일리 미션 초기화', '매일 오전 6시', n.missions, n.osGranted)}
          ${notifRow('raffle', '추첨 결과', '응모한 이벤트 발표 시', n.raffle, n.osGranted)}
          ${notifRow('newMachine', '신규 기계 오픈', '', n.newMachine, n.osGranted)}
          ${notifRow('marketing', '마케팅 정보', '선택 · 동의일 2026.08.01', n.marketing, n.osGranted)}
        </div>
        <div style="height:24px"></div>
      </div>
    </div>`;

    bind(screenEl(), {
      back: () => go('my'),
      grant: () => { Store.state.notifications.osGranted = true; Store.save(); Screens.notif(); toast('기기 알림을 켰어요', { tone: 'ok' }); },
      toggleN: el => {
        if (!Store.state.notifications.osGranted) { toast('먼저 기기 알림을 켜주세요', { tone: 'error' }); return; }
        const k = el.dataset.k;
        Store.state.notifications[k] = !Store.state.notifications[k];
        Store.save();
        el.setAttribute('aria-checked', String(Store.state.notifications[k]));
      },
    });
  },

  /* --- 35 NH멤버스 연동 -------------------------------------------------- */
  'nh-link'() {
    setTheme('');
    screenEl().innerHTML = `<div class="screen">
      ${statusbar()}
      ${appbar('NH멤버스 연동')}
      <div style="margin:0 20px 18px;border-radius:var(--r-2xl);background:linear-gradient(100deg,var(--nh-green),var(--nh-green-deep));padding:24px 22px;color:#fff;display:flex;align-items:center;gap:14px">
        <span class="nh-logo nh-logo--md">NH</span>
        <div style="flex:1">
          <div style="font-size:17px;font-weight:700;letter-spacing:-.01em">NH멤버스 포인트</div>
          <div style="margin-top:4px;font-size:12px;font-weight:600;opacity:.82">농협 계열사 어디서나 현금처럼 사용</div>
        </div>
        ${Store.state.nhLinked ? `<span style="width:26px;height:26px;border-radius:50%;background:var(--nh-gold);color:var(--nh-gold-ink);display:flex;align-items:center;justify-content:center">${icon('checkThick', 15)}</span>` : ''}
      </div>

      <div class="scroll pad" style="display:flex;flex-direction:column;gap:12px">
        <label class="field">
          <span class="lbl">이름</span>
          <span class="box"><input id="nhName" type="text" placeholder="실명을 입력하세요" autocomplete="off"></span>
        </label>
        <label class="field">
          <span class="lbl">휴대폰 번호</span>
          <span class="box" style="padding-right:6px">
            <input id="nhPhone" type="tel" inputmode="numeric" placeholder="010-0000-0000" autocomplete="off">
            <button class="pillbtn btn--dark" style="height:40px;padding:0 14px;border-radius:12px" data-act="send">인증 요청</button>
          </span>
        </label>
        <label class="field" id="codeField" style="display:none">
          <span class="lbl">인증번호</span>
          <span class="box">
            <input id="nhCode" type="tel" inputmode="numeric" maxlength="6" placeholder="6자리" autocomplete="one-time-code">
            <span class="count" id="codeTimer" style="color:var(--danger);font-weight:700"></span>
          </span>
          <span style="margin-top:8px;font-size:11px;font-weight:600;color:var(--ink-45);display:block">문자를 받지 못했다면 재요청해 주세요</span>
        </label>
        <div style="margin-top:4px;padding:14px;border-radius:14px;background:rgba(0,166,81,.07);font-size:11px;font-weight:600;line-height:1.6;color:var(--nh-green-deep)">
          본인 확인을 위해 이름과 휴대폰 번호를 NH멤버스에 전달합니다. 동의 후에도 마이페이지에서 연동을 해제할 수 있어요.
        </div>
      </div>

      <div style="padding:16px 20px calc(34px + var(--safe-b))">
        <button class="btn btn--disabled" id="linkBtn" data-act="link" disabled>연동 완료하기</button>
      </div>
    </div>`;

    let countdown = null;
    const codeField = $('#codeField'), linkBtn = $('#linkBtn');
    const refresh = () => {
      const ok = $('#nhName').value.trim().length >= 2 &&
                 codeField.style.display !== 'none' &&
                 $('#nhCode').value.trim().length >= 3;
      linkBtn.disabled = !ok;
      linkBtn.classList.toggle('btn--disabled', !ok);
      linkBtn.classList.toggle('btn--nh', ok);
    };
    ['nhName', 'nhPhone'].forEach(id => $('#' + id).addEventListener('input', refresh));

    bind(screenEl(), {
      back: () => go('exchange'),
      send: () => {
        const phone = $('#nhPhone').value.replace(/\D/g, '');
        if (phone.length < 10) { toast('휴대폰 번호를 확인해 주세요', { tone: 'error' }); return; }
        codeField.style.display = '';
        $('#nhCode').addEventListener('input', refresh);
        $('#nhCode').focus();
        toast('인증번호를 보냈어요', { tone: 'ok' });
        let left = 180;
        clearInterval(countdown);
        countdown = setInterval(() => {
          left -= 1;
          const t = $('#codeTimer');
          if (!t) { clearInterval(countdown); return; }
          t.textContent = mmss(left);
          if (left <= 0) clearInterval(countdown);
        }, 1000);
        refresh();
      },
      link: () => {
        clearInterval(countdown);
        Store.state.nhLinked = true; Store.save();
        toast('NH멤버스 계정을 연동했어요', { tone: 'ok' });
        go('exchange');
      },
    });
  },

  /* --- 37 전환 완료 ------------------------------------------------------ */
  'convert-done'(payload) {
    setTheme('');
    shellEl().dataset.theme = '';
    shellEl().style.background = 'var(--nh-green)';
    const [used, got, tx] = String(payload).split('|');

    screenEl().innerHTML = `<div class="screen" style="align-items:center">
      ${statusbar()}
      <div class="convert-done">
        <div class="blob"></div>
        <span class="nh-logo nh-logo--lg">NH</span>
        <h2>전환이 끝났어요</h2>
        <div class="receipt">
          <div class="ln"><span class="l">사용 포인트</span><span class="v">${fmt(used)}P</span></div>
          <div class="hr"></div>
          <div class="ln"><span class="l">받은 멤버스 포인트</span><span class="v big">${fmt(got)}P</span></div>
          <div class="txid">거래번호 ${esc(tx)}</div>
        </div>
        <div style="margin-top:auto;padding-bottom:calc(34px + var(--safe-b));width:100%;display:flex;flex-direction:column;gap:10px;position:relative">
          <button class="btn btn--nh-gold" data-act="nhApp">NH멤버스 앱에서 확인</button>
          <button class="btn md btn--translucent" data-act="back">교환소로 돌아가기</button>
        </div>
      </div>
    </div>`;

    $('.statusbar', screenEl()).style.color = '#fff';
    bind(screenEl(), {
      nhApp: () => toast('NH멤버스 앱 연동은 준비 중이에요', { mini: true }),
      back: () => { shellEl().style.background = ''; go('exchange'); },
    });
  },

  /* --- 44 서버 점검 ------------------------------------------------------ */
  maintenance() {
    setTheme('');
    shellEl().style.background = 'var(--ink)';
    screenEl().innerHTML = `<div class="screen">
      ${statusbar()}
      <div class="maint">
        ${dollImg('cat', 128)}
        <div class="tag">MAINTENANCE</div>
        <h3>잠시 점검 중이에요</h3>
        <p>더 안정적인 뽑기를 위해 서버를 정비하고 있어요.<br>점검 중 사용한 티켓은 모두 복구됩니다.</p>
        <div class="box">
          <div class="ln"><span class="l">점검 시간</span><span class="v">08.08 02:00 ~ 06:00</span></div>
          <div class="ln"><span class="l">남은 시간</span><span class="v hi">약 42분</span></div>
        </div>
        <button class="btn md auto btn--translucent-dark" style="margin-top:22px" data-act="back">공지 확인하기</button>
      </div>
    </div>`;
    $('.statusbar', screenEl()).style.color = '#fff';
    bind(screenEl(), { back: () => { shellEl().style.background = ''; go('home'); } });
  },

  /* --- 43 네트워크 오류 -------------------------------------------------- */
  offline() {
    setTheme('');
    screenEl().innerHTML = `<div class="screen">
      ${statusbar(true)}
      <div class="empty">
        <div class="art" style="border-radius:36px;width:112px;height:112px">${icon('globe', 46)}</div>
        <h3>인터넷에 연결할 수 없어요</h3>
        <p>Wi-Fi 또는 데이터 연결을 확인한 뒤<br>다시 시도해 주세요</p>
        <button class="btn md auto btn--primary" style="margin-top:24px" data-act="retry">${icon('refresh', 17)}다시 시도</button>
        <div style="margin-top:14px;font-size:12px;font-weight:600;color:var(--ink-40)">보관함은 오프라인에서도 볼 수 있어요</div>
      </div>
    </div>`;

    toast('오프라인 상태예요', { action: '재연결', duration: 6000, onAction: () => Screens.offline() });
    bind(screenEl(), {
      retry: () => {
        if (navigator.onLine) { toast('다시 연결됐어요', { tone: 'ok' }); go('home'); }
        else toast('아직 연결되지 않았어요', { tone: 'error' });
      },
    });
  },
};

/* ------------------------------------------------------------- fragments */

function machineCard(m) {
  return `<button class="mcard" data-act="machine" data-id="${m.id}" ${m.open ? '' : 'data-down'}>
    <span class="thumb" style="background:${m.bg};display:flex">
      ${dollImg(m.hero, 84)}
      <span class="badge ${m.open ? m.tagClass : 'badge--down'}">${m.open ? m.tag : '점검'}</span>
    </span>
    <span class="name" style="display:block">${esc(m.name)}</span>
    <span class="meta" style="display:flex">
      <span class="dot"></span>
      <span class="st">${m.open ? '바로 시작' : '점검중'}</span>
      <span class="cost">티켓 ${m.cost}장</span>
    </span>
  </button>`;
}

/** Five taps on the wordmark within three seconds opens the test panel. */
const EGG_TAPS = 5;
let eggCount = 0;
let eggTimer = null;

function tapEasterEgg() {
  clearTimeout(eggTimer);
  eggCount += 1;
  eggTimer = setTimeout(() => { eggCount = 0; }, 3000);

  const left = EGG_TAPS - eggCount;
  if (left <= 0) {
    eggCount = 0;
    haptic(30);
    Sheets.devTools();
  } else if (left <= 2) {
    haptic(8);
    toast(`${left}번 더!`, { mini: true, duration: 900 });
  }
}

function resultRow(m, term) {
  return `<button class="result-row" data-act="machine" data-id="${m.id}">
    <span class="thumb" style="background:${m.bg}">${dollImg(m.hero, 34)}</span>
    <span style="flex:1;text-align:left">
      <span class="nm" style="display:block">${highlight(m.name, term)}</span>
      <span class="mt" style="display:block">티켓 ${m.cost}장 · 난이도 ${m.difficulty}${m.open ? '' : ' · 점검중'}</span>
    </span>
    <span style="color:var(--ink-25);display:flex">${icon('chevronRight3', 18)}</span>
  </button>`;
}

function missionRow(m) {
  const prog = Store.missionProgress(m.id);
  const done = Store.missionComplete(m.id);
  const claimed = Store.missionClaimed(m.id);
  const label = claimed ? '완료' : done ? '받기' : m.btn;
  const cls = claimed ? '' : done ? 'btn--accent' : m.btnClass;

  return `<div class="mission" ${claimed ? 'data-done' : ''}>
    <div class="ic" style="background:${m.iconBg};color:${m.iconColor}">${icon(m.icon, 22)}</div>
    <div class="body">
      <div class="t">${esc(m.title)}</div>
      <div class="m">
        <span class="rw">티켓 ${m.reward}장${claimed ? ' 받음' : ''}</span>
        <span class="pg">${claimed ? '' : `${prog}/${m.goal}`}</span>
      </div>
    </div>
    ${claimed
      ? `<span class="tick">${icon('checkThick', 15)}</span>`
      : `<button class="act ${cls}" data-act="mission" data-id="${m.id}">${label}</button>`}
  </div>`;
}

function toggleRow(key, label, on) {
  return `<div class="row">
    <span class="label">${esc(label)}</span>
    <button class="toggle" role="switch" aria-checked="${on}" data-act="toggle" data-k="${key}" aria-label="${esc(label)}"><i></i></button>
  </div>`;
}

function notifRow(key, title, sub, on, enabled) {
  return `<div class="row tall">
    <span class="stack">
      <span class="t" style="display:block">${esc(title)}</span>
      ${sub ? `<span class="s" style="display:block">${esc(sub)}</span>` : ''}
    </span>
    <button class="toggle" role="switch" aria-checked="${on && enabled}" data-act="toggleN" data-k="${key}" aria-label="${esc(title)}"><i></i></button>
  </div>`;
}

function highlight(text, term) {
  if (!term) return esc(text);
  const i = text.indexOf(term);
  if (i < 0) return esc(text);
  return esc(text.slice(0, i)) + '<mark>' + esc(term) + '</mark>' + esc(text.slice(i + term.length));
}

/** Hours:minutes until the next local midnight, for the mission reset label. */
function resetCountdown() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const mins = Math.floor((next - now) / 60000);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
