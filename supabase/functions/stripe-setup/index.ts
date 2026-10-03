// Creates (or updates) the Stripe catalogue from the Studio: one Product per
// plan, a monthly and a yearly Price each (lookup keys timbro_<plan>_<month|year>),
// and the billing portal settings. Only Witkowski Design (timbro.admins) can run it.
// Safe to run again: unchanged prices are kept, changed ones replace the old.
import Stripe from 'npm:stripe@23';
import { createClient } from 'npm:@supabase/supabase-js@2';

const mock = Deno.env.get('STRIPE_MOCK_URL');   // tests only: a local stand-in for Stripe
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', mock ? { host: new URL(mock).hostname, port: Number(new URL(mock).port), protocol: 'http' } : {});
// The server key: the legacy service_role key, or the newer sb_secret_ key on projects that use it.
const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || (() => { try { return Object.values(JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}'))[0] as string; } catch { return ''; } })();
const db = createClient(Deno.env.get('SUPABASE_URL')!, serverKey, { db: { schema: 'timbro' } });
const SITE = (Deno.env.get('SITE_URL') ?? 'https://timbro.witkowskidesign.com/').replace(/\/?$/, '/');
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } });
const SAAS_BUSINESS = 'txcd_10103001';   // Stripe tax code: software as a service, business use

type Plan = { id: string; name: string; month: number; yearMonths?: number };

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
    const { data: { user } } = await db.auth.getUser(jwt);
    const { data: admin } = user ? await db.rpc('stripe_is_admin', { p_user: user.id }) : { data: false };
    if (!admin) return reply({ error: 'Only Witkowski Design can set up payments.' }, 403);

    const { plans } = await req.json() as { plans: Plan[] };
    if (!Array.isArray(plans) || !plans.every(p => ['start', 'plus', 'pro'].includes(p.id) && p.month > 0 && p.month < 1000)) {
      return reply({ error: 'Plans look wrong.' }, 400);
    }
    const products = (await stripe.products.list({ active: true, limit: 100 })).data;
    const done: string[] = [], portalProducts: { product: string; prices: string[] }[] = [];

    for (const plan of plans) {
      let product = products.find(p => p.metadata?.timbro_plan === plan.id);
      const name = 'Timbro ' + plan.name;
      if (!product) product = await stripe.products.create({ name, tax_code: SAAS_BUSINESS, metadata: { timbro_plan: plan.id } });
      else if (product.name !== name) product = await stripe.products.update(product.id, { name });
      const priceIds: string[] = [];
      for (const interval of ['month', 'year'] as const) {
        const amount = Math.round(plan.month * (interval === 'year' ? (plan.yearMonths ?? 10) : 1) * 100);
        const key = `timbro_${plan.id}_${interval}`;
        const [current] = (await stripe.prices.list({ lookup_keys: [key], active: true, limit: 1 })).data;
        if (current && current.unit_amount === amount && current.product === product.id) { priceIds.push(current.id); continue; }
        // Prices can't be edited in Stripe: make a new one and move the lookup key to it.
        const price = await stripe.prices.create({
          product: product.id, currency: 'eur', unit_amount: amount, recurring: { interval },
          tax_behavior: 'exclusive', lookup_key: key, transfer_lookup_key: true
        });
        if (current) await stripe.prices.update(current.id, { active: false });
        priceIds.push(price.id);
        done.push(`${key}: €${amount / 100}`);
      }
      portalProducts.push({ product: product.id, prices: priceIds });
    }

    // Billing portal: invoices, card, switching between plans, cancelling at the end of the period.
    const features: Stripe.BillingPortal.ConfigurationCreateParams.Features = {
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      customer_update: { enabled: true, allowed_updates: ['email', 'address', 'name', 'tax_id'] },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      subscription_update: { enabled: true, default_allowed_updates: ['price'], products: portalProducts, proration_behavior: 'create_prorations' }
    };
    const configs = (await stripe.billingPortal.configurations.list({ active: true, limit: 20 })).data;
    const config = configs.find(c => c.metadata?.app === 'timbro');
    const business_profile = { headline: 'Timbro by Witkowski Design', privacy_policy_url: SITE + 'legal/#privacy', terms_of_service_url: SITE + 'legal/#termini' };
    if (config) await stripe.billingPortal.configurations.update(config.id, { features, business_profile });
    else await stripe.billingPortal.configurations.create({
      features, business_profile, metadata: { app: 'timbro' }, default_return_url: SITE + 'app/dashboard.html#plan'
    });
    return reply({ ok: true, changed: done });
  } catch (e) {
    console.error('setup failed', (e as Error).message);
    return reply({ error: (e as Error).message }, 500);
  }
});
