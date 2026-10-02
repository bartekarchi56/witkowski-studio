# Notes for Claude

- The owner's company is **Witkowski Design** (short name / handle: `witkowskidesign`). Never call it "Witkowski Studio" or "witkowski-studio", even though the repository was first created under that name.
- The loyalty-card service built here is called **Timbro** (working name). Brand settings live in `assets/js/config.js`.
- The website is published at `https://timbro.witkowskidesign.com/` (GitHub Pages custom domain, `CNAME` file; the domain is on Cloudflare). Printed QR codes use `siteUrl` in `assets/js/config.js`; regenerate the PDFs in `print/` with `node print/make-pdfs.js` whenever it changes.
- Emails (sign-up, password reset) go through Resend SMTP from `noreply@witkowskidesign.com`, set in Supabase.
- No em dashes in user-facing copy.
