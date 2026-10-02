// Subscriptions end to end: the real Edge Functions (supabase/functions/)
// running in Deno, the real database functions, and stand-ins for Supabase's
// HTTP API (fake-supabase.js) and Stripe (fake-stripe.js).
// Needs: a fresh database (see supabase/README.md), fake-supabase.js on :54321,
// and Deno (DENO=/path/to/deno if it isn't on PATH).
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { pool } from './db.js';
import { fakeStripe } from './fake-stripe.js';

const SUPABASE = process.env.SUPABASE || 'http://localhost:54321';
const DENO = process.env.DENO || 'deno';
const WHSEC = 'whsec_test_secret';
const fns = new URL('../functions/', import.meta.url).pathname;
let step = 0; const ok = m => console.log(`  ✓ ${++step}. ${m}`);

const stripe = await fakeStripe(12111);
const env = { ...process.env, SUPABASE_URL: SUPABASE, SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key', STRIPE_SECRET_KEY: 'rk_test_local',
  STRIPE_WEBHOOK_SECRET: WHSEC, STRIPE_MOCK_URL: 'http://localhost:12111', SITE_URL: 'https://timbro.example/' };

// Runs one Edge Function on :8000 for the duration of `use`.
async function withFunction(name, use) {
  const p = spawn(DENO, ['run', '-A', '--quiet', fns + name + '/index.ts'], { env, stdio: ['ignore', 'pipe', 'inherit'] });
  for (let i = 0; i < 100; i++) { try { await fetch('http://localhost:8000', { method: 'OPTIONS' }); break; } catch { await new Promise(r => setTimeout(r, 200)); } }
  try { return await use((body, token, headers = {}) => fetch('http://localhost:8000', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}), ...headers } })); }
  finally { p.kill(); await new Promise(r => p.on('exit', r)); }
}
async function signup(email) {
  const r = await (await fetch(SUPABASE + '/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password: 'password123' }) })).json();
  return r.access_token;
}
const rpc = async (token, fn, args) => (await fetch(`${SUPABASE}/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args),
  headers: { authorization: 'Bearer ' + token, 'content-profile': 'timbro' } })).json();

const tag = Date.now().toString(36);
const owner = await signup(`pay-${tag}@test.local`), designer = await signup(`boss-${tag}@test.local`);
await pool.query(`insert into timbro.admins (user_id) select id from auth.users where email = $1`, [`boss-${tag}@test.local`]);
await rpc(owner, 'owner_save_card', { p_card: { id: 'bar-' + tag, business: 'Bar Pagato', title: 'Carta', reward: 'un caffè', stampsNeeded: 8 } });
const plans = [{ id: 'start', name: 'Start', month: 19 }, { id: 'plus', name: 'Plus', month: 35 }, { id: 'pro', name: 'Pro', month: 69 }];

// ---- setup: only the designer creates the catalogue ----
await withFunction('stripe-setup', async post => {
  assert.equal((await post({ plans }, owner)).status, 403);
  const r = await (await post({ plans }, designer)).json();
  assert.equal(r.changed.length, 6);
  assert.equal((await (await post({ plans }, designer)).json()).changed.length, 0);   // running again changes nothing
  await post({ plans: plans.map(p => p.id === 'plus' ? { ...p, month: 39 } : p) }, designer);
});
const prices = Object.values(stripe.db.prices).filter(p => p.active);
assert.equal(prices.length, 6);
assert.equal(prices.find(p => p.lookup_key === 'timbro_plus_year').unit_amount, 39000);
assert.ok(prices.every(p => p.tax_behavior === 'exclusive' && p.currency === 'eur'));
assert.equal(Object.values(stripe.db.configs).length, 1);
ok('the designer creates 3 products × monthly/yearly prices and the portal; a price change replaces the old price');

// ---- checkout ----
let session;
await withFunction('stripe-checkout', async post => {
  assert.equal((await post({ plan: 'plus', interval: 'month' })).status, 401);
  assert.equal((await post({ plan: 'gold', interval: 'month' }, owner)).status, 400);
  const r = await (await post({ plan: 'plus', interval: 'month' }, owner)).json();
  assert.match(r.url, /checkout\.stripe\.test/);
  session = stripe.db.sessions.at(-1);
});
assert.equal(session.mode, 'subscription'); assert.equal(session.subscription_data.trial_period_days, '30');
assert.equal(session.payment_method_types, undefined); assert.equal(session.tax_id_collection.enabled, 'true');
assert.equal(session.automatic_tax.enabled, 'false'); assert.ok(session.integration_identifier);
assert.equal(session.line_items[0].price, prices.find(p => p.lookup_key === 'timbro_plus_month').id);
const { rows: [biz] } = await pool.query(`select b.* from timbro.businesses b join auth.users u on u.id = b.owner_id where u.email = $1`, [`pay-${tag}@test.local`]);
assert.equal(biz.stripe_customer, session.customer);
ok('the owner gets a Checkout link: 30-day trial, VAT number collected, no hard-coded payment methods');

// ---- webhook ----
const event = (type, object) => JSON.stringify({ id: 'evt_' + type, object: 'event', type, data: { object } });
const signed = async payload => ({ 'stripe-signature': await Stripe.webhooks.generateTestHeaderStringAsync({ payload, secret: WHSEC }) });
const sub = stripe.addSubscription(biz.stripe_customer, 'timbro_plus_month', 'trialing');
await withFunction('stripe-webhook', async post => {
  const payload = event('checkout.session.completed', { id: session.id, mode: 'subscription', customer: biz.stripe_customer });
  assert.equal((await post(payload, null, { 'stripe-signature': 't=1,v1=forged' })).status, 400);
  assert.equal((await post(payload, null, await signed(payload))).status, 200);
});
let data = await rpc(owner, 'owner_data', {});
assert.equal(data.billing.status, 'trialing'); assert.equal(data.billing.plan, 'plus'); assert.equal(data.billing.interval, 'month');
assert.ok(data.cards.every(c => c.plan === 'plus'));
ok('a signed webhook switches the café to Plus (trial); a forged one is rejected');

// ---- already subscribed: portal instead of a second subscription ----
await withFunction('stripe-checkout', async post => {
  assert.match((await (await post({ plan: 'pro', interval: 'year' }, owner)).json()).url, /billing\.stripe\.test/);
});
await withFunction('stripe-portal', async post => {
  assert.match((await (await post({}, owner)).json()).url, /billing\.stripe\.test/);
  assert.equal(stripe.db.portalSessions.at(-1).configuration, Object.keys(stripe.db.configs)[0]);
});
ok('a subscribed owner is sent to the billing portal, with Timbro\'s portal settings');

// ---- cancelled: back to checkout, without a second free trial ----
sub.status = 'canceled';
await withFunction('stripe-webhook', async post => {
  const payload = event('customer.subscription.deleted', sub);
  assert.equal((await post(payload, null, await signed(payload))).status, 200);
});
data = await rpc(owner, 'owner_data', {});
assert.equal(data.billing.status, 'canceled');
await withFunction('stripe-checkout', async post => { await post({ plan: 'start', interval: 'year' }, owner); });
assert.equal(stripe.db.sessions.at(-1).subscription_data.trial_period_days, undefined);
ok('after cancelling, the status updates and a new checkout has no second free trial');

console.log(`\nAll ${step} steps passed.`);
stripe.close(); await pool.end();
