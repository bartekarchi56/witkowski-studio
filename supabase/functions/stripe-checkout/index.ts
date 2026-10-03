// Starts a subscription: the café owner picks a plan in the dashboard and is
// sent to Stripe Checkout. Already subscribed? They go to the billing portal
// instead, where they can change plan, card or cancel.
// Secrets (Supabase → Edge Functions → Secrets): STRIPE_SECRET_KEY (restricted
// key, rk_...), optional SITE_URL, TRIAL_DAYS (default 30), AUTOMATIC_TAX=true.
import Stripe from 'npm:stripe@23';
import { createClient } from 'npm:@supabase/supabase-js@2';

const mock = Deno.env.get('STRIPE_MOCK_URL');   // tests only: a local stand-in for Stripe
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', mock ? { host: new URL(mock).hostname, port: Number(new URL(mock).port), protocol: 'http' } : {});
// The server key: the legacy service_role key, or the newer sb_secret_ key on projects that use it.
const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || (() => { try { return Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}'))[0] as string; } catch { return ''; } })();
const db = createClient(Deno.env.get('SUPABASE_URL')!, serverKey, { db: { schema: 'timbro' } });
const SITE = (Deno.env.get('SITE_URL') ?? 'https://timbro.witkowskidesign.com/').replace(/\/?$/, '/');
const TRIAL = Number(Deno.env.get('TRIAL_DAYS') ?? 30);
const PLANS = ['start', 'plus', 'pro'], INTERVALS = ['month', 'year'];
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    // Who is asking: the logged-in owner (Supabase sends their login token).
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
    const { data: { user } } = await db.auth.getUser(jwt);
    if (!user) return reply({ error: 'Please log in again.' }, 401);
    const { plan, interval } = await req.json().catch(() => ({}));
    if (!PLANS.includes(plan) || !INTERVALS.includes(interval)) return reply({ error: 'Choose a plan.' }, 400);

    let { data: biz } = await db.rpc('stripe_business', { p_user: user.id });
    if (!biz) return reply({ error: 'Create your card first.' }, 400);

    // One Stripe customer per café, created the first time.
    if (!biz.customer) {
      const customer = await stripe.customers.create(
        { email: biz.email ?? undefined, name: biz.name || undefined, phone: biz.phone || undefined, metadata: { business_id: biz.id } },
        { idempotencyKey: 'timbro-customer-' + biz.id });
      await db.rpc('stripe_set_customer', { p_business: biz.id, p_customer: customer.id });
      ({ data: biz } = await db.rpc('stripe_business', { p_user: user.id }));
    }

    // Already paying or on trial: manage it in the portal rather than starting a second subscription.
    if (['trialing', 'active', 'past_due', 'unpaid', 'paused'].includes(biz.status)) {
      const portal = await stripe.billingPortal.sessions.create({ customer: biz.customer, return_url: SITE + 'app/dashboard.html#plan' });
      return reply({ url: portal.url });
    }

    const prices = await stripe.prices.list({ lookup_keys: [`timbro_${plan}_${interval}`], active: true, limit: 1 });
    if (!prices.data.length) return reply({ error: 'This plan is not available yet.' }, 400);

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: biz.customer,
      client_reference_id: biz.id,
      line_items: [{ price: prices.data[0].id, quantity: 1 }],
      subscription_data: { metadata: { business_id: biz.id }, ...(biz.trialUsed || !TRIAL ? {} : { trial_period_days: TRIAL }) },
      // Cafés are businesses: their VAT number goes on the invoice (reverse charge in the EU).
      tax_id_collection: { enabled: true },
      billing_address_collection: 'required',
      customer_update: { name: 'auto', address: 'auto' },
      automatic_tax: { enabled: Deno.env.get('AUTOMATIC_TAX') === 'true' },
      allow_promotion_codes: true,
      locale: 'auto',
      integration_identifier: 'timbro-dashboard-qkzvmhra',
      success_url: SITE + 'app/dashboard.html?billing=success#plan',
      cancel_url: SITE + 'app/dashboard.html?billing=cancel#plan'
    });
    return reply({ url: session.url });
  } catch (e) {
    console.error('checkout failed', (e as Error).message);
    return reply({ error: 'Payments are not available right now. Try again in a minute.' }, 500);
  }
});
