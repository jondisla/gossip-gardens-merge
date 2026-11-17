# Gossip Gardens — Design Document

A merge-puzzle game with a restaurant/renovation meta layer, designed from a
client-side analysis of an existing Android title (Unity 2022.3 / IL2CPP, v4.12.0).
This document describes **mechanics and structure in our own words**. It contains no
code or art from the original, and every number below marked *(proposed)* is our own
design choice, not a recovered value.

## 0. How to read this document

Each section is tagged with how much evidence the analysis gave us:

| Tag | Meaning |
|---|---|
| **Observed** | Visible in shipped client strings, asset names or catalog structure |
| **Inferred** | A reasonable reading of observed pieces; not directly confirmed |
| **Server / Not recoverable** | Lives on the publisher's servers or in protected data; we must design it ourselves |
| **Proposed** | Our own design decision for Gossip Gardens |

What the analysis could and could not see:

- Visible: engine and libraries, the asset catalog (about 5,100 addressable paths),
  every localized UI string (about 12,900 keys in English), bundle names and sizes.
- **Not read:** the Lua gameplay scripts (`lua_core`, `lua_config`, `lua_base`,
  `lua_activity`) are stored in an obfuscated form, and the C# game classes are mostly
  thin shells over those scripts. We did **not** decode them. So exact merge
  thresholds, spawn tables, drop rates, timers and cost curves are unknown, and this
  document does not claim them.
- The C# metadata contains almost only engine and library names (a small number of
  game-specific type names), which confirms that gameplay logic lives in Lua and server
  config rather than in compiled C#.

### 0.1 How the analysis was done (and what REA contributed)

- **Own scripts (the source of almost all findings):** zip inspection of both APKs, parsing
  the Addressables catalog, strings from the IL2CPP metadata, and UnityPy to read the
  localized text bundle. These produced the mechanics, item chains, UI and event inventory.
- **REA (`rea-agents` 6.7.0, set up for Claude Code only):** `inspect-artifact` and
  `extract-artifact` ran and confirmed format and hashes. Its deeper analyzers need tools REA
  does not install and that were not available or verifiable here: a jadx-headless-mcp JAR
  (Android classes), apktool (resources), Ghidra/Hopper/IDA/Kuna (native code). Its ELF
  inspection supports Linux x64 only. So REA added little beyond the above; no REA output
  changed any rule in this document.
- **Not decoded:** the obfuscated Lua gameplay scripts. Numeric tuning in the shipped game is
  therefore unknown, and Gossip Gardens uses its own numbers (see `js/data.js`).

### 0.2 Implementation status

A complete offline game exists in `gossip-gardens/` as plain HTML/CSS/JS (no build step; open
`index.html`). Implemented: board and pair merges with our 3+ bonus; four ingredient chains,
three currency chains, four generators with charges and recharge; energy with regen; gift
boxes, bubbles, selling; star-scaled customer orders; a three-area estate (12 plots, story
scenes, two decor styles per plot); five original characters with friendship and gifts; shop
(coins and gems only); daily tasks and a 7-day calendar; a 20-level Garden Pass with free and
premium tracks; the Bloom Festival milestone event; a lucky wheel; synthesized sound; local
save with migration. Still not built, by design: accounts, cloud save, online events, social
features, real-money purchases (section 12 describes what a backend would add). The engine choice in section 2 was changed to plain web tech so the
game runs by double-clicking a file and can be hosted as static files for phones.

### 0.3 Second research pass (public reviews and guides, plus a phone screenshot of the original)

Sources were player guides and reviews (BlueStacks energy guide, Orcz and mobi.gg reviews, store
listings); many "free energy" pages found were spam and were ignored. Claims below are
reported by those sources or seen in a screenshot, not verified against the game's code.

Adopted from that pass: energy cap 100 regenerating 1 per 2 minutes, with the first daily refill
free and later ones doubling in gem cost; machines that cost energy, machines that produce on
their own over time, and generators with finite uses; a storage area that orders can draw from;
scissors, level-up and order-helper tools; a booster that spends more energy for higher-level
items; customers shown above the board with a tray, a delay before the next arrives, and
check marks on board items an order needs; a player level badge; a 7 x 9 full-width board with
a dock for storage, item info and the booster. Not adopted: the original's art and characters,
timed ad rewards, and any real-money purchasing.

## 1. Product summary

- **Genre:** merge board + customer orders + story/renovation meta.
- **Core loop:** spend energy to produce items from generators → merge matching items
  into higher levels → fill customer orders with specific items → earn coins, gems,
  energy and story progress → unlock new boards, characters and decor.
- **Monetization (observed in strings and permissions):** gems (hard currency) bought
  with real money, rewarded and interstitial ads, a battle pass, timed offers, and
  subscriptions. Gossip Gardens will decide its own model; see §13.
- **Session shape:** short, repeatable, energy-gated sessions, with limited-time events
  layered on top.

## 2. Architecture overview

| Layer | Original (observed) | Gossip Gardens (proposed) |
|---|---|---|
| Engine | Unity 2022.3, IL2CPP, Addressables for content | Plain HTML/CSS/JS (no build step); runs from a double-clicked file or any static host |
| Game logic | Lua (xLua) hot-updatable scripts + C# host | One typed language; content in data tables, not code |
| Content | ~245 Addressables bundles downloaded and updated at runtime | Same idea: bundles/CDN for art and config |
| Local storage | Encrypted SQLite (SQLCipher) | Local save + cloud save |
| Networking | Native networking library, protobuf, HTTP and UDP request pools | HTTPS + protobuf or JSON |
| Backend | Several publisher domains: control/config, login/SSO, payments, analytics, hot-fix logs | Our own, see §12 |
| Third-party SDKs | Ad mediation, attribution, crash reporting, performance monitoring, store billing | Pick our own; keep the list minimal |

## 3. Board rules

**Evidence:** hint and tutorial strings (observed); exact numeric rules (not recovered).

### 3.1 Grid and cells
- A board is a rectangular grid of cells. Each cell holds zero or one item.
- Some cells can be **blocked or covered** ("buried" items revealed by merging nearby;
  some "reward" cells that unlock when you merge next to them). *(Observed)*
- Boards are themed per area (a kitchen board, a pool board, etc.), each with its own
  item pool. *(Observed: the first tutorial is "the Kitchen board".)*
- Boards are unlocked by story progress. *(Inferred)*

### 3.2 Moving items
- Drag an item to an empty cell to move it. Dropping onto an occupied cell either
  merges (if legal), swaps, or bounces back. *(Inferred; swap behavior unconfirmed)*

### 3.3 Merge rule
- Two items of the **same type and same level** merge into one item of the **next
  level**. *(Observed: "Merge 2 items to make an upgraded item".)*
- Items at the top level cannot merge further and show a max-level message. *(Observed)*
- The result appears in the cell the player dropped onto. *(Proposed)*
- The client offers a **merge hint** that highlights available merges, with an
  on/off setting. *(Observed)*
- **Proposed:** merging 3 or more matching items at once yields +1 level plus a bonus
  item, to reward larger groups. The original appears to be strictly pairs; this is our
  deviation.

### 3.4 Special interactions
- **Level-up tool:** dropped on a normal item, raises it one level; not usable on
  generators. *(Observed)*
- **Split tool ("scissors"):** splits an item into two lower-level items; scissors
  themselves can be merged to stack more uses. *(Observed)*
- **Bubbles:** an item sealed in a bubble can be bought with gems, or left alone until
  the bubble pops into coins. Removing it also gives coins. *(Observed)*
- **Speed bubble:** a rare item that removes timers from everything on the board.
  *(Observed)*
- **Sell:** items can be sold for coins. *(Observed)*
- **Board full:** producing is blocked with a "Board Full" message. *(Observed)*

### 3.5 Locks and timers
- **Locked gift boxes** need a countdown to open, can be sped up with gems, and only one
  may open at a time ("wait for other chest to open"). *(Observed)*
- Generators have a **recharge** state after use. *(Observed)*

## 4. Item chains

**Evidence:** names and ordering from localized strings (observed). Values and
exact level counts per chain are **not** fully recovered.

An item has `(chain, level)`. The original ships roughly 330 named items across about
65 chains. Our own rules:

- Chains have between **4 and 9 levels** *(observed range; ours is proposed)*.
- Levels are rendered as visibly bigger/fancier versions of the same idea.
- A chain belongs to one board theme but some cross over (e.g., a bag chain that
  produces food ingredients).

### 4.1 Chain families in the original (category summary only)

| Family | Role |
|---|---|
| Container chains (bags, baskets, carts) | Open into ingredients; the early tutorial uses these |
| Ingredient → dish chains (bread/sandwich, fries, coffee, tea, seafood, citrus/dessert) | Customers order these; later levels are cooked dishes |
| Fishing / ocean chains (tackle, shellfish, coral, shells) | Resource-producing and decorative items |
| Pool / swimming chains (storage, floaties, diving gear) | Second-area theme |
| Pets chain (dog toys → breeds) | Story-linked special orders |
| Toy-building chains (blocks → vehicles) | Special-order puzzle goals |
| Farm chains (scarecrow, birds, barn) | Event board |
| **Currency chains** (coins, gems, energy) | Merge to a bigger pile; tap to collect immediately |
| **Chest chains** | Timed-open reward containers |
| **Choice boxes** | Let the player pick which generator to receive |
| **Booster items** (infinite-energy minutes, level-up gem, scissors) | Consumable power-ups |

### 4.2 Currency items
Merging currency piles increases the payout; tapping collects it. Payout grows roughly
super-linearly with level (observed values rise like 2 → 6 → 14 → 30 for coins).
*(Proposed:* use `payout = round(base × 2.2^(level-1))`, tuned in config.*)*

### 4.3 Gossip Gardens chain plan *(proposed)*
Do **not** reuse the original's item identities. Design our own:

1. A **garden/gossip theme**: seeds → sprouts → blooms → bouquets; tea leaves → blends →
   tea sets; pastries; stationery and letters ("gossip" items); garden tools.
2. 12–20 chains at launch, 5–8 levels each, defined in a data file
   (`items.json`: id, chain, level, name key, sprite key, merge-to, sell price,
   produces-from).
3. Each chain has a **role** tag: ingredient, order-item, currency, tool, container.

## 5. Generators

**Evidence:** strings about tapping to produce, auto-produce, cooldown and energy cost
(observed). Drop tables are server/script data (not recovered).

### 5.1 Types
| Type | Behavior |
|---|---|
| **Tap generator** | Costs energy; spawns an item into a nearby empty cell *(observed)* |
| **Auto generator** | Produces without taps over time *(observed)* |
| **Cooldown generator** | After N uses it recharges; can be sped up with gems *(observed)* |
| **Order-specific generator** | Produces a random ingredient for a given order *(observed)* |
| **Consume-then-produce** | Needs a feeder item first (e.g., needs a feed item, then produces animals) *(observed)* |

### 5.2 Rules
- Generators are themselves mergeable, and a higher level improves what they produce
  ("Generates / Next level also generates" info panel). *(Observed)*
- Spawn cell: nearest empty cell to the generator. *(Proposed)*
- If no empty cell: block with a "Board Full" message and **do not** spend energy.
  *(Proposed — original behavior unknown)*
- **Generator booster:** while on, produced items get +1 level but each tap costs
  extra energy; a stronger tier gives +2. The player can toggle it any time.
  *(Observed)*
- **Free-energy window:** a timed boost during which taps are free. *(Observed)*

### 5.3 Spawn tables *(proposed)*
Each generator level has a weighted table: `[(item_id, weight), …]`, plus a small
chance of a bonus item. Pity logic prevents long droughts of items needed for the
current orders (the original has an "order helper" crystal-ball item that grants exactly
the needed items — design our own version).

## 6. Energy

**Observed:** energy is the throttle; running out opens a refill popup; it refills
over time and has push-notification reminders; it can be bought with gems, granted by
items, order buffs and events.

Proposed model:
- Max 100, +1 per 2 minutes while below max. *(Proposed)*
- Gem refill, watch-an-ad refill, and daily free refill. *(Proposed)*
- Energy never expires above max when granted by rewards (overflow allowed up to a cap).

## 7. Orders and customers

**Evidence:** serve button, order buffs, special orders, order-boost event (observed).

- A board has several **customer orders** visible at once. Each asks for 1–4 specific
  `(chain, level)` items. *(Observed)*
- Tapping the order's item icon shows how to make it (item detail with "Generated by").
  *(Observed)*
- **Serve:** removes the items from the board (or from storage) and grants coins,
  energy, stars/progress, and sometimes gifts. *(Observed)*
- **Storage may be used to fill orders** (a dialog tells the player which stored items
  will be consumed). *(Observed)*
- **Order buffs** (temporary): extra coins, extra energy, extra event points, extra
  gifts. *(Observed)*
- **Special orders:** story-driven multi-step requests (adopt a pet, build a toy,
  finish a pottery set) with larger rewards. *(Observed)*
- **Trader customers:** serve their orders to receive gifts/souvenirs. *(Observed)*
- **Emoji / review orders:** some orders carry a review mark; collecting enough
  triggers a reward pack tailored to current orders. *(Observed)*
- **Star-based restaurant reputation:** different customers give different star counts;
  stars unlock rewards. *(Observed)*
- Order generation (which items, how hard) is **server-driven or script-driven**;
  see §12.

*(Proposed)* Order difficulty targets a player's progress and a "recent order history"
so the same item is not asked for repeatedly.

## 8. Meta progression

### 8.1 Story and areas
- A numbered series of **areas** (the asset layout shows at least ~20) with recurring
  characters, dialogue scenes, timelines (cutscene scripts) and expression portraits.
  *(Observed)*
- Characters have an **intimacy/relationship** system (hundreds of strings) with gifts
  (flower, chocolate, book, watch) that add relationship points. *(Observed)*
- Tasks (decorate/repair steps) cost coins and finish when the player taps a clipboard
  and a start button. *(Observed)*

### 8.2 Decoration
- Each area has decor slots with multiple style choices and a lock/unlock flow.
  *(Observed: decor and "map" prefabs, a decor-themed battle pass section.)*

### 8.3 Currencies
Coins (soft), gems (hard), energy, plus event tokens. *(Observed)*

## 9. Live events and seasonal content

Observed event families (names paraphrased by function):

| Type | Idea |
|---|---|
| Adventure / map-explore events | Progress along a path by merging; seasonal themes |
| Farm-board events | Separate event boards with their own item sets |
| Multi-board events | Several boards in sequence, themed per season |
| Collection album | Collect cards, trade rewards |
| Pair / team work | Cooperative goals |
| Cooking-frenzy / speed-cook | Timed bonus mode that boosts order rewards |
| Wheel / lotto / bingo / scratch mechanics | Random rewards |
| Race / dash / combo | Competitive or streak-based events |
| Puzzle events | Place pieces by completing orders |
| Battle pass | Free + paid reward tracks with tasks like "merge N items" |
| Daily tasks, weekly active quests, calendar/check-in | Retention |
| Return-user rewards | Win-back |

*(Proposed)* Launch with: daily tasks, a check-in calendar, one event board, and a
battle pass. Everything else is post-launch.

## 10. UI screens

**Evidence:** UI bundle names and string families (observed).

1. **Loading / update** — asset download progress, version check.
2. **Login / account** — guest + linked account; privacy/consent flow.
3. **Home map / scene view** — the story areas, tasks, decor, characters.
4. **Board screen** — grid, order strip, item info panel (name, level, "generated
   by", sell/speed-up buttons), energy bar, currency bar, storage button, shop button.
5. **Item detail panel** — what an item does, what it makes, which generator makes it.
6. **Orders panel** — customers, serve button, emoji marks.
7. **Inventory / storage** — extra slots purchasable with gems; VIP extension.
8. **Shop** — daily free gift, specials, currency packs, energy packs, offers.
9. **Quest / task list** — tasks with progress, clipboard UI.
10. **Story / dialogue** — portraits with expressions, character intros, cutscenes.
11. **Character relationship** — intimacy levels, gift giving.
12. **Event hubs** — one entry per active event, rules popup, rewards list.
13. **Battle pass** — tracks, tasks, tutorial.
14. **Settings** — name, avatar, language, sound, notifications, merge hint toggle,
    support contact, legal.
15. **Pop-ups** — rate-us, notice, rewards, not-enough-currency, confirm spend,
    force-restart-on-update.

Navigation model *(proposed)*: bottom tab bar (Map, Board, Shop, Events), persistent
top bar (energy, coins, gems).

## 11. Client technical systems

| System | Notes |
|---|---|
| Localization | 10 languages ship as JSON key→string files; includes a patch file for hot fixes. Plan for text keys from day one |
| Remote config / hot update | Scripts and assets are downloaded after install; the client checks a catalog and cleans old bundles |
| Save data | Local encrypted DB plus server sync |
| Audio | Per-event audio assets, SFX per mechanic (merge, appear, wheel spin) |
| Animation | Skeletal animation for characters (Spine-style), timelines for cutscenes, large VFX library (thousands of effect assets) |
| Notifications | Local reminders for energy refill and cooldowns |
| Analytics / attribution | Event logging, attribution SDK; also crash reporting |
| Ads | Rewarded video + interstitial via mediation SDK; HTML ad templates for playable/ending cards |
| Payments | Store billing + a publisher payment API |

## 12. What runs on the server and cannot be recovered from the client

The client contains the **UI and presentation**; the following were not recovered and
must be designed and built by us:

1. **Account and identity:** login, device/account linking, save ownership, bans.
2. **Authoritative save / economy:** gem and coin balances, purchases, receipts,
   anti-cheat. (The client has local storage, but balances on a live service are
   normally validated server-side.)
3. **Order generation and difficulty tuning:** which orders appear, per-player.
4. **Generator drop tables and weights** (if not in the obfuscated scripts) and any
   pity/anti-frustration logic.
5. **Live-ops configuration:** event schedules, offer pricing, A/B tests, battle-pass
   content, shop rotation, return-user rules.
6. **Social features:** teams, leaderboards, races, gifting between players.
7. **Payments:** receipt validation and entitlement.
8. **Notifications / push scheduling.**
9. **Analytics pipeline.**
10. **Content balance numbers:** cost curves, reward amounts, timers. Some of these live
    in the obfuscated Lua config (not decoded here); treat all as unknown.

For Gossip Gardens, **minimum viable backend** *(proposed)*: auth, cloud save,
config/events delivery, purchase validation, and a small order-generation service.
An offline-first single-player build can ship with these generated locally.

## 13. Differences we are choosing on purpose *(proposed)*

- Original theme (diner / harbor mystery) → garden/estate gossip theme, with our own
  characters, names and art.
- Larger merges (3+) give bonuses.
- Fewer simultaneous event types at launch.
- No dependence on server-only order generation; ship a deterministic local generator
  with a seed so the game is testable.
- Our own item set and level counts.

## 14. Milestones *(proposed)*

1. **Prototype:** one board, 6 chains, 2 generators, merge + sell + energy, 5 orders.
2. **Vertical slice:** orders, currency, one story area with a few tasks.
3. **Alpha:** inventory, bubbles, chests, shop, daily tasks, local notifications.
4. **Beta:** cloud save, one event board, battle pass, analytics.
5. **Launch:** live-ops config service, store billing, localization.

## 15. Open questions

- Does the original use strictly pair merges, or can it chain? (Unknown; we chose pairs
  plus our own 3+ bonus.)
- Exact energy costs and regen rates. (Unknown.)
- Whether dragging onto a different item swaps or bounces. (Unknown.)
- Which of the §12 items are server-side vs. hidden in Lua config. (Needs a decode of
  the protected scripts, which this project has not done and does not require.)

## 16. Legal and originality notes

- This is a clean-room design: we describe behavior in our own words and invent our own
  items, characters, art, audio and text.
- We do not copy the original's code, scripts, art, audio, character names, dialogue or
  item names, and we do not ship any of its files.
- Game mechanics (merging, generators, orders) are common genre ideas; the original's
  specific expression of them is what we avoid reusing.
