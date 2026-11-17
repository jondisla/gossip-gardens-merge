// Sorts and renames the images in gossip-gardens/assets by content (decided by looking at each one).
// Moves files; never deletes. Excluded originals go to ../reference (outside the served game folder).
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'gossip-gardens', 'assets');
const ART = path.join(ROOT, 'gossip-gardens', 'art');
const REF = path.join(ROOT, 'reference');

const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.webp')).sort();
if (files.length !== 103) { console.log('Expected 103 files, found', files.length, '- stopping'); process.exit(1); }
if (!/^rosie/.test(files[102])) { console.log('Index order differs from the one I looked at - stopping'); process.exit(1); }

const items = { 2: 'rope_coil', 3: 'iced_tea', 4: 'parchment', 6: 'bucket_water', 7: 'bucket_water_2', 9: 'milk_bottle', 12: 'newspaper', 13: 'teapot_cup',
  14: 'towel_basket', 18: 'shell_wind_chime', 20: 'pinwheel_flower', 21: 'scroll', 22: 'beach_stones', 23: 'gold_coin', 24: 'bunting', 25: 'conch_shell',
  28: 'orange_spritz', 29: 'supply_crate', 30: 'harbor_painting', 31: 'lantern_string', 34: 'sponge', 35: 'sponge_2', 38: 'cleaning_tub', 41: 'strawberry_cooler',
  47: 'soap_bubbles', 49: 'champagne_toast', 50: 'buoy', 52: 'painted_vase', 54: 'compass', 56: 'potted_plant', 58: 'file_folders', 59: 'fishing_rod',
  61: 'cookie_tin', 63: 'ribbon_spool', 66: 'balloons', 69: 'lemon_wedge', 71: 'sealed_envelope', 73: 'tea_bag', 76: 'lightning_bolt', 78: 'quill_inkwell',
  81: 'festival_crate', 82: 'tackle_box', 84: 'candle', 85: 'gift_box', 87: 'spray_bottle', 89: 'anchor_journal', 91: 'letter_bundle', 92: 'fish_hook',
  93: 'thread_spool', 96: 'feather_lure', 98: 'broom', 99: 'broom_2', 101: 'lantern' };
const portraits = { 1: 'bearded_man_green_shirt', 8: 'red_haired_boy_yellow_hoodie', 16: 'grey_haired_woman_pink_apron', 37: 'smiling_man_brown_apron',
  48: 'woman_headband_yellow_apron', 60: 'young_man_green_hoodie', 62: 'woman_glasses_lilac', 65: 'teal_hair_woman_glasses', 74: 'long_hair_woman_maroon_jacket',
  77: 'elder_navy_cardigan', 83: 'girl_bun_green_overalls' };
const scenes = { 0: 'bedroom', 68: 'desk_room', 88: 'attic_room', 27: 'iso_cottage_garden', 39: 'iso_house_section', 42: 'iso_floorplan', 80: 'plaza_street',
  94: 'harbor_pool', 95: 'terrace_garden' };
const sheets = [5, 19, 26, 32, 43, 44, 45, 46, 64, 67, 75, 100];

const plan = {};
const put = (idx, dir, name) => { plan[idx] = [dir, name + '.webp']; };
Object.entries(items).forEach(([i, n]) => put(i, 'items', n));
Object.entries(portraits).forEach(([i, n]) => put(i, 'portraits', n));
Object.entries(scenes).forEach(([i, n]) => put(i, 'scenes', n));
sheets.forEach((i) => put(i, 'sheets', 'sheet_' + String(i).padStart(3, '0')));
put(10, 'extras', 'cat_lounging');

const count = {};
files.forEach((f, i) => {
  let dest;
  if (plan[i]) { dest = path.join(ART, plan[i][0]); count[plan[i][0]] = (count[plan[i][0]] || 0) + 1; }
  else { dest = REF; count.reference = (count.reference || 0) + 1; }
  fs.mkdirSync(dest, { recursive: true });
  fs.renameSync(path.join(SRC, f), path.join(dest, plan[i] ? plan[i][1] : f));
});
console.log(count, 'left in assets:', fs.readdirSync(SRC).length);
