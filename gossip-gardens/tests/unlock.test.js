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
const { Game, CHAINS, CHAIN_UNLOCK, xpForLevel } = loadGG();
const GG_XP = (L) => xpForLevel(L);

test('new players start with just two chains', () => {
  const g = new Game(Game.newState(Date.now(), 3));
  assert.deepEqual(g.chainPool().sort(), ['leaf', 'seed']);
});

test('reaching a level unlocks its chain and hands out the first machine once', () => {
  const g = new Game(Game.newState(Date.now(), 3));
  g.s.cells.fill(null);
  g.s.xp = 1e6; // far past every unlock level
  g.tick();
  for (const c of Object.keys(CHAIN_UNLOCK)) {
    assert.ok(g.chainPool().includes(c), c);
    assert.equal(g.s.cells.filter((x) => x && x.chain === 'gen_' + c).length, 1, 'machine for ' + c);
  }
  g.tick(); g.tick();
  assert.equal(g.s.cells.filter((x) => x && x.chain === 'gen_garden').length, 1);
});

test('orders never ask for a level beyond a chain\'s top level and use unlocked chains only', () => {
  const g = new Game(Game.newState(Date.now(), 9));
  for (let k = 0; k < 200; k++) {
    for (const w of g.makeOrder().wants) {
      assert.ok(g.chainPool().includes(w.chain));
      assert.ok(w.level <= CHAINS[w.chain].names.length);
    }
  }
});

test('a full board delays the machine instead of losing it', () => {
  const g = new Game(Game.newState(Date.now(), 3));
  g.s.cells.fill({ chain: 'seed', level: 1 }); g.s.locks = {};
  g.s.xp = 1e6; g.tick();
  assert.ok(!g.s.unlocked || !g.s.unlocked.flour);
  g.s.cells[5] = null; g.tick();
  assert.ok(g.s.unlocked.flour);
});

test('a new board starts with two machines and no free vine', () => {
  const g = new Game(Game.newState(Date.now(), 3));
  const gens = g.s.cells.filter((c) => c && CHAINS[c.chain].role === 'generator').map((c) => c.chain).sort();
  assert.deepEqual(gens, ['gen_leaf', 'gen_seed']);
});

test('older saves that already own a machine are not given a second one at the unlock level', () => {
  const g = new Game(Game.newState(Date.now(), 3));
  g.s.cells[40] = g.mk('gen_flour', 1);
  g.s.xp = 1e6; g.tick();
  assert.equal(g.s.cells.filter((x) => x && x.chain === 'gen_flour').length, 1);
});

test('no machine drops from gifts or sand early in the game', () => {
  const g = new Game(Game.newState(Date.now(), 3));
  g.s.cells.fill(null); g.s.orders = [];
  for (let k = 0; k < 400; k++) {
    g.s.cells.fill(null);
    g.s.xp = 0; g.s.cells[0] = { chain: 'gift', level: 1 };
    g.openGift(0);
    assert.ok(!g.s.cells.some((c) => c && CHAINS[c.chain].role === 'generator'));
  }
});
