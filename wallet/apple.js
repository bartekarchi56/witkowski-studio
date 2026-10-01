// Apple Wallet: builds a signed .pkpass ("store card" style).
import { PKPass } from 'passkit-generator';
import { settings } from './settings.js';
import { colours, rgb, strip, icon, logo } from './images.js';
import { LABELS } from './input.js';

export async function buildApplePass({ card, customer, lang }) {
  const L = LABELS[lang];
  const { bg, fg } = colours(card);
  const en = lang === 'en';
  const title = (en && card.titleEn) || card.title;
  const reward = (en && card.rewardEn) || card.reward;

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: settings.apple.passTypeIdentifier,
    teamIdentifier: settings.apple.teamIdentifier,
    serialNumber: `${card.id}-${customer.id}`,
    organizationName: card.business,
    description: `${title} · ${card.business}`,
    backgroundColor: rgb(bg),
    foregroundColor: rgb(fg),
    labelColor: rgb(fg),
    storeCard: {
      headerFields: [{ key: 'stamps', label: L.stamps, value: `${customer.stamps}/${card.stampsNeeded}`, changeMessage: L.change }],
      secondaryFields: [
        { key: 'reward', label: L.reward, value: reward },
        { key: 'member', label: L.member, value: customer.name, textAlignment: 'PKTextAlignmentRight' }
      ],
      backFields: [
        { key: 'how', label: L.how, value: L.howText(card.stampsNeeded) },
        { key: 'code', label: 'Code', value: customer.id },
        { key: 'by', label: L.by, value: settings.brand }
      ]
    },
    barcodes: [{ format: 'PKBarcodeFormatQR', message: customer.id, messageEncoding: 'iso-8859-1', altText: customer.id }]
  };

  // With an uploaded logo Apple shows the image; without one, the name as text.
  const logo2x = await logo(card, 2);
  if (!logo2x) passJson.logoText = card.business;

  const files = {
    'pass.json': Buffer.from(JSON.stringify(passJson)),
    'icon.png': await icon(card, 29), 'icon@2x.png': await icon(card, 58), 'icon@3x.png': await icon(card, 87),
    'strip.png': await strip(card, customer.stamps, { scale: 1 }),
    'strip@2x.png': await strip(card, customer.stamps, { scale: 2 }),
    'strip@3x.png': await strip(card, customer.stamps, { scale: 3 })
  };
  if (logo2x) Object.assign(files, { 'logo.png': await logo(card, 1), 'logo@2x.png': logo2x, 'logo@3x.png': await logo(card, 3) });

  const { signerCert, signerKey, signerKeyPassphrase, wwdr } = settings.apple;
  const pass = new PKPass(files, { signerCert, signerKey, signerKeyPassphrase, wwdr });
  return pass.getAsBuffer();
}
