/* Real-browser tutorial tests. Launches headless Chrome/Edge, plays the actual game with real mouse events and checks
   every tutorial tip as it appears:
     - it appears at a sensible time (never over a dialog, colour sheet or story scene)
     - the thing it asks for is on screen, reachable, and doing it really completes the tip
     - it never appears twice, and no two tips say the same thing
     - the game is never held up: info tips have a "Got it" button, and a stuck action tip gets one too
     - nobody ever has to press "Skip tutorial"
   Run:  cd e2e && npm install && npm test        (add --natural to include the long full-playthrough run) */
const http = require('http'), fs = require('fs'), path = require('path');
const puppeteer = require('puppeteer-core');

const ROOT = path.join(__dirname, '..');
const NATURAL = process.argv.includes('--natural');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((p) => fs.existsSync(p));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.webmanifest': 'application/json' };
const LAUNCH_ARGS = ['--no-sandbox', '--mute-audio', '--autoplay-policy=no-user-gesture-required'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const failures = [], notes = [];
const fail = (where, msg) => { failures.push(where + ': ' + msg); console.log('  FAIL ' + where + ': ' + msg); };
const ok = (msg) => console.log('  ok   ' + msg);

function startServer() {
  const srv = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const f = path.join(ROOT, p);
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
  });
  return new Promise((r) => srv.listen(0, () => r(srv)));
}

async function newPage(browser, base) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 800, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => fail('page', 'script error: ' + e.message));
  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('gossip-gardens-intro-seen', '1'); } catch (e) { /* */ } });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.GG && GG.tutorial && GG.testGame, { timeout: 10000 });
  return page;
}

// ---- reading the screen ---------------------------------------------------------------
const snapshot = (page) => page.evaluate(() => {
  const g = GG.testGame(), s = g.s, vis = (e) => !!e && e.offsetParent !== null;
  const ok = document.querySelector('#coach .co-ok');
  return {
    cur: GG.tutorial.current(), okVisible: !!ok && ok.style.display !== 'none',
    skipVisible: !!document.querySelector('#coach .co-skip'),
    modal: !document.getElementById('modal').hidden, sheet: !!document.querySelector('.fin-sheet, .fin-block, .sc-ov, .rwd'), rwd: !!document.querySelector('.rwd'),
    tab: document.body.dataset.tab, seen: Object.assign({}, (s.tut || {}).seen), off: !!(s.tut && s.tut.off), energy: s.energy, coins: s.coins,
  };
});
const center = (page, sel) => page.evaluate((q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; }, sel);
// Can a finger actually reach the target? (nothing dimmed or locked is covering its centre)
const reachable = (page, sel) => page.evaluate((q) => {
  const e = document.querySelector(q); if (!e) return 'missing';
  const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return 'hidden';
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return top && (e === top || e.contains(top) || top.contains(e)) ? true : 'covered by ' + (top ? top.className || top.tagName : 'nothing');
}, sel);
async function click(page, sel) { const c = await center(page, sel); if (!c) return false; await page.mouse.click(c.x, c.y); return true; }
async function drag(page, from, to) {
  const a = await center(page, from), b = await center(page, to); if (!a || !b) return false;
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / 8, a.y + (b.y - a.y) * i / 8); await sleep(20); }
  await page.mouse.up(); return true;
}

// ---- checks that run on every look at the screen ---------------------------------------
function makeWatcher(label) {
  const appeared = {}, texts = {};
  return async function look(page) {
    const sn = await snapshot(page), c = sn.cur;
    if (sn.off) fail(label, 'the tutorial switched itself off (skipped) during the run');
    if (!c) return sn;
    if (c.visible && (sn.modal || sn.sheet) && !c.inModal) fail(label, 'tip "' + c.id + '" is showing over a dialog / colour sheet / story scene');
    if (!appeared[c.id]) {                       // first look at this appearance
      appeared[c.id] = 1;
      if (sn.seen[c.id]) fail(label, 'tip "' + c.id + '" appeared again after it had been completed');
      if (texts[c.text] && texts[c.text] !== c.id) fail(label, 'tips "' + texts[c.text] + '" and "' + c.id + '" say the same thing');
      texts[c.text] = c.id;
    }
    if (c.kind === 'info' && c.visible && !sn.okVisible) fail(label, 'info tip "' + c.id + '" has no green Got it button');
    return sn;
  };
}

/** Do what the tip asks, like a player would, and wait for it to finish. Returns true when the tip completed. */
async function doTip(page, look, label) {
  const sn = await look(page), c = sn.cur; if (!c) return null;
  if (c.kind === 'info') {
    if (!(await click(page, '#coach .co-ok'))) { fail(label, 'info tip "' + c.id + '": Got it is not clickable'); return false; }
  } else {
    const tg = c.target;
    if (!tg.sel) { fail(label, 'action tip "' + c.id + '" has nothing to point at'); return false; }
    for (const q of [tg.sel, tg.to].filter(Boolean)) {
      const r = await reachable(page, q);
      if (r !== true) { fail(label, 'action tip "' + c.id + '": target ' + q + ' is ' + r + ' (the player cannot do what it asks)'); return false; }
    }
    if (tg.to) await drag(page, tg.sel, tg.to); else await click(page, tg.sel);
  }
  for (let i = 0; i < 24; i++) {                  // up to ~6 s for the tip to move on
    await sleep(250);
    const now = await look(page);
    if (!now.cur || now.cur.id !== c.id) return true;
    if (c.inModal !== now.cur.inModal) return true;
  }
  const why = await page.evaluate(() => { const to = document.querySelector('.toast, #toast'); const m = document.getElementById('modal'); return { toast: to ? to.textContent : '', modal: m.hidden ? '' : m.textContent.slice(0, 80) }; });
  fail(label, 'tip "' + c.id + '" (' + c.kind + ') did not finish after doing what it says' + (process.env.DEBUG ? ' ' + JSON.stringify(why) : ''));
  return false;
}

// ---- drag tips must be strict: only the highlighted item can be grabbed, only the highlighted spot accepts it, and only in that direction ----
async function wrongMoves(page, label, c) {
  const idx = (q) => { const m = /data-i="(\d+)"/.exec(q || ''); return m ? +m[1] : null; };
  const from = idx(c.target.sel), to = idx(c.target.to); if (from == null || to == null) return;
  const cellSel = (i) => '#board .cell[data-i="' + i + '"]';
  const info = await page.evaluate((f, t2) => { const s = GG.testGame().s; const other = s.cells.findIndex((it, i) => it && i !== f && i !== t2 && !(s.locks && s.locks[i]) && !it.web); const empty = s.cells.findIndex((it, i) => !it && i !== f && i !== t2 && !(s.locks && s.locks[i])); return { other, empty }; }, from, to);
  const tries = [['reversed (grabbing the target instead of the highlighted item)', to, from]];
  if (info.other >= 0) tries.push(['some other item dropped on the target', info.other, to], ['the highlighted item dropped on some other item', from, info.other]);
  if (info.empty >= 0) tries.push(['the highlighted item dropped on an empty cell', from, info.empty]);
  for (const [what, a, b] of tries) {
    const before = await page.evaluate(() => JSON.stringify(GG.testGame().s.cells));
    await drag(page, cellSel(a), cellSel(b)); await sleep(500);
    const after = await page.evaluate(() => JSON.stringify(GG.testGame().s.cells)), sn = await snapshot(page);
    if (before !== after) fail(label, 'the board allowed a move the tip did not ask for: ' + what);
    else if (!sn.cur || sn.cur.id !== c.id) fail(label, 'the tip went away after a wrong move: ' + what);
  }
}

// ---- state setups, one per tip ------------------------------------------------------------
const PRE = `
  const g = GG.testGame(), s = g.s; s.tut = s.tut || { seen: {}, off: false };
  const byRole = (r) => Object.keys(GG.CHAINS).find((k) => GG.CHAINS[k].role === r);
  const clearFree = () => { for (let i = 0; i < s.cells.length; i++) if (!(s.locks && s.locks[i])) s.cells[i] = null; };
  const put = (i, chain, level, extra) => { s.cells[i] = Object.assign(g.mk(chain, level), extra || {}); };
  // two neighbouring cells that are not under sand, so a setup never lands on a locked tile
  const F = (() => { for (let i = 16; i < s.cells.length - 1; i++) if (i % GG.TUNING.cols < GG.TUNING.cols - 1 && !(s.locks && (s.locks[i] || s.locks[i + 1]))) return [i, i + 1]; return [16, 17]; })();
  s.stats.taps = 6; s.stats.merges = 3; s.stats.served = 1; s.energy = 60; s.coins = 50;
  GG.tutorial.ids.forEach((id) => { s.tut.seen[id] = true; });
  delete s.tut.seen[%ID%];
`;
const SCENARIOS = {
  'sand-near':   'clearFree(); if (!Object.values(s.locks).some((l) => l.near)) throw new Error("no merge-to-clear sand on the starting board");',
  'sand-energy': 'clearFree(); const k = Object.keys(s.locks).find((k) => !s.locks[k].near); if (!k) throw new Error("no energy sand"); s.locks[k].cost = 5; s.energy = 60;',
  'web':         'clearFree(); put(F[0], "seed", 2, { web: true });',
  'coin':        'clearFree(); put(F[0], byRole("currency"), 1);',
  'gift':        'clearFree(); put(F[0], byRole("gift"), 1);',
  'gift#two':    'clearFree(); put(F[0], byRole("gift"), 1); put(F[1], byRole("gift"), 1);',
  'choice':      'clearFree(); put(F[0], "choice", 1);',
  'tonic':       'clearFree(); put(F[0], "tonic", 1);',
  'timebub':     'clearFree(); put(F[0], "timebub", 1);',
  'bubble':      'clearFree(); put(F[0], "seed", 1, { bubbleUntil: g.clock() + 1e9 });',
  'scissors':    'clearFree(); put(F[0], "scissors", 1); put(F[1], "seed", 3);',
  'dust':        'clearFree(); put(F[0], "dust", 1); put(F[1], "seed", 2);',
  'orb':         'clearFree(); put(F[0], "orb", 1); s.orders.forEach((o) => { o.pending = false; });',
  'genmerge':    'clearFree(); put(F[0], "gen_seed", 1); put(F[1], "gen_seed", 1);',
  'energy':      's.energy = 10;',
  'storage':     'clearFree(); let n = 0; for (let i = 0; i < s.cells.length && n < s.cells.length - 4; i++) if (!s.cells[i] && !(s.locks && s.locks[i])) { put(i, "seed", 1 + (n++ % 6)); }',
  'booster':     's.boost.unlocked = true;',
  'happy':       's.orders.forEach((o) => { o.pending = false; o.reward = Object.assign({}, o.reward, { smile: 1 }); });',
  'levelup':     's.xp = 99999;',
  'repair':      's.coins = 999999;',
  'shop':        's.xp = 99999;',
  'serve':       's.stats.served = 0; clearFree(); s.orders.forEach((o) => { o.pending = false; }); let k = F[0]; for (const w of s.orders[0].wants) put(k++, w.chain, w.level);',
  'orderinfo':   'clearFree(); s.stats.served = 1; s.orders.forEach((o) => { o.pending = false; });',
};
const ESTATE_SCENARIOS = {                        // these tips live on the Estate screen
  'estate-intro': '',
  'chores':       's.coins = 999999; s.chores.done = 0;',
  'starter':      'while (g.level() < 2) s.xp += 5;',
  'events':       's.chores.done = 1; s.xp = 99999;',
  'pay':          's.coins = 999999; s.chores.done = 0;',
  'chores-short': 's.coins = 0; s.chores.done = 0;',
};

async function scenario(_unused, base, id, setup, estate, key) {
  // a fresh browser for each scenario keeps long runs stable
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: LAUNCH_ARGS });
  try { await scenarioIn(browser, base, id, setup, estate, key || id); } finally { await browser.close(); }
}
async function scenarioIn(browser, base, id, setup, estate, key) {
  const label = 'scenario ' + key, look = makeWatcher(label);
  const page = await newPage(browser, base);
  try {
    await page.evaluate(PRE.replace('%ID%', JSON.stringify(id)) + setup);
    if (estate) { await click(page, '#repairBtn'); await sleep(600); if (id === 'pay') { await click(page, '[data-chores]'); await sleep(500); } }
    let got = false;
    for (let i = 0; i < 40 && !got; i++) { await sleep(250); const sn = await look(page); if (process.env.DEBUG && i % 8 === 0) console.log(JSON.stringify({ i, cur: sn.cur && sn.cur.id, modal: sn.modal, sheet: sn.sheet, tab: sn.tab, energy: sn.energy })); if (sn.rwd) { await page.mouse.click(200, 400); continue; }
      if (sn.modal && !sn.cur) { await page.mouse.click(5, 5); continue; } got = !!(sn.cur && sn.cur.id === id); if (sn.cur && sn.cur.id !== id) { fail(label, 'a different tip came first: "' + sn.cur.id + '"'); break; } }
    if (!got) { if (!failures.some((f) => f.startsWith(label))) fail(label, 'the tip never appeared when its situation was set up'); return; }
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT + '-' + key + '.png' });
    const cur0 = (await snapshot(page)).cur; if (cur0 && cur0.kind === 'action' && cur0.target.to) await wrongMoves(page, label, cur0);
    const done = await doTip(page, look, label);
    if (done) {
      await sleep(3500);                           // it must not come back
      const sn = await look(page); if (sn.cur && sn.cur.id === id) fail(label, 'tip "' + id + '" came back after it was done');
      ok(key);
    }
  } catch (e) { fail(label, e.message); } finally { await page.close(); }
}

// ---- the escape hatch: an action tip nobody completes still gets a Got it button ---------------
async function stuckTest(browser, base) {
  const label = 'stuck-hatch', page = await newPage(browser, base);
  try {
    await page.evaluate(() => { GG.tutorialStuckMs = 2500; });
    let sn;
    for (let i = 0; i < 20; i++) { sn = await snapshot(page); if (sn.cur) break; await sleep(250); }
    if (!sn.cur || sn.cur.kind !== 'action') { fail(label, 'expected the first (action) tip'); return; }
    if (sn.okVisible) fail(label, 'Got it showed immediately on an action tip, the player could skip the step');
    await sleep(3500);
    sn = await snapshot(page);
    if (!sn.okVisible) fail(label, 'after being stuck the green Got it button never appeared');
    else { await click(page, '#coach .co-ok'); await sleep(400); sn = await snapshot(page); if (sn.cur && sn.cur.id === 'tap') fail(label, 'Got it did not release the stuck tip'); else ok('stuck action tip is released by Got it'); }
  } catch (e) { fail(label, e.message); } finally { await page.close(); }
}

// ---- a tip whose step becomes impossible lets go by itself (e.g. a second gift while one is already opening) ----
async function impossibleTest(browser, base) {
  const label = 'impossible-step', page = await newPage(browser, base);
  try {
    await page.evaluate(PRE.replace('%ID%', '"gift"') + 'clearFree(); put(F[0], byRole("gift"), 1); put(F[1], byRole("gift"), 1);');
    let sn;
    for (let i = 0; i < 24; i++) { await sleep(250); sn = await snapshot(page); if (sn.cur && sn.cur.id === 'gift') break; }
    if (!sn.cur || sn.cur.id !== 'gift') { fail(label, 'gift tip did not appear'); return; }
    await page.evaluate(() => { const g = GG.testGame(), s = g.s, i = s.cells.findIndex((c) => c && GG.CHAINS[c.chain].role === 'gift'); g.tapGift(i); });   // the player opens one some other way
    for (let i = 0; i < 8; i++) { await sleep(300); sn = await snapshot(page); if (!sn.cur || sn.cur.id !== 'gift') { ok('tip lets go once its step cannot be done'); return; } }
    fail(label, 'gift tip stayed up although no gift could be started (player stuck)');
  } catch (e) { fail(label, e.message); } finally { await page.close(); }
}

// ---- tips must wait: nothing shows over a dialog ---------------------------------------------
async function waitsTest(browser, base) {
  const label = 'waits-for-dialogs', page = await newPage(browser, base);
  try {
    await page.evaluate(PRE.replace('%ID%', '"gift"') + 'clearFree(); put(F[0], byRole("gift"), 1);');
    await page.evaluate(() => { const m = document.getElementById('modal'); m.hidden = false; m.innerHTML = '<div class="box"><p>Test dialog</p></div>'; });
    for (let i = 0; i < 8; i++) { await sleep(300); const sn = await snapshot(page); if (sn.cur && sn.cur.visible) { fail(label, 'tip "' + sn.cur.id + '" showed over an open dialog'); return; } }
    await page.evaluate(() => { document.getElementById('modal').hidden = true; });
    for (let i = 0; i < 16; i++) { await sleep(300); const sn = await snapshot(page); if (sn.cur && sn.cur.id === 'gift') { ok('tips wait for a dialog to close, then appear'); return; } }
    fail(label, 'the tip never appeared after the dialog closed');
  } catch (e) { fail(label, e.message); } finally { await page.close(); }
}

// ---- the first minute, in order, with no cheating ------------------------------------------
async function firstMinute(browser, base) {
  const label = 'first-minute', look = makeWatcher(label), page = await newPage(browser, base), order = [];
  try {
    for (let n = 0; n < 60 && order.length < 5; n++) {
      const sn = await look(page);
      if (sn.rwd) { await page.mouse.click(200, 400); await sleep(300); continue; }
      if (sn.cur && sn.cur.visible) {
        if (!order.includes(sn.cur.id)) order.push(sn.cur.id);
        await doTip(page, look, label);
      } else {
        const st = await page.evaluate(() => { const g = GG.testGame(), s = g.s; return { energy: s.energy, merges: s.stats.merges }; });
        if (st.energy < 1) await page.evaluate(() => { GG.testGame().s.energy = 50; });
        // no tip showing: do what a player would, so the next tip's conditions come true
        const rdy = await center(page, '.order.ready button[data-serve]');
        if (rdy) await click(page, '.order.ready button[data-serve]'); else await sleep(300);
      }
      await sleep(200);
    }
    const want = ['tap', 'merge'];
    if (want.some((w, i) => order[i] !== w)) fail(label, 'the first tips came in the wrong order: ' + order.join(', '));
    else if (order.length < 3) fail(label, 'only ' + order.length + ' tips appeared in the first minute: ' + order.join(', '));
    else ok('first minute order: ' + order.join(' > '));
    const sn = await snapshot(page); if (sn.off) fail(label, 'tutorial got switched off');
  } catch (e) { fail(label, e.message); } finally { await page.close(); }
}

// ---- optional long run: a bot plays and follows every tip ---------------------------------------
async function natural(browser, base) {
  const label = 'natural', look = makeWatcher(label), page = await newPage(browser, base), shown = new Set(), t0 = Date.now();
  try {
    while (Date.now() - t0 < 240000) {
      const sn = await look(page);
      if (process.env.DEBUG) console.log(JSON.stringify({ t: Math.round((Date.now() - t0) / 1000), cur: sn.cur && sn.cur.id, vis: sn.cur && sn.cur.visible, tab: sn.tab, modal: sn.modal, sheet: sn.sheet }));
      if (sn.cur && sn.cur.visible) { shown.add(sn.cur.id); await doTip(page, look, label); await sleep(150); continue; }
      if (sn.cur) { await sleep(300); continue; }
      if (sn.rwd) { await page.mouse.click(200, 400); await sleep(300); continue; }
      if (sn.sheet) { if (!(await click(page, '[data-fin-ok]'))) await click(page, '.sc-skip'); await sleep(400); continue; }
      const did = await page.evaluate(() => {
        const g = GG.testGame(), s = g.s; if (s.energy < 5) s.energy = 40;
        const m = document.getElementById('modal'); if (!m.hidden) return 'modal';
        return document.body.dataset.tab;
      });
      if (did === 'modal') { if (!(await click(page, '[data-dochore]'))) await page.mouse.click(5, 5); await sleep(400); continue; }
      if (did === 'garden') {
        if (await click(page, '.order.ready button[data-serve]')) { await sleep(300); continue; }
        const pr = await page.evaluate(() => { const c = GG.testGame().s.cells, seen = {}; for (let i = 0; i < c.length; i++) { const it = c[i]; if (!it || it.web || it.bubbleUntil || GG.CHAINS[it.chain].role !== 'ingredient') continue; const k = it.chain + it.level; if (k in seen) return [seen[k], i]; seen[k] = i; } return null; });
        if (pr) { await drag(page, '#board .cell[data-i="' + pr[0] + '"]', '#board .cell[data-i="' + pr[1] + '"]'); await sleep(300); continue; }
        const mi = await page.evaluate(() => GG.testGame().s.cells.findIndex((it) => it && it.chain === 'gen_seed'));
        if (mi >= 0) await click(page, '#board .cell[data-i="' + mi + '"]');
        const full = await page.evaluate(() => { const g = GG.testGame(); if (g.emptyCount() < 3) { const s = g.s; for (let i = 0; i < s.cells.length; i++) if (s.cells[i] && GG.CHAINS[s.cells[i].chain].role === 'ingredient' && !(s.locks && s.locks[i])) s.cells[i] = null; } return 1; });
        void full;
        const afford = await page.evaluate(() => { const g = GG.testGame(), ch = g.currentChore(); return !!ch && g.s.coins >= ch.cost; });
        if (afford) { await click(page, '#repairBtn'); await sleep(500); }
        await sleep(300);
      } else {
        const todo = await page.evaluate(() => { const g = GG.testGame(); return { ch: !!g.currentChore() && g.s.coins >= g.currentChore().cost }; });
        if (await click(page, '[data-dochore]')) { await sleep(500); continue; }
        if (todo.ch && (await click(page, '[data-chores]'))) { await sleep(500); continue; }
        if (!(await click(page, '[data-evclose]'))) await click(page, '[data-go="garden"]');
        await sleep(400);
      }
      if (shown.size >= GG_ALL) break;
    }
    const all = await page.evaluate(() => GG.tutorial.ids);
    const missing = all.filter((id) => !shown.has(id));
    console.log('  natural run showed ' + shown.size + '/' + all.length + ' tips' + (missing.length ? '; not reached by the bot (covered by scenarios): ' + missing.join(', ') : ''));
    ok('natural playthrough had no tutorial problems so far');
  } catch (e) { fail(label, e.message); } finally { await page.close(); }
}
const GG_ALL = 99;

(async () => {
  if (!CHROME) { console.log('No Chrome/Edge found; set CHROME path in tutorial.e2e.js'); process.exit(2); }
  const srv = await startServer(), base = 'http://localhost:' + srv.address().port + '/';
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: LAUNCH_ARGS });
  try {
    console.log('Tutorial end-to-end tests (' + base + ')');
    const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7);
    if (!only) { await firstMinute(browser, base); await stuckTest(browser, base); await waitsTest(browser, base); await impossibleTest(browser, base); }
    for (const [key, setup] of Object.entries(SCENARIOS)) if (!only || only === key.split('#')[0]) await scenario(browser, base, key.split('#')[0], setup, false, key);
    for (const [id, setup] of Object.entries(ESTATE_SCENARIOS)) if (!only || only === id) await scenario(browser, base, id, setup, true);
    if (NATURAL || only === 'natural') await natural(browser, base);
  } finally { await browser.close(); srv.close(); }
  console.log('\n' + (failures.length ? failures.length + ' problem(s):\n - ' + failures.join('\n - ') : 'All tutorial checks passed.'));
  process.exit(failures.length ? 1 : 0);
})();
