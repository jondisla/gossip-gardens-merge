/* Gossip Gardens - UI controller: tabs, board rendering, drag and drop, sound hooks, save. */
(function () {
  'use strict';
  const G = window.GG;
  const { Game, CHAINS, TUNING: T, itemName, sprite, icon, navIcon, portrait } = G;
  const SAVE_KEY = 'gossip-gardens-save-v1';

  const $ = (id) => document.getElementById(id);
  const el = { coins: $('coins'), gems: $('gems'), fill: $('energyFill'), etext: $('energyText'), etimer: $('energyTimer'),
    orders: $('orders'), board: $('board'), info: $('info'), toast: $('toast'), modal: $('modal'), nav: $('nav'),
    lvlNum: $('lvlNum'), lvlRing: $('lvlRing'), storeBtn: $('storeBtn'), boostBtn: $('boostBtn') };
  const TABS = ['garden', 'estate', 'shop', 'events'];

  // ---- save / load -------------------------------------------------------
  function readSave() { try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; } }
  function writeSave() { try { localStorage.setItem(SAVE_KEY, game.serialize()); } catch (e) { /* storage blocked */ } }
  const saved = readSave();
  let game = saved ? Game.load(saved) : new Game();
  let tutorial = null, selected = -1, drag = null, lastBoardHTML = '', tab = 'garden', lastTab = 'garden', screens = null;
  G.audio.enabled = game.s.settings.sound;

  const fmt = (ms) => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const secs = (ms) => (ms >= 60000 ? fmt(ms) : Math.ceil(ms / 1000) + 's');
  const play = (n, a) => G.audio.play(n, a);

  // ---- toast / modal -----------------------------------------------------
  let toastTimer = 0;
  function toast(msg) {
    if (!msg) return;
    el.toast.textContent = msg; el.toast.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.toast.classList.remove('show'), 1900);
  }
  function drainNotes() { const n = game.notes.splice(0); if (n.length) { toast(n.slice(0, 2).join('  ·  ')); play('unlock'); } }
  function modal(title, html, buttons) {
    el.modal.innerHTML = '<div class="card dlg"><h2>' + title + '</h2>' + html + '<div class="row2"></div></div>';
    const row = el.modal.querySelector('.row2');
    (buttons || [{ label: 'OK' }]).forEach((b) => {
      const btn = document.createElement('button');
      btn.className = 'btn ' + (b.cls || ''); btn.innerHTML = b.label;
      btn.onclick = () => { if (!b.keep) closeModal(); if (b.fn) b.fn(); };
      row.appendChild(btn);
    });
    el.modal.hidden = false;
  }
  function closeModal() { el.modal.hidden = true; el.modal.innerHTML = ''; }
  el.modal.addEventListener('pointerdown', (e) => { if (e.target === el.modal && !el.modal.querySelector('[data-lock]')) closeModal(); });

  function help() {
    modal('How to play',
      '<ul><li><b>Kitchen:</b> tap a machine to make items (1 energy). Drag two matching items together to merge them up a level. Green checks mark items your customers want.</li>' +
      '<li><b>Tools:</b> drag scissors onto an item to split it, the starry teapot to raise it a level. Tap the wishing teapot to get what your orders need.</li>' +
      '<li><b>Storage</b> (chest, bottom left) keeps items safe, and orders can use them. <b>Booster</b> (bolt, bottom right) unlocks after a few merges.</li>' +
      '<li><b>Estate:</b> spend stars and coins to restore the manor and unlock its story.</li>' +
      '<li><b>Cart</b> (top right) opens the shop. The side buttons by the customers go to your Estate and Events (daily gift, tasks, check-in, Garden Pass, Bloom Festival and a lucky wheel).</li></ul>' +
      '<p>Tip: tap your level badge, then Full screen, to hide the browser bars. Energy refills 1 every 2 minutes. Your game saves on this device. There are no accounts and no real-money purchases.</p>',
      [{ label: 'Got it' }]);
  }
  // ---- full screen: hides the browser's top and bottom bars where the browser allows it ------------
  const rootEl = document.documentElement;
  const fsSupported = () => !!((document.fullscreenEnabled || document.webkitFullscreenEnabled) && (rootEl.requestFullscreen || rootEl.webkitRequestFullscreen));
  const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  function enterFs(quiet) {
    try {
      const p = (rootEl.requestFullscreen || rootEl.webkitRequestFullscreen).call(rootEl, { navigationUI: 'hide' });
      if (p && p.catch) p.catch(() => { game.s.settings.fullscreen = false; writeSave(); if (!quiet) toast('Full screen was blocked. Try the browser menu: Add to Home screen.'); });
    } catch (e) { game.s.settings.fullscreen = false; if (!quiet) toast('Full screen is not available here.'); }
  }
  function toggleFs() {
    if (isFs()) {
      game.s.settings.fullscreen = false; writeSave();
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      game.s.settings.fullscreen = true; writeSave();
      enterFs(false);
    }
  }
  function fsHelp() {
    modal('Hide the browser bars',
      '<p>This browser does not allow full screen from a web page. You can add the game to your home screen instead:</p>' +
      '<ul><li><b>iPhone (Safari):</b> Share button, then Add to Home Screen.</li><li><b>Android (Chrome or Brave):</b> browser menu, then Add to Home screen or Install app.</li></ul>' +
      '<p>Open it from the new home screen icon and the bars are gone.</p>', [{ label: 'OK' }]);
  }
  // If you chose full screen last time, the first tap switches it back on (browsers only allow it from a tap).
  window.addEventListener('pointerup', () => { if (game.s.settings && game.s.settings.fullscreen && fsSupported() && !isFs()) enterFs(true); }, { once: true });

  function menu() {
    const lp = game.levelProgress();
    modal('Menu', '<p><b>Level ' + lp.level + '</b> <span class="muted">' + lp.into + '/' + lp.need + ' xp to the next level</span></p>', [
      { label: 'Replay tutorial', cls: 'ghosty', fn: () => { if (tutorial) tutorial.reset(); toast('Tutorial restarted'); } },
      { label: 'How to play', cls: 'ghosty', fn: help },
      fsSupported() ? { label: isFs() ? 'Exit full screen' : 'Full screen', cls: 'ghosty', fn: toggleFs } : { label: 'Hide browser bars', cls: 'ghosty', fn: fsHelp },
      { label: 'Replay prologue', cls: 'ghosty', fn: () => { if (screens) screens.playScene('intro'); } },
      { label: G.audio.enabled ? 'Sound: on' : 'Sound: off', cls: 'ghosty', keep: false, fn: toggleSound },
      { label: 'New game', cls: 'alt', fn: confirmReset },
    ]);
    const row = el.modal.querySelector('.row2'); if (row) row.classList.add('stack');
  }
  function toggleSound() {
    G.audio.enabled = !G.audio.enabled; game.s.settings.sound = G.audio.enabled;
    G.audio.unlock(); play('tap'); writeSave(); renderHud();
  }
  function confirmReset() {
    modal('Start over?', '<p>This erases your progress on this device.</p>',
      [{ label: 'Cancel', cls: 'ghosty' }, { label: 'Erase', cls: 'alt', fn: () => { game = new Game(); introShown = false; try { localStorage.removeItem(INTRO_KEY); } catch (e) { /* storage blocked */ } G.audio.enabled = true; selected = -1; lastBoardHTML = ''; writeSave(); showTab('garden'); toast('New game started'); } }]);
  }
  function refillLabel() { const c = game.refillCost(); return c === 0 ? 'Free' : icon('gem') + c; }
  function offerRefill() {
    const c = game.refillCost();
    modal('Out of energy', '<p>Refill to full ' + (c === 0 ? '<b>for free</b> (your first refill today)' : 'for <b>' + c + ' gems</b> (the price doubles each time today)') + ', or wait: you gain 1 energy every ' + (T.energyRegenMs / 60000) + ' minutes.</p>',
      [{ label: 'Wait', cls: 'ghosty' }, { label: 'Refill ' + refillLabel(), fn: () => act(() => game.refillEnergy(), 'claim') }]);
  }

  // ---- actions -----------------------------------------------------------
  // Machine Choice Box: pick one of up to three machines.
  function openChoice(r) {
    const btns = r.options.map((ch) => '<button class="mc-opt" data-mc="' + ch + '"><span class="mc-art">' + sprite('gen_' + ch, 1) + '</span><b>' + itemName('gen_' + ch, 1) + '</b></button>').join('');
    modal('Choose a machine', '<p>Tap the one you want. It will be added to your board.</p><div class="mc-row">' + btns + '</div>', [{ label: 'Later', cls: 'ghosty' }]);
    el.modal.querySelectorAll('[data-mc]').forEach((b) => { b.onclick = () => { closeModal(); play('claim'); act(() => game.pickMachine(r.i, b.dataset.mc), 'unlock'); }; });
  }
  // Bigger celebrations queued by the game: a new machine, or a machine that was upgraded.
  function drainPopups() {
    if (!game.popups.length || !el.modal.hidden || tab !== 'garden' || G.coachActive) return;
    const p = game.popups.shift();
    play('unlock');
    modal(p.kind === 'newgen' ? 'New machine!' : 'Machine upgraded!',
      '<div class="np-art">' + sprite(p.chain, p.level) + '</div><p style="text-align:center"><b>' + itemName(p.chain, p.level) + '</b></p>' +
      (p.kind === 'newgen' ? '<p style="text-align:center">Tap it to make new items.</p>' : '<p style="text-align:center">It now makes better items.</p>'), [{ label: 'Great!' }]);
  }
  function act(fn, okSound) {
    const r = fn();
    if (r && r.msg) toast(r.msg);
    if (r && r.needEnergy) offerRefill();
    if (r && r.ok && r.kind === 'choice') { openChoice(r); return r; }
    if (r) {
      if (r.ok) {
        if (r.kind === 'merge') play('merge', r.level);
        else if (r.kind === 'spawn') play('spawn');
        else if (r.kind === 'tool') play('claim');
        else if (okSound) play(okSound);
        else if (r.reward) play('serve');
        else if (r.gain) play('collect');
        else play('tap');
        if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* ignore */ } }
      } else if (r.msg) play('error');
    }
    drainNotes();
    writeSave(); render();
    return r;
  }

  // ---- render ------------------------------------------------------------
  // The scenic backdrop spans the stat bar and (on the kitchen screen) the customer ledge.
  function fitScene() {
    const scene = $('scene'), app = $('app');
    if (!scene || !app) return;
    const ref = tab === 'garden' ? $('top') : $('hud');
    scene.style.height = Math.round(ref.getBoundingClientRect().bottom - app.getBoundingClientRect().top) + 'px';
  }
  window.addEventListener('resize', fitScene);

  function render() {
    renderHud();
    if (tab === 'garden') { renderOrders(); renderBoard(); renderInfo(); renderDock(); }
    else if (screens) screens.render(tab);
    renderNav();
    fitScene();
  }

  function renderHud() {
    const s = game.s, lp = game.levelProgress();
    el.coins.textContent = s.coins; el.gems.textContent = s.gems;
    el.etext.textContent = s.energy;
    el.fill.style.width = Math.min(100, (s.energy / T.energyMax) * 100) + '%';
    const free = game.clock() < s.freeTapUntil;
    el.etimer.textContent = free ? 'free taps ' + fmt(s.freeTapUntil - game.clock()) : s.energy >= T.energyMax ? 'FULL' : fmt(game.msToNextEnergy());
    el.lvlNum.textContent = lp.level;
    el.lvlRing.style.strokeDashoffset = String(100 - Math.round((lp.into / lp.need) * 100));
    const hp = game.happyProgress();
    $('happyRing').style.strokeDashoffset = String(100 - Math.round((hp.n / hp.goal) * 100));
    $('happyNum').textContent = hp.n + '/' + hp.goal;
  }
  // "1h 52m" while it is long, "12m 05s" when it is close
  function chestLabel(ms) {
    if (ms >= 3600000) return Math.floor(ms / 3600000) + 'h ' + Math.floor((ms % 3600000) / 60000) + 'm';
    return Math.floor(ms / 60000) + 'm ' + ('0' + Math.floor((ms % 60000) / 1000)).slice(-2) + 's';
  }

  function renderNav() {
    const b = game.badges();
    el.nav.querySelectorAll('button').forEach((btn) => {
      const t = btn.dataset.tab;
      btn.classList.toggle('on', t === tab);
      btn.classList.toggle('dot', t !== tab && !!b[t]);
    });
    $('cartBtn').classList.toggle('dot', !!b.shop);
    $('cartBtn').classList.toggle('locked', !!game.featureLocked('shop'));
    $('repairBtn').classList.toggle('dot', !!(b.estate || b.events));
  }

  // A hand taps the Serve button of a waiting customer when the player has been idle for a few seconds.
  let lastTouch = Date.now(), lastOrdersHTML = '';
  window.addEventListener('pointerdown', () => {
    lastTouch = Date.now();
    document.querySelectorAll('.hint-hand').forEach((h) => h.remove());
    lastOrdersHTML = '';
  }, true);
  function renderOrders() {
    const now = game.clock();
    const idle = Date.now() - lastTouch > 4000;
    let handShown = false;
    const html = game.s.orders.map((o) => {
      if (o.pending) {
        return '<div class="order waiting"><div class="cust"></div><div class="wait">Next customer<br><b>' + fmt(Math.max(0, o.readyAt - now)) + '</b></div></div>';
      }
      const ready = game.canServe(o), have = {};
      let unmet = 0;
      const wants = o.wants.map((w) => {
        const k = w.chain + ':' + w.level;
        have[k] = (have[k] || 0) + 1;
        const ok = game.countAll(w.chain, w.level) >= have[k];
        if (!ok) unmet++;
        return '<div class="want ' + (ok ? 'have' : '') + '" data-chain="' + w.chain + '" data-level="' + w.level + '">' + sprite(w.chain, w.level) + '</div>';
      }).join('');
      const r = o.reward;
      return '<div class="order ' + (ready ? 'ready' : '') + '" data-oid="' + o.id + '" "><div class="cust">' + portrait(o.cust || 'mabel') + '</div>' +
        '<div class="reward">' + (r.smile ? '<span class="rv" title="Good review"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#ffd23a" stroke="#e39a12" stroke-width="1.4"/><circle cx="7" cy="8" r="1.3" fill="#5a3b12"/><circle cx="13" cy="8" r="1.3" fill="#5a3b12"/><path d="M5.5 12 Q10 17 14.5 12" fill="none" stroke="#5a3b12" stroke-width="1.5" stroke-linecap="round"/></svg></span>' : '') + '<span>' + icon('coin') + '+' + r.coins + '</span>' + (r.energy ? '<span>' + icon('bolt') + r.energy + '</span>' : '') + (r.gems ? '<span>' + icon('gem') + r.gems + '</span>' : '') + '</div>' +
        '<div class="tray"><div class="wants">' + wants + '</div></div>' +
        (ready ? '<button data-serve="' + o.id + '">Serve</button>' : '') +
        (!ready && unmet === 1 && o.wants.length >= 2 ? '<span class="almost">Almost there!</span>' : '') +
        (ready && idle && !G.coachActive && !handShown && (handShown = true) ? '<span class="hint-hand" aria-hidden="true"></span>' : '') + '</div>';
    }).join('');
        if (html !== lastOrdersHTML) { const sl = el.orders.scrollLeft; el.orders.innerHTML = html; el.orders.scrollLeft = sl; lastOrdersHTML = html; }
  }

  function cellHTML(i, c, needed) {
    const sel = i === selected ? ' sel' : '';
    const alt = ((i % T.cols) + Math.floor(i / T.cols)) % 2 ? ' alt' : '';
    const lock = game.s.locks && game.s.locks[i];
    if (lock && lock.near) {
      const hint = lock.prize ? '<span class="buried">' + sprite(lock.prize.chain, lock.prize.level) + '</span>' : '';
      return '<div class="cell locked near' + sel + '" data-i="' + i + '"><img class="sand" src="' + G.extraImages.sand + '" alt="" draggable="false">' + hint + '</div>';
    }
    if (lock) {
      const inner = lock.prize
        ? sprite('coin', 5) + '<b class="lockcost">' + lock.cost + '</b>'
        : icon('bolt') + '<b>' + lock.cost + '</b>';
      return '<div class="cell locked' + sel + '" data-i="' + i + '"><img class="sand" src="' + G.extraImages.sand + '" alt="" draggable="false">' +
        '<span class="lockbub' + (lock.prize ? ' prize' : '') + '"><img class="bubimg" src="' + G.extraImages.bubble + '" alt="" draggable="false"><span class="lbin">' + inner + '</span></span>' +
        '<img class="lockpad" src="' + G.extraImages.padlock + '" alt="" draggable="false"></div>';
    }
    if (!c) return '<div class="cell empty' + alt + sel + '" data-i="' + i + '"></div>';
    const def = CHAINS[c.chain], role = def.role, now = game.clock();
    let cls = 'cell item' + alt + sel + (flying.has(i) ? ' landing' : ''), extra = '';
    if (c.bubbleUntil) { cls += ' bubble'; extra = '<div class="bub"></div><span class="tag">' + secs(c.bubbleUntil - now) + '</span>'; }
    else if (role === 'generator') {
      if (def.auto) extra = '<span class="tag auto">' + secs(Math.max(0, (c.nextAt || now) - now)) + '</span>';
      else if (c.rechargeAt) { cls += ' recharging'; extra = '<span class="tag">' + secs(c.rechargeAt - now) + '</span>'; }
      else if (G.hasCooldown(c.chain)) extra = '<span class="charge">' + c.charges + '</span>';
    } else if (role === 'gift' && c.unlockAt) {
      const rem = c.unlockAt - now;
      if (rem > 0) extra = '<span class="tag">' + secs(rem) + '</span>';
      else { cls += ' gift-ready'; extra = '<span class="tag go">Open!</span>'; }
    } else if (role === 'tool' && c.uses > 1) extra = '<span class="charge">' + c.uses + '</span>';
    if (role === 'generator') extra += '<i class="gspark"></i><svg class="gbolt" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 1 4 14h6l-2 9 11-14h-6z" fill="#ffd23a" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>';
    if (role === 'generator' && c.level > 0) extra += '<span class="gstars">' + '\u2605'.repeat(c.level) + '</span>';
    if (c.web) { cls += ' webbed'; extra += '<img class="web" src="' + G.extraImages.cobweb + '" alt="" draggable="false" style="transform:rotate(' + ((i % 4) * 90) + 'deg)">'; }
    if (needed.has(i) && !c.web) extra += '<i class="chk" title="An order needs this"></i>';
    if ((role === 'ingredient' || role === 'currency') && !c.bubbleUntil && c.level >= G.maxLevel(c.chain)) extra += '<i class="crown" title="Top level"></i>';
    return '<div class="' + cls + '" data-i="' + i + '">' + sprite(c.chain, c.level) + extra + '</div>';
  }

  // ---- items flying out of generators ---------------------------------------------------------
  const flying = new Set();   // cells whose new item is still in the air (kept hidden until it lands)
  function launch(f, k) {
    const dst = el.board.children[f.i], src = el.board.children[f.from];
    const spr = dst && dst.querySelector('.spr');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!dst || !src || !spr || document.hidden || reduce) { flying.delete(f.i); lastBoardHTML = ''; return; }
    const sr = src.getBoundingClientRect(), dr = dst.getBoundingClientRect();
    const dx = dr.left - sr.left, dy = dr.top - sr.top, dist = Math.hypot(dx, dy);
    const fly = document.createElement('div');
    fly.className = 'fly';
    fly.style.cssText = 'left:' + sr.left + 'px;top:' + sr.top + 'px;width:' + sr.width + 'px;height:' + sr.height + 'px';
    fly.appendChild(spr.cloneNode(true));
    document.body.appendChild(fly);
    src.classList.add('fx-tap'); setTimeout(() => src.classList.remove('fx-tap'), 220);
    const arc = Math.min(70, 18 + dist * 0.28), dur = Math.min(560, 300 + dist * 0.3), delay = k * 90;
    const anim = fly.animate([
      { transform: 'translate(0px,0px) scale(.45)', opacity: 0.9, offset: 0 },
      { transform: 'translate(' + dx * 0.5 + 'px,' + (dy * 0.5 - arc) + 'px) scale(1.18)', opacity: 1, offset: 0.55 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(1)', opacity: 1, offset: 1 },
    ], { duration: dur, delay, easing: 'cubic-bezier(.32,.7,.4,1)', fill: 'both' });
    fly.style.visibility = delay ? 'hidden' : 'visible';
    if (delay) setTimeout(() => { fly.style.visibility = 'visible'; }, delay);
    const done = () => {
      fly.remove(); flying.delete(f.i); lastBoardHTML = '';
      renderBoard();
      const node = el.board.children[f.i];
      if (node) { node.classList.add('fx-spawn'); setTimeout(() => { node.classList.remove('fx-spawn'); lastBoardHTML = ''; }, 380); }
      play('tap');
    };
    anim.onfinish = done; anim.oncancel = done;
  }

  function renderBoard() {
    if (drag && drag.moved) return; // never rebuild the DOM mid-drag
    const fx = game.fx.splice(0);
    const flights = fx.filter((f) => f.type === 'spawn' && f.from != null && f.from !== f.i);
    flights.forEach((f) => flying.add(f.i));
    const needed = game.neededCells();
    const html = game.s.cells.map((c, i) => cellHTML(i, c, needed)).join('');
    if (html !== lastBoardHTML) { el.board.innerHTML = html; lastBoardHTML = html; }
    fx.forEach((f) => {
      if (flights.indexOf(f) >= 0) { launch(f, flights.indexOf(f)); return; }
      const node = el.board.children[f.i];
      if (!node) return;
      const cls = 'fx-' + f.type;
      node.classList.add(cls); setTimeout(() => { node.classList.remove(cls); lastBoardHTML = ''; }, 450);
    });
  }

  function infoText(c) {
    const def = CHAINS[c.chain], role = def.role;
    if (c.web) return 'Stuck in a cobweb! Drag a matching item onto it to free it, or merge next to it.';
    if (c.bubbleUntil) return 'Sealed in a bubble. Pay ' + T.bubbleGemCost + ' gems to free it, wait for it to burst into coins, or break it for 1 coin.';
    if (role === 'choice') return 'Tap to choose one of three new machines!';
    if (role === 'boost') return CHAINS[c.chain].kind === 'energy' ? 'Tap to use: machines cost no energy for ' + CHAINS[c.chain].minutes[c.level - 1] + ' min. Merge two for longer.' : 'Tap to use: every timer on the board finishes at once!';
    if (role === 'generator') {
      if (def.auto) return 'Makes items by itself, free of energy. Merge two to make it faster.';
      return c.rechargeAt ? 'Recharging. Speed up with gems, or wait.' :
        'Tap to make ' + itemName(def.produces, 1).toLowerCase().replace(/ .*/, '') + ' items. Merge two to upgrade it.';
    }
    if (role === 'tool') return def.desc + (c.uses > 1 ? ' (' + c.uses + ' uses left)' : '');
    if (role === 'currency') return 'Tap to collect ' + def.payout[c.level - 1] + '. Merge to make a bigger pile.';
    if (role === 'gift') return c.unlockAt ? 'Opening takes time. Come back, or speed it up.' : 'Tap to start unlocking this gift.';
    if (c.level >= G.maxLevel(c.chain)) return 'Top level! Use it for an order, or sell it for ' + game.sellValue(c) + ' coins.';
    return 'Merge with another ' + itemName(c.chain, c.level).toLowerCase() + ' to make a ' + itemName(c.chain, c.level + 1).toLowerCase() + '.';
  }

  function renderInfo() {
    const c = selected >= 0 ? game.s.cells[selected] : null;
    if (!c) {
      el.info.innerHTML = '<div class="infobody idle"><p>TAP an item to learn more about it.</p></div>';
      return;
    }
    const role = CHAINS[c.chain].role, btns = [];
    if (c.web) { /* frozen: no actions */ }
    else if (c.bubbleUntil) { btns.push('<button class="btn alt" data-act="bubble">' + icon('gem') + T.bubbleGemCost + ' Free it</button>'); btns.push('<button class="btn ghosty sm" data-act="break">Break +1' + icon('coin') + '</button>'); }
    else if (role === 'choice') btns.push('<button class="btn" data-act="tap">Choose</button>');
    else if (role === 'boost') btns.push('<button class="btn" data-act="tap">Use</button>');
    else if (role === 'ingredient') btns.push('<button class="btn blue" data-act="sell">Sell ' + icon('coin') + '+' + game.sellValue(c) + '</button>');
    else if (role === 'currency') btns.push('<button class="btn" data-act="tap">Collect</button>');
    else if (role === 'generator' && !CHAINS[c.chain].auto) {
      if (c.rechargeAt) btns.push('<button class="btn alt" data-act="speed">' + icon('gem') + T.genSpeedUpGemCost + ' Speed up</button>');
      else btns.push('<button class="btn" data-act="tap">Make</button>');
    } else if (role === 'gift') {
      if (!c.unlockAt) btns.push('<button class="btn" data-act="tap">Unlock</button>');
      else if (c.unlockAt > game.clock()) btns.push('<button class="btn alt" data-act="speed">' + icon('gem') + game.giftSpeedCost(c) + ' Speed up</button>');
      else btns.push('<button class="btn" data-act="tap">Open</button>');
    } else if (c.chain === 'orb') btns.push('<button class="btn" data-act="tap">Use</button>');
    if (!c.web && !c.bubbleUntil && !(role === 'gift' && c.unlockAt)) btns.push('<button class="btn ghosty sm" data-act="store">Store</button>');
    el.info.innerHTML = '<div class="infotab"><span>' + itemName(c.chain, c.level) + ' (Lvl ' + c.level + ')</span><button class="ibtn" data-act="detail" aria-label="Item details">i</button></div>' +
      '<div class="infobody"><p>' + infoText(c) + '</p><div class="btns">' + btns.join('') + '</div></div>';
  }

  function renderDock() {
    const used = game.storageUsed(), slots = game.s.storageSlots;
    el.storeBtn.innerHTML = (G.extraImages.cabinet ? '<img class="dock-ico" src="' + G.extraImages.cabinet + '" alt="" draggable="false">' : '<svg viewBox="0 0 56 56" class="dock-ico" aria-hidden="true"><rect x="8" y="6" width="40" height="12" rx="6" fill="#2fae9f" stroke="#17695f" stroke-width="2"/><rect x="10" y="9" width="36" height="4" rx="2" fill="#7fe0d2"/><rect x="7" y="16" width="42" height="34" rx="6" fill="#3cc4b3" stroke="#17695f" stroke-width="2"/><rect x="12" y="21" width="32" height="22" rx="4" fill="#cdeff0" stroke="#17695f" stroke-width="1.6"/><path d="M12 32 H44" stroke="#17695f" stroke-width="1.4" opacity=".55"/><path d="M15 24 L21 24 L15 30Z" fill="#fff" opacity=".7"/><rect x="20" y="36" width="8" height="5" rx="2" fill="#f2b45a"/><rect x="31" y="25" width="7" height="5" rx="2" fill="#e88a8a"/><rect x="12" y="46" width="32" height="3" rx="1.5" fill="#17695f" opacity=".35"/><rect x="10" y="50" width="7" height="4" rx="2" fill="#17695f"/><rect x="39" y="50" width="7" height="4" rx="2" fill="#17695f"/></svg>') + (used ? '<b>' + used + '</b>' : '');
    const b = game.s.boost, mode = game.boostMode();
    el.boostBtn.classList.toggle('locked', !b.unlocked);
    el.boostBtn.classList.toggle('on', mode > 0);
    el.boostBtn.innerHTML = icon('bolt') + '<b>' + (b.unlocked ? ['x1', 'x2', 'x4'][mode] : '&#128274;') + '</b>';
  }

  // ---- storage and item detail dialogs -------------------------------------------
  // The inventory: a teal shelf frame; the slots sit on its shelves. Positions are % of the frame (4 columns x 4 shelves).
  const INV_X = [21.4, 40.7, 59.9, 79.1], INV_Y = [30.7, 48.3, 65.8, 83.3];
  const INV_POS = [];
  INV_Y.forEach((y) => INV_X.forEach((x) => INV_POS.push([x, y])));
  function openStorage(note) {
    const s = game.s, n = Math.min(s.storageSlots, INV_POS.length);
    let slots = '';
    for (let k = 0; k < n; k++) {
      const p = INV_POS[k], it = s.storage[k];
      slots += '<button class="inv-slot' + (it ? ' full' : '') + '" style="left:' + p[0] + '%;top:' + p[1] + '%"' + (it ? ' data-retrieve="' + k + '" aria-label="' + itemName(it.chain, it.level) + '"' : ' disabled aria-label="Empty slot"') + '><i class="inv-oval"></i>' + (it ? sprite(it.chain, it.level) : '') + '</button>';
    }
    let fresh = '';
    if (s.storageSlots < T.storageMax && s.storageSlots < INV_POS.length) {
      const p = INV_POS[s.storageSlots];
      fresh = '<button class="inv-new" style="left:' + p[0] + '%;top:' + p[1] + '%" data-buyslot="1"><b>New Slot</b><span class="inv-price">' + icon('gem') + '<i>' + game.slotCost() + '</i></span></button>';
    }
    el.modal.innerHTML = '<div class="inv"><img class="inv-bg" src="' + G.extraImages.inventory + '" alt="" draggable="false"><button class="inv-x" aria-label="Close"></button>' +
      slots + fresh + '<p class="inv-note">' + (note || 'Tap an item to bring it back. Orders can use stored items too.') + '</p></div>';
    el.modal.hidden = false;
    el.modal.querySelector('.inv-x').onclick = closeModal;
    el.modal.querySelectorAll('[data-retrieve]').forEach((b) => {
      b.onclick = () => { closeModal(); act(() => game.retrieve(+b.dataset.retrieve)); };
    });
    const buy = el.modal.querySelector('[data-buyslot]');
    if (buy) buy.onclick = () => {
      const r = act(() => game.buyStorageSlot());
      openStorage(r && !r.ok ? r.msg : '');
    };
  }
  el.storeBtn.addEventListener('click', () => openStorage());
  el.boostBtn.addEventListener('click', () => act(() => game.cycleBoost()));

  /** Chain info panel: the level path (undiscovered levels show "?") and which machines make it. */
  function openChainInfo(chain, level) {
    game.updateBest();
    const def = CHAINS[chain], best = Math.max((game.s.best || {})[chain] || 0, level);
    const tiles = def.names.map((n, k) => {
      const L = k + 1, known = L <= best, cur = L === level, have = known ? game.countAll(chain, L) : 0;
      return '<div class="ci-tile ' + (known ? 'known' : 'unknown') + (cur ? ' cur' : '') + '"' + (known ? ' title="' + n + '"' : '') + '>' +
        (known ? sprite(chain, L) : '<b>?</b>') + (cur && have > 0 ? '<i class="ci-count">' + have + '</i>' : '') + '</div>';
    }).join('');
    let makers = '';
    if (def.role === 'ingredient') {
      const ids = Object.keys(CHAINS).filter((id) => CHAINS[id].role === 'generator' && (CHAINS[id].produces === chain || CHAINS[id].produces === '*'));
      makers = ids.length ? '<h4 class="ci-sub">Generated by:</h4><div class="ci-makers">' +
        ids.map((id) => '<div class="ci-maker"><div class="ci-tile known">' + sprite(id, 1) + '</div><small>' + CHAINS[id].names[0] + '</small></div>').join('') + '</div>' : '';
    } else if (def.role === 'generator') {
const tbl = T.spawnTable || {}, top = (L) => Math.max.apply(null, (tbl[Math.min(L, 3)] || tbl[3] || [[1]]).map((e) => e[0])), nextL = level + 1;
      const upg = nextL > def.names.length ? '' : '<p class="ci-note">' + (top(nextL) > top(level) ? 'Merge two to upgrade: a new item will be generated.' : 'Merge two to upgrade: better items become more likely.') + '</p>';
      makers = '<h4 class="ci-sub">Makes:</h4><p class="ci-note">' + (def.produces === '*' ? 'A mix of everything' : CHAINS[def.produces].names[0] + ' items') + '</p>' + upg;
    }
    el.modal.innerHTML = '<div class="card ci"><div class="ci-head"><span>' + itemName(chain, level) + '</span></div>' +
      '<button class="ci-x" aria-label="Close">&times;</button><h3 class="ci-level">Level ' + level + '</h3>' +
      '<div class="ci-grid">' + tiles + '</div>' + makers + '</div>';
    el.modal.hidden = false;
    el.modal.querySelector('.ci-x').onclick = closeModal;
  }
  function openDetail(c) { openChainInfo(c.chain, c.level); }

  // ---- tabs ----------------------------------------------------------------
  let introTimer = 0, introShown = false;
  const INTRO_KEY = 'gossip-gardens-intro-seen';
  function introSeen() {
    try { if (localStorage.getItem(INTRO_KEY) === '1') return true; } catch (e) { /* storage blocked */ }
    const e = game.s.estate;
    return introShown || !!e.seen.intro || Object.keys(e.done || {}).length > 0;
  }
  const WINDOWS = ['shop', 'events'];
  let under = 'garden';
  function showTab(name) {
    const lockedAt = game.featureLocked(name === 'shop' ? 'shop' : name === 'events' ? 'events' : '');
    if (lockedAt) { play('error'); toast('Unlocks at level ' + lockedAt); return; }
    if (!WINDOWS.includes(name)) under = name; else if (!WINDOWS.includes(tab)) under = tab;
    lastTab = under;
    tab = name; document.body.dataset.tab = name; document.body.dataset.under = under;
    TABS.forEach((t) => { $('screen-' + t).hidden = !(t === name || t === under); });
    if (drag) { if (drag.ghost) drag.ghost.remove(); drag = null; }
    lastBoardHTML = '';
    render();
    clearTimeout(introTimer);
    // The prologue plays once per new game, the first time the repair page opens (never again, even if a save is lost).
    if (name === 'estate' && !introSeen()) introTimer = setTimeout(() => {
      if (tab !== 'estate' || !el.modal.hidden || introSeen()) return;
      introShown = true; try { localStorage.setItem(INTRO_KEY, '1'); } catch (e) { /* storage blocked */ }
      screens.playScene('intro', render);
    }, 250);
  }
  el.nav.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) { play('tap'); showTab(b.dataset.tab); }
  });

  // ---- input: orders, info buttons, header -----------------------------------------
  el.orders.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-serve]');
    if (b && !b.disabled) {
      const o = game.s.orders.find((x) => x.id === +b.dataset.serve), boardHas = {};
      let usesStore = false;
      if (o) for (const w of o.wants) { const k = w.chain + ':' + w.level; boardHas[k] = (boardHas[k] || 0) + 1; if (game.s.cells.filter((c) => c && !c.web && !c.bubbleUntil && c.chain === w.chain && c.level === w.level).length < boardHas[k]) usesStore = true; }
      if (usesStore) modal('Complete order?', '<p>To finish this order you will use items from your storage.</p>', [{ label: 'Rethink', cls: 'ghosty' }, { label: 'Continue', fn: () => act(() => game.serve(+b.dataset.serve)) }]);
      else act(() => game.serve(+b.dataset.serve));
      return;
    }
    // Tap a wanted item, or the customer, to see where that item comes from.
    const want = e.target.closest('.want'), card = e.target.closest('.order[data-oid]');
    if (want) { play('tap'); openChainInfo(want.dataset.chain, +want.dataset.level); return; }
    if (card) {
      const o = game.s.orders.find((x) => x.id === +card.dataset.oid);
      if (o && o.wants && o.wants.length) {
        const w = o.wants.find((x) => game.countAll(x.chain, x.level) < 1) || o.wants[0];
        play('tap'); openChainInfo(w.chain, w.level);
      }
    }
  });
  el.info.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || selected < 0) return;
    const i = selected, a = b.dataset.act, c = game.s.cells[i];
    if (a === 'sell') {
      if (c && c.level >= 4) modal('Sell this item?', '<p>' + itemName(c.chain, c.level) + ' is hard to get. Are you sure you want to sell it?</p>', [{ label: 'Keep it', cls: 'ghosty' }, { label: 'Sell', cls: 'alt', fn: () => act(() => game.sell(i)) }]);
      else act(() => game.sell(i));
    } else if (a === 'break') modal('Break the bubble?', '<p>You will lose the item inside and get 1 coin. This cannot be undone.</p>', [{ label: 'Cancel', cls: 'ghosty' }, { label: 'Break', cls: 'alt', fn: () => act(() => game.breakBubble(i)) }]);
    else if (a === 'tap') act(() => game.tap(i));
    else if (a === 'speed') act(() => game.speedUp(i));
    else if (a === 'bubble') act(() => game.buyBubble(i));
    else if (a === 'store') act(() => game.store(i));
    else if (a === 'detail' && c) openDetail(c);
  });
  $('energyBtn').addEventListener('click', () => {
    game.regen();
    if (game.s.energy >= T.energyMax) toast('Energy is full');
    else offerRefill();
  });
  $('gemBtn').addEventListener('click', () => showTab('shop'));
  $('cartBtn').addEventListener('click', () => { play('tap'); showTab('shop'); });
  $('repairBtn').addEventListener('click', () => { play('tap'); showTab('estate'); });
  $('happy').addEventListener('click', () => { play('tap'); screens.openReviews(); });
  $('levelBtn').addEventListener('click', () => { play('tap'); screens.openProfile(); });
  window.addEventListener('pointerdown', () => G.audio.unlock(), { once: true });

  // ---- input: drag and drop on the board (and onto the storage chest) ----------------
  const hitAt = (x, y) => { const n = document.elementFromPoint(x, y); return n ? (n.closest('.cell') || n.closest('#storeBtn')) : null; };

  el.board.addEventListener('pointerdown', (e) => {
    const node = e.target.closest('.cell');
    if (!node) return;
    const i = +node.dataset.i, c = game.s.cells[i];
    selected = i;
    if (game.s.locks && game.s.locks[i]) { act(() => game.unlock(i)); e.preventDefault(); return; }
    if (c && c.web) { act(() => game.tap(i)); e.preventDefault(); return; }
    if (!c || c.bubbleUntil) { render(); return; }
    drag = { i, x0: e.clientX, y0: e.clientY, moved: false, ghost: null, size: node.getBoundingClientRect().width, over: null };
    e.preventDefault();
  });

  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 8) return;
      drag.moved = true;
      const c = game.s.cells[drag.i];
      const g = document.createElement('div');
      g.className = 'ghost'; g.style.width = g.style.height = drag.size + 'px'; g.innerHTML = sprite(c.chain, c.level);
      document.body.appendChild(g); drag.ghost = g;
      const src = el.board.children[drag.i]; if (src) src.classList.add('dragging');
    }
    drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px';
    const over = hitAt(e.clientX, e.clientY);
    if (drag.over && drag.over !== over) drag.over.classList.remove('target');
    if (over && over.dataset.i !== String(drag.i)) over.classList.add('target');
    drag.over = over;
  });

  function endDrag(e, cancel) {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.ghost) d.ghost.remove();
    if (d.over) d.over.classList.remove('target');
    lastBoardHTML = '';
    if (cancel) { render(); return; }
    if (!d.moved) { act(() => game.tap(d.i)); return; }
    const target = hitAt(e.clientX, e.clientY);
    if (target && target.id === 'storeBtn') { act(() => game.store(d.i)); return; }
    if (target && target.dataset.i != null) {
      const to = +target.dataset.i;
      const r = game.move(d.i, to);
      if (r.ok) selected = to;
      act(() => r);
    } else render();
  }
  window.addEventListener('pointerup', (e) => endDrag(e, false));
  window.addEventListener('pointercancel', (e) => endDrag(e, true));

  // ---- hints: a hand shows the next thing to tap when the player has been idle for a few seconds ----------
  function hintTarget() {
    const idle = Date.now() - lastTouch;
    const ch = game.currentChore(), canPay = !!ch && !game.choreShort();
    if (!el.modal.hidden) {
      // inside the Chores popup: point at the pay button once it can be paid
      return (idle > 4000 && canPay && el.modal.querySelector('.card.chores')) ? el.modal.querySelector('[data-dochore]') : null;
    }
    if (tab === 'estate' && idle > 4000 && canPay) return document.querySelector('.rbtn.journal');
    // on the board: after a while with nothing to serve, point at the repair button if a chore can be paid
    if (tab === 'garden' && idle > 7000 && canPay && !game.s.orders.some((o) => !o.pending && game.canServe(o))) return $('repairBtn');
    return null;
  }
  function syncHint() {
    if (G.coachActive) { const old = document.querySelector('.hint-hand.ext'); if (old) old.remove(); return; }   // the tutorial's own hand is showing
    const t = hintTarget(), cur = document.querySelector('.hint-hand.ext');
    if (cur && cur.parentElement === t) return;
    if (cur) cur.remove();
    if (!t) return;
    const h = document.createElement('span');
    h.className = 'hint-hand ext'; h.setAttribute('aria-hidden', 'true');
    t.appendChild(h);
  }
  // Pictures the player adds (art/extras/hand_pointer.webp, art/extras/arrow_back.webp) replace the drawn ones.
  [['hand_pointer', '--hand-img'], ['arrow_back', '--arrow-img']].forEach(([name, prop]) => {
    const img = new Image(); const url = 'art/extras/' + name + '.webp';
    img.onload = () => document.documentElement.style.setProperty(prop, 'url("' + url + '")');
    img.src = url;
  });

  // ---- ticking -----------------------------------------------------------
  setInterval(() => {
    const rolled = game.rollover();
    game.evSync();
    game.tick();
    renderHud(); renderNav();
    if (tab === 'garden') { renderOrders(); renderBoard(); if (!drag) { renderInfo(); renderDock(); } }
    else if (rolled && screens) screens.render(tab);
    syncHint();
    if (tab === 'estate') {
      const c = document.querySelector('.rside-btn.chest');
      if (c) { const rd = game.chestReady(); c.classList.toggle('ready', rd); const l = c.querySelector('.ctime'); if (l) l.textContent = rd ? 'Free!' : chestLabel(game.chestMsLeft()); }
    }
    drainNotes();
    drainPopups();
    if (tutorial) tutorial.tick();
  }, 500);
  setInterval(writeSave, 5000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) writeSave(); else { game.rollover(); game.tick(); render(); } });
  window.addEventListener('pagehide', writeSave);

  // ---- boot --------------------------------------------------------------
  const ui = { get game() { return game; }, toast, modal, closeModal, menu, chestLabel, act, render, save: writeSave, audio: play, showTab, get lastTab() { return lastTab; }, get tab() { return tab; } };
  window.GG.ui = ui;
  screens = G.makeScreens(ui);
  tutorial = G.makeTutorial(ui);

  $('coinIco').innerHTML = icon('coin'); $('gemIco').innerHTML = icon('gem'); $('boltIco').innerHTML = icon('bolt');
  $('cartBtn').innerHTML = G.extraImages.cart ? '<img class="cart-ico" src="' + G.extraImages.cart + '" alt="" draggable="false">' : '<svg viewBox="0 0 48 40" class="cart-ico"><path d="M3 4 H10 L16 27 H37 L42 11 H12" fill="#fff" stroke="#4aa3d6" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="19" cy="34" r="3.5" fill="#f2a33a"/><circle cx="34" cy="34" r="3.5" fill="#f2a33a"/><path d="M18 14 V22 M25 14 V22 M32 14 V22" stroke="#e0a94e" stroke-width="2.4" stroke-linecap="round"/></svg>';
  $('repairBtn').innerHTML = G.extraImages.drill ? '<img class="drill-ico" src="' + G.extraImages.drill + '" alt="" draggable="false">' : '<svg viewBox="0 0 64 64" class="drill-ico" aria-hidden="true"><g transform="rotate(-18 32 32)"><rect x="30" y="34" width="14" height="22" rx="4" fill="#3b3f4a" stroke="#1d2027" stroke-width="2"/><rect x="32" y="38" width="3" height="14" rx="1.5" fill="#6a707e"/><rect x="8" y="16" width="38" height="22" rx="9" fill="#f6c63a" stroke="#8a5d0c" stroke-width="2.4"/><rect x="12" y="19" width="26" height="6" rx="3" fill="#fde98a"/><rect x="38" y="21" width="9" height="12" rx="3" fill="#8e95a6" stroke="#4a5060" stroke-width="2"/><rect x="46" y="24.5" width="12" height="5" rx="2.5" fill="#c9cfdb" stroke="#4a5060" stroke-width="1.6"/><rect x="10" y="30" width="22" height="5" rx="2.5" fill="#d99a14"/></g></svg>'; 
  el.nav.querySelectorAll('button').forEach((b) => { b.insertAdjacentHTML('afterbegin', navIcon(b.dataset.tab)); });
  showTab('garden');

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline cache is optional */ });
  }

  // Playing from the web address? Offer to install the game like an app (full screen, works offline).
  (function installHint() {
    const KEY = 'gossip-gardens-install-dismissed';
    const standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    if (standalone || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) return;
    try { const t = +localStorage.getItem(KEY); if (t && Date.now() - t < 3 * 86400000) return; } catch (e) { /* storage blocked */ }
    let deferred = null;
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; });
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setTimeout(() => {
      if (document.getElementById('installBar')) return;
      const how = deferred ? '' : ios ? 'Tap the Share button, then “Add to Home Screen”.' : 'Open your browser menu and choose “Install app” or “Add to Home screen”.';
      const bar = document.createElement('div');
      bar.id = 'installBar'; bar.setAttribute('role', 'dialog');
      bar.innerHTML = '<img src="icon-192.png" alt="" width="40" height="40"><div class="ib-txt"><b>Get the app</b><span>Play Gossip Gardens full screen, even offline. ' + how + '</span></div>' +
        (deferred ? '<button class="ib-go">Install</button>' : '') + '<button class="ib-x" aria-label="Not now">✕</button>';
      document.body.appendChild(bar);
      const close = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { /* storage blocked */ } bar.remove(); };
      bar.querySelector('.ib-x').onclick = close;
      const go = bar.querySelector('.ib-go');
      if (go) go.onclick = () => { deferred.prompt(); deferred.userChoice.finally(() => { deferred = null; close(); }); };
    }, 6000);
    window.addEventListener('appinstalled', () => { const b = document.getElementById('installBar'); if (b) b.remove(); });
  })();

  Object.defineProperty(window, '__game', { get: () => game }); // handy for debugging in the console
})();
