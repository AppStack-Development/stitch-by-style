/**
 * Seasonal banners for the home page. Each season repeats every year between two dates (month/day), so
 * a banner turns itself on and off without a code change. A window may cross the new year.
 */
export interface Season {
  id: string;
  /** first and last day shown, as [month, day] (1-based), inclusive */
  from: [number, number];
  to: [number, number];
  /** community category whose team designs fill the banner art */
  tag: string;
  title: [th: string, en: string];
  text: [th: string, en: string];
  /** primary link: the season's designs */
  href: string;
  cta: [th: string, en: string];
  /** secondary link: start one yourself */
  href2: string;
  cta2: [th: string, en: string];
}

export const SEASONS: Season[] = [
  {
    id: 'xmas',
    from: [11, 15],
    to: [1, 6],
    tag: 'festival',
    title: ['ลายคริสต์มาสบนกล่องปักลาย', 'Christmas designs for Stitch Box lids'],
    text: [
      'ฝากล่อง 7 แบบ แบบละ 3 ลาย จากทีม ลองปักเองหรือสั่งผลิตเป็นของขวัญปีใหม่',
      'Three designs for each of the 7 box lids, from the team. Stitch one yourself or order it as a holiday gift.',
    ],
    href: '#/community/festival',
    cta: ['ดูลายคริสต์มาส', 'See Christmas designs'],
    href2: '#/new/template',
    cta2: ['ออกแบบบนกล่องเอง', 'Design your own lid'],
  },
];

const md = (m: number, d: number) => m * 100 + d;

/** The season showing on this date, with a key for this year's run (so hiding it lasts until next year). */
export function currentSeason(now = new Date()): { season: Season; key: string } | null {
  const m = now.getMonth() + 1, today = md(m, now.getDate());
  for (const s of SEASONS) {
    const a = md(...s.from), b = md(...s.to);
    const inside = a <= b ? today >= a && today <= b : today >= a || today <= b;
    if (!inside) continue;
    // a run that crosses the new year belongs to the year it started in
    const year = a > b && today <= b ? now.getFullYear() - 1 : now.getFullYear();
    return { season: s, key: `${s.id}-${year}` };
  }
  return null;
}

const HIDDEN = 'sbs:season-hidden';

export function seasonHidden(key: string): boolean {
  try { return localStorage.getItem(HIDDEN) === key; } catch { return false; }
}

export function hideSeason(key: string) {
  try { localStorage.setItem(HIDDEN, key); } catch { /* it just shows again next visit */ }
}
