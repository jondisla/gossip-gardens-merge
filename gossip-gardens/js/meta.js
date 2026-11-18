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
    s.happy = s.happy || 0;                                   // customers served towards the next happy-meter bonus
    s.chest = Object.assign({ readyAt: 0 }, s.chest || {});   // the free chest that refills every couple of hours
    s.starter = !!s.starter;                                  // the one-time starter bonus has been claimed
    s.chores = Object.assign({ done: 0 }, s.chores || {});
    // Chores and repairs are one list now: finishing chore N completes repair N. Bring older saves in line.
    { let n = Math.max(s.chores.done, 0); while (n < S.TASKS.length && s.estate.done[S.TASKS[n].id]) n++;
      n = Math.min(n, S.CHORES.length, S.TASKS.length);
      for (let i = 0; i < n; i++) s.estate.done[S.TASKS[i].id] = true;
      s.chores.done = n; }
    s.daily = Object.assign({ key: '', streak: 0, lastCheckin: '', checkedToday: false }, s.daily || {});
    s.shop = Object.assign({ key: '', bought: {} }, s.shop || {});
    s.pass = Object.assign({ xp: 0, free: {}, premium: {}, hasPremium: false }, s.pass || {});
    s.event = Object.assign({ tokens: 0, claimed: {} }, s.event || {});
    s.wheel = Object.assign({ lastFree: '' }, s.wheel || {});
    s.settings = Object.assign({ sound: true }, s.settings || {});
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
  P.starterReady = function () { return !this.s.starter; };
  P.claimStarter = function () {
    if (this.s.starter) return { ok: false, msg: 'Already claimed.' };
    this.s.starter = true;
    return { ok: true, reward: STARTER_REWARD, msg: 'Starter bonus: ' + this.grant(STARTER_REWARD) };
  };
  /** Each repair can be finished one of two ways (0 = classic, 1 = twilight). Purely a look. */
  P.finishOf = function (id) { return (this.s.estate.finish && this.s.estate.finish[id]) || 0; };
  P.setFinish = function (id, n) {
    if (!this.s.estate.done[id] || (n !== 0 && n !== 1)) return { ok: false };
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
      st.merges++; this.addXp(1 + (data.level >= 4 ? 2 : 0)); this.addPlayerXp(1 + (data.level >= 4 ? 3 : 0));
      if (data.level >= 5) this.addTokens(2);
    } else if (type === 'serve') {
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
    const events = this.freeSpinReady() || S.EVENT.milestones.some((m, i) => this.eventClaimable(i)) ||
      (() => { for (let l = 1; l <= this.passLevel(); l++) if (this.passClaimable(l, 'free') || this.passClaimable(l, 'premium')) return true; return false; })();
    const ch = this.currentChore();
    return { estate, shop, events, chores: !!(ch && s.coins >= ch.cost) };
  };

  G.dayKey = dayKey;
  void N;
})(typeof globalThis !== 'undefined' ? globalThis : this);
