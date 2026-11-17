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

  G.audio = {
    get enabled() { return A.on; },
    set enabled(v) { A.on = !!v; },
    unlock: ensure,
    play(name, arg) { if (A.on && SFX[name]) { try { SFX[name](arg); } catch (e) { /* ignore audio errors */ } } },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
