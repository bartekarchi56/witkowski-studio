/*
 * Marketing kit generated from a card: counter poster, Instagram post,
 * ready-to-send messages and a 7-day launch plan.
 * Needs: config.js, i18n.js, ui.js (and qrcode.js for the poster).
 */
(function () {
  const esc = s => UI.esc(s);

  // Text for a card in a given language (falls back to the main text).
  function words(card, lang) {
    const en = lang === 'en';
    return {
      business: card.business,
      title: (en && card.titleEn) || card.title,
      reward: (en && card.rewardEn) || card.reward,
      n: card.stampsNeeded
    };
  }

  // ---------- counter poster (A5) ----------
  // Italian posters carry an English line under each sentence for tourists.
  const P = {
    it: { head: 'Raccogli {n} timbri:', steps: ['Inquadra il codice', 'Salva la carta sul telefono', 'Mostrala a ogni visita'], foot: 'Niente app. Niente carta da perdere.' },
    en: { head: 'Collect {n} stamps:', steps: ['Scan the code', 'Save the card on your phone', 'Show it every visit'], foot: 'No app. Nothing to lose.' }
  };
  function poster(card, opts = {}) {
    const lang = opts.lang === 'en' ? 'en' : 'it';
    const main = words(card, lang), en = words(card, 'en');
    const sub = lang === 'it';
    const url = opts.url || UI.publicJoinUrl(card.id);
    const need = card.stampsNeeded;
    let dots = '';
    for (let i = 0; i < need; i++) dots += `<i class="${i < 3 ? 'on' : ''}"></i>`;
    return `
      <div class="poster" lang="${lang}" style="--s:${esc(card.ink || '#2B32FF')}"><div class="poster-in">
        <div class="poster-top">
          <span class="poster-biz">${UI.icon(card.icon)}${esc(card.business)}</span>
          <span class="poster-tag">${esc(main.title)}</span>
        </div>
        <h2 class="poster-h">${esc(P[lang].head.replace('{n}', need))} <em>${esc(main.reward)}.</em></h2>
        ${sub ? `<p class="poster-en" lang="en">${esc(P.en.head.replace('{n}', need))} ${esc(en.reward)}.</p>` : ''}
        <div class="poster-dots" style="--cols:${Math.ceil(need / Math.ceil(need / 10))}">${dots}</div>
        <div class="poster-scan">
          <div class="poster-qr">${UI.qrSvg(url)}</div>
          <ol>${P[lang].steps.map((st, i) => `<li><b>${esc(st)}</b>${sub ? `<span lang="en">${esc(P.en.steps[i])}</span>` : ''}</li>`).join('')}</ol>
        </div>
        <p class="poster-foot"><span>${esc(P[lang].foot)}</span><span class="poster-brand"><i></i>${esc(CONFIG.brand)}</span></p>
      </div></div>`;
  }

  // ---------- Instagram post (1080×1350 canvas) ----------
  async function instagram(card, lang) {
    const w = words(card, lang);
    const L = MSG[lang] || MSG.en;
    try { await Promise.all([document.fonts.load('800 80px Archivo'), document.fonts.load('500 30px "Spline Sans Mono"')]); } catch (e) {}
    const W = 1080, H = 1350;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    const ink = card.ink || '#2B32FF';
    const font = (wt, px, stretch = 'normal', fam = 'Archivo') => { c.font = `${wt} ${px}px "${fam}", system-ui, sans-serif`; if ('fontStretch' in c) c.fontStretch = stretch; };

    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H);

    // business name
    c.fillStyle = '#0B0B0C';
    font(700, 34, 'normal');
    c.letterSpacing = '4px';
    c.fillText(w.business.toUpperCase(), 90, 130);
    c.letterSpacing = '0px';

    // headline, wrapped
    font(800, 96, 'expanded');
    const lines = wrap(c, L.igHeadline, W - 180);
    lines.forEach((ln, i) => c.fillText(ln, 90, 290 + i * 104));

    // card
    const top = 290 + lines.length * 104 + 40;
    const cardH = 430;
    roundRect(c, 90, top, W - 180, cardH, 36);
    c.fillStyle = '#FFFFFF'; c.fill();
    c.lineWidth = 4; c.strokeStyle = '#0B0B0C'; c.stroke();
    font(800, 52, 'semi-expanded');
    c.fillStyle = '#0B0B0C';
    c.fillText(w.title, 140, top + 95);
    font(400, 32);
    c.fillStyle = '#55555A';
    c.fillText(fit(c, I18N.t('pass.collect', { n: w.n, reward: w.reward }), W - 280), 140, top + 148);
    const n = Math.min(10, w.n), cols = Math.min(5, n), rows = Math.ceil(n / cols);
    const r = 46, gap = (W - 180 - 100 - cols * r * 2) / (cols - 1 || 1);
    for (let i = 0; i < n; i++) {
      const cx = 140 + r + (i % cols) * (r * 2 + gap), cy = top + 230 + Math.floor(i / cols) * (r * 2 + 22) + (rows === 1 ? 40 : 0);
      c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2);
      if (i < 4) { c.fillStyle = ink; c.fill(); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, r - 9, 0, Math.PI * 2); c.stroke(); }
      else { c.setLineDash([8, 8]); c.strokeStyle = '#B5B5B8'; c.lineWidth = 3; c.stroke(); c.setLineDash([]); }
    }

    // footer
    font(600, 40);
    c.fillStyle = '#0B0B0C';
    c.fillText(L.igCta, 90, H - 150);
    font(500, 28, 'normal', 'Spline Sans Mono');
    c.fillStyle = '#6B6B70';
    c.fillText(L.igSub, 90, H - 95);
    return cv;
  }
  function wrap(c, text, max) {
    const out = []; let line = '';
    text.split(' ').forEach(word => {
      const test = line ? line + ' ' + word : word;
      if (c.measureText(test).width > max && line) { out.push(line); line = word; } else line = test;
    });
    if (line) out.push(line);
    return out;
  }
  function fit(c, text, max) { if (c.measureText(text).width <= max) return text; while (text.length > 3 && c.measureText(text + '…').width > max) text = text.slice(0, -1); return text + '…'; }
  function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  // ---------- ready-to-send messages ----------
  const MSG = {
    it: {
      igHeadline: 'La carta fedeltà adesso è sul telefono.',
      igCta: 'Chiedi alla cassa e inquadra il QR.',
      igSub: 'Niente app. Niente carta da perdere.',
      copy: w => [
        { id: 'caption', label: 'Didascalia Instagram', text:
`Novità da ${w.business}: la carta fedeltà adesso è sul telefono ☕️
Ogni visita un timbro. Dopo ${w.n} timbri, ${w.reward}.

Come si fa: inquadra il QR alla cassa e salva la carta. Niente app da scaricare, niente cartoncino da perdere.

Ci vediamo al bancone!` },
        { id: 'story', label: 'Testo per la storia', text:
`Da oggi la carta fedeltà è digitale ✨
${w.n} timbri = ${w.reward}
Chiedi alla cassa 👋` },
        { id: 'whatsapp', label: 'Messaggio ai clienti abituali (WhatsApp)', text:
`Ciao! Da ${w.business} abbiamo una novità: la carta fedeltà adesso è sul telefono. Alla prossima visita inquadra il QR alla cassa: dopo ${w.n} timbri ti offriamo ${w.reward}. A presto!` },
        { id: 'staff', label: 'Cosa dire alla cassa (per il personale)', text:
`"Ha già la nostra carta fedeltà? È sul telefono: inquadri qui e le metto subito il primo timbro. Dopo ${w.n}, ${w.reward}."` },
        { id: 'reminder', label: 'Promemoria (quando manca un timbro)', text:
`Ti manca solo un timbro! Alla prossima visita da ${w.business}: ${w.reward}.` },
        { id: 'google', label: 'Post per Google (scheda attività)', text:
`Nuova carta fedeltà digitale da ${w.business}: un timbro a ogni visita e ${w.reward} dopo ${w.n} timbri. Basta inquadrare il QR alla cassa.` }
      ],
      plan: [
        ['Giorno 1', 'Metti il poster vicino alla cassa, all\'altezza degli occhi.'],
        ['Giorno 1', 'Spiega la carta al personale: 2 minuti, usa il testo "Cosa dire alla cassa".'],
        ['Giorno 2', 'Pubblica il post Instagram e la storia.'],
        ['Giorno 3', 'Regala il primo timbro a chi si iscrive questa settimana.'],
        ['Giorno 4', 'Manda il messaggio WhatsApp ai clienti abituali.'],
        ['Giorno 5', 'Attacca l\'adesivo in vetrina e i cartellini sui tavoli.'],
        ['Giorno 7', 'Guarda quanti iscritti hai nella sezione Clienti. Obiettivo: 30.']
      ]
    },
    en: {
      igHeadline: 'Our loyalty card is now on your phone.',
      igCta: 'Ask at the till and scan the QR code.',
      igSub: 'No app. Nothing to lose.',
      copy: w => [
        { id: 'caption', label: 'Instagram caption', text:
`News from ${w.business}: our loyalty card now lives on your phone ☕️
One stamp every visit. After ${w.n} stamps, ${w.reward}.

How: scan the QR code at the till and save the card. No app to download, no paper card to lose.

See you at the counter!` },
        { id: 'story', label: 'Story text', text:
`Our loyalty card just went digital ✨
${w.n} stamps = ${w.reward}
Ask at the till 👋` },
        { id: 'whatsapp', label: 'Message to regulars (WhatsApp)', text:
`Hi! Some news from ${w.business}: our loyalty card is now on your phone. Next time you're in, scan the QR code at the till. After ${w.n} stamps, ${w.reward} is on us. See you soon!` },
        { id: 'staff', label: 'What to say at the till (for staff)', text:
`"Do you have our loyalty card yet? It's on your phone: scan here and I'll add your first stamp now. After ${w.n}, ${w.reward}."` },
        { id: 'reminder', label: 'Reminder (one stamp to go)', text:
`Just one stamp to go! Next visit to ${w.business}: ${w.reward}.` },
        { id: 'google', label: 'Google Business post', text:
`New digital loyalty card at ${w.business}: one stamp every visit and ${w.reward} after ${w.n} stamps. Just scan the QR code at the till.` }
      ],
      plan: [
        ['Day 1', 'Put the poster by the till, at eye level.'],
        ['Day 1', 'Show your staff how it works: 2 minutes, use the "What to say at the till" text.'],
        ['Day 2', 'Publish the Instagram post and the story.'],
        ['Day 3', 'Give a free first stamp to everyone who joins this week.'],
        ['Day 4', 'Send the WhatsApp message to your regulars.'],
        ['Day 5', 'Put the sticker on the window and the cards on the tables.'],
        ['Day 7', 'Check how many members you have under Customers. Goal: 30.']
      ]
    }
  };

  const copy = (card, lang) => (MSG[lang] || MSG.en).copy(words(card, lang));
  const plan = lang => (MSG[lang] || MSG.en).plan;

  window.MARKETING = { words, poster, instagram, copy, plan };
})();
