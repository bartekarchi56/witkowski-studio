// Regenerates every PDF in print/ from the live pages, e.g. after changing
// siteUrl or contact in assets/js/config.js:   node print/make-pdfs.js
// Needs Playwright with Chromium (npm i -g playwright).
const http = require('http'), fs = require('fs'), path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const ROOT = path.join(__dirname, '..');
const OUT = __dirname;
const FILES = [
  ['sales/brochure.html?cafe=The%20Coffee&lang=it&format=a5', 'brochure-the-coffee-it.pdf'],
  ['sales/brochure.html?cafe=The%20Coffee&lang=en&format=a5', 'brochure-the-coffee-en.pdf'],
  ['sales/brochure.html?cafe=The%20Coffee&lang=it&format=fold', 'brochure-the-coffee-it-a4-da-piegare.pdf'],
  ['sales/brochure.html?cafe=&lang=it&format=a5', 'brochure-generale-it.pdf'],
  ['sales/brochure.html?cafe=&lang=en&format=a5', 'brochure-general-en.pdf'],
  ['app/poster.html?card=the-coffee&lang=it&size=A5', 'poster-the-coffee-a5.pdf']
];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };

// A tiny static server for the repository.
const server = http.createServer((req, res) => {
  let file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data);
  });
});

server.listen(0, async () => {
  const base = `http://localhost:${server.address().port}/`;
  const browser = await chromium.launch();
  let failed = false;
  for (const [page, name] of FILES) {
    const ctx = await browser.newContext({ locale: 'it-IT', viewport: { width: 1400, height: 1000 } });
    const p = await ctx.newPage();
    const errors = []; p.on('pageerror', e => errors.push(e.message));
    await p.goto(base + page); await p.waitForTimeout(800);
    await p.evaluate(() => document.fonts.ready);
    await p.emulateMedia({ media: 'print' });
    await p.pdf({ path: path.join(OUT, name), preferCSSPageSize: true, printBackground: true });
    console.log(errors.length ? '✗' : '✓', name, errors.join(' | '));
    failed = failed || errors.length > 0;
    await ctx.close();
  }
  await browser.close(); server.close();
  process.exit(failed ? 1 : 0);
});
