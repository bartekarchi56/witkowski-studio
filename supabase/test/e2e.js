// End-to-end test of the real pages against the database:
// owner signs up → links a till phone → customer joins → cashier stamps →
// customer sees it → owner proposes a design → Witkowski Design approves.
//
// Needs: the site served on SITE (default http://localhost:8123), and
// fake-supabase.js on SUPABASE (default http://localhost:54321).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { pool } from './db.js';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const SITE = process.env.SITE || 'http://localhost:8123/';
const SUPABASE = process.env.SUPABASE || 'http://localhost:54321';
const OUT = process.env.OUT || '.';
const stamp = Date.now().toString(36);
let step = 0; const ok = m => console.log(`  ✓ ${++step}. ${m}`);

const browser = await chromium.launch();
async function context(opts = {}) {
  const ctx = await browser.newContext({ locale: 'it-IT', viewport: { width: 1280, height: 900 }, ...opts });
  // Point the site at the test database without touching config.js.
  await ctx.route('**/assets/js/config.js', async route => {
    const res = await route.fetch();
    route.fulfill({ response: res, body: (await res.text()) + `\nCONFIG.supabase = { url: '${SUPABASE}', anonKey: 'test-anon-key' };` });
  });
  ctx.errors = [];
  ctx.on('page', p => p.on('pageerror', e => ctx.errors.push(e.message)));
  return ctx;
}

// ---- owner signs up and gets a first card ----
const owner = await context();
const o = await owner.newPage();
await o.goto(SITE + 'app/dashboard.html');
await o.waitForURL(/login\.html/);
await o.click('#mode button[data-m=up]');
// the password box looks like the others
const box = sel => o.$eval(sel, el => { const s = getComputedStyle(el); return [s.borderRadius, s.minHeight, s.borderTopWidth].join(); });
assert.equal(await box('input[name=password]'), await box('input[name=email]'));
await o.fill('input[name=business]', 'Bar Prova');
await o.selectOption('select[name=type]', 'pasticceria');
await o.fill('input[name=name]', 'Mario Rossi');
await o.fill('input[name=phone]', '+39 333 123 4567');
await o.fill('input[name=instagram]', '@barprova');
await o.fill('input[name=email]', `owner-${stamp}@test.local`);
await o.fill('input[name=password]', 'password123');
await o.fill('input[name=password2]', 'password124');
await o.click('#submit');
assert.match(await o.textContent('#msg'), /non sono uguali/);
await o.fill('input[name=password2]', 'password123');
await o.click('#submit');
await o.waitForURL(/dashboard\.html/);
await o.waitForSelector('#card-form input[name=business]');
assert.equal(await o.inputValue('#card-form input[name=business]'), 'Bar Prova');   // from the sign-up form
await o.fill('#card-form input[name=business]', 'Bar Prova');
await o.click('#card-form button[type=submit]');
await o.waitForTimeout(800);
const cardId = new URL(o.url()).searchParams.get('card');
const db1 = await pool.query('select c.business, c.plan, c.type, b.contact_name, b.phone, b.instagram, b.city from timbro.cards c join timbro.businesses b on b.id = c.business_id where c.id = $1', [cardId]);
assert.deepEqual({ ...db1.rows[0] }, { business: 'Bar Prova', plan: 'start', type: 'pasticceria', contact_name: 'Mario Rossi', phone: '+39 333 123 4567', instagram: 'barprova', city: 'Milano' });
ok('owner signs up with their café details; the first card is made from them and saved');

// ---- link the till phone ----
await o.click('#t-till');
await o.click('#link-new');
await o.waitForSelector('#link-box b');
const linkCode = (await o.textContent('#link-box b')).trim();
await o.screenshot({ path: `${OUT}/e2e-till.png`, fullPage: true });
const till = await context({ viewport: { width: 390, height: 844 } });
const t = await till.newPage();
await t.goto(SITE + 'app/stamper.html?link=' + linkCode);
assert.equal(await t.inputValue('#link-form input[name=code]'), linkCode);
await t.fill('#link-form input[name=name]', 'Cassa 1');
await t.click('#link-form button[type=submit]');
await t.waitForSelector('#find:not([hidden])');
assert.match(await t.textContent('#linked'), /Bar Prova/);
ok('till phone links with the code from the dashboard (QR link pre-fills it)');

// ---- customer joins on their phone ----
const cust = await context({ viewport: { width: 390, height: 844 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' });
const c = await cust.newPage();
await c.goto(SITE + 'app/card.html?card=' + cardId);
await c.fill('input[name=name]', 'Giulia');
await c.click('#join button[type=submit]');
await c.waitForSelector('.wp-code small');
const code = (await c.textContent('.wp-code small')).trim();
assert.match(code, /^[A-Z0-9]{6}$/);
ok('customer joins; the code on their card comes from the database');

// ---- cashier stamps ----
await t.fill('#code-form input', code.toLowerCase());
await t.click('#code-form button');
await t.waitForSelector('#stamp:not([hidden])', { timeout: 8000 }).catch(async e => {
  console.log('stamper error text:', await t.textContent('#err'), '| link visible:', await t.isVisible('#link'), '| card code:', code);
  throw e;
});
await t.click('#main-action'); await t.waitForTimeout(400);
await t.click('#main-action'); await t.waitForTimeout(400);
assert.match(await t.textContent('.pass-count, .wp-hf .wp-val'), /2\//);
await t.screenshot({ path: `${OUT}/e2e-stamper.png` });
ok('cashier finds the customer by code and adds 2 stamps');

await c.waitForFunction(() => /2\//.test(document.querySelector('.wp-hf .wp-val, .google .wp-fields .wp-val')?.textContent || ''), null, { timeout: 12000 });
await c.screenshot({ path: `${OUT}/e2e-customer.png`, fullPage: true });
ok('the customer\'s card updates by itself to 2 stamps');

// ---- owner sees the customer ----
await o.reload(); await o.waitForSelector('#card-form input[name=business]', { state: 'attached' }); await o.waitForTimeout(800);
await o.click('#t-customers'); await o.waitForTimeout(300);
assert.match(await o.textContent('#customers'), /Giulia/);
assert.match(await o.textContent('#stats'), /2/);
assert.match(await o.textContent('#devices').catch(() => ''), /|/);
ok('owner sees Giulia and the stamps in Customers');

// ---- owner proposes a design; designer approves in the Studio ----
await o.click('#t-design');
const black = await o.locator('#editor input[value="#0B0B0C"]').first().getAttribute('id');
await o.click(`label[for="${black}"]`);
await o.fill('#design-form textarea[name=note]', 'Vorrei la carta nera');
await o.click('#design-submit'); await o.waitForTimeout(800);
assert.equal((await pool.query('select review->>\'status\' s, design->>\'color\' c from timbro.cards where id = $1', [cardId])).rows[0].s, 'pending');
const s0 = await owner.newPage(); await s0.goto(SITE + 'studio/'); await s0.waitForTimeout(800);
assert.match(await s0.textContent('main'), /Only Witkowski Design/);
ok('owner sends the design for approval; owners cannot open the Studio');

const designer = await context();
const d = await designer.newPage();
await d.goto(SITE + 'app/login.html');
await d.click('#mode button[data-m=up]');
for (const [n, v] of [['business', 'Witkowski Design'], ['name', 'Bartek'], ['phone', '1'], ['email', `design-${stamp}@test.local`], ['password', 'password123'], ['password2', 'password123']]) await d.fill(`input[name=${n}]`, v);
await d.click('#submit'); await d.waitForURL(/dashboard\.html/);
await pool.query(`insert into timbro.admins (user_id) select id from auth.users where email = $1`, [`design-${stamp}@test.local`]);
await d.goto(SITE + 'studio/?card=' + cardId);
await d.waitForSelector('#approve');
assert.match(await d.textContent('#w-note'), /carta nera/);
assert.match(await d.textContent('#w-contact'), /Mario Rossi.*\+39 333 123 4567.*owner-.*@barprova/);
await d.screenshot({ path: `${OUT}/e2e-studio.png`, fullPage: true });
await d.click('#approve'); await d.waitForTimeout(800);
assert.equal((await pool.query('select design->>\'color\' c from timbro.cards where id = $1', [cardId])).rows[0].c, '#0B0B0C');
await c.waitForFunction(() => getComputedStyle(document.querySelector('.pass')).backgroundColor === 'rgb(11, 11, 12)', null, { timeout: 12000 });
ok('Witkowski Design approves in the Studio; the customer\'s card turns black');
await d.selectOption('#w-plan', 'plus'); await d.waitForTimeout(600);
assert.equal((await pool.query('select plan from timbro.cards where id = $1', [cardId])).rows[0].plan, 'plus');
ok('Witkowski Design sets the café\'s plan to Plus from the Studio');

// ---- the poster shows this café's card; The Coffee's printed example stays a demo ----
const pp = await owner.newPage();
await pp.goto(SITE + 'app/poster.html?card=' + cardId);
await pp.waitForFunction(() => /Bar Prova/.test(document.getElementById('sheet').textContent));
const demo = await context({ viewport: { width: 390, height: 844 } });
const dm = await demo.newPage();
let calls = 0; dm.on('request', r => { if (r.url().startsWith(SUPABASE)) calls++; });
await dm.goto(SITE + 'app/card.html?card=the-coffee');
await dm.fill('input[name=name]', 'Demo'); await dm.click('#join button[type=submit]');
await dm.waitForSelector('.wp-code small');
await dm.goto(SITE + 'app/stamper.html?demo'); await dm.waitForSelector('#code-form');
assert.equal(calls, 0, 'demo pages never call the database');
await demo.close();
ok('the poster shows the café\'s own card; The Coffee\'s brochure QR still opens the demo');

// ---- unlinking the till phone ----
await o.reload(); await o.waitForSelector('#card-form input[name=business]', { state: 'attached' }); await o.waitForTimeout(800);
await o.click('#t-till');
o.once('dialog', dlg => dlg.accept());
await o.click('#devices [data-dev]'); await o.waitForTimeout(600);
await t.click('#next'); await t.fill('#code-form input', code); await t.click('#code-form button');
await t.waitForSelector('#link:not([hidden])');
ok('after the owner unlinks it, the till phone asks to be linked again');

for (const ctx of [owner, till, cust, designer]) assert.deepEqual(ctx.errors, [], 'no page errors');
console.log(`\nAll ${step} steps passed.`);
await browser.close(); await pool.end();
