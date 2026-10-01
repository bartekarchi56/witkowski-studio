# Timbro wallet server

Creates the cards customers save in **Apple Wallet** (iPhone) and **Google Wallet** (Android), drawn the same way as on the website: name or logo at the top, the stamp grid, reward, customer name and a QR code the stamper can scan.

The customer's card page (`app/card.html`) shows an "Add to Apple Wallet" or "Add to Google Wallet" button, depending on the phone. The button posts the card to this server, which answers with:

- **iPhone:** a signed `.pkpass` file. Safari opens it straight in Wallet.
- **Android:** a redirect to Google's "Save to Google Wallet" page.

## What you need (once)

### Apple Wallet
1. An **Apple Developer Program** membership (99 USD/year), as a company or individual.
2. In *Certificates, Identifiers & Profiles* → *Identifiers*, create a **Pass Type ID**, e.g. `pass.it.timbro.loyalty`.
3. Create a **Pass Type ID certificate** for it, download it, open it in Keychain Access and export it as `.p12`.
4. Convert it to PEM files:
   ```
   openssl pkcs12 -in pass.p12 -clcerts -nokeys -out signer.pem -legacy
   openssl pkcs12 -in pass.p12 -nocerts -out signer.key -legacy
   ```
5. Download Apple's **WWDR certificate (G4)** from apple.com/certificateauthority and convert it:
   `openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr.pem`
6. Note your **Team ID** (top right of the developer site).

### Google Wallet
1. Sign up at **pay.google.com/business/console** and request access to the Google Wallet API. You get an **Issuer ID**.
2. In Google Cloud, enable the **Google Wallet API**, create a **service account** and download its JSON key.
3. In the Wallet console, add the service account's email under *Users*.
4. Passes work right away for test accounts. Ask Google to approve your issuer before real customers use it.

## Settings (environment variables)

| Variable | Example |
|---|---|
| `PUBLIC_URL` | `https://wallet.timbro.it` (this server's own address) |
| `ALLOWED_ORIGINS` | `https://timbro.it` (the website; other sites are refused) |
| `APPLE_PASS_TYPE_ID` | `pass.it.timbro.loyalty` |
| `APPLE_TEAM_ID` | `AB12CD34EF` |
| `APPLE_SIGNER_CERT` / `APPLE_SIGNER_KEY` | paths to `signer.pem` / `signer.key`, or the PEM text |
| `APPLE_SIGNER_KEY_PASSPHRASE` | if the key has one |
| `APPLE_WWDR_CERT` | path to `wwdr.pem`, or the PEM text |
| `GOOGLE_ISSUER_ID` | `3388000000012345678` |
| `GOOGLE_SERVICE_ACCOUNT` | path to the JSON key, or the JSON text |

Never commit certificates or keys. `.gitignore` already excludes `*.pem`, `*.p12` and `service-account*.json`.

## Run and deploy

```
cd wallet
npm install
npm test          # builds a test pass with throwaway certificates
npm start         # http://localhost:8787, check /health
```

It is a plain Node 18+ server (no framework), so any Node host works: Render, Railway, Fly.io or a small VPS. When it's online, set `walletApi` in `assets/js/config.js` to its address. The buttons on the card page switch on by themselves.

## What's not done yet (needs the database)

- **Live updates.** A saved pass shows the stamps it had when it was added. To update it on every stamp:
  - Apple: add `webServiceURL` + `authenticationToken` to the pass, implement Apple's PassKit web service endpoints (register device, list updated passes, send latest pass) and send an APNs push with the pass certificate after each stamp.
  - Google: after each stamp, `PATCH` the loyalty object through the Google Wallet REST API.
- **Trusting the browser.** Right now the card page sends the card's details, because the prototype keeps data in the browser. With a database, look up the card and customer by ID in `input.js` instead. Until then, keep `ALLOWED_ORIGINS` set.
- **Uploaded logos on Google Wallet.** Google needs the logo at a public URL, so it uses the card's icon for now. Apple uses the uploaded logo.
- **Official buttons.** Apple and Google publish official "Add to Wallet" badge artwork with usage rules. Swap them in for the buttons in `app/card.html` before launch.
