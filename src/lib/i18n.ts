/**
 * Thai / English UI text.
 *
 * The language is fixed for the life of the page: it is read once at startup (saved choice, else the
 * browser's language) and switching reloads the page. That keeps things simple: any string, including
 * module-level label tables, can be written as t('ไทย', 'English') and is always in the right language.
 */
export type Lang = 'th' | 'en';

const KEY = 'sbs:lang';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'th' || saved === 'en') return saved;
  } catch { /* storage blocked: fall back to the browser language */ }
  const prefs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return prefs.some((l) => l?.toLowerCase().startsWith('th')) ? 'th' : 'en';
}

export const lang: Lang = detect();

/** BCP 47 locale for dates and numbers. */
export const locale = lang === 'th' ? 'th-TH' : 'en-GB';

/** Pick the Thai or English version. Works for strings and JSX alike. */
export function t<T>(th: T, en: T): T {
  return lang === 'th' ? th : en;
}

/** Save the choice and reload so every string is rebuilt in the new language. */
export function setLang(next: Lang) {
  if (next === lang) return;
  try { localStorage.setItem(KEY, next); } catch { /* still switches for this load */ }
  location.reload();
}

document.documentElement.lang = lang;
if (lang === 'en') {
  // index.html ships the Thai description (what link-preview crawlers read); English visitors get this one
  document.querySelector('meta[name="description"]')?.setAttribute('content',
    'Design cross-stitch patterns for fabric and 3D-printed pieces. Track your stitching progress, print charts and share them with friends.');
}
