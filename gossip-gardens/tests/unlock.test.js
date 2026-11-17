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
const { Game, CHAINS, CHAIN_UNLOCK } = loadGG();

test('new players only meet the four core chains', () => {
  const g = new Game(Game.newState(Date.now(), 3));
  assert.deepEqual(g.chainPool().sort(), ['flour', 'leaf', 'paper', 'seed']);
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
  g.s.cells.fill({ chain: 'seed', level: 1 });
  g.s.xp = 1e6; g.tick();
  assert.ok(!g.s.unlocked || !g.s.unlocked.garden);
  g.s.cells[5] = null; g.tick();
  assert.ok(g.s.unlocked.garden);
});
