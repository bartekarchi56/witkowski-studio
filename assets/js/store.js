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
      if (raw) return JSON.parse(raw);
    } catch (e) { if (memory) return memory; }
    return memory || seed();
  }

  function save(db) {
    memory = db;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* memory only */ }
  }

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
      color: '#FFFFFF',
      ink: '#2B32FF',
      icon: 'cup',
      createdAt: Date.now()
    };
    save(db);
    return db;
  }

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
