# Connecting Timbro to the database (Supabase)

Without this, the site is a demo: every phone keeps its own data. With it, the customer's card, the till phone, the owner's dashboard and your Studio all share one database.

About 15 minutes, once.

## 1. Create the project
1. Go to **supabase.com**, sign up (free) and click **New project**.
2. Name it `timbro`, choose a strong database password (keep it somewhere safe) and the region **Central EU (Frankfurt)** or the nearest one to Milan.

## 2. Create the tables
1. In the project, open **SQL Editor** → **New query**.
2. Paste the whole of [`schema.sql`](schema.sql) and press **Run**. You should see "Success".

You can run it again later after an update: it keeps your data.

## 3. Logins
In **Authentication → URL Configuration**:
- **Site URL:** `https://bartekarchi56.github.io/witkowskidesign/app/dashboard.html`
- **Redirect URLs:** add `https://bartekarchi56.github.io/witkowskidesign/**`

In **Authentication → Sign In / Providers → Email**, leave email sign-up on. "Confirm email" on is safer: owners click a link in an email before their first login.

## 4. Connect the website
In **Project Settings → API**, copy:
- the **Project URL** (like `https://abcdefgh.supabase.co`)
- the **anon public** key (Supabase may call it "publishable" key)

Put them in `assets/js/config.js`:

```js
supabase: {
  url: 'https://abcdefgh.supabase.co',
  anonKey: 'eyJhbGciOi…'
},
```

The anon key is meant to be public. The database checks every call itself.

**Never** put the `service_role` key (or the "secret" key) in the website.

## 5. Make yourself the designer
1. Open the site → **Accedi** → **Crea account** with your email, and confirm it.
2. Back in the **SQL Editor**, run (with your email):
   ```sql
   insert into admins (user_id) select id from auth.users where email = 'you@example.com';
   ```
Now `studio/` opens for you and shows every café's cards, proposals and requests.

## How each person gets in

| Who | How |
|---|---|
| Café owner | Signs up on the site (`app/login.html`), then uses the dashboard. |
| Cashier's phone | The owner opens **Cassa → Collega un telefono** and scans the QR with the till phone. No account needed. The owner can unlink a phone at any time. |
| Customer | Scans the café's poster and types a first name. Their phone keeps a secret that proves the card is theirs. |
| You | Your account is in the `admins` table, which opens the Studio, publishing and plans. |

## Plans

Until payments are added, you set each café's plan in the **Studio** (the "Piano" menu next to the café's name), or in SQL:

```sql
update cards set plan = 'plus' where id = 'the-card-id';
```

## Testing on your computer (optional)

`test/` checks the database rules on a local Postgres and runs the real pages end to end against a small stand-in for Supabase:

```
createdb timbro
psql -d timbro -f supabase/test/supabase-stub.sql -f supabase/schema.sql
cd supabase/test && npm install
node security.test.js                         # who can do what (11 checks)
node fake-supabase.js &                       # stand-in for Supabase on :54321
npx http-server -p 8123 ../.. &               # the site
node e2e.js                                   # signup → link phone → join → stamp → approve
```

Set `DATABASE_URL` if your Postgres isn't on `localhost:5433`.

## Good to know
- **Free plan:** the database pauses after a week with no visits; it wakes on the next visit. The Pro plan (25 USD/month) never pauses and has daily backups.
- **Images:** logos and inspiration photos are saved in the database for now. With many cafés, move them to Supabase Storage.
- **Stamp updates:** the customer's card page updates by itself every few seconds. Updating a card already saved in Apple/Google Wallet is the next step (see `wallet/README.md`).
