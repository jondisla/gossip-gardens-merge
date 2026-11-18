/* Gossip Gardens - core game engine. Pure logic, no DOM. Testable in Node. */
(function (root) {
  'use strict';
  const G = root.GG;
  const { CHAINS, TUNING: T, INGREDIENT_CHAINS, CHAIN_UNLOCK, maxLevel, itemName } = G;
  const WEB_MSG = 'Stuck in a cobweb! Merge a matching item into it, or next to it, to free it.';
  const N = T.cols * T.rows;
  const CENTER = Math.floor(T.rows / 2) * T.cols + Math.floor(T.cols / 2);

  const genMaxCharges = (level) => T.genChargesBase + T.genChargesPerLevel * (level - 1);
  const isBubble = (c) => !!(c && c.bubbleUntil);
  const roleOf = (c) => CHAINS[c.chain].role;
  const xpForLevel = (L) => 25 * L * (L - 1);

  class Game {
    constructor(state, clock) {
      this.clock = clock || (() => Date.now());
      this.s = state || Game.newState(this.clock());
      this.fx = [];     // visual events for the UI: {type, i}
      this.notes = [];  // short messages for the UI to toast (level up, unlocks...)
    }

    static newState(now, seed) {
      const s = {
        v: 3,
        cells: new Array(N).fill(null),
        energy: T.energyMax, energyAt: now,
        coins: T.startCoins, gems: T.startGems,
        stars: 0, merges: 0, served: 0, xp: 0,
        orders: [], nextOrderId: 1,
        rng: ((seed == null ? now : seed) >>> 0),
      };
      Game.fillDefaults(s);
      const g = new Game(s, () => now);
      const put = (r, c, chain, level) => { s.cells[r * T.cols + c] = g.mk(chain, level); };
      // Few machines to start with; more arrive with player level, and sometimes drop out of gifts.
      put(0, 2, 'gen_seed', 1); put(0, 4, 'gen_leaf', 1);
      put(1, 3, 'gen_vine', 1);
      put(3, 1, 'seed', 1); put(3, 2, 'seed', 1); put(3, 4, 'leaf', 1); put(3, 5, 'leaf', 1);
      put(4, 2, 'seed', 1); put(4, 3, 'seed', 1); put(4, 4, 'leaf', 1); put(4, 5, 'leaf', 1);
      put(5, 3, 'gift', 1); put(5, 1, 'scissors', 1); put(5, 5, 'dust', 1);
      g.scatterBoard();
      for (let k = 0; k < T.orderSlots; k++) g.addOrder();
      g.rollover();
      return s;
    }

    /** Scatter energy-sand, merge-to-clear sand and cobwebbed items over the free cells of a new board. */
    scatterBoard() {
      const s = this.s, cols = T.cols, core = this.chainPool();
      const free = [];
      for (let i = 0; i < N; i++) { const r = Math.floor(i / cols); if (r !== 0 && r !== 2 && !s.cells[i]) free.push(i); }
      const take = () => free.splice(Math.floor(this.rnd() * free.length), 1)[0];
      const prizeOf = (table) => {
        const pick = this.pickWeighted(table);
        if (!pick) return undefined;
        if (pick[0] === 'gen') return { chain: 'gen_' + core[Math.floor(this.rnd() * core.length)], level: 1 };
        return pick[0] === 'core' ? { chain: core[Math.floor(this.rnd() * core.length)], level: pick[1] } : { chain: pick[0], level: pick[1] };
      };
      for (let k = 0; k < T.sandEnergy; k++) {
        const i = take(), r = Math.floor(i / cols);
        const corner = r === T.rows - 1 && (i % cols === 0 || i % cols === cols - 1);
        const lock = { cost: corner ? T.lockCostCorner : 20 + 10 * (r >> 1) };
        const prize = prizeOf(T.lockPrizesEnergy); if (prize) lock.prize = prize;
        s.locks[i] = lock;
      }
      for (let k = 0; k < T.sandNear; k++) { const i = take(); s.locks[i] = { cost: 0, near: true, prize: prizeOf(T.lockPrizesNear) }; }
      for (let k = 0; k < T.webCount; k++) {
        const i = take(), it = this.mk(core[Math.floor(this.rnd() * core.length)], this.pickWeighted([[2, 5], [3, 3], [4, 1]]));
        it.web = true; s.cells[i] = it;
      }
    }

    /** Fill in any fields missing from older saves. meta.js extends this with its own fields. */
    static fillDefaults(s) {
      s.xp = s.xp || 0;
      s.best = s.best || {};
      s.locks = s.locks || {};
      s.freeTapUntil = s.freeTapUntil || 0;
      s.boost = Object.assign({ unlocked: false, mode: 0 }, s.boost || {});
      s.refill = Object.assign({ n: 0 }, s.refill || {});
      s.storageSlots = s.storageSlots || T.storageStart;
      s.storage = Array.isArray(s.storage) ? s.storage : [];
      while (s.storage.length < s.storageSlots) s.storage.push(null);
      if (!s.boost.unlocked && (s.merges || 0) >= T.boosterUnlockMerges) s.boost.unlocked = true;
      return s;
    }

    /** Notify listeners (meta.js defines onEvent: pass xp, event tokens). */
    emit(type, data) { if (typeof this.onEvent === 'function') this.onEvent(type, data || {}); }
    rollover() { return false; }
    note(msg) { this.notes.push(msg); }

    /** Create an item with the extra fields its kind needs. */
    mk(chain, level) {
      const def = CHAINS[chain], item = { chain, level };
      if (def.role === 'generator' && !def.auto) item.charges = genMaxCharges(level);
      if (def.role === 'tool') item.uses = def.uses[Math.min(level, def.uses.length) - 1];
      return item;
    }

    // ---- random ---------------------------------------------------------
    rnd() {
      const s = this.s;
      s.rng = (s.rng + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s.rng ^ (s.rng >>> 15), 1 | s.rng);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    rndInt(lo, hi) { return lo + Math.floor(this.rnd() * (hi - lo + 1)); }
    pickWeighted(table) {
      const total = table.reduce((a, e) => a + e[1], 0);
      let r = this.rnd() * total;
      for (const e of table) { r -= e[1]; if (r < 0) return e[0]; }
      return table[table.length - 1][0];
    }

    // ---- player level -----------------------------------------------------
    level() { let L = 1; while (this.s.xp >= xpForLevel(L + 1)) L++; return L; }
    levelProgress() {
      const L = this.level(), lo = xpForLevel(L), hi = xpForLevel(L + 1);
      return { level: L, into: this.s.xp - lo, need: hi - lo };
    }
    addPlayerXp(n) {
      const before = this.level();
      this.s.xp += n;
      const after = this.level();
      for (let L = before + 1; L <= after; L++) {
        const r = this.levelReward ? this.levelReward(L) : { gems: T.levelUpGems };
        const txt = this.grant ? this.grant(r) : (this.s.gems += r.gems, '+' + r.gems + ' gems');
        this.note('Level ' + L + '! ' + txt);
      }
      this.checkUnlocks();
    }
    /** Remember the highest level of each chain the player has ever held (drives the "?" tiles in chain info). */
    updateBest() {
      const b = this.s.best = this.s.best || {};
      const f = (c) => { if (c && c.level > (b[c.chain] || 0)) b[c.chain] = c.level; };
      this.s.cells.forEach(f); (this.s.storage || []).forEach(f);
    }
    /** Chains the player has reached (core four, plus those unlocked by player level). */
    chainPool() { const L = this.level(); return INGREDIENT_CHAINS.filter((c) => (CHAIN_UNLOCK[c] || 1) <= L); }
    randomChain() { const p = this.chainPool(); return p[this.rndInt(0, p.length - 1)]; }
    countMachines(id) { const s = this.s; return s.cells.concat(s.storage || []).filter((c) => c && c.chain === id).length; }
    /** Hand out the first machine of each newly unlocked chain (also fixes up older saves). */
    checkUnlocks() {
      const s = this.s; s.unlocked = s.unlocked || {};
      const L = this.level();
      for (const c of Object.keys(CHAIN_UNLOCK)) {
        if (L < CHAIN_UNLOCK[c] || s.unlocked[c]) continue;
        if (this.countMachines('gen_' + c)) { s.unlocked[c] = true; continue; }   // already owns one (older saves, or a lucky drop)
        if (this.place(this.mk('gen_' + c, 1), 0) < 0) return; // board full: try again later
        s.unlocked[c] = true;
        this.note('New machine: ' + CHAINS['gen_' + c].names[0] + '!');
      }
    }

    // ---- time: energy, recharge, bubbles, auto machines, customers --------
    regen() {
      const s = this.s, now = this.clock();
      if (s.energy >= T.energyMax) { s.energyAt = now; return; }
      const gained = Math.floor((now - s.energyAt) / T.energyRegenMs);
      if (gained > 0) {
        s.energy = Math.min(T.energyMax, s.energy + gained);
        s.energyAt += gained * T.energyRegenMs;
        if (s.energy >= T.energyMax) s.energyAt = now;
      }
    }
    msToNextEnergy() {
      const s = this.s;
      if (s.energy >= T.energyMax) return 0;
      return Math.max(0, T.energyRegenMs - (this.clock() - s.energyAt));
    }
    spendEnergy(n) {
      this.regen();
      const s = this.s;
      if (s.energy < n) return false;
      if (s.energy >= T.energyMax) s.energyAt = this.clock();
      s.energy -= n;
      return true;
    }
    addEnergy(n) { this.s.energy = Math.min(T.energyOverflowMax, this.s.energy + n); }

    /** Advance timed state. Returns true if anything visible changed. */
    tick() {
      const s = this.s, now = this.clock();
      const before = s.energy;
      this.regen();
      let changed = s.energy !== before;
      this.checkUnlocks(); this.updateBest();
      for (let i = 0; i < N; i++) {
        const c = s.cells[i];
        if (!c) continue;
        const def = CHAINS[c.chain];
        if (c.rechargeAt && now >= c.rechargeAt) {
          c.charges = genMaxCharges(c.level); delete c.rechargeAt; changed = true;
        }
        if (c.bubbleUntil && now >= c.bubbleUntil) {
          s.cells[i] = { chain: 'coin', level: 2 }; this.fx.push({ type: 'pop', i }); changed = true;
        }
        if (def.auto && !c.bubbleUntil) {
          const period = def.periodMs[Math.min(c.level, def.periodMs.length) - 1];
          if (!c.nextAt) c.nextAt = now + period;
          if (now >= c.nextAt) {
            const j = this.nearestEmpty(i);
            if (j >= 0) {
              this.place(this.mk(this.randomChain(), this.rndInt(1, 2)), i, true);
              c.nextAt = now + period; changed = true;
            } else c.nextAt = now + 5000; // board full: try again shortly
          }
        }
      }
      // More customers queue up as the player levels up; the customer row scrolls sideways to show them.
      while (s.orders.length < this.orderSlots()) {
        s.orders.push({ id: s.nextOrderId++, pending: true, readyAt: now + this.rndInt(T.orderDelayMinMs, T.orderDelayMaxMs) }); changed = true;
      }
      for (let k = 0; k < s.orders.length; k++) {
        const o = s.orders[k];
        if (o.pending && now >= o.readyAt) { s.orders[k] = this.makeOrder(); changed = true; }
      }
      return changed;
    }

    orderSlots() { const L = this.level(); return T.orderSlots + (L >= 6 ? 1 : 0) + (L >= 10 ? 1 : 0) + (L >= 14 ? 1 : 0); }

    // ---- board helpers --------------------------------------------------
    nearestEmpty(from) {
      const cells = this.s.cells, fc = from % T.cols, fr = Math.floor(from / T.cols);
      let best = -1, bd = 1e9;
      for (let j = 0; j < N; j++) {
        if (cells[j] || (this.s.locks && this.s.locks[j])) continue;
        const d = Math.abs((j % T.cols) - fc) + Math.abs(Math.floor(j / T.cols) - fr);
        if (d < bd) { bd = d; best = j; }
      }
      return best;
    }
    emptyCount() { const L = this.s.locks || {}; return this.s.cells.reduce((a, c, i) => a + (c || L[i] ? 0 : 1), 0); }
    /** Put an item in the empty cell nearest to `near`. With fromNear, the UI animates it flying out of `near` (a generator, a gift...). */
    place(item, near, fromNear) {
      const j = this.nearestEmpty(near);
      if (j < 0) return -1;
      this.s.cells[j] = item;
      this.fx.push(fromNear ? { type: 'spawn', i: j, from: near } : { type: 'spawn', i: j });
      return j;
    }
    /** Items on the board only. */
    count(chain, level) {
      let n = 0;
      for (const c of this.s.cells) if (c && !c.bubbleUntil && !c.web && c.chain === chain && c.level === level) n++;
      return n;
    }
    /** Items on the board plus items in storage (orders may use both). */
    countAll(chain, level) {
      let n = this.count(chain, level);
      for (const c of this.s.storage) if (c && c.chain === chain && c.level === level) n++;
      return n;
    }

    // ---- interactions ---------------------------------------------------
    tap(i) {
      const c = this.s.cells[i];
      if (!c) return { ok: false };
      if (c.bubbleUntil) return { ok: false, msg: 'Pop the bubble with gems, or wait for it to burst into coins.' };
      if (c.web) return { ok: false, msg: WEB_MSG };
      const role = roleOf(c);
      if (role === 'generator') return this.produce(i);
      if (role === 'currency') return this.collect(i);
      if (role === 'gift') return this.tapGift(i);
      if (role === 'tool') return c.chain === 'orb' ? this.useOrb(i) : { ok: false, msg: 'Drag it onto an item to use it.' };
      return { ok: false, msg: 'Drag it onto a matching item to merge.' };
    }

    collect(i) {
      const c = this.s.cells[i], def = CHAINS[c.chain];
      const amt = def.payout[Math.min(c.level, def.payout.length) - 1];
      if (c.chain === 'coin') this.s.coins += amt;
      else if (c.chain === 'gem') this.s.gems += amt;
      else if (c.chain === 'bolt') this.addEnergy(amt);
      this.s.cells[i] = null;
      this.fx.push({ type: 'collect', i });
      this.emit('collect', { chain: c.chain, amt });
      return { ok: true, msg: '+' + amt + ' ' + c.chain, gain: { chain: c.chain, amt } };
    }

    boostMode() { return this.s.boost.unlocked ? this.s.boost.mode : 0; }
    boostCost() { return T.energyPerTap * T.boosterCosts[this.boostMode()]; }
    cycleBoost() {
      const b = this.s.boost;
      if (!b.unlocked) return { ok: false, msg: 'The generator booster unlocks after ' + T.boosterUnlockMerges + ' merges.' };
      b.mode = (b.mode + 1) % T.boosterCosts.length;
      const txt = ['Booster off.', 'Booster on: +1 level, ' + T.boosterCosts[1] + ' energy per tap.', 'Booster max: +2 levels, ' + T.boosterCosts[2] + ' energy per tap.'][b.mode];
      return { ok: true, msg: txt };
    }

    produce(i) {
      const s = this.s, c = s.cells[i], now = this.clock(), def = CHAINS[c.chain];
      if (def.auto) return { ok: false, msg: 'This one works by itself. Give it a little time.' };
      if (c.rechargeAt) return { ok: false, msg: 'Recharging. Speed it up with gems, or wait.' };
      if (this.nearestEmpty(i) < 0) return { ok: false, msg: 'Board full! Merge, sell or store something.' };
      const freeTap = now < (s.freeTapUntil || 0);
      const mode = this.boostMode();
      if (!freeTap && !this.spendEnergy(this.boostCost())) return { ok: false, msg: 'Out of energy.', needEnergy: true };
      let item;
      if (this.rnd() < T.bonusCoinChance) item = this.mk('coin', 1);
      else {
        const lv = Math.min(maxLevel(def.produces), this.pickWeighted(T.spawnTable[c.level] || T.spawnTable[3]) + mode);
        item = this.mk(def.produces, lv);
      }
      this.place(item, i, true);
      c.charges -= 1;
      if (c.charges <= 0) c.rechargeAt = now + T.genRechargeMs;
      this.emit('tap', {});
      return { ok: true, kind: 'spawn' };
    }

    /** Webs on the four neighbours of cell i fall away (called after a merge). */
    clearWebs(i) {
      const s = this.s, c0 = i % T.cols, r0 = Math.floor(i / T.cols);
      let n = 0;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c1 = c0 + dc, r1 = r0 + dr;
        if (c1 < 0 || c1 >= T.cols || r1 < 0 || r1 >= T.rows) continue;
        const j = r1 * T.cols + c1, o = s.cells[j];
        if (o && o.web) { delete o.web; this.fx.push({ type: 'pop', i: j }); n++; }
      }
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const c1 = c0 + dc, r1 = r0 + dr;
        if (c1 < 0 || c1 >= T.cols || r1 < 0 || r1 >= T.rows) continue;
        const j = r1 * T.cols + c1, L = s.locks && s.locks[j];
        if (L && L.near) {
          delete s.locks[j];
          if (L.prize) s.cells[j] = this.mk(L.prize.chain, L.prize.level);
          this.fx.push({ type: 'pop', i: j }); this.emit('unlock', {});
          this.note(L.prize ? 'The sand cleared, and something was buried there!' : 'Sand cleared!');
        }
      }
      if (n) this.note(n === 1 ? 'Cobweb cleared!' : n + ' cobwebs cleared!');
      return n;
    }
    /** Tap a locked sand tile: pay its energy price to open it (and receive any hidden prize). */
    unlock(i) {
      const s = this.s, L = s.locks && s.locks[i];
      if (!L) return { ok: false };
      if (L.near) return { ok: false, msg: 'Merge two items right next to this sand to clear it.' };
      if (!this.spendEnergy(L.cost)) return { ok: false, msg: 'Clearing this tile costs ' + L.cost + ' energy.', needEnergy: true };
      delete s.locks[i];
      if (L.prize) s.cells[i] = this.mk(L.prize.chain, L.prize.level);
      this.fx.push({ type: 'pop', i });
      this.emit('unlock', {});
      return { ok: true, kind: 'unlock', msg: L.prize ? 'Cleared! You found something.' : 'Cleared!' };
    }

    canMerge(a, b) {
      if (!a || !b || a === b) return false;
      if (a.bubbleUntil || b.bubbleUntil || a.web) return false;   // a webbed item can be merged into, but not dragged
      return a.chain === b.chain && a.level === b.level && a.level < maxLevel(a.chain);
    }

    move(from, to) {
      const s = this.s;
      if (from === to) return { ok: false };
      const a = s.cells[from], b = s.cells[to];
      if (s.locks && s.locks[to]) return { ok: false, msg: 'Clear that sand tile first.' };
      if (!a || a.bubbleUntil) return { ok: false };
      if (a.web) return { ok: false, msg: WEB_MSG };
      if (b && b.web && !this.canMerge(a, b)) return { ok: false, msg: WEB_MSG };   // only a matching item frees a webbed one
      if (!b) {
        s.cells[to] = a; s.cells[from] = null;
        return { ok: true, kind: 'move' };
      }
      if (b.bubbleUntil) return { ok: false, msg: 'That cell holds a bubble.' };
      if (this.canMerge(a, b)) return this.merge(from, to);
      if (roleOf(a) === 'tool') return this.useTool(from, to);
      s.cells[to] = a; s.cells[from] = b;
      return { ok: true, kind: 'swap' };
    }

    merge(from, to) {
      const s = this.s, a = s.cells[from], role = roleOf(a);
      const next = this.mk(a.chain, a.level + 1);
      s.cells[to] = next; s.cells[from] = null;
      s.merges += 1;
      this.fx.push({ type: 'merge', i: to });
      this.clearWebs(to); this.clearWebs(from);
      let bonus = false;
      // Our own rule: merging next to a third matching item absorbs it and drops a bonus coin.
      if (role === 'ingredient' || role === 'currency') {
        const c0 = to % T.cols, r0 = Math.floor(to / T.cols);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const c1 = c0 + dc, r1 = r0 + dr;
          if (c1 < 0 || c1 >= T.cols || r1 < 0 || r1 >= T.rows) continue;
          const j = r1 * T.cols + c1, o = s.cells[j];
          if (o && !o.bubbleUntil && o.chain === a.chain && o.level === a.level) {
            s.cells[j] = null; bonus = true;
            if (this.place(this.mk('coin', 1), to) < 0) s.coins += 2;
            this.fx.push({ type: 'bonus', i: j });
            break;
          }
        }
      }
      if (!s.boost.unlocked && s.merges >= T.boosterUnlockMerges) {
        s.boost.unlocked = true;
        this.note('Generator booster unlocked! Tap the bolt button under the board.');
      }
      this.emit('merge', { level: next.level, chain: a.chain });
      return { ok: true, kind: 'merge', bonus, level: next.level };
    }

    // ---- tools ----------------------------------------------------------
    spendUse(i) {
      const c = this.s.cells[i];
      c.uses -= 1;
      if (c.uses <= 0) this.s.cells[i] = null;
    }
    useTool(from, to) {
      const s = this.s, a = s.cells[from], b = s.cells[to], bad = { ok: false, msg: 'Cannot be used on this item.' };
      if (a.chain === 'scissors') {
        if (roleOf(b) !== 'ingredient' || b.level < 2) return { ok: false, msg: 'Scissors split items that are level 2 or higher.' };
        if (this.emptyCount() < 1) return { ok: false, msg: 'Need an empty cell to split into.' };
        b.level -= 1;
        this.place(this.mk(b.chain, b.level), to, true);
        this.fx.push({ type: 'merge', i: to });
        this.spendUse(from);
        return { ok: true, kind: 'tool', msg: 'Split!' };
      }
      if (a.chain === 'dust') {
        const r = roleOf(b);
        if ((r !== 'ingredient' && r !== 'currency') || b.level >= maxLevel(b.chain)) return bad;
        b.level += 1;
        this.fx.push({ type: 'merge', i: to });
        this.spendUse(from);
        return { ok: true, kind: 'tool', msg: itemName(b.chain, b.level) + '!' };
      }
      return bad;
    }
    /** Wish Orb: makes the items your current orders are still missing. */
    useOrb(i) {
      const s = this.s, need = {};
      for (const o of s.orders) {
        if (o.pending) continue;
        for (const w of o.wants) { const k = w.chain + ':' + w.level; need[k] = (need[k] || 0) + 1; }
      }
      const missing = [];
      for (const k of Object.keys(need)) {
        const [ch, lv] = k.split(':');
        for (let n = this.countAll(ch, +lv); n < need[k]; n++) missing.push({ chain: ch, level: +lv });
      }
      if (!missing.length) return { ok: false, msg: 'No order needs anything right now.' };
      const batch = missing.slice(0, T.orbMaxItems);
      if (this.emptyCount() < batch.length + 0) return { ok: false, msg: 'Need ' + batch.length + ' free cells.' };
      s.cells[i] = null;
      for (const m of batch) this.place(this.mk(m.chain, m.level), i, true);
      return { ok: true, kind: 'spawn', msg: 'The orb granted ' + batch.length + ' item' + (batch.length > 1 ? 's' : '') + '!' };
    }

    // ---- selling and storage --------------------------------------------
    sellValue(c) { return T.sellBase * Math.pow(2, c.level - 1); }
    sell(i) {
      const c = this.s.cells[i];
      if (c && c.web) return { ok: false, msg: WEB_MSG };
      if (!c || c.bubbleUntil || roleOf(c) !== 'ingredient') return { ok: false, msg: 'This cannot be sold.' };
      const v = this.sellValue(c);
      this.s.coins += v; this.s.cells[i] = null;
      return { ok: true, msg: 'Sold for ' + v + ' coins.' };
    }
    storageUsed() { return this.s.storage.filter(Boolean).length; }
    store(i) {
      const s = this.s, c = s.cells[i];
      if (!c || c.bubbleUntil) return { ok: false };
      if (c.web) return { ok: false, msg: WEB_MSG };
      if (roleOf(c) === 'gift' && c.unlockAt) return { ok: false, msg: 'Finish opening this gift first.' };
      const slot = s.storage.findIndex((x) => !x);
      if (slot < 0) return { ok: false, msg: 'Storage is full. Buy a slot with gems.', needSlot: true };
      s.storage[slot] = c; s.cells[i] = null;
      return { ok: true, kind: 'tool', msg: 'Stored.' };
    }
    retrieve(k) {
      const s = this.s, it = s.storage[k];
      if (!it) return { ok: false };
      const j = this.nearestEmpty(CENTER);
      if (j < 0) return { ok: false, msg: 'Board full!' };
      s.cells[j] = it; s.storage[k] = null; this.fx.push({ type: 'spawn', i: j });
      return { ok: true, kind: 'tool' };
    }
    slotCost() { return T.storageSlotGemCost + (this.s.storageSlots - T.storageStart) * 5; }
    buyStorageSlot() {
      const s = this.s;
      if (s.storageSlots >= T.storageMax) return { ok: false, msg: 'Storage is at its maximum.' };
      const cost = this.slotCost();
      if (s.gems < cost) return { ok: false, msg: 'Need ' + cost + ' gems.', needGems: true };
      s.gems -= cost; s.storageSlots += 1; s.storage.push(null);
      return { ok: true, msg: 'New storage slot!' };
    }

    // ---- gifts and bubbles ---------------------------------------------
    giftRemaining(c) { return c.unlockAt ? Math.max(0, c.unlockAt - this.clock()) : null; }
    tapGift(i) {
      const s = this.s, c = s.cells[i], now = this.clock();
      if (!c.unlockAt) {
        if (s.cells.some((o) => o && o.chain === 'gift' && o.unlockAt))
          return { ok: false, msg: 'Another gift is already opening.' };
        c.unlockAt = now + T.giftUnlockMs[c.level];
        return { ok: true, msg: 'Opening... come back soon!' };
      }
      if (now < c.unlockAt) return { ok: false, msg: 'Still opening. Speed it up with gems?' };
      return this.openGift(i);
    }
    giftSpeedCost(c) {
      return Math.max(1, Math.ceil(this.giftRemaining(c) / T.giftSpeedUpMsPerGem));
    }
    openGift(i) {
      const s = this.s, c = s.cells[i], n = T.giftItemCount[c.level];
      if (this.emptyCount() + 1 < n) return { ok: false, msg: 'Need ' + (n - 1) + ' free cells to open this.' };
      s.cells[i] = null;
      for (let k = 0; k < n; k++) {
        let item;
        const owned = this.chainPool().filter((c) => this.countMachines('gen_' + c) < 2);
        if (owned.length && this.rnd() < T.giftGenChance) item = this.mk('gen_' + owned[Math.floor(this.rnd() * owned.length)], 1);
        else if (this.rnd() < T.giftToolChance) item = this.mk(this.rnd() < 0.5 ? 'scissors' : 'dust', 1);
        else {
          item = this.mk(this.randomChain(), this.rndInt(1, 3));
          if (this.rnd() < T.bubbleChance) item.bubbleUntil = this.clock() + T.bubbleLifeMs;
        }
        this.place(item, i, true);
      }
      this.emit('gift', {});
      return { ok: true, msg: 'Gift opened!' };
    }
    speedUp(i) {
      const s = this.s, c = s.cells[i];
      if (!c) return { ok: false };
      if (c.chain === 'gift' && c.unlockAt && this.clock() < c.unlockAt) {
        const cost = this.giftSpeedCost(c);
        if (s.gems < cost) return { ok: false, msg: 'Need ' + cost + ' gems.', needGems: true };
        s.gems -= cost; c.unlockAt = this.clock();
        return { ok: true, msg: 'Ready to open!' };
      }
      if (c.rechargeAt) {
        if (s.gems < T.genSpeedUpGemCost) return { ok: false, msg: 'Need ' + T.genSpeedUpGemCost + ' gems.', needGems: true };
        s.gems -= T.genSpeedUpGemCost; c.charges = genMaxCharges(c.level); delete c.rechargeAt;
        return { ok: true, msg: 'Recharged!' };
      }
      return { ok: false };
    }
    buyBubble(i) {
      const s = this.s, c = s.cells[i];
      if (!c || !c.bubbleUntil) return { ok: false };
      if (s.gems < T.bubbleGemCost) return { ok: false, msg: 'Need ' + T.bubbleGemCost + ' gems.', needGems: true };
      s.gems -= T.bubbleGemCost; delete c.bubbleUntil;
      return { ok: true, msg: 'Bubble popped!' };
    }
    /** First refill each day is free; then 10, 20, 40... gems. */
    refillCost() { const n = this.s.refill.n; return n === 0 ? 0 : T.energyRefillGemCost * Math.pow(2, n - 1); }
    refillEnergy() {
      const s = this.s;
      this.regen();
      if (s.energy >= T.energyMax) return { ok: false, msg: 'Energy is already full.' };
      const cost = this.refillCost();
      if (s.gems < cost) return { ok: false, msg: 'Need ' + cost + ' gems.', needGems: true };
      s.gems -= cost; s.refill.n += 1; s.energy = T.energyMax; s.energyAt = this.clock();
      return { ok: true, msg: 'Energy refilled!' };
    }

    // ---- orders ---------------------------------------------------------
    maxOrderLevel() {
      return Math.min(T.orderMaxLevelCap, T.orderMaxLevelStart + Math.floor(this.s.stars / T.starsPerOrderLevel));
    }
    makeOrder() {
      const s = this.s, maxL = this.maxOrderLevel();
      const nWants = 1 + (this.rnd() < 0.5 ? 1 : 0) + (s.stars >= 10 && this.rnd() < 0.3 ? 1 : 0);
      const wants = [];
      let guard = 0;
      while (wants.length < nWants && guard++ < 50) {
        const chain = this.randomChain();
        const level = Math.min(maxLevel(chain), this.rndInt(T.orderMinLevel, maxL));
        if (wants.some((w) => w.chain === chain && w.level === level)) continue;
        const dup = s.orders.some((o) => (o.wants || []).some((w) => w.chain === chain && w.level === level));
        if (dup && guard < 25) continue;
        wants.push({ chain, level });
      }
      let coins = 0, ener = 0, gems = 0;
      for (const w of wants) {
        coins += 3 * Math.pow(2, w.level - 1);
        ener += 0.4 * Math.pow(2, w.level - 1);
        if (w.level >= 5) gems = 1;
      }
      const folks = (G.STORY && G.STORY.FOLKS) || ['mabel'];
      // Customers pay in different ways: coins and energy, coins and a good review (smiley), or just coins.
      const roll = this.rnd(), reward = { coins, energy: 0, gems, stars: 1 };
      if (roll < 0.45) reward.energy = Math.max(2, Math.round(ener));
      else if (roll < 0.8) reward.smile = 1;
      // Prefer someone who is not already waiting, so the same face does not repeat along the counter.
      const here = new Set(s.orders.filter((o) => !o.pending).map((o) => o.cust));
      const fresh = folks.filter((f) => !here.has(f)), pool = fresh.length ? fresh : folks;
      return { id: s.nextOrderId++, cust: pool[this.rndInt(0, pool.length - 1)], wants, reward };
    }
    addOrder() { this.s.orders.push(this.makeOrder()); }
    canServe(order) {
      if (order.pending) return false;
      const need = {};
      for (const w of order.wants) { const k = w.chain + ':' + w.level; need[k] = (need[k] || 0) + 1; }
      return Object.keys(need).every((k) => { const [ch, lv] = k.split(':'); return this.countAll(ch, +lv) >= need[k]; });
    }
    /** Which board cells are earmarked for an order (for the green check marks). */
    neededCells() {
      const out = new Set(), taken = {};
      for (const o of this.s.orders) {
        if (o.pending) continue;
        for (const w of o.wants) {
          const k = w.chain + ':' + w.level;
          taken[k] = (taken[k] || 0);
          let seen = 0;
          this.s.cells.forEach((c, i) => {
            if (c && !c.bubbleUntil && !c.web && c.chain === w.chain && c.level === w.level) {
              if (seen === taken[k] && !out.has(i)) { out.add(i); }
              seen++;
            }
          });
          taken[k]++;
        }
      }
      return out;
    }
    serve(orderId) {
      const s = this.s, idx = s.orders.findIndex((o) => o.id === orderId);
      if (idx < 0) return { ok: false };
      const o = s.orders[idx];
      if (!this.canServe(o)) return { ok: false, msg: 'You do not have all the items yet.' };
      for (const w of o.wants) {
        const j = s.cells.findIndex((c) => c && !c.bubbleUntil && !c.web && c.chain === w.chain && c.level === w.level);
        if (j >= 0) { s.cells[j] = null; this.fx.push({ type: 'collect', i: j }); continue; }
        const k = s.storage.findIndex((c) => c && c.chain === w.chain && c.level === w.level);
        if (k >= 0) s.storage[k] = null;
      }
      s.coins += o.reward.coins; this.addEnergy(o.reward.energy); s.gems += o.reward.gems;
      s.stars += o.reward.stars; s.served += 1;
      // The next customer arrives after a short wait.
      s.orders[idx] = { id: s.nextOrderId++, pending: true, readyAt: this.clock() + this.rndInt(T.orderDelayMinMs, T.orderDelayMaxMs) };
      this.emit('serve', { order: o });
      return { ok: true, reward: o.reward, msg: 'Order served!' };
    }

    // ---- save / load ----------------------------------------------------
    serialize() { return JSON.stringify(this.s); }
    static load(raw, clock) {
      try {
        const s = JSON.parse(raw);
        if (s && s.v >= 1 && s.v <= 3 && Array.isArray(s.cells) && Array.isArray(s.orders)) {
          while (s.cells.length < N) s.cells.push(null);        // older, shorter boards
          if (s.cells.length === N) {
            Game.fillDefaults(s); s.v = 3;
            const g = new Game(s, clock); g.rollover();
            return g;
          }
        }
      } catch (e) { /* fall through */ }
      return new Game(null, clock);
    }
  }

  Object.assign(G, { Game, genMaxCharges, isBubble, itemName, xpForLevel });
})(typeof globalThis !== 'undefined' ? globalThis : this);
