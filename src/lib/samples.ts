import type { Pattern, PatternDetails } from '../types';
import { createPattern } from './pattern';
import { TEMPLATES, freeMask } from './templates';
import { DMC_LIBRARY, makeThread } from './threads';
import { t } from './i18n';
import { APP_NAME } from './brand';

/**
 * Ready-made sample patterns for new users (seasonal: Christmas / New Year).
 * Fabric samples are hand-drawn pixel art ('.' = no stitch, other chars map to DMC codes);
 * 3D samples are drawn procedurally onto a template's stitch holes so they always fit its shape.
 */
export interface Sample {
  id: string;
  name: string;
  description: string;
  base: 'aida' | 'print3d';
  difficulty: PatternDetails['difficulty'];
  make: () => Pattern;
}

export type Legend = Record<string, string>; // char -> DMC code

function palette(legend: Legend) {
  const pal: Pattern['palette'] = [];
  const index: Record<string, number> = {};
  for (const [ch, code] of Object.entries(legend)) {
    const d = DMC_LIBRARY.find((x) => x.code === code)!;
    index[ch] = pal.length;
    pal.push(makeThread({ hex: d.hex, name: d.name, code: d.code, brand: 'DMC' }, pal));
  }
  return { pal, index };
}

const AUTHOR = APP_NAME;

export function fabric(o: { name: string; description: string; tags: string[]; difficulty: PatternDetails['difficulty']; art: string[]; legend: Legend }): Pattern {
  const m = 3; // empty fabric around the design
  const cols = o.art[0].length + m * 2, rows = o.art.length + m * 2;
  const p = createPattern({
    name: o.name, mode: 'free', cols, rows, mask: freeMask(cols, rows), pitchMm: +(25.4 / 14).toFixed(3),
    details: { baseType: 'aida', aidaCount: 14, needleSize: '#24', strands: 2, author: AUTHOR, description: o.description, tags: o.tags, difficulty: o.difficulty },
  });
  const { pal, index } = palette(o.legend);
  p.palette = pal;
  o.art.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') p.cells[(y + m) * cols + x + m] = index[ch];
  }));
  return p;
}

/** A stitch hole: its depth from the frame (1 = next to it), offset from the stitch area's centre, and position inside the area's bounding box. */
export interface Cell { x: number; y: number; d: number; dx: number; dy: number; bx: number; by: number; bw: number; bh: number }

/** Paint a template's stitch holes; `paint` returns a legend char or '.' for no stitch. */
export function onTemplate(o: { name: string; description: string; tags: string[]; difficulty: PatternDetails['difficulty']; template: string; w: number; h: number; legend: Legend; paint: (c: Cell, maxD: number) => string }): Pattern {
  const tpl = TEMPLATES.find((x) => x.id === o.template)!;
  const b = tpl.build(o.w, o.h);
  // a fixed model (Stitch Box lid) brings its own pitch, thickness and hole size
  const m = tpl.model;
  const pitch = m ? m.pitchMm : 3;
  const p = createPattern({
    name: o.name, mode: 'template', templateId: tpl.id, templateName: tpl.name, cols: b.cols, rows: b.rows, mask: b.mask, pitchMm: pitch,
    details: {
      baseType: 'print3d', strands: 4, needleSize: '#22', author: AUTHOR, description: o.description, tags: o.tags, difficulty: o.difficulty,
      ...(m ? { thicknessMm: m.thicknessMm, holeRatio: m.holeRatio } : {}),
    },
  });
  const { pal, index } = palette(o.legend);
  p.palette = pal;
  const n = b.cols * b.rows;
  const depth = new Int32Array(n).fill(1e9);
  const queue: number[] = [];
  for (let i = 0; i < n; i++) if (b.mask[i] !== '2') { depth[i] = 0; queue.push(i); }
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q], x = i % b.cols, y = (i / b.cols) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= b.cols || ny >= b.rows) continue;
      const j = ny * b.cols + nx;
      if (depth[j] > depth[i] + 1) { depth[j] = depth[i] + 1; queue.push(j); }
    }
  }
  let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, maxD = 0;
  for (let i = 0; i < n; i++) if (b.mask[i] === '2') {
    const x = i % b.cols, y = (i / b.cols) | 0;
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    maxD = Math.max(maxD, depth[i]);
  }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  for (let i = 0; i < n; i++) {
    if (b.mask[i] !== '2') continue;
    const x = i % b.cols, y = (i / b.cols) | 0;
    const ch = o.paint({ x, y, d: depth[i], dx: x - cx, dy: y - cy, bx: x - x0, by: y - y0, bw: x1 - x0 + 1, bh: y1 - y0 + 1 }, maxD);
    if (ch !== '.') p.cells[i] = index[ch];
  }
  return p;
}

const GLYPHS: Record<string, string[]> = {
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
};

const XMAS = () => [t('คริสต์มาส', 'Christmas')];
const NEWYEAR = () => [t('ปีใหม่', 'New Year')];

export const SAMPLES: Sample[] = [
  {
    id: 'xmas-tree', base: 'aida', difficulty: 'easy',
    name: t('ต้นคริสต์มาส', 'Christmas tree'),
    description: t('ต้นสนสามชั้นประดับลูกบอลและดาว ปักง่าย สีไม่เยอะ', 'A three-tier tree with baubles and a star. Few colors, easy to stitch.'),
    make() {
      return fabric({ name: this.name, description: this.description, tags: XMAS(), difficulty: this.difficulty, legend: { g: '702', G: '699', Y: '726', R: '321', B: '798', T: '433' },
        art: [
      '..........Y..........',
      '.........YYY.........',
      '.......YYYYYYY.......',
      '........YYYYY........',
      '........YY.YY........',
      '.........ggG.........',
      '........gggGG........',
      '.......ggRgGGG.......',
      '......gggggGGGG......',
      '.....ggggggGGBGG.....',
      '.......ggggGGG.......',
      '......ggYggGGGG......',
      '.....ggggggGRGGG.....',
      '....ggggggYGGGGGG....',
      '...ggBgggggGGGGGGG...',
      '..gggggggggGGGGRGGG..',
      '.....ggggggGGGBG.....',
      '....gggggRgGGGGGG....',
      '...ggggggggGGYGGGG...',
      '..ggggYggggGGGGGGGG..',
      '.ggggggggggBGGGGGGGG.',
      'gggRgggggggGGGGGGYGGG',
      '.........TTT.........',
      '.........TTT.........',
      '......RRRRRRRRR......',
      '.......RRRRRRR.......',
    ] });
    },
  },
  {
    id: 'snowman', base: 'aida', difficulty: 'medium',
    name: t('ตุ๊กตาหิมะ', 'Snowman'),
    description: t('ตุ๊กตาหิมะสวมหมวกและผ้าพันคอ มีเงาสีฟ้าอ่อนให้ดูมีมิติ', 'A snowman in a hat and scarf, with soft blue shading.'),
    make() {
      return fabric({ name: this.name, description: this.description, tags: XMAS(), difficulty: this.difficulty, legend: { W: 'B5200', S: '3752', O: '932', K: '310', R: '321', N: '740', T: '434' },
        art: [
      '......KKKKKKK......',
      '......KKKKKKK......',
      '......KKKKKKK......',
      '......RRRRRRR......',
      '.....KKKKKKKKK.....',
      '......OOWWWOO......',
      '.....OOWWWWWOO.....',
      '.....OWWKWKWWO.....',
      '.....OWWWWNNWO.....',
      '.....OWWWWWWSO.....',
      '.....OOWKKKSOO.....',
      '......OOWWSOO......',
      'TT...RRRRRRRRR...TT',
      '.T...OOWWWWWRR...T.',
      '..T.OOWWWWWWROO.T..',
      '...TOWWWWKWRRWOT...',
      '...OWWWWWWWWWWWO...',
      '...OWWWWWWWWWWWO...',
      '...OWWWWWKWWWWSO...',
      '...OWWWWWWWWWSSO...',
      '....OWWWWWWWSSO....',
      '....OOWWWKWSSOO....',
      '.....OOWWWSSOO.....',
      '......OOOOOOO......',
    ] });
    },
  },
  {
    id: 'gingerbread', base: 'aida', difficulty: 'easy',
    name: t('คุกกี้ขิง', 'Gingerbread man'),
    description: t('คุกกี้ขิงตัวน้อยแต่งไอซิ่ง ลายเล็ก ปักเสร็จได้ในวันเดียว', 'A little iced gingerbread man. Small enough to finish in a day.'),
    make() {
      return fabric({ name: this.name, description: this.description, tags: XMAS(), difficulty: this.difficulty, legend: { C: '976', W: 'B5200', K: '310', R: '321', G: '699' },
        art: [
      '.......CCC.......',
      '......CCCCC......',
      '.....CCKCKCC.....',
      '.....CCCCCCC.....',
      '.....CWCCCWC.....',
      '......CWWWC......',
      '.......CCC.......',
      '.....CCCCCCC.....',
      '..CCCCCCCCCCCCC..',
      '.WCCCCCCRCCCCCCW.',
      '.WCCCCCCCCCCCCCW.',
      '.....CCCCCCC.....',
      '.....CCCGCCC.....',
      '.....CCCCCCC.....',
      '.....CCCRCCC.....',
      '.....CCC.CCC.....',
      '....CCC...CCC....',
      '....WWW...WWW....',
      '...CCCC...CCCC...',
      '...CCC.....CCC...',
    ] });
    },
  },
  {
    id: 'newyear-2027', base: 'aida', difficulty: 'easy',
    name: t('สวัสดีปีใหม่ 2027', 'Happy 2027'),
    description: t('ตัวเลข 2027 กับพลุหลากสี ต้อนรับปีใหม่', 'The year 2027 under colorful fireworks.'),
    make() {
      return fabric({ name: this.name, description: this.description, tags: NEWYEAR(), difficulty: this.difficulty, legend: { A: '725', Y: '726', R: '321', B: '798' },
        art: [
      '..............Y..............',
      '.Y.....R.............B....Y..',
      '...R...R...RY.Y.Y.B..B..B....',
      '....R..R..R........B.B.B.....',
      '.....R.R.R....Y..............',
      '.................BBB.Y.BBB...',
      '..RRRR.Y.RRRR................',
      '...................B.B.B.....',
      '.....R.R.R........B..B..B....',
      '....R..R..R.Y........B.......',
      '...R...R...R.....Y...........',
      '.......R..................Y..',
      '..Y..........................',
      '.............................',
      '....AAA...AAA...AAA..AAAAA...',
      '...A...A.A...A.A...A.....A...',
      '.......A.A..AA.....A....A....',
      '......A..A.A.A....A....A.....',
      '.....A...AA..A...A....A......',
      '....A....A...A..A.....A......',
      '...AAAAA..AAA..AAAAA..A......',
      '.............................',
      '...R.R.R.R.R.R.R.R.R.R.R.R...',
    ] });
    },
  },
  {
    id: 'star-ornament', base: 'print3d', difficulty: 'easy',
    name: t('ดาวแขวนต้นคริสต์มาส', 'Star tree ornament'),
    description: t('ดาวสีทองไล่สามโทนจากขอบเข้าหาใจกลาง พิมพ์แม่แบบดาวแล้วปักแขวนต้นคริสต์มาส', 'A gold star in three shades from edge to centre. Print the star template and hang it on the tree.'),
    make() {
      return onTemplate({ name: this.name, description: this.description, tags: XMAS(), difficulty: this.difficulty, template: 'ornament-star', w: 28, h: 31,
        legend: { A: '783', B: '725', Y: '726' },
        paint: (c) => (c.d === 1 ? 'A' : c.d === 2 ? 'B' : 'Y') });
    },
  },
  {
    id: 'snowflake-keychain', base: 'print3d', difficulty: 'easy',
    name: t('พวงกุญแจเกล็ดหิมะ', 'Snowflake keychain'),
    description: t('เกล็ดหิมะสีขาวบนพื้นกรมท่า บนแม่แบบพวงกุญแจกลม', 'A white snowflake on navy, on the round keychain template.'),
    make() {
      // 8 arms with small side branches
      const flake = (dx: number, dy: number) => {
        const ax = Math.abs(dx), ay = Math.abs(dy), r = Math.max(ax, ay);
        if (r <= 6 && (ax === 0 || ay === 0 || ax === ay)) return true;
        // branches on the straight arms at distance 4: (±1, 5) and (±1, 3) style forks
        const [along, across] = ax === 0 || ay > ax ? [ay, ax] : [ax, ay];
        if (across === 1 && (along === 5 || along === 3) && r <= 5) return (ax === 0 || ay === 0 || ax === 1 || ay === 1);
        return false;
      };
      return onTemplate({ name: this.name, description: this.description, tags: XMAS(), difficulty: this.difficulty, template: 'keychain-round', w: 21, h: 24,
        legend: { N: '823', W: 'B5200', L: '3755' },
        paint: (c) => {
          const x = Math.round(c.dx), y = Math.round(c.dy);
          if (flake(x, y)) return Math.max(Math.abs(x), Math.abs(y)) === 6 ? 'L' : 'W';
          return 'N';
        } });
    },
  },
  {
    id: 'wreath-coaster', base: 'print3d', difficulty: 'medium',
    name: t('ที่รองแก้วพวงหรีด', 'Wreath coaster'),
    description: t('พวงหรีดใบสนสามเฉดพร้อมผลเบอร์รีและโบว์แดง บนที่รองแก้วกลม', 'A three-green wreath with berries and a red bow, on the round coaster.'),
    make() {
      return onTemplate({ name: this.name, description: this.description, tags: XMAS(), difficulty: this.difficulty, template: 'coaster-round', w: 31, h: 31,
        legend: { g: '702', G: '699', E: '909', R: '321', r: '666' },
        paint: (c) => {
          const x = Math.round(c.dx), y = Math.round(c.dy), rad = Math.hypot(x, y);
          // red bow over the bottom of the ring
          const bow = ['RR...RR', 'RRR.RRR', '.RRrRR.', 'RRR.RRR', 'RR...RR', '..R.R..', '.R...R.'];
          const bxx = x + 3, byy = y - 7;
          if (byy >= 0 && byy < bow.length && bxx >= 0 && bxx < 7 && bow[byy][bxx] !== '.') return bow[byy][bxx];
          if (rad < 6.5 || rad > 11.5) return '.';
          // berry clusters of three, each with one bright berry
          for (const a of [-2.5, -1.57, -0.64, 0.35, 2.8]) {
            const cx = Math.round(Math.cos(a) * 9), cy = Math.round(Math.sin(a) * 9);
            if (x === cx && y === cy) return 'r';
            if ((x === cx + 1 && y === cy) || (x === cx && y === cy + 1)) return 'R';
          }
          if (rad > 10.5 || rad < 7.5) return 'E';
          return (x + 2 * y) % 3 === 0 ? 'G' : 'g';
        } });
    },
  },
  {
    id: 'bookmark-2027', base: 'print3d', difficulty: 'easy',
    name: t('ที่คั่นหนังสือ 2027', '2027 bookmark'),
    description: t('ตัวเลข 2027 สีทองบนพื้นกรมท่า ประกายดาวรอบๆ ของขวัญปีใหม่', 'Gold 2027 on navy with little sparkles. A New Year gift.'),
    make() {
      const digits = '2027';
      return onTemplate({ name: this.name, description: this.description, tags: NEWYEAR(), difficulty: this.difficulty, template: 'bookmark', w: 12, h: 42,
        legend: { N: '823', A: '725', Y: '726' },
        paint: (c) => {
          // 4 glyphs of 7 rows with gaps of 2 = 34 rows, centred in the stitch area
          const glyph = (bx: number, by: number) => {
            const gx = bx - Math.floor((c.bw - 5) / 2), gyAll = by - Math.floor((c.bh - 34) / 2);
            const gi = Math.floor(gyAll / 9), gy = gyAll - gi * 9;
            return gi >= 0 && gi < 4 && gy < 7 && gx >= 0 && gx < 5 && GLYPHS[digits[gi]][gy][gx] === '#';
          };
          if (glyph(c.bx, c.by)) return 'A';
          // sparkles, kept clear of the digits
          let near = false;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) near ||= glyph(c.bx + dx, c.by + dy);
          return !near && (c.x * 5 + c.y * 3) % 17 === 0 ? 'Y' : 'N';
        } });
    },
  },
];
