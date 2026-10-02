// Who can do what. Run against a fresh database loaded with
// supabase-stub.sql + ../schema.sql (see supabase/README.md).
import assert from 'node:assert/strict';
import { pool, call, raw } from './db.js';

const anon = { role: 'anon' };
const users = {};
for (const name of ['ownerA', 'ownerB', 'designer']) {
  const r = await pool.query(`insert into auth.users (email) values ($1) on conflict (email) do update set email = excluded.email returning id`, [name + '@test.local']);
  users[name] = { role: 'authenticated', sub: r.rows[0].id };
}
await pool.query('insert into admins (user_id) values ($1) on conflict do nothing', [users.designer.sub]);
const rejects = async (p, re, msg) => { await assert.rejects(p, re, msg); };
let n = 0; const ok = m => console.log(`  ✓ ${++n}. ${m}`);
const id = 'test-' + Date.now().toString(36);

// ---- tables are closed to everyone ----
await rejects(raw(anon, 'select * from cards'), /permission denied/, 'anon reads cards');
await rejects(raw(users.ownerA, 'select * from customers'), /permission denied/, 'owner reads customers table');
ok('nobody can read the tables directly');

// ---- owner A creates a card ----
await rejects(call(anon, 'owner_save_card', { p_card: { id } }), /permission denied/);
const card = await call(users.ownerA, 'owner_save_card', { p_card: { id, business: 'Bar Test', title: 'Carta caffè', reward: 'un caffè gratis', stampsNeeded: 3, design: { color: '#FFFFFF', ink: '#2B32FF', shape: 'dot', evil: 'x' } } });
assert.equal(card.business, 'Bar Test'); assert.equal(card.plan, 'start'); assert.equal(card.evil, undefined);
ok('owner creates a card; unknown design keys are dropped; plan starts as Start');
await rejects(call(users.ownerB, 'owner_save_card', { p_card: { id, business: 'Hijack' } }), /another café/);
ok('another owner cannot overwrite it');

// ---- a customer joins ----
assert.equal((await call(anon, 'get_card', { p_card_id: id })).title, 'Carta caffè');
const joined = await call(anon, 'join_card', { p_card_id: id, p_name: 'Giulia' });
assert.match(joined.id, /^[A-Z0-9]{6}$/); assert.equal(joined.secret.length, 48);
const mine = await call(anon, 'get_my_card', { p_code: joined.id, p_secret: joined.secret });
assert.equal(mine.customer.name, 'Giulia'); assert.equal(mine.customer.stamps, 0);
assert.equal(await call(anon, 'get_my_card', { p_code: joined.id, p_secret: 'wrong' }), null);
ok('customer joins and reads their card only with their secret');

// ---- linking the cashier's phone ----
await rejects(call(users.ownerB, 'owner_link_code'), /Create your card first/);
const link = await call(users.ownerA, 'owner_link_code');
assert.match(link.code, /^[A-Z0-9]{8}$/);
const dev = await call(anon, 'device_link', { p_code: link.code.toLowerCase(), p_name: 'Cassa 1' });
assert.equal(dev.business, 'Bar Test');
await rejects(call(anon, 'device_link', { p_code: link.code, p_name: 'Again' }), /expired or was already used/);
ok('link code works once, for the right café');

// ---- stamping ----
await rejects(call(anon, 'stamper_lookup', { p_token: 'nope', p_code: joined.id }), /not linked/);
assert.equal((await call(anon, 'stamper_lookup', { p_token: dev.token, p_code: joined.id.toLowerCase() })).customer.name, 'Giulia');
await rejects(call(anon, 'stamper_redeem', { p_token: dev.token, p_code: joined.id }), /not full yet/);
for (let i = 0; i < 5; i++) await call(anon, 'stamper_stamp', { p_token: dev.token, p_code: joined.id, p_delta: 1 });
let s = await call(anon, 'stamper_lookup', { p_token: dev.token, p_code: joined.id });
assert.equal(s.customer.stamps, 3, 'never goes past the goal');
await call(anon, 'stamper_stamp', { p_token: dev.token, p_code: joined.id, p_delta: -1 });
await call(anon, 'stamper_stamp', { p_token: dev.token, p_code: joined.id, p_delta: 1 });
s = await call(anon, 'stamper_redeem', { p_token: dev.token, p_code: joined.id });
assert.equal(s.customer.stamps, 0); assert.equal(s.customer.redeemed, 1);
ok('cashier stamps (capped at the goal), removes a stamp and gives the reward');

// ---- a phone from another café sees nothing ----
const cardB = 'testb-' + Date.now().toString(36);
await call(users.ownerB, 'owner_save_card', { p_card: { id: cardB, business: 'Other', title: 'X', reward: 'Y', stampsNeeded: 5 } });
const devB = await call(anon, 'device_link', { p_code: (await call(users.ownerB, 'owner_link_code')).code, p_name: 'B' });
assert.equal(await call(anon, 'stamper_lookup', { p_token: devB.token, p_code: joined.id }), null);
await rejects(call(anon, 'stamper_stamp', { p_token: devB.token, p_code: joined.id, p_delta: 1 }), /No customer/);
ok('another café\'s phone cannot see or stamp this customer');

// ---- owner dashboard data ----
const dataA = await call(users.ownerA, 'owner_data');
assert.equal(dataA.cards.length, 1); assert.equal(dataA.customers.length, 1); assert.equal(dataA.devices.length, 1); assert.equal(dataA.isAdmin, false);
assert.equal(dataA.customers[0].history.filter(h => h.type === 'stamp').length, 4);
const dataB = await call(users.ownerB, 'owner_data');
assert.ok(!dataB.cards.some(c => c.id === id) && !dataB.customers.some(c => c.id === joined.id));
ok('each owner sees only their own cards, customers and phones');

// ---- design approval ----
const sent = await call(users.ownerA, 'owner_send_design', { p_card_id: id, p_kind: 'proposal', p_design: { color: '#0B0B0C' }, p_note: 'nera', p_images: ['data:image/jpeg;base64,AA=='], p_links: ['https://example.com'] });
assert.equal(sent.review.status, 'pending'); assert.equal(sent.color, '#FFFFFF', 'live design unchanged');
assert.equal((await call(anon, 'get_card', { p_card_id: id })).color, '#FFFFFF');
await rejects(call(users.ownerB, 'owner_send_design', { p_card_id: id, p_kind: 'proposal', p_design: {}, p_note: '', p_images: [], p_links: [] }), /not found/);
await rejects(call(users.ownerA, 'admin_publish', { p_card_id: id, p_design: { color: '#0B0B0C' } }), /Only Witkowski Design/);
await rejects(call(users.ownerA, 'admin_set_plan', { p_card_id: id, p_plan: 'pro' }), /Only Witkowski Design/);
ok('owner proposes; customers keep the live design; owners cannot publish or change plan');
const all = await call(users.designer, 'admin_cards');
assert.ok(all.find(c => c.id === id).review.images.length === 1);
await call(users.designer, 'admin_publish', { p_card_id: id, p_design: { color: '#0B0B0C' } });
assert.equal((await call(anon, 'get_card', { p_card_id: id })).color, '#0B0B0C');
await call(users.designer, 'admin_set_plan', { p_card_id: id, p_plan: 'plus' });
const req = await call(users.ownerA, 'owner_send_design', { p_card_id: id, p_kind: 'request', p_design: { color: '#FF0000' }, p_note: 'più verde', p_images: [], p_links: [] });
assert.deepEqual(req.review.design, {}, 'a request carries no design');
await call(users.designer, 'admin_ask_changes', { p_card_id: id, p_reply: 'manda il logo' });
assert.equal((await call(users.ownerA, 'owner_data')).cards[0].review.reply, 'manda il logo');
ok('designer sees images, publishes, sets the plan and replies');

// ---- removing a phone ----
await call(users.ownerA, 'owner_remove_device', { p_device_id: dataA.devices[0].id });
await rejects(call(anon, 'stamper_lookup', { p_token: dev.token, p_code: joined.id }), /not linked/);
ok('a removed phone stops working at once');

console.log(`\nAll ${n} checks passed.`);
await pool.end();
