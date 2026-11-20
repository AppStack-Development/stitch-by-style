/**
 * The app's name and address, in one place. Static files can't import this, so a rename also touches
 * index.html, public/manifest.webmanifest, api/_pattern.js, api/p.js and public/og-image.png.
 *
 * History: Stitch by Style (stitch-by-style.vercel.app) → Cross Stitch Lab (cross-stitch-lab.vercel.app)
 * → XStitch.Design (xstitch-design.vercel.app). Old addresses forward here: see domainMove.ts.
 */
export const APP_NAME = 'XStitch.Design';
/** Under the home-screen icon, where long names get cut off. */
export const APP_SHORT_NAME = 'XStitch';
/** For file names. */
export const APP_SLUG = 'xstitch-design';
export const SITE_ORIGIN = 'https://xstitch-design.vercel.app';
export const SITE_HOST = new URL(SITE_ORIGIN).host;
