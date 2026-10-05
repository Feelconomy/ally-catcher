/* ══════════════════════════════════════════════════════════════════
   효과음 — 파일 없이 Web Audio 로 그 자리에서 합성한다.

   녹음물을 안 쓰는 이유는 두 가지다. 하나는 저작권 — 오실레이터와
   잡음으로 만든 파형에는 출처가 없다. 다른 하나는 용량 — 내려받을 게
   없어서 3D 처럼 무거운 화면에서도 소리 때문에 느려지지 않는다.

   브라우저는 사용자가 한 번 건드리기 전에는 소리를 못 내게 막는다.
   그래서 AudioContext 를 미리 만들지 않고 첫 재생 때 만든다 — 그 첫
   재생은 언제나 탭·클릭 뒤에 온다. 설정에서 끄면 ac() 가 null 을
   돌려주고 모든 소리가 조용히 없던 일이 된다.
   ══════════════════════════════════════════════════════════════════ */
const Sfx = (function () {
  let ctx = null, master = null, noiseBuf = null;
  let motorNode = null, motorGain = null, motorFilter = null;

  const enabled = () => Store.state && Store.state.settings.sfx !== false;

  function ac() {
    if (!enabled()) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (_) { return null; }
      master = ctx.createGain();
      master.gain.value = 0.5;        // 게임 소리는 알림보다 한참 작아야 한다
      master.connect(ctx.destination);
    }
    // 탭이 백그라운드에 다녀오면 멈춰 있다
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  /** 1초짜리 백색 잡음 한 장을 만들어 두고 계속 재생원으로 쓴다. */
  function noise(c) {
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    return src;
  }

  /* 음 하나. from→to 로 음높이를 끌고, gain 을 0 에서 올렸다 0 으로 내린다.
     지수 곡선은 0 을 못 받아서 아주 작은 값으로 수렴시킨다. */
  function tone(o) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + (o.delay || 0), dur = o.dur || 0.12;
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.from, t0);
    if (o.to && o.to !== o.from) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.2, t0 + Math.min(0.012, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }

  /* 잡음 한 덩이. 필터를 from→to 로 쓸어 '쉭' 이나 '턱' 을 만든다. */
  function hit(o) {
    const c = ac(); if (!c) return;
    const t0 = c.currentTime + (o.delay || 0), dur = o.dur || 0.09;
    const src = noise(c), f = c.createBiquadFilter(), g = c.createGain();
    f.type = o.filter || 'bandpass';
    f.Q.value = o.q || 1;
    f.frequency.setValueAtTime(o.from, t0);
    if (o.to && o.to !== o.from) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.gain || 0.18, t0 + Math.min(0.01, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  /* 소리 사전. 이름 하나에 짧은 레시피 하나. */
  const RECIPES = {
    // 버튼·칩 — 아주 짧게 '톡'
    tap:    () => tone({ type: 'square', from: 900, to: 680, dur: 0.035, gain: 0.07 }),
    // 조이스틱을 처음 잡을 때
    grab:   () => tone({ type: 'square', from: 420, to: 520, dur: 0.045, gain: 0.08 }),
    // 드롭 버튼 — 내려간다는 느낌으로 음이 떨어진다
    drop:   () => { tone({ type: 'square', from: 520, to: 170, dur: 0.18, gain: 0.13 });
                    hit({ from: 1800, to: 600, dur: 0.12, gain: 0.08 }); },
    // 집게가 오므라들며 '척'
    grip:   () => { hit({ from: 2600, to: 900, dur: 0.1, gain: 0.16, q: 1.4 });
                    tone({ type: 'triangle', from: 190, to: 110, dur: 0.12, gain: 0.12, delay: 0.02 }); },
    // 손에서 빠져나가는 '스르륵' — 필터를 길게 내린다
    slip:   () => hit({ filter: 'lowpass', from: 3200, to: 380, dur: 0.34, gain: 0.14 }),
    // 배출구 바닥에 '쿵'
    land:   () => { tone({ type: 'sine', from: 170, to: 55, dur: 0.26, gain: 0.26 });
                    hit({ filter: 'lowpass', from: 900, to: 200, dur: 0.14, gain: 0.12 }); },
    // 성공 — 도미솔도 아르페지오
    win:    () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
                    tone({ type: 'triangle', from: f, dur: 0.22, gain: 0.16, delay: i * 0.085 })),
    // 실패 — 두 음이 내려앉는다
    fail:   () => [392, 311].forEach((f, i) =>
                    tone({ type: 'triangle', from: f, to: f * 0.94, dur: 0.2, gain: 0.12, delay: i * 0.13 })),
    // 티켓·포인트 획득
    coin:   () => [784, 1175].forEach((f, i) =>
                    tone({ type: 'square', from: f, dur: 0.1, gain: 0.08, delay: i * 0.07 })),
    // 인형을 다시 채울 때 우르르
    refill: () => [0, 0.06, 0.13, 0.19].forEach(d =>
                    hit({ filter: 'lowpass', from: 1600, to: 300, dur: 0.12, gain: 0.3, delay: d })),
  };

  return {
    /** 소리 하나 재생. 꺼져 있거나 못 만들면 아무 일도 안 한다. */
    play(name) {
      const r = RECIPES[name];
      if (!r || !enabled()) return;
      try { if (ac()) r(); } catch (_) { /* 소리는 실패해도 게임을 막지 않는다 */ }
    },

    /* 집게가 움직이는 동안 깔리는 모터음. 톱니파를 저역 필터에 넣어
       멀리서 도는 소리로 만들고, level(0~1)로 세기와 음높이를 같이 올린다.
       한 번 켜 두고 level 만 바꾼다 — 매번 새로 만들면 '뚝뚝' 끊긴다. */
    motor(level) {
      if (!enabled()) { this.motorOff(); return; }
      const c = ac(); if (!c) return;
      if (!motorNode) {
        motorNode = c.createOscillator();
        motorNode.type = 'sawtooth';
        motorFilter = c.createBiquadFilter();
        motorFilter.type = 'lowpass';
        motorFilter.frequency.value = 420;
        motorGain = c.createGain();
        motorGain.gain.value = 0.0001;
        motorNode.connect(motorFilter).connect(motorGain).connect(master);
        motorNode.start();
      }
      const v = Math.max(0, Math.min(1, level));
      const t = c.currentTime;
      motorGain.gain.setTargetAtTime(v > 0.02 ? 0.05 * v + 0.004 : 0.0001, t, 0.04);
      motorNode.frequency.setTargetAtTime(62 + 26 * v, t, 0.05);
    },

    motorOff() {
      if (!motorGain || !ctx) return;
      motorGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
    },

    /** 화면을 떠날 때 — 모터를 끄고 노드를 정리한다. */
    stop() {
      if (motorNode) {
        try { motorNode.stop(); } catch (_) {}
        motorNode = motorGain = motorFilter = null;
      }
    },
  };
})();

window.Sfx = Sfx;
