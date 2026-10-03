# Notes for Claude

- The owner's company is **Witkowski Design** (short name / handle: `witkowskidesign`). Never call it "Witkowski Studio" or "witkowski-studio", even though the repository was first created under that name.
- The loyalty-card service built here is called **Timbro** (working name). Brand settings live in `assets/js/config.js`.
- The website is published at `https://timbro.witkowskidesign.com/` (GitHub Pages custom domain, `CNAME` file; the domain is on Cloudflare). Printed QR codes use `siteUrl` in `assets/js/config.js`; regenerate the PDFs in `print/` with `node print/make-pdfs.js` whenever it changes.
- Emails (sign-up, password reset) go through Resend SMTP from `noreply@witkowskidesign.com`, set in Supabase.
- Subscriptions: Stripe via Supabase Edge Functions in `supabase/functions/` (setup in `supabase/STRIPE.md`). Stripe keys live only in Supabase secrets; never in the site, the repo or chat. Products/prices are found by lookup keys `timbro_<plan>_<month|year>`.
- The owner's SQL editor accepts about 100 lines per paste: database changes go in `supabase/updates/` files under 100 lines; `node supabase/make-parts.js` regenerates `supabase/parts/`.
- Every update file must end with the whole permissions block from `schema.sql` (revoke all, then the grants): Postgres lets PUBLIC execute new functions, and a per-schema default privilege can't take that away. Check an upgrade with `has_function_privilege('anon', ...)`.
- No em dashes in user-facing copy.
