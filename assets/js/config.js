/*
 * Everything you are likely to change lives here: name, contact details,
 * prices and the starter templates. The website, dashboard, brochure and
 * outreach kit all read from this file.
 */
window.CONFIG = {
  brand: 'Timbro',

  // Where the site is published. Printed QR codes point here, so set it
  // before printing anything (e.g. https://timbro.it/).
  siteUrl: 'https://bartekarchi56.github.io/witkowski-studio/',

  // Address of the wallet server (wallet/server.js) once it is deployed,
  // e.g. 'https://wallet.timbro.it'. Empty = "Add to Wallet" stays switched off.
  walletApi: '',

  contact: {
    name: 'Bartek Witkowski',
    phone: '',            // e.g. '+39 333 123 4567' (also used for WhatsApp)
    email: '',            // e.g. 'ciao@timbro.it'
    city: 'Milano'
  },

  currency: '€',
  trialDays: 30,
  yearlyMonths: 10,       // pay 10 months, get 12

  plans: [
    { id: 'start', month: 19, locations: 1, cards: 1, staff: 3,
      it: { name: 'Start', for: 'Un bar, una sede', extras: ['Poster e QR da stampare', 'Piano di lancio di 7 giorni', 'Post Instagram pronti'] },
      en: { name: 'Start', for: 'One café, one location', extras: ['Printable poster and QR code', '7-day launch plan', 'Ready-made Instagram posts'] } },
    { id: 'plus', month: 35, locations: 3, cards: 3, staff: 10, popular: true,
      it: { name: 'Plus', for: 'Vuoi che ci pensiamo noi', extras: ['Tutto di Start', 'Disegniamo noi la tua carta', 'Kit stampato a casa tua', 'Nuovi post e messaggi ogni mese'] },
      en: { name: 'Plus', for: 'You want us to handle it', extras: ['Everything in Start', 'We design your card for you', 'Printed kit sent to you', 'New posts and messages every month'] } },
    { id: 'pro', month: 69, locations: 10, cards: 10, staff: 50,
      it: { name: 'Pro', for: 'Più sedi o una catena', extras: ['Tutto di Plus', 'Statistiche per sede', 'Esporta i clienti in Excel', 'Assistenza prioritaria su WhatsApp'] },
      en: { name: 'Pro', for: 'Several locations or a chain', extras: ['Everything in Plus', 'Stats per location', 'Export customers to Excel', 'Priority WhatsApp support'] } }
  ],

  // Starter templates by type of business. Picking one fills in a sensible card.
  templates: [
    { id: 'caffe', icon: 'cup', stamps: 10, color: '#FFFFFF',
      it: { type: 'Caffè e bar', title: 'Carta caffè', reward: 'un caffè gratis' },
      en: { type: 'Café', title: 'Coffee card', reward: 'a free coffee' } },
    { id: 'pasticceria', icon: 'cake', stamps: 8, color: '#FFFFFF',
      it: { type: 'Pasticceria', title: 'Carta dolce', reward: 'una brioche gratis' },
      en: { type: 'Bakery', title: 'Pastry card', reward: 'a free pastry' } },
    { id: 'aperitivo', icon: 'glass', stamps: 8, color: '#0B0B0C',
      it: { type: 'Aperitivo', title: 'Carta aperitivo', reward: 'uno spritz gratis' },
      en: { type: 'Cocktail bar', title: 'Aperitivo card', reward: 'a free spritz' } },
    { id: 'gelateria', icon: 'cone', stamps: 8, color: '#FFFFFF',
      it: { type: 'Gelateria', title: 'Carta gelato', reward: 'una coppetta gratis' },
      en: { type: 'Gelato shop', title: 'Gelato card', reward: 'a free gelato' } },
    { id: 'pizzeria', icon: 'pizza', stamps: 10, color: '#0B0B0C',
      it: { type: 'Pizzeria', title: 'Carta pizza', reward: 'una margherita gratis' },
      en: { type: 'Pizzeria', title: 'Pizza card', reward: 'a free margherita' } },
    { id: 'parrucchiere', icon: 'scissors', stamps: 6, color: '#0B0B0C',
      it: { type: 'Parrucchiere', title: 'Carta taglio', reward: 'una piega gratis' },
      en: { type: 'Hair salon', title: 'Haircut card', reward: 'a free blow-dry' } },
    { id: 'estetica', icon: 'leaf', stamps: 6, color: '#FFFFFF',
      it: { type: 'Centro estetico', title: 'Carta bellezza', reward: 'un trattamento viso gratis' },
      en: { type: 'Beauty salon', title: 'Beauty card', reward: 'a free facial' } }
  ]
};
