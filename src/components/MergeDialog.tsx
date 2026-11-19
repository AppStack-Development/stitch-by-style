import { useState } from 'react';
import { useCloud } from '../lib/cloud';
import { resolveMerge } from '../lib/sync';
import { Icon } from './Icon';
import { t } from '../lib/i18n';

/** After the first sign-in on a device that already has patterns: add them to the account or keep them local. */
export function MergeDialog() {
  const { askMerge } = useCloud();
  const [busy, setBusy] = useState<'merge' | 'local-only' | null>(null);
  const [err, setErr] = useState('');
  if (!askMerge) return null;
  const n = askMerge.localCount;

  const choose = async (choice: 'merge' | 'local-only') => {
    setBusy(choice);
    setErr('');
    try {
      await resolveMerge(choice);
    } catch (e) {
      setErr((e as Error).message || t('เกิดข้อผิดพลาด ลองอีกครั้ง', 'Something went wrong. Please try again.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="modal-back">
      <div className="modal acct-dialog" role="dialog" aria-modal="true" aria-labelledby="merge-title">
        <header className="modal-head">
          <h3 id="merge-title"><Icon name="cloud" /> {t('เก็บลายในเครื่องนี้เข้าบัญชี?', 'Add this device’s patterns?')}</h3>
        </header>
        <div className="acct-dialog-body">
          <p className="acct-dialog-lead">
            {t(`มีลาย ${n} ลายในเครื่องนี้ จะเก็บเข้าบัญชีด้วยไหม?`, `This device has ${n} ${n === 1 ? 'pattern' : 'patterns'}. Add them to your account?`)}
          </p>
          <p className="muted">
            {t('ถ้าเก็บเข้าบัญชี ลายเหล่านี้จะซิงก์ไปยังอุปกรณ์อื่นที่เข้าสู่ระบบบัญชีเดียวกัน และมีสำรองไว้ถ้าเบราว์เซอร์ถูกล้างข้อมูล',
              'If you add them, they’ll sync to your other devices signed in to this account and be backed up in case this browser is cleared.')}
          </p>
          <p className="muted">
            {t('ถ้าเลือกไม่ต้อง ลายเหล่านี้จะยังอยู่ในเครื่องนี้ตามเดิม แต่จะไม่ขึ้นในอุปกรณ์อื่น',
              'If you choose not to, they stay on this device as they are, but won’t appear on your other devices.')}
          </p>
          {err && <p className="error small">{err}</p>}
        </div>
        <footer className="modal-foot acct-dialog-foot">
          <button className="btn" onClick={() => choose('local-only')} disabled={!!busy}>
            {busy === 'local-only' ? t('กำลังบันทึก…', 'Saving…') : t('ไม่ต้อง เก็บไว้ในเครื่องนี้อย่างเดียว', 'No, keep them on this device only')}
          </button>
          <button className="btn primary" onClick={() => choose('merge')} disabled={!!busy} autoFocus>
            <Icon name="cloud" size={16} /> {busy === 'merge' ? t('กำลังเก็บ…', 'Adding…') : t('เก็บเข้าบัญชี (แนะนำ)', 'Add to my account')}
          </button>
        </footer>
      </div>
    </div>
  );
}
