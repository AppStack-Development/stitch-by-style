// Regenerates every app icon from src/brand/logo.json (no dependencies).
//   npm run icons
// Writes public/icons/: logo.svg (favicon), favicon-32.png, apple-touch-icon.png,
// icon-192.png, icon-512.png, icon-maskable-512.png
// Keep the drawing in step with src/components/LogoMark.tsx (variant "tile").
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const logo = JSON.parse(readFileSync(new URL('../src/brand/logo.json', import.meta.url), 'utf8'));
const { tile, geometry: G } = logo;
const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const C = Object.fromEntries(Object.entries(tile).map(([k, v]) => [k, hex(v)]));

const segDist = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - ax - t * vx, py - ay - t * vy);
};
const inRoundRect = (u, v, r) => {
  const dx = Math.max(r - u, 0, u - (1 - r)), dy = Math.max(r - v, 0, v - (1 - r));
  return dx * dx + dy * dy <= r * r;
};

/**
 * Colour of one point in output unit space, or null when outside the tile. Top layer first.
 * `scale` shrinks the drawing toward the centre (full-bleed icons keep it in the safe zone);
 * `px` is the rendered size, used for the minimum stroke width.
 */
function sample(o, ou, ov) {
  if (o.rounded && !inRoundRect(ou, ov, G.tileRadius)) return null;
  const u = 0.5 + (ou - 0.5) / o.scale, v = 0.5 + (ov - 0.5) / o.scale;
  const half = Math.max(G.stroke, G.minStrokePx / (o.px * o.scale)) / 2;
  const a = G.from, b = G.to;
  if (segDist(u, v, a, b, b, a) <= half) return C.over; // "/" on top
  if (segDist(u, v, a, a, b, b) <= half) return C.under; // "\" underneath
  if (o.holes) {
    const h = G.holeInset, k = 1 - h;
    for (const [x, y] of [[h, h], [k, h], [h, k], [k, k]]) if (Math.hypot(u - x, v - y) <= G.holeRadius) return C.hole;
  }
  return C.background;
}

function png(size, opts) {
  const o = { scale: 1, ...opts, holes: opts.holes ?? size >= 24, px: size };
  const SS = 4, stride = size * 4 + 1, raw = Buffer.alloc(stride * size);
  for (let py = 0; py < size; py++) {
    raw[py * stride] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = sample(o, (px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
      }
      const i = py * stride + 1 + px * 4;
      raw[i] = a ? r / a : 0; raw[i + 1] = a ? g / a : 0; raw[i + 2] = a ? b / a : 0; raw[i + 3] = (a / (SS * SS)) * 255;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** Vector favicon: no holes (only noise at tab size); stroke sized for ~32 px. */
function svg() {
  const S = 100, f = (n) => +(n * S).toFixed(2);
  const sw = f(Math.max(G.stroke, G.minStrokePx / 32)), a = f(G.from), b = f(G.to);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}"><title>XStitch.Design</title>` +
    `<rect width="${S}" height="${S}" rx="${f(G.tileRadius)}" fill="${tile.background}"/>` +
    `<g stroke-width="${sw}" stroke-linecap="round"><line x1="${a}" y1="${a}" x2="${b}" y2="${b}" stroke="${tile.under}"/>` +
    `<line x1="${a}" y1="${b}" x2="${b}" y2="${a}" stroke="${tile.over}"/></g></svg>\n`;
}

const jobs = [
  ['favicon-32.png', 32, { rounded: true }],
  ['apple-touch-icon.png', 180, { rounded: false, scale: 0.92 }],
  ['icon-192.png', 192, { rounded: true }],
  ['icon-512.png', 512, { rounded: true }],
  ['icon-maskable-512.png', 512, { rounded: false, scale: 0.78 }],
];
for (const [name, size, opts] of jobs) {
  const buf = png(size, opts);
  writeFileSync(new URL(name, OUT), buf);
  console.log(`${name.padEnd(24)} ${size}px  ${buf.length} bytes`);
}
writeFileSync(new URL('logo.svg', OUT), svg());
console.log('logo.svg');
