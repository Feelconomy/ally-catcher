(function() {
  'use strict';

  // ══════════════════════════════════════════
  // 설정
  // ══════════════════════════════════════════
  // AI 프록시 서버 주소. 비워두면 네트워크 호출 없이 내장 문구 풀 사용 (모바일 오프라인 OK)
  // 나중에 서버를 만들면 예: 'https://내서버/api/doll-info' 형태로 지정
  var AI_PROXY_URL = '';

  var CHUTE_W   = 86;
  var WIRE_MIN  = 48;
  var CLAW_HALF = 26;
  var SPEED_MIN = 0.8;
  var SPEED_MAX = 8.0;
  var DROP_CHANCE = 0.20;      // 올라오다 떨어뜨릴 확률
  var BASE_RATE   = 0.40;      // 기본 성공률
  var PITY_STEP   = 0.09;      // 실패당 성공률 증가
  var MAX_RATE    = 0.90;

  var imgWonhee = document.getElementById('img_wonhee');
  var imgOllie  = document.getElementById('img_ollie');

  var ASSETS = {
    wonhee: { el: imgWonhee, name: '졸업생 원희', rarity: 'SSR', pts: 500 },
    ollie:  { el: imgOllie,  name: '직장인 올리', rarity: 'SR',  pts: 300 }
  };

  // ══════════════════════════════════════════
  // 내장 문구 풀 (AI 프록시 없을 때 사용)
  // ══════════════════════════════════════════
  var NAME_POOL = {
    wonhee: ['별빛 원희', '학사모 원희', '꽃길 원희', '반짝 원희', '새출발 원희', '두근 원희', '만점 원희'],
    ollie:  ['월급날 올리', '칼퇴 올리', '커피 올리', '주말 올리', '넥타이 올리', '야근탈출 올리', '보너스 올리']
  };
  var STORY_POOL = {
    행복: ['오늘처럼 행복한 날, 함께 웃어줄 친구예요. 좋은 일이 두 배가 될 거예요!',
          '행복 바이러스를 잔뜩 품고 있어요. 곁에 두면 미소가 절로 나와요!'],
    설렘: ['두근두근, 설레는 마음을 응원해주는 친구예요. 좋은 예감이 들어요!',
          '설렘 가득한 순간에 찾아온 행운의 친구! 오늘은 뭐든 잘 될 거예요.'],
    지침: ['지친 하루 끝, 폭신하게 안아주고 싶어하는 친구예요. 오늘도 수고했어요!',
          '힘든 날엔 곁에 있어줄게요. 내일은 분명 더 나은 하루가 될 거예요.'],
    신남: ['신나는 에너지 만렙! 함께라면 파티가 두 배로 즐거워져요!',
          '들썩들썩 흥이 넘치는 친구예요. 오늘의 신남을 오래오래 기억해줄 거예요!'],
    우울: ['우울한 마음을 살며시 안아주는 다정한 친구예요. 혼자가 아니에요.',
          '구름 뒤엔 늘 해가 있대요. 그때까지 곁을 지켜줄 친구가 왔어요.']
  };
  var FAIL_POOL = {
    행복: ['괜찮아요, 행복은 이미 손안에! 한 번 더? 😊', '아깝다! 웃으면서 다시 도전해요 🍀'],
    설렘: ['두근두근, 다음 판이 진짜예요! 💖', '설렘 유지! 성공률이 오르고 있어요 ✨'],
    지침: ['지친 날엔 한 템포 쉬고 다시! 🌙', '괜찮아요, 다음엔 꼭 잡혀요 💪'],
    신남: ['아쉽! 그 기세로 한 번 더 고고! 🔥', '리듬 타세요~ 다음 판 각이에요 🎶'],
    우울: ['토닥토닥, 다음엔 좋은 일이 올 거예요 🌈', '괜찮아요, 인형이 기다리고 있어요 🧸']
  };

  // ══════════════════════════════════════════
  // 상태
  // ══════════════════════════════════════════
  var canvas = document.getElementById('gc');
  var ctx    = canvas.getContext('2d');
  var glass  = document.getElementById('glassWrap');
  var DPR    = window.devicePixelRatio || 1;
  var CW = 0, CH = 0;

  var clawX = 0, wireLen = WIRE_MIN, armOpen = 1;
  var clawPhase = 'idle', phaseTimer = 0;
  var grabbedDoll = null, chuteTargetX = 0;
  var moveDir = 0, holdMs = 0, speed = 0;

  var dropCheckDone = false;
  var dropOccurred  = false;

  var tickets = 5, totalPts = 0, attemptCount = 0;
  var currentMood = '행복', ptsHistory = [];
  var isGrabbing = false;
  var lastT = 0;
  var collection = [];
  var player = null; // 로그인한 플레이어 {id, nickname} — null이면 로컬 모드

  var DOLL_CFGS = [
    { key:'wonhee', w:78, h:78, rot:-5, layer:1 },
    { key:'ollie',  w:76, h:76, rot: 4, layer:0 },
    { key:'wonhee', w:62, h:62, rot: 9, layer:0 },
    { key:'ollie',  w:70, h:70, rot:-8, layer:1 },
    { key:'wonhee', w:74, h:74, rot: 2, layer:2 },
    { key:'ollie',  w:58, h:58, rot:-3, layer:0 }
  ];
  var dolls = [];

  // ══════════════════════════════════════════
  // 레이아웃 (수정: 리사이즈 시 인형 상태 보존)
  // ══════════════════════════════════════════
  function slotPositions() {
    var areaW  = CW - CHUTE_W - 4;
    var floorY = CH - 12;
    return [
      { cx: areaW*0.09, cy: floorY      },
      { cx: areaW*0.31, cy: floorY - 50 },
      { cx: areaW*0.54, cy: floorY - 4  },
      { cx: areaW*0.75, cy: floorY - 46 },
      { cx: areaW*0.20, cy: floorY - 82 },
      { cx: areaW*0.62, cy: floorY - 76 }
    ];
  }

  function createDolls() {
    var slots = slotPositions();
    dolls = DOLL_CFGS.map(function(cfg, i) {
      var a = ASSETS[cfg.key];
      return {
        id: i, key: cfg.key, img: a.el,
        cx: slots[i].cx, cy: slots[i].cy,
        w: cfg.w, h: cfg.h,
        rot: cfg.rot * Math.PI / 180,
        layer: cfg.layer,
        rarity: a.rarity, pts: a.pts, name: a.name,
        floatOff: Math.random() * Math.PI * 2,
        floatSpd: 0.016 + Math.random() * 0.012,
        available: true, alpha: 1,
        _drawY: slots[i].cy
      };
    });
    clawX = CW * 0.25;
  }

  // 리사이즈: 인형을 새로 만들지 않고 위치만 갱신
  function repositionDolls() {
    var slots = slotPositions();
    dolls.forEach(function(d, i) {
      if (d === grabbedDoll) return; // 집힌 인형은 건드리지 않음
      d.cx = slots[i].cx;
      d.cy = slots[i].cy;
      d._drawY = d.cy;
    });
    var maxX = CW - CHUTE_W - CLAW_HALF;
    clawX = Math.max(CLAW_HALF, Math.min(maxX, clawX));
  }

  var lastCanvasW = 0;
  function resizeCanvas() {
    var rect = glass.getBoundingClientRect();
    var newW = rect.width;
    // 모바일 주소창 접힘 등으로 폭 변화 없는 resize는 무시
    if (Math.abs(newW - lastCanvasW) < 1 && dolls.length) return;
    lastCanvasW = newW;

    CW = newW;
    CH = Math.round(CW * 0.86);
    canvas.style.height = CH + 'px';
    canvas.width  = Math.round(CW * DPR);
    canvas.height = Math.round(CH * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    chuteTargetX = CW - CHUTE_W / 2;

    if (!dolls.length) createDolls();
    else repositionDolls();
  }

  // ══════════════════════════════════════════
  // 메인 루프
  // ══════════════════════════════════════════
  function loop(ts) {
    var dt = ts - lastT; lastT = ts;
    ctx.clearRect(0, 0, CW, CH);

    if (moveDir !== 0 && clawPhase === 'idle') {
      holdMs += dt;
      var t = Math.min(holdMs / 1400, 1);
      speed = SPEED_MIN + (SPEED_MAX - SPEED_MIN) * t * t;
      var maxX = CW - CHUTE_W - CLAW_HALF;
      clawX = Math.max(CLAW_HALF, Math.min(maxX, clawX + moveDir * speed));
      updateSpeedUI(speed, moveDir);
    }

    dolls.forEach(function(d) {
      if (!d.available || d === grabbedDoll) return;
      d.floatOff += d.floatSpd;
      d._drawY = d.cy + Math.sin(d.floatOff) * 5;
    });

    handlePhase(dt);
    drawDolls();
    drawClaw();
    requestAnimationFrame(loop);
  }

  // ══════════════════════════════════════════
  // 집게 페이즈
  // ══════════════════════════════════════════
  function handlePhase(dt) {
    phaseTimer += dt;

    if (clawPhase === 'descending') {
      wireLen = Math.min(wireLen + 4.5, CH - 70);
      if (wireLen >= CH - 70) {
        armOpen = 0;
        clawPhase = 'grabbing';
        phaseTimer = 0;
      }
    }

    if (clawPhase === 'grabbing') {
      if (phaseTimer > 300) {
        clawPhase = 'ascending';
        phaseTimer = 0;
        dropCheckDone = false;
        dropOccurred  = false;
      }
    }

    if (clawPhase === 'ascending') {
      wireLen = Math.max(wireLen - 5, WIRE_MIN);

      // 올라오는 도중 드롭 체크 (50% 지점, 1회)
      if (grabbedDoll && !dropCheckDone && wireLen < CH * 0.5) {
        dropCheckDone = true;
        if (Math.random() < DROP_CHANCE) {
          dropOccurred = true;
          armOpen = 1;
          grabbedDoll.available = true;
          grabbedDoll._drawY = grabbedDoll.cy; // 원래 자리로 복귀
          grabbedDoll = null;
          setAiTxt('앗! 올라오다 떨어졌어요... 다시 도전!');
          showDropFx();
        }
      }

      if (grabbedDoll) {
        var tipY = wireLen + 30 + 16;
        grabbedDoll._drawY = tipY + grabbedDoll.h * 0.38;
        grabbedDoll.cx = clawX;
      }
      if (wireLen <= WIRE_MIN) {
        clawPhase = 'moving';
        phaseTimer = 0;
      }
    }

    if (clawPhase === 'moving') {
      var dx = chuteTargetX - clawX;
      clawX += Math.sign(dx) * Math.min(Math.abs(dx), 5.5);
      if (grabbedDoll) {
        grabbedDoll.cx    = clawX;
        grabbedDoll._drawY = WIRE_MIN + 46 + grabbedDoll.h * 0.38;
      }
      if (Math.abs(dx) < 2) {
        clawPhase = 'dropping';
        phaseTimer = 0;
      }
    }

    if (clawPhase === 'dropping') {
      armOpen = 1;
      if (phaseTimer > 280) {
        if (grabbedDoll) {
          grabbedDoll.available = false;
          grabbedDoll.alpha = 0;
          showChuteDoll(grabbedDoll);
          endGrab(true, grabbedDoll);
          grabbedDoll = null;
        } else {
          endGrab(false, null);
        }
        clawPhase = 'returning';
        phaseTimer = 0;
      }
    }

    if (clawPhase === 'returning') {
      var tx  = CW * 0.25;
      var dx2 = tx - clawX;
      clawX += Math.sign(dx2) * Math.min(Math.abs(dx2), 4.5);
      if (Math.abs(dx2) < 3) {
        clawX = tx;
        clawPhase = 'idle';
        armOpen = 1;
        document.getElementById('grabBtn').disabled = false;
      }
    }
  }

  function showDropFx() {
    spawnFx(window.innerWidth / 2, window.innerHeight * 0.4, '앗!', '#ff6eb4');
  }

  // ══════════════════════════════════════════
  // 그리기
  // ══════════════════════════════════════════
  function drawDolls() {
    var sorted = dolls.slice().sort(function(a, b) { return a.layer - b.layer; });
    sorted.forEach(function(d) {
      if (d.alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = d.alpha;
      ctx.translate(d.cx, d._drawY);
      ctx.rotate(d.rot);
      ctx.drawImage(d.img, -d.w/2, -d.h/2, d.w, d.h);
      ctx.rotate(-d.rot);
      var tagColors = { R:'#67e8f9', SR:'#ff6eb4', SSR:'#fde047' };
      var tagBgs    = { R:'rgba(103,232,249,.18)', SR:'rgba(255,110,180,.18)', SSR:'rgba(253,224,71,.18)' };
      var tagC = tagColors[d.rarity];
      var tagB = tagBgs[d.rarity];
      ctx.font = 'bold 9px Jua,sans-serif';
      ctx.textAlign = 'center';
      var tw = ctx.measureText(d.rarity).width + 10;
      var ty = d.h / 2 + 2;
      ctx.fillStyle = tagB; rrect(ctx, -tw/2, ty, tw, 13, 3); ctx.fill();
      ctx.strokeStyle = tagC; ctx.lineWidth = 0.5; ctx.stroke();
      ctx.fillStyle = tagC; ctx.fillText(d.rarity, 0, ty + 9);
      ctx.restore();
    });
  }

  function drawClaw() {
    var x = clawX, wireTop = 6;
    ctx.save();
    ctx.strokeStyle = 'rgba(160,130,240,.9)';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(x, wireTop); ctx.lineTo(x, wireTop + wireLen); ctx.stroke();
    ctx.setLineDash([]);

    var headY = wireTop + wireLen;
    ctx.fillStyle = '#7c3aed'; ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 1;
    rrect(ctx, x - 11, headY, 22, 12, 4); ctx.fill();
    ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 8; ctx.stroke(); ctx.shadowBlur = 0;

    var tipY = headY + 12;
    var open = armOpen === 1;
    var sp   = open ? 52 : (clawPhase === 'grabbing' ? 8 : 12);
    var arms = [
      { ox: -sp/2, ang: open ? -0.52 : -0.1 },
      { ox: 0,     ang: 0 },
      { ox:  sp/2, ang: open ?  0.52 :  0.1 }
    ];
    arms.forEach(function(a) {
      ctx.save();
      ctx.translate(x + a.ox, tipY); ctx.rotate(a.ang);
      ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.shadowColor = '#c084fc'; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 22); ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    });
    ctx.restore();
  }

  function rrect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x+r, y); c.lineTo(x+w-r, y); c.arcTo(x+w, y, x+w, y+r, r);
    c.lineTo(x+w, y+h-r); c.arcTo(x+w, y+h, x+w-r, y+h, r);
    c.lineTo(x+r, y+h); c.arcTo(x, y+h, x, y+h-r, r);
    c.lineTo(x, y+r); c.arcTo(x, y, x+r, y, r);
    c.closePath();
  }

  // ══════════════════════════════════════════
  // 뽑기
  // ══════════════════════════════════════════
  function doGrab() {
    if (isGrabbing || tickets <= 0 || clawPhase !== 'idle') return;
    var hit = null, minDist = Infinity;
    dolls.forEach(function(d) {
      if (!d.available) return;
      var dist = Math.abs(clawX - d.cx);
      if (dist <= d.w * 0.26 && dist < minDist) { minDist = dist; hit = d; }
    });
    tickets--;
    attemptCount++;
    document.getElementById('ticketNum').textContent = tickets;
    document.getElementById('grabBtn').disabled = true;
    var rate = Math.min(BASE_RATE + attemptCount * PITY_STEP, MAX_RATE);
    updateTension(rate);
    saveState();

    if (hit && Math.random() < rate) {
      grabbedDoll = hit;
      clawX = hit.cx;
      setAiTxt('집게가 딱 맞아요! 올라가는 중...');
    } else {
      grabbedDoll = null;
      setAiTxt(!hit ? '인형 바로 위로 이동 후 뽑기!' : '아쉽게 미끄러졌어요...');
    }
    isGrabbing = true;
    wireLen = WIRE_MIN;
    clawPhase = 'descending';
    phaseTimer = 0;
  }
  window.doGrab = doGrab;

  function endGrab(success, wonDoll) {
    isGrabbing = false;
    if (success && wonDoll) {
      attemptCount = 0;
      fetchDollInfo(ASSETS[wonDoll.key], wonDoll.key).then(function(info) {
        showResult(ASSETS[wonDoll.key], info, wonDoll.key);
      });
      spawnParticles();
      setAiTxt('뽑기 성공!');
      setTimeout(replenish, 3500);
    } else {
      if (!dropOccurred) {
        fetchFailMsg(currentMood).then(function(msg) { setAiTxt(msg); });
      }
    }
    saveState();
  }

  function showChuteDoll(doll) {
    var img = document.getElementById('chuteDoll');
    img.src = ASSETS[doll.key].el.src;
    img.classList.remove('arrived');
    void img.offsetWidth;
    setTimeout(function() { img.classList.add('arrived'); }, 60);
    var cz = document.getElementById('chuteZone');
    cz.style.boxShadow = '0 0 20px rgba(103,232,249,.8)';
    setTimeout(function() { cz.style.boxShadow = ''; }, 2000);
  }

  function replenish() {
    var gone = null;
    for (var i = 0; i < dolls.length; i++) {
      if (!dolls[i].available) { gone = dolls[i]; break; }
    }
    if (!gone) return;
    gone.available = true;
    gone.alpha = 0;
    var fade = setInterval(function() {
      gone.alpha = Math.min(gone.alpha + 0.04, 1);
      if (gone.alpha >= 1) clearInterval(fade);
    }, 30);
  }

  // ══════════════════════════════════════════
  // 이동 (이벤트 리스너 방식으로 정리)
  // ══════════════════════════════════════════
  function startMove(dir) {
    if (clawPhase !== 'idle') return;
    moveDir = dir; holdMs = 0; speed = 0;
    document.getElementById(dir < 0 ? 'btnL' : 'btnR').classList.add('pressed');
  }
  function stopMove() {
    moveDir = 0; speed = 0; holdMs = 0;
    updateSpeedUI(0, 0);
    document.getElementById('btnL').classList.remove('pressed');
    document.getElementById('btnR').classList.remove('pressed');
  }

  function bindDirBtn(id, dir) {
    var btn = document.getElementById(id);
    btn.addEventListener('touchstart', function(e) { e.preventDefault(); startMove(dir); }, { passive: false });
    btn.addEventListener('touchend',    stopMove);
    btn.addEventListener('touchcancel', stopMove);
    btn.addEventListener('mousedown', function() { startMove(dir); });
    btn.addEventListener('mouseup',    stopMove);
    btn.addEventListener('mouseleave', stopMove);
    btn.addEventListener('contextmenu', function(e) { e.preventDefault(); }); // 길게 눌러도 메뉴 안 뜨게
  }

  function updateSpeedUI(spd, dir) {
    var pct = Math.round((spd / SPEED_MAX) * 100);
    document.getElementById('speedVal').textContent = spd.toFixed(1);
    document.getElementById('speedL').style.width = (dir < 0 ? pct : 0) + '%';
    document.getElementById('speedR').style.width = (dir > 0 ? pct : 0) + '%';
  }

  function updateTension(r) {
    var pct = Math.round(r * 100);
    document.getElementById('tensionPct').textContent = pct + '%';
    var f = document.getElementById('tensionFill');
    f.style.width = pct + '%';
    if (pct < 50)      f.style.background = 'linear-gradient(90deg,#67e8f9,#3bb8a0)';
    else if (pct < 75) f.style.background = 'linear-gradient(90deg,#fde047,#f97316)';
    else               f.style.background = 'linear-gradient(90deg,#f97316,#ff6eb4)';
  }

  function setAiTxt(t) { document.getElementById('aiTxt').textContent = t; }

  // ══════════════════════════════════════════
  // 결과 카드 + 모음집
  // ══════════════════════════════════════════
  function showResult(asset, info, key) {
    document.getElementById('resImg').src = asset.el.src;
    document.getElementById('resName').textContent = info.name;
    document.getElementById('resStory').textContent = info.story;
    var badge = document.getElementById('resBadge');
    badge.textContent = asset.rarity;
    badge.className = 'r-badge ' + ({ R:'tag-r', SR:'tag-sr', SSR:'tag-ssr' }[asset.rarity] || 'tag-r');
    var pts = asset.pts + Math.floor(Math.random() * 60);
    totalPts += pts;
    document.getElementById('totalPts').textContent = totalPts;
    document.getElementById('resPts').textContent = '+' + pts + ' 포인트 적립!';

    var pull = {
      key:    key,
      name:   info.name,
      story:  info.story,
      rarity: asset.rarity,
      pts:    pts,
      src:    asset.el.src,
      time:   new Date().toLocaleString('ko-KR', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' })
    };
    collection.unshift(pull);
    if (player) DB.addPull(player.id, pull);
    saveState();
    renderCollection();
    updateCollectionBadge();

    ptsHistory.unshift({ name: info.name, pts: pts });
    if (ptsHistory.length > 20) ptsHistory.length = 20;
    renderHistory();
    document.getElementById('resOverlay').classList.add('show');
  }
  window.closeRes = function() { document.getElementById('resOverlay').classList.remove('show'); };

  function renderHistory() {
    var el = document.getElementById('phList');
    el.textContent = '';
    if (!ptsHistory.length) {
      var empty = document.createElement('div');
      empty.style.cssText = 'text-align:center;font-size:10px;color:rgba(255,255,255,.25);padding:4px;';
      empty.textContent = '아직 포인트 내역이 없어요';
      el.appendChild(empty);
      return;
    }
    ptsHistory.slice(0, 5).forEach(function(h) {
      var row = document.createElement('div');
      row.className = 'ph-item';
      var name = document.createElement('span');
      name.className = 'ph-name';
      name.textContent = h.name;
      var val = document.createElement('span');
      val.className = 'ph-val';
      val.textContent = '+' + h.pts + 'P';
      row.appendChild(name); row.appendChild(val);
      el.appendChild(row);
    });
  }

  // 수정: XSS 방지를 위해 DOM API로 생성 (innerHTML 조립 제거)
  function renderCollection() {
    var el = document.getElementById('collectionGrid');
    el.textContent = '';
    if (!collection.length) {
      var empty = document.createElement('div');
      empty.className = 'col-empty';
      empty.innerHTML = '뽑은 인형이 없어요<br>첫 번째 인형을 뽑아보세요!';
      el.appendChild(empty);
    } else {
      collection.forEach(function(c, i) {
        var cls = { R:'tag-r', SR:'tag-sr', SSR:'tag-ssr' }[c.rarity] || 'tag-r';
        var card = document.createElement('div');
        card.className = 'col-card';
        card.addEventListener('click', function() { showColDetail(i); });

        var img = document.createElement('img');
        img.src = c.src; img.alt = '';

        var badge = document.createElement('div');
        badge.className = 'r-badge ' + cls;
        badge.style.cssText = 'font-size:8px;padding:1px 6px;margin:4px 0 2px;';
        badge.textContent = c.rarity;

        var name = document.createElement('div');
        name.className = 'col-name';
        name.textContent = c.name;

        var time = document.createElement('div');
        time.className = 'col-time';
        time.textContent = c.time;

        card.appendChild(img); card.appendChild(badge);
        card.appendChild(name); card.appendChild(time);
        el.appendChild(card);
      });
    }
    updateColStats(); // 수정: 통계가 실제로 갱신되도록 호출
  }

  // 수정: 죽은 코드였던 통계 함수를 모듈 안으로 이동
  function updateColStats() {
    var ssr = 0, sr = 0, r = 0;
    collection.forEach(function(c) {
      if (c.rarity === 'SSR') ssr++;
      else if (c.rarity === 'SR') sr++;
      else r++;
    });
    document.getElementById('statTotal').textContent = collection.length;
    document.getElementById('statSSR').textContent   = ssr;
    document.getElementById('statSR').textContent    = sr;
    document.getElementById('statR').textContent     = r;
  }

  function showColDetail(i) {
    var c = collection[i];
    if (!c) return;
    document.getElementById('detailImg').src    = c.src;
    document.getElementById('detailName').textContent  = c.name;
    document.getElementById('detailStory').textContent = c.story;
    var rb = document.getElementById('detailRarity');
    rb.textContent = c.rarity;
    rb.className   = 'r-badge detail-rarity ' + ({ R:'tag-r', SR:'tag-sr', SSR:'tag-ssr' }[c.rarity] || 'tag-r');
    document.getElementById('detailPts').textContent   = '+' + c.pts + ' P';
    document.getElementById('detailTime').textContent  = c.time;
    document.getElementById('colDetail').classList.add('show');
  }
  window.closeColDetail = function() {
    document.getElementById('colDetail').classList.remove('show');
  };

  function updateCollectionBadge() {
    var badge = document.getElementById('colBadge');
    if (collection.length > 0) {
      badge.textContent = collection.length;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // ══════════════════════════════════════════
  // 저장/불러오기
  // 로그인 시: 서버(Supabase)가 원본 / 미로그인: localStorage
  // ══════════════════════════════════════════
  function saveState() {
    if (player) {
      DB.savePlayer(player.id, {
        tickets: tickets,
        total_pts: totalPts,
        attempt_count: attemptCount
      });
      return;
    }
    try {
      var lite = collection.map(function(c) {
        return { key:c.key, name:c.name, story:c.story, rarity:c.rarity, pts:c.pts, time:c.time };
      });
      localStorage.setItem('claw_state', JSON.stringify({
        collection: lite,
        tickets: tickets,
        totalPts: totalPts,
        ptsHistory: ptsHistory.slice(0, 20),
        attemptCount: attemptCount
      }));
    } catch(e) {}
  }

  function loadState() {
    try {
      var raw = localStorage.getItem('claw_state');
      if (!raw) return;
      var s = JSON.parse(raw);
      collection = (s.collection || []).map(function(c) {
        c.src = ASSETS[c.key] ? ASSETS[c.key].el.src : '';
        return c;
      });
      if (typeof s.tickets === 'number')  tickets  = s.tickets;
      if (typeof s.totalPts === 'number') totalPts = s.totalPts;
      if (Array.isArray(s.ptsHistory))    ptsHistory = s.ptsHistory;
      if (typeof s.attemptCount === 'number') attemptCount = s.attemptCount;
    } catch(e) {}
  }

  // ══════════════════════════════════════════
  // 전역 UI 핸들러
  // ══════════════════════════════════════════
  window.openCollection = function() {
    document.getElementById('collectionPanel').classList.add('open');
  };
  window.closeCollection = function() {
    document.getElementById('collectionPanel').classList.remove('open');
  };

  window.addTickets = function() {
    tickets += 3;
    document.getElementById('ticketNum').textContent = tickets;
    saveState();
    spawnFx(window.innerWidth / 2, 200, '+3 티켓!', '#fde047');
  };

  window.selMood = function(el) {
    document.querySelectorAll('.mood-btn').forEach(function(b) { b.classList.remove('active'); });
    el.classList.add('active');
    currentMood = el.dataset.mood;
    setAiTxt('AI가 ' + currentMood + ' 기분에 맞는 인형 분석 중...');
  };

  window.doShare = function() {
    var name = document.getElementById('resName').textContent;
    var txt  = '뽑아요! AI 인형뽑기\n"' + name + '"를 뽑았어요!\n#뽑아요 #AI인형뽑기';
    if (navigator.share) {
      navigator.share({ title: '뽑아요!', text: txt }).catch(function() {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(function() { alert('복사됐어요!'); });
    }
  };

  // ══════════════════════════════════════════
  // 파티클
  // ══════════════════════════════════════════
  function spawnParticles() {
    var colors = ['#ff6eb4','#c084fc','#67e8f9','#fde047','#6ee7b7'];
    var cx = window.innerWidth / 2;
    var cy = window.innerHeight * 0.4;
    for (var i = 0; i < 20; i++) {
      var el   = document.createElement('div');
      el.className = 'particle';
      var sz   = 3 + Math.random() * 7;
      var ang  = Math.random() * Math.PI * 2;
      var dist = 70 + Math.random() * 140;
      var c    = colors[i % 5];
      el.style.cssText = 'left:' + cx + 'px;top:' + cy + 'px;' +
        'width:' + sz + 'px;height:' + sz + 'px;' +
        'background:' + c + ';' +
        '--pf:translate(' + (Math.cos(ang)*dist) + 'px,' + (Math.sin(ang)*dist-70) + 'px);' +
        '--pd:' + (0.7 + Math.random() * 0.5) + 's;' +
        'box-shadow:0 0 6px ' + c + ';';
      document.body.appendChild(el);
      (function(e) { setTimeout(function() { if (e.parentNode) e.parentNode.removeChild(e); }, 1200); })(el);
    }
    spawnFx(cx, cy - 50, 'GET!', '#fde047');
  }

  function spawnFx(x, y, txt, color) {
    var el = document.createElement('div');
    el.className = 'fx-text';
    el.style.cssText = 'left:' + x + 'px;top:' + y + 'px;color:' + color + ';';
    el.textContent = txt;
    document.body.appendChild(el);
    (function(e) { setTimeout(function() { if (e.parentNode) e.parentNode.removeChild(e); }, 1200); })(el);
  }

  // 배경 별
  (function() {
    var c = document.getElementById('bgStars');
    for (var i = 0; i < 60; i++) {
      var s  = document.createElement('div');
      s.className = 'star';
      var sz = Math.random() * 2.5 + 0.5;
      s.style.cssText =
        'width:' + sz + 'px;height:' + sz + 'px;' +
        'top:' + (Math.random() * 100) + '%;' +
        'left:' + (Math.random() * 100) + '%;' +
        '--d:' + (1.5 + Math.random() * 3) + 's;' +
        'animation-delay:' + (Math.random() * 3) + 's;';
      c.appendChild(s);
    }
  })();

  // 키보드 (데스크톱 테스트용)
  document.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowLeft'  && !moveDir) startMove(-1);
    if (e.key === 'ArrowRight' && !moveDir) startMove(1);
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); doGrab(); }
  });
  document.addEventListener('keyup', function(e) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') stopMove();
  });

  // ══════════════════════════════════════════
  // AI (수정: 프록시 미설정 시 네트워크 호출 없이 내장 풀 사용)
  // ══════════════════════════════════════════
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function localDollInfo(key) {
    return {
      name:  pick(NAME_POOL[key] || [ASSETS[key].name]),
      story: pick(STORY_POOL[currentMood] || STORY_POOL['행복'])
    };
  }

  function fetchDollInfo(asset, key) {
    if (!AI_PROXY_URL) return Promise.resolve(localDollInfo(key));
    return fetch(AI_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'doll-info', name: asset.name, rarity: asset.rarity, mood: currentMood })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d && d.name && d.story) return d;
      return localDollInfo(key);
    })
    .catch(function() { return localDollInfo(key); });
  }

  function fetchFailMsg(mood) {
    if (!AI_PROXY_URL) return Promise.resolve(pick(FAIL_POOL[mood] || FAIL_POOL['행복']));
    return fetch(AI_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'fail-msg', mood: mood })
    })
    .then(function(r) { return r.json(); })
    .then(function(d) { return (d && d.message) || pick(FAIL_POOL[mood] || FAIL_POOL['행복']); })
    .catch(function() { return pick(FAIL_POOL[mood] || FAIL_POOL['행복']); });
  }

  // ══════════════════════════════════════════
  // 시작 (수정: 이미지 로드 완료 후 시작)
  // ══════════════════════════════════════════
  function waitImages() {
    var imgs = [imgWonhee, imgOllie];
    return Promise.all(imgs.map(function(im) {
      if (im.complete && im.naturalWidth > 0) return Promise.resolve();
      return new Promise(function(res) {
        im.addEventListener('load', res, { once: true });
        im.addEventListener('error', res, { once: true });
      });
    }));
  }

  // ══════════════════════════════════════════
  // 로그인 (Supabase 설정 시)
  // ══════════════════════════════════════════
  function formatPullTime(iso) {
    try {
      return new Date(iso).toLocaleString('ko-KR', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' });
    } catch(e) { return ''; }
  }

  // 서버에서 받은 플레이어 데이터로 게임 상태 채우기
  function hydratePlayer(p, pulls) {
    player   = { id: p.id, nickname: p.nickname };
    tickets  = (typeof p.tickets === 'number')       ? p.tickets       : 5;
    totalPts = (typeof p.total_pts === 'number')     ? p.total_pts     : 0;
    attemptCount = (typeof p.attempt_count === 'number') ? p.attempt_count : 0;

    collection = (pulls || []).map(function(r) {
      return {
        key: r.doll_key, name: r.name, story: r.story || '',
        rarity: r.rarity, pts: r.pts,
        src: ASSETS[r.doll_key] ? ASSETS[r.doll_key].el.src : '',
        time: formatPullTime(r.created_at)
      };
    });
    ptsHistory = collection.slice(0, 20).map(function(c) { return { name: c.name, pts: c.pts }; });

    document.getElementById('colHeaderTitle').innerHTML = '&#127942; ';
    document.getElementById('colHeaderTitle').appendChild(
      document.createTextNode(p.nickname + '의 인형 모음집'));
    var lb = document.getElementById('logoutBtn');
    lb.style.display = 'block';
    lb.onclick = function() {
      DB.forgetLogin();
      location.reload();
    };
  }

  function showLogin(onDone) {
    var ov   = document.getElementById('loginOverlay');
    var nick = document.getElementById('loginNick');
    var pin  = document.getElementById('loginPin');
    var err  = document.getElementById('loginErr');
    var btn  = document.getElementById('loginBtn');
    ov.classList.add('show');

    function submit() {
      var n = nick.value.trim();
      var p = pin.value.trim();
      err.textContent = '';
      if (n.length < 2 || n.length > 12) { err.textContent = '닉네임은 2~12자로 해주세요'; return; }
      if (!/^\d{4}$/.test(p)) { err.textContent = 'PIN은 숫자 4자리예요'; return; }
      btn.disabled = true;
      btn.textContent = '접속 중...';
      DB.loginOrSignup(n, p).then(function(res) {
        return DB.getPulls(res.player.id).then(function(pulls) {
          ov.classList.remove('show');
          hydratePlayer(res.player, pulls);
          if (res.isNew) setAiTxt(n + '님 환영해요! 첫 인형을 뽑아보세요 🎉');
          else setAiTxt(n + '님 다시 오셨네요! 이어서 뽑아요 🎪');
          onDone();
        });
      }).catch(function(e) {
        btn.disabled = false;
        btn.textContent = '시작하기 🎯';
        err.textContent = (e.message === 'PIN_MISMATCH')
          ? '이미 있는 닉네임인데 PIN이 달라요'
          : '접속 실패... 잠시 후 다시 시도해주세요';
      });
    }
    btn.addEventListener('click', submit);
    pin.addEventListener('keydown', function(e) { if (e.key === 'Enter') submit(); });
  }

  // ══════════════════════════════════════════
  // 시작
  // ══════════════════════════════════════════
  function beginGame() {
    document.getElementById('ticketNum').textContent = tickets;
    document.getElementById('totalPts').textContent  = totalPts;
    renderHistory();
    renderCollection();
    updateCollectionBadge();
    updateTension(Math.min(BASE_RATE + attemptCount * PITY_STEP, MAX_RATE));

    waitImages().then(function() {
      resizeCanvas();
      requestAnimationFrame(function(t) { lastT = t; requestAnimationFrame(loop); });
    });
  }

  function start() {
    bindDirBtn('btnL', -1);
    bindDirBtn('btnR',  1);
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', function() { setTimeout(resizeCanvas, 200); });

    if (window.DB && DB.enabled) {
      // 서버 모드: 자동 로그인 시도 → 실패하면 로그인 화면
      DB.autoLogin().then(function(p) {
        if (p) {
          return DB.getPulls(p.id).then(function(pulls) {
            hydratePlayer(p, pulls);
            setAiTxt(p.nickname + '님 어서오세요! 🎪');
            beginGame();
          });
        }
        showLogin(beginGame);
      }).catch(function() {
        showLogin(beginGame);
      });
    } else {
      // 로컬 모드
      loadState();
      beginGame();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
