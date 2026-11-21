import { useEffect } from 'react';
import { t } from '../lib/i18n';
import { Icon } from './Icon';

/**
 * Strip under the header while a pattern is only being tried (lib/drafts.ts): says it isn't in
 * "My patterns" yet, when it will be, and offers to save it now.
 */
export function DraftBar({ state, kind, onSave }: { state: 'draft' | 'declined'; kind: 'stitch' | 'edit'; onSave: () => void }) {
  const text = state === 'declined'
    ? t('ไม่ได้เก็บลายนี้ไว้ ความคืบหน้าและการแก้ไขจะหายเมื่อปิดแท็บนี้', 'Not kept. Your progress and edits go when you close this tab.')
    : kind === 'stitch'
      ? t('ลองปักอยู่ ยังไม่ได้อยู่ในลายของฉัน จะบันทึกให้เมื่อเริ่มปักช่องแรก', 'Just trying it: not in My patterns yet. It saves when you mark your first stitch.')
      : t('ลองดูอยู่ ยังไม่ได้อยู่ในลายของฉัน จะบันทึกให้เมื่อเริ่มแก้ลาย', 'Just looking: not in My patterns yet. It saves when you make your first change.');
  // phones get the short version, so the strip stays one line above the pattern
  const short = state === 'declined'
    ? t('ไม่ได้เก็บไว้ · จะหายเมื่อปิดแท็บ', 'Not kept · gone when you close the tab')
    : kind === 'stitch' ? t('ลองปักอยู่ · ยังไม่บันทึก', 'Just trying · not saved') : t('ลองดูอยู่ · ยังไม่บันทึก', 'Just looking · not saved');
  return (
    <div className={'draft-bar' + (state === 'declined' ? ' declined' : '')} role="status">
      <Icon name={state === 'declined' ? 'info' : 'eye'} size={16} />
      <span className="draft-text"><span className="long">{text}</span><span className="short">{short}</span></span>
      <button className="btn sm" onClick={onSave}>
        <Icon name="check" size={15} /> <span className="long">{t('บันทึกไว้ในลายของฉัน', 'Save to My patterns')}</span><span className="short">{t('บันทึก', 'Save')}</span>
      </button>
    </div>
  );
}

/** A short message with one action (e.g. "Saved · Don't keep"), in the draft strip's place for a few seconds. */
export function ActionToast({ text, action, onAction, onClose }: { text: string; action: string; onAction: () => void; onClose: () => void }) {
  useEffect(() => {
    const tm = setTimeout(onClose, 8000);
    return () => clearTimeout(tm);
  }, [onClose]);
  return (
    <div className="action-toast" role="status">
      <Icon name="check" size={16} />
      <span>{text}</span>
      <button className="action-toast-btn" onClick={onAction}>{action}</button>
    </div>
  );
}
