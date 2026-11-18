/* Gossip Gardens - Estate, Shop and Events screens. */
(function (root) {
  'use strict';
  const G = root.GG;
  const S = G.STORY;
  const { icon, sprite, portrait, plotArt } = G;

  function rewardHTML(r) {
    if (!r) return '';
    const p = [];
    if (r.coins) p.push('<span>' + icon('coin') + r.coins + '</span>');
    if (r.gems) p.push('<span>' + icon('gem') + r.gems + '</span>');
    if (r.energy) p.push('<span>' + icon('bolt') + r.energy + '</span>');
    if (r.gift) p.push('<span class="gf">' + sprite('gift', r.gift) + '</span>');
    if (r.tool) p.push('<span class="gf">' + sprite(r.tool, r.toolLevel || 1) + '</span>');
    if (r.spins) p.push('<span class="tx">' + r.spins + ' spin</span>');
    if (r.xp) p.push('<span class="tx">' + r.xp + ' xp</span>');
    if (r.freeTapMs) p.push('<span class="tx">' + Math.round(r.freeTapMs / 60000) + ' min free taps</span>');
    return '<span class="reward-row">' + p.join('') + '</span>';
  }
  const costHTML = (c) => (c.coins ? icon('coin') + c.coins : '') + (c.gems ? icon('gem') + c.gems : '');
  const bar = (v, max) => '<div class="meter"><i style="width:' + Math.min(100, Math.round((v / max) * 100)) + '%"></i></div>';

  function makeScreens(ui) {
    const $ = (id) => document.getElementById(id);
    const els = { estate: $('screen-estate'), shop: $('screen-shop'), events: $('screen-events') };
    let justDone = '', estateTab = 'restore', estateView = -1, panning = false, eventsTab = 'rush', wheelRot = 0, wheelBusy = false;

    // ---- story scene player ---------------------------------------------------
    // Characters talk in speech bubbles over the scene (no card). Tap anywhere to continue; earlier lines stay on screen.
    function playScene(id, done) {
      const scene = S.SCENES[id];
      if (!scene) { if (done) done(); return; }
      ui.game.markSeen(id); ui.save();
      const m = $('modal'), sides = {}, tints = ['#f29bc3', '#6fb4ee'];
      let shown = 0;
      const sideOf = (who) => { if (!(who in sides)) sides[who] = Object.keys(sides).length % 2 ? 'right' : 'left'; return sides[who]; };
      const row = (line) => {
        const who = line.who in S.CHARS ? line.who : 'you', ch = S.CHARS[who], side = sideOf(who), tint = tints[side === 'left' ? 0 : 1];
        return '<div class="sc-row ' + side + '" style="--tint:' + tint + '"><div class="sc-av">' + portrait(who) + '<b>' + ch.name + '</b></div>' +
          '<p class="sc-say">' + line.text + '</p></div>';
      };
      const finish = () => { ui.closeModal(); if (done) done(); };
      const draw = () => {
        const from = Math.max(0, shown - 2), last = shown === scene.lines.length - 1;
        m.innerHTML = '<div class="sc-ov"><button class="sc-skip" aria-label="Skip the story">' + (G.extraImages && G.extraImages.skip ? '<img src="' + G.extraImages.skip + '" alt="" draggable="false">' : '&#9654;&#9654;') + '</button><div class="sc-title">' + scene.title + '</div><div class="sc-stack">' +
          scene.lines.slice(from, shown + 1).map(row).join('') + '</div><div class="sc-hint">' + (last ? 'Tap to finish' : 'Tap to continue') + '</div></div>';
        m.hidden = false;
        const ov = m.querySelector('.sc-ov');
        m.querySelector('.sc-skip').onclick = (e) => { e.stopPropagation(); ui.audio('tap'); finish(); };   // skip the rest of the scene
        ov.onclick = () => { if (shown >= scene.lines.length - 1) finish(); else { shown++; ui.audio && ui.audio('tap'); draw(); } };
      };
      draw();
    }

    // ---- Player Profile (opened by tapping the level at the top left) ---------------------------------
    const AVATARS = ['you', 'mabel', 'rufus', 'pippa', 'ivo', 'cordelia', 'boy1', 'girl1', 'boy2', 'girl2'];
    const FRAMES = ['#9ec3f0', '#f29bc3', '#7fd18b', '#f2c14e', '#b08be8', '#ef7a6a'];
    // The chosen avatar is also how "You" appears in story scenes.
    function applyProfile() {
      const p = ui.game.s.profile;
      if (!G.avatarImages) G.avatarImages = Object.assign({}, G.portraitImages || {}, G.avatarExtra || {});
      if (G.portraitImages && G.avatarImages[p.avatar]) G.portraitImages.you = G.avatarImages[p.avatar];
    }
    function avatarHTML(id) {
      // draw a specific character's picture even though "you" may currently be remapped
      if (!G.avatarImages || !G.avatarImages[id]) return portrait(id);
      const keep = G.portraitImages.you;
      G.portraitImages.you = G.avatarImages[id];
      const h = portrait('you');
      G.portraitImages.you = keep;
      return h;
    }
    function openProfile() {
      const g = ui.game, m = $('modal'), p = g.s.profile, lp = g.levelProgress();
      const draft = { avatar: p.avatar, frame: p.frame, name: p.name };
      let tab = 'avatar', bubble = false;
      const draw = () => {
        const nm = m.querySelector('.pf-name'); if (nm) draft.name = nm.value;
        const grid = tab === 'avatar'
          ? AVATARS.map((id) => '<button class="pf-tile' + (draft.avatar === id ? ' on' : '') + '" data-av="' + id + '" style="--fr:' + FRAMES[draft.frame] + '">' + avatarHTML(id) + (draft.avatar === id ? '<i class="pf-tick">&#10003;</i>' : '') + '</button>').join('')
          : FRAMES.map((c, k) => '<button class="pf-tile' + (draft.frame === k ? ' on' : '') + '" data-fr="' + k + '" style="--fr:' + c + '">' + avatarHTML(draft.avatar) + (draft.frame === k ? '<i class="pf-tick">&#10003;</i>' : '') + '</button>').join('');
        m.innerHTML = '<div class="card prof"><div class="ch-head"><span>Player Profile</span></div><button class="ch-x" aria-label="Close">&times;</button>' +
          '<div class="pf-top"><div class="pf-big" style="--fr:' + FRAMES[draft.frame] + '">' + avatarHTML(draft.avatar) + '</div><div class="pf-fields">' +
          '<div class="pf-row"><input class="pf-name" maxlength="16" aria-label="Player name"><button class="pf-btn" data-pf="rename" aria-label="Edit name">&#9998;</button></div>' +
          '<div class="pf-row"><span class="pf-id"></span><button class="pf-btn" data-pf="copy" aria-label="Copy ID">&#10064;</button></div></div></div>' +
          '<div class="pf-lvl"><span class="pf-star"><b>' + lp.level + '</b></span><div class="pf-bar"><i style="width:' + Math.round(lp.into / lp.need * 100) + '%"></i><em>' + lp.into + '/' + lp.need + '</em></div>' +
          '<button class="pf-gift" data-pf="gift" aria-label="Rewards for the next level">' + sprite('gift', 1) + '<u>!</u></button>' +
          '<div class="pf-bub"' + (bubble ? '' : ' hidden') + '><b>Level ' + (lp.level + 1) + ' rewards</b>' + rewardHTML(g.levelReward(lp.level + 1)) + '</div></div>' +
          '<div class="pf-tabs"><button class="' + (tab === 'avatar' ? 'on' : '') + '" data-pf="tab-avatar">Avatar</button><button class="' + (tab === 'frame' ? 'on' : '') + '" data-pf="tab-frame">Frame</button></div>' +
          '<div class="pf-grid">' + grid + '</div>' +
          '<button class="pf-save" data-pf="save">Save</button><button class="pf-menu" data-pf="menu">Settings and help</button></div>';
        m.hidden = false;
        m.querySelector('.pf-name').value = draft.name;
        m.querySelector('.pf-id').textContent = 'ID:' + p.id;
      };
      const done = () => { m.onclick = null; ui.closeModal(); };
      draw();
      m.onclick = (e) => {
        if (!m.querySelector('.card.prof')) return;
        if (e.target.closest('.ch-x')) { done(); return; }
        const av = e.target.closest('[data-av]'), fr = e.target.closest('[data-fr]'), b = e.target.closest('[data-pf]');
        if (av) { ui.audio('tap'); draft.avatar = av.dataset.av; draw(); return; }
        if (fr) { ui.audio('tap'); draft.frame = +fr.dataset.fr; draw(); return; }
        if (!b) { if (bubble) { bubble = false; draw(); } return; }
        const k = b.dataset.pf;
        if (k === 'rename') { const n = m.querySelector('.pf-name'); n.focus(); n.select(); }
        else if (k === 'copy') { try { navigator.clipboard.writeText(p.id); ui.toast('ID copied'); } catch (err) { ui.toast('ID: ' + p.id); } }
        else if (k === 'gift') { ui.audio('tap'); bubble = !bubble; draw(); }
        else if (k === 'tab-avatar' || k === 'tab-frame') { ui.audio('tap'); tab = k.slice(4); draw(); }
        else if (k === 'menu') { done(); ui.menu(); }
        else if (k === 'save') {
          const n = m.querySelector('.pf-name').value.trim();
          p.name = n || p.name; p.avatar = draft.avatar; p.frame = draft.frame;
          applyProfile(); ui.save(); ui.audio('claim'); done(); ui.render();
        }
      };
    }
    applyProfile();

    // ---- Estate ---------------------------------------------------------------------
    const ICON_JOURNAL = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="14" y="8" width="38" height="48" rx="6" fill="#4aa3e8" stroke="#1f5f9f" stroke-width="3"/><rect x="20" y="14" width="26" height="12" rx="3" fill="#bfe3ff"/><path d="M22 34h22M22 41h22M22 48h14" stroke="#e9f6ff" stroke-width="3" stroke-linecap="round"/><circle cx="14" cy="16" r="4" fill="#dfe6ee" stroke="#7a8794" stroke-width="2"/><circle cx="14" cy="27" r="4" fill="#dfe6ee" stroke="#7a8794" stroke-width="2"/><circle cx="14" cy="38" r="4" fill="#dfe6ee" stroke="#7a8794" stroke-width="2"/><circle cx="14" cy="49" r="4" fill="#dfe6ee" stroke="#7a8794" stroke-width="2"/><g transform="rotate(35 50 44)"><rect x="46" y="26" width="8" height="30" rx="2" fill="#f2a33a" stroke="#8a5400" stroke-width="2"/><path d="M46 56 L50 63 L54 56Z" fill="#f6d9a8" stroke="#8a5400" stroke-width="1.5"/></g></svg>';
    const ICON_WHISK = '<svg viewBox="0 0 64 64" aria-hidden="true"><g transform="rotate(-25 22 34)"><ellipse cx="22" cy="22" rx="9" ry="14" fill="none" stroke="#e4e9f2" stroke-width="3"/><ellipse cx="22" cy="22" rx="4" ry="14" fill="none" stroke="#e4e9f2" stroke-width="3"/><rect x="18" y="34" width="8" height="22" rx="4" fill="#f08a3a" stroke="#8a4410" stroke-width="2"/></g><g transform="rotate(25 44 34)"><rect x="36" y="8" width="16" height="22" rx="3" fill="#dfe5ef" stroke="#6a7486" stroke-width="2"/><path d="M40 12v14M44 12v14M48 12v14" stroke="#7a8496" stroke-width="2"/><rect x="40" y="30" width="8" height="26" rx="4" fill="#f08a3a" stroke="#8a4410" stroke-width="2"/></g></svg>';

    const paintedIcon = (key, fallback) => (G.extraImages && G.extraImages[key]) ? '<img src="' + G.extraImages[key] + '" alt="" draggable="false">' : fallback;

    function renderEstate() {
      const g = ui.game, s = g.s;
      document.body.dataset.etab = estateTab;
      let h = '';
      if (estateTab === 'restore') {
        if (estateView < 0 || estateView >= S.VIEWS.length) estateView = g.currentView();
        const view = S.VIEWS[estateView], area = S.AREAS[view.area], vp = g.viewProgress(estateView);
        const nextOk = estateView < S.VIEWS.length - 1 && g.viewUnlocked(estateView + 1);
        // The repair scene fills the screen. Tap a piece to repair it; the buttons sit in the corners.
        const LAY = (G.repairLayout && G.repairLayout[estateView]) || [[25, 25, 36], [75, 25, 36], [25, 60, 36], [75, 60, 36], [25, 85, 36], [75, 85, 36]];
        const padlock = G.extraImages && G.extraImages.padlock;
        const bg = 'art/scenes/area_' + (view.area + 1) + '_spot_' + (view.spot + 1);
        const b = g.badges();
        h += '<div class="rscene' + (panning ? ' pan' : '') + '"><div class="rground"></div>' +
          '<img class="rbg" src="' + bg + '.webp" alt="" draggable="false" onerror="if(!this.dataset.t){this.dataset.t=1;this.src=\'' + bg + '.png\'}else{this.style.display=\'none\'}">' +
          g.tasksOfView(estateView).map((t, k) => {
            const st = g.taskState(t), done = st === 'done';
            const ch = g.currentChore(), ok = !!ch && s.coins >= ch.cost;
            let badge = '';
            if (st === 'available') badge = '<span class="cost ' + (ok ? 'ok' : 'no') + '">' + icon('coin') + (ch ? Math.min(s.coins, ch.cost) + '/' + ch.cost : '') + '</span>';
            else if (st === 'locked') badge = padlock ? '<img class="pc-lock" src="' + padlock + '" alt="" draggable="false">' : '';
            else badge = '<span class="pc-done">&#10003;</span>';
            const pos = LAY[k % LAY.length];
            return '<button class="piece st-' + st + (justDone === t.id ? ' just' : '') + '" data-piece="' + t.id + '" aria-label="' + t.name + '" title="' + t.name + '" style="--cx:' + pos[0] + '%;--cy:' + pos[1] + '%;--w:' + pos[2] + '%;z-index:' + (k + 1) + '">' +
              '<span class="piece-art">' + plotArt(t.kind, done, undefined, g.finishOf(t.id)) + '</span>' + badge + '</button>';
          }).join('') +
          '<div class="rtop"><span class="rstars">' + icon('star') + '<b>' + g.starsAvailable() + '</b></span>' +
          '<div class="areabar"><button class="arr" data-viewstep="-1"' + (estateView > 0 ? '' : ' disabled') + ' aria-label="Previous spot">&#8249;</button>' +
          '<span class="aname"><b>' + area.name + '</b> <small>' + vp.done + '/' + vp.total + '</small></span>' +
          '<button class="arr" data-viewstep="1"' + (nextOk ? '' : ' disabled') + ' aria-label="Next spot">&#8250;</button></div></div>' +
          (vp.done === vp.total ? '<div class="rdone">' + (nextOk ? '<button class="rnext" data-viewstep="1">Spot restored! Next spot &#8250;</button>' : (estateView < S.VIEWS.length - 1 ? 'Spot restored!' : 'The whole estate is awake again!')) + '</div>' : '') +
          '<div class="rcorner"><button class="rbtn journal' + (b.chores ? ' dot' : '') + '" data-chores="1" aria-label="Chores">' + paintedIcon('journal', ICON_JOURNAL) + '</button>' +
          '</div>' +
          '<button class="rbtn events' + (b.events ? ' dot' : '') + '" data-go="events" aria-label="Events">' + (G.navIcon ? G.navIcon('events') : '') + '</button>' +
          '<div class="rside">' +
            (g.starterNext() ? '<button class="rside-btn starter' + (g.starterReady() ? ' ready' : '') + '" data-starter="1" aria-label="Starter bonus"><img src="art/items/gift_box.webp" alt="" draggable="false"><small>' + (g.starterReady() ? 'Claim!' : 'Lv ' + g.starterNext().lv) + '</small></button>' : '') +
            (g.evInfo('frenzy').active ? '<button class="rside-btn ev frenzy" data-ev="frenzy" aria-label="Flaming Frenzy"><span class="evi">' + FLAME_SVG + '</span><small>' + fmtLeft(g.evInfo('frenzy').left) + '</small></button>' : '') +
            '<button class="rside-btn ev goals' + (g.goalsClaimable() ? ' ready' : '') + '" data-ev="goals" aria-label="Manor Goals"><span class="evi">' + TROPHY_SVG + '</span><small>' + fmtLeft(g.evInfo('goals').left) + '</small></button>' +
            '<button class="rside-btn chest' + (g.chestReady() ? ' ready' : '') + '" data-chest="1" aria-label="Free chest"><img src="art/items/mystery_chest.webp" alt="" draggable="false"><small class="ctime">' + (g.chestReady() ? 'Free!' : ui.chestLabel(g.chestMsLeft())) + '</small></button>' +
          '</div>' +
          (g.choreShort() ? '<div class="back-arrow" aria-hidden="true"></div>' : '') +
          '<button class="rbtn kitchen" data-go="garden" aria-label="Kitchen">' + paintedIcon('kitchen', ICON_WHISK) + '</button></div>';
      }
      els.estate.innerHTML = h;
      panning = false;
      els.estate.classList.toggle('fit', estateTab === 'restore');
    }


    // The bar along the bottom of the Chores popup: seven steps, one filled for every chore done, with reward bubbles on steps 3, 5 and 7.
    function choreBarHTML(g) {
      const cb = g.choreBar();
      const segs = [0, 1, 2, 3, 4, 5, 6].map((i) => {
        const bub = (i === 2 || i === 4 || i === 6) ? '<span class="dbub">' + rewardHTML(S.CALENDAR[i]) + '</span>' : '';
        return '<i class="seg ' + (i < cb.filled ? 'full' : (i === cb.filled ? 'next' : '')) + '">' + bub + '</i>';
      }).join('');
      return '<div class="daybar" aria-label="Chore progress"><span class="dcal"><small>Lvl</small><b>' + cb.level + '</b></span><span class="dtrack">' + segs + '</span></div>';
    }

    // ---- Chores popup (opened by the journal button) -------------------------------------------------
    function openChores(note) {
      const g = ui.game, c = g.currentChore(), m = $('modal'), task = S.TASKS[g.s.chores.done];
      let body;
      if (!c) {
        body = '<p class="ch-empty">All chores are done. Great work!</p>';
      } else {
        const ok = g.s.coins >= c.cost, have = Math.min(g.s.coins, c.cost), nu = task;
        body = '<div class="ch-card"><div class="ch-av">' + portrait(c.who) + '</div><div class="ch-title">' + c.title + '</div></div>' +
          '<h4 class="ch-sub">Rewards</h4><div class="ch-reward"><span class="xp-ico">' + icon('star') + '<b>XP</b></span><i>' + c.xp + '</i></div>' +
          (nu ? '<p class="ch-unlock">Completes the repair: <b>' + nu.name + '</b></p>' : '') +
          '<button class="ch-btn ' + (ok ? 'ok' : 'no') + '" data-dochore="1">' + icon('coin') + '<span>' + have + '/' + c.cost + '</span></button><p class="ch-note' + (note ? ' good' : '') + '">' + (note || '') + '</p>';
      }
      m.innerHTML = '<div class="card chores"><div class="ch-head"><span>Chores</span></div><button class="ch-x" aria-label="Close">&times;</button>' + body + '</div>' + choreBarHTML(g);
      m.hidden = false;
      m.querySelector('.ch-x').onclick = () => ui.closeModal();
      const btn = m.querySelector('[data-dochore]');
      if (btn) btn.onclick = () => {
        const r = ui.act(() => g.completeChore(), 'unlock');
        if (r && r.ok) restoreDone(r);
        else { const n = m.querySelector('.ch-note'); if (n && r) n.textContent = r.msg || ''; }
      };
    }

    // Choose how a repair looks. The dialog cannot be dismissed by tapping outside, so the story always continues.
    // Three colour choices per repair, like the original's bottom sheet: pick a striped swatch and the piece changes
    // in the scene right away; the green tick keeps it. The choices are the classic colours plus two random shifts.
    const HUES = [-150, -110, -70, -35, 35, 70, 110, 150];
    const swatch = (deg) => '<span class="fs-sw">' + [20, 48, 140, 210].map((h) => '<i style="background:hsl(' + (h + deg + 360) % 360 + ',72%,' + (h === 210 ? 58 : 62) + '%)"></i>').join('') + '</span>';
    function chooseFinish(id, next) {
      const g = ui.game, t = S.TASKS.find((x) => x.id === id);
      let cur = g.finishOf(id);
      if (cur === 1) cur = 38;
      const opts = [0];
      if (cur) opts.push(cur);
      const pool = HUES.filter((d) => !opts.includes(d));
      while (opts.length < 3 && pool.length) {
        const d = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        if (opts.every((o) => Math.abs(o - d) >= 55)) opts.push(d);
      }
      document.querySelectorAll('.fin-sheet, .fin-block').forEach((e) => e.remove());
      const block = document.createElement('div'); block.className = 'fin-block';
      const sheet = document.createElement('div'); sheet.className = 'fin-sheet'; sheet.setAttribute('role', 'dialog');
      const draw = () => {
        sheet.innerHTML = '<h3>Choose Renovation Colours</h3><p>' + t.name + '</p><div class="fs-row">' +
          opts.map((d) => '<button class="fs-opt' + (cur === d ? ' on' : '') + '" data-fin="' + d + '" aria-label="Colour set">' + swatch(d) + '</button>').join('') +
          '</div><button class="fs-ok" data-fin-ok="1" aria-label="Keep these colours">&#10003;</button>';
      };
      draw();
      document.body.appendChild(block); document.body.appendChild(sheet);
      sheet.onclick = (e) => {
        const o = e.target.closest('[data-fin]');
        if (o) { ui.audio('tap'); cur = +o.dataset.fin; g.setFinish(id, cur); ui.save(); draw(); renderEstate(); return; }
        if (e.target.closest('[data-fin-ok]')) { block.remove(); sheet.remove(); ui.audio('claim'); if (next) next(); }
      };
    }
    // Rave Reviews: explains the happy-customers meter and shows its reward.
    function openReviews() {
      const g = ui.game, hp = g.happyProgress(), m = $('modal');
      const face = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="#ffd45a" stroke="#fff" stroke-width="3"/><circle cx="14.5" cy="17" r="2" fill="#5a3b12"/><circle cx="25.5" cy="17" r="2" fill="#5a3b12"/><path d="M12.5 23.5 Q20 31.5 27.5 23.5" fill="none" stroke="#5a3b12" stroke-width="2.4" stroke-linecap="round"/></svg>';
      const gift = '<button class="rv-gift" aria-label="What is the reward?"><svg viewBox="0 0 48 48" aria-hidden="true"><rect x="7" y="20" width="34" height="23" rx="3" fill="#43c7a0" stroke="#1f8a6c" stroke-width="2"/><rect x="5" y="15" width="38" height="9" rx="2" fill="#5fe0b8" stroke="#1f8a6c" stroke-width="2"/><path d="M24 15 C14 3 6 10 14 15 Z M24 15 C34 3 42 10 34 15 Z" fill="#ffc83a" stroke="#c98a10" stroke-width="2"/><circle cx="24" cy="31" r="9" fill="#ffd45a" stroke="#fff" stroke-width="1.5"/><circle cx="21" cy="29" r="1.4" fill="#5a3b12"/><circle cx="27" cy="29" r="1.4" fill="#5a3b12"/><path d="M20 33 Q24 37 28 33" fill="none" stroke="#5a3b12" stroke-width="1.6" stroke-linecap="round"/></svg><i class="rv-bang">!</i></button>';
      m.innerHTML = '<div class="card reviews"><button class="rv-x" aria-label="Close">&#10005;</button><h2 class="rv-title">Rave Reviews</h2>' +
        '<div class="rv-bar">' + face + '<i style="width:' + Math.round(hp.n / hp.goal * 100) + '%"></i><b>' + hp.n + '/' + hp.goal + '</b>' + gift + '</div>' +
        '<div class="rv-pic">' + (G.portraitImages && G.portraitImages.you ? '<img class="spr" src="' + G.portraitImages.you + '" alt="" draggable="false">' : '') + '</div>' +
        '<p class="rv-text">Earn good reviews by serving customers, and win a big reward!</p>' +
        '<div class="rv-rew">' + rewardHTML(G.HAPPY_REWARD) + '</div><button class="rv-ok">OK</button>' +
        '<div class="rv-tip" hidden><div class="rv-tipgift">' + gift.replace(/<button[^>]*>|<\/button>|<i[^>]*>.*?<\/i>/g, '') + '</div><div><b>Rave Reviews Reward</b><span>Serve ' + hp.goal + ' customers to earn happy reviews and win coins, a gem and energy.</span></div></div></div>';
      m.hidden = false;
      m.onclick = (e) => {
        const tip = m.querySelector('.rv-tip');
        if (e.target.closest('.rv-gift')) { tip.hidden = !tip.hidden; return; }
        if (!tip.hidden) { tip.hidden = true; if (!e.target.closest('.rv-ok') && !e.target.closest('.rv-x')) return; }
        if (e.target === m || e.target.closest('.rv-ok') || e.target.closest('.rv-x')) { m.onclick = null; ui.closeModal(); } };
    }

    // ---- Timed events: Flaming Frenzy, Manor Goals, and the Starter Bonus chain --------------------------
    const fmtLeft = (ms) => { const m = Math.max(0, Math.ceil(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mi = m % 60; return d ? d + 'd ' + h + 'h' : h ? h + 'h ' + mi + 'm' : mi + 'm'; };
    const FLAME_SVG = '<svg viewBox="0 0 40 48" aria-hidden="true"><path d="M20 3 C23 12 33 17 33 30 C33 40 27 45 20 45 C13 45 7 40 7 31 C7 24 11 20 13 15 C15 19 16 21 18 22 C17 14 18 8 20 3Z" fill="#ff7a1a" stroke="#c0390f" stroke-width="2" stroke-linejoin="round"/><path d="M20 22 C23 27 27 29 27 35 C27 40 24 42 20 42 C16 42 13 39 13 35 C13 30 17 28 20 22Z" fill="#ffd23a"/></svg>';
    const CLOCHE = (hue, big) => '<svg viewBox="0 0 64 56" aria-hidden="true"><ellipse cx="32" cy="48" rx="28" ry="6" fill="#e9c46a" stroke="#9a6b12" stroke-width="2"/><path d="M8 46 C8 24 20 14 32 14 C44 14 56 24 56 46 Z" fill="hsl(' + hue + ',55%,' + (big ? 48 : 70) + '%)" stroke="hsl(' + hue + ',45%,25%)" stroke-width="2.4"/><circle cx="32" cy="10" r="4.5" fill="#ffd45a" stroke="#9a6b12" stroke-width="2"/><path d="M16 38 C17 30 21 25 27 22" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="3" stroke-linecap="round"/></svg>';
    const TROPHY_SVG = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 8 h20 v12 c0 8 -6 13 -10 13 c-4 0 -10 -5 -10 -13 z" fill="#ffd45a" stroke="#a86a00" stroke-width="2.4" stroke-linejoin="round"/><path d="M14 12 h-6 c0 8 3 11 8 12 M34 12 h6 c0 8 -3 11 -8 12" fill="none" stroke="#a86a00" stroke-width="2.4"/><rect x="21" y="33" width="6" height="6" fill="#d99a14"/><rect x="14" y="39" width="20" height="5" rx="2" fill="#a86a00"/></svg>';
    const CHAINED_GIFT = '<svg viewBox="0 0 200 150" aria-hidden="true"><ellipse cx="100" cy="128" rx="88" ry="16" fill="#d12f78"/><ellipse cx="100" cy="122" rx="80" ry="12" fill="#ff5fa0"/><rect x="62" y="56" width="76" height="62" rx="6" fill="#ffb02e" stroke="#c96f00" stroke-width="3"/><rect x="94" y="56" width="12" height="62" fill="#9b4be0"/><rect x="62" y="80" width="76" height="12" fill="#9b4be0" opacity=".85"/><path d="M100 56 C80 30 58 44 74 56 Z M100 56 C120 30 142 44 126 56 Z" fill="#ffd45a" stroke="#c96f00" stroke-width="3"/><path d="M52 104 L148 70 M52 70 L148 104" stroke="#aeb7c4" stroke-width="7" stroke-linecap="round"/><path d="M52 104 L148 70 M52 70 L148 104" stroke="#e8edf4" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="7 6"/><rect x="82" y="78" width="36" height="30" rx="7" fill="#ffc83a" stroke="#a86a00" stroke-width="3"/><path d="M90 78 v-8 a10 10 0 0 1 20 0 v8" fill="none" stroke="#a86a00" stroke-width="5"/><circle cx="100" cy="92" r="4" fill="#7a4a00"/></svg>';

    function evWindow(cls, title, timerMs, bodyHTML, footerHTML, infoText, onClick) {
      const m = $('modal');
      m.innerHTML = '<div class="card evw ' + cls + '"><button class="evw-i" data-evi="1" aria-label="How it works">i</button><button class="evw-x" data-evx="1" aria-label="Close">&times;</button>' +
        '<div class="evw-ribbon"><b>' + title + '</b></div>' + (timerMs != null ? '<div class="evw-timer"><span class="clk"></span>' + fmtLeft(timerMs) + '</div>' : '') +
        '<div class="evw-body">' + bodyHTML + '</div>' + (footerHTML || '') + '<div class="evw-info" hidden>' + (infoText || '') + '</div></div>';
      m.hidden = false;
      m.onclick = (e) => {
        if (e.target.closest('[data-evx]') || e.target === m) { m.onclick = null; ui.closeModal(); return; }
        if (e.target.closest('[data-evi]')) { const p = m.querySelector('.evw-info'); p.hidden = !p.hidden; return; }
        if (onClick) onClick(e);
      };
    }
    function openFrenzy() {
      const g = ui.game; g.evSync();
      const info = g.evInfo('frenzy'), fl = g.s.ev.frenzy.flames, T3 = G.FRENZY_TIERS, tier = g.frenzyTier(), top = T3[T3.length - 1].flames;
      const tiers = T3.map((t, i) => '<div class="fz-tier' + (i <= tier ? ' on' : '') + '">' + CLOCHE([210, 45, 300][i], i <= tier) + '<b>x' + t.mult + '</b><small>' + t.flames + '</small></div>').join('');
      const marks = T3.map((t) => '<i style="left:' + Math.round(t.flames / top * 100) + '%"></i>').join('');
      const body = '<p class="evw-desc">Earn coins to collect flames to unlock dish boosters! <b>One coin equals one flame!</b></p>' +
        '<div class="fz-art">' + CLOCHE(300, true) + '<span class="fz-flame">' + FLAME_SVG + '</span></div>' +
        '<div class="fz-panel"><p>A higher dish booster means better rewards! Served orders pay extra coins.</p><div class="fz-tiers">' + tiers + '</div>' +
        '<div class="fz-bar"><span class="fz-ico">' + FLAME_SVG + '</span><div class="fz-track"><i style="width:' + Math.min(100, Math.round(fl / top * 100)) + '%"></i>' + marks + '</div><b>' + fl + '</b></div></div>';
      const foot = info.active ? '<p class="evw-foot">When the timer ends, the boost will disappear! Use it wisely!</p><button class="evw-go" data-evx="1">Cool!</button>'
        : '<p class="evw-foot">The next Flaming Frenzy starts in ' + fmtLeft(info.left) + '.</p><button class="evw-go" data-evx="1">OK</button>';
      evWindow('frenzy', 'Flaming Frenzy', info.active ? info.left : null, body, foot, 'Every coin you earn from orders, selling and coin items adds a flame. Reach a flame mark to unlock a better dish booster: served orders then pay more coins until the timer ends. The event comes back every couple of days.');
    }
    function openGoals() {
      const g = ui.game; g.evSync();
      const info = g.evInfo('goals'), E = g.s.ev.goals, tasks = g.goalTasks(), MS = G.GOAL_MILESTONES, top = MS[MS.length - 1].points;
      const today = Math.floor((g.clock() - g.s.startedAt) / 86400000) % 7;
      const days = Array.from({ length: 7 }, (_, d) => '<span class="gd' + (E.days[Math.floor((g.clock() - g.s.startedAt) / 86400000) - today + d] ? ' on' : '') + (d === today ? ' now' : '') + '">Day ' + (d + 1) + '</span>').join('');
      const ms = MS.map((m, i) => '<button class="gm' + (E.mClaimed[i] ? ' done' : g.goalMilestoneReady(i) ? ' ready' : '') + '" data-gm="' + i + '"' + (g.goalMilestoneReady(i) ? '' : ' disabled') + '><span class="gm-r">' + rewardHTML(m.reward) + '</span><small>' + m.points + '</small></button>').join('');
      const rows = tasks.map((t) => '<div class="gt' + (t.claimed ? ' claimed' : '') + '"><div class="gt-txt"><b>' + t.title + '</b>' + bar(t.n, t.goal) + '<small>' + t.n + '/' + t.goal + '</small></div>' +
        '<button class="gt-btn' + (t.done && !t.claimed ? ' ready' : '') + '" data-gt="' + t.id + '"' + (t.done && !t.claimed ? '' : ' disabled') + '>' + (t.claimed ? '&#10003;' : t.done ? 'Claim +' + t.points : '+' + t.points) + '</button></div>').join('');
      const body = '<div class="gm-strip"><div class="gm-bar"><i style="width:' + Math.min(100, Math.round(E.points / top * 100)) + '%"></i></div><div class="gm-row">' + ms + '</div><p class="gm-pts">' + E.points + ' goal points</p></div>' + rows;
      evWindow('goals', 'Manor Goals', info.active ? info.left : null, body, '<div class="gd-row">' + days + '</div>',
        'Finish the weekly goals to earn goal points. Tap a reward bubble when your points reach it. The goals reset every week.',
        (e) => {
          const t = e.target.closest('[data-gt]'), m = e.target.closest('[data-gm]');
          if (t) { ui.act(() => g.claimGoal(t.dataset.gt), 'claim'); openGoals(); }
          else if (m) { ui.act(() => g.claimGoalMilestone(+m.dataset.gm), 'claim'); openGoals(); }
        });
    }
    function openStarter() {
      const g = ui.game, n = g.starterNext();
      if (!n) return;
      const ready = g.starterReady(), m = $('modal');
      m.innerHTML = '<div class="card evw starter"><button class="evw-x" data-evx="1" aria-label="Close">&times;</button><div class="st-ribbon"><b>Starter Bonus!</b></div>' +
        '<div class="st-art">' + CHAINED_GIFT + '</div>' +
        (ready ? '<p class="st-txt">Your next reward is ready!</p><div class="st-rew">' + rewardHTML(n.reward) + '</div>' : '<p class="st-txt">Upgrade to lv.<b>' + n.lv + '</b> to unlock the next reward!</p><div class="st-rew">' + rewardHTML(n.reward) + '</div>') +
        '<button class="evw-go" data-stgo="1">' + (ready ? 'Claim' : 'OK') + '</button></div>';
      m.hidden = false;
      m.onclick = (e) => {
        if (e.target.closest('[data-evx]') || e.target === m) { m.onclick = null; ui.closeModal(); return; }
        if (e.target.closest('[data-stgo]')) { m.onclick = null; ui.closeModal(); if (ready) { ui.act(() => g.claimStarter(), 'claim'); renderEstate(); ui.render(); } }
      };
    }

    // A finished chore has just completed its repair: close the popup, show the repaired piece, then play its story scene.
    function restoreDone(r) {
      const g = ui.game, task = S.TASKS.find((t) => t.id === r.task), v = g.viewOf(r.task);
      ui.closeModal();
      justDone = r.task; setTimeout(() => { justDone = ''; }, 1500);
      estateView = v;
      renderEstate();
      chooseFinish(r.task, () => { renderEstate(); afterRepair(r, task, v); });
    }
    function afterRepair(r, task, v) {
      const g = ui.game, idx = S.TASKS.indexOf(task), beat = idx % 6 === 0 || idx % 6 === 5;   // only a spot's first and last repair have a story scene
      (beat ? playScene : (sc, cb) => cb())(r.scene, () => {
        const vp = g.viewProgress(v), ap = g.areaProgress(task.area);
        if (ap.done === ap.total) ui.toast(S.AREAS[task.area].name + ' restored!');
        else if (vp.done === vp.total) ui.toast('Spot restored!');
        // The camera moves on to the next spot once this one is finished.
        if (vp.done === vp.total && v < S.VIEWS.length - 1 && g.viewUnlocked(v + 1)) { estateView = v + 1; panning = true; renderEstate(); }
        ui.render();
      });
    }
    // Repairs and chores are tied together: tapping the next repair opens its chore.
    function onPiece(id) {
      const g = ui.game, t = S.TASKS.find((x) => x.id === id), st = g.taskState(t);
      if (st === 'locked') { ui.toast(g.areaUnlocked(t.area) ? 'Finish the earlier chore first.' : 'Restore the previous area first.'); ui.audio('error'); return; }
      if (st === 'available') { ui.audio('tap'); openChores(); return; }
      const btns = [{ label: 'Replay story', cls: 'ghosty', fn: () => playScene(id) }, { label: 'Change finish', cls: 'ghosty', fn: () => chooseFinish(id, () => renderEstate()) }];
      btns.push({ label: 'Close' });
      ui.modal(t.name, '<p>Restored. Nice work!</p>', btns);
    }

    els.estate.addEventListener('click', (e) => {
      const g = ui.game, b = e.target.closest('button');
      if (!b || b.disabled) return;
      if (b.dataset.chores) { ui.audio('tap'); openChores(); return; }
      if (b.dataset.starter) { ui.audio('tap'); openStarter(); return; }
      if (b.dataset.ev) { ui.audio('tap'); (b.dataset.ev === 'frenzy' ? openFrenzy : openGoals)(); return; }
      if (b.dataset.chest) {
        if (!g.chestReady()) { ui.toast('The chest fills again in ' + ui.chestLabel(g.chestMsLeft()) + '.'); ui.audio('error'); return; }
        ui.act(() => g.openChest(), 'claim'); renderEstate(); ui.render(); return;
      }
      if (b.dataset.go) { ui.audio('tap'); ui.showTab(b.dataset.go); return; }
      if (b.dataset.viewstep) {
        const n = estateView + (+b.dataset.viewstep);
        if (n >= 0 && n < S.VIEWS.length && g.viewUnlocked(n)) { ui.audio('tap'); estateView = n; panning = true; renderEstate(); }
        return;
      }
      if (b.dataset.piece) { onPiece(b.dataset.piece); return; }
      if (b.dataset.replay) { playScene(b.dataset.replay); return; }
    });

    // ---- Shop -------------------------------------------------------------------------
    let shopTab = 'specials';
    const fmtHM = (ms) => { const m = Math.max(0, Math.floor(ms / 60000)); return Math.floor(m / 60) + 'h ' + (m % 60) + 'm'; };
    function offerCard(o) {
      const art = o.item ? sprite(o.item.chain, o.item.level) : o.art === 'bolt' ? icon('bolt') : sprite('gift', 2);
      const sold = o.left < 1;
      return '<div class="scard' + (o.rare ? ' rare' : '') + (sold ? ' sold' : '') + '"><div class="art">' + art + '</div>' +
        '<div class="stock">' + (sold ? 'Sold out' : o.left + ' Left') + '</div>' +
        '<button class="buy" data-offer="' + o.id + '"' + (sold ? ' disabled' : '') + '>' + (o.gems === 0 ? 'FREE' : icon('gem') + '<span>' + o.gems + '</span>') + '</button></div>';
    }
    function renderShop() {
      const g = ui.game, off = g.shopOffers();
      let h = '<div class="shopwrap"><div class="awning"><button class="shop-x" data-shopclose="1" aria-label="Close">&times;</button></div>';
      if (shopTab === 'gems') {
        h += '<div class="spanel"><div class="ptitle">Gems</div><div class="pgrid">' + S.GEM_PACKS.map((p) =>
          '<div class="scard"><div class="art"><img class="spr" src="art/items/' + p.art + '.webp" alt="" draggable="false"></div><div class="stock">' + icon('gem') + ' ' + p.gems + '</div>' +
          '<button class="buy off" disabled>Soon</button></div>').join('') + '</div></div>' +
          '<p class="shopnote">Gems come from level-ups and the shop. There is no real-money purchasing in this game.</p>';
      } else {
        h += '<div class="spanel"><div class="ptitle">Daily Specials</div><div class="pgrid">' + off.specials.map(offerCard).join('') + '</div>' +
          '<div class="refresh">Refresh in: <b>' + fmtHM(g.shopRefreshMs()) + '</b></div></div>' +
          '<div class="spanel"><div class="ptitle">Hot Sales</div><div class="pgrid">' + off.hot.map(offerCard).join('') + '</div></div>';
      }
      h += '</div><div class="shoptabs"><button class="stab' + (shopTab === 'gems' ? ' on' : '') + '" data-shoptab="gems" aria-label="Gems"><img src="art/items/gem_pair.webp" alt=""></button>' +
        '<button class="stab' + (shopTab === 'specials' ? ' on' : '') + '" data-shoptab="specials" aria-label="Specials"><img src="art/items/coffee_cup.webp" alt=""></button></div>';
      els.shop.innerHTML = h;
    }
    els.shop.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      const g = ui.game;
      if (b.dataset.shoptab) { ui.audio('tap'); shopTab = b.dataset.shoptab; renderShop(); const sc = $('screens'); if (sc) sc.scrollTop = 0; }
      else if (b.dataset.shopclose) { ui.audio('tap'); const t = ui.lastTab; ui.showTab(t && t !== 'shop' ? t : 'garden'); }
      else if (b.dataset.offer) ui.act(() => g.buyOffer(b.dataset.offer), 'claim');
    });

    // ---- Events -------------------------------------------------------------------------
    function wheelSVG() {
      const n = S.WHEEL.length, step = 360 / n, cx = 100, cy = 100, r = 92;
      const pt = (deg, rad) => { const a = deg * Math.PI / 180; return [cx + rad * Math.sin(a), cy - rad * Math.cos(a)]; };
      let segs = '';
      S.WHEEL.forEach((seg, i) => {
        const a0 = i * step, a1 = (i + 1) * step, p0 = pt(a0, r), p1 = pt(a1, r), mid = a0 + step / 2;
        segs += '<path d="M' + cx + ' ' + cy + ' L' + p0[0].toFixed(1) + ' ' + p0[1].toFixed(1) + ' A' + r + ' ' + r + ' 0 0 1 ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) + 'Z" fill="hsl(' + (i * 47 + 20) + ',60%,' + (i % 2 ? 84 : 76) + '%)" stroke="#fff" stroke-width="2"/>' +
          '<text x="100" y="36" text-anchor="middle" font-size="10" font-weight="700" fill="#33423a" transform="rotate(' + mid + ' 100 100)">' + seg.label + '</text>';
      });
      return '<div class="wheel-wrap"><div class="wheel-pin"></div><svg id="wheel" viewBox="0 0 200 200" style="transform:rotate(' + wheelRot + 'deg)">' + segs + '<circle cx="100" cy="100" r="14" fill="#fffaf0" stroke="#e4d6b8" stroke-width="3"/></svg></div>';
    }

    function renderEvents() {
      if (wheelBusy) return;
      const g = ui.game, s = g.s, d = s.daily;
      const tabs = [['rush', 'Kitchen Rush'], ['pass', 'Garden Pass'], ['festival', 'Festival'], ['wheel', 'Wheel']];
      let h = '<div class="win-head"><span>Events</span><button class="win-x" data-evclose="1" aria-label="Close">&times;</button></div><div class="chips">' + tabs.map((t) => '<button class="chip ' + (eventsTab === t[0] ? 'on' : '') + '" data-evtab="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>';
      if (eventsTab === 'rush') {
        const list = g.rushTasks(), left = g.shopRefreshMs(), hh = Math.floor(left / 3600000), mm = Math.floor((left % 3600000) / 60000);
        h += '<div class="card rush-head"><h3>Kitchen Rush</h3><p class="muted">Finish the day\'s tasks for rewards. New tasks in <b>' + hh + 'h ' + mm + 'm</b>.</p></div>';
        h += list.map((t) => '<div class="card row rush-row' + (t.claimed ? ' claimed' : '') + '"><div class="txt"><b>' + t.title + '</b>' + bar(t.n, t.goal) +
          '<small class="muted">' + t.n + '/' + t.goal + '</small> ' + rewardHTML(t.reward) + '</div>' +
          '<button class="btn ' + (t.claimed ? 'ghosty' : t.done ? 'alt' : '') + '" data-rush="' + t.i + '"' + (t.done && !t.claimed ? '' : ' disabled') + '>' + (t.claimed ? 'Done' : t.done ? 'Claim' : 'Go') + '</button></div>').join('');
        h += '<div class="card row rush-bonus"><div class="txt"><b>All tasks bonus</b><br>' + rewardHTML(G.RUSH_BONUS) + '</div><button class="btn ' + (s.rush.bonus ? 'ghosty' : 'alt') + '" data-rushbonus="1"' + (g.rushBonusReady() ? '' : ' disabled') + '>' + (s.rush.bonus ? 'Done' : 'Claim') + '</button></div>';
      } else if (eventsTab === 'pass') {
        const lv = g.passLevel(), P = S.PASS;
        h += '<div class="card"><h3>Garden Pass <small class="muted">level ' + lv + '/' + P.levels + '</small></h3>' + bar(g.passXpInLevel(), P.xpPer) +
          '<p class="muted">Earn xp by merging, serving orders and restoring the estate.</p>' +
          (s.pass.hasPremium ? '<p><b>Premium track unlocked</b></p>' : '<button class="btn alt" data-premium="1">' + icon('gem') + P.premiumGemCost + ' Unlock premium track</button>') + '</div>';
        h += '<div class="pass">' + Array.from({ length: P.levels }, (_, k) => k + 1).map((l) => {
          const cell = (track) => {
            const r = P.reward(l, track), claimed = s.pass[track][l], can = g.passClaimable(l, track), locked = l > lv || (track === 'premium' && !s.pass.hasPremium);
            return '<button class="pcell ' + track + (claimed ? ' claimed' : '') + (can ? ' can' : '') + '" data-pass="' + l + ':' + track + '"' + (can ? '' : ' disabled') + '>' + rewardHTML(r) + (claimed ? '<i class="tick">&#10003;</i>' : locked ? '<i class="lock">&#128274;</i>' : '') + '</button>';
          };
          return '<div class="prow ' + (l <= lv ? 'reached' : '') + '"><span class="lvn">' + l + '</span>' + cell('free') + cell('premium') + '</div>';
        }).join('') + '</div>';
      } else if (eventsTab === 'festival') {
        const E = S.EVENT, tk = s.event.tokens, top = E.milestones[E.milestones.length - 1].tokens;
        h += '<div class="card"><h3>' + E.name + '</h3><p class="muted">' + E.blurb + '</p>' + bar(tk, top) + '<b>' + tk + '</b> <span class="muted">blossoms</span></div>';
        h += E.milestones.map((m, i) => '<div class="card row"><div class="txt"><b>' + m.tokens + ' blossoms</b><br>' + rewardHTML(m.reward) + '</div><button class="btn ' + (s.event.claimed[i] ? 'ghosty' : '') + '" data-evclaim="' + i + '"' + (g.eventClaimable(i) ? '' : ' disabled') + '>' + (s.event.claimed[i] ? 'Done' : tk >= m.tokens ? 'Claim' : 'Locked') + '</button></div>').join('');
      } else {
        h += '<div class="card center"><h3>Lucky wheel</h3>' + wheelSVG() + '<button class="btn alt big" data-spin="1">' + (g.freeSpinReady() ? 'Free spin!' : 'Spin (' + s.spins + ' tickets)') + '</button>' +
          '<p class="muted">One free spin a day. Extra tickets come from the Garden Pass.</p></div>';
      }
      els.events.innerHTML = h;
    }

    els.events.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      const g = ui.game;
      if (b.dataset.evtab) { eventsTab = b.dataset.evtab; renderEvents(); return; }
      if (b.dataset.evclose) { ui.audio('tap'); const t = ui.lastTab; ui.showTab(t && t !== 'events' ? t : 'garden'); return; }
      if (b.dataset.rush) { ui.act(() => g.claimRush(+b.dataset.rush), 'claim'); return; }
      if (b.dataset.rushbonus) { ui.act(() => g.claimRushBonus(), 'claim'); return; }
      if (b.dataset.premium) ui.act(() => g.buyPremium(), 'unlock');
      else if (b.dataset.pass) { const [l, tr] = b.dataset.pass.split(':'); ui.act(() => g.claimPass(+l, tr), 'claim'); }
      else if (b.dataset.evclaim) ui.act(() => g.claimEvent(+b.dataset.evclaim), 'claim');
      else if (b.dataset.spin) spin();
    });

    function spin() {
      const g = ui.game;
      if (wheelBusy) return;
      const r = g.spinWheel();
      if (!r.ok) { ui.toast(r.msg); ui.audio('error'); return; }
      wheelBusy = true; ui.audio('spin');
      const step = 360 / S.WHEEL.length, base = Math.ceil(wheelRot / 360) * 360;
      wheelRot = base + 360 * 5 + (360 - (r.index * step + step / 2));
      const w = document.getElementById('wheel');
      w.style.transition = 'transform 3.2s cubic-bezier(.12,.7,.15,1)';
      requestAnimationFrame(() => { w.style.transform = 'rotate(' + wheelRot + 'deg)'; });
      setTimeout(() => { wheelBusy = false; ui.save(); ui.audio('claim'); ui.toast(r.seg.label + '! ' + r.msg); ui.render(); }, 3400);
    }

    function render(tab) {
      if (tab === 'estate') renderEstate();
      else if (tab === 'shop') renderShop();
      else if (tab === 'events') renderEvents();
    }

    return { render, playScene, openProfile, openReviews };
  }

  G.makeScreens = makeScreens;
})(typeof globalThis !== 'undefined' ? globalThis : this);
