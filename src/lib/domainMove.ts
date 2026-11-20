import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';

/**
 * The app moved from stitch-by-style.vercel.app to cross-stitch-lab.vercel.app (renamed to Cross Stitch Lab).
 *
 * Patterns, threads and settings live in each site's own browser storage, so a plain redirect would leave
 * them behind. Instead, the first visit to the old address packs this browser's data into the link
 * (after the #, which never reaches a server) and opens the same page on the new address, which unpacks it.
 * Later visits to the old address just redirect. The old copy is never deleted.
 *
 * Sign-in tokens are not carried over: people sign in again on the new address, and their account
 * data syncs as usual.
 */
export const OLD_HOST = 'stitch-by-style.vercel.app';
export const NEW_ORIGIN = 'https://cross-stitch-lab.vercel.app';

const MOVED_KEY = 'sbs:moved';
const ROUTE = '#/move/';
/** Keys that stay behind: sign-in tokens, and one-off markers. */
const SKIP = /^sbs:(auth|auth-return|moved|open-feedback)$/;
/** Very large data can't travel in a link reliably; those visitors keep using the old address (see App). */
const MAX_LINK = 1_500_000;

interface Payload { v: 1; to: string; data: Record<string, string> }

function toB64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(str: string): Uint8Array {
  const b = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

/** True while this page is the old address that still has data too big to move by link. */
export let stuckOnOldDomain = false;

/**
 * On the old address: leave for the new one (with this browser's data the first time). Returns true when the
 * page is leaving, so the caller can skip starting the app.
 */
export function leaveOldDomain(): boolean {
  if (location.hostname !== OLD_HOST) return false;
  const to = location.hash && location.hash !== '#' ? location.hash : '#/';
  const path = location.pathname === '/' ? '/' : location.pathname;
  try {
    if (!localStorage.getItem(MOVED_KEY)) {
      const link = moveLink(NEW_ORIGIN, to);
      if (link && link.length > MAX_LINK) {
        stuckOnOldDomain = true;
        return false;
      }
      localStorage.setItem(MOVED_KEY, String(Date.now()));
      if (link) {
        location.replace(link);
        return true;
      }
    }
  } catch {
    // storage blocked: nothing to carry, just go
  }
  location.replace(NEW_ORIGIN + path + location.search + to);
  return true;
}

/** The link that carries this browser's data to `origin` and opens `to` there; null when there's nothing to carry. */
export function moveLink(origin: string, to: string): string | null {
  const data: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('sbs:') && !SKIP.test(k)) data[k] = localStorage.getItem(k) ?? '';
  }
  if (!Object.keys(data).length) return null;
  const packed = toB64Url(deflateSync(strToU8(JSON.stringify({ v: 1, to, data } satisfies Payload)), { level: 9 }));
  return `${origin}/${ROUTE}${packed}`;
}

/**
 * On the new address: unpack data brought from the old one. Nothing here is overwritten except a pattern
 * the old address had a newer copy of. Runs before anything reads storage.
 */
export function arriveFromOldDomain() {
  if (!location.hash.startsWith(ROUTE)) return;
  let to = '#/';
  try {
    const p = JSON.parse(strFromU8(inflateSync(fromB64Url(location.hash.slice(ROUTE.length))))) as Payload;
    if (p && p.v === 1 && p.data && typeof p.data === 'object') {
      if (typeof p.to === 'string' && p.to.startsWith('#/') && !p.to.startsWith(ROUTE)) to = p.to;
      for (const [k, v] of Object.entries(p.data)) {
        if (typeof v !== 'string' || !k.startsWith('sbs:') || SKIP.test(k)) continue;
        const here = localStorage.getItem(k);
        if (here === null) localStorage.setItem(k, v);
        else if (k.startsWith('sbs:p:') && newer(v, here)) localStorage.setItem(k, v);
      }
    }
  } catch {
    // a damaged link: open the app as usual
  }
  history.replaceState(null, '', location.pathname + location.search + to);
}

function newer(a: string, b: string): boolean {
  try { return (JSON.parse(a).updatedAt ?? 0) > (JSON.parse(b).updatedAt ?? 0); } catch { return false; }
}
