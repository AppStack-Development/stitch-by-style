import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

/**
 * Emits sw.js with the full list of built files, so the app (including the lazily
 * loaded 3D/model-import chunks) works offline after the first visit.
 * Navigations are network-first (new deploys show up), hashed assets cache-first.
 */
function serviceWorker(): Plugin {
  return {
    name: 'stitch-sw',
    apply: 'build',
    generateBundle(_, bundle) {
      const publicFiles = listFiles('public').map((f) => relative('public', f).split('\\').join('/'));
      // og-image.png is only fetched by link-preview crawlers, never needed offline
      const files = [...Object.keys(bundle), ...publicFiles].filter((f) => !f.endsWith('.map') && f !== 'sw.js' && f !== 'og-image.png');
      const assets = ['./', ...files.map((f) => `./${f}`)];
      const version = createHash('sha256').update(files.sort().join('|')).digest('hex').slice(0, 10);
      const source = `// generated at build time — do not edit
const CACHE = 'sbs-${version}';
const ASSETS = ${JSON.stringify(assets)};
const FONTS = 'sbs-fonts';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sbs-') && k !== CACHE && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    // always try the network so a new deploy is picked up; fall back to the cached shell offline
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./', { ignoreSearch: true })),
    );
    return;
  }
  // Vercel Web Analytics: always straight to the network, never cached
  if (url.pathname.startsWith('/_vercel/')) return;
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
    return;
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    // Thai web font: serve from cache, refresh in the background
    e.respondWith(
      caches.open(FONTS).then(async (c) => {
        const hit = await c.match(req);
        const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }),
    );
  }
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  base: './',
  server: { port: 5173 },
});
