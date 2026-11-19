import { inject, pageview } from '@vercel/analytics';

/**
 * Privacy-friendly usage stats (Vercel Web Analytics: no cookies, no personal data).
 *
 * The app uses #/ routes, which Vercel can't see on its own, so page views are sent by hand with the
 * hash turned into a path — and with pattern ids and share data cut off, so no pattern is identifiable.
 * Steps inside a page (the quick-create flow, opening a sample) are sent as virtual pages, which works on
 * the free plan and gives a simple funnel. Only production builds report anything.
 */
const enabled = import.meta.env.PROD;

/** '#/edit/abc123' → '/edit', '#/guide/editor' → '/guide/editor', '#/s/<data>' → '/s' */
export function routePath(hash: string): string {
  const [route = '', arg = ''] = hash.replace(/^#\/?/, '').split('/');
  if (!route) return '/';
  const keepArg = route === 'guide' || route === 'new';
  return keepArg && arg ? `/${route}/${arg.slice(0, 30)}` : `/${route}`;
}

let last = '';
function send(path: string) {
  if (!enabled || path === last) return;
  last = path;
  pageview({ path, route: path });
}

/** Call once at startup. */
export function initAnalytics() {
  if (!enabled) return;
  inject({ mode: 'production', disableAutoTrack: true });
  send(routePath(location.hash));
  window.addEventListener('hashchange', () => send(routePath(location.hash)));
}

/** A step inside a page, e.g. trackStep('/quick/2-photo'). */
export function trackStep(path: string) {
  send(path);
}
