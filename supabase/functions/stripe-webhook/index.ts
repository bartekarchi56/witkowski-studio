// Stripe tells us here when a subscription starts, renews, fails or ends; we
// copy its state onto the café (timbro.businesses) and its cards' plan.
// Deploy with "Verify JWT" OFF (Stripe has no Supabase login); every request
// is checked with the webhook signing secret instead.
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (whsec_...).
import Stripe from 'npm:stripe@23';
import { createClient } from 'npm:@supabase/supabase-js@2';

const mock = Deno.env.get('STRIPE_MOCK_URL');   // tests only: a local stand-in for Stripe
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', mock ? { host: new URL(mock).hostname, port: Number(new URL(mock).port), protocol: 'http' } : {});
// The server key: the legacy service_role key, or the newer sb_secret_ key on projects that use it.
const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || (() => { try { return Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}'))[0] as string; } catch { return ''; } })();
const db = createClient(Deno.env.get('SUPABASE_URL')!, serverKey, { db: { schema: 'timbro' } });
const crypto = Stripe.createSubtleCryptoProvider();
const LIVE = ['trialing', 'active', 'past_due', 'unpaid', 'paused'];

// Which customer an event is about.
function customerOf(event: Stripe.Event): string | null {
  const o = event.data.object as { customer?: string | { id: string } | null };
  return typeof o.customer === 'string' ? o.customer : o.customer?.id ?? null;
}

// Reads the customer's subscriptions from Stripe (never trusting event order)
// and saves the one that matters: a live one first, else the newest.
async function sync(customer: string) {
  const subs = await stripe.subscriptions.list({ customer, status: 'all', limit: 10 });
  const sub = subs.data.find(s => LIVE.includes(s.status)) ?? subs.data[0];
  const item = sub?.items.data[0];
  // Prices are found by lookup key, e.g. timbro_plus_month → plus, month.
  const [, plan = '', interval = ''] = (item?.price.lookup_key ?? '').match(/^timbro_(start|plus|pro)_(month|year)$/) ?? [];
  const { error } = await db.rpc('stripe_sync', {
    p_customer: customer, p_subscription: sub?.id ?? null, p_status: sub?.status ?? null,
    p_plan: plan, p_interval: interval, p_period_end: item?.current_period_end ?? null,
    // Cancelled in the portal: it keeps running until the end of the period, then ends.
    p_canceling: !!sub && LIVE.includes(sub.status) && (sub.cancel_at_period_end || !!sub.cancel_at)
  });
  if (error) throw new Error(error.message);
}

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), req.headers.get('stripe-signature') ?? '',
      Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '', undefined, crypto);
  } catch {
    return new Response('Bad signature', { status: 400 });
  }
  try {
    const relevant = event.type.startsWith('customer.subscription.') || event.type === 'invoice.paid' || event.type === 'invoice.payment_failed'
      || ((event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded')
          && (event.data.object as Stripe.Checkout.Session).mode === 'subscription');
    const customer = customerOf(event);
    if (relevant && customer) await sync(customer);
    return new Response(JSON.stringify({ received: true }), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    // A 500 makes Stripe retry later.
    console.error('webhook failed', event.type, (e as Error).message);
    return new Response('Try again', { status: 500 });
  }
});
