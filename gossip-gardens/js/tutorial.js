/* Gossip Gardens - step-by-step tutorial.
   Instead of one wall of text, short coach tips appear the first time each feature becomes useful:
   a bubble with a guide, a glowing ring around the thing to use, and a bouncing hand.
   The rest of the game is dimmed and locked while a tip is up:
   "action" tips only let you do the highlighted thing, "info" tips only let you tap "Got it".
   Everything shown is remembered in the save (s.tut.seen), so each tip appears once. */
(function () {
  'use strict';
  const G = window.GG;
  const { CHAINS, TUNING: T, maxLevel, portrait } = G;

  G.makeTutorial = function (ui) {
    const q = (sel) => document.querySelector(sel);
    const role = (c) => CHAINS[c.chain].role;
    let root = null, bubble = null, ring = null, hand = null, blk = null, full = null, rafId = 0, active = null, snap, quietUntil = 0, dragKey = '', shownAt = 0;
    // Safety net: if a step still is not done after this long, "Got it" appears so nobody is ever stuck behind a tip.
    const stuckMs = () => (G.tutorialStuckMs != null ? G.tutorialStuckMs : 20000);

    const state = () => { const s = ui.game.s; s.tut = s.tut || { seen: {}, off: false }; return s.tut; };
    const seen = (id) => !!state().seen[id];
    const mark = (id) => { state().seen[id] = true; ui.save(); };

    // ---- what is on the board --------------------------------------------------
    const ctx = () => { const g = ui.game, s = g.s; return { g, s, st: s.stats, tab: ui.tab, cells: s.cells }; };
    const find = (c, pred) => { for (let i = 0; i < c.cells.length; i++) { const it = c.cells[i]; if (it && pred(it, i)) return i; } return -1; };
    const count = (c, pred) => c.cells.filter((it) => it && pred(it)).length;
    const sel = (i) => (i >= 0 ? '#board .cell[data-i="' + i + '"]' : null);
    const lockIdx = (c, pred) => { for (const k of Object.keys(c.s.locks || {})) if (pred(c.s.locks[k], +k)) return +k; return -1; };
    const isOpen = (it) => !it.web && !it.bubbleUntil;
    const isMachine = (it) => role(it) === 'generator' && !CHAINS[it.chain].auto;
    const machine = (c) => { const i = find(c, (it) => it.chain === 'gen_seed' && isOpen(it)); return i >= 0 ? i : find(c, (it) => isMachine(it) && isOpen(it)); };
    const pair = (c) => {
      const seenKey = {};
      for (let i = 0; i < c.cells.length; i++) {
        const it = c.cells[i];
        if (!it || !isOpen(it) || (role(it) !== 'ingredient' && role(it) !== 'currency') || it.level >= maxLevel(it.chain)) continue;
        const k = it.chain + ':' + it.level;
        if (seenKey[k] !== undefined) return [seenKey[k], i];
        seenKey[k] = i;
      }
      return null;
    };
    const machinePair = (c) => {
      const k = {};
      for (let i = 0; i < c.cells.length; i++) {
        const it = c.cells[i];
        if (!it || !isMachine(it) || !isOpen(it)) continue;
        const key = it.chain + it.level;
        if (k[key] !== undefined) return [k[key], i];
        k[key] = i;
      }
      return null;
    };
    const neigh = (i) => {
      const r = Math.floor(i / T.cols), cc = i % T.cols, out = [];
      if (r > 0) out.push(i - T.cols); if (r < T.rows - 1) out.push(i + T.cols); if (cc > 0) out.push(i - 1); if (cc < T.cols - 1) out.push(i + 1);
      return out;
    };
    // Two free cells next to a merge-to-clear sand tile: the tutorial drops a pair there so the step can always be done.
    const sandPlan = (c) => {
      const free = (j) => !c.cells[j] && !(c.s.locks && c.s.locks[j]);
      for (const k of Object.keys(c.s.locks || {})) {
        if (!c.s.locks[k].near) continue;
        const sand = +k;
        for (const to of neigh(sand)) {
          if (!free(to)) continue;
          for (const from of neigh(to)) if (from !== sand && free(from)) return { sand, to, from };
        }
      }
      return null;
    };
    // A webbed item plus a matching free item to drag onto it (the tutorial adds one if the board has none).
    const webPlan = (c) => {
      const wi = find(c, (it) => it.web);
      if (wi < 0) return null;
      const w = c.cells[wi];
      if (w.level >= maxLevel(w.chain)) return null;
      const own = find(c, (it, i) => i !== wi && !it.web && !it.bubbleUntil && it.chain === w.chain && it.level === w.level);
      if (own >= 0) return { web: wi, from: own, chain: w.chain, level: w.level };
      const free = (j) => !c.cells[j] && !(c.s.locks && c.s.locks[j]);
      let spot = neigh(wi).find(free);
      if (spot == null) for (let j = 0; j < c.cells.length; j++) if (free(j)) { spot = j; break; }
      return spot == null ? null : { web: wi, from: spot, spawn: spot, chain: w.chain, level: w.level };
    };
    // What each tool can actually be used on right now, so a tip only appears when the step can be done.
    const splitTarget = (c) => c.g.emptyCount() >= 1 ? find(c, (it) => role(it) === 'ingredient' && it.level >= 2 && isOpen(it)) : -1;
    const raiseTarget = (c) => find(c, (it) => (role(it) === 'ingredient' || role(it) === 'currency') && it.level < maxLevel(it.chain) && isOpen(it));
    const orbReady = (c) => {
      const need = {}, missing = [];
      for (const o of c.s.orders) { if (o.pending) continue; for (const w of o.wants) { const k = w.chain + ':' + w.level; need[k] = (need[k] || 0) + 1; } }
      for (const k of Object.keys(need)) { const [ch, lv] = k.split(':'); for (let n = c.g.countAll(ch, +lv); n < need[k]; n++) missing.push(k); }
      return missing.length > 0 && c.g.emptyCount() >= Math.min(missing.length, T.orbMaxItems);
    };
    const readyOrder = (c) => c.s.orders.some((o) => !o.pending && c.g.canServe(o));
    const toolIdx = (c, chain) => find(c, (it) => it.chain === chain);
    const toolUses = (c, chain) => c.cells.reduce((n, it) => n + (it && it.chain === chain ? (it.uses || 1) : 0), 0);
    const badges = (c) => c.g.badges();
    const modalOpen = () => !document.getElementById('modal').hidden;
    // Anything the player has to finish first: a dialog, the colour sheet, a story scene. No tip appears over these.
    const blocking = () => modalOpen() || !!document.querySelector('.fin-sheet, .fin-block, .sc-ov');
    const rectOf = (selector) => {
      if (!selector) return null;
      const e = q(selector); if (!e) return null;
      const r = e.getBoundingClientRect();
      return r.width > 2 && r.height > 2 ? r : null;
    };

    // ---- the tips, in priority order --------------------------------------------
    // intro: part of the guided first minute (later tips wait until the first merge is done).
    // snap/done: an action tip is finished when done(ctx, snapshotTakenWhenItAppeared) is true.
    const TIPS = [
      { id: 'tap', intro: true, kind: 'action', tab: 'garden',
        when: (c) => c.st.taps < 1,
        text: () => 'Welcome! Tap a machine to make items. Each tap costs 1 energy.',
        target: (c) => ({ sel: sel(machine(c)) }), done: (c) => c.st.taps >= 1 },
      { id: 'merge', intro: true, kind: 'action', tab: 'garden',
        when: (c) => c.st.merges < 1,
        text: (c) => (pair(c) ? 'Drag one item onto a matching one to merge them into something better!' : 'You need two matching items. Tap the machine again to make more.'),
        target: (c) => { const p = pair(c); return p ? { sel: sel(p[0]), to: sel(p[1]) } : { sel: sel(machine(c)) }; },
        done: (c) => c.st.merges >= 1 },
      { id: 'orders', intro: true, kind: 'info', tab: 'garden',
        when: (c) => c.st.merges >= 1 && c.s.orders.some((o) => !o.pending) && !readyOrder(c),
        text: () => 'These customers want items. Green checks show what you already have on the board. Collect what they ask for!',
        target: () => ({ sel: '#orders' }) },
      { id: 'serve', intro: true, kind: 'action', tab: 'garden',
        when: (c) => c.st.served < 1 && readyOrder(c),
        text: () => 'A customer\'s order is ready! Green checks show items you have. Tap Serve to hand it over and get paid.',
        target: () => ({ sel: '.order.ready button[data-serve]' }), done: (c) => c.st.served >= 1 },
      { id: 'reward', intro: true, kind: 'info', tab: 'garden',
        when: (c) => c.st.served >= 1,
        text: () => 'Well done! Customers pay coins, sometimes energy or a smiley review, and every order earns stars that level you up.',
        target: () => ({ sel: '#coins' }) },

      { id: 'sand-near', kind: 'action', tab: 'garden', scripted: true,
        when: (c) => !!sandPlan(c),
        text: () => 'Sand hides prizes! I put two items next to it. Drag one onto the other to merge them and uncover what is buried.',
        snap: (c) => { const p = sandPlan(c); if (p) { c.cells[p.to] = c.g.mk('seed', 1); c.cells[p.from] = c.g.mk('seed', 1); } return p; },
        target: (c, p) => (p ? { sel: sel(p.from), to: sel(p.to) } : {}),
        done: (c, p) => !p || !c.s.locks[p.sand] },
      { id: 'sand-energy', kind: 'action', tab: 'garden',
        when: (c) => lockIdx(c, (l) => !l.near && l.cost <= c.s.energy) >= 0,
        text: () => 'Sand with a bolt can be cleared by tapping it. You pay the energy shown. Some hide a gift! Give it a tap.',
        target: (c) => ({ sel: sel(lockIdx(c, (l) => !l.near && l.cost <= c.s.energy)) }),
        snap: (c) => lockIdx(c, (l) => !l.near && l.cost <= c.s.energy), done: (c, sn) => !c.s.locks[sn] },
      { id: 'web', kind: 'action', tab: 'garden', scripted: true,
        when: (c) => !!webPlan(c),
        text: () => 'A cobweb! That item is stuck. I put a matching item beside it: drag it onto the webbed one to free it.',
        snap: (c) => { const p = webPlan(c); if (p && p.spawn != null) c.cells[p.spawn] = c.g.mk(p.chain, p.level); return p; },
        target: (c, p) => (p ? { sel: sel(p.from), to: sel(p.web) } : {}),
        done: (c, p) => !p || !c.cells[p.web] || !c.cells[p.web].web },
      { id: 'coin', kind: 'action', tab: 'garden',
        when: (c) => find(c, (it) => role(it) === 'currency' && isOpen(it)) >= 0,
        text: () => 'Coins, gems and sparks: tap one to collect it. Merge two alike to make them worth more.',
        target: (c) => ({ sel: sel(find(c, (it) => role(it) === 'currency' && isOpen(it))) }),
        snap: (c) => count(c, (it) => role(it) === 'currency'), done: (c, sn) => count(c, (it) => role(it) === 'currency') < sn },
      { id: 'gift', kind: 'action', tab: 'garden',
        when: (c) => find(c, (it) => role(it) === 'gift' && !it.unlockAt) >= 0 && !c.cells.some((it) => it && role(it) === 'gift' && it.unlockAt),
        text: () => 'A gift box! Tap it to start opening. Tap it again when it is ready. Gems can speed it up.',
        target: (c) => ({ sel: sel(find(c, (it) => role(it) === 'gift' && !it.unlockAt)) }),
        done: (c) => c.cells.some((it) => it && role(it) === 'gift' && it.unlockAt) || find(c, (it) => role(it) === 'gift') < 0 },   // one gift started is enough, even with a second box waiting
      { id: 'choice', kind: 'action', tab: 'garden',
        when: (c) => find(c, (it) => it.chain === 'choice') >= 0,
        text: () => 'A Machine Choice Box! Tap it and pick one of three new machines for your board.',
        target: (c) => ({ sel: sel(find(c, (it) => it.chain === 'choice')) }), done: () => modalOpen() },
      { id: 'tonic', kind: 'action', tab: 'garden',
        when: (c) => find(c, (it) => it.chain === 'tonic') >= 0,
        text: () => 'A tonic! Tap it to use it: machines cost no energy for a few minutes. Merge two for a longer boost.',
        target: (c) => ({ sel: sel(find(c, (it) => it.chain === 'tonic')) }), snap: (c) => count(c, (it) => it.chain === 'tonic'), done: (c, sn) => count(c, (it) => it.chain === 'tonic') < sn },
      { id: 'timebub', kind: 'action', tab: 'garden',
        when: (c) => find(c, (it) => it.chain === 'timebub') >= 0,
        text: () => 'A Time Bubble! Tap it to finish every timer on the board: gifts open and machines recharge at once.',
        target: (c) => ({ sel: sel(find(c, (it) => it.chain === 'timebub')) }), done: (c) => find(c, (it) => it.chain === 'timebub') < 0 },
      { id: 'orderinfo', kind: 'action', tab: 'garden',
        when: (c) => c.st.served >= 1 && c.s.orders.some((o) => !o.pending && !c.g.canServe(o)),
        text: () => 'Not sure how to make what a customer wants? Tap the item in their order to see where it comes from.',
        target: () => ({ sel: '.order:not(.ready) .want:not(.have)' }), done: () => modalOpen() },
      { id: 'bubble', kind: 'info', tab: 'garden',
        when: (c) => find(c, (it) => it.bubbleUntil) >= 0,
        text: () => 'An item in a bubble! Pay gems to pop it and keep the item, break it for 1 coin, or wait and it bursts into coins.',
        target: (c) => ({ sel: sel(find(c, (it) => it.bubbleUntil)) }) },
      { id: 'scissors', kind: 'action', tab: 'garden',
        when: (c) => toolIdx(c, 'scissors') >= 0 && splitTarget(c) >= 0,
        text: () => 'Scissors! Drag them onto an item of level 2 or higher to split it into two items one level lower.',
        target: (c) => ({ sel: sel(toolIdx(c, 'scissors')), to: sel(splitTarget(c)) }),
        snap: (c) => toolUses(c, 'scissors'), done: (c, sn) => toolUses(c, 'scissors') < sn },
      { id: 'dust', kind: 'action', tab: 'garden',
        when: (c) => toolIdx(c, 'dust') >= 0 && raiseTarget(c) >= 0,
        text: () => 'The starry teapot! Drag it onto an item to raise it one level. It does not work on machines.',
        target: (c) => ({ sel: sel(toolIdx(c, 'dust')), to: sel(raiseTarget(c)) }),
        snap: (c) => toolUses(c, 'dust'), done: (c, sn) => toolUses(c, 'dust') < sn },
      { id: 'orb', kind: 'action', tab: 'garden',
        when: (c) => toolIdx(c, 'orb') >= 0 && orbReady(c),
        text: () => 'The wishing teapot! Tap it to receive items your customers are asking for.',
        target: (c) => ({ sel: sel(toolIdx(c, 'orb')) }), snap: (c) => toolUses(c, 'orb'), done: (c, sn) => toolUses(c, 'orb') < sn },
      { id: 'genmerge', kind: 'action', tab: 'garden',
        when: (c) => !!machinePair(c),
        text: () => 'You have two matching machines! Drag one onto the other to upgrade them into a better machine.',
        target: (c) => { const p = machinePair(c); return p ? { sel: sel(p[0]), to: sel(p[1]) } : {}; },
        snap: (c) => count(c, isMachine), done: (c, sn) => count(c, isMachine) < sn },
      { id: 'energy', kind: 'action', tab: 'garden',
        when: (c) => c.st.taps >= 3 && c.s.energy <= 20,
        text: () => 'Energy is running low! It refills by itself, 1 every 2 minutes. Tap the bar to see your options.',
        target: () => ({ sel: '#energyBtn' }), done: () => modalOpen() },
      { id: 'storage', kind: 'action', tab: 'garden',
        when: (c) => c.st.taps >= 5 && c.g.emptyCount() <= 6,
        text: () => 'The board is filling up! Tap Storage to put items away for later. Orders can use stored items too.',
        target: () => ({ sel: '#storeBtn' }), done: () => modalOpen() || ui.tab !== 'garden' },
      { id: 'booster', kind: 'action', tab: 'garden',
        when: (c) => c.s.boost.unlocked,
        text: () => 'The generator booster is unlocked! Tap it to switch it on: higher-level items for extra energy.',
        target: () => ({ sel: '#boostBtn' }), done: (c) => c.s.boost.mode > 0 },
      { id: 'happy', kind: 'action', tab: 'garden',
        when: (c) => c.s.orders.some((o) => !o.pending && o.reward && o.reward.smile),
        text: () => 'Some customers pay a smiley review. Collect 6 to fill this meter and win a big reward. Tap it to see.',
        target: () => ({ sel: '#happy' }), done: () => modalOpen() },
      { id: 'levelup', kind: 'action', tab: 'garden',
        when: (c) => c.g.level() >= 2,
        text: (c) => 'You reached level ' + c.g.level() + '! Tap your badge to see your profile and the rewards for each level.',
        target: () => ({ sel: '#levelBtn' }), done: () => modalOpen() },
      { id: 'repair', kind: 'action', tab: 'garden',
        when: (c) => { const ch = c.g.currentChore(); return !!ch && c.s.coins >= ch.cost; },
        text: () => 'You have enough coins to repair something! Tap the drill to visit the Estate.',
        target: () => ({ sel: '#repairBtn' }), done: (c) => c.tab !== 'garden' },
      { id: 'shop', kind: 'action', tab: 'garden',
        when: (c) => !!badges(c).shop,
        text: () => 'The shop has a free daily item. Tap the cart to take a look.',
        target: () => ({ sel: '#cartBtn' }), done: (c) => c.tab !== 'garden' },

      { id: 'estate-intro', kind: 'info', tab: 'estate',
        when: () => true,
        text: () => 'This is the manor you are restoring. Each repair you pay for fixes a piece of it and unlocks the next part of the story.',
        target: () => ({ sel: '.rscene' }) },
      { id: 'chores', kind: 'action', tab: 'estate',
        when: (c) => { const ch = c.g.currentChore(); return !!ch && c.s.coins >= ch.cost && c.s.chores.done < 1; },
        text: () => 'You can afford your first chore! Tap the journal to open the chores.',
        target: () => ({ sel: '[data-chores]' }), done: (c) => c.s.chores.done >= 1 || !!q('[data-dochore]') },
      { id: 'pay', kind: 'action', tab: 'estate', inModal: true,
        when: (c) => !!q('[data-dochore]') && c.s.chores.done < 1 && c.s.coins >= (c.g.currentChore() || { cost: 1e9 }).cost,
        text: () => 'Tap here to pay the coins. The piece is restored and the story continues!',
        target: () => ({ sel: '[data-dochore]' }), done: (c) => c.s.chores.done >= 1 },
      { id: 'chores-short', kind: 'info', tab: 'estate',
        when: (c) => c.g.choreShort() && c.s.chores.done < 1,
        text: () => 'Not enough coins yet. Head back to the kitchen, serve customers and come back!',
        target: () => ({ sel: '[data-go="garden"]' }) },
      { id: 'chest', kind: 'action', tab: 'estate',
        when: (c) => c.g.chestReady(),
        text: () => 'A free chest is ready! Tap it for a reward. It fills up again every couple of hours.',
        target: () => ({ sel: '[data-chest]' }), done: (c) => !c.g.chestReady() },
      { id: 'starter', kind: 'action', tab: 'estate',
        when: (c) => c.g.starterReady(),
        text: () => 'Your starter bonus is waiting. Tap it to claim a welcome gift!',
        target: () => ({ sel: '[data-starter]' }), done: () => modalOpen() },
      { id: 'events', kind: 'action', tab: 'estate',
        when: (c) => !!badges(c).events && c.s.chores.done >= 1,
        text: () => 'The star button opens Events: a daily gift, tasks, check-in, the Garden Pass and a lucky wheel. Tap it!',
        target: () => ({ sel: '[data-go="events"]' }), done: (c) => c.tab === 'events' },
    ];

    // ---- tip selection ---------------------------------------------------------------
    const introDone = (c) => c.st.merges >= 1 && (seen('orders') || readyOrder(c) || !c.s.orders.some((o) => !o.pending));
    function pick(c) {
      const inModal = modalOpen(), busy = blocking();
      for (const t of TIPS) {
        if (busy && !(inModal && t.inModal && !document.querySelector('.fin-sheet, .fin-block, .sc-ov'))) continue;   // finish what is on screen first
        if (seen(t.id)) continue;
        if (inModal !== !!t.inModal) continue;               // dialog tips only inside a dialog, all others only outside
        if (t.tab !== 'any' && t.tab !== c.tab) continue;
        if (!t.intro && !introDone(c)) continue;
        if (!t.when(c)) continue;
        if (!t.scripted) { const tg = t.target(c) || {}; if (tg.sel && !rectOf(tg.sel)) continue; if (tg.to && !rectOf(tg.to)) continue; }             // never talk about something that is not on screen
        return t;
      }
      return null;
    }

    // ---- drawing ----------------------------------------------------------------------
    function build() {
      if (root) return;
      root = document.createElement('div'); root.id = 'coach';
      root.innerHTML = '<div class="co-full"></div><div class="co-blk"></div><div class="co-blk"></div><div class="co-blk"></div><div class="co-blk"></div>' +
        '<div class="co-ring"></div><div class="co-hand"></div>' +
        '<div class="co-bubble"><i class="co-tail"></i><div class="co-face"></div><div class="co-body"><p></p><div class="co-row"><button class="co-ok">Got it</button><button class="co-skip">Skip tutorial</button></div></div></div>';
      document.body.appendChild(root);
      full = root.querySelector('.co-full'); blk = Array.from(root.querySelectorAll('.co-blk'));
      ring = root.querySelector('.co-ring'); hand = root.querySelector('.co-hand'); bubble = root.querySelector('.co-bubble');
      // tapping the dimmed game just nudges the bubble, so players see what they are supposed to do
      [full].concat(blk).forEach((b) => b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        bubble.classList.remove('nudge'); void bubble.offsetWidth; bubble.classList.add('nudge');
      }));
      root.querySelector('.co-ok').onclick = () => { if (active) { mark(active.id); ui.audio('tap'); hide(); quietUntil = Date.now() + 1200; } };
      root.querySelector('.co-skip').onclick = () => { state().off = true; ui.save(); hide(); };
    }
    function hide() {
      active = null; snap = undefined; G.coachActive = false; dragKey = '';
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      if (root) { root.remove(); root = bubble = ring = hand = blk = full = null; }
    }
    // The bubble sits right beside the thing it talks about, with a little tail pointing at it.
    function placeBubble(r) {
      const vw = window.innerWidth, vh = window.innerHeight, w = Math.min(vw * 0.92, 360), h = bubble.offsetHeight || 110, tail = bubble.querySelector('.co-tail');
      bubble.style.width = w + 'px';
      if (!r || r.height > vh * 0.4) {            // nothing to point at, or a big area: park the bubble above the bottom bar
        bubble.style.left = (vw - w) / 2 + 'px'; bubble.style.top = Math.max(8, vh - h - 100) + 'px'; tail.style.display = 'none'; return;
      }
      const gap = 16, below = r.top + r.height / 2 < vh * 0.5;
      let top = below ? r.bottom + gap : r.top - gap - h;
      top = Math.min(Math.max(8, top), vh - h - 8);
      let left = r.left + r.width / 2 - w / 2;
      left = Math.min(Math.max(8, left), vw - w - 8);
      bubble.style.left = left + 'px'; bubble.style.top = top + 'px';
      const tx = Math.min(Math.max(22, r.left + r.width / 2 - left), w - 22);
      tail.style.cssText = 'display:block;left:' + (tx - 8) + 'px;' + (below ? 'top:-8px;bottom:auto' : 'bottom:-8px;top:auto');
    }
    // Everything outside the hole is dimmed and swallows taps. Action tips leave the hole open; info tips close it too.
    function setHole(r, open) {
      const vw = window.innerWidth, vh = window.innerHeight;
      if (!r) { full.style.display = 'block'; full.classList.add('dim'); blk.forEach((b) => { b.style.display = 'none'; }); ring.style.display = 'none'; return; }
      const pad = 5, l = r.left - pad, t = r.top - pad, w = r.width + pad * 2, h = r.height + pad * 2;
      ring.style.cssText = 'display:block;left:' + l + 'px;top:' + t + 'px;width:' + w + 'px;height:' + h + 'px';
      full.classList.remove('dim');
      if (!open) { full.style.display = 'block'; blk.forEach((b) => { b.style.display = 'none'; }); return; }
      full.style.display = 'none';
      const boxes = [[0, 0, vw, t], [0, t + h, vw, vh - t - h], [0, t, l, h], [l + w, t, vw - l - w, h]];
      blk.forEach((b, i) => { const x = boxes[i]; b.style.cssText = 'display:block;left:' + x[0] + 'px;top:' + x[1] + 'px;width:' + Math.max(0, x[2]) + 'px;height:' + Math.max(0, x[3]) + 'px'; });
    }
    function frame() {
      rafId = 0;
      if (!active || !root) return;
      const c = ctx(), tg = active.target(c, snap) || {};
      const r1 = rectOf(tg.sel), r2 = rectOf(tg.to);
      if (r1) {
        const u = r2 ? { left: Math.min(r1.left, r2.left), top: Math.min(r1.top, r2.top), right: Math.max(r1.right, r2.right), bottom: Math.max(r1.bottom, r2.bottom) } : r1;
        const hole = { left: u.left, top: u.top, width: (u.right !== undefined ? u.right : r1.right) - u.left, height: (u.bottom !== undefined ? u.bottom : r1.bottom) - u.top };
        hole.right = hole.left + hole.width; hole.bottom = hole.top + hole.height;
        setHole(hole, active.kind === 'action');
        hand.style.cssText = (active.kind === 'action' ? 'display:block;' : 'display:none;') + 'left:' + (r1.left + r1.width * 0.55) + 'px;top:' + (r1.top + r1.height * 0.5) + 'px';
        const key = tg.sel + '>' + (tg.to || '');
        if (r2 && key !== dragKey) {
          dragKey = key;
          const dx = r2.left - r1.left, dy = r2.top - r1.top;
          hand.classList.add('drag');
          hand.getAnimations().forEach((a) => a.cancel());
          hand.animate([{ transform: 'translate(0,0)' }, { transform: 'translate(0,0)', offset: .15 }, { transform: 'translate(' + dx + 'px,' + dy + 'px)', offset: .75 }, { transform: 'translate(' + dx + 'px,' + dy + 'px)' }], { duration: 1800, iterations: Infinity, easing: 'ease-in-out' });
        } else if (!r2 && dragKey) { dragKey = ''; hand.classList.remove('drag'); hand.getAnimations().forEach((a) => a.cancel()); }
        placeBubble(hole.height > window.innerHeight * 0.4 ? null : hole);
      } else { setHole(null, false); hand.style.display = 'none'; placeBubble(null); }
      rafId = requestAnimationFrame(frame);
    }
    function show(t, c) {
      build(); active = t; G.coachActive = true; dragKey = ''; shownAt = Date.now();
      snap = t.snap ? t.snap(c) : undefined;
      if (t.scripted) ui.render();
      root.style.display = '';
      bubble.querySelector('p').textContent = t.text(c);
      bubble.querySelector('.co-face').innerHTML = portrait('mabel');
      bubble.querySelector('.co-ok').style.display = t.kind === 'info' ? '' : 'none';
      bubble.classList.remove('in'); void bubble.offsetWidth; bubble.classList.add('in');
      ui.audio('unlock');
      frame();
    }

    // ---- driven from the game's half-second tick ----------------------------------------
    function tick() {
      const tut = state();
      if (tut.off) { if (active) hide(); return; }
      const c = ctx();
      if (active) {
        const t = active;
        const onTab = t.tab === 'any' || t.tab === c.tab;
        if (t.kind === 'action' && t.done(c, snap)) { mark(t.id); hide(); quietUntil = Date.now() + 700; return; }
        if (t.kind === 'action' && !t.scripted && !t.inModal && onTab && !t.when(c)) { mark(t.id); hide(); quietUntil = Date.now() + 700; return; }   // the step can no longer be done (or already was): move on, never trap the player
        if (t.kind === 'info' && !t.when(c) && onTab) { mark(t.id); hide(); quietUntil = Date.now() + 700; return; }   // the moment passed
        if (!onTab || document.hidden) { hide(); return; }
        if (root) root.style.display = (blocking() && !(t.inModal && modalOpen() && !document.querySelector('.fin-sheet, .fin-block, .sc-ov'))) ? 'none' : '';   // dialogs and sheets come first
        if (bubble && t.kind === 'action' && Date.now() - shownAt > stuckMs()) bubble.querySelector('.co-ok').style.display = '';
        const p = bubble && bubble.querySelector('p'); if (p) { const txt = t.text(c); if (p.textContent !== txt) p.textContent = txt; }
        return;
      }
      if (Date.now() < quietUntil || document.hidden) return;
      const t = pick(c);
      if (t) show(t, c);
    }
    function reset() { const t = state(); t.seen = {}; t.off = false; ui.save(); hide(); quietUntil = 0; }
    function stop() { state().off = true; ui.save(); hide(); }
    // A dialog opening or closing is checked at once, so a tip never lingers over it until the next half-second tick.
    const modalEl = document.getElementById('modal');
    if (modalEl && window.MutationObserver) new MutationObserver(() => { try { tick(); } catch (e) { /* ui not ready */ } }).observe(modalEl, { attributes: true, childList: true });
    return { tick, reset, stop, hide, current: () => (active ? { id: active.id, kind: active.kind, inModal: !!active.inModal, visible: !!root && root.style.display !== 'none', target: active.target(ctx(), snap) || {}, text: active.text(ctx()) } : null), ids: TIPS.map((x) => x.id) };
  };
})();
