/* Gossip Gardens - item data and tuning.
 * All names, themes and numbers are original to this project.
 * Plain script (no modules) so index.html works when opened directly from disk.
 */
(function (root) {
  'use strict';

  // Roles: ingredient | currency | generator | gift | tool
  const CHAINS = {
    seed:  { id: 'seed',  role: 'ingredient', hue: 190,   // Cleaning supplies
             names: ['Sponge', 'Spray Bottle', 'Broom', 'Water Bucket', 'Cleaning Tub', 'Supply Crate'] },
    leaf:  { id: 'leaf',  role: 'ingredient', hue: 150,
             names: ['Tea Bag', 'Teapot & Cup', 'Iced Tea', 'Orange Spritz', 'Strawberry Cooler', 'Champagne Toast'] },
    flour: { id: 'flour', role: 'ingredient', hue: 205,   // Fishing gear
             names: ['Fish Hook', 'Feather Lure', 'Buoy', 'Rope Coil', 'Fishing Rod', 'Tackle Box'] },
    paper: { id: 'paper', role: 'ingredient', hue: 212,
             names: ['Parchment', 'Newspaper', 'Sealed Envelope', 'Letter Bundle', 'Scroll', 'Anchor Journal'] },

    // Chains that unlock as the player levels up (see CHAIN_UNLOCK). Art comes from js/art.js.
    garden: { id: 'garden', role: 'ingredient', hue: 100,
              names: ['Acorn', 'Seedling', 'Daisy', 'Sunflowers', 'Rose Bouquet', 'Lavender Planter', 'Rose Basket', 'Floral Arch'] },
    tools:  { id: 'tools',  role: 'ingredient', hue: 25,
              names: ['Screw', 'Nuts & Bolts', 'Wrench', 'Handsaw', 'Toolbox', 'Tool Satchel'] },
    cafe:   { id: 'cafe',   role: 'ingredient', hue: 30,
              names: ['Coffee Beans', 'Coffee', 'Croissant', 'Bread Loaf', 'Sandwich', 'Pancakes', 'Berry Tart', 'Layer Cake'] },

    coin:  { id: 'coin', role: 'currency', hue: 46,
             names: ['Coin', 'Coins', 'Coin Pile', 'Piggy Bank', 'Treasure Chest'], payout: [2, 6, 14, 30, 64] },
    gem:   { id: 'gem',  role: 'currency', hue: 282,
             names: ['Gem', 'Gems', 'Gem Cluster'], payout: [1, 3, 7] },
    bolt:  { id: 'bolt', role: 'currency', hue: 52,
             names: ['Spark', 'Zap', 'Surge', 'Storm'], payout: [2, 6, 15, 40] },

    gift:  { id: 'gift', role: 'gift', hue: 8,
             names: ['Balloon Bunch', 'Gift Box', 'Festival Crate'] },

    // Tools: drag onto an item (scissors, dust) or tap (orb). Uses are per level.
    scissors: { id: 'scissors', role: 'tool', hue: 25, uses: [1, 3, 7],
                names: ['Little Scissors', 'Sharp Shears', 'Master Shears'],
                desc: 'Drag onto an item to split it into two items one level lower. Merge scissors for more uses.' },
    dust:     { id: 'dust', role: 'tool', hue: 290, uses: [1], names: ['Starry Teapot'],
                desc: 'Drag onto an item to raise it one level. Does not work on machines.' },
    orb:      { id: 'orb', role: 'tool', hue: 205, uses: [1], names: ['Wishing Teapot'],
                desc: 'Tap to receive items that your current orders need.' },

    // Machines. "auto" machines make items by themselves over time and cost no energy.
    gen_seed:  { id: 'gen_seed',  role: 'generator', hue: 190, produces: 'seed',
                 names: ['Cleaning Cart', 'Cleaning Trolley', 'Cleaning Depot'] },
    gen_leaf:  { id: 'gen_leaf',  role: 'generator', hue: 150, produces: 'leaf',
                 names: ['Tea Caddy', 'Tea Cabinet', 'Tea Pavilion'] },
    gen_flour: { id: 'gen_flour', role: 'generator', hue: 205, produces: 'flour',
                 names: ['Tackle Box', 'Tackle Shed', 'Fishing Pier'] },
    gen_paper: { id: 'gen_paper', role: 'generator', hue: 212, produces: 'paper',
                 names: ['Writing Desk', 'Post Office', 'Gossip Gazette'] },
    gen_garden: { id: 'gen_garden', role: 'generator', hue: 100, produces: 'garden',
                  names: ['Potting Shed', 'Greenhouse', 'Conservatory'] },
    gen_tools:  { id: 'gen_tools',  role: 'generator', hue: 25,  produces: 'tools',
                  names: ['Red Toolbox', 'Workbench', 'Workshop'] },
    gen_cafe:   { id: 'gen_cafe',   role: 'generator', hue: 30,  produces: 'cafe',
                  names: ['Coffee Cart', 'Cafe Counter', 'Bakery Kitchen'] },
    gen_vine:  { id: 'gen_vine',  role: 'generator', hue: 128, produces: '*', auto: true, periodMs: [90000, 60000, 40000],
                 names: ['Wishing Vine', 'Wishing Trellis', 'Wishing Arbor'] },
  };

  const INGREDIENT_CHAINS = ['seed', 'leaf', 'flour', 'paper', 'garden', 'tools', 'cafe'];
  // Player level at which a chain joins the game (orders, gifts, vine) and its first machine is given.
  const CHAIN_UNLOCK = { flour: 5, paper: 7, garden: 9, tools: 11, cafe: 13 };
  const GENERATOR_CHAINS = ['gen_seed', 'gen_leaf', 'gen_flour', 'gen_paper', 'gen_garden', 'gen_tools', 'gen_cafe'];

  const maxLevel = (chain) => CHAINS[chain].names.length;
  const itemName = (chain, level) => CHAINS[chain].names[Math.min(level, maxLevel(chain)) - 1];

  // All balance numbers live here. These are our own starting values; tune by playing.
  const TUNING = {
    cols: 7,
    rows: 9,

    energyMax: 100,
    energyOverflowMax: 200,
    energyRegenMs: 120000,      // +1 energy per 2 minutes
    energyPerTap: 1,
    energyRefillGemCost: 10,    // first refill each day is free, then 10, 20, 40...

    startCoins: 50,
    startGems: 20,

    generatorCooldown: false,   // true = machines run out of taps and must recharge; false = tap until the board is full or energy is out
    genChargesBase: 6,          // taps before a generator must recharge
    genChargesPerLevel: 2,
    genRechargeMs: 60000,
    genSpeedUpGemCost: 3,

    // Generator booster: unlocked after this many merges. Mode 1 costs 2 and adds +1 level; mode 2 costs 4 and adds +2.
    boosterUnlockMerges: 12,
    boosterCosts: [1, 2, 4],

    // Spawn weights by generator level: [ingredientLevel, weight]
    spawnTable: {
      1: [[1, 70], [2, 30]],
      2: [[1, 50], [2, 40], [3, 10]],
      3: [[1, 30], [2, 45], [3, 20], [4, 5]],
    },
    bonusCoinChance: 0.05,

    giftUnlockMs: { 1: 20000, 2: 45000, 3: 90000 },
    giftItemCount: { 1: 3, 2: 4, 3: 5 },
    giftSpeedUpMsPerGem: 20000,
    giftToolChance: 0.1,
    bubbleChance: 0.15,
    bubbleLifeMs: 90000,
    bubbleGemCost: 5,

    // Storage (inventory)
    storageStart: 4,
    storageMax: 16,
    storageSlotGemCost: 10,     // +5 for each slot already bought

    // Orders
    orderSlots: 3,
    orderMinLevel: 2,
    orderMaxLevelStart: 3,
    orderMaxLevelCap: 5,

    // Sand and cobwebs are scattered at random over the board (never on row 0 or 2, which stay free to work in).
    // "energy" sand opens when you tap it and pay energy; its prizes are modest.
    // "near" sand costs nothing: it clears when you merge on a neighbouring cell, and it hides the better prizes.
    // Cobwebbed items clear the same way (merge next to them, or merge a matching item into them).
    dropMachinesFromLevel: 6,         // no machine drops at all before this player level
    giftGenChance: 0.03,              // a gift sometimes holds a machine for a chain you have reached
    sandEnergy: 9,
    sandNear: 8,
    webCount: 6,
    lockCostCorner: 100,              // a bottom-corner energy tile costs extra
    lockPrizesEnergy: [[null, 5], [['coin', 1], 2], [['gem', 1], 1], [['bolt', 1], 1], [['gift', 1], 1]],
    lockPrizesNear: [[['gift', 1], 3], [['gift', 2], 2], [['gem', 2], 2], [['coin', 3], 2], [['bolt', 2], 2], [['gem', 3], 1], [['scissors', 2], 1], [['core', 3], 3], [['core', 4], 1], [['gen', 1], 1]],
    starsPerOrderLevel: 6,
    orderDelayMinMs: 6000,      // a replacement customer arrives after this long
    orderDelayMaxMs: 20000,

    sellBase: 1,                // sell price = sellBase * 2^(level-1)
    orbMaxItems: 3,

    // Player level: total xp needed to reach level L is 25 * L * (L - 1)
    levelUpGems: 2,
  };

  root.GG = root.GG || {};
  Object.assign(root.GG, { CHAINS, TUNING, INGREDIENT_CHAINS, GENERATOR_CHAINS, CHAIN_UNLOCK, maxLevel, itemName });
})(typeof globalThis !== 'undefined' ? globalThis : this);
