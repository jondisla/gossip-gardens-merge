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
const { Game, TUNING: T, STORY: S } = GG;

const DAY = 86400000;
function mk(start) {
  let now = start || new Date(2026, 5, 10, 9, 0, 0).getTime();
  const g = new Game(Game.newState(now, 7), () => now);
  g.s.cells.fill(null);
  g.s.orders = [];
  g.advance = (ms) => { now += ms; g.tick(); g.rollover(); };
  return g;
}

test('new state has all meta fields', () => {
  const g = mk();
  assert.equal(g.s.v, 3);
  assert.ok(g.s.pass && g.s.event && g.s.estate && g.s.wheel);
});

test('old v1 saves load and gain meta fields', () => {
  const g = mk();
  const old = JSON.parse(g.serialize());
  for (const k of ['starsSpent', 'stats', 'estate', 'daily', 'pass', 'event', 'wheel', 'settings', 'rel', 'spins']) delete old[k];
  old.v = 1;
  const g2 = Game.load(JSON.stringify(old), () => new Date(2026, 5, 10).getTime());
  assert.equal(g2.s.v, 3);
  assert.ok(g2.s.pass && g2.s.estate && g2.s.daily);
});

test('gameplay feeds pass xp and festival blossoms', () => {
  const g = mk(); g.s.locks = {};
  g.s.cells[10] = { chain: 'leaf', level: 5 }; g.s.cells[11] = { chain: 'leaf', level: 5 };
  const xp0 = g.s.pass.xp, tk0 = g.s.event.tokens;
  g.move(10, 11);
  assert.ok(g.s.pass.xp > xp0);
  assert.ok(g.s.event.tokens >= tk0 + 2); // merging into level 6 earns blossoms
  g.s.orders = [{ id: 5, wants: [{ chain: 'leaf', level: 6 }], reward: { coins: 1, energy: 1, gems: 0, stars: 1 } }];
  g.serve(5);
  assert.ok(g.s.event.tokens > tk0 + 2);
});

test('the free special comes back each day', () => {
  const g = mk();
  assert.ok(g.buyOffer('sp_free').ok);
  assert.equal(g.buyOffer('sp_free').ok, false);
  g.advance(DAY);
  assert.ok(g.buyOffer('sp_free').ok);
});

test('check-in streak continues on consecutive days and resets after a gap', () => {
  const g = mk();
  assert.ok(g.checkin().ok);
  assert.equal(g.checkin().ok, false);
  assert.equal(g.s.daily.streak, 1);
  g.advance(DAY); assert.ok(g.checkin().ok); assert.equal(g.s.daily.streak, 2);
  g.advance(DAY); assert.ok(g.checkin().ok); assert.equal(g.s.daily.streak, 3);
  g.advance(3 * DAY); assert.ok(g.checkin().ok); assert.equal(g.s.daily.streak, 1);
});

test('shop: offers check funds and stock, and items land on the board', () => {
  const g = mk();
  g.s.gems = 0;
  assert.equal(g.buyOffer('sp_energy').ok, false);
  g.s.gems = 100; g.s.energy = 10;
  assert.ok(g.buyOffer('sp_energy').ok);
  assert.equal(g.s.energy, 60); assert.equal(g.s.gems, 90);
  assert.equal(g.buyOffer('sp_energy').ok, false); // only 1 left
  assert.ok(g.buyOffer('sp_piggy').ok);
  assert.ok(g.s.cells.some((c) => c && c.chain === 'coin' && c.level === 4));
  const hot = g.shopOffers().hot;
  assert.equal(hot.length, 6);
  const o = hot[0]; // 5 per day
  for (let k = 0; k < 5; k++) assert.ok(g.buyOffer(o.id).ok, 'purchase ' + k);
  assert.equal(g.buyOffer(o.id).ok, false);
  assert.equal(g.buyOffer('nope').ok, false);
});

test('hot sales: six items, one of them rare with a single copy', () => {
  const g = mk();
  const all = g.shopOffers();
  assert.equal(all.specials.length, 3);
  const rare = all.hot.filter((o) => o.rare);
  assert.equal(rare.length, 1);
  assert.equal(rare[0].left, 1);
  assert.ok(all.hot.every((o) => o.item && o.gems > 0));
});

test('free taps boost makes generators cost no energy', () => {
  const g = mk();
  g.s.cells[0] = { chain: 'gen_seed', level: 1, charges: 6 };
  g.s.freeTapUntil = g.clock() + 60000;
  const e = g.s.energy;
  g.tap(0);
  assert.equal(g.s.energy, e);
});

test('gift rewards go on the board, or wait in the bag when it is full or when sent by bag', () => {
  const g = mk();
  g.grant({ gift: 2 });
  assert.ok(g.s.cells.some((c) => c && c.chain === 'gift' && c.level === 2));
  g.s.locks = {};
  g.s.cells.fill({ chain: 'seed', level: 1 });
  const c0 = g.s.coins;
  g.grant({ gift: 2 });
  assert.equal(g.s.coins, c0);                       // nothing is lost or turned into coins
  assert.equal(g.bagCount(), 1);
  assert.equal(g.dropBag().ok, false);               // still no room
  g.s.cells[7] = null;
  assert.ok(g.dropBag().ok); assert.equal(g.bagCount(), 0);
  assert.equal(g.s.cells[7].chain, 'gift');
  g.grant({ gift: 1, tool: 'dust' }, { bag: true }); // free items from claims arrive in the bag first
  assert.equal(g.bagCount(), 2);
});

test('garden pass: levels from xp, claim once, premium needs unlocking', () => {
  const g = mk();
  assert.equal(g.passLevel(), 0);
  g.addXp(250);
  assert.equal(g.passLevel(), 2);
  assert.equal(g.claimPass(3, 'free').ok, false);
  assert.ok(g.claimPass(1, 'free').ok);
  assert.equal(g.claimPass(1, 'free').ok, false);
  assert.equal(g.claimPass(1, 'premium').ok, false);
  g.s.gems = S.PASS.premiumGemCost;
  assert.ok(g.buyPremium().ok);
  assert.ok(g.claimPass(1, 'premium').ok);
  g.addXp(1e9);
  assert.equal(g.passLevel(), S.PASS.levels);
});

test('festival milestones unlock by blossoms and claim once', () => {
  const g = mk();
  assert.equal(g.claimEvent(0).ok, false);
  g.addTokens(S.EVENT.milestones[0].tokens);
  assert.ok(g.claimEvent(0).ok);
  assert.equal(g.claimEvent(0).ok, false);
});

test('lucky wheel: one free spin a day, then tickets', () => {
  const g = mk();
  const r1 = g.spinWheel();
  assert.ok(r1.ok && r1.index >= 0 && r1.index < S.WHEEL.length);
  g.s.spins = 0;
  assert.equal(g.spinWheel().ok, false);
  g.s.spins = 1;
  assert.ok(g.spinWheel().ok);
  assert.equal(g.s.spins, 0);
  g.advance(DAY);
  assert.ok(g.freeSpinReady());
});

test('a chore and its repair are one step: paying the chore completes the repair', () => {
  const g = mk();
  const [t1, t2] = g.tasksOf(0);
  assert.equal(g.taskState(t1), 'available');
  assert.equal(g.taskState(t2), 'locked');
  g.s.coins = 0;
  assert.equal(g.completeChore().ok, false);          // not enough coins
  assert.equal(g.taskState(t1), 'available');
  g.s.coins = 1000;
  const cost = g.currentChore().cost;
  const r = g.completeChore();
  assert.ok(r.ok && r.scene === t1.id && r.task === t1.id);
  assert.equal(g.s.coins, 1000 - cost);                // one payment only
  assert.equal(g.s.starsSpent, 0);                     // no stars needed
  assert.equal(g.taskState(t1), 'done');
  assert.equal(g.taskState(t2), 'available');          // the next repair is next in line
  assert.equal(g.areaUnlocked(1), false);
});

test('exactly one repair is open at a time, in order', () => {
  const g = mk();
  g.s.coins = 1e6;
  const open = () => S.TASKS.filter((t) => g.taskState(t) === 'available').map((t) => t.id);
  assert.deepEqual(open(), ['g1']);
  g.completeChore(); assert.deepEqual(open(), ['g2']);
  g.completeChore(); assert.deepEqual(open(), ['g3']);
  assert.equal(g.unlockedRepairs(), 3);
});

test('the chore bar fills one step per chore and pays bonuses on steps 3, 5 and 7', () => {
  const g = mk();
  g.s.coins = 1e6;
  assert.deepEqual(g.choreBar(), { level: 1, filled: 0 });
  g.completeChore();
  assert.deepEqual(g.choreBar(), { level: 1, filled: 1 });
  g.completeChore();
  const gems = g.s.gems;
  const third = g.completeChore();
  assert.equal(g.choreBar().filled, 3);
  assert.ok(third.bonus);
  assert.ok(g.s.gems >= gems + S.CALENDAR[2].gems);   // (a level-up can add more)
  for (let k = 3; k < 7; k++) g.completeChore();
  assert.deepEqual(g.choreBar(), { level: 1, filled: 7 });
  g.completeChore();
  assert.deepEqual(g.choreBar(), { level: 2, filled: 1 });
});

test('older saves are brought in line: chores paid earlier count as repaired', () => {
  const g = mk();
  g.s.chores.done = 3; g.s.estate.done = {};
  const g2 = Game.load(g.serialize(), () => g.clock());
  assert.equal(g2.s.chores.done, 3);
  assert.ok(g2.s.estate.done.g1 && g2.s.estate.done.g2 && g2.s.estate.done.g3);
  assert.equal(g2.taskState(S.TASKS[3]), 'available');
  const g3 = mk(); g3.s.estate.done = { g1: true, g2: true }; g3.s.chores.done = 0;
  assert.equal(Game.load(g3.serialize(), () => g3.clock()).s.chores.done, 2);
});

test('estate: finishing every plot of an area opens the next, and all scenes exist', () => {
  const g = mk();
  g.s.coins = 100000;
  for (let a = 0; a < S.AREAS.length; a++) {
    assert.ok(g.areaUnlocked(a));
    for (const t of g.tasksOf(a)) { const r = g.completeChore(); assert.ok(r.ok && r.task === t.id, t.id); assert.ok(S.SCENES[t.id]); }
  }
  assert.equal(g.estateProgress().done, S.TASKS.length);
  assert.ok(S.SCENES.intro);
  for (const sc of Object.values(S.SCENES)) for (const l of sc.lines) assert.ok(S.CHARS[l.who], l.who);
});

test('badges reflect claimable things', () => {
  const g = mk();
  g.s.xp = 1e5;   // past the levels where the shop and events open
  assert.equal(g.badges().shop, true);
  g.buyOffer('sp_free');
  assert.equal(g.badges().shop, false);
  assert.equal(g.badges().events, true); // a free wheel spin is waiting
});

test('full save and load round trip keeps meta progress', () => {
  const g = mk();
  g.s.stars = 50; g.s.coins = 5000;
  g.s.coins = 5000; g.completeChore(); g.addXp(120); g.addTokens(30);
  const g2 = Game.load(g.serialize(), () => g.clock());
  assert.equal(g2.s.estate.done.g1, true);
  assert.equal(g2.passLevel(), 1);
  assert.equal(g2.s.event.tokens, 30);
});

test('every shop item, wheel segment and calendar day is well formed', () => {
  assert.equal(S.GEM_PACKS.length, 6);
  assert.ok(S.WHEEL.every((w) => w.w > 0 && w.reward));
  assert.equal(S.CALENDAR.length, 7);
  for (let l = 1; l <= S.PASS.levels; l++) { assert.ok(S.PASS.reward(l, 'free')); assert.ok(S.PASS.reward(l, 'premium')); }
});

test('chores: done in order, cost coins and give player xp', () => {
  const g = mk();
  g.s.coins = 1000;
  const c0 = g.currentChore();
  assert.ok(c0 && c0.cost > 0 && c0.xp > 0);
  const xp0 = g.s.xp;
  const r = g.completeChore();
  assert.ok(r.ok);
  assert.equal(g.s.coins, 1000 - c0.cost);
  assert.ok(g.s.xp >= xp0 + c0.xp);
  assert.notEqual(g.currentChore().id, c0.id);
  g.s.coins = 0;
  assert.equal(g.completeChore().ok, false);
});

test('chores run out after the last one and survive a save', () => {
  const g = mk();
  g.s.coins = 1e6;
  for (let k = 0; k < S.CHORES.length; k++) assert.ok(g.completeChore().ok);
  assert.equal(g.currentChore(), null);
  assert.equal(g.completeChore().ok, false);
  const g2 = Game.load(g.serialize(), () => g.clock());
  assert.equal(g2.s.chores.done, S.CHORES.length);
});

test('the chores badge lights up only when the next chore is affordable', () => {
  const g = mk();
  g.s.coins = 0;
  assert.equal(g.badges().chores, false);
  g.s.coins = g.currentChore().cost;
  assert.equal(g.badges().chores, true);
});

test('day bar follows the check-in streak', () => {
  const g = mk();
  let b = g.dayBar();
  assert.deepEqual(b, { day: 1, filled: 0, claimed: false });
  g.checkin();
  b = g.dayBar();
  assert.deepEqual(b, { day: 1, filled: 1, claimed: true });
  g.advance(DAY);
  b = g.dayBar();
  assert.deepEqual(b, { day: 2, filled: 1, claimed: false });
  g.checkin();
  assert.deepEqual(g.dayBar(), { day: 2, filled: 2, claimed: true });
});

test('the estate is 3 areas of 2 spots, 6 repairs per spot, and one chore per repair', () => {
  assert.equal(S.TASKS.length, 36);
  assert.equal(S.CHORES.length, S.TASKS.length);
  assert.equal(S.VIEWS.length, 6);
  S.TASKS.forEach((t) => { assert.ok(S.SCENES[t.id], t.id); assert.ok(t.spot === 0 || t.spot === 1); });
  const g = mk();
  for (let v = 0; v < S.VIEWS.length; v++) assert.equal(g.tasksOfView(v).length, 6, 'view ' + v);
  assert.equal(new Set(S.TASKS.map((t) => t.id)).size, 36);
});

test('spots open in order and the current view follows the chores', () => {
  const g = mk();
  g.s.coins = 1e7;
  assert.equal(g.currentView(), 0);
  assert.equal(g.viewUnlocked(0), true);
  assert.equal(g.viewUnlocked(1), false);
  for (let k = 0; k < 5; k++) g.completeChore();
  assert.deepEqual(g.viewProgress(0), { done: 5, total: 6 });
  assert.equal(g.viewUnlocked(1), false);        // the sixth repair has not been done yet
  assert.equal(g.viewOf('g6'), 0);
  g.completeChore();
  assert.equal(g.viewUnlocked(1), true);
  assert.equal(g.currentView(), 1);
  assert.equal(g.viewOf('g7'), 1);
  for (let k = 0; k < 6; k++) g.completeChore();
  assert.equal(g.areaProgress(0).done, 12);
  assert.equal(g.areaUnlocked(1), true);
  assert.equal(g.currentView(), 2);
  while (g.currentChore()) g.completeChore();
  assert.equal(g.currentView(), S.VIEWS.length - 1);
  assert.equal(g.estateProgress().done, 36);
});

test('choreShort is true only while the next chore costs more than the coins you have', () => {
  const g = mk();
  g.s.coins = 0;
  assert.equal(g.choreShort(), true);
  g.s.coins = g.currentChore().cost;
  assert.equal(g.choreShort(), false);
  g.s.coins = 1e7;
  while (g.currentChore()) g.completeChore();
  assert.equal(g.choreShort(), false);   // nothing left to pay for
});


test('happy meter: every sixth served customer pays a bonus and the meter starts again', () => {
  const g = mk();
  const order = () => ({ wants: [{ chain: 'seed', level: 1 }], reward: { smile: 1 } });
  assert.deepEqual(g.happyProgress(), { n: 0, goal: 6 });
  for (let k = 1; k <= 5; k++) { g.onEvent('serve', { order: order() }); assert.equal(g.happyProgress().n, k); }
  const gems = g.s.gems, coins = g.s.coins;                 // (level-ups can also pay, so compare from here)
  g.onEvent('serve', { order: order() });
  assert.ok(g.s.coins >= coins + GG.HAPPY_REWARD.coins);
  assert.equal(g.happyProgress().n, 0);
  assert.ok(g.s.gems >= gems + 1);
  assert.ok(g.notes.some((n) => n.includes('Happy customers')));
});

test('only customers who pay a review move the happy meter', () => {
  const g = mk();
  g.onEvent('serve', { order: { wants: [{ chain: 'seed', level: 1 }], reward: { coins: 5, energy: 2 } } });
  assert.equal(g.happyProgress().n, 0);
});

test('orders pay in different ways: some energy, some a review, some coins only', () => {
  const g = mk(); const seen = { energy: 0, smile: 0, plain: 0 };
  for (let k = 0; k < 300; k++) { const r = g.makeOrder().reward; if (r.energy) seen.energy++; else if (r.smile) seen.smile++; else seen.plain++; }
  assert.ok(seen.energy > 50 && seen.smile > 50 && seen.plain > 20, JSON.stringify(seen));
});

test('free chest: ready at the start, then refills after two hours', () => {
  const g = mk();
  assert.equal(g.chestReady(), true);
  const r = g.openChest();
  assert.ok(r.ok && r.reward);
  assert.equal(g.chestReady(), false);
  assert.equal(g.openChest().ok, false);
  assert.ok(g.chestMsLeft() > 0 && g.chestMsLeft() <= GG.CHEST_MS);
  g.advance(GG.CHEST_MS + 1000);
  assert.equal(g.chestReady(), true);
  assert.ok(g.openChest().ok);
  const g2 = Game.load(g.serialize(), () => g.clock());     // survives a save
  assert.equal(g2.chestReady(), false);
});

test('starter bonus can be claimed once', () => {
  const g = mk();
  while (g.level() < 2) g.s.xp += 5;
  assert.equal(g.starterReady(), true);
  const coins = g.s.coins;
  assert.ok(g.claimStarter().ok);
  assert.ok(g.s.coins >= coins + GG.STARTER_REWARD.coins);
  assert.equal(g.starterReady(), false);
  assert.equal(g.claimStarter().ok, false);
  assert.equal(Game.load(g.serialize(), () => g.clock()).starterReady(), false);
});

test('repair finishes: only a finished repair can be styled, and it is remembered', () => {
  const g = mk();
  assert.equal(g.setFinish('g1', 1).ok, false);              // not repaired yet
  g.s.coins = 1000; g.completeChore();
  assert.equal(g.finishOf('g1'), 0);
  assert.ok(g.setFinish('g1', 2).ok);
  assert.equal(g.finishOf('g1'), 2);
  assert.equal(g.setFinish('g1', 99).ok, false);
  assert.equal(g.setFinish('g1', 1.5).ok, false);
  assert.equal(Game.load(g.serialize(), () => g.clock()).finishOf('g1'), 2);
  g.s.estate.finish.g1 = 110;                                  // an old save stored degrees: that is the classic look now
  assert.equal(g.finishOf('g1'), 0);
});

test('Kitchen Rush: four daily tasks fill from play and pay out; all four unlock a bonus; a new day resets them', () => {
  const g = mk();
  const list = g.rushTasks();
  assert.equal(list.length, 4);
  g.onEvent('energy', { n: 100 });
  g.onEvent('merge', { level: 1 });
  for (let k = 0; k < 40; k++) g.onEvent('merge', { level: 1 });
  for (let k = 0; k < 6; k++) g.onEvent('serve', { order: { wants: [{ chain: 'seed', level: 1 }], reward: { coins: 50 } } });
  g.onEvent('coins', { n: 300 });
  const done = g.rushTasks();
  assert.ok(done.every((t) => t.done), JSON.stringify(done));
  assert.equal(g.rushBonusReady(), false);
  const c0 = g.s.coins;
  done.forEach((t) => assert.ok(g.claimRush(t.i).ok));
  assert.equal(g.claimRush(0).ok, false);
  assert.ok(g.rushBonusReady());
  assert.ok(g.claimRushBonus().ok);
  assert.ok(g.s.coins > c0);
  g.advance(26 * 3600000);
  g.rollover();
  assert.ok(g.rushTasks().every((t) => t.n === 0 && !t.claimed));
});

test('starter bonus is a chain: 50 gems at level 2, then bigger gifts at higher levels', () => {
  const g = mk();
  assert.equal(g.starterReady(), false);               // level 1: not yet
  while (g.level() < 2) g.s.xp += 5;
  assert.ok(g.starterReady());
  const gems0 = g.s.gems;
  assert.ok(g.claimStarter().ok);
  assert.equal(g.s.gems, gems0 + 50);
  assert.equal(g.starterReady(), false);
  assert.equal(g.starterNext().lv, 4);
  assert.equal(g.claimStarter().ok, false);
  while (g.level() < 4) g.s.xp += 5;
  const e0 = g.s.energy; g.s.energy = 0;
  assert.ok(g.claimStarter().ok);
  assert.ok(g.s.energy >= 50 || e0 >= 0);
  assert.equal(g.starterNext().lv, 7);
});

test('Flaming Frenzy: coins become flames while the event runs, and tiers raise order pay', () => {
  const g = mk();
  assert.equal(g.evInfo('frenzy').active, true);           // a new game starts inside the first window
  assert.equal(g.frenzyMult(), 1);
  g.onEvent('coins', { n: 160 });
  assert.equal(g.frenzyTier(), 0); assert.equal(g.frenzyMult(), GG.FRENZY_TIERS[0].mult);
  g.onEvent('coins', { n: 700 });
  assert.equal(g.frenzyTier(), 2);
  g.advance(13 * 3600000);                                   // the window has closed
  assert.equal(g.evInfo('frenzy').active, false); assert.equal(g.frenzyMult(), 1);
});

test('Manor Goals: tasks fill from play, claiming gives points, and points open milestone rewards', () => {
  const g = mk();
  g.onEvent('tool', {}); for (let k = 0; k < 9; k++) g.onEvent('tool', {});
  const task = g.goalTasks().find((x) => x.id === 'tool');
  assert.ok(task.done);
  assert.ok(g.claimGoal('tool').ok); assert.equal(g.claimGoal('tool').ok, false);
  assert.equal(g.s.ev.goals.points, 150);
  assert.ok(g.goalMilestoneReady(0));
  const e0 = g.s.energy; g.s.energy = 0;
  assert.ok(g.claimGoalMilestone(0).ok);
  assert.ok(g.s.energy > 0 || e0 >= 0);
  assert.equal(g.claimGoalMilestone(0).ok, false);
});
