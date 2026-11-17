/* Gossip Gardens - original vector art, drawn in code.
 * Every item is looked up through GG.sprite(chain, level). To use painted art later,
 * set GG.imageOverrides['seed:3'] = 'art/seed_3.png' (see README) and nothing else changes.
 */
(function (root) {
  'use strict';
  const G = root.GG;
  const { CHAINS, maxLevel } = G;

  const hsl = (h, s, l) => 'hsl(' + h + ',' + s + '%,' + l + '%)';
  const f = (n) => Math.round(n * 10) / 10;

  // ---- small reusable shapes (64x64 space) --------------------------------
  function bloom(cx, cy, r, h, petals) {
    let s = '';
    for (let k = 0; k < petals; k++) {
      const a = (k / petals) * Math.PI * 2;
      s += '<circle cx="' + f(cx + Math.cos(a) * r * 0.95) + '" cy="' + f(cy + Math.sin(a) * r * 0.95) +
           '" r="' + f(r * 0.72) + '" fill="' + hsl(h, 75, k % 2 ? 72 : 78) + '" stroke="' + hsl(h, 55, 52) + '" stroke-width="0.8"/>';
    }
    return s + '<circle cx="' + cx + '" cy="' + cy + '" r="' + f(r * 0.55) + '" fill="' + hsl(46, 95, 62) + '" stroke="' + hsl(38, 80, 45) + '" stroke-width="0.8"/>';
  }
  function leafShape(x, y, rot, sc, h) {
    return '<g transform="translate(' + x + ',' + y + ') rotate(' + rot + ') scale(' + sc + ')">' +
      '<path d="M0 0 C-9 -6 -9 -20 0 -26 C9 -20 9 -6 0 0Z" fill="' + hsl(h, 55, 48) + '" stroke="' + hsl(h, 55, 30) + '" stroke-width="1.2"/>' +
      '<path d="M0 -2 L0 -22" stroke="' + hsl(h, 50, 70) + '" stroke-width="1.2" fill="none"/></g>';
  }
  function coin(cx, cy, r) {
    return '<ellipse cx="' + cx + '" cy="' + f(cy + r * 0.28) + '" rx="' + r + '" ry="' + f(r * 0.6) + '" fill="' + hsl(36, 85, 38) + '"/>' +
           '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + r + '" ry="' + f(r * 0.6) + '" fill="' + hsl(46, 95, 60) + '" stroke="' + hsl(38, 85, 42) + '" stroke-width="1"/>' +
           '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + f(r * 0.62) + '" ry="' + f(r * 0.34) + '" fill="none" stroke="' + hsl(38, 85, 48) + '" stroke-width="1"/>';
  }
  function gem(cx, cy, s, h) {
    const p = [[cx, cy - s], [cx + s * 0.85, cy - s * 0.3], [cx + s * 0.55, cy + s], [cx - s * 0.55, cy + s], [cx - s * 0.85, cy - s * 0.3]]
      .map((q) => f(q[0]) + ',' + f(q[1])).join(' ');
    return '<polygon points="' + p + '" fill="' + hsl(h, 70, 62) + '" stroke="' + hsl(h, 60, 35) + '" stroke-width="1.2" stroke-linejoin="round"/>' +
      '<polyline points="' + f(cx - s * 0.85) + ',' + f(cy - s * 0.3) + ' ' + f(cx + s * 0.85) + ',' + f(cy - s * 0.3) + '" stroke="' + hsl(h, 70, 85) + '" stroke-width="1" fill="none"/>' +
      '<polyline points="' + f(cx - s * 0.3) + ',' + f(cy - s * 0.3) + ' ' + f(cx - s * 0.1) + ',' + f(cy + s) + ' ' + f(cx + s * 0.1) + ',' + f(cy - s * 0.3) + '" stroke="' + hsl(h, 70, 80) + '" stroke-width="0.8" fill="none"/>';
  }
  function sparkle(cx, cy, s) {
    return '<path d="M' + cx + ' ' + (cy - s) + ' L' + f(cx + s * 0.28) + ' ' + f(cy - s * 0.28) + ' L' + (cx + s) + ' ' + cy +
      ' L' + f(cx + s * 0.28) + ' ' + f(cy + s * 0.28) + ' L' + cx + ' ' + (cy + s) + ' L' + f(cx - s * 0.28) + ' ' + f(cy + s * 0.28) +
      ' L' + (cx - s) + ' ' + cy + ' L' + f(cx - s * 0.28) + ' ' + f(cy - s * 0.28) + 'Z" fill="' + hsl(48, 100, 75) + '" stroke="' + hsl(40, 90, 55) + '" stroke-width="0.6"/>';
  }
  function ribbonBow(cx, cy, h) {
    return '<path d="M' + cx + ' ' + cy + ' L' + (cx - 9) + ' ' + (cy - 6) + ' L' + (cx - 9) + ' ' + (cy + 6) + 'Z M' + cx + ' ' + cy + ' L' + (cx + 9) + ' ' + (cy - 6) + ' L' + (cx + 9) + ' ' + (cy + 6) + 'Z" fill="' + hsl(h, 70, 55) + '" stroke="' + hsl(h, 60, 35) + '" stroke-width="1"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="' + hsl(h, 70, 45) + '"/>';
  }
  function teapot(cx, cy, sc) {
    return '<g transform="translate(' + cx + ',' + cy + ') scale(' + sc + ')">' +
      '<path d="M-14 4 Q-22 4 -22 -4" fill="none" stroke="' + hsl(150, 40, 30) + '" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M14 0 Q26 -4 24 -14" fill="none" stroke="' + hsl(150, 40, 30) + '" stroke-width="4" stroke-linecap="round"/>' +
      '<ellipse cx="0" cy="2" rx="16" ry="13" fill="' + hsl(150, 45, 62) + '" stroke="' + hsl(150, 45, 30) + '" stroke-width="1.6"/>' +
      '<path d="M-10 -9 Q0 -17 10 -9Z" fill="' + hsl(150, 40, 50) + '" stroke="' + hsl(150, 45, 30) + '" stroke-width="1.4"/>' +
      '<circle cx="0" cy="-15" r="2.6" fill="' + hsl(46, 90, 60) + '" stroke="' + hsl(38, 80, 40) + '" stroke-width="1"/>' +
      '<path d="M-8 0 Q0 6 8 0" fill="none" stroke="' + hsl(150, 60, 85) + '" stroke-width="1.6" stroke-linecap="round"/></g>';
  }
  function cup(cx, cy, sc) {
    return '<g transform="translate(' + cx + ',' + cy + ') scale(' + sc + ')">' +
      '<path d="M12 -4 Q22 -4 20 4 Q18 10 10 9" fill="none" stroke="' + hsl(150, 40, 35) + '" stroke-width="2.6" stroke-linecap="round"/>' +
      '<path d="M-14 -8 L14 -8 L11 8 Q0 14 -11 8Z" fill="' + hsl(40, 60, 94) + '" stroke="' + hsl(150, 40, 35) + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<ellipse cx="0" cy="-8" rx="14" ry="3.2" fill="' + hsl(30, 70, 55) + '" stroke="' + hsl(150, 40, 35) + '" stroke-width="1.2"/></g>';
  }
  function steam(cx, cy) {
    return '<path d="M' + (cx - 5) + ' ' + cy + ' q-4 -6 0 -10 q4 -4 0 -9 M' + (cx + 4) + ' ' + (cy + 1) + ' q-4 -6 0 -10 q4 -4 0 -9" fill="none" stroke="' + hsl(200, 30, 78) + '" stroke-width="2" stroke-linecap="round" opacity="0.9"/>';
  }

  // ---- art per chain: returns SVG fragment in a 64x64 box -----------------
  const ART = {
    seed(L) {
      const soil = '<ellipse cx="32" cy="52" rx="15" ry="5" fill="' + hsl(25, 38, 36) + '"/>';
      const stem = (y0) => '<path d="M32 50 Q31 ' + f((50 + y0) / 2) + ' 32 ' + y0 + '" stroke="' + hsl(130, 50, 36) + '" stroke-width="3.2" fill="none" stroke-linecap="round"/>';
      if (L === 1) return soil + '<ellipse cx="32" cy="45" rx="6" ry="8.5" transform="rotate(-22 32 45)" fill="' + hsl(32, 50, 38) + '" stroke="' + hsl(28, 50, 22) + '" stroke-width="1.2"/>' +
        '<ellipse cx="30" cy="42" rx="1.8" ry="3" transform="rotate(-22 30 42)" fill="' + hsl(38, 60, 60) + '"/>';
      if (L === 2) return soil + stem(30) + leafShape(30, 38, -55, 0.55, 130) + leafShape(34, 32, 55, 0.62, 130);
      if (L === 3) return soil + stem(30) + leafShape(30, 44, -60, 0.45, 130) + leafShape(34, 40, 60, 0.45, 130) +
        '<path d="M32 13 C22 22 23 33 32 35 C41 33 42 22 32 13Z" fill="' + hsl(335, 75, 74) + '" stroke="' + hsl(335, 55, 45) + '" stroke-width="1.4"/>' +
        '<path d="M32 16 C28 24 28 30 32 33" fill="none" stroke="' + hsl(335, 80, 88) + '" stroke-width="1.4"/>';
      if (L === 4) return soil + stem(30) + leafShape(30, 44, -60, 0.5, 130) + leafShape(34, 40, 60, 0.5, 130) + bloom(32, 22, 8.5, 335, 6);
      const stems = '<path d="M32 52 L20 28 M32 52 L44 28 M32 52 L32 20" stroke="' + hsl(130, 50, 36) + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
      if (L === 5) return stems + bloom(20, 26, 6.5, 335, 6) + bloom(44, 26, 6.5, 300, 6) + bloom(32, 17, 7, 20, 6) + ribbonBow(32, 48, 350);
      return stems + '<path d="M32 52 L12 36 M32 52 L52 36" stroke="' + hsl(130, 50, 36) + '" stroke-width="3" fill="none" stroke-linecap="round"/>' +
        bloom(12, 33, 5.5, 300, 6) + bloom(52, 33, 5.5, 20, 6) + bloom(20, 24, 6.5, 335, 6) + bloom(44, 24, 6.5, 300, 6) + bloom(32, 15, 7.5, 350, 7) +
        ribbonBow(32, 47, 350) + sparkle(54, 10, 5) + sparkle(9, 14, 4);
    },
    leaf(L) {
      if (L === 1) return leafShape(32, 50, -20, 1.55, 140);
      if (L === 2) return leafShape(24, 50, -40, 1.1, 150) + leafShape(36, 52, 18, 1.2, 135) + leafShape(30, 48, -4, 1.05, 160);
      if (L === 3) return steam(32, 22) + cup(32, 44, 1.45);
      if (L === 4) return steam(32, 14) + teapot(32, 38, 1.35);
      if (L === 5) return '<ellipse cx="32" cy="50" rx="27" ry="8" fill="' + hsl(40, 35, 55) + '" stroke="' + hsl(40, 35, 30) + '" stroke-width="1.5"/><ellipse cx="32" cy="48" rx="25" ry="6.5" fill="' + hsl(40, 45, 78) + '"/>' +
        teapot(23, 36, 0.95) + cup(46, 42, 0.7);
      return '<ellipse cx="32" cy="52" rx="29" ry="8" fill="' + hsl(40, 35, 55) + '" stroke="' + hsl(40, 35, 30) + '" stroke-width="1.5"/><ellipse cx="32" cy="50" rx="27" ry="6.5" fill="' + hsl(40, 45, 78) + '"/>' +
        teapot(24, 36, 1) + cup(47, 44, 0.62) + cup(13, 46, 0.5) + bloom(50, 28, 3.6, 335, 5) + sparkle(54, 10, 5) + sparkle(8, 22, 3.5);
    },
    flour(L) {
      if (L === 1) return '<ellipse cx="32" cy="50" rx="19" ry="6" fill="' + hsl(35, 25, 70) + '"/>' +
        '<path d="M13 50 Q20 28 32 26 Q44 28 51 50Z" fill="' + hsl(42, 45, 94) + '" stroke="' + hsl(35, 30, 62) + '" stroke-width="1.4"/>' + sparkle(40, 36, 3) + sparkle(24, 42, 2.2);
      if (L === 2) return '<ellipse cx="32" cy="50" rx="19" ry="5" fill="' + hsl(35, 25, 70) + '"/>' +
        '<ellipse cx="32" cy="38" rx="19" ry="15" fill="' + hsl(38, 60, 82) + '" stroke="' + hsl(32, 40, 50) + '" stroke-width="1.5"/>' +
        '<path d="M22 30 q6 -6 12 -2 M26 42 q8 4 16 -2" fill="none" stroke="' + hsl(34, 40, 62) + '" stroke-width="1.5" stroke-linecap="round"/>';
      if (L === 3) {
        let d = '<circle cx="32" cy="36" r="19" fill="' + hsl(33, 62, 62) + '" stroke="' + hsl(28, 55, 36) + '" stroke-width="1.6"/><circle cx="32" cy="36" r="14" fill="none" stroke="' + hsl(33, 55, 50) + '" stroke-width="1.2" stroke-dasharray="2 3"/>';
        [[26, 30], [38, 31], [32, 40], [24, 42], [40, 42]].forEach((p) => { d += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.8" fill="' + hsl(26, 50, 30) + '"/>'; });
        return d;
      }
      if (L === 4) return '<path d="M10 34 L54 34 L48 54 L16 54Z" fill="' + hsl(34, 62, 66) + '" stroke="' + hsl(28, 55, 36) + '" stroke-width="1.6" stroke-linejoin="round"/>' +
        '<path d="M16 38 L16 54 M24 38 L24 54 M32 38 L32 54 M40 38 L40 54 M48 38 L48 54" stroke="' + hsl(30, 50, 48) + '" stroke-width="1" opacity=".5"/>' +
        '<ellipse cx="32" cy="34" rx="22" ry="7" fill="' + hsl(48, 90, 90) + '" stroke="' + hsl(35, 50, 55) + '" stroke-width="1.2"/>' +
        '<circle cx="24" cy="32" r="3.6" fill="' + hsl(350, 75, 52) + '"/><circle cx="33" cy="30" r="3.6" fill="' + hsl(350, 75, 58) + '"/><circle cx="41" cy="33" r="3.6" fill="' + hsl(350, 75, 52) + '"/>';
      const tier = (x, y, w, h, hue) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="3" fill="' + hsl(hue, 70, 82) + '" stroke="' + hsl(hue, 45, 45) + '" stroke-width="1.4"/>' +
        '<path d="M' + x + ' ' + (y + 5) + ' q' + f(w / 8) + ' 6 ' + f(w / 4) + ' 0 t' + f(w / 4) + ' 0 t' + f(w / 4) + ' 0 t' + f(w / 4) + ' 0" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round"/>';
      if (L === 5) return tier(10, 36, 44, 18, 335) + tier(17, 22, 30, 16, 40) + '<circle cx="32" cy="18" r="4.2" fill="' + hsl(350, 80, 50) + '" stroke="' + hsl(350, 60, 30) + '" stroke-width="1"/><path d="M32 14 q4 -6 8 -6" stroke="' + hsl(130, 50, 35) + '" stroke-width="1.6" fill="none"/>';
      return tier(7, 40, 50, 15, 335) + tier(13, 28, 38, 14, 40) + tier(20, 17, 24, 13, 200) +
        '<path d="M26 17 v-6 M32 17 v-8 M38 17 v-6" stroke="' + hsl(210, 60, 70) + '" stroke-width="2.4" stroke-linecap="round"/>' +
        '<circle cx="26" cy="9" r="1.8" fill="' + hsl(30, 100, 60) + '"/><circle cx="32" cy="7" r="1.8" fill="' + hsl(30, 100, 60) + '"/><circle cx="38" cy="9" r="1.8" fill="' + hsl(30, 100, 60) + '"/>' + sparkle(54, 20, 5) + sparkle(8, 26, 4);
    },
    paper(L) {
      const lines = (x, y, w, n) => { let s = ''; for (let k = 0; k < n; k++) s += '<path d="M' + x + ' ' + (y + k * 6) + ' h' + (k === n - 1 ? w * 0.6 : w) + '" stroke="' + hsl(215, 30, 60) + '" stroke-width="1.6" stroke-linecap="round"/>'; return s; };
      if (L === 1) return '<path d="M16 22 L40 16 L50 30 L44 46 L22 48 L14 36Z" fill="' + hsl(48, 50, 94) + '" stroke="' + hsl(40, 30, 55) + '" stroke-width="1.4" stroke-linejoin="round"/>' + lines(22, 28, 18, 2);
      if (L === 2) return '<rect x="14" y="16" width="36" height="34" rx="3" fill="' + hsl(48, 55, 95) + '" stroke="' + hsl(40, 30, 55) + '" stroke-width="1.4"/>' +
        '<path d="M50 16 L50 30 L36 30Z" fill="' + hsl(40, 35, 80) + '" stroke="' + hsl(40, 30, 55) + '" stroke-width="1.2"/>' + lines(20, 28, 20, 3);
      if (L === 3) return '<rect x="14" y="10" width="36" height="44" rx="3" fill="' + hsl(48, 55, 96) + '" stroke="' + hsl(40, 30, 55) + '" stroke-width="1.4"/>' + lines(20, 20, 24, 5) + '<path d="M20 15 h10" stroke="' + hsl(350, 60, 50) + '" stroke-width="2.4" stroke-linecap="round"/>';
      if (L === 4) return '<rect x="8" y="18" width="48" height="34" rx="4" fill="' + hsl(48, 55, 94) + '" stroke="' + hsl(40, 30, 50) + '" stroke-width="1.5"/>' +
        '<path d="M8 20 L32 38 L56 20" fill="' + hsl(48, 45, 88) + '" stroke="' + hsl(40, 30, 50) + '" stroke-width="1.5" stroke-linejoin="round"/>' +
        '<circle cx="32" cy="38" r="7" fill="' + hsl(350, 70, 48) + '" stroke="' + hsl(350, 60, 28) + '" stroke-width="1.4"/><path d="M29 38 l2 2 l4 -4" stroke="white" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
      if (L === 5) return '<rect x="14" y="14" width="36" height="36" fill="' + hsl(46, 55, 93) + '" stroke="' + hsl(40, 30, 50) + '" stroke-width="1.4"/>' +
        '<ellipse cx="14" cy="32" rx="5" ry="18" fill="' + hsl(44, 45, 82) + '" stroke="' + hsl(40, 30, 50) + '" stroke-width="1.4"/><ellipse cx="50" cy="32" rx="5" ry="18" fill="' + hsl(44, 45, 82) + '" stroke="' + hsl(40, 30, 50) + '" stroke-width="1.4"/>' +
        lines(20, 24, 24, 3) + '<rect x="29" y="12" width="6" height="40" fill="' + hsl(350, 70, 52) + '"/>' + ribbonBow(32, 32, 350);
      return '<path d="M8 20 h18 l4 6 h26 v28 h-48Z" fill="' + hsl(212, 55, 62) + '" stroke="' + hsl(212, 50, 32) + '" stroke-width="1.6" stroke-linejoin="round"/>' +
        '<rect x="8" y="28" width="48" height="26" rx="3" fill="' + hsl(212, 60, 72) + '" stroke="' + hsl(212, 50, 32) + '" stroke-width="1.6"/>' +
        '<rect x="26" y="34" width="12" height="11" rx="2" fill="' + hsl(46, 90, 58) + '" stroke="' + hsl(38, 80, 35) + '" stroke-width="1.2"/><path d="M29 34 v-4 a3 3 0 0 1 6 0 v4" fill="none" stroke="' + hsl(38, 80, 35) + '" stroke-width="1.6"/>' + sparkle(52, 14, 5) + sparkle(12, 12, 4);
    },
    coin(L) {
      if (L === 1) return coin(32, 34, 15);
      if (L === 2) return coin(22, 38, 13) + coin(42, 34, 13);
      if (L === 3) return coin(20, 44, 12) + coin(44, 44, 12) + coin(32, 30, 12);
      if (L === 4) { let s = ''; for (let k = 0; k < 5; k++) s += coin(32 + (k % 2 ? 2 : -2), 50 - k * 7, 14); return s; }
      return coin(16, 48, 11) + coin(48, 48, 11) + coin(32, 44, 13) + coin(24, 30, 11) + coin(42, 28, 11) + gem(32, 14, 8, 335) + sparkle(8, 20, 4) + sparkle(56, 12, 4);
    },
    gem(L) {
      if (L === 1) return gem(32, 32, 16, 282);
      if (L === 2) return gem(22, 38, 12, 282) + gem(42, 34, 14, 200);
      return gem(18, 44, 10, 150) + gem(46, 44, 10, 335) + gem(32, 26, 15, 282) + sparkle(10, 16, 4) + sparkle(56, 18, 3.5);
    },
    bolt(L) {
      const sc = 0.62 + L * 0.1;
      return '<g transform="translate(32,32) scale(' + f(sc) + ') translate(-32,-32)"><polygon points="38,4 16,36 29,36 24,60 50,24 35,24" fill="' + hsl(50, 100, 60) + '" stroke="' + hsl(32, 90, 42) + '" stroke-width="2.4" stroke-linejoin="round"/>' +
        '<polygon points="36,12 24,32 33,32 30,46" fill="' + hsl(55, 100, 82) + '" opacity=".8"/></g>' + (L >= 3 ? sparkle(10, 14, 4) + sparkle(56, 48, 4) : '') + (L >= 4 ? sparkle(54, 12, 3.5) : '');
    },
    gift(L) {
      const sc = 0.78 + L * 0.1;
      const h = L === 1 ? 8 : L === 2 ? 200 : 280;
      return '<g transform="translate(32,34) scale(' + f(sc) + ') translate(-32,-34)">' +
        '<rect x="12" y="28" width="40" height="26" rx="3" fill="' + hsl(h, 65, 62) + '" stroke="' + hsl(h, 55, 32) + '" stroke-width="1.8"/>' +
        '<rect x="9" y="20" width="46" height="11" rx="3" fill="' + hsl(h, 70, 70) + '" stroke="' + hsl(h, 55, 32) + '" stroke-width="1.8"/>' +
        '<rect x="28" y="20" width="8" height="34" fill="' + hsl(46, 95, 60) + '"/>' +
        (L >= 2 ? ribbonBow(32, 18, 46) : '<path d="M32 20 q-8 -10 -10 -4 q0 5 10 4 q10 1 10 -4 q-2 -6 -10 4Z" fill="' + hsl(46, 95, 60) + '" stroke="' + hsl(38, 80, 40) + '" stroke-width="1.2"/>') + '</g>' +
        (L >= 3 ? sparkle(8, 14, 5) + sparkle(56, 12, 4.5) : '');
    },
  };

  // ---- tools and the auto machine ------------------------------------------------
  ART.scissors = function (L) {
    const metal = hsl(210, 12, 78), edge = hsl(215, 20, 34), grip = L >= 3 ? hsl(46, 90, 56) : hsl(22, 85, 56);
    return '<g transform="rotate(-30 32 34)">' +
      '<path d="M32 36 L22 6 L27 5 L34 34Z" fill="' + metal + '" stroke="' + edge + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<path d="M32 36 L42 6 L37 5 L30 34Z" fill="' + hsl(210, 12, 70) + '" stroke="' + edge + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<circle cx="23" cy="48" r="9" fill="none" stroke="' + grip + '" stroke-width="5.5"/><circle cx="41" cy="48" r="9" fill="none" stroke="' + grip + '" stroke-width="5.5"/>' +
      '<circle cx="32" cy="35" r="2.6" fill="' + hsl(46, 90, 60) + '" stroke="' + edge + '"/></g>' + (L >= 2 ? sparkle(52, 14, 5) : '') + (L >= 3 ? sparkle(10, 18, 4) : '');
  };
  ART.dust = function () {
    return '<path d="M26 22 h12 v8 q10 6 10 18 q0 8 -16 8 q-16 0 -16 -8 q0 -12 10 -18Z" fill="' + hsl(290, 55, 86) + '" stroke="' + hsl(290, 40, 36) + '" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<rect x="26" y="14" width="12" height="9" rx="2" fill="' + hsl(30, 55, 52) + '" stroke="' + hsl(25, 50, 28) + '" stroke-width="1.4"/>' +
      '<circle cx="26" cy="46" r="2.6" fill="' + hsl(335, 80, 70) + '"/><circle cx="34" cy="42" r="2.6" fill="' + hsl(190, 80, 62) + '"/><circle cx="38" cy="50" r="2.6" fill="' + hsl(50, 95, 62) + '"/><circle cx="29" cy="52" r="2" fill="' + hsl(140, 70, 58) + '"/>' +
      sparkle(50, 12, 6) + sparkle(12, 30, 4);
  };
  ART.orb = function () {
    return '<path d="M16 58 Q32 50 48 58 L44 50 Q32 46 20 50Z" fill="' + hsl(30, 45, 40) + '" stroke="' + hsl(28, 45, 22) + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<circle cx="32" cy="30" r="21" fill="' + hsl(205, 70, 78) + '" stroke="' + hsl(215, 55, 34) + '" stroke-width="2"/>' +
      '<circle cx="32" cy="30" r="15" fill="' + hsl(215, 65, 60) + '" opacity=".55"/>' +
      '<path d="M32 18 l3 7 7 1 -5 5 1.5 7 -6.5 -3.5 -6.5 3.5 1.5 -7 -5 -5 7 -1Z" fill="' + hsl(48, 100, 70) + '" stroke="' + hsl(38, 85, 48) + '" stroke-width="1"/>' +
      '<ellipse cx="23" cy="20" rx="5" ry="3" transform="rotate(-35 23 20)" fill="rgba(255,255,255,.75)"/>';
  };

  function vineArt(L) {
    const g = hsl(128, 50, 38);
    let leaves = '', flowers = '';
    [[20, 30, -50], [44, 26, 50], [18, 42, -60], [46, 40, 60], [26, 18, -30], [38, 14, 30]].slice(0, 3 + L).forEach((p) => { leaves += leafShape(p[0], p[1] + 8, p[2], 0.7, 128); });
    for (let k = 0; k < L; k++) flowers += bloom(18 + k * 14, 14 + (k % 2) * 6, 4.4, 335 + k * 25, 5);
    return '<path d="M16 44 h32 l-4 14 h-24Z" fill="' + hsl(18, 60, 52) + '" stroke="' + hsl(15, 55, 28) + '" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<rect x="14" y="40" width="36" height="6" rx="3" fill="' + hsl(18, 60, 60) + '" stroke="' + hsl(15, 55, 28) + '" stroke-width="1.4"/>' +
      '<path d="M32 42 Q18 34 22 22 M32 42 Q46 34 42 20 M32 42 V14" fill="none" stroke="' + g + '" stroke-width="3" stroke-linecap="round"/>' + leaves + flowers;
  }

  function generatorArt(chain, L) {
    const def = CHAINS[chain], h = def.hue;
    if (def.auto) return vineArt(L);
    let stars = '';
    for (let k = 0; k < L; k++) stars += '<circle cx="' + (26 + k * 6) + '" cy="57" r="2.2" fill="' + hsl(48, 100, 62) + '" stroke="' + hsl(38, 80, 35) + '" stroke-width=".7"/>';
    const pl = Math.min(2 + L, maxLevel(def.produces)), pimg = G.imageOverrides[def.produces + ':' + pl];
    const inner = pimg ? '<image href="' + pimg + '" x="4" y="4" width="56" height="56" preserveAspectRatio="xMidYMid meet"/>' : ART[def.produces](pl);
    return '<rect x="7" y="9" width="50" height="44" rx="10" fill="' + hsl(h, 42, 36) + '" stroke="' + hsl(h, 45, 20) + '" stroke-width="1.6"/>' +
      '<rect x="11" y="13" width="42" height="32" rx="7" fill="' + hsl(h, 55, 90) + '" stroke="' + hsl(h, 40, 52) + '" stroke-width="1"/>' +
      '<g transform="translate(32,29) scale(.58) translate(-32,-32)">' + inner + '</g>' +
      '<rect x="19" y="46" width="26" height="6" rx="3" fill="' + hsl(h, 40, 22) + '"/>' + stars;
  }

  function art(chain, level) {
    const def = CHAINS[chain];
    if (def.role === 'generator') return generatorArt(chain, level);
    return ART[chain] ? ART[chain](Math.min(level, maxLevel(chain))) : '';
  }

  function pips(def, level, top) {
    let s = '';
    for (let k = 0; k < level; k++) {
      s += '<circle cx="' + (7 + k * 5) + '" cy="58" r="2" fill="' + (top ? hsl(46, 95, 55) : hsl(def.hue, 35, 38)) + '" stroke="white" stroke-width=".6"/>';
    }
    return s;
  }

  G.imageOverrides = G.imageOverrides || {};

  // ---- shading: turn flat fills into soft top-lit gradients --------------------------
  const gradKnown = {};
  let defsEl = null;
  function gradDefs() {
    if (defsEl) return defsEl;
    defsEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    defsEl.setAttribute('width', '0'); defsEl.setAttribute('height', '0');
    defsEl.setAttribute('aria-hidden', 'true');
    defsEl.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    document.body.appendChild(defsEl);
    return defsEl;
  }
  function gradId(h, s, l) {
    const id = 'gg' + h + '_' + s + '_' + l;
    if (!gradKnown[id]) {
      gradKnown[id] = true;
      const hi = Math.min(l + 12, 97), lo = Math.max(l - 11, 5);
      const stops = '<stop offset="0" stop-color="hsl(' + h + ',' + s + '%,' + hi + '%)"/><stop offset=".55" stop-color="hsl(' + h + ',' + s + '%,' + l + '%)"/><stop offset="1" stop-color="hsl(' + h + ',' + s + '%,' + lo + '%)"/>';
      const lg = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      lg.setAttribute('id', id); lg.setAttribute('x1', '0'); lg.setAttribute('y1', '0'); lg.setAttribute('x2', '0.35'); lg.setAttribute('y2', '1');
      lg.innerHTML = stops;
      gradDefs().appendChild(lg);
    }
    return id;
  }
  function shade(str) {
    if (typeof document === 'undefined') return str;
    return str.replace(/fill="hsl\((\d+),(\d+)%,(\d+)%\)"/g, (m, h, s, l) => 'fill="url(#' + gradId(+h, +s, +l) + ')"');
  }

  /** opts.tile draws a soft rounded backdrop (used in the info panel); the board shows bare items. */
  function sprite(chain, level, opts) {
    const def = CHAINS[chain];
    const key = chain + ':' + level;
    if (G.imageOverrides[key]) return '<img class="spr" src="' + G.imageOverrides[key] + '" alt="" draggable="false">';
    const tile = opts && opts.tile;
    const top = level >= maxLevel(chain);
    const bg = tile ? '<rect x="2" y="2" width="60" height="60" rx="16" fill="' + hsl(def.hue, 45, 92) + '" stroke="' + hsl(def.hue, 35, 74) + '" stroke-width="1.6"/>' : '';
    const ground = tile ? '' : '<ellipse cx="32" cy="58" rx="16" ry="3" fill="rgba(40,50,40,.18)"/>';
    return '<svg class="spr" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' + bg + ground + shade(art(chain, level)) + (tile && !top ? '' : '') + '</svg>';
  }

  function icon(name) {
    if (G.iconImages && G.iconImages[name]) return '<img class="ico" src="' + G.iconImages[name] + '" alt="" draggable="false">';
    const map = { coin: coin(32, 34, 24), gem: gem(32, 32, 26, 282), bolt: ART.bolt(3), star: sparkle(32, 32, 28) };
    return '<svg class="ico" viewBox="0 0 64 64" aria-hidden="true">' + (map[name] || '') + '</svg>';
  }

  Object.assign(G, { sprite, icon, art });
})(typeof globalThis !== 'undefined' ? globalThis : this);
