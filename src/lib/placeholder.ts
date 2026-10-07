/**
 * Deterministic placeholder artwork — no external requests, works offline.
 * Layered warm gradients + arcs + a big initial, seeded by the event slug
 * so each event keeps its own look. Used whenever no cover was uploaded.
 * Organizers replace it by uploading a cover in /admin.
 */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const PALETTES: [string, string, string][] = [
  ['#C4A97D', '#8A6D3B', '#1A1A1A'], // spark / bronze / ink
  ['#C84B2F', '#7A2E1D', '#1A1A1A'], // ember / rust / ink
  ['#3A3A3A', '#8C8E80', '#EFECE5'], // charcoal / sage / paper
  ['#0F5132', '#1B6E9C', '#EFECE5'], // forest / cobalt / paper
  ['#5B21B6', '#B45309', '#EFECE5'], // violet / gold / paper
];

export function placeholder(seed: string, opts?: { initial?: string; wide?: boolean }): string {
  const h = hash(seed || 'event');
  const [a, b, c] = PALETTES[h % PALETTES.length];
  const w = opts?.wide === false ? 800 : 1600;
  const hh = opts?.wide === false ? 800 : 900;
  const cx = 200 + (h % 1200);
  const cy = 150 + ((h >> 4) % 600);
  const r = 300 + ((h >> 8) % 420);
  const initial = (opts?.initial || seed || 'E').trim().slice(0, 1).toUpperCase();
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hh}" viewBox="0 0 ${w} ${hh}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
    `<rect width="${w}" height="${hh}" fill="url(#g)"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-opacity="0.25" stroke-width="2"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${Math.round(r * 0.66)}" fill="none" stroke="${c}" stroke-opacity="0.18" stroke-width="2"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${Math.round(r * 0.33)}" fill="${c}" fill-opacity="0.12"/>` +
    `<text x="${w - 80}" y="${hh - 60}" font-family="Georgia,serif" font-size="340" font-weight="bold" fill="${c}" fill-opacity="0.28" text-anchor="end">${initial}</text>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
