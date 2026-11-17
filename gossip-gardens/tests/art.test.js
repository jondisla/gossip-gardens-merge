'use strict';
// Checks that art.js wires up pictures that really exist, so a missing mapping or file is caught here
// instead of showing the old drawn fallbacks (or crashing a popup) in the game.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
function loadGG() {
  const ctx = vm.createContext({ console, Date });
  ctx.globalThis = ctx;
  for (const f of ['data.js', 'game.js', 'story.js', 'meta.js', 'art.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
  }
  return ctx.GG;
}
const GG = loadGG();
const exists = (rel) => fs.existsSync(path.join(root, rel));

test('every story character has a portrait picture that exists', () => {
  assert.ok(GG.portraitImages, 'GG.portraitImages is missing');
  for (const id of Object.keys(GG.STORY.CHARS)) {
    assert.ok(GG.portraitImages[id], 'no portrait for ' + id);
    assert.ok(exists(GG.portraitImages[id]), 'missing file ' + GG.portraitImages[id]);
  }
  for (const [id, f] of Object.entries(GG.avatarExtra || {})) assert.ok(exists(f), 'missing avatar file for ' + id + ': ' + f);
});

test('every spot has a background and six piece positions', () => {
  const S = GG.STORY;
  assert.equal(GG.repairLayout.length, S.VIEWS.length);
  S.VIEWS.forEach((v, i) => {
    assert.equal(GG.repairLayout[i].length, 6, 'layout of view ' + i);
    GG.repairLayout[i].forEach((p) => { assert.equal(p.length, 3); p.forEach((n) => assert.ok(n > 0 && n <= 100)); });
    const file = 'art/scenes/area_' + (v.area + 1) + '_spot_' + (v.spot + 1) + '.webp';
    assert.ok(exists(file), 'missing ' + file);
  });
});

test('item, icon, extra and repair pictures all exist', () => {
  for (const f of Object.values(GG.imageOverrides)) assert.ok(exists(f), 'missing ' + f);
  for (const f of Object.values(GG.iconImages || {})) assert.ok(exists(f), 'missing ' + f);
  for (const f of Object.values(GG.extraImages || {})) assert.ok(exists(f), 'missing ' + f);
  const alias = GG.plotAlias || {};
  for (const [k, pair] of Object.entries(GG.plotImages || {})) {
    if (alias[k]) {                       // a new repair: its own art is optional, but the placeholder must exist
      assert.ok(GG.plotImages[alias[k]] && !alias[alias[k]], 'placeholder for ' + k);
      GG.plotImages[alias[k]].forEach((f) => assert.ok(exists(f), 'missing placeholder ' + f));
    } else pair.forEach((f) => assert.ok(exists(f), 'missing ' + f + ' (' + k + ')'));
  }
  for (const t of GG.STORY.TASKS) assert.ok(GG.plotImages[t.kind], 'no repair picture for kind ' + t.kind);
});
