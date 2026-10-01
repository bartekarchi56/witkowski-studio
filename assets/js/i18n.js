/*
 * Tiny translation helper (Italian / English).
 *
 *   <h1 data-i18n="hero.title"></h1>            → textContent
 *   <p data-i18n-html="hero.lede"></p>           → innerHTML (our own strings only)
 *   <input data-i18n-attr="placeholder:form.name">
 *
 * Pages add their own strings with I18N.add({ it: {...}, en: {...} }).
 * Listen for language changes with document.addEventListener('langchange', fn).
 */
(function () {
  const KEY = 'timbro:lang';
  const dict = { it: {}, en: {} };
  const LANGS = ['it', 'en'];

  function initial() {
    const q = new URLSearchParams(location.search).get('lang');
    if (LANGS.includes(q)) return q;
    try { const s = localStorage.getItem(KEY); if (LANGS.includes(s)) return s; } catch (e) {}
    return (navigator.language || '').toLowerCase().startsWith('it') ? 'it' : 'en';
  }

  const I18N = {
    lang: initial(),
    add(d) { LANGS.forEach(l => Object.assign(dict[l], d[l] || {})); return this; },
    t(key, vars) {
      let s = dict[this.lang][key] ?? dict.en[key] ?? key;
      if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
      return s;
    },
    // Pick the right language from an {it, en} object.
    pick(o) { return o[this.lang] || o.en; },
    apply(root = document) {
      root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = this.t(el.dataset.i18n); });
      root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = this.t(el.dataset.i18nHtml); });
      root.querySelectorAll('[data-i18n-attr]').forEach(el => {
        el.dataset.i18nAttr.split(';').forEach(pair => {
          const [attr, key] = pair.split(':');
          if (attr && key) el.setAttribute(attr.trim(), this.t(key.trim()));
        });
      });
      document.documentElement.lang = this.lang;
      document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === this.lang)));
    },
    set(lang) {
      if (!LANGS.includes(lang)) return;
      this.lang = lang;
      try { localStorage.setItem(KEY, lang); } catch (e) {}
      this.apply();
      document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
    },
    // Render an IT / EN switch into every .lang element on the page.
    switchers() {
      document.querySelectorAll('.lang').forEach(el => {
        el.setAttribute('role', 'group');
        el.setAttribute('aria-label', 'Lingua / Language');
        el.innerHTML = LANGS.map(l => `<button type="button" data-lang="${l}" lang="${l}" aria-pressed="${l === this.lang}">${l.toUpperCase()}</button>`).join('');
        el.addEventListener('click', e => { const b = e.target.closest('button'); if (b) this.set(b.dataset.lang); });
      });
    }
  };

  // Strings shared by every screen.
  I18N.add({
    it: {
      'pass.collect': 'Raccogli {n} timbri: {reward}',
      'pass.ready': 'Premio pronto: mostralo alla cassa',
      'pass.show': 'Mostra alla cassa',
      'pass.stamps': 'Timbri', 'pass.reward': 'Premio', 'pass.member': 'Cliente', 'pass.card': 'Carta', 'pass.tap': 'Tocca ··· per i dettagli',
      'pass.aria': '{title}: {have} timbri su {need}',
      'ago.never': 'Mai', 'ago.now': 'Adesso', 'ago.min': '{n} min fa', 'ago.h': '{n} h fa', 'ago.d': '{n} g fa',
      'copied': 'Copiato'
    },
    en: {
      'pass.collect': 'Collect {n} stamps: {reward}',
      'pass.ready': 'Reward ready: show it at the till',
      'pass.show': 'Show at the till',
      'pass.stamps': 'Stamps', 'pass.reward': 'Reward', 'pass.member': 'Member', 'pass.card': 'Card', 'pass.tap': 'Tap ··· for details',
      'pass.aria': '{title}: {have} of {need} stamps',
      'ago.never': 'Never', 'ago.now': 'Just now', 'ago.min': '{n} min ago', 'ago.h': '{n} h ago', 'ago.d': '{n} d ago',
      'copied': 'Copied'
    }
  });

  window.I18N = I18N;
})();
