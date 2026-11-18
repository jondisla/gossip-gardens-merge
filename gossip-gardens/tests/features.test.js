'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadGG() {
  const ctx = vm.createContext({ console, Date });
  ctx.globalThis = ctx;
  for (const f of ['data.js', 'game.js', 'story.js', 'meta.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
  }
  return ctx.GG;
}
const GG = loadGG();
const { Game, TUNING: T } = GG;

function mk() {
  let now = new Date(2026, 5, 10, 9, 0, 0).getTime();
  const g = new Game(Game.newState(now, 11), () => now);
  g.s.cells.fill(null);
  g.s.orders = [];
  g.advance = (ms) => { now += ms; g.tick(); g.rollover(); };
  return g;
}
const at = (r, c) => r * T.cols + c;

test('board is 7 x 9 and energy regenerates 1 per 2 minutes', () => {
  assert.equal(T.cols, 7); assert.equal(T.rows, 9);
  assert.equal(T.energyRegenMs, 120000);
  const g = mk();
  g.s.energy = 50; g.s.energyAt = g.clock();
  g.advance(120000 * 3);
  assert.equal(g.s.energy, 53);
});

test('scissors split an item into two one level lower and use up', () => {
  const g = mk();
  g.s.cells[0] = g.mk('scissors', 1);
  g.s.cells[1] = g.mk('leaf', 4);
  const r = g.move(0, 1);
  assert.ok(r.ok);
  assert.equal(g.s.cells[1].level, 3);
  assert.equal(g.s.cells.filter((c) => c && c.chain === 'leaf' && c.level === 3).length, 2);
  assert.equal(g.s.cells[0], null); // single-use scissors are gone
});

test('scissors with several uses stay; they refuse level 1 items, machines and a full board', () => {
  const g = mk();
  g.s.cells[0] = g.mk('scissors', 2);
  assert.equal(g.s.cells[0].uses, 3);
  g.s.cells[1] = g.mk('seed', 1);
  assert.equal(g.move(0, 1).ok, false);
  g.s.cells[2] = g.mk('gen_seed', 1);
  assert.equal(g.move(0, 2).ok, false);
  g.s.cells[3] = g.mk('seed', 3);
  assert.ok(g.move(0, 3).ok);
  assert.equal(g.s.cells[0].uses, 2);
  g.s.cells.fill(g.mk('flour', 3)); g.s.cells[0] = g.mk('scissors', 2);
  assert.equal(g.move(0, 5).ok, false); // no empty cell
});

test('two scissors merge into a bigger pair with more uses', () => {
  const g = mk();
  g.s.cells[0] = g.mk('scissors', 1); g.s.cells[1] = g.mk('scissors', 1);
  assert.equal(g.move(0, 1).kind, 'merge');
  assert.equal(g.s.cells[1].uses, 3);
});

test('sparkle dust raises an item a level but not machines or top-level items', () => {
  const g = mk();
  g.s.cells[0] = g.mk('dust', 1); g.s.cells[1] = g.mk('paper', 2);
  assert.ok(g.move(0, 1).ok);
  assert.equal(g.s.cells[1].level, 3);
  assert.equal(g.s.cells[0], null);
  g.s.cells[2] = g.mk('dust', 1); g.s.cells[3] = g.mk('gen_leaf', 1);
  assert.equal(g.move(2, 3).ok, false);
  g.s.cells[4] = g.mk('seed', GG.maxLevel('seed'));
  assert.equal(g.move(2, 4).ok, false);
});

test('wish orb makes exactly the items the orders are missing', () => {
  const g = mk();
  g.s.orders = [{ id: 1, cust: 'mabel', wants: [{ chain: 'seed', level: 3 }, { chain: 'leaf', level: 2 }], reward: { coins: 1, energy: 1, gems: 0, stars: 1 } }];
  g.s.cells[0] = g.mk('orb', 1);
  g.s.cells[1] = g.mk('leaf', 2); // already have one of them
  const r = g.tap(0);
  assert.ok(r.ok);
  assert.equal(g.s.cells[0] && g.s.cells[0].chain === 'orb', false);
  assert.equal(g.count('seed', 3), 1);
  assert.equal(g.count('leaf', 2), 1); // not duplicated
  assert.ok(g.canServe(g.s.orders[0]));
  const g2 = mk();
  g2.s.cells[0] = g2.mk('orb', 1);
  assert.equal(g2.tap(0).ok, false); // nothing needed, orb is kept
  assert.ok(g2.s.cells[0]);
});

test('generator booster unlocks after enough merges and costs more for higher levels', () => {
  const g = mk();
  assert.equal(g.cycleBoost().ok, false);
  g.s.merges = T.boosterUnlockMerges - 1;
  g.s.cells[0] = g.mk('seed', 1); g.s.cells[1] = g.mk('seed', 1);
  g.move(0, 1);
  assert.ok(g.s.boost.unlocked);
  assert.ok(g.notes.length >= 1);
  assert.ok(g.cycleBoost().ok);
  assert.equal(g.boostCost(), 2);
  g.s.cells[10] = g.mk('gen_seed', 1);
  const e0 = g.s.energy;
  assert.ok(g.tap(10).ok);
  assert.equal(g.s.energy, e0 - 2);
  const spawned = g.s.cells.find((c, i) => c && i !== 10 && i > 1 && c.chain !== 'gen_seed');
  assert.ok(spawned.level >= 2 || spawned.chain === 'coin'); // +1 level
  g.cycleBoost(); assert.equal(g.boostCost(), 4);
  g.cycleBoost(); assert.equal(g.boostCost(), 1);
});

test('storage: store, retrieve, capacity, buying slots, and orders can use stored items', () => {
  const g = mk();
  assert.equal(g.s.storage.length, T.storageStart);
  for (let k = 0; k < T.storageStart; k++) { g.s.cells[k] = g.mk('seed', 1 + k % 2); assert.ok(g.store(k).ok); }
  assert.equal(g.storageUsed(), T.storageStart);
  g.s.cells[10] = g.mk('leaf', 1);
  const full = g.store(10);
  assert.equal(full.ok, false); assert.ok(full.needSlot);
  g.s.gems = 100;
  assert.ok(g.buyStorageSlot().ok);
  assert.equal(g.s.storageSlots, T.storageStart + 1);
  assert.ok(g.store(10).ok);
  assert.ok(g.retrieve(0).ok);
  assert.equal(g.storageUsed(), T.storageStart);
  // an order is satisfied by a stored item
  g.s.cells.fill(null);
  g.s.storage[1] = g.mk('flour', 3);
  g.s.orders = [{ id: 9, cust: 'ivo', wants: [{ chain: 'flour', level: 3 }], reward: { coins: 5, energy: 1, gems: 0, stars: 1 } }];
  assert.ok(g.canServe(g.s.orders[0]));
  assert.ok(g.serve(9).ok);
  assert.equal(g.s.storage[1], null);
});

test('storage will not take a gift that is mid-opening or a bubbled item', () => {
  const g = mk();
  g.s.cells[0] = g.mk('gift', 1); g.tap(0);
  assert.equal(g.store(0).ok, false);
  g.s.cells[1] = Object.assign(g.mk('seed', 1), { bubbleUntil: g.clock() + 5000 });
  assert.equal(g.store(1).ok, false);
});

test('an auto machine makes items by itself, free of energy, and waits when the board is full', () => {
  const g = mk();
  g.s.cells[0] = g.mk('gen_vine', 1);
  const e0 = g.s.energy;
  assert.equal(g.tap(0).ok, false); // tapping does nothing
  g.advance(1000);
  g.advance(90000 + 1);
  assert.equal(g.s.cells.filter(Boolean).length, 2);
  assert.equal(g.s.energy, e0);
  g.s.cells.fill(g.mk('seed', 1)); g.s.cells[0] = g.s.cells[0].chain === 'gen_vine' ? g.s.cells[0] : g.mk('gen_vine', 1);
  g.s.cells[0] = Object.assign(g.mk('gen_vine', 1), { nextAt: g.clock() - 1 });
  g.tick();
  assert.equal(g.s.cells.filter((c) => c && c.chain !== 'gen_vine').length, T.cols * T.rows - 1);
});

test('after serving, the next customer steps up straight away', () => {
  const g = mk();
  g.s.orders = [{ id: 1, cust: 'pippa', wants: [{ chain: 'seed', level: 2 }], reward: { coins: 6, energy: 2, gems: 0, stars: 1 } }];
  g.s.cells[0] = g.mk('seed', 2);
  assert.ok(g.serve(1).ok);
  assert.equal(g.s.orders.length, 1);
  assert.equal(g.s.orders[0].pending, undefined);
  assert.ok(g.s.orders[0].wants.length >= 1);
  assert.ok(g.s.orders[0].cust);
  assert.notEqual(g.s.orders[0].id, 1);
});

test('a waiting customer left over from an older save is replaced on the next tick', () => {
  const g = mk();
  g.s.orders = [{ id: 7, pending: true, readyAt: g.clock() + 99999 }];
  g.tick();
  assert.equal(g.s.orders[0].pending, undefined);
  assert.ok(g.s.orders[0].wants.length >= 1);
});

test('items an order needs are marked on the board, one cell per needed item', () => {
  const g = mk();
  g.s.orders = [{ id: 1, cust: 'mabel', wants: [{ chain: 'leaf', level: 2 }, { chain: 'leaf', level: 3 }], reward: { coins: 1, energy: 1, gems: 0, stars: 1 } }];
  g.s.cells[0] = g.mk('leaf', 2); g.s.cells[1] = g.mk('leaf', 2); g.s.cells[2] = g.mk('leaf', 3); g.s.cells[3] = g.mk('seed', 2);
  const need = g.neededCells();
  assert.equal(need.size, 2);
  assert.ok(need.has(0) && need.has(2));
});

test('energy refill: the first of the day is free, then the price doubles', () => {
  const g = mk();
  g.s.gems = 500; g.s.energy = 0; g.s.energyAt = g.clock();
  assert.equal(g.refillCost(), 0);
  assert.ok(g.refillEnergy().ok);
  assert.equal(g.s.gems, 500);
  g.s.energy = 0; assert.equal(g.refillCost(), 10);
  g.refillEnergy(); assert.equal(g.s.gems, 490);
  g.s.energy = 0; assert.equal(g.refillCost(), 20);
  g.advance(86400000);
  assert.equal(g.refillCost(), 0);
});

test('player level rises with xp and pays gems on level up', () => {
  const g = mk();
  assert.equal(g.level(), 1);
  const gems = g.s.gems;
  g.addPlayerXp(GG.xpForLevel(2));
  assert.equal(g.level(), 2);
  assert.equal(g.s.gems, gems + T.levelUpGems);
  assert.ok(g.notes.some((n) => n.includes('Level 2')));
  const lp = g.levelProgress();
  assert.ok(lp.into >= 0 && lp.need > 0);
  g.s.orders = [{ id: 3, cust: 'ivo', wants: [{ chain: 'seed', level: 2 }], reward: { coins: 6, energy: 2, gems: 0, stars: 1 } }];
  g.s.cells[0] = g.mk('seed', 2);
  const xp0 = g.s.xp;
  g.serve(3);
  assert.ok(g.s.xp > xp0);
});

test('an old 56-cell save loads onto the taller board without losing items', () => {
  const g = mk();
  g.s.cells[3] = g.mk('seed', 4);
  const old = JSON.parse(g.serialize());
  old.v = 2; old.cells = old.cells.slice(0, 56);
  delete old.storage; delete old.boost; delete old.refill; delete old.xp;
  const g2 = Game.load(JSON.stringify(old), () => g.clock());
  assert.equal(g2.s.cells.length, T.cols * T.rows);
  assert.equal(g2.s.cells[3].level, 4);
  assert.equal(g2.s.storage.length, T.storageStart);
  assert.ok(g2.s.boost && g2.s.refill);
  assert.equal(g2.s.v, 3);
});

test('tools can be granted and shop items need room on the board', () => {
  const g = mk();
  g.grant({ tool: 'orb' });
  assert.ok(g.s.cells.some((c) => c && c.chain === 'orb'));
  g.grant({ tool: 'scissors' });
  assert.ok(g.s.cells.some((c) => c && c.chain === 'scissors' && c.uses === 1));
  g.s.gems = 100;
  g.s.cells.fill(g.mk('seed', 1));
  assert.equal(g.buyOffer('sp_piggy').ok, false); // board full
  assert.equal(g.s.gems, 100);
});

test('each level pays its reward, and a profile with a name and id is created', () => {
  const g = mk();
  assert.ok(g.s.profile && /^[A-Z0-9]{8}$/.test(g.s.profile.id) && g.s.profile.name.startsWith('Player'));
  const r2 = g.levelReward(2), r3 = g.levelReward(3), r6 = g.levelReward(6);
  assert.equal(r2.gems, T.levelUpGems); assert.equal(r2.coins, 20); assert.ok(!r2.gift);
  assert.equal(r3.gift, 1); assert.equal(r6.gift, 2);
  const coins = g.s.coins;
  g.addPlayerXp(GG.xpForLevel(3));            // jumps two levels: both rewards are paid
  assert.equal(g.level(), 3);
  assert.ok(g.s.coins >= coins + 20 + 30);
  assert.ok(g.notes.some((n) => n.includes('Level 3')));
  const g2 = GG.Game.load(g.serialize(), () => g.clock());
  assert.equal(g2.s.profile.id, g.s.profile.id);
});
