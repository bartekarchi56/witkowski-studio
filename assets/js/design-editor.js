/*
 * Design controls for a card, shared by the café's dashboard and the
 * Witkowski Design studio.
 *
 *   const ed = DesignEditor.mount(el, { mode: 'owner' | 'designer', onChange });
 *   ed.set(design); ed.get();
 *
 * 'owner' shows the simple controls a café can change (logo, colours,
 * background, stamp). 'designer' adds everything: styles, fonts, marks,
 * empty boxes, tagline. Needs config.js, i18n.js, ui.js.
 */
(function () {
  const COLORS = ['#FFFFFF', '#0B0B0C', '#F3EEE4', '#EEE9E1', '#4A2E21', '#1F3D2B', '#6B1E2B', '#1B2A4A'];
  const STRIPS = ['', '#EEE9E1', '#F3EEE4', '#F4F4F2', '#E7EFE9', '#0B0B0C'];
  const INKS = ['#2B32FF', '#0B0B0C', '#B5442E', '#D6261C', '#C9A24A', '#4A2E21', '#2F6B4F'];
  const SHAPES = [['dot', 'de.shDot', '<circle cx="12" cy="12" r="9" fill="currentColor"/>'],
    ['ring', 'de.shRing', '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.5"/>'],
    ['square', 'de.shSquare', '<rect x="3" y="3" width="18" height="18" rx="4" fill="currentColor"/>'],
    ['hanko', 'de.shHanko', '<rect x="3" y="3" width="18" height="18" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="6.5" y="6.5" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1"/>']];
  const ICON_NAMES = { it: { cup: 'Tazza', cake: 'Dolce', glass: 'Calice', cone: 'Cono', pizza: 'Pizza', scissors: 'Forbici', leaf: 'Foglia', heart: 'Cuore', star: 'Stella' },
    en: { cup: 'Cup', cake: 'Cake', glass: 'Glass', cone: 'Cone', pizza: 'Pizza', scissors: 'Scissors', leaf: 'Leaf', heart: 'Heart', star: 'Star' } };

  I18N.add({
    it: {
      'de.style': 'Stile di partenza', 'de.logo': 'Logo', 'de.logoHint': 'PNG con sfondo trasparente, orizzontale. Prende il posto del nome.',
      'de.upload': 'Carica', 'de.remove': 'Togli', 'de.tagline': 'Sottotitolo sotto il nome', 'de.font': 'Carattere del nome',
      'de.fSans': 'Moderno', 'de.fWide': 'Largo', 'de.fSerif': 'Classico', 'de.fMono': 'Macchina',
      'de.color': 'Colore della carta', 'de.strip': 'Sfondo dei timbri', 'de.stripImg': 'oppure un\'immagine di sfondo', 'de.stripHint': 'Una foto o una texture, larga e bassa (circa 3:1).',
      'de.shape': 'Forma del timbro', 'de.shDot': 'Tondo', 'de.shRing': 'Anello', 'de.shSquare': 'Quadrato', 'de.shHanko': 'Sigillo giapponese',
      'de.art': 'oppure il tuo disegno del timbro', 'de.artHint': 'PNG quadrato con sfondo trasparente. Sostituisce la forma.',
      'de.mark': 'Dentro il timbro', 'de.mkIcon': 'Icona', 'de.mkText': 'Lettera o simbolo', 'de.mkNone': 'Niente',
      'de.ink': 'Colore del timbro', 'de.empty': 'Caselle vuote', 'de.emSoft': 'Grigie', 'de.emOutline': 'Contorno', 'de.emDashed': 'Tratteggio', 'de.same': 'Uguale alla carta'
    },
    en: {
      'de.style': 'Starting style', 'de.logo': 'Logo', 'de.logoHint': 'A wide PNG with a transparent background. It replaces the name.',
      'de.upload': 'Upload', 'de.remove': 'Remove', 'de.tagline': 'Tagline under the name', 'de.font': 'Name font',
      'de.fSans': 'Modern', 'de.fWide': 'Wide', 'de.fSerif': 'Classic', 'de.fMono': 'Typewriter',
      'de.color': 'Card colour', 'de.strip': 'Behind the stamps', 'de.stripImg': 'or a background image', 'de.stripHint': 'A photo or texture, wide and short (about 3:1).',
      'de.shape': 'Stamp shape', 'de.shDot': 'Round', 'de.shRing': 'Ring', 'de.shSquare': 'Square', 'de.shHanko': 'Japanese seal',
      'de.art': 'or your own stamp artwork', 'de.artHint': 'A square PNG with a transparent background. It replaces the shape.',
      'de.mark': 'Inside the stamp', 'de.mkIcon': 'Icon', 'de.mkText': 'Letter or symbol', 'de.mkNone': 'Nothing',
      'de.ink': 'Stamp colour', 'de.empty': 'Empty boxes', 'de.emSoft': 'Grey', 'de.emOutline': 'Outline', 'de.emDashed': 'Dashed', 'de.same': 'Same as the card'
    }
  });

  // Scale an uploaded image down so it stays small enough to store.
  function shrink(file, maxW, maxH, type = 'image/png') {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, maxW / img.width, maxH / img.height);
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(img.src);
        resolve(cv.toDataURL(type, 0.85));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  let n = 0;
  function mount(root, { mode = 'owner', onChange = () => {} } = {}) {
    const id = 'de' + (++n);
    const t = k => I18N.t(k);
    const designer = mode === 'designer';
    let images = { logo: '', stampImage: '', stripImage: '' };
    let current = {};

    const radios = (name, items) => `<div class="chips">${items.map(([v, label]) =>
      `<input type="radio" name="${id}-${name}" id="${id}-${name}-${v || 'none'}" value="${v}"><label for="${id}-${name}-${v || 'none'}">${label}</label>`).join('')}</div>`;
    const swatches = (name, list) => `<div class="swatches">${list.map((c, i) =>
      `<input type="radio" name="${id}-${name}" id="${id}-${name}${i}" value="${c}"><label for="${id}-${name}${i}" title="${c || t('de.same')}" style="background:${c || 'repeating-linear-gradient(45deg,#fff 0 4px,#ddd 4px 8px)'}"><span class="sr-only">${c || t('de.same')}</span></label>`).join('')}</div>`;
    const upload = (key, hint) => `<div class="de-up"><label class="btn line small" for="${id}-${key}">${t('de.upload')}</label>
      <input type="file" id="${id}-${key}" data-img="${key}" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="sr-only">
      <span class="de-thumb" data-thumb="${key}"></span><button class="link" type="button" data-clear="${key}" hidden>${t('de.remove')}</button></div>
      ${hint ? `<small class="muted">${t(hint)}</small>` : ''}`;
    const field = (label, inner, extra = '') => `<div class="field de-field" ${extra}><span>${label}</span>${inner}</div>`;

    function draw() {
      root.innerHTML = `
        ${designer ? field(t('de.style'), radios('style', CONFIG.styles.map(st => [st.id, `<span class="sw" style="background:${st.look.color}"></span><span class="sw" style="background:${st.look.ink}"></span>${UI.esc(I18N.pick(st))}`]))) : ''}
        ${field(t('de.logo'), upload('logo', 'de.logoHint'))}
        ${designer ? field(t('de.tagline'), `<input type="text" data-k="tagline" maxlength="24">`) : ''}
        ${designer ? field(t('de.font'), radios('font', [['sans', t('de.fSans')], ['wide', `<span style="font-stretch:125%;text-transform:uppercase;letter-spacing:.14em;font-size:13px">${t('de.fWide')}</span>`], ['serif', `<span style="font-family:'EB Garamond',serif;font-style:italic;font-size:17px">${t('de.fSerif')}</span>`], ['mono', `<span style="font-family:var(--mono);font-size:13px">${t('de.fMono')}</span>`]])) : ''}
        ${field(t('de.color'), swatches('color', COLORS))}
        ${field(t('de.strip'), swatches('strip', STRIPS) + `<small class="muted" style="margin-top:8px">${t('de.stripImg')}</small>` + upload('stripImage', 'de.stripHint'))}
        ${field(t('de.shape'), radios('shape', SHAPES.map(([v, k, svg]) => [v, `<svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg>${t(k)}`])) + `<small class="muted" style="margin-top:8px">${t('de.art')}</small>` + upload('stampImage', 'de.artHint'))}
        ${designer ? field(t('de.mark'), radios('mark', [['icon', t('de.mkIcon')], ['text', t('de.mkText')], ['none', t('de.mkNone')]]) +
          `<div class="chips de-icons" style="margin-top:10px">${UI.ICONS.map(ic => `<input type="radio" name="${id}-icon" id="${id}-icon-${ic}" value="${ic}"><label for="${id}-icon-${ic}" title="${ICON_NAMES[I18N.lang][ic]}">${UI.icon(ic)}<span class="sr-only">${ICON_NAMES[I18N.lang][ic]}</span></label>`).join('')}</div>
           <input type="text" data-k="markText" maxlength="2" class="de-marktext" placeholder="C">`) : ''}
        ${field(t('de.ink'), swatches('ink', INKS))}
        ${designer ? field(t('de.empty'), radios('empty', [['soft', t('de.emSoft')], ['outline', t('de.emOutline')], ['dashed', t('de.emDashed')]])) : ''}`;
      fill(current);
    }

    const radio = name => { const el = root.querySelector(`input[name="${id}-${name}"]:checked`); return el ? el.value : undefined; };
    const pick = (name, value) => { const el = root.querySelector(`input[name="${id}-${name}"][value="${value ?? ''}"]`); if (el) el.checked = true; };

    function fill(d) {
      const look = UI.lookOf(d);
      pick('style', d.style); pick('font', look.font); pick('color', d.color || '#FFFFFF'); pick('strip', look.strip);
      pick('shape', look.shape); pick('mark', look.mark); pick('icon', d.icon || 'cup'); pick('ink', d.ink || '#2B32FF'); pick('empty', look.empty);
      root.querySelectorAll('[data-k]').forEach(el => { el.value = d[el.dataset.k] || ''; });
      images = { logo: d.logo || '', stampImage: d.stampImage || '', stripImage: d.stripImage || '' };
      thumbs(); toggles();
    }
    function thumbs() {
      Object.entries(images).forEach(([k, v]) => {
        const th = root.querySelector(`[data-thumb="${k}"]`); if (!th) return;
        th.innerHTML = v ? `<img src="${v}" alt="">` : '';
        root.querySelector(`[data-clear="${k}"]`).hidden = !v;
      });
    }
    function toggles() {
      const mark = radio('mark');
      const icons = root.querySelector('.de-icons'), text = root.querySelector('.de-marktext');
      if (icons) icons.hidden = mark !== 'icon';
      if (text) text.hidden = mark !== 'text';
    }

    function get() {
      const d = { ...current, ...images };
      ['font', 'color', 'strip', 'shape', 'mark', 'icon', 'ink', 'empty'].forEach(k => { const v = radio(k); if (v !== undefined) d[k] = v; });
      root.querySelectorAll('[data-k]').forEach(el => { d[el.dataset.k] = el.value.trim(); });
      d.style = radio('style') || '';
      return d;
    }

    root.addEventListener('change', async e => {
      const el = e.target;
      if (el.dataset.img) {
        const f = el.files[0]; if (!f) return;
        const size = { logo: [600, 180], stampImage: [256, 256], stripImage: [1125, 375] }[el.dataset.img];
        images[el.dataset.img] = await shrink(f, ...size, el.dataset.img === 'stripImage' ? 'image/jpeg' : 'image/png');
        el.value = ''; thumbs(); onChange(get()); return;
      }
      if (el.name === `${id}-style`) {
        const st = CONFIG.styles.find(x => x.id === el.value).look;
        current = { ...get(), ...st, style: el.value };
        fill(current);
      } else if (el.name && el.name.startsWith(id) && !el.name.endsWith('-style')) {
        root.querySelectorAll(`input[name="${id}-style"]`).forEach(r => { r.checked = false; });
      }
      toggles(); onChange(get());
    });
    root.addEventListener('input', e => { if (e.target.dataset.k) onChange(get()); });
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-clear]'); if (!b) return;
      images[b.dataset.clear] = ''; thumbs(); onChange(get());
    });

    draw();
    return {
      set(d) { current = { ...d }; fill(current); },
      get,
      redraw() { const d = get(); draw(); current = d; fill(d); }
    };
  }

  window.DesignEditor = { mount };
})();
