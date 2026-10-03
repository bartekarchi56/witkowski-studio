// Opens Stripe's billing portal for the logged-in café owner: invoices,
// card, plan changes and cancelling. Secrets: STRIPE_SECRET_KEY, optional SITE_URL.
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

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer /, '');
    const { data: { user } } = await db.auth.getUser(jwt);
    if (!user) return reply({ error: 'Please log in again.' }, 401);
    const { data: biz } = await db.rpc('stripe_business', { p_user: user.id });
    if (!biz?.customer) return reply({ error: 'No subscription yet.' }, 400);

    // Use the portal settings made by stripe-setup, if any; otherwise the account default.
    const configs = await stripe.billingPortal.configurations.list({ active: true, limit: 20 });
    const config = configs.data.find(c => c.metadata?.app === 'timbro');
    const session = await stripe.billingPortal.sessions.create({
      customer: biz.customer, return_url: SITE + 'app/dashboard.html#plan', ...(config ? { configuration: config.id } : {})
    });
    return reply({ url: session.url });
  } catch (e) {
    console.error('portal failed', (e as Error).message);
    return reply({ error: 'Payments are not available right now. Try again in a minute.' }, 500);
  }
});
