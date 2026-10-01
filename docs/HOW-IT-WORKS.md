# How a digital stamp card service works

This explains how services like Loopy Loyalty work, what this repo already does, and what is left to launch it for paying businesses.

## The three people involved

| Who | What they do | Where in this repo |
|---|---|---|
| **Business owner** | Designs the card (name, colour, icon, stamps needed, reward), gets a QR code to print, watches members and stats | `app/dashboard.html` |
| **Customer** | Scans the QR code, types their first name, gets a card with their own QR code and 6-letter code | `app/card.html?card=<id>` |
| **Staff** | Scans the customer's QR (or types the code), taps "Add stamp", and taps "Give reward" when the card is full | `app/stamper.html` |

The flow is always the same:

1. Owner designs a card → gets a **join link** and **QR poster**.
2. Customer scans the poster → a **customer record** is created → the card appears on their phone.
3. Each visit, staff scan the **customer's code** → one **stamp** is added.
4. When stamps = goal, the card shows **Reward ready** → staff give the reward → stamps go back to zero and **rewards claimed** goes up by one.

## What Loopy adds on top (and how)

| Feature | How it works technically |
|---|---|
| **Apple Wallet card** | A signed `.pkpass` file (a zip containing `pass.json`, images and a signature). Needs an Apple Developer account ($99/year) and a *Pass Type ID* certificate. When stamps change, the server sends a push via APNs and the phone downloads the updated pass. |
| **Google Wallet card** | Google Wallet API: create one `LoyaltyClass` per card design and one `LoyaltyObject` per customer. The "Add to Google Wallet" button is a signed JWT link. Updating the object updates the phone. Needs a Google Cloud project and a Wallet issuer account (free). |
| **Push messages** | Changing a text field on the pass triggers a lock-screen notification (Apple) or sending a message to the object (Google). |
| **Location reminders** | Up to 10 locations can be written into the pass; the phone shows it on the lock screen near the shop. |
| **Staff logins** | Each staff member has their own login to the stamper app, so stamps can be traced to a person. Plans limit how many. |
| **Multiple locations and cards** | A business has many locations and many card designs. Plans limit how many. |
| **Data export** | CSV download of the customer list. |

## What Timbro does differently

Loopy and similar tools hand the business a tool and leave it there. Timbro adds the help a small café actually needs:

| Help | Where |
|---|---|
| Starter templates by type of business (café, bakery, aperitivo, gelato, pizzeria, hair, beauty) | Website builder, dashboard "La carta" |
| A counter poster generated from the card, A5/A4, Italian with English lines | Dashboard "Stampa", `app/poster.html` |
| An Instagram post image (4:5) generated from the card | Dashboard "Promuovi" |
| Ready-made texts: Instagram caption, story, WhatsApp to regulars, what staff say at the till, reminder, Google post | Dashboard "Promuovi" |
| A 7-day launch plan with a checklist | Dashboard "Promuovi" |
| Card text in a second language for tourists | Dashboard "La carta" |
| Printed kit and design done for you (Plus plan) | A service you deliver, not software |

## What this repo does today

A working prototype, with no server:

- Bilingual website (IT/EN) with a live builder: type a café's name and see its card, poster and Instagram post.
- Dashboard: design cards, print the poster, download the QR and Instagram post, copy ready-made texts, launch checklist, customers and stats.
- Customer card page: join with a first name, card with QR and short code, live updates, English for tourists.
- Stamper: camera QR scanning (built-in `BarcodeDetector` where available, `jsQR` otherwise) or typed code, add and remove stamps, give reward.
- Sales material: brochure generator (personalised per café), outreach kit, print-ready PDFs, and a full example for The Coffee.

**Limitation:** data is stored in the browser (`localStorage`). The screens only share data **on the same device and browser**. Every fresh browser starts with The Coffee's example card, so the QR codes on printed material open a working card on any phone.

All data access goes through `assets/js/store.js`, so moving to a real server means rewriting that one file.

## Roadmap to launch

1. **Backend and database.** Suggested: Supabase (Postgres + auth + hosting for functions), or Node.js on a small server. Tables:
   - `businesses` (id, owner, plan)
   - `locations` (id, business_id, name, address, lat, lng)
   - `cards` (id, business_id, title, reward, stamps_needed, color, icon)
   - `customers` (id, card_id, code, name, stamps, redeemed, joined_at, last_visit)
   - `events` (id, customer_id, staff_id, location_id, type, n, created_at)
   - `staff` (id, business_id, name, login)
2. **Accounts.** Owner sign-up and login; staff logins created by the owner.
3. **Swap `store.js`** for API calls (same function names).
4. **Wallet passes.** Done in `wallet/`: signed `.pkpass` (Apple) and JWT save links (Google). Needs your Apple Developer account and Google Wallet issuer ID; see `wallet/README.md`.
5. **Live updates in Wallet.** Apple PassKit web service endpoints + APNs push after each stamp; Google: PATCH the loyalty object after each stamp.
6. **Payments.** Stripe Billing with the three plans and a 30-day trial; enforce plan limits (locations, cards, staff).
7. **Legal.** Privacy policy and GDPR basics (you store customer names and visit history).

## Security notes for the real version

- Customer codes must be random and long enough to not be guessable (the prototype uses 6 characters from a 32-letter alphabet, about 1 billion combinations; add rate limiting on lookups).
- Only logged-in staff of the business that owns the card can add stamps.
- Log every stamp with staff and time, so owners can spot abuse.
