import { useEffect, useRef, useState } from 'react';
import { canSendFeedback, feedbackEnabled, onOpenFeedback, openFeedback, sendFeedback, type FeedbackKind } from '../lib/feedback';
import { useCloud } from '../lib/cloud';
import { t } from '../lib/i18n';
import { Icon } from './Icon';
import { APP_NAME } from '../lib/brand';

const KINDS: { id: FeedbackKind; label: () => string; hint: () => string }[] = [
  { id: 'idea', label: () => t('ไอเดีย', 'Idea'), hint: () => t('อยากให้เพิ่มหรือปรับอะไร', 'What would you like added or changed?') },
  { id: 'bug', label: () => t('แจ้งปัญหา', 'Problem'), hint: () => t('เกิดอะไรขึ้น และกดอะไรก่อนหน้านั้น', 'What happened, and what did you do just before?') },
  { id: 'other', label: () => t('อื่น ๆ', 'Other'), hint: () => t('เล่าให้เราฟังได้เลย', 'Tell us anything') },
];

/** "ส่งความคิดเห็น": a small dialog, mounted once in App, opened with openFeedback(). */
export function FeedbackDialog() {
  const cloud = useCloud();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>('idea');
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState(false);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [err, setErr] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => onOpenFeedback((k) => {
    setKind(k);
    setState('idle');
    setErr('');
    setOpen(true);
  }), []);
  useEffect(() => {
    if (!open) return;
    setTimeout(() => textRef.current?.focus(), 30);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [open]);
  // signed in: offer the account email for a reply
  useEffect(() => { if (cloud.user?.email && !email) setEmail(cloud.user.email); }, [cloud.user, email]);

  if (!feedbackEnabled || !open) return null;

  const close = () => {
    setOpen(false);
    if (state === 'sent') { setMessage(''); setReply(false); setState('idle'); }
  };
  const emailOk = !reply || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSend = message.trim().length >= 3 && emailOk && state !== 'sending';

  const send = async () => {
    if (!canSend) return;
    if (!canSendFeedback()) { setErr(t('ส่งหลายครั้งแล้วในชั่วโมงนี้ ลองใหม่อีกสักครู่', 'You’ve sent several in the last hour. Please try again a bit later.')); return; }
    setState('sending');
    setErr('');
    try {
      await sendFeedback({ kind, message, contactEmail: reply ? email : undefined });
      setState('sent');
    } catch (e) {
      setState('idle');
      setErr(navigator.onLine === false
        ? t('ไม่มีอินเทอร์เน็ต ข้อความยังอยู่ ลองส่งอีกครั้งเมื่อออนไลน์', 'You’re offline. Your message is kept; send again when you’re online.')
        : t('ส่งไม่สำเร็จ ลองอีกครั้ง', 'Couldn’t send. Please try again.') + ` (${(e as Error).message})`);
    }
  };

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal fb-dialog" role="dialog" aria-modal="true" aria-labelledby="fb-title">
        <header className="modal-head">
          <h3 id="fb-title"><Icon name="chat" /> {t('ส่งความคิดเห็น', 'Send feedback')}</h3>
          <button className="icon-btn" onClick={close} aria-label={t('ปิด', 'Close')} title={t('ปิด', 'Close')}><Icon name="close" /></button>
        </header>
        {state === 'sent' ? (
          <div className="fb-body fb-done">
            <Icon name="check" size={28} />
            <p><b>{t('ขอบคุณมาก ได้รับข้อความแล้ว', 'Thank you — we got your message.')}</b></p>
            <p className="muted">{reply ? t('ถ้ามีคำถามเพิ่มเติม เราจะตอบกลับทางอีเมล', 'If we have questions, we’ll reply by email.') : t(`ทุกข้อความช่วยให้ ${APP_NAME} ดีขึ้น`, `Every message helps make ${APP_NAME} better.`)}</p>
          </div>
        ) : (
          <div className="fb-body">
            <div className="seg fb-kinds" role="radiogroup" aria-label={t('ประเภท', 'Type')}>
              {KINDS.map((k) => (
                <button key={k.id} role="radio" aria-checked={kind === k.id} className={kind === k.id ? 'on' : ''} onClick={() => setKind(k.id)}>{k.label()}</button>
              ))}
            </div>
            <label className="fb-field">
              <span>{KINDS.find((k) => k.id === kind)!.hint()}</span>
              <textarea ref={textRef} value={message} maxLength={2000} rows={5} onChange={(e) => setMessage(e.target.value)}
                placeholder={kind === 'bug' ? t('เช่น กดสร้างลายจากรูปแล้วหน้าค้างที่ขั้นที่ 3 บนมือถือ', 'e.g. Pattern from a photo froze at step 3 on my phone') : t('เขียนได้เลย ภาษาไทยหรืออังกฤษก็ได้', 'Write in Thai or English')} />
              <small className="fb-count">{message.length}/2000</small>
            </label>
            <label className="fb-check">
              <input type="checkbox" checked={reply} onChange={(e) => setReply(e.target.checked)} />
              <span>{t('อยากให้ติดต่อกลับทางอีเมล', 'I’d like a reply by email')}</span>
            </label>
            {reply && (
              <input className="fb-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" aria-label={t('อีเมลของคุณ', 'Your email')} aria-invalid={!emailOk} />
            )}
            <p className="hint">
              {t(<>เราเก็บข้อความนี้พร้อมหน้าที่คุณอยู่ ภาษา และขนาดหน้าจอ เพื่อช่วยแก้ปัญหา ไม่มีข้อมูลลายของคุณ · <a href="#/privacy" onClick={() => setOpen(false)}>นโยบายความเป็นส่วนตัว</a></>,
                <>We keep this message with the screen you were on, your language and screen size to help us fix things — none of your patterns · <a href="#/privacy" onClick={() => setOpen(false)}>Privacy</a></>)}
            </p>
            {err && <p className="error small">{err}</p>}
          </div>
        )}
        <footer className="modal-foot fb-foot">
          {state === 'sent' ? (
            <button className="btn primary" onClick={close}>{t('ปิด', 'Close')}</button>
          ) : (
            <>
              <button className="btn" onClick={close}>{t('ยกเลิก', 'Cancel')}</button>
              <button className="btn primary" onClick={send} disabled={!canSend}>
                <Icon name="send" size={16} /> {state === 'sending' ? t('กำลังส่ง…', 'Sending…') : t('ส่ง', 'Send')}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

/** A text button that opens the feedback dialog; renders nothing when feedback isn't available. */
export function FeedbackLink({ className, children, kind }: { className?: string; children?: React.ReactNode; kind?: FeedbackKind }) {
  if (!feedbackEnabled) return null;
  return (
    <button type="button" className={className ?? 'link-btn'} onClick={() => openFeedback(kind)}>
      {children ?? <><Icon name="chat" size={15} /> {t('ส่งความคิดเห็น', 'Send feedback')}</>}
    </button>
  );
}
