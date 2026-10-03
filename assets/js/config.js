/*
 * Everything you are likely to change lives here: name, contact details,
 * prices and the starter templates. The website, dashboard, brochure and
 * outreach kit all read from this file.
 */
window.CONFIG = {
  brand: 'Timbro',

  // Where the site is published. Printed QR codes point here, so set it
  // before printing anything (e.g. https://timbro.it/).
  siteUrl: 'https://timbro.witkowskidesign.com/',

  // Your Supabase project (Settings → API). Leave empty to run the
  // browser-only demo, where data stays on one device.
  // Example cards that always run as a browser demo (printed brochures point to them).
  demoCards: ['the-coffee', 'orsonero'],

  supabase: {
    url: 'https://xchpnvadjxonhnknywis.supabase.co',
    anonKey: 'sb_publishable_7zczBoBp11UwHVLlIz8XuA_XnrAigOn'  // publishable/anon key (safe to publish: the database checks every call)
  },

  // Address of the wallet server (wallet/server.js) once it is deployed,
  // e.g. 'https://wallet.timbro.it'. Empty = "Add to Wallet" stays switched off.
  walletApi: '',

  contact: {
    name: 'Bartek Witkowski',
    phone: '+48 530 340 988',  // also used for WhatsApp
    email: '',            // e.g. 'ciao@timbro.it'
    city: 'Milano'
  },

  // Who provides the service, shown on the legal pages (legal/). Fill in the
  // empty fields once the business is registered; until then the pages show
  // a highlighted "to be completed".
  legal: {
    company: 'Witkowski Design',
    owner: 'Bartosz Witkowski',  // legal name (brochures use 'Bartek' from contact.name)
    address: '',          // registered address, e.g. 'ul. ..., 00-000 Warszawa, Polska'
    vat: '',              // VAT / NIP / partita IVA
    email: '',            // contact for privacy and legal requests
    country: '',          // country of registration, e.g. 'Polska' / 'Italia'; sets the applicable law
    updated: '2026-10-03' // date shown as "last updated"
  },

  currency: '€',
  trialDays: 30,
  yearlyMonths: 10,       // pay 10 months, get 12

  // design: 'self'   = the café customises logo, colours, background and stamp;
  //                    every change is approved by Witkowski Design first.
  //         'custom' = Witkowski Design designs the card; the café asks for changes.
  plans: [
    { id: 'start', design: 'self', month: 19, locations: 1, cards: 1, staff: 3,
      it: { name: 'Start', for: 'Un bar, una sede', extras: ['Personalizzi tu logo, colori, sfondo e timbro', 'Poster e QR da stampare', 'Piano di lancio di 7 giorni', 'Post Instagram pronti'] },
      en: { name: 'Start', for: 'One café, one location', extras: ['Customise logo, colours, background and stamp', 'Printable poster and QR code', '7-day launch plan', 'Ready-made Instagram posts'] } },
    { id: 'plus', design: 'custom', month: 35, locations: 3, cards: 3, staff: 10, popular: true,
      it: { name: 'Plus', for: 'Vuoi che ci pensiamo noi', extras: ['Tutto di Start', 'Carta disegnata su misura da noi', 'Kit stampato a casa tua', 'Nuovi post e messaggi ogni mese'] },
      en: { name: 'Plus', for: 'You want us to handle it', extras: ['Everything in Start', 'Card custom-designed by us', 'Printed kit sent to you', 'New posts and messages every month'] } },
    { id: 'pro', design: 'custom', month: 69, locations: 10, cards: 10, staff: 50,
      it: { name: 'Pro', for: 'Più sedi o una catena', extras: ['Tutto di Plus', 'Statistiche per sede', 'Esporta i clienti in Excel', 'Assistenza prioritaria su WhatsApp'] },
      en: { name: 'Pro', for: 'Several locations or a chain', extras: ['Everything in Plus', 'Stats per location', 'Export customers to Excel', 'Priority WhatsApp support'] } }
  ],

  // Card styles. A style sets the whole look; every part can still be changed.
  //   shape: dot | ring | square | hanko (Japanese seal)
  //   mark:  icon | text (markText, 1–2 characters) | none
  //   empty: soft (grey) | outline | dashed      font: sans | wide | serif | mono
  //   strip: background colour behind the stamps ('' = same as the card)
  styles: [
    { id: 'timbro', it: 'Timbro', en: 'Timbro',
      look: { color: '#FFFFFF', ink: '#2B32FF', shape: 'dot', mark: 'icon', empty: 'soft', font: 'sans', strip: '' } },
    { id: 'minimal', it: 'Minimal', en: 'Minimal',
      look: { color: '#FFFFFF', ink: '#0B0B0C', shape: 'dot', mark: 'none', empty: 'soft', font: 'serif', strip: '' } },
    { id: 'giappone', it: 'Giapponese', en: 'Japanese',
      look: { color: '#FFFFFF', ink: '#B5442E', shape: 'hanko', mark: 'text', markText: '珈', empty: 'outline', font: 'wide', strip: '#EEE9E1' } },
    { id: 'milano', it: 'Milano sera', en: 'Milan night',
      look: { color: '#0B0B0C', ink: '#C9A24A', shape: 'ring', mark: 'icon', empty: 'outline', font: 'wide', strip: '' } },
    { id: 'bottega', it: 'Bottega', en: 'Bottega',
      look: { color: '#F3EEE4', ink: '#4A2E21', shape: 'square', mark: 'icon', empty: 'dashed', font: 'serif', strip: '' } }
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
