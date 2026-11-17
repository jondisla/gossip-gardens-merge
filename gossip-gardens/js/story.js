/* Gossip Gardens - story and content data. All characters, places and text are original. */
(function (root) {
  'use strict';
  const G = root.GG;

  // ---- characters ---------------------------------------------------------
  const CHARS = {
    mabel:    { name: 'Mabel Thorne',   role: 'Head Gardener', skin: '#e9bb94', hair: '#cfcfd6', style: 'bun',   outfit: 140, acc: 'none',
                bio: 'Has tended Hollow Rose for fifty years and knows where every secret is buried. Sometimes literally.' },
    rufus:    { name: 'Rufus Pike',     role: 'Postman',       skin: '#d79f74', hair: '#5a3a22', style: 'cap',   outfit: 215, acc: 'mustache',
                bio: 'Delivers the post and, in passing, the news. Swears he never gossips. Everyone knows better.' },
    pippa:    { name: 'Pippa Crumb',    role: 'Baker',         skin: '#f1cba7', hair: '#b5522b', style: 'braids', outfit: 335, acc: 'none',
                bio: 'Believes there is no problem a warm scone cannot at least postpone.' },
    ivo:      { name: 'Dr. Ivo Fennel', role: 'Botanist',      skin: '#c98e66', hair: '#2f2f3a', style: 'wild',  outfit: 185, acc: 'glasses',
                bio: 'Brilliant with plants, hopeless with people. Writes forty drafts of every note and sends none of them. Almost none.' },
    cordelia: { name: 'Cordelia Wren',  role: 'Columnist',     skin: '#f4d6bc', hair: '#2a1a3a', style: 'bob',   outfit: 285, acc: 'hat',
                bio: 'Writes the county\'s sharpest column, The Daily Whisper. Her pencil is mightier than her smile.' },
    you:      { name: 'You',            role: 'New Owner',     skin: '#e2b48c', hair: '#6b4426', style: 'bob',   outfit: 20,  acc: 'none', bio: '' },
  };
  const FOLKS = ['mabel', 'rufus', 'pippa', 'ivo', 'cordelia'];

  // ---- estate: areas and plots ---------------------------------------------
  const AREAS = [
    { id: 'gate',     name: 'The Front Gate',     blurb: 'A crooked gate, a lost path and a very tired lantern.' },
    { id: 'pavilion', name: 'The Tea Pavilion',   blurb: 'Where the manor will finally welcome guests again.' },
    { id: 'gazette',  name: 'The Gossip Gazette', blurb: 'An old press, a stack of blank paper, and a mystery.' },
  ];
  // kind selects the drawing; stars/coins are the restore cost
  const TASKS = [
    { id: 'g1', area: 0, name: 'Mend the Gate', kind: 'gate', stars: 1, coins: 20 },
    { id: 'g2', area: 0, name: 'Clear the Path', kind: 'path', stars: 2, coins: 40 },
    { id: 'g3', area: 0, name: 'Replant the Beds', kind: 'bed', stars: 2, coins: 60 },
    { id: 'g4', area: 0, name: 'Light the Lantern', kind: 'lantern', stars: 3, coins: 80 },
    { id: 'g5', area: 0, name: 'Trim the Hedges', kind: 'hedge', stars: 3, coins: 90 },
    { id: 'g6', area: 0, name: 'Mend the Porch Steps', kind: 'steps', stars: 3, coins: 100 },
    { id: 'g7', area: 0, name: 'Restore the Fountain', kind: 'fountain', stars: 4, coins: 110 },
    { id: 'g8', area: 0, name: 'Prune the Roses', kind: 'roses', stars: 4, coins: 120 },
    { id: 'g9', area: 0, name: 'Rebuild the Garden Wall', kind: 'wall', stars: 4, coins: 130 },
    { id: 'g10', area: 0, name: 'Hang the Garden Lamp', kind: 'lamp', stars: 4, coins: 140 },
    { id: 'g11', area: 0, name: 'Lay the Rose Path', kind: 'rosepath', stars: 5, coins: 150 },
    { id: 'g12', area: 0, name: 'Paint the Garden Sign', kind: 'gsign', stars: 5, coins: 160 },
    { id: 't1', area: 1, name: 'Raise the Roof', kind: 'roof', stars: 3, coins: 100 },
    { id: 't2', area: 1, name: 'Lay the Floor', kind: 'floor', stars: 3, coins: 120 },
    { id: 't3', area: 1, name: 'Set the Tables', kind: 'tables', stars: 4, coins: 140 },
    { id: 't4', area: 1, name: 'Open for Tea', kind: 'teaset', stars: 4, coins: 160 },
    { id: 't5', area: 1, name: 'Plant the Lilies', kind: 'lilies', stars: 4, coins: 170 },
    { id: 't6', area: 1, name: 'Lay the Garden Path', kind: 'tpath', stars: 5, coins: 180 },
    { id: 't7', area: 1, name: 'Mend the Arch Gate', kind: 'arch', stars: 5, coins: 190 },
    { id: 't8', area: 1, name: 'Rake the Gravel Path', kind: 'gravel', stars: 5, coins: 200 },
    { id: 't9', area: 1, name: 'Set the Garden Benches', kind: 'benches', stars: 5, coins: 210 },
    { id: 't10', area: 1, name: 'Hang the Tea Lanterns', kind: 'tlanterns', stars: 6, coins: 220 },
    { id: 't11', area: 1, name: 'Plant the Hydrangeas', kind: 'hydrangea', stars: 6, coins: 230 },
    { id: 't12', area: 1, name: 'Paint the Tea Sign', kind: 'tsign', stars: 6, coins: 240 },
    { id: 'p1', area: 2, name: 'Wake the Press', kind: 'press', stars: 4, coins: 180 },
    { id: 'p2', area: 2, name: 'Stock the Paper', kind: 'paper', stars: 5, coins: 200 },
    { id: 'p3', area: 2, name: 'Paint the Sign', kind: 'sign', stars: 5, coins: 220 },
    { id: 'p4', area: 2, name: 'Print the First Edition', kind: 'news', stars: 6, coins: 260 },
    { id: 'p5', area: 2, name: 'Mend the Courtyard Gate', kind: 'cgate', stars: 6, coins: 270 },
    { id: 'p6', area: 2, name: 'Sweep the Cobbles', kind: 'cobbles', stars: 6, coins: 280 },
    { id: 'p7', area: 2, name: 'Light the Lane Lamp', kind: 'lanelamp', stars: 6, coins: 290 },
    { id: 'p8', area: 2, name: 'Fix the Notice Board', kind: 'board', stars: 7, coins: 300 },
    { id: 'p9', area: 2, name: 'Open the News Stand', kind: 'stand', stars: 7, coins: 310 },
    { id: 'p10', area: 2, name: 'Train the Ivy', kind: 'ivy', stars: 7, coins: 320 },
    { id: 'p11', area: 2, name: 'Re-lay the Cobbles', kind: 'paving', stars: 7, coins: 330 },
    { id: 'p12', area: 2, name: 'Print the Final Edition', kind: 'edition', stars: 8, coins: 340 },
  ];
  // Every 6 repairs make one "spot": a zoomed view of part of an area. Each area has 2 spots (6 views in all).
  TASKS.forEach((t, i) => { t.spot = Math.floor((i % 12) / 6); });
  const VIEWS = [];
  AREAS.forEach((ar, ai) => { for (let sp = 0; sp < 2; sp++) VIEWS.push({ area: ai, spot: sp }); });

  // ---- story scenes ---------------------------------------------------------
  const SCENES = {
    intro: { title: 'Hollow Rose Manor', lines: [
      { who: 'mabel', text: 'Hollow Rose Manor. Fifty years I have tended it, and I have never seen it this tired.' },
      { who: 'you',   text: 'My great-aunt left it to me. I do not even know where to start.' },
      { who: 'mabel', text: 'Start with the gate, dear. Every garden begins at the gate. Bring a few good orders and we will see what grows.' },
    ] },
    g1: { title: 'Mend the Gate', lines: [
      { who: 'rufus', text: 'Morning! Post for the manor. Well, one letter, signed only "A Friend". Odd, isn\'t it?' },
      { who: 'mabel', text: 'Hinges mended at last. Rufus, don\'t dawdle, you\'ll spread the news by lunchtime.' },
      { who: 'rufus', text: 'Spread it? I merely deliver it. The gossip spreads itself.' },
    ] },
    g2: { title: 'Clear the Path', lines: [
      { who: 'ivo',   text: 'Pardon me! Mind the foxglove. Dr. Ivo Fennel, botanist. I have been, er, admiring your hedges from a distance.' },
      { who: 'you',   text: 'From a distance? How far a distance?' },
      { who: 'ivo',   text: 'Oh, about the other side of the wall. Do carry on!' },
    ] },
    g3: { title: 'Replant the Beds', lines: [
      { who: 'pippa', text: 'I brought scones for the planting crew! Pippa Crumb, baker. Your beds are going to be gorgeous.' },
      { who: 'mabel', text: 'The soil is good. Roots remember, you know. This garden wants to bloom.' },
      { who: 'pippa', text: 'Then let us give it something to talk about!' },
    ] },
    g4: { title: 'Light the Lantern', lines: [
      { who: 'mabel', text: 'There. The front lantern is lit for the first time in years.' },
      { who: 'rufus', text: 'Another letter, I\'m afraid. "The lantern is a good start. Keep going." Still signed A Friend.' },
      { who: 'you',   text: 'Someone is watching our progress. Let\'s see to the Tea Pavilion next.' },
    ] },
    t1: { title: 'Raise the Roof', lines: [
      { who: 'ivo',   text: 'A pavilion needs a proper roof. I may have sketched a design. Or forty.' },
      { who: 'mabel', text: 'Forty? Ivo, pick one.' },
      { who: 'ivo',   text: '...The third. Obviously the third.' },
    ] },
    t2: { title: 'Lay the Floor', lines: [
      { who: 'pippa', text: 'Tiles in, and not a crack. I would love to host tea here every Sunday, if that is all right.' },
      { who: 'you',   text: 'It is more than all right. It is the plan.' },
    ] },
    t3: { title: 'Set the Tables', lines: [
      { who: 'cordelia', text: 'Cordelia Wren, columnist, The Daily Whisper. I hear this manor is the talk of the county.' },
      { who: 'you',      text: 'Is that a compliment?' },
      { who: 'cordelia', text: 'It is an item. Whether it is flattering depends on how the tea turns out.' },
    ] },
    t4: { title: 'Open for Tea', lines: [
      { who: 'pippa',    text: 'The first pot is poured!' },
      { who: 'cordelia', text: 'Passable. More than passable, actually. Don\'t tell my editor I said so.' },
      { who: 'rufus',    text: 'A new letter! "Next, the old press. Please." Why would anyone want a press?' },
    ] },
    p1: { title: 'Wake the Press', lines: [
      { who: 'mabel', text: 'This press has not printed since before I started here. It groans like a sleepy badger.' },
      { who: 'ivo',   text: 'A little oil, a little patience. There, listen to it purr.' },
    ] },
    p2: { title: 'Stock the Paper', lines: [
      { who: 'rufus', text: 'Paper, ink and stamps, as requested. I was told it was urgent.' },
      { who: 'you',   text: 'Told by whom?' },
      { who: 'rufus', text: 'That\'s the thing. A letter, signed A Friend.' },
    ] },
    p3: { title: 'Paint the Sign', lines: [
      { who: 'cordelia', text: '"The Hollow Rose Gazette." Hmm. A rival paper, then. How delightfully rude.' },
      { who: 'you',      text: 'Rival? I thought you would cheer us on.' },
      { who: 'cordelia', text: 'I am cheering. Loudly. With a sharpened pencil.' },
    ] },
    p4: { title: 'The First Edition', lines: [
      { who: 'ivo',      text: 'Ahem. The letters. They were mine. I am a terrible, shy writer, but I could not bear to watch the manor sleep.' },
      { who: 'mabel',    text: 'Ivo Fennel, you secret sentimentalist.' },
      { who: 'cordelia', text: 'And my front page writes itself: "Mystery Friend Revealed." I will be kind. Mostly.' },
      { who: 'you',      text: 'Hollow Rose is awake again. Thank you, all of you.' },
    ] },
    g5: { title: "Trim the Hedges", lines: [
      { who: 'ivo', text: "These hedges have not seen shears since the last century. Do stand back." },
      { who: 'mabel', text: "Careful, Ivo. They are older than you and twice as stubborn." },
    ] },
    g6: { title: "Mend the Porch Steps", lines: [
      { who: 'rufus', text: "Mind the third step, it used to bite. Now it only grumbles." },
      { who: 'you', text: "That is the best a step can do, surely." },
    ] },
    g7: { title: "Restore the Fountain", lines: [
      { who: 'mabel', text: "Your great-aunt loved this fountain. She would sit here and talk to the goldfish." },
      { who: 'you', text: "I hope it still has goldfish." },
      { who: 'mabel', text: "It will." },
    ] },
    g8: { title: "Prune the Roses", lines: [
      { who: 'pippa', text: "I will make rose petal jam. Do not look at me like that, it is delicious." },
      { who: 'ivo', text: "Prune low, hope high. That is the old gardening motto." },
    ] },
    g9: { title: "Rebuild the Garden Wall", lines: [
      { who: 'rufus', text: "Every brick in this wall has heard a secret." },
      { who: 'mabel', text: "And not one of them has told, unlike some people." },
      { who: 'rufus', text: "I resent that. Slightly." },
    ] },
    g10: { title: "Hang the Garden Lamp", lines: [
      { who: 'you', text: "A lamp in the rose garden. It feels like the whole place is breathing." },
      { who: 'mabel', text: "Gardens do that. You just have to give them light." },
    ] },
    g11: { title: "Lay the Rose Path", lines: [
      { who: 'pippa', text: "A path through the roses! Now I can carry scones without getting scratched." },
      { who: 'ivo', text: "The roses will miss you, Pippa." },
    ] },
    g12: { title: "Paint the Garden Sign", lines: [
      { who: 'cordelia', text: "Sign painting. I always said I would try it. Hold the ladder." },
      { who: 'you', text: "You are not going to climb it, are you?" },
      { who: 'cordelia', text: "Only a little." },
    ] },
    t5: { title: "Plant the Lilies", lines: [
      { who: 'ivo', text: "Water lilies need still water and a calm heart. I am a little short of the second." },
      { who: 'pippa', text: "Take a deep breath, Ivo." },
    ] },
    t6: { title: "Lay the Garden Path", lines: [
      { who: 'mabel', text: "A path to the pavilion at last. Guests can walk here and keep their shoes dry." },
      { who: 'you', text: "That is the dream." },
    ] },
    t7: { title: "Mend the Arch Gate", lines: [
      { who: 'rufus', text: "A pretty arch. I have delivered letters through worse." },
      { who: 'mabel', text: "Through this one you will need to knock first." },
    ] },
    t8: { title: "Rake the Gravel Path", lines: [
      { who: 'ivo', text: "Gravel should whisper under your feet. This one used to shout." },
      { who: 'you', text: "It is whispering now." },
    ] },
    t9: { title: "Set the Garden Benches", lines: [
      { who: 'pippa', text: "Benches for the lawn. Somewhere to sit with a scone and a good rumour." },
      { who: 'cordelia', text: "Now you are speaking my language." },
    ] },
    t10: { title: "Hang the Tea Lanterns", lines: [
      { who: 'mabel', text: "Lanterns for the evening teas. The garden will glow." },
      { who: 'you', text: "I could get used to this." },
    ] },
    t11: { title: "Plant the Hydrangeas", lines: [
      { who: 'ivo', text: "Blue if the soil is sour, pink if it is sweet. I am hoping for blue." },
      { who: 'pippa', text: "I am hoping for cake." },
    ] },
    t12: { title: "Paint the Tea Sign", lines: [
      { who: 'cordelia', text: "The Tea Garden. Simple, warm and impossible to misspell. You are welcome." },
      { who: 'you', text: "Thank you, Cordelia." },
    ] },
    p5: { title: "Mend the Courtyard Gate", lines: [
      { who: 'rufus', text: "A gate to the press yard. I do like a tidy delivery route." },
      { who: 'ivo', text: "It does open now. Mostly outward." },
    ] },
    p6: { title: "Sweep the Cobbles", lines: [
      { who: 'pippa', text: "So many old newspapers under here! Look, a crossword from 1962." },
      { who: 'cordelia', text: "Give me that. It is unsolved." },
    ] },
    p7: { title: "Light the Lane Lamp", lines: [
      { who: 'you', text: "The lane glows. It looks like a place where stories begin." },
      { who: 'mabel', text: "Or end, if they are well told." },
    ] },
    p8: { title: "Fix the Notice Board", lines: [
      { who: 'cordelia', text: "A notice board. Finally, a place to post my corrections." },
      { who: 'mabel', text: "Cordelia, nobody corrects as much as you do." },
    ] },
    p9: { title: "Open the News Stand", lines: [
      { who: 'rufus', text: "The news stand is open! I will deliver and sell. I am an entrepreneur." },
      { who: 'you', text: "You are a postman." },
      { who: 'rufus', text: "Yes, an entrepreneurial one." },
    ] },
    p10: { title: "Train the Ivy", lines: [
      { who: 'ivo', text: "Ivy is how a garden hugs its walls. Do not interrupt it." },
      { who: 'pippa', text: "I would like a hug like that." },
    ] },
    p11: { title: "Re-lay the Cobbles", lines: [
      { who: 'mabel', text: "Fresh cobbles. The old ones each had a story, so we kept them in the border." },
      { who: 'you', text: "That is lovely." },
    ] },
    p12: { title: "Print the Final Edition", lines: [
      { who: 'cordelia', text: "Final Edition: Hollow Rose Blooms Again. Written by the whole village." },
      { who: 'you', text: "A good last line." },
      { who: 'mabel', text: "Or a very good first one." },
    ] },
  };

  // ---- chores: small jobs for the estate's people, paid in coins, rewarding player XP -------
  const CHORES = [
    { id: 'c1',  who: 'mabel',    title: 'Sweep the Porch',        cost: 20,  xp: 15 },
    { id: 'c2',  who: 'rufus',    title: 'Deliver the Post',       cost: 30,  xp: 15 },
    { id: 'c3',  who: 'pippa',    title: 'Bake for the Guests',    cost: 45,  xp: 20 },
    { id: 'c4',  who: 'ivo',      title: 'Water the Ferns',        cost: 60,  xp: 20 },
    { id: 'c5',  who: 'cordelia', title: 'Sharpen the Pencils',    cost: 80,  xp: 25 },
    { id: 'c6',  who: 'mabel',    title: 'Polish the Brass',       cost: 100, xp: 25 },
    { id: 'c7',  who: 'rufus',    title: 'Sort the Letters',       cost: 130, xp: 30 },
    { id: 'c8',  who: 'pippa',    title: 'Fill the Cookie Tin',    cost: 160, xp: 30 },
    { id: 'c9',  who: 'ivo',      title: 'Prune the Roses',        cost: 200, xp: 35 },
    { id: 'c10', who: 'cordelia', title: 'Proofread the Column',   cost: 250, xp: 40 },
    { id: 'c11', who: 'mabel',    title: 'Hang the Lanterns',      cost: 300, xp: 45 },
    { id: 'c12', who: 'rufus',    title: 'Paint the Fence',        cost: 400, xp: 50 },
    { id: 'c13', who: 'pippa', title: 'Dust the Shelves', cost: 450, xp: 50 },
    { id: 'c14', who: 'ivo', title: 'Wind the Clocks', cost: 500, xp: 51 },
    { id: 'c15', who: 'cordelia', title: 'Polish the Banister', cost: 550, xp: 52 },
    { id: 'c16', who: 'mabel', title: 'Sort the Seeds', cost: 600, xp: 53 },
    { id: 'c17', who: 'rufus', title: 'Press the Tablecloths', cost: 650, xp: 54 },
    { id: 'c18', who: 'pippa', title: 'Stack the Firewood', cost: 700, xp: 55 },
    { id: 'c19', who: 'ivo', title: 'Wash the Windows', cost: 750, xp: 56 },
    { id: 'c20', who: 'cordelia', title: 'Oil the Hinges', cost: 800, xp: 57 },
    { id: 'c21', who: 'mabel', title: 'Mend the Curtains', cost: 850, xp: 58 },
    { id: 'c22', who: 'rufus', title: 'Pick the Apples', cost: 900, xp: 59 },
    { id: 'c23', who: 'pippa', title: 'Shine the Silver', cost: 1000, xp: 60 },
    { id: 'c24', who: 'ivo', title: 'Sweep the Steps', cost: 1100, xp: 61 },
    { id: 'c25', who: 'cordelia', title: 'Bake the Scones', cost: 1200, xp: 62 },
    { id: 'c26', who: 'mabel', title: 'Feed the Birds', cost: 1300, xp: 63 },
    { id: 'c27', who: 'rufus', title: 'Sharpen the Shears', cost: 1400, xp: 64 },
    { id: 'c28', who: 'pippa', title: 'Beat the Rugs', cost: 1500, xp: 65 },
    { id: 'c29', who: 'ivo', title: 'Label the Jars', cost: 1600, xp: 66 },
    { id: 'c30', who: 'cordelia', title: 'Fold the Napkins', cost: 1700, xp: 67 },
    { id: 'c31', who: 'mabel', title: 'Water the Window Boxes', cost: 1800, xp: 68 },
    { id: 'c32', who: 'rufus', title: 'Trim the Wicks', cost: 1900, xp: 69 },
    { id: 'c33', who: 'pippa', title: 'Weed the Borders', cost: 2000, xp: 70 },
    { id: 'c34', who: 'ivo', title: 'Stamp the Letters', cost: 2100, xp: 71 },
    { id: 'c35', who: 'cordelia', title: 'File the Clippings', cost: 2200, xp: 72 },
    { id: 'c36', who: 'mabel', title: 'Ring the Bell', cost: 2400, xp: 73 },
  ];

  // ---- check-in calendar (the day bar) and free gift -----------------------------
  // ---- shop: gem packs (display only: there is no real-money purchasing) and Hot Sales prices -----
  const GEM_PACKS = [
    { gems: 100, art: 'gem_ruby' }, { gems: 265, art: 'gem_pair' }, { gems: 580, art: 'gem_cluster' },
    { gems: 1260, art: 'mystery_chest' }, { gems: 3350, art: 'mystery_chest' }, { gems: 7450, art: 'mystery_chest' },
  ];
  const HOT_PRICE = [1, 1, 2, 4, 7, 12];   // gems for an item of level 1..6

  const CALENDAR = [
    { coins: 30 }, { energy: 20 }, { gems: 2 }, { coins: 60 }, { energy: 40 }, { gift: 2 }, { gems: 8, coins: 100 },
  ];

  // ---- Garden Pass (battle pass style) ---------------------------------------------
  const PASS = { levels: 20, xpPer: 100, premiumGemCost: 40 };
  PASS.reward = function (level, track) {
    if (track === 'free') {
      if (level % 5 === 0) return { gems: 3, spins: 1, tool: 'dust' };
      return level % 2 ? { coins: 20 + level * 4 } : { energy: 10 + level };
    }
    if (level % 5 === 0) return { gems: 8, gift: 3, tool: level % 10 === 0 ? 'orb' : 'scissors' };
    return level % 2 ? { gems: 1, coins: 30 + level * 5 } : { energy: 20 + level * 2, spins: level % 4 === 0 ? 1 : 0 };
  };

  // ---- Bloom Festival event ---------------------------------------------------------
  const EVENT = {
    id: 'bloom', name: 'Bloom Festival',
    blurb: 'Earn blossoms by serving orders and merging high-level items. Collect rewards as the festival fills up.',
    milestones: [
      { tokens: 10,  reward: { coins: 40 } },
      { tokens: 25,  reward: { energy: 25 } },
      { tokens: 45,  reward: { gems: 2 } },
      { tokens: 70,  reward: { gift: 2, tool: 'scissors' } },
      { tokens: 100, reward: { coins: 120, spins: 1 } },
      { tokens: 140, reward: { gems: 4 } },
      { tokens: 190, reward: { energy: 60, tool: 'orb' } },
      { tokens: 250, reward: { gems: 20, gift: 3 } },
    ],
  };

  // ---- Lucky wheel ------------------------------------------------------------------
  const WHEEL = [
    { label: '20 coins',  reward: { coins: 20 },  w: 22 },
    { label: '10 energy', reward: { energy: 10 }, w: 20 },
    { label: '1 gem',     reward: { gems: 1 },    w: 14 },
    { label: '50 coins',  reward: { coins: 50 },  w: 12 },
    { label: 'Gift box',  reward: { gift: 1 },    w: 10 },
    { label: '25 energy', reward: { energy: 25 }, w: 10 },
    { label: '3 gems',    reward: { gems: 3 },    w: 8 },
    { label: 'Big gift',  reward: { gift: 2 },    w: 4 },
  ];

  // ---- Shop (coins and gems only; there is no real-money purchasing) -------------------

  G.STORY = { CHARS, FOLKS, AREAS, TASKS, VIEWS, SCENES, CHORES,
    CALENDAR, GEM_PACKS, HOT_PRICE, PASS, EVENT, WHEEL };
})(typeof globalThis !== 'undefined' ? globalThis : this);
