/*
 * Data layer for the loyalty service.
 *
 * This prototype keeps everything in the browser (localStorage), so the
 * dashboard, customer card and stamper only share data on the same device.
 * Every screen talks to this object only, so swapping it for API calls to a
 * real server (see docs/HOW-IT-WORKS.md) does not touch the UI code.
 */
(function () {
  const KEY = 'timbro:v1';
  let memory = null; // fallback when localStorage is blocked

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const db = JSON.parse(raw);
        // Browsers that saw the older example get The Coffee's new look.
        const tc = db.cards['the-coffee'];
        if (tc && (!tc.shape || !tc.plan)) { Object.assign(tc, COFFEE_LOOK); save(db); }
        return db;
      }
    } catch (e) { if (memory) return memory; }
    return memory || seed();
  }

  function save(db) {
    memory = db;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* memory only */ }
  }

  // The Coffee, Viale Piave 20: Japanese minimalism (white, beige, stone,
  // light wood) and the name in katakana. Stamps are red hanko seals with 珈.
  const COFFEE_LOOK = { plan: 'plus', style: 'giappone', color: '#FFFFFF', ink: '#B5442E', shape: 'hanko', mark: 'text', markText: '珈',
    empty: 'outline', font: 'wide', strip: '#EEE9E1', tagline: 'ザ・コーヒー' };

  // Every fresh browser starts with the example card for The Coffee, so a
  // QR code on the brochure opens a working card on any phone.
  function seed() {
    const db = { cards: {}, customers: {} };
    db.cards['the-coffee'] = {
      id: 'the-coffee',
      business: 'The Coffee',
      city: 'Milano',
      type: 'caffe',
      title: 'Carta caffè',
      reward: 'un caffè gratis',
      titleEn: 'Coffee card',
      rewardEn: 'a free coffee',
      stampsNeeded: 10,
      icon: 'cup',
      ...COFFEE_LOOK,
      createdAt: Date.now()
    };
    save(db);
    return db;
  }

  // Everything about how a card looks (as opposed to its text and rules).
  const DESIGN_KEYS = ['style', 'color', 'ink', 'shape', 'mark', 'markText', 'empty', 'font', 'strip', 'tagline', 'icon', 'logo', 'stampImage', 'stripImage'];

  // Short, unambiguous codes staff can read out or type (no 0/O, 1/I).
  function code(len) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    const buf = new Uint32Array(len);
    crypto.getRandomValues(buf);
    for (let i = 0; i < len; i++) s += chars[buf[i] % chars.length];
    return s;
  }

  const Store = {
    // ---- cards (what the business designs) ----
    listCards() { return Object.values(load().cards).sort((a, b) => a.createdAt - b.createdAt); },
    getCard(id) { return load().cards[id] || null; },
    saveCard(card) {
      const db = load();
      if (!card.id) { card.id = code(6).toLowerCase(); card.createdAt = Date.now(); }
      card.updatedAt = Date.now();
      db.cards[card.id] = { ...db.cards[card.id], ...card };
      save(db);
      return db.cards[card.id];
    },

    // ---- customers (one per person per card) ----
    join(cardId, name) {
      const db = load();
      if (!db.cards[cardId]) throw new Error('This card no longer exists.');
      let id;
      do { id = code(6); } while (db.customers[id]);
      db.customers[id] = {
        id, cardId, name: (name || '').trim() || 'Guest',
        stamps: 0, redeemed: 0, joinedAt: Date.now(), lastVisit: null,
        history: [{ t: Date.now(), type: 'joined' }]
      };
      save(db);
      return db.customers[id];
    },
    getCustomer(id) { return load().customers[(id || '').trim().toUpperCase()] || null; },
    listCustomers(cardId) {
      return Object.values(load().customers)
        .filter(c => !cardId || c.cardId === cardId)
        .sort((a, b) => (b.lastVisit || b.joinedAt) - (a.lastVisit || a.joinedAt));
    },

    // Add (or with a negative number, remove) stamps. Never goes past the goal.
    stamp(customerId, delta = 1) {
      const db = load();
      const c = db.customers[customerId];
      if (!c) throw new Error('No customer with that code.');
      const card = db.cards[c.cardId];
      const next = Math.max(0, Math.min(card.stampsNeeded, c.stamps + delta));
      if (next === c.stamps) return c;
      c.stamps = next;
      c.lastVisit = Date.now();
      c.history.push({ t: Date.now(), type: delta > 0 ? 'stamp' : 'unstamp', n: Math.abs(delta) });
      save(db);
      return c;
    },

    // Hand over the reward: card starts again from zero.
    redeem(customerId) {
      const db = load();
      const c = db.customers[customerId];
      const card = c && db.cards[c.cardId];
      if (!c || c.stamps < card.stampsNeeded) throw new Error('This card is not full yet.');
      c.stamps = 0;
      c.redeemed += 1;
      c.lastVisit = Date.now();
      c.history.push({ t: Date.now(), type: 'redeem' });
      save(db);
      return c;
    },

    // Plus/Pro: the café asks Witkowski Design for a change in words.
    requestDesign(cardId, note) {
      const db = load(); const card = db.cards[cardId];
      card.review = { status: 'pending', kind: 'request', design: {}, note: (note || '').trim(), sentAt: Date.now(), reply: '' };
      save(db); return card;
    },

    // ---- design review ----
    // Café owners propose design changes; Witkowski Design approves them in
    // the Studio. Customers keep seeing the live design until then.
    DESIGN_KEYS,
    designOf(card) { const d = {}; DESIGN_KEYS.forEach(k => { if (card[k] !== undefined) d[k] = card[k]; }); return d; },
    proposeDesign(cardId, design, note) {
      const db = load(); const card = db.cards[cardId];
      if (!card) throw new Error('No card');
      card.review = { status: 'pending', design, note: (note || '').trim(), sentAt: Date.now(), reply: '' };
      save(db); return card;
    },
    approveDesign(cardId, design) {
      const db = load(); const card = db.cards[cardId];
      const d = design || (card.review && card.review.design) || {};
      DESIGN_KEYS.forEach(k => { if (d[k] !== undefined) card[k] = d[k]; });
      card.review = { status: 'approved', at: Date.now(), reply: '' };
      card.updatedAt = Date.now();
      save(db); return card;
    },
    askChanges(cardId, reply) {
      const db = load(); const card = db.cards[cardId];
      if (!card.review) return card;
      card.review.status = 'changes'; card.review.reply = (reply || '').trim(); card.review.at = Date.now();
      save(db); return card;
    },
    listPending() { return Object.values(load().cards).filter(c => c.review && c.review.status === 'pending').sort((a, b) => a.review.sentAt - b.review.sentAt); },

    stats(cardId) {
      const list = this.listCustomers(cardId);
      const weekAgo = Date.now() - 7 * 864e5;
      let stamps = 0, redeemed = 0, active = 0;
      list.forEach(c => {
        c.history.forEach(h => { if (h.type === 'stamp') stamps += h.n; if (h.type === 'unstamp') stamps -= h.n; });
        redeemed += c.redeemed;
        if ((c.lastVisit || 0) > weekAgo) active++;
      });
      return { members: list.length, stamps, redeemed, active };
    },

    // Re-render when another tab (e.g. the stamper) changes data.
    onChange(fn) { window.addEventListener('storage', e => { if (e.key === KEY) fn(); }); },

    reset() { try { localStorage.removeItem(KEY); } catch (e) {} memory = null; }
  };

  window.Store = Store;
})();
