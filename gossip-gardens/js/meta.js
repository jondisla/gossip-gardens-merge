/* Gossip Gardens - meta systems layered on the core engine (pure logic, no DOM).
 * Estate restoration, chores, day streak, shop, pass, event, wheel.
 */
(function (root) {
  'use strict';
  const G = root.GG;
  const { Game, TUNING: T } = G;
  const S = G.STORY;
  const P = Game.prototype;
  const N = T.cols * T.rows;

  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (t) => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };

  const baseFillDefaults = Game.fillDefaults;
  Game.fillDefaults = function (s) {
    baseFillDefaults(s);
    s.starsSpent = s.starsSpent || 0;
    s.freeTapUntil = s.freeTapUntil || 0;
    s.spins = s.spins || 0;
    s.stats = Object.assign({ merges: 0, served: 0, taps: 0, collected: 0, gifts: 0 }, s.stats || {});
    s.estate = Object.assign({ done: {}, seen: {}, finish: {} }, s.estate || {});
    { const had = !!s.tut; s.tut = Object.assign({ seen: {}, off: false }, s.tut || {});
      if (!had && (s.stats.merges || 0) >= 15) s.tut.off = true; }   // players who are already well into the game skip the tutorial
    s.happy = s.happy || 0;                                   // customers served towards the next happy-meter bonus
    s.chest = Object.assign({ readyAt: 0 }, s.chest || {});   // the free chest that refills every couple of hours
    s.starter = !!s.starter;                                  // the one-time starter bonus has been claimed
    s.chores = Object.assign({ done: 0 }, s.chores || {});
    // Chores and repairs are one list now: finishing chore N completes repair N. Bring older saves in line.
    { let n = Math.max(s.chores.done, 0); while (n < S.TASKS.length && s.estate.done[S.TASKS[n].id]) n++;
      n = Math.min(n, S.CHORES.length, S.TASKS.length);
      for (let i = 0; i < n; i++) s.estate.done[S.TASKS[i].id] = true;
      s.chores.done = n; }
    s.startedAt = s.startedAt || Date.now();   // new games set this from their own clock
    s.ev = Object.assign({ frenzy: { c: -1, flames: 0 }, goals: { c: -1, n: {}, days: {}, claimed: {}, mClaimed: {}, points: 0 } }, s.ev || {});
    s.starterStage = s.starterStage != null ? s.starterStage : (s.starter ? 1 : 0);
    s.rush = Object.assign({ key: '', n: { energy: 0, order: 0, merge: 0, gold: 0 }, claimed: {}, bonus: false }, s.rush || {});
    s.daily = Object.assign({ key: '', streak: 0, lastCheckin: '', checkedToday: false }, s.daily || {});
    s.shop = Object.assign({ key: '', bought: {} }, s.shop || {});
    s.pass = Object.assign({ xp: 0, free: {}, premium: {}, hasPremium: false }, s.pass || {});
    s.event = Object.assign({ tokens: 0, claimed: {} }, s.event || {});
    s.wheel = Object.assign({ lastFree: '' }, s.wheel || {});
    s.settings = Object.assign({ sound: true, music: true }, s.settings || {});
    s.xp = s.xp || 0;
    s.profile = Object.assign({ name: '', id: '', avatar: 'you', frame: 0 }, s.profile || {});
    if (!s.profile.id) { let id = ''; for (let i = 0; i < 8; i++) id += 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]; s.profile.id = id; }
    if (!s.profile.name) s.profile.name = 'Player' + s.profile.id;
    s.boost = Object.assign({ unlocked: false, mode: 0 }, s.boost || {});
    s.refill = Object.assign({ n: 0 }, s.refill || {});
    s.storageSlots = s.storageSlots || T.storageStart;
    s.storage = Array.isArray(s.storage) ? s.storage : [];
    while (s.storage.length < s.storageSlots) s.storage.push(null);
    if (!s.boost.unlocked && (s.merges || 0) >= T.boosterUnlockMerges) s.boost.unlocked = true;
    return s;
  };

  // ---- engagement extras: happy meter, free chest, starter bonus, repair finishes ----------------
  const HAPPY_GOAL = 6, HAPPY_REWARD = { coins: 40, gems: 1, energy: 10 };
  const CHEST_MS = 2 * 60 * 60 * 1000;
  const STARTER_REWARD = { coins: 100, gems: 10, energy: 30, gift: 1 };
  G.HAPPY_GOAL = HAPPY_GOAL; G.HAPPY_REWARD = HAPPY_REWARD; G.CHEST_MS = CHEST_MS; G.STARTER_REWARD = STARTER_REWARD;
  P.happyProgress = function () { return { n: this.s.happy || 0, goal: HAPPY_GOAL }; };
  P.chestMsLeft = function () { return Math.max(0, this.s.chest.readyAt - this.clock()); };
  P.chestReady = function () { return this.chestMsLeft() === 0; };
  /** What the chest holds this time: coins, energy or a gift on the board (a different one each time, scaled by level). */
  P.chestReward = function () {
    const L = this.level(), k = this.s.chest.opened || 0;
    return [{ coins: 30 + 10 * L }, { energy: 15 }, { gift: 1 }, { coins: 20 + 5 * L, gems: 1 }][k % 4];
  };
  P.openChest = function () {
    if (!this.chestReady()) return { ok: false, msg: 'The chest is still filling up.' };
    const r = this.chestReward();
    this.s.chest.opened = (this.s.chest.opened || 0) + 1;
    this.s.chest.readyAt = this.clock() + CHEST_MS;
    return { ok: true, reward: r, msg: 'Free chest: ' + this.grant(r) };
  };
  // The starter bonus is a chain of gifts: the first is yours at once, the rest open as you reach higher player levels.
  const STARTER_STAGES = [
    { lv: 1,  reward: STARTER_REWARD },
    { lv: 5,  reward: { coins: 150, gems: 15, gift: 2 } },
    { lv: 10, reward: { gems: 25, energy: 60, tool: 'dust' } },
    { lv: 15, reward: { coins: 400, gems: 30, gift: 3 } },
  ];
  G.STARTER_STAGES = STARTER_STAGES;
  P.starterNext = function () { return STARTER_STAGES[this.s.starterStage] || null; };
  P.starterReady = function () { const n = this.starterNext(); return !!n && this.level() >= n.lv; };
  P.claimStarter = function () {
    const n = this.starterNext();
    if (!n) return { ok: false, msg: 'Already claimed.' };
    if (this.level() < n.lv) return { ok: false, msg: 'Upgrade to level ' + n.lv + ' to unlock the next reward.' };
    this.s.starterStage += 1; this.s.starter = true;
    return { ok: true, reward: n.reward, msg: 'Starter bonus: ' + this.grant(n.reward) };
  };
  /** A repair's finish is a colour shift in degrees (0 = classic colours). Purely a look. */
  P.finishOf = function (id) { return (this.s.estate.finish && this.s.estate.finish[id]) || 0; };
  P.setFinish = function (id, n) {
    if (!this.s.estate.done[id] || !Number.isInteger(n) || Math.abs(n) > 360) return { ok: false };
    this.s.estate.finish[id] = n;
    return { ok: true };
  };

  // ---- player level rewards ---------------------------------------------------
  /** What reaching level L pays: gems and coins every level, plus a gift on the board every third level. */
  P.levelReward = function (L) {
    const r = { gems: T.levelUpGems, coins: 10 * L };
    if (L % 6 === 0) r.gift = 2; else if (L % 3 === 0) r.gift = 1;
    return r;
  };

  // ---- rewards ------------------------------------------------------------
  /** Apply a reward object. Returns a short text summary. */
  P.grant = function (r) {
    const s = this.s, parts = [];
    if (!r) return '';
    if (r.coins) { s.coins += r.coins; parts.push('+' + r.coins + ' coins'); }
    if (r.gems) { s.gems += r.gems; parts.push('+' + r.gems + ' gems'); }
    if (r.energy) { this.addEnergy(r.energy); parts.push('+' + r.energy + ' energy'); }
    if (r.spins) { s.spins += r.spins; parts.push('+' + r.spins + ' spin'); }
    if (r.xp) { this.addXp(r.xp); parts.push('+' + r.xp + ' xp'); }
    if (r.freeTapMs) { s.freeTapUntil = Math.max(this.clock(), s.freeTapUntil) + r.freeTapMs; parts.push('free taps'); }
    const center = Math.floor(T.rows / 2) * T.cols + Math.floor(T.cols / 2);
    if (r.gift) {
      const j = this.place(this.mk('gift', r.gift), center);
      if (j >= 0) parts.push('gift on board');
      else { s.coins += 20 * r.gift; parts.push('+' + 20 * r.gift + ' coins (board full)'); }
    }
    if (r.tool) {
      const j = this.place(this.mk(r.tool, r.toolLevel || 1), center);
      if (j >= 0) parts.push(G.itemName(r.tool, r.toolLevel || 1) + ' on board');
      else { s.coins += 30; parts.push('+30 coins (board full)'); }
    }
    return parts.join(', ');
  };

  // ---- time and daily reset ---------------------------------------------------
  P.today = function () { return dayKey(this.clock()); };

  // ---- Timed events: each one repeats on a cycle counted from the day the game was started -----------------
  const DAY = 86400000, HOUR = 3600000;
  const EV = {
    frenzy: { name: 'Flaming Frenzy', cycle: 2 * DAY, duration: 12 * HOUR },
    goals:  { name: 'Manor Goals',    cycle: 7 * DAY, duration: 7 * DAY },
  };
  const FRENZY_TIERS = [{ flames: 150, mult: 1.25, name: 'Silver cloche' }, { flames: 400, mult: 1.5, name: 'Gold cloche' }, { flames: 800, mult: 2, name: 'Royal cloche' }];
  const GOAL_TASKS = [
    { id: 'login',  title: 'Play on 7 different days', goal: 7,    points: 150 },
    { id: 'review', title: 'Collect 25 good reviews',  goal: 25,   points: 200 },
    { id: 'gold',   title: 'Earn 1500 coins',          goal: 1500, points: 250 },
    { id: 'tool',   title: 'Use tools 10 times',       goal: 10,   points: 150 },
    { id: 'serve',  title: 'Serve 25 customers',       goal: 25,   points: 305 },
  ];
  const GOAL_MILESTONES = [
    { points: 150,  reward: { energy: 100 } }, { points: 350, reward: { gift: 2 } }, { points: 600, reward: { energy: 150 } },
    { points: 850,  reward: { gift: 3, coins: 150 } }, { points: 1055, reward: { gems: 15, tool: 'dust' } },
  ];
  G.EV = EV; G.FRENZY_TIERS = FRENZY_TIERS; G.GOAL_TASKS = GOAL_TASKS; G.GOAL_MILESTONES = GOAL_MILESTONES;
  /** Where an event is in its cycle: {active, c (cycle number), left (ms until it ends, or until it starts again)}. */
  P.evInfo = function (id) {
    const e = EV[id], t = Math.max(0, this.clock() - this.s.startedAt), c = Math.floor(t / e.cycle), ph = t - c * e.cycle;
    return ph < e.duration ? { active: true, c, left: e.duration - ph } : { active: false, c, left: e.cycle - ph };
  };
  /** Start fresh counters when a new cycle begins; note today as a day played. Cheap, called often. */
  P.evSync = function () {
    const s = this.s, fz = this.evInfo('frenzy'), go = this.evInfo('goals');
    if (s.ev.frenzy.c !== fz.c) s.ev.frenzy = { c: fz.c, flames: 0 };
    if (s.ev.goals.c !== go.c) s.ev.goals = { c: go.c, n: {}, days: {}, claimed: {}, mClaimed: {}, points: 0 };
    const day = Math.floor((this.clock() - s.startedAt) / DAY);
    if (!s.ev.goals.days[day]) s.ev.goals.days[day] = 1;
  };
  P.frenzyTier = function () {
    this.evSync();
    if (!this.evInfo('frenzy').active) return -1;
    let t = -1; FRENZY_TIERS.forEach((x, i) => { if (this.s.ev.frenzy.flames >= x.flames) t = i; });
    return t;
  };
  P.frenzyMult = function () { const t = this.frenzyTier(); return t < 0 ? 1 : FRENZY_TIERS[t].mult; };
  P.goalCount = function (id) {
    this.evSync(); const g = this.s.ev.goals;
    return id === 'login' ? Object.keys(g.days).length : (g.n[id] || 0);
  };
  P.goalTasks = function () {
    this.evSync(); const g = this.s.ev.goals;
    return GOAL_TASKS.map((t) => { const n = Math.min(this.goalCount(t.id), t.goal); return Object.assign({}, t, { n, done: n >= t.goal, claimed: !!g.claimed[t.id] }); });
  };
  P.claimGoal = function (id) {
    const t = this.goalTasks().find((x) => x.id === id);
    if (!t || !t.done || t.claimed) return { ok: false };
    this.s.ev.goals.claimed[id] = true; this.s.ev.goals.points += t.points;
    return { ok: true, msg: '+' + t.points + ' goal points' };
  };
  P.goalMilestoneReady = function (i) { const g = this.s.ev.goals; return !g.mClaimed[i] && g.points >= GOAL_MILESTONES[i].points; };
  P.claimGoalMilestone = function (i) {
    if (!this.goalMilestoneReady(i)) return { ok: false };
    this.s.ev.goals.mClaimed[i] = true;
    return { ok: true, msg: this.grant(GOAL_MILESTONES[i].reward) };
  };
  P.goalsClaimable = function () {
    if (!this.evInfo('goals').active) return false;
    return this.goalTasks().some((t) => t.done && !t.claimed) || GOAL_MILESTONES.some((_, i) => this.goalMilestoneReady(i));
  };
  P.evCount = function (id, n) { this.evSync(); const g = this.s.ev.goals; g.n[id] = (g.n[id] || 0) + n; };

  // ---- Kitchen Rush: four small daily tasks and a bonus for finishing them all ------------------------
  const RUSH_KINDS = {
    energy: { title: (n) => 'Use ' + n + ' energy', goals: [20, 30, 40], reward: (i) => ({ coins: 30 + 10 * i }) },
    order:  { title: (n) => 'Serve ' + n + ' customers', goals: [3, 4, 5], reward: (i) => ({ energy: 8 + 3 * i }) },
    merge:  { title: (n) => 'Merge ' + n + ' times', goals: [15, 25, 35], reward: (i) => ({ coins: 25 + 10 * i }) },
    gold:   { title: (n) => 'Earn ' + n + ' coins', goals: [60, 100, 150], reward: (i) => ({ gems: 1 + (i > 1 ? 1 : 0) }) },
  };
  G.RUSH_KINDS = RUSH_KINDS; G.RUSH_BONUS = { gems: 3, coins: 50 };
  P.rushTasks = function () {
    const r = this.s.rush, k = this.today();
    if (r.key !== k) {                                   // a new day: fresh counters and a new difficulty for each task
      let h = 0; for (const ch of k) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      r.key = k; r.n = { energy: 0, order: 0, merge: 0, gold: 0 }; r.claimed = {}; r.bonus = false;
      r.pick = Object.keys(RUSH_KINDS).map((kind, j) => ({ kind, tier: (h >>> (j * 3)) % 3 }));
    }
    if (!r.pick) r.pick = Object.keys(RUSH_KINDS).map((kind) => ({ kind, tier: 0 }));
    return r.pick.map((p, i) => {
      const def = RUSH_KINDS[p.kind], goal = def.goals[p.tier], n = Math.min(r.n[p.kind] || 0, goal);
      return { i, kind: p.kind, title: def.title(goal), goal, n, done: n >= goal, claimed: !!r.claimed[i], reward: def.reward(p.tier) };
    });
  };
  P.claimRush = function (i) {
    const t = this.rushTasks()[i];
    if (!t || !t.done || t.claimed) return { ok: false };
    this.s.rush.claimed[i] = true;
    return { ok: true, msg: this.grant(t.reward) };
  };
  P.rushBonusReady = function () { const l = this.rushTasks(); return !this.s.rush.bonus && l.every((t) => t.claimed); };
  P.claimRushBonus = function () {
    if (!this.rushBonusReady()) return { ok: false };
    this.s.rush.bonus = true;
    return { ok: true, msg: this.grant(G.RUSH_BONUS) };
  };
  P.rushClaimable = function () { return this.rushTasks().some((t) => t.done && !t.claimed) || this.rushBonusReady(); };
  P.rushCount = function (kind, n) { const r = this.s.rush; this.rushTasks(); r.n[kind] = (r.n[kind] || 0) + n; };

  P.rollover = function () {
    const d = this.s.daily, k = this.today();
    if (d.key === k) return false;
    d.key = k; d.checkedToday = false;
    this.s.refill.n = 0; // the first energy refill of the day is free again
    return true;
  };

  // ---- calendar and free gift --------------------------------------------------
  P.nextCheckinDay = function () {
    const d = this.s.daily, y = dayKey(this.clock() - 86400000);
    const streak = d.lastCheckin === y || d.checkedToday ? d.streak : 0;
    return d.checkedToday ? (streak - 1) % 7 : streak % 7; // index of the reward for the next/just-claimed day
  };
  P.checkin = function () {
    const d = this.s.daily;
    if (d.checkedToday) return { ok: false, msg: 'Already checked in today.' };
    const y = dayKey(this.clock() - 86400000);
    d.streak = d.lastCheckin === y ? d.streak + 1 : 1;
    d.lastCheckin = this.today(); d.checkedToday = true;
    const reward = S.CALENDAR[(d.streak - 1) % 7];
    return { ok: true, msg: this.grant(reward) };
  };

  // ---- event hook: progress from gameplay ---------------------------------------
  P.addXp = function (n) { const s = this.s; s.pass.xp = Math.min(S.PASS.levels * S.PASS.xpPer, s.pass.xp + n); };
  P.addTokens = function (n) { this.s.event.tokens += n; };

  P.onEvent = function (type, data) {
    const st = this.s.stats;
    if (type === 'merge') {
      this.rushCount('merge', 1);
      st.merges++; this.addXp(1 + (data.level >= 4 ? 2 : 0)); this.addPlayerXp(1 + (data.level >= 4 ? 3 : 0));
      if (data.level >= 5) this.addTokens(2);
    } else if (type === 'coins') {
      this.rushCount('gold', data.n); this.evCount('gold', data.n);
      this.evSync(); if (this.evInfo('frenzy').active) this.s.ev.frenzy.flames += data.n;      // one coin = one flame
    } else if (type === 'tool') {
      this.evCount('tool', 1);
    } else if (type === 'energy') {
      this.rushCount('energy', data.n);
    } else if (type === 'serve') {
      this.rushCount('order', 1); this.evCount('serve', 1); if (data.order.reward && data.order.reward.smile) this.evCount('review', 1);
      st.served++; this.addXp(20); this.addPlayerXp(12 + 6 * data.order.wants.length);
      if (data.order.reward && data.order.reward.smile) this.s.happy = (this.s.happy || 0) + 1;   // only orders that pay a review count
      if (this.s.happy >= HAPPY_GOAL) { this.s.happy = 0; this.note('Happy customers! ' + this.grant(HAPPY_REWARD)); }
      let tk = 3; for (const w of data.order.wants) if (w.level >= 4) tk++;
      this.addTokens(tk);
    } else if (type === 'tap') {
      st.taps++;
    } else if (type === 'collect') {
      st.collected++;
    } else if (type === 'gift') {
      st.gifts++; this.addXp(5); this.addPlayerXp(3);
    }
  };

  // ---- shop: Daily Specials and Hot Sales, paid in gems (no real-money purchasing) ---------------
  P.shopRoll = function () { const sh = this.s.shop, k = this.today(); if (sh.key !== k) { sh.key = k; sh.bought = {}; } return sh; };
  P.shopRefreshMs = function () { const now = this.clock(), d = new Date(now); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - now; };
  P.shopFreeReady = function () { return !this.shopRoll().bought.sp_free; };
  P.shopOffers = function () {
    const sh = this.shopRoll();
    const specials = [
      { id: 'sp_piggy', gems: 25, stock: 1, item: { chain: 'coin', level: 4 } },
      { id: 'sp_energy', gems: 10, stock: 1, give: { energy: 50 }, art: 'bolt' },
      { id: 'sp_free', gems: 0, stock: 1, give: { gift: 2 }, art: 'gift' },
    ];
    const pool = this.chainPool(), day = Math.floor(this.clock() / 86400000);
    const hot = [1, 2, 3, 3, 4, 6].map((lv, k) => ({
      id: 'hot' + k, gems: S.HOT_PRICE[lv - 1], stock: k === 5 ? 1 : 5, rare: k === 5, item: { chain: pool[(day + k) % pool.length], level: lv },
    }));
    const all = specials.concat(hot);
    all.forEach((o) => { o.left = Math.max(0, o.stock - (sh.bought[o.id] || 0)); });
    return { specials: all.slice(0, 3), hot: all.slice(3) };
  };
  P.buyOffer = function (id) {
    const offers = this.shopOffers(), o = offers.specials.concat(offers.hot).find((x) => x.id === id), s = this.s;
    if (!o) return { ok: false };
    if (o.left < 1) return { ok: false, msg: 'Sold out for today.' };
    if (s.gems < o.gems) return { ok: false, msg: 'Not enough gems.', needGems: true };
    if (o.item && this.emptyCount() < 1) return { ok: false, msg: 'Board is full. Make some room first.' };
    s.gems -= o.gems;
    const sh = this.shopRoll(); sh.bought[id] = (sh.bought[id] || 0) + 1;
    if (o.item) { this.place(this.mk(o.item.chain, o.item.level), 0); return { ok: true, msg: 'Added to your board.' }; }
    return { ok: true, msg: this.grant(o.give) };
  };

  // ---- garden pass ----------------------------------------------------------------
  P.passLevel = function () { return Math.min(S.PASS.levels, Math.floor(this.s.pass.xp / S.PASS.xpPer)); };
  P.passXpInLevel = function () { return this.passLevel() >= S.PASS.levels ? S.PASS.xpPer : this.s.pass.xp % S.PASS.xpPer; };
  P.passClaimable = function (level, track) {
    const p = this.s.pass;
    return level <= this.passLevel() && !p[track][level] && (track === 'free' || p.hasPremium);
  };
  P.claimPass = function (level, track) {
    if (!this.passClaimable(level, track)) return { ok: false, msg: track === 'premium' && !this.s.pass.hasPremium ? 'Unlock the premium track first.' : '' };
    this.s.pass[track][level] = true;
    return { ok: true, msg: this.grant(S.PASS.reward(level, track)) };
  };
  P.buyPremium = function () {
    const s = this.s;
    if (s.pass.hasPremium) return { ok: false, msg: 'Already unlocked.' };
    if (s.gems < S.PASS.premiumGemCost) return { ok: false, msg: 'Need ' + S.PASS.premiumGemCost + ' gems.', needGems: true };
    s.gems -= S.PASS.premiumGemCost; s.pass.hasPremium = true;
    return { ok: true, msg: 'Premium track unlocked!' };
  };

  // ---- festival event ----------------------------------------------------------------
  P.eventClaimable = function (i) { const m = S.EVENT.milestones[i]; return !!m && this.s.event.tokens >= m.tokens && !this.s.event.claimed[i]; };
  P.claimEvent = function (i) {
    if (!this.eventClaimable(i)) return { ok: false };
    this.s.event.claimed[i] = true;
    return { ok: true, msg: this.grant(S.EVENT.milestones[i].reward) };
  };

  // ---- lucky wheel ----------------------------------------------------------------------
  P.freeSpinReady = function () { return this.s.wheel.lastFree !== this.today(); };
  P.spinWheel = function () {
    const s = this.s;
    if (this.freeSpinReady()) s.wheel.lastFree = this.today();
    else if (s.spins > 0) s.spins--;
    else return { ok: false, msg: 'No spins left. Earn tickets from tasks and the pass.' };
    const idx = this.pickWeighted(S.WHEEL.map((seg, i) => [i, seg.w]));
    const seg = S.WHEEL[idx];
    return { ok: true, index: idx, seg, msg: this.grant(seg.reward) };
  };

  // ---- estate -------------------------------------------------------------------------------
  P.starsAvailable = function () { return this.s.stars - this.s.starsSpent; };
  P.tasksOf = function (area) { return S.TASKS.filter((t) => t.area === area); };
  P.areaUnlocked = function (a) { return a === 0 || this.tasksOf(a - 1).every((t) => this.s.estate.done[t.id]); };
  /** A "view" is one zoomed spot of an area: 6 repairs. There are 2 views per area. */
  P.tasksOfView = function (v) { const w = S.VIEWS[v]; return S.TASKS.filter((t) => t.area === w.area && t.spot === w.spot); };
  P.viewProgress = function (v) { const ts = this.tasksOfView(v); return { done: ts.filter((t) => this.s.estate.done[t.id]).length, total: ts.length }; };
  P.viewUnlocked = function (v) { return v === 0 || this.tasksOfView(v - 1).every((t) => this.s.estate.done[t.id]); };
  /** The view the player is working in: the first one that still has an unfinished repair. */
  P.currentView = function () { for (let v = 0; v < S.VIEWS.length; v++) if (this.viewProgress(v).done < this.tasksOfView(v).length) return v; return S.VIEWS.length - 1; };
  P.viewOf = function (taskId) { const t = S.TASKS.find((x) => x.id === taskId); return S.VIEWS.findIndex((w) => w.area === t.area && w.spot === t.spot); };
  P.areaProgress = function (a) { const ts = this.tasksOf(a); return { done: ts.filter((t) => this.s.estate.done[t.id]).length, total: ts.length }; };
  /** Repairs and chores are one list: the next repair is open, and paying its chore completes it. */
  P.unlockedRepairs = function () { return Math.min(S.TASKS.length, this.s.chores.done + 1); };
  P.taskState = function (t) {
    if (this.s.estate.done[t.id]) return 'done';
    if (S.TASKS.indexOf(t) === this.s.chores.done && this.areaUnlocked(t.area)) return 'available';
    return 'locked';
  };
  P.markSeen = function (sceneId) { this.s.estate.seen[sceneId] = true; };
  P.estateProgress = function () { const done = S.TASKS.filter((t) => this.s.estate.done[t.id]).length; return { done, total: S.TASKS.length }; };

  // ---- chores and the day bar ------------------------------------------------------------------
  P.currentChore = function () { return S.CHORES[this.s.chores.done] || null; };
  /** Doing a chore pays its coins, gives player XP and completes the matching repair in the same step. */
  P.completeChore = function () {
    const c = this.currentChore(), s = this.s, task = S.TASKS[s.chores.done];
    if (!c || !task) return { ok: false, msg: 'All chores are done.' };
    if (s.coins < c.cost) return { ok: false, msg: 'This chore costs ' + c.cost + ' coins.' };
    s.coins -= c.cost; s.chores.done += 1; s.estate.done[task.id] = true;
    this.addXp(25); this.addPlayerXp(c.xp);
    // The bar along the bottom fills one step per chore; the bubbles on steps 3, 5 and 7 pay out when reached.
    const step = this.choreBar().filled, bonus = (step === 3 || step === 5 || step === 7) ? this.grant(S.CALENDAR[step - 1]) : '';
    const next = S.TASKS[s.chores.done];
    return { ok: true, scene: task.id, task: task.id, bonus,
      msg: task.name + ' restored! +' + c.xp + ' XP.' + (bonus ? ' Bonus: ' + bonus + '.' : '') + (next ? ' Next repair: ' + next.name + '.' : '') };
  };
  /** True when there is a chore to do but the player cannot pay for it yet (drives the "go back and earn coins" arrow). */
  P.choreShort = function () { const c = this.currentChore(); return !!c && this.s.coins < c.cost; };
  /** The bar along the bottom of the chores popup: seven steps per level, one filled for every chore done. */
  P.choreBar = function () {
    const n = this.s.chores.done;
    return { level: n === 0 ? 1 : Math.floor((n - 1) / 7) + 1, filled: n === 0 ? 0 : ((n - 1) % 7) + 1 };
  };
  /** The day streak shown along the bottom of the Estate: which day it is and how many segments are filled. */
  P.dayBar = function () {
    const d = this.s.daily, idx = this.nextCheckinDay();
    return { day: idx + 1, filled: d.checkedToday ? idx + 1 : idx, claimed: !!d.checkedToday };
  };

  // ---- badges for the UI ----------------------------------------------------------------------------
  P.badges = function () {
    const s = this.s, d = s.daily;
    const ch0 = this.currentChore(), estate = !!(ch0 && s.coins >= ch0.cost) || this.chestReady() || this.starterReady();
    const shop = this.shopFreeReady();
    const events = this.goalsClaimable() || this.rushClaimable() || this.freeSpinReady() || S.EVENT.milestones.some((m, i) => this.eventClaimable(i)) ||
      (() => { for (let l = 1; l <= this.passLevel(); l++) if (this.passClaimable(l, 'free') || this.passClaimable(l, 'premium')) return true; return false; })();
    const ch = this.currentChore();
    return { estate, shop: shop && !this.featureLocked('shop'), events: events && !this.featureLocked('events'), chores: !!(ch && s.coins >= ch.cost) };
  };

  G.dayKey = dayKey;
  void N;
})(typeof globalThis !== 'undefined' ? globalThis : this);
