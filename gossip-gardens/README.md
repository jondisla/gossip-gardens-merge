# Gossip Gardens

A merge game: tap generators to make items, drag matching items together to level them up,
and fill customer orders. Plain HTML, CSS and JavaScript. No build step, no dependencies,
no accounts, no network. Your progress saves in the browser on whichever device you play on.

## Play on your computer

Double-click **`index.html`**. That is all.

## Play on your phone

Pick one.

**A. Same Wi-Fi (quickest for testing).**
1. Double-click **`serve.bat`**. It prints a line like `On your phone: http://192.168.1.23:8080/`.
2. Open that address in your phone's browser.
3. If Windows asks about the firewall, allow **Private networks**.
4. Android Chrome: menu > *Add to Home screen*. iPhone Safari: Share > *Add to Home Screen*.

This needs Python (already on this PC). Without it, `serve.bat` falls back to `npx serve`.

**B. Free static hosting (play anywhere, share a link).** The folder is just static files, so
any static host works: GitHub Pages, Netlify Drop, Cloudflare Pages. Upload the folder
contents (everything except `tests/` and `node_modules/` if present). Because it runs over
https, the game also becomes installable and works offline after the first visit.

Note: saves are per device and per address. `localhost`, your LAN address and a hosted
address each have their own save.

## How the game plays

| Action | What happens |
|---|---|
| Tap a machine | Costs 1 energy; makes an item nearby. Machines run out of charges, then recharge. The **Wishing Vine** makes items by itself, free of energy |
| Generator booster (bolt, bottom right) | Unlocks after 12 merges. x2 costs 2 energy for +1 level, x4 costs 4 for +2 levels |
| Storage (chest, bottom left) | 4 slots, up to 12 for gems. Drag an item onto the chest or press Store. Orders can use stored items |
| Scissors / Starry Teapot / Wishing Teapot | Scissors split an item one level lower. The starry teapot raises one a level. The wishing teapot makes what your orders need |
| Green check / crown | An order needs this item / it is a top-level item |
| Customers | Each order has a customer; the next one arrives a few seconds after you serve |
| Energy | 100 max, +1 every 2 minutes. First refill each day is free, then 10, 20, 40 gems |
| Player level | Rises as you play and pays gems |
| Drag onto a matching item | Merges into the next level |
| Merge beside a third match | Bonus coin |
| Tap coins / gems / sparks | Collect them |
| Gift boxes | Tap to start a timer, tap again to open; gems can skip the wait |
| Bubbles | Pay gems to free the item, or wait and it bursts into coins |
| Locked sand tile | Tap it to spend its energy price (30 / 50 / 100) and open it. Some hide a prize (blue ! mark) |
| Cobweb | A webbed item is frozen (no move, merge, sell or order use) until you merge in a cell next to it |
| Orders | Collect the items the customer wants, then tap Serve |

## The four tabs

| Tab | What is in it |
|---|---|
| **Garden** | The merge board, customer orders, item info |
| **Estate** | The repair scene: tap a piece to restore it with stars and coins, and its story scene plays. Paying a chore (the journal button) opens the next repair. Three areas, each with its own painted background |
| **Shop** | The cart opens a full-screen sheet: Daily Specials (a piggy bank, an energy box and a free gift, refreshed daily) and Hot Sales (items for gems), plus a Gems tab with display-only packs. Gems only; there is no real-money purchasing |
| **Events** | 20-level Garden Pass (free and premium tracks), Bloom Festival milestones, lucky wheel. The day streak lives on the Estate screen |

Sound effects are synthesized in the browser (the speaker button mutes them).

## Where things are

```
index.html          the page
style.css           layout and look
js/data.js          item chains and ALL core tuning numbers   <- edit to rebalance
js/story.js         characters, areas, scenes, shop, pass, event, wheel, daily data
js/game.js          core rules engine (no DOM; unit tested)
js/meta.js          estate, daily, shop, pass, event, wheel logic (unit tested)
js/art.js           maps the images in art/ onto items, portraits, icons, area banners
art/                your supplied images: items/ portraits/ scenes/ extras/ sheets/
js/sprites.js       fallback item art, drawn in code
js/portraits.js     original character portraits and estate plot art
js/audio.js         synthesized sound effects
js/screens.js       Estate, Shop and Events screens
js/ui.js            tabs, board rendering, drag and drop, saving
tests/              node --test tests/game.test.js tests/meta.test.js
serve.bat           one-click phone server
```

## Art

Images live in `art/` and are wired up in `js/art.js`. Item chains map level by level
(`seed:1` -> `art/items/sponge.webp`). Anything not listed falls back to the vector art.
Internal chain ids are historical: `seed` = Cleaning, `leaf` = Tea & drinks, `flour` = Fishing,
`paper` = Letters. Three more chains unlock with player level (`CHAIN_UNLOCK` in `js/data.js`): Garden (level 3), Tools (5) and Cafe (7); each gives you its first machine. `art/sheets/` holds the original sheets the extra items were cut from (many items in them were duplicates of the singles). Keep screenshots of
other games out of `art/` (they belong in `../reference/`, which is git-ignored).

## Changing things

- **Balance:** `TUNING` in `js/data.js` (energy regen, spawn weights, gift timers, order rewards).
- **New item chain:** add an entry to `CHAINS` in `js/data.js`, then add a drawing function for
  it in `ART` in `js/sprites.js`.
- **Swap in painted art:** put images in an `art/` folder and map them, before `ui.js` loads:
  `GG.imageOverrides['seed:3'] = 'art/seed_3.png'`. Keys are `chain:level`.
  Nothing else in the game changes.

## Tests

```
node --test tests/game.test.js tests/meta.test.js tests/features.test.js tests/unlock.test.js
```

Needs Node 18 or newer. The game itself does not need Node.

## Status

Complete offline game: board, generators, orders, estate and story, characters, shop, daily
tasks, calendar, pass, festival, wheel, sound. Everything runs locally; there is no server.
Not built (by design, for now): accounts, cloud save, online events, leaderboards, real-money
purchases. Art is original vector art drawn in code; swap in painted art through
`GG.imageOverrides` (see above). See `../DESIGN.md` for the plan.
