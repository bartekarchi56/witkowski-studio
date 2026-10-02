// Pass images drawn as SVG and rasterised with sharp, so the Wallet card
// looks like the card on the website: same stamp grid, colours and icon.
import sharp from 'sharp';
import { PATHS } from './icons.js';

const hex = h => /^#[0-9a-f]{6}$/i.test(h || '') ? h : null;
export const textOn = bg => {
  const n = parseInt(bg.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#0B0B0C' : '#FFFFFF';
};
export const rgb = h => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;

export function colours(card) {
  const bg = hex(card.color) || '#FFFFFF';
  return { bg, fg: textOn(bg), ink: hex(card.ink) || '#2B32FF' };
}

const iconPath = (name, x, y, size, colour) => PATHS[name]
  ? `<path transform="translate(${x} ${y}) scale(${size / 24})" d="${PATHS[name]}" fill="none" stroke="${colour}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`
  : '';

const ANGLES = [-8, 5, -3, 9, -6, 3, -10, 7, -2, 6, -7, 4, -4, 8, -9, 2, -5, 10, -1, 5];
const pngData = (v, max = 200000) => /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v || '') && v.length < max ? v : '';

/**
 * The stamp grid, in the card's own style (shape, mark, empty boxes,
 * background). `w`×`h` in points; `scale` gives @2x/@3x versions.
 * Apple: strip.png (375×123 pt). Google: hero image (1032×336 px).
 */
export async function strip(card, have, { w = 375, h = 123, scale = 1 } = {}) {
  const { bg, ink } = colours(card);
  const stripBg = hex(card.strip) || bg;
  const fg = textOn(stripBg);
  const shape = ['dot', 'ring', 'square', 'hanko'].includes(card.shape) ? card.shape : 'dot';
  const mark = ['icon', 'text', 'none'].includes(card.mark) ? card.mark : (card.icon === 'dot' ? 'none' : 'icon');
  const empty = ['soft', 'outline', 'dashed'].includes(card.empty) ? card.empty : 'soft';
  const need = Math.max(1, Math.min(20, +card.stampsNeeded || 10));
  const rows = Math.ceil(need / 5);
  const cols = Math.ceil(need / rows);
  const padX = w * 0.08, padY = h * 0.12;
  const d = Math.min((w - padX * 2) / (cols + (cols - 1) * 0.45), (h - padY * 2) / (rows + (rows - 1) * 0.3));
  const gapX = cols > 1 ? (w - padX * 2 - cols * d) / (cols - 1) : 0;
  const gapY = rows > 1 ? Math.min(d * 0.3, (h - padY * 2 - rows * d) / (rows - 1)) : 0;
  const top = (h - (rows * d + (rows - 1) * gapY)) / 2;
  const faint = fg === '#FFFFFF' ? 'rgba(255,255,255,' : 'rgba(11,11,12,';
  const markColour = ['ring', 'hanko'].includes(shape) ? ink : '#FFFFFF';
  const markImg = pngData(card.markImage);
  const r = shape === 'square' ? 0.18 : shape === 'hanko' ? 0.12 : 0.5;

  const box = (x, y, s, attrs) => r === 0.5
    ? `<circle cx="${x + s / 2}" cy="${y + s / 2}" r="${s / 2}" ${attrs}/>`
    : `<rect x="${x}" y="${y}" width="${s}" height="${s}" rx="${s * r}" ${attrs}/>`;

  let out = '';
  for (let i = 0; i < need; i++) {
    const x = padX + (i % cols) * (d + gapX), y = top + Math.floor(i / cols) * (d + gapY);
    if (i >= have) {
      out += empty === 'soft' ? box(x, y, d, `fill="${faint}0.22)"`)
        : box(x + 0.75, y + 0.75, d - 1.5, `fill="none" stroke="${faint}${empty === 'dashed' ? '0.4' : '0.28'})" stroke-width="1.5"${empty === 'dashed' ? ' stroke-dasharray="3 3"' : ''}`);
      continue;
    }
    const art = pngData(card.stampImage, 400000);
    if (art) { out += `<image href="${art}" x="${x}" y="${y}" width="${d}" height="${d}" preserveAspectRatio="xMidYMid meet" transform="rotate(${ANGLES[i]} ${x + d / 2} ${y + d / 2})"/>`; continue; }
    let g = '';
    if (shape === 'ring') g += box(x + 1.25, y + 1.25, d - 2.5, `fill="none" stroke="${ink}" stroke-width="2.5"`);
    else if (shape === 'hanko') g += box(x + 1.25, y + 1.25, d - 2.5, `fill="none" stroke="${ink}" stroke-width="2.5"`) + box(x + 5, y + 5, d - 10, `fill="none" stroke="${ink}" stroke-width="1"`);
    else g += box(x, y, d, `fill="${ink}"`);
    if (mark === 'icon') g += iconPath(card.icon, x + d * 0.25, y + d * 0.25, d * 0.5, markColour);
    if (mark === 'text') g += markImg
      ? `<image href="${markImg}" x="${x + d * 0.14}" y="${y + d * 0.14}" width="${d * 0.72}" height="${d * 0.72}"/>`
      : `<text x="${x + d / 2}" y="${y + d * 0.68}" font-size="${d * 0.5}" font-weight="700" text-anchor="middle" fill="${markColour}" font-family="Noto Serif CJK JP, Noto Serif JP, serif">${(card.markText || '').slice(0, 2).replace(/[<&>]/g, '')}</text>`;
    out += shape === 'hanko' ? `<g opacity="0.92" transform="rotate(${ANGLES[i]} ${x + d / 2} ${y + d / 2})">${g}</g>` : g;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${stripBg}"/>${pngData(card.stripImage, 900000) ? `<image href="${card.stripImage}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice"/>` : ''}${out}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Square icon: Apple shows it on the lock screen and in notifications.
export async function icon(card, px = 58) {
  const { bg, fg } = colours(card);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24">
    <rect width="24" height="24" fill="${bg}"/>${iconPath(card.icon === 'dot' || !PATHS[card.icon] ? 'star' : card.icon, 3, 3, 18, fg)}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Logo: the café's uploaded logo, or the name drawn in the card's font
// by the website (logoAuto), fitted into Apple's 160×50 pt box.
export async function logo(card, scale = 2) {
  const m = /^data:image\/(png|jpeg|webp|svg\+xml);base64,(.+)$/.exec(card.logo || card.logoAuto || '');
  if (!m) return null;
  const input = Buffer.from(m[2], 'base64');
  if (input.length > 600 * 1024) return null;
  return sharp(input).resize({ width: 160 * scale, height: 50 * scale, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
}
