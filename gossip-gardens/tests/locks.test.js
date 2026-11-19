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
const { Game, TUNING: T } = loadGG();
const fresh = () => new Game(Game.newState(1700000000000, 5), () => 1700000000000);
const C = T.cols;

test('a new game covers about two thirds of the board with sand and webs, keeping a small open patch', () => {
  const g = fresh();
  const keys = Object.keys(g.s.locks).map(Number);
  assert.equal(keys.length, T.sandEnergy + T.sandNear);
  assert.equal(keys.filter((i) => g.s.locks[i].near).length, T.sandNear);
  assert.equal(g.s.cells.filter((c) => c && c.web).length, T.webCount);
  keys.forEach((i) => { assert.equal(g.s.cells[i], null); });
  const empty = g.s.cells.filter((c, i) => !c && !g.s.locks[i]).length;
  assert.ok(empty >= 4 && empty <= 10, 'a small open patch: ' + empty + ' empty cells');
  assert.ok((keys.length + T.webCount) / g.s.cells.length >= 0.65, 'mostly covered');
  const rows = new Set(keys.map((i) => Math.floor(i / C)));
  assert.ok(rows.size >= 4, 'sand is spread over several rows');
  keys.filter((i) => g.s.locks[i].near).forEach((i) => assert.ok(g.s.locks[i].prize, 'near sand hides a prize'));
});

test('boards differ between seeds', () => {
  const a = Object.keys(new Game(Game.newState(1700000000000, 5), () => 1).s.locks).join();
  const b = Object.keys(new Game(Game.newState(1700000000000, 99), () => 1).s.locks).join();
  assert.notEqual(a, b);
});

test('near sand costs no energy to tap, but clears and reveals its prize when you merge beside it', () => {
  const g = fresh();
  g.s.cells.fill(null); g.s.locks = { 24: { cost: 0, near: true, prize: { chain: 'gift', level: 2 } } };
  g.s.energy = 100;
  const r = g.unlock(24);
  assert.equal(r.ok, false); assert.equal(g.s.energy, 100); assert.ok(g.s.locks[24]);
  g.s.cells[17] = g.mk('seed', 1); g.s.cells[16] = g.mk('seed', 1);
  assert.ok(g.move(16, 17).ok);
  assert.equal(g.s.locks[24], undefined);
  assert.equal(g.s.cells[24].chain, 'gift'); assert.equal(g.s.cells[24].level, 2);
});

test('items never land on locked tiles', () => {
  const g = fresh();
  g.s.cells.fill(null);
  for (let k = 0; k < 80; k++) g.place(g.mk('seed', 1), 0);
  g.s.cells.forEach((c, i) => { if (g.s.locks[i]) assert.equal(c, null, 'cell ' + i); });
  assert.equal(g.emptyCount(), 0);
});

test('unlocking costs energy, opens the tile and reveals a prize', () => {
  const g = fresh();
  g.s.cells.fill(null);
  const plain = 7 * C, prize = 7 * C + 1;
  g.s.locks = { [plain]: { cost: 30 }, [prize]: { cost: 30, prize: { chain: 'gift', level: 1 } } };
  g.s.energy = 20;
  const r = g.unlock(plain);
  assert.equal(r.ok, false); assert.ok(r.needEnergy); assert.ok(g.s.locks[plain]);
  g.s.energy = 100;
  assert.ok(g.unlock(plain).ok);
  assert.equal(g.s.locks[plain], undefined);
  assert.equal(g.s.energy, 100 - 30);
  assert.ok(g.unlock(prize).ok);
  assert.ok(g.s.cells[prize], 'prize appears');
  assert.equal(g.unlock(prize).ok, false);
});

test('you cannot drop an item onto a locked tile', () => {
  const g = fresh();
  g.s.cells.fill(null);
  g.s.cells[0] = g.mk('seed', 1);
  g.s.locks[7 * C + 1] = { cost: 30 };
  const r = g.move(0, 7 * C + 1);
  assert.equal(r.ok, false);
  assert.ok(g.s.cells[0]);
});

test('webbed items are frozen: no tap, move, merge, sell, store or order use', () => {
  const g = fresh();
  g.s.cells.fill(null); g.s.orders = [];
  const a = g.mk('seed', 2); a.web = true;
  g.s.cells[10] = a; g.s.cells[11] = g.mk('seed', 2); g.s.cells[12] = g.mk('seed', 1);
  assert.equal(g.tap(10).ok, false);
  assert.equal(g.move(10, 11).ok, false);
  assert.equal(g.move(12, 10).ok, false);   // a non-matching item cannot go onto a webbed one
  assert.equal(g.move(10, 20).ok, false);
  assert.equal(g.sell(10).ok, false);
  assert.equal(g.store(10).ok, false);
  assert.equal(g.count('seed', 2), 1); // only the free one counts
  g.s.orders = [{ id: 1, wants: [{ chain: 'seed', level: 2 }, { chain: 'seed', level: 2 }], reward: { coins: 1, energy: 1, gems: 0, stars: 1 } }];
  assert.equal(g.canServe(g.s.orders[0]), false);
});

test('merging next to a web clears it', () => {
  const g = fresh();
  g.s.cells.fill(null);
  const w = g.mk('leaf', 3); w.web = true;
  g.s.cells[24] = w;                       // row 3, col 3
  g.s.cells[17] = g.mk('seed', 1);         // row 2, col 3 (directly above the web)
  g.s.cells[16] = g.mk('seed', 1);
  assert.ok(g.move(16, 17).ok);            // merge in the cell above
  assert.equal(g.s.cells[24].web, undefined);
  assert.ok(g.fx.some((f) => f.type === 'pop' && f.i === 24));   // the pop animation is the feedback
});

test('a merge far from a web leaves it alone', () => {
  const g = fresh();
  g.s.cells.fill(null);
  const w = g.mk('leaf', 3); w.web = true; g.s.cells[24] = w;
  g.s.cells[0] = g.mk('seed', 1); g.s.cells[1] = g.mk('seed', 1);
  assert.ok(g.move(0, 1).ok);
  assert.equal(g.s.cells[24].web, true);
});

test('older saves load with no locked tiles', () => {
  const g = fresh();
  const old = JSON.parse(g.serialize());
  delete old.locks;
  const g2 = Game.load(JSON.stringify(old), () => 1700000000000);
  assert.deepEqual(g2.s.locks, {});
  assert.ok(g2.emptyCount() > 0);
});

test('merging a matching item into a webbed item frees it', () => {
  const g = fresh();
  g.s.cells.fill(null); g.s.orders = []; g.s.locks = {};
  const w = g.mk('seed', 2); w.web = true;
  g.s.cells[10] = w; g.s.cells[11] = g.mk('seed', 2);
  const r = g.move(11, 10);
  assert.ok(r.ok && r.kind === 'merge');
  assert.equal(g.s.cells[11], null);
  assert.equal(g.s.cells[10].level, 3);
  assert.equal(g.s.cells[10].web, undefined);
});

test('a webbed item still cannot be dragged away, even onto a matching item', () => {
  const g = fresh();
  g.s.cells.fill(null);
  const w = g.mk('seed', 2); w.web = true;
  g.s.cells[10] = w; g.s.cells[11] = g.mk('seed', 2);
  assert.equal(g.move(10, 11).ok, false);
  assert.equal(g.s.cells[10].web, true);
});

test('merging beside sand opens one neighbouring tile plus one more nearby, not every side', () => {
  const g = fresh();
  g.s.cells.fill(null);
  const mkLock = () => ({ cost: 0, near: true, prize: { chain: 'seed', level: 3 } });
  // the merge happens at cell 24 (row 3, col 3 on a 7-wide board); sand on all four sides and a few more around
  const C2 = T.cols;
  g.s.locks = {};
  [24 - 1, 24 + 1, 24 - C2, 24 + C2, 24 + 2 * C2, 24 - 2 * C2].forEach((j) => { g.s.locks[j] = mkLock(); });
  g.s.cells[24 - 2] = null;
  const n0 = Object.keys(g.s.locks).length;
  g.clearWebs(24);
  const left = Object.keys(g.s.locks).length;
  assert.equal(n0 - left, 2, 'exactly two sand tiles open per merge');
});

test('a buried item can be sand AND cobweb: the sand clears but the web stays until another merge', () => {
  const g = fresh();
  g.s.cells.fill(null); g.s.locks = { 10: { cost: 0, near: true, prize: { chain: 'seed', level: 3, web: true } } };
  g.clearWebs(11);                                   // a merge beside the sand
  assert.equal(g.s.locks[10], undefined);
  assert.ok(g.s.cells[10] && g.s.cells[10].web, 'the item comes up still webbed');
  g.clearWebs(11);                                   // another merge beside it frees it
  assert.ok(!g.s.cells[10].web);
  g.s.locks = { 20: { cost: 20, prize: { chain: 'seed', level: 2, web: true } } };
  g.s.energy = 100; assert.ok(g.unlock(20).ok);      // energy sand behaves the same way
  assert.ok(g.s.cells[20].web);
});

test('coins, gems and energy buried in sand are collected on the spot and shown in a Collect Rewards window', () => {
  const g = fresh();
  g.s.cells.fill(null); g.s.locks = { 5: { cost: 10, prize: { chain: 'bolt', level: 1 } }, 6: { cost: 0, near: true, prize: { chain: 'coin', level: 2 } } };
  g.s.energy = 50; g.s.coins = 0;
  assert.ok(g.unlock(5).ok);
  assert.equal(g.s.cells[5], null);                                   // no item on the board: it was paid out
  assert.equal(g.s.energy, 50 - 10 + 2);
  assert.equal(g.popups[g.popups.length - 1].kind, 'reward');
  g.clearWebs(13);                                                      // a merge below cell 6 opens the near sand
  assert.equal(g.s.coins, 6);
  assert.equal(g.popups.filter((p) => p.kind === 'reward').length, 1, 'rewards from one action share one window');
  assert.equal(g.popups[0].reward.coins, 6);
});
