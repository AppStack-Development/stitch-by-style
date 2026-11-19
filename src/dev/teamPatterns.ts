import type { Pattern } from '../types';
import { fabric, onTemplate, type Legend } from '../lib/samples';

/**
 * Patterns the Stitch by Style team shares in the community gallery (not seasonal, unlike lib/samples.ts).
 * Not part of the app bundle: nothing imports this file. To preview or publish, in the dev server's
 * browser console while signed in with the team account:
 *   const m = await import('/src/dev/teamPatterns.ts'); await m.publishTeamPatterns();
 * Publishing skips titles the team account has already shared.
 */

export interface TeamPattern {
  title: string;
  description: string;
  tags: string[]; // community categories (lib/community.ts TAGS)
  make: () => Pattern;
}

/** A tiny pixel canvas for building fabric art from shapes instead of typing every row. */
class Grid {
  px: string[][];
  constructor(public w: number, public h: number) {
    this.px = Array.from({ length: h }, () => Array(w).fill('.'));
  }
  set(x: number, y: number, c: string) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y][x] = c;
  }
  each(test: (x: number, y: number) => boolean, c: string) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (test(x, y)) this.set(x, y, c);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, c: string, deg = 0) {
    const a = (deg * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a);
    this.each((x, y) => {
      const u = (x - cx) * cos + (y - cy) * sin, v = -(x - cx) * sin + (y - cy) * cos;
      return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
    }, c);
  }
  poly(pts: [number, number][], c: string) {
    this.each((x, y) => {
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    }, c);
  }
  dots(list: [number, number][], c: string) {
    for (const [x, y] of list) this.set(x, y, c);
  }
  rows() {
    return this.px.map((r) => r.join(''));
  }
}

const art = (o: { title: string; description: string; difficulty: 'easy' | 'medium' | 'hard'; legend: Legend; draw: (g: Grid) => void; w: number; h: number }) => () => {
  const g = new Grid(o.w, o.h);
  o.draw(g);
  return fabric({ name: o.title, description: o.description, tags: [], difficulty: o.difficulty, legend: o.legend, art: g.rows() });
};

const GLYPH: Record<string, string[]> = {
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
};

const CAT = { title: 'แมวส้มหลับปุ๋ย', description: 'แมวส้มนั่งหลับตาพริ้ม อกขาว หางขดอยู่ข้างตัว ปักบนผ้า Aida 14 ct ขนาดราว 6×5 ซม.' };
const SUN = { title: 'ดอกทานตะวัน', description: 'ทานตะวันกลีบสองเฉดกับใบเขียวคู่ ปักบนผ้า Aida เหมาะใส่สะดึงขนาด 10 ซม.' };
const TEA = { title: 'ชานมไข่มุกยิ้มแฉ่ง', description: 'แก้วชานมไข่มุกหน้ายิ้มกับหลอดสีชมพู ลายเล็ก สีไม่เยอะ ปักเสร็จได้ในวันเดียว' };
const LOVE = { title: 'LOVE หัวใจแดง', description: 'ตัวอักษร LOVE ใต้หัวใจสีแดง ปักง่าย เหมาะเป็นของขวัญหรือการ์ดวันเกิด' };
const HEART = { title: 'พวงกุญแจหัวใจหวาน', description: 'หัวใจไล่สีชมพูสามเฉดจากขอบเข้าหาใจกลาง มีประกายสีขาว บนแม่แบบพวงกุญแจหัวใจ' };
const PICNIC = { title: 'ที่รองแก้วลายผ้าปิกนิก', description: 'ลายตารางกิงแฮมสีแดงขาวแบบผ้าปูปิกนิก บนที่รองแก้วสี่เหลี่ยม ปักได้เพลินๆ' };
const FLOWER = { title: 'เข็มกลัดดอกไม้หกกลีบ', description: 'ดอกไม้สีชมพูหกกลีบเกสรเหลือง บนพื้นครีม ขอบเขียวใบไม้ บนแม่แบบเข็มกลัดหกเหลี่ยม' };
const VINE = { title: 'ที่คั่นหนังสือเถาใบไม้', description: 'เถาไม้เลื้อยสีเขียวพร้อมใบสองเฉดไล่ลงมาตามที่คั่นหนังสือ บนพื้นสีครีม' };

export const TEAM_PATTERNS: TeamPattern[] = [
  {
    ...CAT, tags: ['animals', 'cute'],
    make: art({
      ...CAT, difficulty: 'medium', w: 27, h: 23,
      legend: { O: '3853', D: '920', W: 'B5200', P: '3716', K: '3371', Z: '3755' },
      draw: (g) => {
        g.ellipse(21, 20.5, 4.2, 1.6, 'O'); // tail curled at the side
        g.dots([[24, 20], [25, 20], [24, 21]], 'D');
        g.ellipse(13, 16, 11, 6.2, 'O'); // body
        g.dots([[4, 14], [5, 15], [4, 16], [22, 14], [21, 15], [22, 16]], 'D');
        g.poly([[3.5, -0.5], [3.5, 9], [10.5, 4]], 'O'); // pointed ears, running down into the cheeks
        g.poly([[22.5, -0.5], [22.5, 9], [15.5, 4]], 'O');
        g.ellipse(13, 9.2, 8.4, 6.2, 'O'); // head
        g.poly([[4.5, 1.5], [4.5, 5.8], [8.2, 4]], 'P');
        g.poly([[21.5, 1.5], [21.5, 5.8], [17.8, 4]], 'P');
        g.dots([[11, 3], [11, 4], [13, 3], [13, 4], [13, 5], [15, 3], [15, 4]], 'D'); // forehead stripes
        g.ellipse(13, 17.5, 3.6, 3.2, 'W'); // white chest
        g.ellipse(13, 12, 3.6, 1.9, 'W'); // muzzle
        g.dots([[12, 11], [13, 11], [14, 11]], 'P'); // nose
        g.dots([[11, 12], [13, 12], [15, 12], [12, 13], [14, 13]], 'K'); // ω mouth
        g.dots([[9, 9], [10, 9], [8, 10], [11, 10], [16, 9], [17, 9], [15, 10], [18, 10]], 'K'); // closed happy eyes ^^
        g.dots([[7, 12], [19, 12]], 'P'); // blush
        g.ellipse(9, 21.3, 2.2, 1.1, 'W'); // paws
        g.ellipse(17, 21.3, 2.2, 1.1, 'W');
        g.dots([[24, 0], [25, 0], [26, 0], [26, 1], [25, 2], [24, 3], [24, 4], [25, 4], [26, 4]], 'Z'); // Z, clear of the ear
      },
    }),
  },
  {
    ...SUN, tags: ['flowers'],
    make: art({
      ...SUN, difficulty: 'medium', w: 25, h: 32,
      legend: { Y: '973', y: '444', B: '801', b: '433', G: '3347', L: '989', l: '986' },
      draw: (g) => {
        g.each((x, y) => x >= 12 && x <= 13 && y >= 17 && y <= 31, 'G'); // stem
        g.ellipse(7.5, 24, 4.2, 1.8, 'L', -30); // leaves
        g.ellipse(18, 27, 4.2, 1.8, 'L', 30);
        g.dots([[6, 25], [7, 24], [8, 24], [9, 23], [17, 27], [18, 27], [19, 28]], 'l');
        const cx = 12.5, cy = 9.5;
        g.each((x, y) => {
          const r = Math.hypot(x - cx, y - cy), th = Math.atan2(y - cy, x - cx);
          return r <= 6 + 3 * Math.abs(Math.cos(6 * th));
        }, 'Y');
        g.each((x, y) => Math.hypot(x - cx, y - cy) <= 5.6, 'y');
        g.each((x, y) => Math.hypot(x - cx, y - cy) <= 4.3, 'B');
        g.each((x, y) => Math.hypot(x - cx, y - cy) <= 3.2 && (x + y) % 2 === 0, 'b');
      },
    }),
  },
  {
    ...TEA, tags: ['food', 'cute'],
    make: art({
      ...TEA, difficulty: 'easy', w: 18, h: 29,
      legend: { T: '3864', K: '3371', L: '762', l: '415', S: '3608', P: '3716' },
      draw: (g) => {
        g.poly([[1.5, 8.5], [16.5, 8.5], [14, 28.5], [3, 28.5]], 'T'); // cup
        for (const [x, y] of [[5, 26], [8, 27], [11, 26], [6, 23], [9, 24], [12, 23], [4, 24], [13, 25]] as [number, number][]) {
          g.dots([[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]], 'K'); // pearls
        }
        g.ellipse(8.5, 6.6, 7.6, 2.4, 'L'); // lid
        g.each((x, y) => y >= 7 && y <= 8 && x >= 1 && x <= 16, 'l');
        g.dots([[11, 0], [12, 0], [11, 1], [12, 1], [10, 2], [11, 2], [10, 3], [11, 3], [10, 4], [11, 4]], 'S'); // straw
        g.dots([[6, 14], [6, 15], [11, 14], [11, 15]], 'K'); // eyes
        g.dots([[8, 17], [9, 17], [7, 16], [10, 16]], 'K'); // smile
        g.dots([[4, 16], [13, 16]], 'P'); // blush
      },
    }),
  },
  {
    ...LOVE, tags: ['letters'],
    make: art({
      ...LOVE, difficulty: 'easy', w: 23, h: 17,
      legend: { R: '321', W: 'B5200', N: '823' },
      draw: (g) => {
        const heart = ['.##...##.', '####.####', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....'];
        heart.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === '#') g.set(x + 7, y, 'R'); }));
        g.set(8, 1, 'W');
        [...'LOVE'].forEach((ch, i) => GLYPH[ch].forEach((row, y) => [...row].forEach((p, x) => { if (p === '#') g.set(i * 6 + x, y + 10, 'N'); })));
      },
    }),
  },
  {
    ...HEART, tags: ['cute'],
    make: () => onTemplate({ name: HEART.title, description: HEART.description, tags: [], difficulty: 'easy',
      template: 'keychain-heart', w: 22, h: 24, legend: { A: '335', B: '3326', C: '761', W: 'B5200' },
      paint: (c) => {
        const x = Math.round(c.dx), y = Math.round(c.dy);
        if ((x === -4 && y === -3) || (x === -3 && y === -4) || (x === -4 && y === -4)) return 'W';
        return c.d === 1 ? 'A' : c.d === 2 ? 'B' : 'C';
      } }),
  },
  {
    ...PICNIC, tags: ['geometric'],
    make: () => onTemplate({ name: PICNIC.title, description: PICNIC.description, tags: [], difficulty: 'easy',
      template: 'coaster-square', w: 30, h: 30, legend: { R: '321', P: '3712', W: 'B5200' },
      paint: (c) => {
        const a = Math.floor(c.bx / 3) % 2 === 0, b = Math.floor(c.by / 3) % 2 === 0;
        return a && b ? 'R' : a || b ? 'P' : 'W';
      } }),
  },
  {
    ...FLOWER, tags: ['flowers', 'cute'],
    make: () => onTemplate({ name: FLOWER.title, description: FLOWER.description, tags: [], difficulty: 'easy',
      template: 'badge-hex', w: 24, h: 22, legend: { G: '989', C: '3865', P: '3326', p: '335', Y: '725' },
      paint: (c) => {
        if (c.d === 1) return 'G';
        const x = c.dx, y = c.dy;
        if (Math.hypot(x, y) <= 1.8) return 'Y';
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3 - Math.PI / 2, pr = Math.hypot(x - Math.cos(a) * 4, y - Math.sin(a) * 4);
          if (pr <= 1.2) return 'p';
          if (pr <= 2.6) return 'P';
        }
        return 'C';
      } }),
  },
  {
    ...VINE, tags: ['flowers', 'geometric'],
    make: () => onTemplate({ name: VINE.title, description: VINE.description, tags: [], difficulty: 'easy',
      template: 'bookmark', w: 12, h: 40, legend: { E: 'Ecru', S: '3347', L: '989', l: '986' },
      paint: (c) => {
        const mid = (c.bw - 1) / 2;
        // a gentle wave, one column at a time so the stem stays connected
        const vine = (by: number) => Math.round(mid + 1.4 * Math.sin(by / 4));
        if (c.bx === vine(c.by)) return 'S';
        // a leaf every 5 rows, on alternating sides, pointing up and away from the stem:
        //   . L L      (row above)
        //   L l .      (row of the stem joint; l = midrib)
        const k = Math.round(c.by / 5), ly = k * 5, side = k % 2 === 0 ? 1 : -1;
        if (ly < 2 || ly > c.bh - 3) return 'E';
        const u = (c.bx - vine(ly)) * side, v = c.by - ly;
        if (v === 0 && u === 1) return 'L';
        if (v === 0 && u === 2) return 'l';
        if (v === -1 && (u === 2 || u === 3)) return 'L';
        if (v === -2 && u === 3) return 'L';
        return 'E';
      } }),
  },
];

/** Share every team pattern the team account hasn't shared yet. Returns what happened per title. */
export async function publishTeamPatterns(opts: { dryRun?: boolean } = {}) {
  const { client, getCloud } = await import('../lib/cloud');
  const { encodeShare } = await import('../lib/share');
  const { computeStats } = await import('../lib/stats');
  const u = getCloud().user;
  if (!u) throw new Error('sign in with the team account first');
  const c = await client();
  const { data: mine } = await c.from('posts').select('title').eq('author', u.id);
  const have = new Set((mine ?? []).map((r: { title: string }) => r.title));
  const out: { title: string; result: string }[] = [];
  // oldest first, so the first pattern in the list ends up newest in the gallery
  for (const tp of [...TEAM_PATTERNS].reverse()) {
    if (have.has(tp.title)) { out.push({ title: tp.title, result: 'already shared' }); continue; }
    const p = tp.make();
    const st = computeStats(p);
    const row = {
      author: u.id, title: tp.title, description: tp.description, tags: tp.tags,
      base: p.details.baseType === 'print3d' ? 'print3d' : 'aida', difficulty: p.details.difficulty,
      colors: st.colors.filter((x) => x.count > 0).length, stitches: st.total, cols: p.cols, rows: p.rows,
      template_name: p.templateName ?? null, data: await encodeShare(p),
    };
    if (opts.dryRun) { out.push({ title: tp.title, result: `ok (${row.colors} colors, ${row.stitches} stitches)` }); continue; }
    const { error } = await c.from('posts').insert(row);
    out.push({ title: tp.title, result: error ? `error: ${error.message}` : 'shared' });
    await new Promise((r) => setTimeout(r, 300));
  }
  return out;
}
