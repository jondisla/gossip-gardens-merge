/* Gossip Gardens - original character portraits and estate plot illustrations (vector, in code). */
(function (root) {
  'use strict';
  const G = root.GG;
  const S = G.STORY;
  const hsl = (h, s, l) => 'hsl(' + h + ',' + s + '%,' + l + '%)';

  // ---- portraits -------------------------------------------------------------------
  function portrait(id) {
    if (G.portraitImages && G.portraitImages[id]) return '<img class="spr portrait" src="' + G.portraitImages[id] + '" alt="" draggable="false">';
    const c = S.CHARS[id] || S.CHARS.you;
    const dark = 'rgba(40,30,25,.85)';
    let back = '', front = '', acc = '';
    switch (c.style) {
      case 'bun':
        back = '<circle cx="32" cy="10" r="6" fill="' + c.hair + '"/>';
        front = '<path d="M19 30 Q18 14 32 14 Q46 14 45 30 Q40 20 32 20 Q24 20 19 30Z" fill="' + c.hair + '"/>'; break;
      case 'cap':
        front = '<path d="M19 27 Q20 11 32 11 Q44 11 45 27Z" fill="' + hsl(c.outfit, 50, 38) + '"/><rect x="17" y="25" width="30" height="4" rx="2" fill="' + hsl(c.outfit, 50, 30) + '"/>' +
                '<path d="M19 29 Q17 36 20 40 M45 29 Q47 36 44 40" stroke="' + c.hair + '" stroke-width="4" fill="none" stroke-linecap="round"/>'; break;
      case 'braids':
        back = '<circle cx="17" cy="42" r="4.5" fill="' + c.hair + '"/><circle cx="47" cy="42" r="4.5" fill="' + c.hair + '"/><circle cx="16" cy="34" r="4.5" fill="' + c.hair + '"/><circle cx="48" cy="34" r="4.5" fill="' + c.hair + '"/>';
        front = '<path d="M19 30 Q18 13 32 13 Q46 13 45 30 Q38 21 32 24 Q26 21 19 30Z" fill="' + c.hair + '"/>'; break;
      case 'wild':
        front = '<path d="M17 30 L16 18 L22 22 L24 10 L29 18 L33 8 L37 18 L42 10 L43 22 L48 18 L47 30 Q40 21 32 21 Q24 21 17 30Z" fill="' + c.hair + '"/>'; break;
      case 'bob':
      default:
        back = '<path d="M17 46 Q14 28 20 17 Q32 8 44 17 Q50 28 47 46Z" fill="' + c.hair + '"/>';
        front = '<path d="M19 28 Q20 14 32 14 Q44 14 45 28 Q38 20 32 22 Q26 20 19 28Z" fill="' + c.hair + '"/>';
    }
    if (c.acc === 'glasses') acc += '<circle cx="27" cy="31" r="4.6" fill="none" stroke="' + dark + '" stroke-width="1.5"/><circle cx="37" cy="31" r="4.6" fill="none" stroke="' + dark + '" stroke-width="1.5"/><path d="M31.6 31 h0.8" stroke="' + dark + '" stroke-width="1.5"/>';
    if (c.acc === 'mustache') acc += '<path d="M25 38 Q28 35 32 38 Q36 35 39 38 Q36 41 32 39 Q28 41 25 38Z" fill="' + c.hair + '"/>';
    if (c.acc === 'hat') acc += '<ellipse cx="32" cy="17" rx="19" ry="4.2" fill="' + hsl(c.outfit, 45, 30) + '"/><path d="M21 17 Q22 5 32 5 Q42 5 43 17Z" fill="' + hsl(c.outfit, 50, 42) + '"/><path d="M21 15 h22" stroke="' + hsl(350, 70, 55) + '" stroke-width="2.4"/>';
    const mouth = c.acc === 'mustache' ? '' : '<path d="M28 38 Q32 42 36 38" stroke="' + dark + '" stroke-width="1.6" fill="none" stroke-linecap="round"/>';
    return '<svg class="spr portrait" viewBox="0 0 64 64" aria-hidden="true">' +
      '<circle cx="32" cy="32" r="31" fill="' + hsl(c.outfit, 45, 88) + '" stroke="' + hsl(c.outfit, 40, 62) + '" stroke-width="1.6"/>' +
      '<clipPath id="pc-' + id + '"><circle cx="32" cy="32" r="30"/></clipPath><g clip-path="url(#pc-' + id + ')">' + back +
      '<path d="M6 66 Q8 47 32 47 Q56 47 58 66Z" fill="' + hsl(c.outfit, 50, 46) + '"/>' +
      '<path d="M26 47 L32 54 L38 47Z" fill="' + hsl(c.outfit, 30, 94) + '"/>' +
      '<rect x="27" y="40" width="10" height="9" rx="3" fill="' + c.skin + '"/>' +
      '<ellipse cx="32" cy="31" rx="13" ry="15" fill="' + c.skin + '"/>' + front +
      '<circle cx="27" cy="31" r="1.9" fill="' + dark + '"/><circle cx="37" cy="31" r="1.9" fill="' + dark + '"/>' +
      '<circle cx="23" cy="36" r="2.6" fill="rgba(240,120,120,.28)"/><circle cx="41" cy="36" r="2.6" fill="rgba(240,120,120,.28)"/>' + mouth + acc + '</g></svg>';
  }

  // ---- estate plots (a broken version and a restored version, two decor styles) -------
  // A finish is a colour shift in degrees (0 = the original colours). Older saves used 1 for "twilight".
  const finishFilter = (f) => { const deg = f === 1 ? 38 : f; return deg ? 'hue-rotate(' + deg + 'deg) saturate(1.1) brightness(.97) ' : ''; };
  function plotArt(kind, done, style, finish) {
    const pi = G.plotImages && G.plotImages[kind];
    if (pi && pi[done ? 1 : 0]) {
      const al = G.plotAlias && G.plotAlias[kind], ap = al && G.plotImages[al];
      const fb = ap ? ' onerror="this.onerror=null;this.src=\'' + ap[done ? 1 : 0] + '\'"' : '';
      const fin = done && finish && finishFilter(finish) ? ' style="filter:' + finishFilter(finish) + 'drop-shadow(0 5px 4px rgba(30,50,20,.35))"' : '';
      return '<img class="spr plotimg" src="' + pi[done ? 1 : 0] + '" alt="" draggable="false"' + fb + fin + '>';
    }
    const h0 = { gate: 30, path: 35, bed: 335, lantern: 46, roof: 12, floor: 200, tables: 335, teaset: 150, press: 215, paper: 48, sign: 20, news: 215 }[kind];
    const h = (h0 + (style ? 40 : 0)) % 360;
    const sat = done ? 55 : 8;
    const c = (l, s2) => hsl(h, s2 == null ? sat : (done ? s2 : Math.min(s2, 10)), l);
    const line = hsl(h, done ? 40 : 8, 26);
    const weeds = done ? '' : '<path d="M8 56 q3 -10 6 0 M16 56 q2 -8 5 0 M48 56 q3 -12 6 0 M55 56 q1 -7 4 0" stroke="' + hsl(100, 30, 40) + '" stroke-width="2" fill="none" stroke-linecap="round"/>';
    const crack = done ? '' : '<path d="M30 10 l-4 10 l6 6 l-5 12" stroke="rgba(40,30,20,.55)" stroke-width="1.6" fill="none" stroke-linejoin="round"/>';
    let art = '';
    switch (kind) {
      case 'gate':
        art = '<rect x="8" y="14" width="8" height="42" rx="2" fill="' + c(40) + '" stroke="' + line + '"/><rect x="48" y="14" width="8" height="42" rx="2" fill="' + c(40) + '" stroke="' + line + '"/>' +
          '<path d="M16 22 Q32 6 48 22" fill="none" stroke="' + c(34) + '" stroke-width="4"/>' +
          (done ? '<path d="M18 26 V54 M26 24 V54 M34 24 V54 M42 26 V54" stroke="' + c(30) + '" stroke-width="3"/>' : '<path d="M18 28 V54 M26 36 V54 M42 30 V54" stroke="' + c(30) + '" stroke-width="3"/>'); break;
      case 'path': {
        let t = ''; const xs = [[10, 48], [26, 42], [14, 34], [30, 28], [18, 20], [34, 14]];
        xs.forEach((p, i) => { t += '<ellipse cx="' + (p[0] + 10) + '" cy="' + p[1] + '" rx="9" ry="5" fill="' + c(64 - (i % 2) * 6) + '" stroke="' + line + '"/>'; });
        art = t; break; }
      case 'bed':
        art = '<rect x="6" y="38" width="52" height="16" rx="4" fill="' + hsl(25, done ? 38 : 12, 34) + '" stroke="' + line + '"/>' +
          (done ? [14, 26, 38, 50].map((x, i) => '<path d="M' + x + ' 40 V28" stroke="' + hsl(130, 50, 36) + '" stroke-width="2.4"/><circle cx="' + x + '" cy="24" r="6" fill="' + hsl((h + i * 25) % 360, 70, 72) + '" stroke="' + hsl(h, 50, 40) + '"/><circle cx="' + x + '" cy="24" r="2.2" fill="' + hsl(46, 95, 62) + '"/>').join('') : ''); break;
      case 'lantern':
        art = '<rect x="29" y="22" width="6" height="34" fill="' + c(32) + '" stroke="' + line + '"/><rect x="21" y="8" width="22" height="16" rx="4" fill="' + (done ? hsl(48, 95, 78) : hsl(0, 0, 78)) + '" stroke="' + line + '" stroke-width="1.6"/>' +
          '<path d="M21 8 h22 l-3 -4 h-16Z" fill="' + c(30) + '" stroke="' + line + '"/>' + (done ? '<circle cx="32" cy="16" r="13" fill="rgba(255,225,120,.35)"/><circle cx="32" cy="16" r="4" fill="' + hsl(46, 100, 62) + '"/>' : ''); break;
      case 'roof':
        art = '<path d="M6 34 L32 8 L58 34Z" fill="' + c(52) + '" stroke="' + line + '" stroke-width="1.6" stroke-linejoin="round"/><rect x="12" y="34" width="40" height="20" fill="' + c(86, 40) + '" stroke="' + line + '"/>' +
          '<path d="M16 28 h32 M22 22 h20" stroke="' + line + '" stroke-width="1" opacity=".5"/>' + (done ? '' : '<polygon points="28,12 40,22 30,24" fill="rgba(210,235,250,.9)"/>'); break;
      case 'floor': {
        let t = ''; for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) t += '<rect x="' + (8 + q * 12) + '" y="' + (10 + r * 11) + '" width="12" height="11" fill="' + c((r + q) % 2 ? 80 : 62) + '" stroke="' + line + '" stroke-width=".8"/>';
        art = t; break; }
      case 'tables':
        art = '<ellipse cx="32" cy="38" rx="20" ry="8" fill="' + c(86, 30) + '" stroke="' + line + '"/><path d="M32 46 v10 M24 56 h16" stroke="' + line + '" stroke-width="3"/>' +
          '<circle cx="10" cy="40" r="5" fill="' + c(50) + '"/><circle cx="54" cy="40" r="5" fill="' + c(50) + '"/>' + (done ? '<circle cx="32" cy="32" r="5" fill="' + hsl(335, 70, 74) + '"/><circle cx="32" cy="32" r="2" fill="' + hsl(46, 95, 62) + '"/>' : ''); break;
      case 'teaset':
        art = '<ellipse cx="32" cy="50" rx="24" ry="7" fill="' + c(80, 30) + '" stroke="' + line + '"/><ellipse cx="28" cy="36" rx="13" ry="11" fill="' + c(60) + '" stroke="' + line + '" stroke-width="1.6"/>' +
          '<path d="M41 34 q10 -2 8 -12" stroke="' + line + '" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M15 38 q-8 0 -8 -8" stroke="' + line + '" stroke-width="3" fill="none"/>' +
          '<circle cx="28" cy="22" r="2.6" fill="' + c(50) + '"/>' + (done ? '<path d="M24 14 q-3 -5 0 -8 M31 14 q-3 -5 0 -8" stroke="rgba(120,140,160,.7)" stroke-width="2" fill="none"/>' : ''); break;
      case 'press':
        art = '<rect x="8" y="28" width="48" height="26" rx="4" fill="' + c(46) + '" stroke="' + line + '" stroke-width="1.6"/><rect x="14" y="14" width="36" height="14" rx="3" fill="' + c(62) + '" stroke="' + line + '"/>' +
          '<circle cx="46" cy="42" r="8" fill="' + c(70) + '" stroke="' + line + '" stroke-width="1.6"/><path d="M46 36 v12 M40 42 h12" stroke="' + line + '" stroke-width="1.6"/><rect x="14" y="36" width="20" height="10" fill="' + c(90, 30) + '" stroke="' + line + '"/>'; break;
      case 'paper': {
        let t = ''; for (let k = 0; k < 4; k++) t += '<rect x="' + (14 + k * 2) + '" y="' + (40 - k * 8) + '" width="34" height="16" rx="2" fill="' + c(92 - k * 2, 30) + '" stroke="' + line + '" transform="rotate(' + (k % 2 ? -3 : 3) + ' 32 ' + (48 - k * 8) + ')"/>';
        art = t + (done ? '<path d="M22 22 h20 M22 26 h14" stroke="' + line + '" stroke-width="1.6"/>' : ''); break; }
      case 'sign':
        art = '<rect x="14" y="26" width="5" height="30" fill="' + c(34) + '"/><rect x="45" y="26" width="5" height="30" fill="' + c(34) + '"/><rect x="8" y="10" width="48" height="22" rx="4" fill="' + c(62) + '" stroke="' + line + '" stroke-width="1.6"/>' +
          '<path d="M16 18 h32 M20 25 h24" stroke="' + (done ? hsl(46, 95, 85) : line) + '" stroke-width="3" stroke-linecap="round"/>'; break;
      case 'news':
      default:
        art = '<rect x="12" y="8" width="40" height="48" rx="3" fill="' + c(94, 30) + '" stroke="' + line + '" stroke-width="1.6"/><rect x="17" y="14" width="30" height="9" fill="' + c(30) + '"/>' +
          '<path d="M17 30 h30 M17 35 h30 M17 40 h20 M17 45 h26" stroke="' + line + '" stroke-width="1.6"/><rect x="38" y="38" width="9" height="9" fill="' + c(60) + '"/>';
    }
    const bg = '<rect x="2" y="2" width="60" height="60" rx="14" fill="' + (done ? hsl(h, 45, 90) : hsl(40, 10, 86)) + '" stroke="' + (done ? hsl(h, 40, 62) : hsl(40, 8, 68)) + '" stroke-width="1.6"/>';
    return '<svg class="spr plot" viewBox="0 0 64 64" aria-hidden="true">' + bg + art + crack + weeds + '</svg>';
  }

  // ---- small UI icons (original) ---------------------------------------------------------
  function navIcon(name) {
    const st = 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
    const p = {
      garden: '<path d="M12 21 V11 M12 13 C6 13 5 8 8 6 C11 7 12 10 12 13 M12 11 C18 11 19 6 16 4 C13 5 12 8 12 11" ' + st + '/><path d="M6 21 h12" ' + st + '/>',
      estate: '<path d="M4 20 V10 L12 4 L20 10 V20Z" ' + st + '/><path d="M10 20 v-6 h4 v6" ' + st + '/>',
      shop: '<path d="M5 8 h14 l-1 12 H6Z" ' + st + '/><path d="M9 8 V6 a3 3 0 0 1 6 0 V8" ' + st + '/>',
      events: '<path d="M12 3 l2.6 5.4 5.9 .8 -4.3 4.2 1 5.9 L12 16.5 6.8 19.3l1-5.9L3.5 9.2l5.9-.8Z" ' + st + '/>',
      sound: '<path d="M4 9 h4 l5 -4 v14 l-5 -4 H4Z" ' + st + '/><path d="M16 9 a4 4 0 0 1 0 6 M18.5 6.5 a8 8 0 0 1 0 11" ' + st + '/>',
      mute: '<path d="M4 9 h4 l5 -4 v14 l-5 -4 H4Z" ' + st + '/><path d="M16 9 l5 6 M21 9 l-5 6" ' + st + '/>',
    };
    return '<svg class="nav-ico" viewBox="0 0 24 24" aria-hidden="true">' + (p[name] || '') + '</svg>';
  }

  Object.assign(G, { portrait, plotArt, navIcon });
})(typeof globalThis !== 'undefined' ? globalThis : this);
