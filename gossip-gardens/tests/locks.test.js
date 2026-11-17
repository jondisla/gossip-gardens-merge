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

test('a new game locks the bottom rows and webs a few starter items', () => {
  const g = fresh();
  assert.equal(Object.keys(g.s.locks).length, T.lockedRows.length * C);
  assert.equal(g.s.locks[(T.rows - 1) * C].cost, T.lockCostCorner);
  assert.equal(g.s.locks[7 * C + 3].cost, T.lockCost[7]);
  assert.equal(g.s.cells.filter((c) => c && c.web).length, T.webStart.length);
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
  const plain = 7 * C, prize = Number(Object.keys(T.lockPrizes)[0]);
  g.s.energy = 20;
  const r = g.unlock(plain);
  assert.equal(r.ok, false); assert.ok(r.needEnergy); assert.ok(g.s.locks[plain]);
  g.s.energy = 100;
  assert.ok(g.unlock(plain).ok);
  assert.equal(g.s.locks[plain], undefined);
  assert.equal(g.s.energy, 100 - T.lockCost[7]);
  assert.ok(g.unlock(prize).ok);
  assert.ok(g.s.cells[prize], 'prize appears');
  assert.equal(g.unlock(prize).ok, false);
});

test('you cannot drop an item onto a locked tile', () => {
  const g = fresh();
  g.s.cells.fill(null);
  g.s.cells[0] = g.mk('seed', 1);
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
  assert.ok(g.notes.some((n) => /cobweb/i.test(n)));
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
  g.s.cells.fill(null); g.s.orders = [];
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
