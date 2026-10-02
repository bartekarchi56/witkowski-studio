/*
 * Data layer for the loyalty service.
 *
 * Two modes:
 *  • Demo (default): everything lives in this browser (localStorage).
 *  • Connected: the dashboard and Studio call Store.attachRemote() with data
 *    from Supabase (remote.js). Reads come from that copy; every change is
 *    also sent to the database. Errors fire a 'storeerror' event.
 * The customer card and the stamper talk to Remote directly.
 */
(function () {
  const KEY = 'timbro:v1';
  let memory = null;   // fallback when localStorage is blocked
  let remoteDb = null; // connected mode: the data loaded from Supabase

  function load() {
    if (remoteDb) return remoteDb;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const db = JSON.parse(raw);
        // Browsers that saw the older example get The Coffee's new look.
        const tc = db.cards['the-coffee'];
        if (tc && (!tc.shape || !tc.plan)) { Object.assign(tc, COFFEE_LOOK); save(db); }
        // Browsers from before the Orsonero proposal get its example card too.
        if (!db.cards.orsonero || db.cards.orsonero.stampImage !== ORSONERO_BEAR) { db.cards.orsonero = { ...db.cards.orsonero, ...ORSONERO }; save(db); }
        return db;
      }
    } catch (e) { if (memory) return memory; }
    return memory || seed();
  }

  function save(db) {
    if (remoteDb) { remoteDb = db; return; }
    memory = db;
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* memory only */ }
  }

  // The Coffee, Viale Piave 20: Japanese minimalism (white, beige, stone,
  // light wood) and the name in katakana. Stamps are red hanko seals with 珈.
  const COFFEE_LOOK = { plan: 'plus', style: 'giappone', color: '#FFFFFF', ink: '#B5442E', shape: 'hanko', mark: 'text', markText: '珈',
    empty: 'outline', font: 'wide', strip: '#EEE9E1', tagline: 'ザ・コーヒー' };

  // Orsonero Coffee, Via Broggi 15 (proposal): the black bear of the name
  // (Brent's Canada), light oak and white walls, Nordic-Japanese calm.
  // The bear stamp is our own drawing, not Orsonero's logo.
  const ORSONERO_BEAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48ZyBmaWxsPSIjMUExQTFBIj48Y2lyY2xlIGN4PSIyNCIgY3k9IjI3IiByPSIxNCIvPjxjaXJjbGUgY3g9Ijc2IiBjeT0iMjciIHI9IjE0Ii8+PGVsbGlwc2UgY3g9IjUwIiBjeT0iNTYiIHJ4PSIzNyIgcnk9IjMzIi8+PC9nPjxnIGZpbGw9IiNFQURGQ0IiPjxjaXJjbGUgY3g9IjI0IiBjeT0iMjciIHI9IjUuNSIvPjxjaXJjbGUgY3g9Ijc2IiBjeT0iMjciIHI9IjUuNSIvPjxlbGxpcHNlIGN4PSI1MCIgY3k9IjY5IiByeD0iMTUiIHJ5PSIxMSIvPjwvZz48ZWxsaXBzZSBjeD0iNTAiIGN5PSI2NCIgcng9IjUuNSIgcnk9IjMuOCIgZmlsbD0iIzFBMUExQSIvPjwvc3ZnPg==';
  const ORSONERO = {
    id: 'orsonero', business: 'Orsonero Coffee', city: 'Milano', type: 'caffe',
    title: 'Carta Orsonero', reward: 'un caffè a scelta', titleEn: 'Orsonero card', rewardEn: 'any coffee, on us',
    stampsNeeded: 8, icon: 'cup', plan: 'plus', style: 'minimal',
    color: '#FFFFFF', ink: '#1A1A1A', shape: 'dot', mark: 'none', empty: 'outline', font: 'sans',
    strip: '#EADFCB', tagline: 'Specialty coffee', stampImage: ORSONERO_BEAR
  };

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
    db.cards.orsonero = { ...ORSONERO, createdAt: Date.now() };
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

  // Connected mode: send a change to the database in the background.
  function sync(call) {
    if (!remoteDb) return;
    call().then(r => {
      if (r && r.id && remoteDb.cards[r.id]) Object.assign(remoteDb.cards[r.id], r);
    }).catch(err => document.dispatchEvent(new CustomEvent('storeerror', { detail: err.message })));
  }
  const byId = list => Object.fromEntries((list || []).map(x => [x.id, x]));

  const Store = {
    get remote() { return Boolean(remoteDb); },
    attachRemote(data) { remoteDb = { cards: byId(data.cards), customers: byId(data.customers) }; },
    // New data from the database (e.g. a timed refresh): screens redraw.
    refresh(data) { if (!remoteDb) return; this.attachRemote(data); document.dispatchEvent(new CustomEvent('storechange')); },

    // ---- cards (what the business designs) ----
    listCards() { return Object.values(load().cards).sort((a, b) => a.createdAt - b.createdAt); },
    getCard(id) { return load().cards[id] || null; },
    saveCard(card) {
      const db = load();
      if (!card.id) { card.id = code(6).toLowerCase(); card.createdAt = Date.now(); }
      card.updatedAt = Date.now();
      const isNew = !db.cards[card.id];
      db.cards[card.id] = { ...db.cards[card.id], ...card };
      save(db);
      const saved = db.cards[card.id];
      sync(() => Remote.saveCard({ ...saved, design: isNew ? this.designOf(saved) : undefined }));
      return saved;
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
    requestDesign(cardId, note, extras = {}) {
      const db = load(); const card = db.cards[cardId];
      card.review = { status: 'pending', kind: 'request', design: {}, note: (note || '').trim(), images: extras.images || [], links: extras.links || [], sentAt: Date.now(), reply: '' };
      save(db);
      sync(() => Remote.sendDesign(cardId, 'request', {}, card.review.note, card.review.images, card.review.links));
      return card;
    },

    // ---- design review ----
    // Café owners propose design changes; Witkowski Design approves them in
    // the Studio. Customers keep seeing the live design until then.
    DESIGN_KEYS,
    designOf(card) { const d = {}; DESIGN_KEYS.forEach(k => { if (card[k] !== undefined) d[k] = card[k]; }); return d; },
    // extras: { images: [data URLs], links: [urls] } – photos and inspiration for the designer.
    proposeDesign(cardId, design, note, extras = {}) {
      const db = load(); const card = db.cards[cardId];
      if (!card) throw new Error('No card');
      card.review = { status: 'pending', kind: 'proposal', design, note: (note || '').trim(), images: extras.images || [], links: extras.links || [], sentAt: Date.now(), reply: '' };
      save(db);
      sync(() => Remote.sendDesign(cardId, 'proposal', design, card.review.note, card.review.images, card.review.links));
      return card;
    },
    approveDesign(cardId, design) {
      const db = load(); const card = db.cards[cardId];
      const d = design || (card.review && card.review.design) || {};
      DESIGN_KEYS.forEach(k => { if (d[k] !== undefined) card[k] = d[k]; });
      card.review = { status: 'approved', at: Date.now(), reply: '' };
      card.updatedAt = Date.now();
      save(db);
      sync(() => Remote.publish(cardId, d));
      return card;
    },
    askChanges(cardId, reply) {
      const db = load(); const card = db.cards[cardId];
      card.review = { ...(card.review || {}), status: 'changes', reply: (reply || '').trim(), at: Date.now() };
      save(db);
      sync(() => Remote.askChanges(cardId, card.review.reply));
      return card;
    },
    // The plan comes from the subscription; in connected mode only the designer can set it.
    setPlan(cardId, plan) {
      const db = load(); db.cards[cardId].plan = plan; save(db);
      sync(() => Remote.setPlan(cardId, plan));
      return db.cards[cardId];
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
    onChange(fn) {
      window.addEventListener('storage', e => { if (e.key === KEY && !remoteDb) fn(); });
      document.addEventListener('storechange', fn);
    },

    reset() { try { localStorage.removeItem(KEY); } catch (e) {} memory = null; }
  };

  window.Store = Store;
})();
