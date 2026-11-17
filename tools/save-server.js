// Tiny local helper: the cutting page POSTs cropped images here and they are written into gossip-gardens/art/.
// Only accepts paths under art/ and only on localhost. Run: node save-server.js
const http = require('http'), fs = require('fs'), path = require('path');
const BASE = path.resolve(__dirname, '..', 'gossip-gardens');
http.createServer((req, res) => {
  const h = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
  if (req.method === 'OPTIONS') { res.writeHead(204, h); return res.end(); }
  const u = new URL(req.url, 'http://x'); const rel = u.searchParams.get('path') || '';
  const target = path.resolve(BASE, rel);
  if (req.method !== 'POST' || !target.startsWith(path.join(BASE, 'art') + path.sep) || !/\.(webp|png)$/.test(target)) { res.writeHead(400, h); return res.end('bad'); }
  const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.concat(chunks)); res.writeHead(200, h); res.end('ok');
  });
}).listen(8081, '127.0.0.1', () => console.log('save server on 8081'));
