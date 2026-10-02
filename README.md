# Timbro

A service by **Witkowski Design**.

Digital stamp cards for cafés, bakeries and shops, with help on the design and marketing. Customers scan a QR code and save the card in Apple Wallet or Google Wallet, and staff stamp it with their phone's camera. Everything is in Italian and English.

*Timbro* is a working name (Italian for "stamp"). To rename it, change `brand` in `assets/js/config.js` and the word "Timbro" in the HTML files.

## What's here

| Page | For | File |
|---|---|---|
| Website with live builder and pricing | Café owners deciding to sign up | `index.html` |
| Dashboard: card texts, design changes (sent for your approval), print, promote, customers | The café owner | `app/dashboard.html` |
| **Studio**: design each card, review and approve cafés' changes | You (Witkowski Design) | `studio/` |
| Customer card | Customers, on their phone | `app/card.html?card=<id>` |
| Stamper | Staff at the till | `app/stamper.html` |
| Printable counter poster (A5/A4) | The café | `app/poster.html?card=<id>` |
| **Example product for The Coffee, Milan** | Showing the owner | `examples/the-coffee/` |
| **Brochure generator** (personalised per café) | You, before a visit | `sales/brochure.html` |
| **Sales kit**: in-person script, emails in IT/EN/ES/FR/DE, schedule | You | `sales/outreach.html` |
| **Ready-to-print PDFs** | Print shop or home printer | `print/` |
| **Wallet server**: real Apple Wallet `.pkpass` and Google Wallet passes | Deployed once, used by every card | `wallet/` ([setup](wallet/README.md)) |

### Print files (`print/`)

- `brochure-the-coffee-it.pdf`, `brochure-the-coffee-en.pdf`: A5, 4 pages, personalised for The Coffee. For a print shop: "pieghevole A4 → A5, carta 170 g opaca".
- `brochure-the-coffee-it-a4-da-piegare.pdf`: the same on 2 A4 sheets for a home printer. Print double-sided, "flip on short edge", then fold.
- `brochure-generale-it.pdf`, `brochure-general-en.pdf`: no café name, for leaving anywhere.
- `poster-the-coffee-a5.pdf`: the counter poster for The Coffee.

To make a brochure for another café, open `sales/brochure.html`, type the café's name and your phone/email, then press "Stampa / Salva PDF".

## Before printing or sending anything

1. **Put the site online.** Rename the GitHub repository to `witkowskidesign` (Settings → General → Repository name), then turn on GitHub Pages (Settings → Pages → Deploy from a branch → `claude/loopy-loyalty-pricing-redesign-yg54mp`, folder `/ (root)`). The site appears at https://bartekarchi56.github.io/witkowskidesign/, which is what `siteUrl` in `assets/js/config.js` and every printed QR code already point to.
2. **Fill in `contact`** (phone, email) in `assets/js/config.js`, or type them into the brochure page before printing.
3. **Check the prices and plans** in `config.js`: €19 / €35 / €69 a month, 30 days free, yearly = 10 months. These are placeholders.
4. Regenerate the PDFs after any change (open the brochure page and save as PDF).

## Run it locally

No build step:

```
npx http-server -p 8080
```

Open http://localhost:8080. The stamper camera needs `localhost` or HTTPS.

**Try the whole flow:** website → type a café name → "Crea questa carta" → Stampa → "Apri la carta come un cliente" → join → Stamper → type the 6-letter code → Aggiungi un timbro.

## How design works

Every card is designed by Witkowski Design in the **Studio** (`studio/`): styles, fonts, stamp shape and mark, colours, and your own stamp artwork and background images.

Café owners can change their logo, colours, background and stamp from the dashboard, with a message for you. Those changes are a **proposal**: customers keep seeing the current design until you open the Studio and press "Approva e pubblica", or send it back with "Chiedi una modifica". Text changes (name, reward, number of stamps) save straight away.

In the prototype the Studio has no login and reads proposals from the same browser. With the server, it gets a login and sees every café's proposals.

## Status

Working prototype. Data is saved in the browser only, so the dashboard, customer card and stamper share data only on the same device. The cards are drawn exactly like Apple Wallet and Google Wallet passes, and `wallet/` creates the real ones; it switches on once you add your Apple and Google accounts (see `wallet/README.md`). Live stamp updates inside Wallet and reminder messages need the database. See [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md) for how the service works and the roadmap to launch (server, wallets, payments).

## Editing

- Name, contact, prices, plans, starter templates and the starting styles used in the Studio: `assets/js/config.js`
- Design controls (shared by dashboard and Studio): `assets/js/design-editor.js`
- Colours and fonts: top of `assets/css/base.css` (one colour only: `--pop`, the ink blue)
- Ready-made posts, messages and the launch plan: `assets/js/marketing.js`
- Sales emails and the in-person script: `sales/outreach.html`

Fonts (Archivo, Spline Sans Mono) are self-hosted under the SIL Open Font License. Third-party code in `assets/vendor/`: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT) and [jsQR](https://github.com/cozmo/jsQR) (Apache-2.0).
