/* Gossip Gardens - maps the supplied images in art/ onto the game.
 * Anything not listed here falls back to the vector art drawn in code, so this file can grow gradually.
 * Keys for items are "chain:level". Paths are relative to index.html (works from disk and over http).
 */
(function (root) {
  'use strict';
  const G = root.GG;
  const I = 'art/items/', P = 'art/portraits/', S = 'art/scenes/';
  const ov = G.imageOverrides = G.imageOverrides || {};

  const chain = (id, files) => files.forEach((f, k) => { ov[id + ':' + (k + 1)] = I + f + '.webp'; });

  // Ingredient chains (6 levels each)
  chain('seed',  ['sponge', 'spray_bottle', 'broom', 'bucket_water', 'cleaning_tub', 'supply_crate']);                 // Cleaning
  chain('leaf',  ['tea_bag', 'teapot_cup', 'iced_tea', 'orange_spritz', 'strawberry_cooler', 'champagne_toast']);        // Tea & drinks
  chain('flour', ['fish_hook', 'feather_lure', 'buoy', 'rope_coil', 'fishing_rod', 'tackle_box']);                      // Fishing
  chain('paper', ['parchment', 'newspaper', 'sealed_envelope', 'letter_bundle', 'scroll', 'anchor_journal']);          // Letters
  chain('garden', ['acorn', 'sprout_pot', 'daisy_pot', 'sunflowers', 'rose_bouquet', 'lavender_planter', 'rose_basket', 'floral_arch']);
  chain('tools',  ['screw', 'nuts_bolts', 'wrench', 'handsaw', 'toolbox_open', 'leather_tool_bag']);
  chain('cafe',   ['coffee_beans', 'coffee_cup', 'croissant', 'bread_loaf', 'sandwich', 'pancakes', 'berry_tart', 'layer_cake']);
  chain('gift',  ['balloons', 'gift_box', 'festival_crate']);
  chain('choice', ['festival_crate']);   // placeholder picture for the Machine Choice Box until it has its own

  // Tools (pixel-art teapots)
  ov['dust:1'] = I + 'teapot_purple_pixel.png';   // Starry Teapot: raises an item a level
  ov['orb:1'] = I + 'teapot_blue_pixel.png';      // Wishing Teapot: makes what your orders need

  // Machines (generators): one picture per chain; level shows as stars on the board
  const machine = (id, file) => { for (let L = 1; L <= 3; L++) ov[id + ':' + L] = I + 'machine_' + file + '.webp'; };
  machine('gen_seed', 'cleaning'); machine('gen_leaf', 'tea'); machine('gen_flour', 'fishing'); machine('gen_paper', 'letters');
  machine('gen_garden', 'garden'); machine('gen_tools', 'tools'); machine('gen_cafe', 'cafe'); machine('gen_vine', 'vine');

  // HUD icons
  G.iconImages = { coin: I + 'coin_crown.webp', gem: I + 'gem_ruby.webp', bolt: I + 'lightning_bolt.webp' };

  // Interface icons and the Estate repair scenes (before / after)
  G.iconImages.star = 'art/extras/icon_star.webp';
  G.extraImages = G.extraImages || {};
  Object.assign(G.extraImages, { cart: 'art/extras/icon_cart.webp', drill: 'art/extras/icon_drill.webp', cabinet: 'art/extras/icon_cabinet.webp' });
  G.plotImages = {};
  ['gate', 'path', 'bed', 'lantern', 'roof', 'floor', 'tables', 'teaset', 'press', 'paper', 'sign', 'news'].forEach((k) => { G.plotImages[k] = ['art/plots/' + k + '_before.webp', 'art/plots/' + k + '_after.webp']; });
  // New repairs: drop art/plots/<kind>_before.webp and <kind>_after.webp in and they are used automatically.
  // Until then each shows the picture of an older, similar repair (G.plotAlias).
  G.plotAlias = {
    hedge: 'bed',
    steps: 'floor',
    fountain: 'floor',
    roses: 'bed',
    wall: 'gate',
    lamp: 'lantern',
    rosepath: 'path',
    gsign: 'sign',
    lilies: 'bed',
    tpath: 'path',
    arch: 'gate',
    gravel: 'path',
    benches: 'tables',
    tlanterns: 'lantern',
    hydrangea: 'bed',
    tsign: 'sign',
    cgate: 'gate',
    cobbles: 'path',
    lanelamp: 'lantern',
    board: 'sign',
    stand: 'news',
    ivy: 'bed',
    paving: 'floor',
    edition: 'paper'
  };
  Object.keys(G.plotAlias).forEach((k) => { G.plotImages[k] = ['art/plots/' + k + '_before.webp', 'art/plots/' + k + '_after.webp']; });

  // Repair screen: one picture per "spot" (art/scenes/area_N_spot_M.webp). Each area has 2 spots of 6 repairs.
  // Where each repair stands: [centre x %, centre y %, width %] of the scene, in task order within the spot.
  // Edit these numbers to move a piece.
  G.repairLayout = [
    [[55, 89, 36], [48, 66, 36], [55, 43, 36], [64, 27, 34], [28, 27, 34], [50, 12, 34]],   // area 1, spot 1: gate, path, beds, lantern, hedges, porch steps
    [[50, 48, 36], [52, 23, 30], [18, 54, 30], [72, 36, 26], [27, 32, 28], [70, 71, 30]],   // area 1, spot 2: fountain, roses, wall, lamp, rose path, sign
    [[45, 25, 36], [46, 45, 40], [76, 64, 34], [14, 43, 34], [20, 66, 34], [44, 82, 34]],   // area 2, spot 1: roof, floor, tables, tea set, lilies, path
    [[45, 83, 36], [50, 55, 34], [27, 35, 36], [62, 21, 34], [25, 63, 34], [68, 70, 34]],   // area 2, spot 2: arch gate, gravel, benches, lanterns, hydrangeas, sign
    [[50, 40, 36], [30, 33, 34], [20, 58, 34], [72, 60, 34], [45, 82, 36], [52, 63, 34]],   // area 3, spot 1: press, paper, sign, news, gate, cobbles
    [[22, 18, 34], [56, 16, 34], [28, 40, 34], [35, 68, 34], [62, 52, 34], [68, 87, 36]],   // area 3, spot 2: lamp, notice board, news stand, ivy, cobbles, final edition
  ];

  // Character portraits (circle-cropped by CSS)
  G.portraitImages = {
    mabel:    P + 'grey_haired_woman_pink_apron.webp',
    rufus:    P + 'smiling_man_brown_apron.webp',
    pippa:    P + 'woman_headband_yellow_apron.webp',
    ivo:      P + 'bearded_man_green_shirt.webp',
    cordelia: P + 'long_hair_woman_maroon_jacket.webp',
    you:      P + 'teal_hair_woman_glasses.webp',
  };

  // Extra profile avatars (not story characters)
  G.avatarExtra = { boy1: P + 'boy_striped_shirt.webp', girl1: P + 'girl_pigtails_yellow_top.webp', boy2: P + 'boy_curly_glasses_hoodie.webp', girl2: P + 'girl_orange_hair_overalls.webp' };

  Object.assign(G.portraitImages, G.avatarExtra);   // the kids queue up as customers as well

  // Estate area banners
  Object.assign(G.extraImages, { sand: 'art/extras/sand_tile.webp', cobweb: 'art/extras/cobweb.png', bubble: 'art/extras/bubble.webp', padlock: 'art/extras/padlock.webp', platter: 'art/extras/platter.webp', inventory: 'art/extras/inventory.webp', skip: 'art/extras/icon_skip.webp', journal: 'art/extras/icon_journal.webp', kitchen: 'art/extras/icon_kitchen.webp' });
  // Coin chain: the top two levels are the piggy bank and the mystery chest
  ov['gem:1'] = I + 'gem_ruby.webp'; ov['gem:2'] = I + 'gem_pair.webp'; ov['gem:3'] = I + 'gem_cluster.webp';
  ov['coin:1'] = I + 'coin_crown.webp'; ov['coin:2'] = I + 'coin_pair.webp'; ov['coin:3'] = I + 'coin_pile.webp'; ov['coin:4'] = I + 'piggy_bank.webp'; ov['coin:5'] = I + 'mystery_chest.webp';
})(typeof globalThis !== 'undefined' ? globalThis : this);
