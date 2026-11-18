// Regenerates every app icon from src/brand/logo-grid.json (no dependencies).
//   npm run icons
// Writes public/icons/: logo.svg (favicon), favicon-32.png, apple-touch-icon.png,
// icon-192.png, icon-512.png, icon-maskable-512.png
// Keep the drawing in step with src/components/LogoMark.tsx.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';

const logo = JSON.parse(readFileSync(new URL('../src/brand/logo-grid.json', import.meta.url), 'utf8'));
const { grid, colors, geometry: G, needle: N, thread: T } = logo;
const ROWS = grid.length;
const OUT = new URL('../public/icons/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const C = Object.fromEntries(Object.entries(colors).map(([k, v]) => [k, hex(v)]));
const mix = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);

/**
 * Geometry in design space (the 1x1 tile). `px` is the rendered size, used for minimum stroke
 * widths. `scale` shrinks the drawing toward the centre (full-bleed icons keep it in the safe zone).
 */
function layout({ rounded, scale = 1, holes = true, px }) {
  const cell = G.span / ROWS;
  const cx = (q) => G.x0 + (q + 0.5) * cell, cy = (r) => G.y0 + (r + 0.5) * cell;
  const p = cell * G.stitchHalf;
  const sw = Math.max(cell * G.stitchWidth, G.minStrokePx / (px * scale));
  const stitches = new Set();
  grid.forEach((row, r) => [...row].forEach((ch, q) => { if (ch === '#') stitches.add(`${q},${r}`); }));
  const [hq, hr] = N.stitch;
  const tip = [cx(hq) + p, cy(hr) + p], from = [cx(hq) - p, cy(hr) - p];
  const cos = Math.cos(N.angle), sin = Math.sin(N.angle), L = N.length, w = Math.max(N.halfWidth, N.minHalfWidthPx / (px * scale));
  const eye = [tip[0] + cos * L * N.eyeAt, tip[1] + sin * L * N.eyeAt];
  // thread: cubic bezier flattened to a polyline
  const b = [from, [from[0] + T.c1[0], from[1] + T.c1[1]], [eye[0] + T.c2[0], eye[1] + T.c2[1]], eye];
  const thread = Array.from({ length: 41 }, (_, i) => {
    const t = i / 40, s = 1 - t;
    return [0, 1].map((d) => s * s * s * b[0][d] + 3 * s * s * t * b[1][d] + 3 * s * t * t * b[2][d] + t * t * t * b[3][d]);
  });
  // needle outline in local (along, across) coordinates, tip at the origin
  const tl = L * N.taper, k = tl * 0.4, side = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, s = 1 - t;
    side.push([2 * s * t * k + t * t * tl, 2 * s * t * (-0.75 * w) + t * t * -w]);
  }
  const outline = [...side, [1.2 * L, -w], [1.2 * L, w], ...side.reverse().map(([a, c]) => [a, -c])];
  return {
    rounded, scale, holes, cell, cx, cy, p, sw, stitches, half: `${hq},${hr}`,
    tip, cos, sin, L, w, thread, outline, pierce: Math.max(cell * N.pierceRadius, 0.7 / (px * scale)),
  };
}

const segDist = (px, py, ax, ay, bx, by) => {
  const vx = bx - ax, vy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - ax - t * vx, py - ay - t * vy);
};
const inRoundRect = (u, v, r) => {
  const dx = Math.max(r - u, 0, u - (1 - r)), dy = Math.max(r - v, 0, v - (1 - r));
  return dx * dx + dy * dy <= r * r;
};
const inPoly = (x, y, poly) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/** Colour of one point in output unit space, or null when outside the tile. Top layer first. */
function sample(L, ou, ov) {
  if (L.rounded && !inRoundRect(ou, ov, G.tileRadius)) return null;
  const u = 0.5 + (ou - 0.5) / L.scale, v = 0.5 + (ov - 0.5) / L.scale;
  const half = L.sw / 2;
  if (Math.hypot(u - L.tip[0], v - L.tip[1]) <= L.pierce) return C.pierce;
  // needle, in local coordinates
  const du = u - L.tip[0], dv = v - L.tip[1];
  const a = du * L.cos + dv * L.sin, n = -du * L.sin + dv * L.cos;
  if (inPoly(a, n, L.outline)) {
    const ea = L.L * N.eyeAt;
    if (((a - ea) / (L.L * N.eyeHalfLength)) ** 2 + (n / (L.w * N.eyeHalfWidth)) ** 2 <= 1) {
      return segDist(a, n, ea, -L.w * 0.3, ea, L.w * 0.3) <= half ? C.over : C.tile;
    }
    const f = (n + L.w) / (2 * L.w);
    return f < 0.4 ? mix(C.needleLight, C.needleMid, f / 0.4) : mix(C.needleMid, C.needleDark, (f - 0.4) / 0.6);
  }
  for (let i = 1; i < L.thread.length; i++) {
    const [ax, ay] = L.thread[i - 1], [bx, by] = L.thread[i];
    if (segDist(u, v, ax, ay, bx, by) <= half) return C.over;
  }
  const q = Math.floor((u - G.x0) / L.cell), r = Math.floor((v - G.y0) / L.cell);
  let hit = null;
  for (let dq = -1; dq <= 1; dq++) for (let dr = -1; dr <= 1; dr++) {
    const key = `${q + dq},${r + dr}`;
    if (!L.stitches.has(key)) continue;
    const cx = L.cx(q + dq), cy = L.cy(r + dr);
    if (key !== L.half && segDist(u, v, cx - L.p, cy - L.p, cx + L.p, cy + L.p) <= half) return C.over;
    if (segDist(u, v, cx - L.p, cy + L.p, cx + L.p, cy - L.p) <= half) hit = C.under;
  }
  if (hit) return hit;
  if (L.holes && Math.hypot(u - L.cx(q), v - L.cy(r)) <= L.cell * G.holeRadius) return C.hole;
  return C.tile;
}

function png(size, opts) {
  const L = layout({ ...opts, holes: opts.holes ?? size >= 24, px: size });
  const SS = 4, stride = size * 4 + 1, raw = Buffer.alloc(stride * size);
  for (let py = 0; py < size; py++) {
    raw[py * stride] = 0; // filter: none
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = sample(L, (px + (sx + 0.5) / SS) / size, (py + (sy + 0.5) / SS) / size);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
      }
      const o = py * stride + 1 + px * 4;
      raw[o] = a ? r / a : 0; raw[o + 1] = a ? g / a : 0; raw[o + 2] = a ? b / a : 0; raw[o + 3] = (a / (SS * SS)) * 255;
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

/** Vector favicon: no hole grid (it is only noise at tab size); strokes sized for ~32 px. */
function svg() {
  const S = 100, L = layout({ rounded: true, holes: false, px: 32 });
  const f = (n) => +(n * S).toFixed(2);
  const lines = (over) => [...L.stitches].filter((k) => !over || k !== L.half).map((k) => {
    const [q, r] = k.split(',').map(Number);
    const cx = L.cx(q), cy = L.cy(r);
    return over
      ? `<line x1="${f(cx - L.p)}" y1="${f(cy - L.p)}" x2="${f(cx + L.p)}" y2="${f(cy + L.p)}"/>`
      : `<line x1="${f(cx - L.p)}" y1="${f(cy + L.p)}" x2="${f(cx + L.p)}" y2="${f(cy - L.p)}"/>`;
  }).join('');
  const thread = 'M' + L.thread.map(([x, y]) => `${f(x)} ${f(y)}`).join('L');
  const shaft = 'M' + L.outline.map(([a, n]) => `${f(a)} ${f(n)}`).join('L') + 'Z';
  const ea = f(L.L * N.eyeAt), w = f(L.w);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}"><title>Stitch by Style</title>` +
    `<defs><clipPath id="t"><rect width="${S}" height="${S}" rx="${f(G.tileRadius)}"/></clipPath>` +
    `<linearGradient id="n" gradientUnits="userSpaceOnUse" x1="0" y1="${-w}" x2="0" y2="${w}"><stop offset="0" stop-color="${colors.needleLight}"/><stop offset=".4" stop-color="${colors.needleMid}"/><stop offset="1" stop-color="${colors.needleDark}"/></linearGradient></defs>` +
    `<rect width="${S}" height="${S}" rx="${f(G.tileRadius)}" fill="${colors.tile}"/><g clip-path="url(#t)">` +
    `<g stroke-linecap="round" stroke-width="${f(L.sw)}" fill="none"><g stroke="${colors.under}">${lines(false)}</g><g stroke="${colors.over}">${lines(true)}</g><path stroke="${colors.over}" d="${thread}"/></g>` +
    `<g transform="translate(${f(L.tip[0])} ${f(L.tip[1])}) rotate(${+((N.angle * 180) / Math.PI).toFixed(3)})"><path fill="url(#n)" d="${shaft}"/>` +
    `<ellipse cx="${ea}" cy="0" rx="${f(L.L * N.eyeHalfLength)}" ry="${f(L.w * N.eyeHalfWidth)}" fill="${colors.tile}"/>` +
    `<line x1="${ea}" y1="${f(-L.w * 0.3)}" x2="${ea}" y2="${f(L.w * 0.3)}" stroke="${colors.over}" stroke-width="${f(L.sw)}" stroke-linecap="round"/></g>` +
    `<circle cx="${f(L.tip[0])}" cy="${f(L.tip[1])}" r="${f(L.pierce)}" fill="${colors.pierce}"/></g></svg>\n`;
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
