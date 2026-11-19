// Shared by api/p.js (link-preview page) and api/og.js (preview image). Files starting with "_" are not
// turned into functions by Vercel. Plain JS + Node built-ins only, so there's nothing to install or compile.
import zlib from 'node:zlib';

// Same public values as .env.production (the publishable key is meant for browsers; row-level security
// only lets it read published posts). Environment variables override them if set in Vercel.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://pokdpqxnwrotzcokrkah.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'sb_publishable_-rIX4lDj5gODo8PjY6GTeA_-m0Ve_n-';

export const SITE = 'https://stitch-by-style.vercel.app';

/** Post ids are short lowercase hex (see 0003_community.sql); anything else is rejected before any request. */
export const validId = (id) => typeof id === 'string' && /^[a-z0-9]{6,32}$/.test(id);

/** A published post, or null. */
export async function fetchPost(id) {
  if (!validId(id)) return null;
  const q = new URLSearchParams({
    id: `eq.${id}`,
    status: 'eq.published',
    select: 'id,title,description,base,difficulty,colors,stitches,template_name,updated_at,data,creators(display_name)',
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/posts?${q}`, { headers: { apikey: SUPABASE_KEY, Accept: 'application/json' } });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] ?? null;
}

/** encodeShare() data (deflate-raw + base64url JSON, src/lib/share.ts) → the parts needed to draw it. */
export function decodePattern(data) {
  const bytes = Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const raw = JSON.parse(zlib.inflateRawSync(bytes).toString('utf8'));
  const cells = typeof raw.c === 'string'
    ? Array.from(raw.c, (ch) => (ch === '.' ? -1 : ch.charCodeAt(0) - 48))
    : raw.cells;
  return {
    cols: raw.cols, rows: raw.rows, mask: raw.mask, cells,
    colors: (raw.palette ?? []).map((t) => hexToRgb(t.hex)),
  };
}

function hexToRgb(hex) {
  const n = parseInt(String(hex).replace('#', '').slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------- drawing ----------

const W = 1200, H = 630;
const BG = [244, 239, 228], FABRIC = [253, 252, 248], FRAME = [220, 213, 198], HOLE = [196, 188, 172];
const NAVY = [36, 59, 107], GOLD = [242, 179, 61];

/** 1200×630 RGB picture of the pattern in cross stitches, for link previews. Null pattern = brand card. */
export function renderPreview(p) {
  const px = new Uint8Array(W * H * 3);
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
  };
  const fill = (x0, y0, w, h, c) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x, y, c);
  };
  fill(0, 0, W, H, BG);
  fill(0, H - 14, W, 14, NAVY); // brand strip
  fill(0, H - 14, 180, 14, GOLD);
  if (!p) return px;

  // fit the pattern into the card, leaving room around it
  const s = Math.max(2, Math.min(Math.floor(1080 / p.cols), Math.floor(540 / p.rows), 30));
  const pw = p.cols * s, ph = p.rows * s;
  const ox = Math.floor((W - pw) / 2), oy = Math.floor((H - 14 - ph) / 2);
  const aida = !p.mask.includes('1') && !p.mask.includes('0');
  if (aida) fill(ox - s, oy - s, pw + 2 * s, ph + 2 * s, FABRIC);
  const t = Math.max(1, Math.round(s * 0.17)); // stitch thickness

  for (let y = 0; y < p.rows; y++) {
    for (let x = 0; x < p.cols; x++) {
      const k = p.mask[y * p.cols + x], v = p.cells[y * p.cols + x];
      const cx = ox + x * s, cy = oy + y * s;
      if (k === '0') continue;
      if (k === '1') { fill(cx, cy, s, s, FRAME); continue; }
      const base = aida ? FABRIC : FRAME;
      if (v < 0 || !p.colors[v]) {
        fill(cx, cy, s, s, base);
        if (!aida) fill(cx + Math.floor(s / 4), cy + Math.floor(s / 4), Math.ceil(s / 2), Math.ceil(s / 2), HOLE);
        continue;
      }
      // the under-stitch only slightly darker, so white thread still reads as white
      const c = p.colors[v], dark = c.map((n) => Math.round(n * 0.9));
      if (s < 6) { fill(cx, cy, s, s, c); continue; }
      // a cross stitch: two diagonals, the top one slightly lighter
      for (let dy = 0; dy < s; dy++) {
        for (let dx = 0; dx < s; dx++) {
          const a = Math.abs(dx - dy) <= t, b = Math.abs(dx + dy - (s - 1)) <= t;
          put(cx + dx, cy + dy, b ? c : a ? dark : base);
        }
      }
    }
  }
  return px;
}

// ---------- PNG (RGB, 8-bit) ----------

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

export function encodePng(px, w = W, h = H) {
  const rows = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    rows[y * (w * 3 + 1)] = 0; // filter: none
    Buffer.from(px.buffer, px.byteOffset + y * w * 3, w * 3).copy(rows, y * (w * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(rows, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
