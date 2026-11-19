import { client, cloudEnabled } from './cloud';
import { lang } from './i18n';

/** In-app feedback, stored in the Supabase `feedback` table (insert-only; read in the dashboard). */
export type FeedbackKind = 'idea' | 'bug' | 'other';

/** Feedback needs the backend; without it the "send feedback" entry points are hidden. */
export const feedbackEnabled = cloudEnabled;

const OPEN = 'sbs:open-feedback';
const SENT_KEY = 'sbs:feedback-sent';
const LIMIT = 5; // per hour, per browser: a light brake on accidental repeats / spam

/** Open the feedback dialog from anywhere (it is mounted once in App). */
export function openFeedback(kind: FeedbackKind = 'idea') {
  window.dispatchEvent(new CustomEvent(OPEN, { detail: { kind } }));
}
export function onOpenFeedback(fn: (kind: FeedbackKind) => void): () => void {
  const h = (e: Event) => fn((e as CustomEvent<{ kind: FeedbackKind }>).detail?.kind ?? 'idea');
  window.addEventListener(OPEN, h);
  return () => window.removeEventListener(OPEN, h);
}

function recentSends(): number[] {
  try {
    const hourAgo = Date.now() - 3600_000;
    return (JSON.parse(localStorage.getItem(SENT_KEY) || '[]') as number[]).filter((t) => t > hourAgo);
  } catch {
    return [];
  }
}

export function canSendFeedback(): boolean {
  return recentSends().length < LIMIT;
}

export async function sendFeedback(f: { kind: FeedbackKind; message: string; contactEmail?: string }) {
  const c = await client();
  const w = Math.round(window.innerWidth);
  const device = w <= 600 ? 'phone' : w <= 1024 ? 'tablet' : 'desktop';
  // the screen the sender was on, without ids (e.g. '#/edit', never '#/edit/abc123')
  const page = (location.hash || '#/').split('/').slice(0, 2).join('/').slice(0, 100);
  const { error } = await c.from('feedback').insert({
    kind: f.kind,
    message: f.message.trim().slice(0, 2000),
    contact_email: f.contactEmail?.trim() || null,
    page,
    lang,
    device,
    screen_w: w,
  });
  if (error) throw error;
  try { localStorage.setItem(SENT_KEY, JSON.stringify([...recentSends(), Date.now()])); } catch { /* not critical */ }
}
