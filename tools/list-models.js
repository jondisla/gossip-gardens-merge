const fs = require('fs'), path = require('path');
const env = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
const m = env.match(/^GEMINI_API_KEY=(.*)$/m);
const key = m ? m[1].trim() : '';
if (!key) { console.log('No key found in .env'); process.exit(1); }
console.log('Key found, length', key.length);
fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } })
  .then(async (r) => {
    const j = await r.json();
    if (!r.ok) { console.log('HTTP', r.status, JSON.stringify(j.error && j.error.message || j).slice(0, 300)); return; }
    (j.models || []).filter((x) => /image|imagen/i.test(x.name)).forEach((x) => console.log(x.name, '|', (x.supportedGenerationMethods || []).join(',')));
  }).catch((e) => console.log('Network error', e.message));
