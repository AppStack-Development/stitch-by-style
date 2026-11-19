/**
 * In-app browsers (LINE, Facebook, Instagram…) are where most shared links open in Thailand, and Google
 * refuses to sign in inside them ("403 disallowed_useragent"). We spot them so the sign-in card can send
 * people to Safari or Chrome instead of to an error page.
 */
export type InAppName = 'line' | 'facebook' | 'messenger' | 'instagram' | 'tiktok' | 'webview';

export interface InAppInfo {
  app: InAppName;
  /** Shown in messages, e.g. "LINE". Empty for an unknown app's webview. */
  label: string;
  os: 'ios' | 'android' | 'other';
}

const APPS: [InAppName, string, RegExp][] = [
  ['line', 'LINE', /\bLine\//i],
  ['messenger', 'Messenger', /\bFBAN\/Messenger|\bFB_IAB\/MESSENGER|\bMessengerFor/i],
  ['instagram', 'Instagram', /\bInstagram\b/i],
  ['facebook', 'Facebook', /\bFBAN\/|\bFBAV\/|\bFB_IAB\/|\bFBIOS\b/i],
  ['tiktok', 'TikTok', /\bmusical_ly|\bBytedanceWebview|\bTikTok\b/i],
];

/** Null in a normal browser (and in the installed app). Only well-known markers are used, to avoid false alarms. */
export function detectInApp(ua: string = navigator.userAgent): InAppInfo | null {
  const os = /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Android/i.test(ua) ? 'android' : 'other';
  for (const [app, label, re] of APPS) if (re.test(ua)) return { app, label, os };
  // other Android apps' embedded browsers mark themselves with "; wv)"
  if (os === 'android' && /;\s*wv\)/.test(ua)) return { app: 'webview', label: '', os };
  return null;
}

/** LINE opens a link in the phone's own browser when it carries this query parameter. */
const LINE_EXTERNAL = 'openExternalBrowser';

/** The address to open outside the app, landing on the Account page. */
export function externalUrl(info: InAppInfo): string {
  const base = location.origin + location.pathname;
  if (info.app === 'line') return `${base}?${LINE_EXTERNAL}=1#/account`;
  // Android: hand the page to Chrome; most in-app browsers there follow intent: links. An intent link has no
  // room for our #/account, so the parameter carries it and cleanExternalParam() restores it.
  if (info.os === 'android') return `intent://${location.host}${location.pathname}?${LINE_EXTERNAL}=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(base + '#/account')};end`;
  return `${base}#/account`;
}

/** Whether externalUrl() actually leaves the app (otherwise people use the app's own "open in browser" menu). */
export function canOpenExternally(info: InAppInfo): boolean {
  return info.app === 'line' || info.os === 'android';
}

/**
 * Drop the parameter once we're in the real browser, so it doesn't linger in the address bar. It only ever
 * comes from the sign-in notice, so with no route given we land back on the Account page.
 */
export function cleanExternalParam() {
  const q = new URLSearchParams(location.search);
  if (!q.has(LINE_EXTERNAL)) return;
  q.delete(LINE_EXTERNAL);
  const rest = q.toString();
  const hash = location.hash && location.hash !== '#/' ? location.hash : '#/account';
  history.replaceState(history.state, '', location.pathname + (rest ? `?${rest}` : '') + hash);
}
