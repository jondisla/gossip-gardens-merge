'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadGG() {
  const ctx = vm.createContext({ console });
  ctx.globalThis = ctx;
  for (const f of ['data.js', 'game.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
  }
  return ctx.GG;
}
const GG = loadGG();
const { Game, TUNING: T } = GG;

function mk() {
  let now = 1_000_000;
  const clock = () => now;
  const g = new Game(null, clock);
  g.s.cells.fill(null);
  g.s.orders = [];
  g.advance = (ms) => { now += ms; g.tick(); };
  return g;
}
const at = (r, c) => r * T.cols + c;

test('merging two equal items makes the next level', () => {
  const g = mk();
  g.s.cells[0] = { chain: 'seed', level: 1 };
  g.s.cells[1] = { chain: 'seed', level: 1 };
  const r = g.move(0, 1);
  assert.equal(r.kind, 'merge');
  assert.deepEqual(g.s.cells[1], { chain: 'seed', level: 2 });
  assert.equal(g.s.cells[0], null);
});

test('different levels or chains swap instead of merging', () => {
  const g = mk();
  g.s.cells[0] = { chain: 'seed', level: 1 };
  g.s.cells[1] = { chain: 'seed', level: 2 };
  assert.equal(g.move(0, 1).kind, 'swap');
  assert.equal(g.s.cells[0].level, 2);
  g.s.cells[2] = { chain: 'leaf', level: 2 };
  assert.equal(g.move(0, 2).kind, 'swap');
});

test('top level items do not merge', () => {
  const g = mk();
  const top = GG.maxLevel('seed');
  g.s.cells[0] = { chain: 'seed', level: top };
  g.s.cells[1] = { chain: 'seed', level: top };
  assert.equal(g.move(0, 1).kind, 'swap');
});

test('moving into an empty cell moves the item', () => {
  const g = mk();
  g.s.cells[0] = { chain: 'seed', level: 1 };
  assert.equal(g.move(0, 5).kind, 'move');
  assert.ok(g.s.cells[5] && !g.s.cells[0]);
});

test('merging beside a third matching item gives a bonus coin', () => {
  const g = mk();
  g.s.cells[at(3, 3)] = { chain: 'leaf', level: 1 };
  g.s.cells[at(3, 4)] = { chain: 'leaf', level: 1 };
  g.s.cells[at(3, 5)] = { chain: 'leaf', level: 1 };
  const r = g.move(at(3, 3), at(3, 4));
  assert.ok(r.bonus);
  assert.equal(g.s.cells[at(3, 5)], null);
  assert.ok(g.s.cells.some((c) => c && c.chain === 'coin'));
});

test('generator spends energy, fills nearest empty cell and uses a charge', () => {
  const g = mk();
  g.s.cells[at(0, 0)] = { chain: 'gen_seed', level: 1, charges: GG.genMaxCharges(1) };
  const e0 = g.s.energy;
  const r = g.tap(at(0, 0));
  assert.ok(r.ok);
  assert.equal(g.s.energy, e0 - 1);
  assert.equal(g.s.cells[at(0, 0)].charges, GG.genMaxCharges(1) - 1);
  assert.equal(g.s.cells.filter(Boolean).length, 2);
});

test('full board blocks production and keeps energy', () => {
  const g = mk();
  g.s.cells.fill({ chain: 'seed', level: 1 });
  g.s.cells[0] = { chain: 'gen_seed', level: 1, charges: 6 };
  const e0 = g.s.energy;
  const r = g.tap(0);
  assert.equal(r.ok, false);
  assert.equal(g.s.energy, e0);
});

test('no energy blocks production', () => {
  const g = mk();
  g.s.cells[0] = { chain: 'gen_seed', level: 1, charges: 6 };
  g.s.energy = 0; g.s.energyAt = g.clock();
  const r = g.tap(0);
  assert.equal(r.ok, false);
  assert.ok(r.needEnergy);
});

test('energy regenerates over time and caps at max', () => {
  const g = mk();
  g.s.energy = 10; g.s.energyAt = g.clock();
  g.advance(T.energyRegenMs * 5);
  assert.equal(g.s.energy, 15);
  g.advance(T.energyRegenMs * 1000);
  assert.equal(g.s.energy, T.energyMax);
});

test('generator recharges after running out of charges', () => {
  const g = mk();
  g.s.cells[0] = { chain: 'gen_seed', level: 1, charges: 1 };
  g.tap(0);
  assert.ok(g.s.cells[0].rechargeAt);
  assert.equal(g.tap(0).ok, false);
  g.advance(T.genRechargeMs + 1);
  assert.equal(g.s.cells[0].charges, GG.genMaxCharges(1));
});

test('currency items pay out when tapped', () => {
  const g = mk();
  g.s.cells[0] = { chain: 'coin', level: 2 };
  const c0 = g.s.coins;
  g.tap(0);
  assert.equal(g.s.coins, c0 + 6);
  assert.equal(g.s.cells[0], null);
});

test('selling an ingredient pays 2^(level-1)', () => {
  const g = mk();
  g.s.cells[0] = { chain: 'flour', level: 4 };
  const c0 = g.s.coins;
  g.sell(0);
  assert.equal(g.s.coins, c0 + 8);
  assert.equal(g.sell(1).ok, false);
});

test('gift boxes unlock on a timer, one at a time, then open', () => {
  const g = mk();
  g.s.cells[0] = { chain: 'gift', level: 1 };
  g.s.cells[1] = { chain: 'gift', level: 1 };
  assert.ok(g.tap(0).ok);
  assert.equal(g.tap(1).ok, false);
  assert.equal(g.tap(0).ok, false);
  g.advance(T.giftUnlockMs[1] + 1);
  assert.ok(g.tap(0).ok);
  assert.equal(g.s.cells[0] === null || g.s.cells[0].chain !== 'gift', true);
  assert.ok(g.s.cells.filter((c) => c && c.chain !== 'gift').length >= T.giftItemCount[1]);
});

test('gift speed-up costs gems and makes it openable', () => {
  const g = mk();
  g.s.cells[0] = { chain: 'gift', level: 2 };
  g.tap(0);
  const gems = g.s.gems;
  assert.ok(g.speedUp(0).ok);
  assert.ok(g.s.gems < gems);
  assert.ok(g.tap(0).ok);
});

test('bubbles can be bought with gems or burst into coins', () => {
  const g = mk();
  g.s.cells[0] = { chain: 'seed', level: 2, bubbleUntil: g.clock() + 1000 };
  g.s.cells[1] = { chain: 'seed', level: 2, bubbleUntil: g.clock() + 1000 };
  assert.equal(g.move(0, 1).ok, false);
  assert.ok(g.buyBubble(0).ok);
  assert.equal(g.s.cells[0].bubbleUntil, undefined);
  g.advance(2000);
  assert.equal(g.s.cells[1].chain, 'coin');
});

test('orders: can only serve with the items, then pay and refill the slot', () => {
  const g = mk();
  g.s.orders = [{ id: 99, wants: [{ chain: 'leaf', level: 2 }], reward: { coins: 6, energy: 2, gems: 0, stars: 1 } }];
  g.s.nextOrderId = 100;
  assert.equal(g.serve(99).ok, false);
  g.s.cells[3] = { chain: 'leaf', level: 2 };
  const c0 = g.s.coins;
  assert.ok(g.serve(99).ok);
  assert.equal(g.s.coins, c0 + 6);
  assert.equal(g.s.cells[3], null);
  assert.equal(g.s.orders.length, 1);
  assert.equal(g.s.stars, 1);
});

test('generated orders are always satisfiable from reachable levels', () => {
  const g = mk();
  for (let k = 0; k < 200; k++) {
    g.s.orders = [];
    g.s.stars = k;
    g.addOrder();
    for (const w of g.s.orders[0].wants) {
      assert.ok(w.level >= T.orderMinLevel && w.level <= T.orderMaxLevelCap);
      assert.ok(w.level <= GG.maxLevel(w.chain));
    }
  }
});

test('new game state is valid and playable', () => {
  const s = Game.newState(5, 1);
  const g = new Game(s, () => 5);
  assert.equal(s.orders.length, T.orderSlots);
  assert.equal(s.cells.length, T.cols * T.rows);
  assert.ok(g.s.cells.some((c) => c && c.chain.startsWith('gen_')));
});

test('save and load round trip, and bad data falls back to a new game', () => {
  const g = mk();
  g.s.coins = 777;
  const g2 = Game.load(g.serialize(), () => 1);
  assert.equal(g2.s.coins, 777);
  const g3 = Game.load('not json', () => 1);
  assert.equal(g3.s.cells.length, T.cols * T.rows);
});

test('rng is deterministic for the same seed', () => {
  const a = new Game(Game.newState(1, 42), () => 1);
  const b = new Game(Game.newState(1, 42), () => 1);
  assert.equal(JSON.stringify(a.s.orders), JSON.stringify(b.s.orders));
});

test('items made by generators, vines, gifts and scissors remember where they came from', () => {
  const g = new Game(Game.newState(1700000000000, 4), () => 1700000000000);
  g.s.cells.fill(null); g.s.orders = [];
  g.s.cells[20] = { chain: 'gen_seed', level: 1, charges: 5 };
  g.fx.length = 0;
  assert.ok(g.tap(20).ok);
  const sp = g.fx.filter((f) => f.type === 'spawn');
  assert.equal(sp.length, 1);
  assert.equal(sp[0].from, 20);
  assert.notEqual(sp[0].i, 20);
  // placing without a source (a reward, a retrieved item) carries no origin
  g.fx.length = 0;
  g.place(g.mk('seed', 1), 5);
  assert.equal(g.fx[0].from, undefined);
});
