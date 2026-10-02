// Settings come from environment variables (see README.md). Certificate and
// key values can be either a file path or the PEM text itself.
import fs from 'node:fs';

const fileOrText = v => (v && !v.includes('-----BEGIN') && fs.existsSync(v)) ? fs.readFileSync(v, 'utf8') : (v || '').replace(/\\n/g, '\n');

export const settings = {
  port: +(process.env.PORT || 8787),
  publicUrl: (process.env.PUBLIC_URL || 'http://localhost:8787').replace(/\/$/, ''),
  // Only pages from these sites may ask for passes (comma separated).
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  brand: process.env.BRAND || 'Timbro',
  // When set, the card and stamps are read from the database (trusted)
  // instead of from what the customer's phone sends.
  supabase: {
    url: (process.env.SUPABASE_URL || '').replace(/\/$/, ''),
    anonKey: process.env.SUPABASE_ANON_KEY || ''
  },
  apple: {
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || '',
    teamIdentifier: process.env.APPLE_TEAM_ID || '',
    signerCert: fileOrText(process.env.APPLE_SIGNER_CERT),
    signerKey: fileOrText(process.env.APPLE_SIGNER_KEY),
    signerKeyPassphrase: process.env.APPLE_SIGNER_KEY_PASSPHRASE || undefined,
    wwdr: fileOrText(process.env.APPLE_WWDR_CERT)
  },
  google: {
    issuerId: process.env.GOOGLE_ISSUER_ID || '',
    serviceAccount: (() => { try { return JSON.parse(fileOrText(process.env.GOOGLE_SERVICE_ACCOUNT)); } catch (e) { return null; } })()
  }
};

export const appleReady = () => Object.values({ ...settings.apple, signerKeyPassphrase: 'x' }).every(Boolean);
export const googleReady = () => Boolean(settings.google.issuerId && settings.google.serviceAccount?.private_key);
