// A tiny in-memory stand-in for the parts of Stripe's API the Edge Functions
// use, for local tests only (supabase/test/stripe.test.js).
import http from 'node:http';

// Stripe's form encoding: a[b][0][c]=v → { a: { b: [{ c: 'v' }] } }
function parseForm(text) {
  const out = {};
  for (const [key, value] of new URLSearchParams(text)) {
    const path = key.replace(/\]/g, '').split('[');
    let o = out;
    path.forEach((k, i) => {
      if (i === path.length - 1) { o[k] = value; return; }
      o[k] ??= /^\d+$/.test(path[i + 1]) ? [] : {};
      o = o[k];
    });
  }
  return out;
}

export function fakeStripe(port = 12111) {
  const db = { customers: {}, products: {}, prices: {}, sessions: [], portalSessions: [], configs: {}, subscriptions: {} };
  let n = 0;
  const id = prefix => `${prefix}_${(++n).toString().padStart(6, '0')}`;
  const list = data => ({ object: 'list', data, has_more: false, url: '' });

  const server = http.createServer((req, res) => {
    let text = '';
    req.on('data', c => text += c);
    req.on('end', () => {
      const url = new URL(req.url, 'http://x');
      const q = parseForm(url.search.slice(1)), body = parseForm(text);
      const send = (o, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
      const p = url.pathname, post = req.method === 'POST';
      const m = p.match(/^\/v1\/([a-z_/]+?)(?:\/([a-z]+_\w+))?$/) || [];
      const [, kind, oid] = m;

      if (kind === 'customers' && post) { const c = { id: id('cus'), object: 'customer', ...body }; db.customers[c.id] = c; return send(c); }
      if (kind === 'products' && !post) return send(list(Object.values(db.products).filter(x => x.active)));
      if (kind === 'products' && post) {
        const prod = oid ? Object.assign(db.products[oid], body) : (db.products[id('prod')] = { object: 'product', active: true, metadata: {}, ...body });
        if (!oid) prod.id = Object.keys(db.products).at(-1);
        return send(prod);
      }
      if (kind === 'prices' && !post) {
        const keys = Object.values(q.lookup_keys || {});
        return send(list(Object.values(db.prices).filter(x => x.active && (!keys.length || keys.includes(x.lookup_key)))));
      }
      if (kind === 'prices' && post) {
        if (oid) { Object.assign(db.prices[oid], { active: body.active !== 'false' }); return send(db.prices[oid]); }
        if (body.transfer_lookup_key) for (const x of Object.values(db.prices)) if (x.lookup_key === body.lookup_key) x.lookup_key = null;
        const pr = { id: id('price'), object: 'price', active: true, product: body.product, unit_amount: Number(body.unit_amount), currency: body.currency,
          recurring: body.recurring, lookup_key: body.lookup_key, tax_behavior: body.tax_behavior };
        db.prices[pr.id] = pr; return send(pr);
      }
      if (kind === 'checkout/sessions' && post) { const s = { id: id('cs'), object: 'checkout.session', url: 'https://checkout.stripe.test/' + n, ...body }; db.sessions.push(s); return send(s); }
      if (kind === 'billing_portal/sessions' && post) { const s = { id: id('bps'), url: 'https://billing.stripe.test/' + n, ...body }; db.portalSessions.push(s); return send(s); }
      if (kind === 'billing_portal/configurations' && !post) return send(list(Object.values(db.configs)));
      if (kind === 'billing_portal/configurations' && post) {
        const c = oid ? Object.assign(db.configs[oid], body) : { id: id('bpc'), active: true, metadata: {}, ...body };
        db.configs[c.id] = c; return send(c);
      }
      if (kind === 'subscriptions' && !post) return send(list(Object.values(db.subscriptions).filter(s => s.customer === q.customer).reverse()));
      send({ error: { message: `fake stripe: no route for ${req.method} ${p}`, type: 'invalid_request_error' } }, 404);
    });
  });
  return new Promise(ok => server.listen(port, () => ok({ db, close: () => server.close(),
    // Test helper: a subscription as Stripe would hold it.
    addSubscription(customer, lookupKey, status) {
      const price = Object.values(db.prices).find(x => x.lookup_key === lookupKey);
      const s = { id: id('sub'), object: 'subscription', customer, status,
        items: { object: 'list', data: [{ id: id('si'), price, current_period_end: 1893456000 }] } };
      db.subscriptions[s.id] = s; return s;
    } })));
}
