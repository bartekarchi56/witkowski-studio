// Timbro wallet server.
//   POST /apple   (form field "data" = JSON {card, customer, lang}) → .pkpass file
//   POST /google  (same)                                            → redirect to Google Wallet
//   GET  /img/strip?icon=&color=&ink=&need=&have=                   → stamp strip PNG (Google hero image)
//   GET  /img/icon?icon=&color=                                     → square logo PNG (Google program logo)
//   GET  /health
import http from 'node:http';
import { settings, appleReady, googleReady } from './settings.js';
import { readPassRequest } from './input.js';
import { buildApplePass } from './apple.js';
import { buildGoogleSaveUrl } from './google.js';
import { strip, icon } from './images.js';

const MAX_BODY = 1024 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new Error('Request too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function parse(req, body) {
  const type = req.headers['content-type'] || '';
  if (type.includes('application/json')) return JSON.parse(body);
  return JSON.parse(new URLSearchParams(body).get('data') || '{}');
}

// With the database connected, take the card and stamps from Supabase, using
// the customer's own secret; only the images drawn by the website are kept.
async function trusted(raw) {
  const { url, anonKey } = settings.supabase;
  if (!url) return raw;
  const r = await fetch(`${url}/rest/v1/rpc/get_my_card`, {
    method: 'POST',
    headers: { apikey: anonKey, authorization: `Bearer ${anonKey}`, 'content-type': 'application/json', 'content-profile': 'timbro' },
    body: JSON.stringify({ p_code: raw?.customer?.id || '', p_secret: raw?.customer?.secret || '' })
  });
  const live = r.ok ? await r.json() : null;
  if (!live) throw new Error('Card not found');
  const art = raw.card || {};
  return { lang: raw.lang, customer: live.customer, card: { ...live.card, logoAuto: art.logoAuto, markImage: art.markImage } };
}

const send = (res, status, body, headers = {}) => { res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', ...headers }); res.end(body); };

function originAllowed(req) {
  if (!settings.allowedOrigins.length) return true;
  return settings.allowedOrigins.includes(req.headers.origin || '');
}

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, settings.publicUrl);
  try {
    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, JSON.stringify({ ok: true, apple: appleReady(), google: googleReady() }), { 'content-type': 'application/json' });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/img/')) {
      const q = Object.fromEntries(url.searchParams);
      const card = { icon: q.icon, color: q.color, ink: q.ink, stampsNeeded: q.need, shape: q.shape, mark: q.mark, markText: (q.markText || '').slice(0, 2), empty: q.empty, strip: q.strip };
      const png = url.pathname === '/img/strip'
        ? await strip(card, Math.max(0, parseInt(q.have, 10) || 0), { w: 1032, h: 336 })
        : await icon(card, 660);
      return send(res, 200, png, { 'content-type': 'image/png', 'cache-control': 'public, max-age=300' });
    }

    if (req.method === 'POST' && (url.pathname === '/apple' || url.pathname === '/google')) {
      if (!originAllowed(req)) return send(res, 403, 'This site is not allowed to create passes.');
      const data = readPassRequest(await trusted(parse(req, await readBody(req))));

      if (url.pathname === '/apple') {
        if (!appleReady()) return send(res, 503, 'Apple Wallet is not set up yet. See wallet/README.md.');
        const pkpass = await buildApplePass(data);
        return send(res, 200, pkpass, {
          'content-type': 'application/vnd.apple.pkpass',
          'content-disposition': `attachment; filename="${data.card.id}.pkpass"`
        });
      }
      if (!googleReady()) return send(res, 503, 'Google Wallet is not set up yet. See wallet/README.md.');
      return send(res, 303, '', { location: buildGoogleSaveUrl(data, req.headers.origin) });
    }

    send(res, 404, 'Not found');
  } catch (err) {
    send(res, 400, `Could not create the pass: ${err.message}`);
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(settings.port, () => {
    console.log(`Wallet server on ${settings.publicUrl} (Apple ${appleReady() ? 'ready' : 'not set up'}, Google ${googleReady() ? 'ready' : 'not set up'})`);
  });
}
