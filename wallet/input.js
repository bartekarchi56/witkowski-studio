// Checks and tidies the card + customer sent by the customer's card page.
//
// PROTOTYPE NOTE: the website keeps data in the browser, so the page sends the
// card to us. Once there is a database, look the card and customer up by ID
// here instead of trusting what the browser sends.
const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

export function readPassRequest(raw) {
  const { card = {}, customer = {}, lang } = raw || {};
  const c = {
    id: str(card.id, 40).toLowerCase(),
    business: str(card.business, 40),
    title: str(card.title, 40), titleEn: str(card.titleEn, 40),
    reward: str(card.reward, 60), rewardEn: str(card.rewardEn, 60),
    stampsNeeded: Math.max(1, Math.min(20, parseInt(card.stampsNeeded, 10) || 10)),
    color: str(card.color, 7), ink: str(card.ink, 7), icon: str(card.icon, 12),
    logo: typeof card.logo === 'string' && card.logo.length < 800000 ? card.logo : ''
  };
  const m = {
    id: str(customer.id, 6).toUpperCase(),
    name: str(customer.name, 30) || 'Guest',
    stamps: Math.max(0, parseInt(customer.stamps, 10) || 0)
  };
  if (!/^[a-z0-9-]{1,40}$/.test(c.id)) throw new Error('Invalid card id');
  if (!/^[A-Z0-9]{6}$/.test(m.id)) throw new Error('Invalid customer code');
  if (!c.business || !c.title) throw new Error('Missing card name');
  m.stamps = Math.min(m.stamps, c.stampsNeeded);
  return { card: c, customer: m, lang: lang === 'en' ? 'en' : 'it' };
}

export const LABELS = {
  it: { stamps: 'TIMBRI', reward: 'PREMIO', member: 'CLIENTE', how: 'Come funziona', howText: n => `Mostra il codice alla cassa a ogni visita: ricevi un timbro. Dopo ${n} timbri ricevi il premio.`, by: 'Carta fedeltà con', change: 'Timbri: %@', points: 'Timbri' },
  en: { stamps: 'STAMPS', reward: 'REWARD', member: 'MEMBER', how: 'How it works', howText: n => `Show the code at the till every visit to get a stamp. After ${n} stamps you get the reward.`, by: 'Loyalty card by', change: 'Stamps: %@', points: 'Stamps' }
};
