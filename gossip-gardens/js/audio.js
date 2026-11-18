/* Gossip Gardens - tiny synthesized sound effects (Web Audio). No audio files needed. */
(function (root) {
  'use strict';
  const G = root.GG;
  const A = { ctx: null, on: true };

  function ensure() {
    if (!A.ctx) {
      try { A.ctx = new (root.AudioContext || root.webkitAudioContext)(); } catch (e) { A.ctx = null; }
    }
    if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
    return A.ctx;
  }

  function tone(freq, dur, type, vol, delay) {
    const ctx = ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  const SFX = {
    tap:     () => tone(520, 0.06, 'triangle', 0.08),
    spawn:   () => { tone(620, 0.08, 'triangle', 0.1); tone(840, 0.1, 'triangle', 0.1, 0.05); },
    merge:   (lv) => { const f = 330 * Math.pow(2, Math.min(lv || 2, 8) / 6); tone(f, 0.12, 'sine', 0.14); tone(f * 1.5, 0.18, 'sine', 0.12, 0.07); },
    collect: () => { tone(1180, 0.08, 'square', 0.05); tone(1580, 0.12, 'square', 0.05, 0.06); },
    serve:   () => { tone(523, 0.12, 'triangle', 0.12); tone(659, 0.12, 'triangle', 0.12, 0.09); tone(784, 0.2, 'triangle', 0.12, 0.18); },
    claim:   () => { tone(660, 0.1, 'sine', 0.12); tone(880, 0.1, 'sine', 0.12, 0.08); tone(1320, 0.18, 'sine', 0.12, 0.16); },
    unlock:  () => { [392, 494, 587, 784].forEach((f, i) => tone(f, 0.16, 'triangle', 0.12, i * 0.08)); },
    error:   () => tone(170, 0.16, 'sawtooth', 0.07),
    spin:    () => { for (let i = 0; i < 10; i++) tone(500 + i * 40, 0.04, 'square', 0.03, i * 0.18); },
  };

  // ---- Background music: an intro that plays once in a while, then a body that loops ----------------------
  // The track (Pixabay licence, audio/music.mp3) is about 77 beats a minute. The intro is its first two bars; the body runs
  // from there to the end of bar 8. Loops are joined with a short cross-fade placed exactly on the beat grid.
  const M = { buf: null, loading: false, on: true, running: false, cur: null, tEnd: 0, loops: 0, every: 4, timer: 0, out: null,
    cfg: { url: 'audio/music.mp3', vol: 0.3, t0: 0.01, bar: 3.1169, introBars: 2, endBars: 8, xf: 0.6 } };
  const mPos = (bars) => M.cfg.t0 + bars * M.cfg.bar;

  function curve(up) { const n = 32, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1); c[i] = up ? Math.sin(x * Math.PI / 2) : Math.cos(x * Math.PI / 2); } return c; }
  function launch(offset, when, fade) {
    const ctx = A.ctx, src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = M.buf; src.connect(g); g.connect(M.out);
    if (fade > 0) { g.gain.setValueAtTime(0, when); g.gain.setValueCurveAtTime(curve(true), when, fade); } else g.gain.setValueAtTime(1, when);
    src.start(when, Math.max(0, offset));
    return { src, g };
  }
  function fadeOut(h, from, dur, stopAt) {
    try { h.g.gain.cancelScheduledValues(from); h.g.gain.setValueAtTime(1, from); h.g.gain.setValueCurveAtTime(curve(false), from, dur); h.src.stop(stopAt); } catch (e) { /* already stopped */ }
  }
  function planNext() {
    const ctx = A.ctx;
    if (!M.running || !ctx) return;
    if (ctx.state !== 'running') { M.timer = setTimeout(planNext, 500); return; }
    const c = M.cfg, loopStart = mPos(c.introBars), loopEnd = mPos(c.endBars);
    if (M.tEnd - ctx.currentTime > c.xf + 1.2) { M.timer = setTimeout(planNext, Math.max(100, (M.tEnd - ctx.currentTime - c.xf - 1) * 1000)); return; }
    const old = M.cur; M.loops++;
    if (M.loops >= M.every) {                           // back to the intro, then the body again
      M.loops = 0; M.every = 3 + Math.floor(Math.random() * 3);
      M.cur = launch(0, M.tEnd, 0.3); fadeOut(old, M.tEnd - c.xf, c.xf, M.tEnd + 0.1);
      M.tEnd += loopEnd;
    } else {                                            // loop the body: new copy starts one cross-fade early
      const start = M.tEnd - c.xf;
      M.cur = launch(loopStart - c.xf, start, c.xf); fadeOut(old, start, c.xf, M.tEnd + 0.1);
      M.tEnd = start + (loopEnd - (loopStart - c.xf));
    }
    M.timer = setTimeout(planNext, Math.max(100, (M.tEnd - ctx.currentTime - c.xf - 1) * 1000));
  }
  function musicBegin() {
    const ctx = ensure();
    if (!ctx || !M.buf || M.running || !M.on) return;
    if (!M.out) { M.out = ctx.createGain(); M.out.connect(ctx.destination); }
    M.out.gain.cancelScheduledValues(ctx.currentTime); M.out.gain.setValueAtTime(M.cfg.vol, ctx.currentTime);
    M.running = true; M.loops = 0; M.every = 3 + Math.floor(Math.random() * 3);
    const when = ctx.currentTime + 0.1;
    M.cur = launch(0, when, 0.8); M.tEnd = when + mPos(M.cfg.endBars);
    clearTimeout(M.timer); M.timer = setTimeout(planNext, Math.max(100, (M.tEnd - ctx.currentTime - M.cfg.xf - 1) * 1000));
  }
  function musicStart() {
    if (!M.on || M.running) return;
    const ctx = ensure();
    if (!ctx) return;
    if (M.buf) { musicBegin(); return; }
    if (M.loading) return;
    M.loading = true;
    fetch(M.cfg.url).then((r) => r.arrayBuffer()).then((ab) => new Promise((ok, no) => ctx.decodeAudioData(ab, ok, no)))
      .then((b) => { M.buf = b; M.loading = false; musicBegin(); }).catch(() => { M.loading = false; });
  }
  function musicStop() {
    clearTimeout(M.timer);
    if (M.running && A.ctx && M.out) {
      const t = A.ctx.currentTime; M.out.gain.cancelScheduledValues(t); M.out.gain.setValueAtTime(M.out.gain.value, t); M.out.gain.linearRampToValueAtTime(0, t + 0.4);
      const cur = M.cur; setTimeout(() => { try { cur.src.stop(); } catch (e) { /* stopped */ } }, 500);
    }
    M.running = false; M.cur = null;
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
    if (!A.ctx || !M.running) return;
    if (document.hidden) A.ctx.suspend(); else A.ctx.resume();
  });

  G.audio = {
    get enabled() { return A.on; },
    set enabled(v) { A.on = !!v; },
    get music() { return M.on; },
    set music(v) { M.on = !!v; if (!M.on) musicStop(); else if (A.ctx && A.ctx.state === 'running') musicStart(); },
    musicStart,
    unlock() { const c = ensure(); if (c && M.on) musicStart(); return c; },
    play(name, arg) { if (A.on && SFX[name]) { try { SFX[name](arg); } catch (e) { /* ignore audio errors */ } } },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
