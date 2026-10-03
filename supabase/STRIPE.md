# Subscriptions with Stripe

Cafés pick a plan in their dashboard (**Abbonamento** tab), pay on Stripe's own checkout page (card, Apple/Google Pay or SEPA direct debit), get 30 days free, and manage or cancel it in Stripe's billing portal. Their plan in Timbro switches by itself.

```
Dashboard ──► stripe-checkout ──► Stripe Checkout ──► Stripe
                                                        │  (webhook: started, renewed, failed, cancelled)
Studio ───► stripe-setup (products, prices, portal)     ▼
Dashboard ──► stripe-portal ──► Billing portal     stripe-webhook ──► timbro.businesses + cards.plan
```

The four functions are in [`functions/`](functions). They run on Supabase (Edge Functions), in the same project as the database. **Your Stripe key lives only in Supabase's secrets**: never in the website, in GitHub or in a chat.

Do everything first in Stripe's **test mode** (the "Test mode" switch in the Stripe dashboard), try it, then repeat steps 2, 4 and 5 in live mode.

## 1. Update the database
In Supabase → **SQL Editor**, run [`updates/2a-billing.sql`](updates/2a-billing.sql), then [`updates/2b-billing.sql`](updates/2b-billing.sql).

## 2. A restricted key in Stripe
Stripe → **Developers → API keys → Create restricted key**. Name it `timbro-supabase` and give it only:

| Resource | Permission |
|---|---|
| Customers | Write |
| Products | Write |
| Prices | Write |
| Checkout Sessions | Write |
| Customer portal | Write |
| Subscriptions | Read |

Copy the key (`rk_test_...`). A restricted key can only do these things, so it's much safer than the main secret key.

## 3. Create the functions in Supabase
Supabase → **Edge Functions → Deploy a new function → Via Editor**. Create four functions; the **name must be exactly** as below. Paste the file's content, then **Deploy**.

| Name | File | "Verify JWT" |
|---|---|---|
| `stripe-checkout` | [functions/stripe-checkout/index.ts](functions/stripe-checkout/index.ts) | on (default) |
| `stripe-portal` | [functions/stripe-portal/index.ts](functions/stripe-portal/index.ts) | on (default) |
| `stripe-setup` | [functions/stripe-setup/index.ts](functions/stripe-setup/index.ts) | on (default) |
| `stripe-webhook` | [functions/stripe-webhook/index.ts](functions/stripe-webhook/index.ts) | **off** (Stripe has no Supabase login; it's checked by signature instead) |

For `stripe-webhook`, open the function's **Details / Settings** and turn **Enforce JWT verification** off, then save.

## 4. Secrets
Supabase → **Edge Functions → Secrets** → add:

| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | the `rk_test_...` key from step 2 |
| `STRIPE_WEBHOOK_SECRET` | from step 5 (`whsec_...`) |

Optional: `TRIAL_DAYS` (default `30`), `SITE_URL` (default `https://timbro.witkowskidesign.com/`), `AUTOMATIC_TAX` (see Tax below).
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase automatically.

## 5. The webhook in Stripe
Stripe → **Developers → Webhooks → Add destination** (or "Add endpoint"):
- **Endpoint URL:** `https://xchpnvadjxonhnknywis.supabase.co/functions/v1/stripe-webhook`
- **Events:** `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`, `invoice.paid`, `invoice.payment_failed`

Save, open it, reveal the **Signing secret** (`whsec_...`) and put it in the `STRIPE_WEBHOOK_SECRET` secret (step 4).

## 6. Create the plans
Open the **Studio** → **Prepara i piani su Stripe**. It creates Timbro Start, Plus and Pro, each with a monthly and a yearly price (from `plans` and `yearlyMonths` in `assets/js/config.js`, prices excluding VAT), and the billing portal settings. Press it again whenever you change prices: new prices replace the old ones for new subscribers; existing subscribers keep theirs.

## 7. Try it
Log in as a test café → **Abbonamento** → **Scegli Plus**. On Stripe's page use card `4242 4242 4242 4242`, any future date, any CVC. Back in the dashboard the tab shows the trial; the Studio shows "In prova · Plus" next to the café.

## Before taking real money
- **Business details:** Stripe → Settings → Business: your registered business, address and VAT number (they appear on invoices). Fill the same details into `legal` in `assets/js/config.js` so the legal pages show them.
- **Legal links:** Stripe → Settings → Business → Public details: Terms of service `https://timbro.witkowskidesign.com/legal/#termini`, Privacy policy `https://timbro.witkowskidesign.com/legal/#privacy`.
- **Invoices:** Settings → Billing → Subscriptions and emails: turn on emailing finalized invoices and receipts.
- **Payment methods:** Settings → Payment methods: turn on SEPA Direct Debit, Apple Pay and Google Pay.
- **Tax:** checkout always asks cafés for their VAT number, so EU businesses get reverse-charge invoices. Stripe only calculates VAT where you have an **active registration** in Stripe Tax (Tax → Registrations); without one it silently charges none. Once your accountant confirms your registration, add it there and set the secret `AUTOMATIC_TAX` = `true`.
- **Live mode:** repeat steps 2, 4 and 5 with live keys (`rk_live_...`, a new webhook and its `whsec_...`), then step 6.
- Turn on two-factor login for Stripe (an authenticator app or passkey, not SMS).

## Testing on your computer
`test/stripe.test.js` runs the real functions in Deno against the real database functions, with a stand-in for Stripe (`test/fake-stripe.js`): setup, checkout (trial, VAT number, no hard-coded payment methods), signed and forged webhooks, portal, cancelling without a second trial. With the database and `fake-supabase.js` running (see README): `DENO=/path/to/deno node stripe.test.js`.
