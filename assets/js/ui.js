/* Shared UI helpers: icons, the pass (loyalty card), QR codes, toasts. */
(function () {
  const ROOT = new URL('../../', document.currentScript.src);
  const t = (k, v) => window.I18N ? I18N.t(k, v) : k;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Line icons, 24×24, drawn in the current text colour.
  const PATHS = {
    cup: 'M4 9h12v4.5A5.5 5.5 0 0 1 10.5 19h-1A5.5 5.5 0 0 1 4 13.5zM16 10.5h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5c-.8 1 .8 2 0 3M12 3.5c-.8 1 .8 2 0 3',
    cake: 'M4 20h16M5 20v-7h14v7M5 16c2.3 0 2.3-1.6 4.7-1.6S12 16 14.3 16s2.4-1.6 4.7-1.6M12 13V9.5M12 7.2v-.4',
    glass: 'M5 4h14l-7 8.5zM12 12.5V20M8 20h8M7.5 7h9',
    cone: 'M7 10a5 5 0 0 1 10 0M6.5 10h11L12 21z',
    pizza: 'M12 21 3.5 6.5c5.5-3 11.5-3 17 0zM5.6 9.8c4.2-1.8 8.6-1.8 12.8 0M9 12.5v.01M14 13v.01M11.5 16.5v.01',
    scissors: 'M8.5 8.5 20 19M8.5 15.5 20 5M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    leaf: 'M5 19C5 10.5 10.5 5 19.5 4.5 19.5 13.5 14 19 5 19zM5 19l7.5-7.5',
    heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20z',
    star: 'M12 3.5l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.1 6.1-.6z'
  };
  const icon = (name, extra = '') => PATHS[name]
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}><path d="${PATHS[name]}"/></svg>`
    : `<span aria-hidden="true">${esc(name)}</span>`;

  // Black or white text, whichever reads better on the card colour.
  function textOn(hex) {
    const n = parseInt(String(hex).slice(1), 16);
    const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#0B0B0C' : '#FFFFFF';
  }

  function qr(text) { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q; }
  const qrSvg = text => qr(text).createSvgTag({ cellSize: 4, margin: 0, scalable: true });

  function qrCanvas(text, px, margin = 4) {
    const q = qr(text);
    const n = q.getModuleCount(), cell = Math.max(1, Math.floor(px / (n + margin * 2)));
    const size = cell * (n + margin * 2);
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
      if (q.isDark(r, c)) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
    return cv;
  }

  // Each stamp lands at a slightly different angle, like a real rubber stamp.
  const ANGLES = [-8, 5, -3, 9, -6, 3, -10, 7, -2, 6, -7, 4, -4, 8, -9, 2, -5, 10, -1, 5];

  // A card's look, with defaults for cards made before styles existed.
  function lookOf(card) {
    return {
      shape: card.shape || 'dot',
      mark: card.mark || (card.icon === 'dot' ? 'none' : 'icon'),
      markText: (card.markText || (card.business || '?').trim()[0] || '?').slice(0, 2),
      empty: card.empty || 'soft',
      font: card.font || 'sans',
      strip: card.strip || ''
    };
  }

  // Which Wallet to draw: the phone's own, unless a page switch says otherwise.
  let platform = /android/i.test(navigator.userAgent) ? 'google' : 'apple';
  const SAMPLE_CODE = 'K7M2QX';

  /**
   * Draws the card the way Apple Wallet (opts.platform 'apple') or Google
   * Wallet ('google') shows it.
   * card: {business,title,reward,stampsNeeded,color,ink,icon,logo}
   * customer (optional): {id,name,stamps}
   * opts.stamps: stamps to show when there is no customer
   * opts.pop: index of a stamp to animate in
   * opts.compact: no QR code (used on the stamper, where staff already scanned it)
   */
  function renderPass(card, customer, opts = {}) {
    const kind = opts.platform || platform;
    const need = Math.max(1, Math.min(20, +card.stampsNeeded || 10));
    const have = Math.min(need, customer ? customer.stamps : (opts.stamps || 0));
    const full = have >= need;
    const cols = Math.ceil(need / Math.ceil(need / 5));
    const look = lookOf(card);
    const markHtml = look.mark === 'icon' ? icon(card.icon) : look.mark === 'text' ? `<b>${esc(look.markText)}</b>` : '';
    let dots = '';
    for (let i = 0; i < need; i++) {
      const on = i < have;
      dots += `<span class="wp-dot s-${look.shape} e-${look.empty}${on ? ' on' : ''}${opts.pop === i ? ' pop' : ''}" style="--r:${ANGLES[i]}deg">${on ? markHtml : ''}</span>`;
    }
    const bg = card.color || '#FFFFFF';
    // Tourists browsing in English see the English text when the café wrote one.
    const en = window.I18N && I18N.lang === 'en';
    const title = (en && card.titleEn) || card.title;
    const reward = (en && card.rewardEn) || card.reward;
    const code = customer ? customer.id : SAMPLE_CODE;
    const codeBox = opts.compact ? '' : `<div class="wp-code"><div class="qr" aria-hidden="true">${qrSvg(code)}</div><small>${esc(code)}</small></div>`;
    const field = (label, value, cls = '') => `<div class="${cls}"><span class="wp-label">${esc(label)}</span><span class="wp-val">${esc(value)}</span></div>`;
    const ready = full ? `<div class="wp-ready">${t('pass.ready')}</div>` : '';
    const strip = `<div class="wp-strip" style="--cols:${cols}" aria-hidden="true">${dots}</div>`;
    const style = `--c:${esc(bg)};--t:${textOn(bg)};--s:${esc(card.ink || '#2B32FF')};--sb:${esc(look.strip || bg)}`;
    const fontCls = ` f-${look.font}`;
    const aria = esc(t('pass.aria', { title, have, need }));

    if (kind === 'google') {
      const logo = card.logo ? `<img src="${esc(card.logo)}" alt="">` : (look.mark === 'text' ? `<b class="wp-gmark">${esc(look.markText)}</b>` : icon(card.icon === 'dot' ? 'star' : card.icon));
      return `
      <div class="pass google${fontCls}" style="${style}" role="group" aria-label="${aria}">
        <div class="wp-head"><span class="wp-glogo">${logo}</span><span class="wp-name">${esc(card.business)}</span></div>
        <div class="wp-title">${esc(title)}</div>
        <div class="wp-fields">${field(t('pass.stamps'), `${have}/${need}`)}${field(t('pass.reward'), reward)}</div>
        ${ready}
        ${codeBox}
        ${strip}
      </div>`;
    }
    const logo = card.logo
      ? `<img src="${esc(card.logo)}" alt="${esc(card.business)}">`
      : `${look.mark === 'icon' ? icon(card.icon) : ''}<span class="wp-word"><span class="wp-name">${esc(card.business)}</span>${card.tagline ? `<small>${esc(card.tagline)}</small>` : ''}</span>`;
    return `
      <div class="pass apple${fontCls}${opts.compact ? ' compact' : ''}" style="${style}" role="group" aria-label="${aria}">
        <div class="wp-head"><div class="wp-logo">${logo}</div>${field(t('pass.stamps'), `${have}/${need}`, 'wp-hf')}</div>
        ${strip}
        <div class="wp-fields">${field(t('pass.reward'), reward)}${field(customer ? t('pass.member') : t('pass.card'), customer ? customer.name : title)}</div>
        ${ready}
        ${codeBox}
        ${opts.compact ? '' : `<div class="wp-tap">${t('pass.tap')}</div>`}
      </div>`;
  }

  // Renders an iPhone / Android switch into `el`; calls onChange after a switch.
  function platformSwitch(el, onChange) {
    const draw = () => {
      el.className = 'platform';
      el.setAttribute('role', 'group');
      el.setAttribute('aria-label', 'Wallet');
      el.innerHTML = [['apple', 'iPhone'], ['google', 'Android']].map(([k, l]) =>
        `<button type="button" data-p="${k}" aria-pressed="${k === platform}">${l}</button>`).join('');
    };
    el.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      platform = b.dataset.p;
      document.querySelectorAll('.platform').forEach(x => x.querySelectorAll('button').forEach(y => y.setAttribute('aria-pressed', String(y.dataset.p === platform))));
      onChange && onChange(platform);
    });
    draw();
  }

  let toastEl, toastTimer;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    toast(t('copied'));
  }

  // Links that work where the page is open (for testing)…
  const joinUrl = cardId => new URL('app/card.html?card=' + encodeURIComponent(cardId), ROOT).href;
  // …and links for anything printed or sent, which must point at the live site.
  const publicUrl = path => new URL(path, (window.CONFIG && CONFIG.siteUrl) || ROOT).href;
  const publicJoinUrl = cardId => publicUrl('app/card.html?card=' + encodeURIComponent(cardId));

  function timeAgo(ts) {
    if (!ts) return t('ago.never');
    const s = (Date.now() - ts) / 1000;
    if (s < 60) return t('ago.now');
    if (s < 3600) return t('ago.min', { n: Math.floor(s / 60) });
    if (s < 86400) return t('ago.h', { n: Math.floor(s / 3600) });
    return t('ago.d', { n: Math.floor(s / 86400) });
  }

  // The brand's rubber-stamp mark. `ring` is the text around the edge.
  let stampN = 0;
  function inkStamp(ring = 'TIMBRO · MILANO · TIMBRO · MILANO ·', iconName = 'cup') {
    const id = 'stamp' + (++stampN);
    return `<svg viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <filter id="${id}f"><feTurbulence type="fractalNoise" baseFrequency="1.2" numOctaves="2" seed="4"/><feDisplacementMap in="SourceGraphic" scale="2.4"/></filter>
        <path id="${id}p" d="M50 50m-37 0a37 37 0 1 1 74 0a37 37 0 1 1-74 0"/>
      </defs>
      <g filter="url(#${id}f)" fill="none" stroke="currentColor">
        <circle cx="50" cy="50" r="47" stroke-width="4"/>
        <circle cx="50" cy="50" r="29" stroke-width="2"/>
        <text font-family="Spline Sans Mono, monospace" font-size="9.5" font-weight="500" fill="currentColor" stroke="none"><textPath textLength="226" lengthAdjust="spacing" href="#${id}p">${esc(ring)}</textPath></text>
        <path transform="translate(35 35) scale(1.25)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="${PATHS[iconName] || PATHS.cup}"/>
      </g>
    </svg>`;
  }

  /**
   * Wallet apps draw text in their own system font, so the café's chosen
   * font and the stamp's letter/symbol are turned into images here and sent
   * to the wallet server with the card.
   */
  async function walletAssets(card) {
    const look = lookOf(card);
    const FONTS = {
      sans: ['600 64px "Archivo"', 'normal', false, 0],
      wide: ['400 54px "Archivo"', 'expanded', true, 14],
      serif: ['italic 500 74px "EB Garamond"', 'normal', false, 0],
      mono: ['500 58px "Spline Sans Mono"', 'normal', true, 4]
    };
    const [font, stretch, upper, track] = FONTS[look.font] || FONTS.sans;
    try { await Promise.all([document.fonts.load(font), document.fonts.load('300 30px "Noto Sans JP"', card.tagline || 'ザ'), document.fonts.load('700 90px "Noto Serif JP"', look.markText)]); } catch (e) {}
    const fg = textOn(card.color || '#FFFFFF');
    const out = {};
    if (!card.logo) {
      const cv = document.createElement('canvas'); cv.width = 480; cv.height = 150;
      const c = cv.getContext('2d');
      const setFont = (f, st, tr) => { c.font = f; if ('fontStretch' in c) c.fontStretch = st; if ('letterSpacing' in c) c.letterSpacing = tr + 'px'; };
      setFont(font, stretch, track);
      const name = upper ? card.business.toUpperCase() : card.business;
      // Long names get a smaller font instead of being cut.
      const k = Math.min(1, 470 / c.measureText(name).width);
      if (k < 1) setFont(font.replace(/(\d+)px/, (_, n) => Math.floor(n * k) + 'px'), stretch, track * k);
      c.fillStyle = fg; c.textBaseline = 'alphabetic';
      c.fillText(name, 0, card.tagline ? 78 : 98);
      if (card.tagline) { setFont('300 30px "Noto Sans JP", sans-serif', 'normal', 9); c.globalAlpha = .7; c.fillText(card.tagline, 2, 128); }
      out.logoAuto = cv.toDataURL('image/png');
    }
    if (look.mark === 'text') {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const c = cv.getContext('2d');
      c.font = '700 84px "Noto Serif JP", "EB Garamond", serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = ['ring', 'hanko'].includes(look.shape) ? (card.ink || '#2B32FF') : '#FFFFFF';
      c.fillText(look.markText, 64, 70);
      out.markImage = cv.toDataURL('image/png');
    }
    return out;
  }

  window.UI = { walletAssets, lookOf, platformSwitch, getPlatform: () => platform, inkStamp, esc, icon, ICONS: Object.keys(PATHS), textOn, qrSvg, qrCanvas, renderPass, toast, copy, joinUrl, publicUrl, publicJoinUrl, timeAgo };
})();
