# Witkowski Loyalty

Digital stamp cards for cafés, salons and shops. Customers scan a QR code to get a card on their phone; staff stamp it with their phone's camera.

## Pages

| Page | For | File |
|---|---|---|
| Landing page with pricing | Businesses deciding to sign up | `index.html` |
| Dashboard | Business owner: design cards, get the QR code, see customers | `app/dashboard.html` |
| Customer card | Customers: join and show their card at the till | `app/card.html?card=<id>` |
| Stamper | Staff: scan, stamp, give rewards | `app/stamper.html` |

## Run it

No build step. Serve the folder with any static server, for example:

```
npx http-server -p 8080
```

Then open http://localhost:8080. The camera in the stamper needs `localhost` or HTTPS.

**Try the whole flow:** Dashboard → Share → "Open as a customer" → join → Stamper → type the 6-letter code → Add stamp.

## Status

This is a working prototype. Data is saved in the browser only, so all screens must be used in the same browser. See [docs/HOW-IT-WORKS.md](docs/HOW-IT-WORKS.md) for how the service works and the roadmap to launch (server, Apple/Google Wallet, payments).

## Editing

- Prices and plan limits: the `plans` list at the bottom of `index.html`.
- Colours and fonts: the variables at the top of `assets/css/base.css`.
- Card icons and colours offered to businesses: `ICONS` and `COLORS` in `app/dashboard.html`.

Third-party code in `assets/vendor/`: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT) and [jsQR](https://github.com/cozmo/jsQR) (Apache-2.0).
