import { useEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../lib/i18n';
import { Icon, type IconName } from './Icon';

/**
 * The app's own confirmation box, in place of the browser's confirm(): same look as the other dialogs,
 * a real title, and a button that says what will happen. Call it from anywhere:
 *
 *   if (!(await askConfirm({ title: 'Delete this?', ok: 'Delete', tone: 'danger' }))) return;
 *
 * <ConfirmHost /> (mounted once in App) shows one request at a time.
 */
export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  /** label of the confirming button, e.g. "Delete pattern" */
  ok: string;
  cancel?: string;
  /** danger: red button for things that can't be undone */
  tone?: 'primary' | 'danger';
  icon?: IconName;
}

interface Request extends ConfirmOptions { resolve: (ok: boolean) => void }

let show: ((r: Request) => void) | null = null;

export function askConfirm(o: ConfirmOptions): Promise<boolean> {
  // no host mounted (shouldn't happen): fall back to the browser's box rather than skip the question
  if (!show) return Promise.resolve(window.confirm(o.title));
  return new Promise((resolve) => show!({ ...o, resolve }));
}

export function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    show = (r) => setReq((cur) => { cur?.resolve(false); return r; });
    return () => { show = null; };
  }, []);
  const done = (ok: boolean) => { req?.resolve(ok); setReq(null); };
  useEffect(() => {
    if (!req) return;
    // a destructive action starts on Cancel, so a stray Enter doesn't delete anything
    (req.tone === 'danger' ? cancelRef : okRef).current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [req]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!req) return null;
  const danger = req.tone === 'danger';
  return (
    <div className="modal-back confirm-back" onMouseDown={(e) => { if (e.target === e.currentTarget) done(false); }}>
      <div className="modal acct-dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"
        aria-describedby={req.message ? 'confirm-msg' : undefined}>
        <div className="confirm-body">
          <span className={'confirm-icon' + (danger ? ' danger' : '')} aria-hidden="true">
            <Icon name={req.icon ?? (danger ? 'trash' : 'help')} size={20} />
          </span>
          <div className="confirm-text">
            <h3 id="confirm-title">{req.title}</h3>
            {req.message && <div id="confirm-msg" className="confirm-msg">{req.message}</div>}
          </div>
        </div>
        <footer className="modal-foot acct-dialog-foot">
          <button ref={cancelRef} className="btn" onClick={() => done(false)}>{req.cancel ?? t('ยกเลิก', 'Cancel')}</button>
          <button ref={okRef} className={'btn ' + (danger ? 'danger-solid' : 'primary')} onClick={() => done(true)}>{req.ok}</button>
        </footer>
      </div>
    </div>
  );
}
