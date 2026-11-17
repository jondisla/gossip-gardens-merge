// Generates original game art with the Gemini image API.
// Usage: node generate.js [batchName] [model]      (key is read from ../.env, never printed)
// Output: ../gossip-gardens/art/raw/<name>.<ext>
const fs = require('fs'), path = require('path');

const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const KEY = ((env.match(/^GEMINI_API_KEY=(.*)$/m) || [])[1] || '').trim();
if (!KEY) { console.error('No GEMINI_API_KEY in ../.env'); process.exit(1); }

const batchName = process.argv[2] || 'test';
const MODEL = process.argv[3] || 'gemini-3.1-flash-image';
const OUT = path.join(__dirname, '..', 'gossip-gardens', 'art', 'raw');
fs.mkdirSync(OUT, { recursive: true });

const ITEM_STYLE = 'Casual mobile merge-game item icon. Glossy hand-painted look, soft gradients, thick clean dark-toned outline, bright warm lighting from the top left, rich saturated colours. ' +
  'One single object, centred, filling about 80 percent of the square frame, on a plain flat pure white background. No text, no letters, no ground shadow, no border, no frame.';
const PORTRAIT_STYLE = 'Casual mobile game character portrait, head and shoulders, friendly expressive face, glossy hand-painted cartoon look, thick soft outline, warm lighting. ' +
  'Original character. Plain flat pure white background. No text.';

const BATCHES = {
  test: [
    ['seed_1', ITEM_STYLE + ' Subject: a single small garden flower seed, brown, level 1 of an item chain.'],
    ['seed_3', ITEM_STYLE + ' Subject: a young flower bud on a short green stem with a few leaves, pink bud just forming.'],
    ['seed_5', ITEM_STYLE + ' Subject: a lovely bouquet of mixed pink and yellow flowers tied with a ribbon.'],
    ['leaf_1', ITEM_STYLE + ' Subject: a single fresh green tea leaf.'],
    ['leaf_4', ITEM_STYLE + ' Subject: a porcelain teapot with a blue floral pattern, lid on.'],
    ['flour_1', ITEM_STYLE + ' Subject: a small pile of white flour dust with a few sparkles.'],
    ['flour_5', ITEM_STYLE + ' Subject: a layered cake with cream frosting and strawberries on top.'],
    ['paper_3', ITEM_STYLE + ' Subject: a cream-coloured letter envelope with a red wax seal.'],
    ['gen_seed_1', ITEM_STYLE + ' Subject: a small cloth seed pouch tied with string, spilling a few seeds, this is a machine that produces seeds.'],
    ['gem_1', ITEM_STYLE + ' Subject: a single sparkling purple gemstone.'],
    ['p_mabel', PORTRAIT_STYLE + ' Subject: a kindly elderly woman estate owner with swept-up white hair, round glasses and a green cardigan.'],
    ['p_rufus', PORTRAIT_STYLE + ' Subject: a stocky middle-aged handyman with a brown moustache, flat cap and a warm smile.'],
  ],
};

const jobs = BATCHES[batchName];
if (!jobs) { console.error('Unknown batch', batchName, 'available:', Object.keys(BATCHES).join(', ')); process.exit(1); }

async function gen(prompt) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent';
  const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } };
  const r = await fetch(url, { method: 'POST', headers: { 'x-goog-api-key': KEY, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + String((j.error && j.error.message) || '').slice(0, 200));
  const parts = ((j.candidates || [])[0] || {}).content ? j.candidates[0].content.parts : [];
  const img = parts.find((p) => p.inlineData || p.inline_data);
  if (!img) throw new Error('No image in reply: ' + JSON.stringify(j).slice(0, 200));
  const d = img.inlineData || img.inline_data;
  return { mime: d.mimeType || d.mime_type, data: Buffer.from(d.data, 'base64') };
}

(async () => {
  console.log('Model', MODEL, '| batch', batchName, '|', jobs.length, 'images');
  for (const [name, prompt] of jobs) {
    const existing = fs.readdirSync(OUT).find((f) => f.startsWith(name + '.'));
    if (existing) { console.log('skip', name, '(exists)'); continue; }
    try {
      const { mime, data } = await gen(prompt);
      const ext = /jpe?g/.test(mime) ? 'jpg' : 'png';
      fs.writeFileSync(path.join(OUT, name + '.' + ext), data);
      console.log('ok  ', name, mime, Math.round(data.length / 1024) + ' KB');
    } catch (e) {
      console.log('FAIL', name, e.message);
      if (/429|quota|RESOURCE/i.test(e.message)) { console.log('Rate limit or quota hit; stopping. Re-run later to continue.'); break; }
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
})();
