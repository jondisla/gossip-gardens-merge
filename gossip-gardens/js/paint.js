/* Gossip Gardens - sensible colour choices for repaired pieces.
   Each piece lists only the parts that could really be painted (a door, a roof, flower blossoms, brick, iron, stone tint),
   found by colour and position in the picture. Leaves, wood, water and the like never change. The player's choice is
   stored as an option number (0 = classic colours). Recoloured pictures are made once in a canvas and cached. */
(function (root) {
  'use strict';
  const G = root.GG;

  // zone: which pixels may change. h = hue range in degrees (may wrap), smin/vmin/vmax = saturation / brightness limits,
  //       box = [x0, y0, x1, y1] as fractions of the picture. mode 'neutral' = grey/white stone, 'dark' = black iron.
  // opts: h = new hue, s = new saturation (scaled by the pixel's own), v = brightness multiplier, n = name.
  const FLOWER_WHITE = { n: 'White', h: 40, s: 0.09, v: 1.42 }, FLOWER_YELLOW = { n: 'Yellow', h: 47, s: 0.8, v: 1.3 }, FLOWER_LILAC = { n: 'Lilac', h: 272, s: 0.5, v: 1.15 };
  const STONE = [{ n: 'Sandstone', h: 38, s: 0.24, v: 1 }, { n: 'Slate', h: 214, s: 0.13, v: 0.93 }, { n: 'Rose granite', h: 8, s: 0.14, v: 1 }];
  const IRON = [{ n: 'Forest', h: 150, s: 0.55, v: 1.25 }, { n: 'Navy', h: 220, s: 0.6, v: 1.3 }, { n: 'Bronze', h: 28, s: 0.45, v: 1.2 }];
  const PAINT = {
    gate:      { zone: { h: [80, 170], smin: 0.35, box: [0, 0, 1, 0.72] }, opts: [{ n: 'Blue', h: 212, s: 0.55, v: 1 }, { n: 'Red', h: 4, s: 0.62, v: 1 }, { n: 'Cream', h: 42, s: 0.3, v: 1.75 }] },
    path:      { zone: { h: [185, 245], smin: 0.4, box: [0.25, 0, 0.8, 0.7] }, opts: [{ n: 'Red', h: 358, s: 0.65, v: 1 }, { n: 'Green', h: 140, s: 0.5, v: 0.9 }, { n: 'Yellow', h: 44, s: 0.75, v: 1.2 }] },
    hedge:     { zone: { h: [70, 170], smin: 0.3 }, opts: [{ n: 'Lime', h: 92, s: 0.9, v: 1.1 }, { n: 'Deep green', h: 150, s: 0.9, v: 0.92 }] },
    roses:     { zone: { h: [325, 12], smin: 0.4 }, opts: [{ n: 'Pink', h: 338, s: 0.42, v: 1.85 }, FLOWER_YELLOW, FLOWER_WHITE] },
    rosepath:  { zone: { h: [300, 360], smin: 0.3 }, opts: [FLOWER_WHITE, FLOWER_YELLOW, FLOWER_LILAC] },
    tpath:     { zone: { h: [300, 360], smin: 0.3 }, opts: [FLOWER_WHITE, FLOWER_YELLOW, FLOWER_LILAC] },
    arch:      { zone: { h: [325, 12], smin: 0.4 }, opts: [{ n: 'Pink', h: 338, s: 0.42, v: 1.85 }, FLOWER_YELLOW, FLOWER_WHITE] },
    wall:      { zone: { h: [0, 26], smin: 0.4, vmin: 0.35 }, opts: [{ n: 'Honey brick', h: 38, s: 0.55, v: 1.12 }, { n: 'Cream brick', h: 42, s: 0.3, v: 1.3 }, { n: 'Dark brick', h: 18, s: 0.5, v: 0.72 }] },
    press:     { zone: { h: [340, 14], smin: 0.45, box: [0, 0, 1, 0.8] }, opts: [{ n: 'Blue', h: 215, s: 0.55, v: 0.98 }, { n: 'Green', h: 150, s: 0.5, v: 0.85 }, { n: 'Plum', h: 292, s: 0.42, v: 0.9 }] },
    news:      { zone: { h: [340, 14], smin: 0.45, box: [0, 0, 1, 0.8] }, opts: [{ n: 'Blue', h: 215, s: 0.55, v: 0.98 }, { n: 'Green', h: 150, s: 0.5, v: 0.85 }, { n: 'Plum', h: 292, s: 0.42, v: 0.9 }] },
    sign:      { zone: { h: [150, 205], smin: 0.3, box: [0.2, 0.12, 0.9, 0.62] }, opts: [{ n: 'Red', h: 5, s: 0.6, v: 1 }, { n: 'Navy', h: 220, s: 0.55, v: 0.85 }, { n: 'Mustard', h: 42, s: 0.7, v: 1.1 }] },
    roof:      { zone: { h: [5, 35], smin: 0.5, vmin: 0.45, box: [0, 0, 1, 0.5] }, opts: [{ n: 'Slate', h: 214, s: 0.24, v: 0.8 }, { n: 'Moss', h: 140, s: 0.38, v: 0.85 }, { n: 'Plum', h: 330, s: 0.32, v: 0.8 }] },
    tables:    { zone: { h: [5, 35], smin: 0.5, vmin: 0.45, poly: [[0.1, 0.26], [0.39, 0.01], [0.71, 0.11], [0.94, 0.26], [0.85, 0.27], [0.74, 0.31], [0.52, 0.46], [0.3, 0.4], [0.17, 0.3]] }, opts: [{ n: 'Slate', h: 214, s: 0.24, v: 0.8 }, { n: 'Moss', h: 140, s: 0.38, v: 0.85 }, { n: 'Plum', h: 330, s: 0.32, v: 0.8 }] },
    benches:   { zone: { h: [8, 45], smin: 0.45, vmin: 0.4, box: [0.12, 0.05, 0.88, 0.78] }, opts: [{ n: 'Green', h: 152, s: 0.42, v: 0.78 }, { n: 'Navy', h: 220, s: 0.5, v: 0.7 }, { n: 'Cream', h: 42, s: 0.14, v: 1.4 }] },
    lamp:      { zone: { mode: 'dark' }, opts: IRON },
    lanelamp:  { zone: { mode: 'dark' }, opts: IRON },
    steps:     { zone: { mode: 'neutral' }, opts: STONE },
    cobbles:   { zone: { mode: 'neutral' }, opts: STONE },
    paving:    { zone: { mode: 'neutral' }, opts: STONE },
    fountain:  { zone: { mode: 'neutral', box: [0, 0.3, 1, 1] }, opts: STONE },
    cgate:     { zone: { mode: 'neutral' }, opts: STONE },
    ivy:       { zone: { mode: 'neutral' }, opts: STONE },
  };

  const cache = {}, waiting = {};
  const artOf = (kind) => { const p = G.plotImages && G.plotImages[kind]; return p ? p[1] : null; };
  const inHue = (h, r) => (r[0] <= r[1] ? h >= r[0] && h <= r[1] : h >= r[0] || h <= r[1]);

  function inPoly(x, y, P) {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      if ((P[i][1] > y) !== (P[j][1] > y) && x < (P[j][0] - P[i][0]) * (y - P[i][1]) / (P[j][1] - P[i][1]) + P[i][0]) c = !c;
    }
    return c;
  }
  function rgb2hsv(r, g, b) {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    return [h, mx ? d / mx : 0, mx];
  }
  function hsv2rgb(h, s, v) {
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
  }

  /** Recolour the paintable pixels of an image (pure function on ImageData, so it can be tested). */
  function recolor(data, w, h, zone, opt) {
    const d = data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4; if (d[i + 3] < 8) continue;
        if (zone.poly && !inPoly(x / w, y / h, zone.poly)) continue;
        if (zone.box) { const fx = x / w, fy = y / h; if (fx < zone.box[0] || fx > zone.box[2] || fy < zone.box[1] || fy > zone.box[3]) continue; }
        const hsv = rgb2hsv(d[i] / 255, d[i + 1] / 255, d[i + 2] / 255), hh = hsv[0], s = hsv[1], v = hsv[2];
        let nh, ns, nv;
        if (zone.mode === 'neutral') {
          if (s > 0.2 || v < 0.38) continue;
          nh = opt.h; ns = opt.s * (0.55 + 0.45 * v); nv = Math.min(1, v * opt.v);
        } else if (zone.mode === 'dark') {
          if (v > 0.34) continue;
          nh = opt.h; ns = opt.s * (1 - v); nv = Math.min(1, v * opt.v + 0.04);
        } else {
          if (s < (zone.smin || 0) || v < (zone.vmin || 0) || (zone.vmax && v > zone.vmax) || !inHue(hh, zone.h)) continue;
          const mid = zone.h[0] <= zone.h[1] ? (zone.h[0] + zone.h[1]) / 2 : ((zone.h[0] + zone.h[1] + 360) / 2) % 360;
          let off = hh - mid; if (off > 180) off -= 360; if (off < -180) off += 360;
          nh = (opt.h + off * 0.3 + 360) % 360;
          ns = Math.min(0.95, opt.s * (0.6 + 0.8 * s)); nv = Math.min(1, v * opt.v);
        }
        const c = hsv2rgb(nh, ns, nv);
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
      }
    }
  }

  G.paint = {
    recolor,
    has: (kind) => !!(PAINT[kind] && artOf(kind)),
    /** Number of choices including the classic colours (option 0). */
    count: (kind) => (PAINT[kind] ? PAINT[kind].opts.length + 1 : 1),
    name: (kind, i) => (i === 0 ? 'Classic' : (PAINT[kind] && PAINT[kind].opts[i - 1] ? PAINT[kind].opts[i - 1].n : 'Classic')),
    /** The recoloured picture if it is ready, otherwise null (call ensure to make it). */
    url: (kind, i) => (i ? cache[kind + ':' + i] || null : artOf(kind)),
    /** Make the picture, then call back. Safe to call many times. */
    ensure(kind, i, cb) {
      const key = kind + ':' + i, P = PAINT[kind];
      if (!i || !P || !P.opts[i - 1] || cache[key]) { if (cb) cb(); return; }
      if (waiting[key]) { if (cb) waiting[key].push(cb); return; }
      waiting[key] = cb ? [cb] : [];
      const img = new Image();
      img.onload = () => {
        try {
          const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
          const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
          const id = cx.getImageData(0, 0, cv.width, cv.height);
          recolor(id.data, cv.width, cv.height, P.zone, P.opts[i - 1]);
          cx.putImageData(id, 0, 0); cache[key] = cv.toDataURL('image/webp', 0.92);
        } catch (e) { cache[key] = artOf(kind); }                 // never leave a piece blank
        const list = waiting[key]; delete waiting[key]; list.forEach((f) => f());
      };
      img.onerror = () => { cache[key] = artOf(kind); const list = waiting[key]; delete waiting[key]; list.forEach((f) => f()); };
      img.src = artOf(kind);
    },
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
