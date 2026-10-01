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

/**
 * The stamp grid. `w`×`h` in points; `scale` gives @2x/@3x versions.
 * Apple: strip.png (375×123 pt). Google: hero image (1032×336 px).
 */
export async function strip(card, have, { w = 375, h = 123, scale = 1, background = true } = {}) {
  const { bg, fg, ink } = colours(card);
  const need = Math.max(1, Math.min(20, +card.stampsNeeded || 10));
  const rows = Math.ceil(need / 5);
  const cols = Math.ceil(need / rows);
  const padX = w * 0.08, padY = h * 0.12;
  const d = Math.min((w - padX * 2) / (cols + (cols - 1) * 0.55), (h - padY * 2) / (rows + (rows - 1) * 0.35));
  const gapX = cols > 1 ? (w - padX * 2 - cols * d) / (cols - 1) : 0;
  const gapY = rows > 1 ? Math.min(d * 0.35, (h - padY * 2 - rows * d) / (rows - 1)) : 0;
  const top = (h - (rows * d + (rows - 1) * gapY)) / 2;
  const empty = fg === '#FFFFFF' ? 'rgba(255,255,255,0.22)' : 'rgba(11,11,12,0.22)';
  let dots = '';
  for (let i = 0; i < need; i++) {
    const cx = padX + (i % cols) * (d + gapX) + d / 2;
    const cy = top + Math.floor(i / cols) * (d + gapY) + d / 2;
    const on = i < have;
    dots += `<circle cx="${cx}" cy="${cy}" r="${d / 2}" fill="${on ? ink : empty}"/>`;
    if (on && card.icon !== 'dot') dots += iconPath(card.icon, cx - d * 0.25, cy - d * 0.25, d * 0.5, '#FFFFFF');
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}">
    ${background ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ''}${dots}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Square icon: Apple shows it on the lock screen and in notifications.
export async function icon(card, px = 58) {
  const { bg, fg } = colours(card);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 24 24">
    <rect width="24" height="24" fill="${bg}"/>${iconPath(card.icon === 'dot' || !PATHS[card.icon] ? 'star' : card.icon, 3, 3, 18, fg)}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// Logo: the café's uploaded logo (a data: URL) fitted into Apple's 160×50 pt box.
export async function logo(card, scale = 2) {
  const m = /^data:image\/(png|jpeg|webp|svg\+xml);base64,(.+)$/.exec(card.logo || '');
  if (!m) return null;
  const input = Buffer.from(m[2], 'base64');
  if (input.length > 600 * 1024) return null;
  return sharp(input).resize({ width: 160 * scale, height: 50 * scale, fit: 'inside', withoutEnlargement: true }).png().toBuffer();
}
