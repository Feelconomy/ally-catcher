/* Bottom sheets and dialogs — the modal half of the spec
   (screens 11, 13, 14, 21, 23, 27, 28, 30, 32, 33, 34, 36, 38, 42, 45). */

const Sheets = {

  /* --- 11 약관 동의 ------------------------------------------------------ */
  terms() {
    const items = [
      { k: 'service',   label: '[필수] 서비스 이용약관',   required: true,  link: true },
      { k: 'privacy',   label: '[필수] 개인정보 처리방침', required: true,  link: true },
      { k: 'age',       label: '[필수] 만 14세 이상입니다', required: true,  link: false },
      { k: 'marketing', label: '[선택] 마케팅 정보 수신',  required: false, link: false },
    ];
    const state = { service: false, privacy: false, age: false, marketing: false };

    const { node, close } = sheet(`
      <h3>약관에 동의해 주세요</h3>
      <button class="terms-all" style="margin-top:18px" data-act="all">
        <span class="check lg" id="allCheck">${icon('checkThick', 14)}</span>
        <span class="t">전체 동의</span>
      </button>
      <div style="margin-top:6px;display:flex;flex-direction:column">
        ${items.map(i => `
          <div class="term">
            <button class="check" data-act="one" data-k="${i.k}" role="checkbox" aria-checked="false" aria-label="${esc(i.label)}">${icon('checkThick', 13)}</button>
            <button class="t ${i.required ? '' : 'opt'}" data-act="one" data-k="${i.k}">${esc(i.label)}</button>
            ${i.link ? `<span class="chev">${icon('chevronRight3', 16)}</span>` : ''}
          </div>`).join('')}
      </div>
      <button class="btn btn--disabled" style="margin-top:14px" id="agree" data-act="agree" disabled>동의하고 계속</button>`,
      (node, close) => {
        const paint = () => {
          items.forEach(i => {
            const btn = $(`[data-act="one"][data-k="${i.k}"]`, node);
            btn.setAttribute('aria-checked', String(state[i.k]));
            btn.classList.toggle('is-on', state[i.k]);
            btn.setAttribute('aria-checked', String(state[i.k]));
          });
          $$('.check[data-k]', node).forEach(c => c.setAttribute('aria-checked', String(state[c.dataset.k])));
          const all = items.every(i => state[i.k]);
          $('#allCheck', node).setAttribute('aria-checked', String(all));
          const ok = items.filter(i => i.required).every(i => state[i.k]);
          const btn = $('#agree', node);
          btn.disabled = !ok;
          btn.classList.toggle('btn--disabled', !ok);
          btn.classList.toggle('btn--primary', ok);
        };

        bind(node, {
          all: () => {
            const turnOn = !items.every(i => state[i.k]);
            items.forEach(i => { state[i.k] = turnOn; });
            paint();
          },
          one: el => { state[el.dataset.k] = !state[el.dataset.k]; paint(); },
          agree: () => {
            Store.state.terms = Object.assign({}, state);
            Store.save();
            close();
            go('profile');
          },
        });
        paint();
      });
    void node; void close;
  },

  /* --- 21 티켓 부족 ------------------------------------------------------ */
  ticketShort(machine) {
    const have = Store.state.tickets;
    const adsLeft = Store.adsLeft();
    const missionsLeft = Store.remainingMissions();

    sheet(`
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:48px;height:48px;border-radius:var(--r-lg);background:var(--danger-bg);color:var(--danger);display:flex;align-items:center;justify-content:center">${icon('ticketFill', 24)}</div>
        <div>
          <h3 style="margin:0">티켓이 부족해요</h3>
          <div style="margin-top:4px;font-size:13px;font-weight:600;color:var(--ink-50)">보유 ${have}장 · 필요 ${machine.cost}장</div>
        </div>
      </div>
      <div style="margin-top:20px;display:flex;flex-direction:column;gap:9px">
        <button class="offer" data-act="ad" ${adsLeft ? '' : 'disabled style="opacity:.5"'}>
          <span class="ic" style="background:var(--yellow-soft);color:var(--yellow-ink)">${icon('play', 19)}</span>
          <span class="body">
            <span class="t" style="display:block">광고 보고 티켓 ${AD_TICKETS}장</span>
            <span class="s" style="display:block">오늘 ${adsLeft}회 남음 · ${AD_SECONDS}초</span>
          </span>
          <span class="go" style="background:var(--yellow);color:var(--ink)">시청</span>
        </button>
        <button class="offer" data-act="mission">
          <span class="ic" style="background:var(--success-bg);color:var(--success-ink)">${icon('checkThick', 19)}</span>
          <span class="body">
            <span class="t" style="display:block">데일리 미션 하러 가기</span>
            <span class="s" style="display:block">남은 미션 ${missionsLeft}개 · 최대 ${Store.claimableTickets()}장</span>
          </span>
          <span class="go" style="background:var(--green);color:#fff">이동</span>
        </button>
      </div>
      <div class="note" style="margin-top:14px">티켓은 현금으로 구매할 수 없어요. 미션·출석으로만 모을 수 있습니다.</div>
      <button class="btn md btn--text" style="margin-top:14px" data-close>닫기</button>`,
      (node, close) => bind(node, {
        ad: () => { close(); Dialogs.ad(machine); },
        mission: () => { close(); go('mission'); },
      }));
  },

  /* --- 27 인형 상세 ------------------------------------------------------ */
  dollDetail(dollId) {
    const d = DOLLS[dollId];
    const count = Store.prizeCounts()[dollId] || 0;
    const dupes = Store.duplicatesOf(dollId);
    const first = Store.firstAcquired(dollId);

    sheet(`
      <div class="doll-hero" style="background:${d.bg}">${dollImg(d.id, 118)}</div>
      <div style="margin-top:16px;text-align:center">
        <span style="display:inline-flex;padding:4px 10px;border-radius:var(--r-sm);background:var(--ink);color:var(--yellow);font-size:10px;font-weight:700">${d.grade} 등급</span>
        <h3 style="margin-top:9px">${esc(d.name)}</h3>
        <div style="margin-top:5px;font-size:12px;font-weight:600;color:var(--ink-45)">${first ? dateLabel(first) : '-'} 획득 · 보유 ${count}개</div>
      </div>
      <div class="doll-facts">
        <div><div class="l">획득 확률</div><div class="v">${d.rate}%</div></div>
        <div><div class="l">보유자</div><div class="v">${d.grade === 'SR' ? '상위 3%' : d.grade === 'R' ? '상위 21%' : '흔함'}</div></div>
        <div><div class="l">교환 가치</div><div class="v" style="color:var(--green)">${d.points}P</div></div>
      </div>
      <div class="btn-row" style="margin-top:14px">
        <button class="btn md btn--neutral" data-act="brag">자랑하기</button>
        <button class="btn md btn--dark" data-act="rep">프로필 대표로</button>
      </div>
      <button class="btn md btn--outline" style="margin-top:9px" data-act="trade" ${dupes ? '' : 'disabled'}>
        ${dupes ? `중복 ${dupes}개 포인트로 교환` : '교환할 중복이 없어요'}
      </button>`,
      (node, close) => bind(node, {
        brag: () => { Store.bumpMission('share'); close(); toast('자랑 카드를 복사했어요', { tone: 'ok' }); },
        rep: () => {
          if (Store.state.account) { Store.state.account.avatar = d.id; Store.save(); }
          close(); toast('프로필 대표 인형을 바꿨어요', { mini: true }); go('my');
        },
        trade: () => { close(); Dialogs.trade(d.id); },
      }));
  },

  /* --- 33 추첨 응모 ------------------------------------------------------ */
  raffle(raffleId) {
    const r = RAFFLES.find(x => x.id === raffleId);
    if (!r) return;
    let count = 1;
    const maxCount = Math.max(1, Math.floor(Store.state.points / r.cost));

    const { node } = sheet(`
      <div style="display:flex;align-items:center;gap:13px">
        <div style="width:56px;height:56px;border-radius:var(--r-xl);background:${r.bg};color:${r.iconColor};display:flex;align-items:center;justify-content:center">${icon(r.icon, 26)}</div>
        <div style="flex:1">
          <h3 style="margin:0;font-size:18px">${esc(r.name)}</h3>
          <div style="margin-top:4px;font-size:12px;font-weight:600;color:var(--ink-50)">추첨 ${r.winners}명 · ${r.announce} 발표</div>
        </div>
      </div>
      <div class="entry-calc">
        <div class="ln" style="height:28px">
          <span class="l">응모 수량</span>
          <span class="stepper">
            <button data-act="minus" aria-label="줄이기">${icon('minus', 14)}</button>
            <span class="n" id="cnt">1</span>
            <button class="on" data-act="plus" aria-label="늘리기">${icon('plusThick', 14)}</button>
          </span>
        </div>
        <div class="hr"></div>
        <div class="ln"><span class="l">사용 포인트</span><span class="v" id="use">${fmt(r.cost)}P</span></div>
        <div class="ln"><span class="l">남는 포인트</span><span class="v ok" id="rest">${fmt(Store.state.points - r.cost)}P</span></div>
      </div>
      <div style="margin-top:12px;display:flex;align-items:flex-start;gap:9px">
        <span class="check square" aria-checked="true" style="background:var(--green);box-shadow:none;color:#fff;width:20px;height:20px;border-radius:6px">${icon('checkThick', 12)}</span>
        <span style="font-size:11px;font-weight:600;line-height:1.6;color:var(--ink-50)">응모에 사용한 포인트는 환불되지 않으며, 당첨 결과는 앱 알림으로 안내됩니다.</span>
      </div>
      <button class="btn btn--primary" style="margin-top:16px" id="submit" data-act="submit"></button>`,
      (node, close) => {
        const paint = () => {
          const use = r.cost * count;
          const rest = Store.state.points - use;
          $('#cnt', node).textContent = count;
          $('#use', node).textContent = fmt(use) + 'P';
          const restEl = $('#rest', node);
          restEl.textContent = fmt(Math.max(0, rest)) + 'P';
          restEl.className = 'v ' + (rest < 0 ? 'bad' : 'ok');
          $('[data-act="minus"]', node).disabled = count <= 1;
          $('[data-act="plus"]', node).disabled = count >= maxCount;
          $('#submit', node).textContent = `${fmt(use)}P로 ${count}회 응모`;
        };
        bind(node, {
          minus: () => { if (count > 1) { count--; paint(); } },
          plus:  () => { if (count < maxCount) { count++; paint(); } },
          submit: () => {
            const use = r.cost * count;
            if (Store.state.points < use) { close(); Dialogs.pointShort(use); return; }
            Store.enterRaffle(r, count);
            close();
            toast(`${count}회 응모를 완료했어요`, { tone: 'ok', action: '내역', onAction: () => go('entries') });
            go('exchange');
          },
        });
        paint();
      });
    void node;
  },

  /* --- 42 회원 탈퇴 ------------------------------------------------------ */
  withdraw() {
    const counts = Store.prizeCounts();
    let agreed = false;

    sheet(`
      <h3 style="font-size:20px">정말 탈퇴하시겠어요?</h3>
      <p>탈퇴하면 아래 자산이 즉시 삭제되고 복구할 수 없어요.</p>
      <div class="danger-list">
        ${[
          `보유 티켓 ${Store.state.tickets}장`,
          `모은 포인트 ${fmt(Store.state.points)}P`,
          `인형 ${Store.state.prizes.length}마리 · 도감 기록 ${Object.keys(counts).length}종`,
          `발표 대기중인 응모 ${Store.pendingEntries()}건`,
        ].map(t => `<div class="ln"><span class="x">${icon('close', 14)}</span><span class="t">${esc(t)}</span></div>`).join('')}
      </div>
      <div style="margin-top:14px;display:flex;align-items:center;gap:9px">
        <button class="check square" data-act="agree" role="checkbox" aria-checked="false" style="width:22px;height:22px">${icon('checkThick', 12)}</button>
        <button style="font-size:12px;font-weight:600;color:var(--ink-60);text-align:left" data-act="agree">위 내용을 확인했고 탈퇴에 동의합니다</button>
      </div>
      <div style="margin-top:18px;display:flex;flex-direction:column;gap:9px">
        <button class="btn md btn--primary" data-close>계속 사용하기</button>
        <button class="btn md btn--disabled" id="go" data-act="go" disabled>탈퇴하기</button>
      </div>`,
      (node, close) => {
        bind(node, {
          agree: () => {
            agreed = !agreed;
            $('.check[data-act="agree"]', node).setAttribute('aria-checked', String(agreed));
            const btn = $('#go', node);
            btn.disabled = !agreed;
            btn.classList.toggle('btn--disabled', !agreed);
            btn.style.background = agreed ? '#fff' : '';
            btn.style.boxShadow = agreed ? 'inset 0 0 0 1.5px var(--danger)' : '';
            btn.style.color = agreed ? 'var(--danger)' : '';
          },
          go: () => { Store.reset(); close(); Overlay.closeAll(); toast('탈퇴가 완료됐어요', { mini: true }); go('splash'); },
        });
      });
  },

  /* --- 테스트 도구 (이스터 에그) -----------------------------------------
     Hidden behind five taps on the 올리캐쳐 wordmark. Not part of the product
     spec — tickets are otherwise earned only through missions and attendance. */
  devTools() {
    let amount = 10;

    sheet(`
      <div style="display:flex;align-items:center;gap:11px">
        <div style="width:44px;height:44px;border-radius:14px;background:var(--info-bg);color:var(--info-ink);display:flex;align-items:center;justify-content:center;font-size:20px">🧪</div>
        <div style="flex:1">
          <h3 style="margin:0;font-size:19px">테스트 도구</h3>
          <div style="margin-top:4px;font-size:12px;font-weight:600;color:var(--ink-50)">숨겨진 메뉴예요. 실제 서비스에는 없습니다.</div>
        </div>
      </div>

      <div class="entry-calc" style="margin-top:18px">
        <div class="ln" style="height:28px">
          <span class="l">충전할 티켓</span>
          <span class="stepper">
            <button data-act="minus" aria-label="줄이기">${icon('minus', 14)}</button>
            <input id="devAmt" class="dev-amt" type="tel" inputmode="numeric" value="10" aria-label="충전할 티켓 수">
            <button class="on" data-act="plus" aria-label="늘리기">${icon('plusThick', 14)}</button>
          </span>
        </div>
        <div class="hr"></div>
        <div class="ln"><span class="l">보유 티켓</span><span class="v" id="devHave">${Store.state.tickets}장</span></div>
      </div>
      <button class="btn btn--primary" style="margin-top:14px" data-act="charge">티켓 충전하기</button>

      <div style="margin-top:22px" class="group-label">화면 바로가기</div>
      <button class="btn md btn--outline" data-act="onboarding">온보딩 처음부터 보기</button>

      <button class="btn md btn--text" style="margin-top:10px" data-close>닫기</button>`,
      (node, close) => {
        const input = $('#devAmt', node);
        const clamp = () => {
          amount = Math.max(1, Math.min(999, parseInt(input.value, 10) || 1));
          input.value = amount;
        };
        input.addEventListener('input', () => {
          input.value = input.value.replace(/\D/g, '').slice(0, 3);
        });
        input.addEventListener('blur', clamp);

        bind(node, {
          minus: () => { clamp(); amount = Math.max(1, amount - 5); input.value = amount; },
          plus:  () => { clamp(); amount = Math.min(999, amount + 5); input.value = amount; },
          charge: () => {
            clamp();
            Store.addTickets(amount);
            $('#devHave', node).textContent = Store.state.tickets + '장';
            toast(`티켓 ${amount}장을 충전했어요`, { tone: 'ok' });
            if (['home', 'mission', 'play'].includes(App.route)) Screens[App.route] && Screens[App.route]();
          },
          onboarding: () => { close(); go('onboarding'); },
        });
      });
  },

  /* --- 닉네임 변경 ------------------------------------------------------- */
  rename() {
    const cur = Store.state.account ? Store.state.account.nickname : '';
    sheet(`
      <h3>닉네임 변경</h3>
      <label class="field" style="margin-top:18px">
        <span class="box"><input id="rn" type="text" maxlength="10" value="${esc(cur)}" placeholder="닉네임을 입력하세요"><span class="count" id="rc">0/10</span></span>
      </label>
      <button class="btn btn--primary" style="margin-top:16px" data-act="save">저장</button>`,
      (node, close) => {
        const input = $('#rn', node);
        const paint = () => { $('#rc', node).textContent = `${input.value.length}/10`; };
        input.addEventListener('input', paint); paint(); input.focus();
        bind(node, {
          save: () => {
            const v = input.value.trim();
            if (v.length < 2) { toast('2자 이상 입력해 주세요', { tone: 'error' }); return; }
            if (!Store.state.account) Store.state.account = { provider: '게스트', avatar: 'penguin' };
            Store.state.account.nickname = v; Store.save();
            close(); toast('닉네임을 변경했어요', { mini: true });
            if (App.route === 'my') Screens.my();
          },
        });
      });
  },
};

const Dialogs = {

  /* --- 13 알림 권한 ------------------------------------------------------ */
  permission(fromMission) {
    dialog(`
      <div class="art lg" style="background:var(--yellow-soft);color:var(--yellow-ink)">${icon('bellPlus', 28)}</div>
      <h3>알림을 받아볼까요?</h3>
      <p>데일리 미션 초기화, 추첨 당첨 결과를<br>놓치지 않고 알려드려요</p>
      <div class="actions">
        <button class="btn md btn--primary" data-act="allow">알림 받기</button>
        <button class="btn sm btn--text" data-act="later">나중에</button>
      </div>`,
      (node, close) => bind(node, {
        allow: () => {
          Store.state.notifications.osGranted = true;
          Store.state.notifications.missions = true;
          Store.state.notifications.raffle = true;
          Store.save(); close();
          if (fromMission) { toast('알림을 켰어요', { tone: 'ok' }); Screens.mission(); }
          else go('onboarding');
        },
        later: () => { close(); if (fromMission) Screens.mission(); else go('onboarding'); },
      }), { persistent: true });
  },

  /* --- 14 가입 티켓 지급 ------------------------------------------------- */
  welcome() {
    if (!Store.state.onboarded) {
      Store.state.onboarded = true;
      Store.addTickets(SIGNUP_TICKETS);
    }
    dialog(`
      <div class="eyebrow">WELCOME</div>
      <h3 style="margin-top:10px;font-size:23px">티켓 ${SIGNUP_TICKETS}장 도착!</h3>
      <div style="margin:20px auto 0;width:180px;height:110px;border-radius:20px;background:var(--yellow-soft);display:flex;align-items:center;justify-content:center;gap:6px;color:var(--yellow-pressed)">
        ${icon('ticketFill', 40)}${icon('ticketFill', 54)}${icon('ticketFill', 40)}
      </div>
      <p>첫 판은 티켓 1장으로 도전할 수 있어요.<br>데일리 미션으로 매일 더 모아보세요.</p>
      <button class="btn md btn--accent" style="margin-top:22px" data-act="go">바로 뽑으러 가기</button>`,
      (node, close) => bind(node, { go: () => { close(); go('home'); } }),
      { wide: true, persistent: true, scrim: 'deep' });
  },

  /* --- 30 광고 시청 ------------------------------------------------------ */
  ad(machine) {
    setTheme('dark');
    shellEl().style.background = 'var(--dark-ad)';
    let left = AD_SECONDS;

    screenEl().innerHTML = `<div class="screen ad">
      <div class="top" style="top:54px">
        ${meter(0, 'onDark')}
        <span class="cd" id="cd">${AD_SECONDS}초 후 닫기</span>
      </div>
      <div class="frame">광고 영역</div>
      <div class="t">끝까지 보면 티켓 ${AD_TICKETS}장을 받아요</div>
      <div class="r">${icon('ticketFill', 18)}<span>보상 대기중</span></div>
      <div class="skip" id="skip">건너뛰기 (${AD_SECONDS})</div>
    </div>`;

    const timer = setInterval(() => {
      left -= 1;
      const bar = $('.ad .meter > i', screenEl());
      if (bar) bar.style.width = ((AD_SECONDS - left) / AD_SECONDS * 100) + '%';
      const cd = document.getElementById('cd');
      const skip = document.getElementById('skip');
      if (!cd || !skip) { clearInterval(timer); return; }
      if (left > 0) {
        cd.textContent = `${left}초 후 닫기`;
        skip.textContent = `건너뛰기 (${left})`;
      } else {
        clearInterval(timer);
        cd.textContent = '보상 지급';
        skip.textContent = '티켓 받기';
        skip.classList.add('ready');
        skip.onclick = () => {
          shellEl().style.background = '';
          Store.state.adsWatchedToday += 1;
          Store.bumpMission('ad');
          Store.addTickets(AD_TICKETS);
          Store.save();
          Dialogs.reward(AD_TICKETS, '광고 시청 미션을 완료했어요', machine);
        };
      }
    }, 1000);

    App.adTimer = timer;
  },

  /* --- 32 보상 획득 ------------------------------------------------------ */
  reward(tickets, reason, machine) {
    const before = Store.state.tickets - tickets;
    setTheme('');
    shellEl().style.background = '';
    if (App.route === 'mission') Screens.mission(); else Screens.mission();

    dialog(`
      <div class="art xl" style="background:var(--yellow-soft);color:var(--yellow-pressed)">${icon('ticketFill', 46)}</div>
      <h3 style="font-size:21px">티켓 ${tickets}장 획득!</h3>
      <p>${esc(reason)}</p>
      <div style="margin-top:16px;padding:12px;border-radius:14px;background:var(--surface-sunken);display:flex;align-items:center;justify-content:center;gap:8px">
        <span style="font-size:12px;font-weight:600;color:var(--ink-50)">보유 티켓</span>
        <span style="font-size:15px;font-weight:700">${before}장 → ${Store.state.tickets}장</span>
      </div>
      <div class="actions">
        <button class="btn md btn--primary" data-act="play">바로 플레이</button>
        <button class="btn sm btn--text" data-close>미션 더 하기</button>
      </div>`,
      (node, close) => bind(node, {
        play: () => {
          close();
          if (machine && Store.canAfford(machine.cost)) go('loading', machine.id);
          else go('home');
        },
      }), { wide: true, scrim: 'deep' });
  },

  /* --- 23 연결 끊김 ------------------------------------------------------ */
  disconnected(machine) {
    dialog(`
      <div class="art" style="background:var(--danger-bg);color:var(--danger)">${icon('triangleExclamation', 26)}</div>
      <h3>연결이 끊겼어요</h3>
      <p>플레이가 중단되어 사용한 티켓 ${machine.cost}장은<br>자동으로 돌려드렸어요.</p>
      <div class="code">오류 코드 PLAY_SOCKET_TIMEOUT</div>
      <div class="actions side">
        <button class="btn md btn--neutral" data-act="home">홈으로</button>
        <button class="btn md btn--primary" data-act="retry">다시 시도</button>
      </div>`,
      (node, close) => bind(node, {
        home: () => { close(); go('home'); },
        retry: () => { close(); go('loading', machine.id); },
      }), { persistent: true, scrim: 'black' });
  },

  /* --- 34 포인트 부족 ---------------------------------------------------- */
  pointShort(need) {
    dialog(`
      <div class="art" style="background:var(--yellow-soft);color:var(--yellow-ink)">${icon('circleInfo', 26)}</div>
      <h3>포인트가 부족해요</h3>
      <p>${fmt(need)}P 필요 · 현재 ${fmt(Store.state.points)}P<br>인형을 뽑거나 중복 인형을 교환해 보세요.</p>
      <div class="actions">
        <button class="btn md btn--primary" data-act="play">인형 뽑으러 가기</button>
        <button class="btn sm btn--neutral" data-act="dupe">중복 인형 교환</button>
      </div>`,
      (node, close) => bind(node, {
        play: () => { close(); go('home'); },
        dupe: () => { close(); App.storageFilter = 'dupe'; go('storage'); },
      }));
  },

  /* --- 28 중복 교환 확인 ------------------------------------------------- */
  trade(dollId) {
    const d = DOLLS[dollId];
    dialog(`
      <h3 style="margin-top:0">중복 인형을 교환할까요?</h3>
      <div class="trade">
        <div class="box" style="background:${d.bg}">${dollImg(d.id, 56)}</div>
        <span class="arw">${icon('arrowRight', 20)}</span>
        <div class="box pt"><b>${d.points}</b><span>POINT</span></div>
      </div>
      <p>교환한 인형은 보관함에서 사라지고<br>되돌릴 수 없어요.</p>
      <div class="actions side">
        <button class="btn md btn--neutral" data-close>취소</button>
        <button class="btn md btn--primary" data-act="ok">교환하기</button>
      </div>`,
      (node, close) => bind(node, {
        ok: () => {
          const gained = Store.tradeDuplicate(d.id);
          close();
          Screens.storage();
          if (gained) toast(`${fmt(gained)}P가 적립되었어요`, { tone: 'ok', action: '교환소', onAction: () => go('exchange') });
        },
      }));
  },

  /* --- 36 → 37 / 38 NH 전환 ---------------------------------------------- */
  convert(amount) {
    const got = Math.floor(amount * NH_RATE);
    const { close } = dialog(`
      <div class="spinner-lg brand" style="margin:0 auto"></div>
      <h3 style="margin-top:20px;font-size:18px">NH멤버스로 전환 중</h3>
      <p>${fmt(amount)}P → ${fmt(got)} 멤버스P<br>최대 1분이 걸릴 수 있어요</p>
      <div class="code">창을 닫아도 전환은 계속 진행됩니다</div>`,
      null, { persistent: true, scrim: 'deep' });

    setTimeout(() => {
      close();
      // NH멤버스 점검 시간(00:00~04:00)에는 전환이 막힌다 — 설계 38번 화면.
      const hour = new Date().getHours();
      if (hour < 4) { Dialogs.convertFailed(amount); return; }
      Store.addPoints(-amount);
      const tx = 'NHM-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + String(Date.now() % 10000).padStart(4, '0');
      go('convert-done', `${amount}|${got}|${tx}`);
    }, 1800);
  },

  /* --- 38 전환 실패 ------------------------------------------------------ */
  convertFailed(amount) {
    dialog(`
      <div class="art" style="background:var(--danger-bg);color:var(--danger)">${icon('circleExclamation', 26)}</div>
      <h3>전환에 실패했어요</h3>
      <p>NH멤버스 점검 시간(00:00~04:00)에는<br>전환할 수 없어요. 포인트는 그대로 있어요.</p>
      <div class="code">오류 코드 NHM_MAINTENANCE_503</div>
      <div class="actions side">
        <button class="btn md btn--neutral" data-close>닫기</button>
        <button class="btn md btn--nh" data-act="retry">다시 시도</button>
      </div>
      <button class="btn sm btn--text" style="margin-top:6px" data-act="support">고객센터 문의</button>`,
      (node, close) => bind(node, {
        retry: () => { close(); Dialogs.convert(amount); },
        support: () => { close(); toast('고객센터는 준비 중이에요', { mini: true }); },
      }));
  },

  /* --- 45 강제 업데이트 -------------------------------------------------- */
  forceUpdate() {
    dialog(`
      <div class="art" style="background:var(--success-bg);color:var(--success-ink)">${icon('download', 26)}</div>
      <h3>업데이트가 필요해요</h3>
      <p>v1.2.0부터 새 뽑기 엔진이 적용돼요.<br>계속하려면 업데이트해 주세요.</p>
      <div style="margin-top:16px;padding:14px;border-radius:14px;background:var(--surface-sunken);text-align:left">
        <div style="font-size:11px;font-weight:700;color:var(--ink-45);letter-spacing:.06em">RELEASE NOTE</div>
        <div style="margin-top:8px;font-size:12px;font-weight:600;line-height:1.7;color:var(--ink-60)">· 집게 조작 반응 속도 개선<br>· 도감 · 시즌 컬렉션 추가<br>· NH멤버스 전환 오류 수정</div>
      </div>
      <button class="btn md btn--primary" style="margin-top:20px" data-act="store">스토어에서 업데이트</button>`,
      (node, close) => bind(node, { store: () => { close(); toast('스토어 연결은 준비 중이에요', { mini: true }); } }),
      { persistent: true, scrim: 'deep' });
  },
};
