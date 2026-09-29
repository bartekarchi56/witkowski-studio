/* Shared UI helpers: the pass (loyalty card), QR codes, toasts. */
(function () {
  const ROOT = new URL('../../', document.currentScript.src);

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Pick black or white text for a given card colour.
  function textOn(hex) {
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#15171A' : '#FFFFFF';
  }

  function qrSvg(text) {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }

  function qrCanvas(text, px) {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount(), margin = 4, cell = Math.floor(px / (n + margin * 2));
    const size = cell * (n + margin * 2);
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
      if (qr.isDark(r, c)) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
    return cv;
  }

  /**
   * card: {business,title,reward,stampsNeeded,color,icon}
   * customer (optional): {id,stamps}
   * opts.pop: index of a stamp to animate in
   * opts.stamps: stamp count to show when there is no customer
   */
  function renderPass(card, customer, opts = {}) {
    const need = Math.max(1, Math.min(20, +card.stampsNeeded || 10));
    const have = customer ? customer.stamps : (opts.stamps || 0);
    const full = have >= need;
    let dots = '';
    for (let i = 0; i < need; i++) {
      const on = i < have;
      dots += `<span class="pass-dot${on ? ' on' : ''}${opts.pop === i ? ' pop' : ''}">${on ? `<span>${esc(card.icon)}</span>` : ''}</span>`;
    }
    const foot = customer ? `
      <div class="pass-foot">
        <div class="qr" aria-hidden="true">${qrSvg(customer.id)}</div>
        <div><small>Show this at the till</small><b>${esc(customer.id)}</b><small>${esc(customer.name)}</small></div>
      </div>` : '';
    // Balanced rows: 6 → 6, 8 → 4+4, 10 → 5+5, 15 → 5+5+5
    const cols = Math.ceil(need / Math.ceil(need / 6));
    return `
      <div class="pass" style="--c:${esc(card.color)};--t:${textOn(card.color)}" role="group" aria-label="${esc(card.title)}: ${have} of ${need} stamps">
        <div class="pass-head">
          <div class="pass-biz"><span class="pass-icon" aria-hidden="true">${esc(card.icon)}</span>${esc(card.business)}</div>
          <span class="pass-count">${have} / ${need}</span>
        </div>
        <div class="pass-title">${esc(card.title)}</div>
        <div class="pass-reward">Collect ${need} stamps: ${esc(card.reward)}</div>
        <div class="pass-grid" style="--cols:${cols}" aria-hidden="true">${dots}</div>
        ${full ? `<div class="pass-ready">★ Reward ready. Show this card to claim it.</div>` : ''}
        ${foot}
      </div>`;
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
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  const joinUrl = cardId => new URL('app/card.html?card=' + encodeURIComponent(cardId), ROOT).href;

  function timeAgo(t) {
    if (!t) return 'Never';
    const s = (Date.now() - t) / 1000;
    if (s < 60) return 'Just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return Math.floor(s / 86400) + ' d ago';
  }

  window.UI = { esc, textOn, qrSvg, qrCanvas, renderPass, toast, joinUrl, timeAgo };
})();
