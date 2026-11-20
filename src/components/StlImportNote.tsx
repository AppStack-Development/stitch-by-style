import { useState } from 'react';
import type { Pattern } from '../types';
import { Icon } from './Icon';
import { t } from '../lib/i18n';

/**
 * Until 20 Nov 2026 22:31 (+07), importing an STL read every hole as one stitch cell. A cross stitch actually
 * sits between four holes (see lib/plate.ts), so patterns imported before then are half a cell off from the
 * real model. This card tells the owner to import the model again. Dismissal is remembered per pattern.
 */
const FIXED_AT = Date.parse('2026-11-20T15:31:00Z');
const KEY = 'sbs:stl-note-seen';

function seen(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function needsStlReimport(p: Pattern): boolean {
  return p.templateId === 'stl' && p.createdAt < FIXED_AT;
}

export function StlImportNote({ pattern }: { pattern: Pattern }) {
  const [open, setOpen] = useState(() => needsStlReimport(pattern) && !seen().includes(pattern.id));
  if (!open) return null;
  const dismiss = () => {
    try { localStorage.setItem(KEY, JSON.stringify([...seen(), pattern.id].slice(-200))); } catch { /* hide for this visit only */ }
    setOpen(false);
  };
  return (
    <div className="coach coach-warn" role="status">
      <div className="coach-head">
        <span className="coach-kicker">{t('ลายที่นำเข้าจาก STL', 'Imported from STL')}</span>
        <button className="icon-btn sm" onClick={dismiss} aria-label={t('ปิด', 'Close')} title={t('ปิด', 'Close')}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <b className="coach-title">{t('ควรนำเข้าโมเดลนี้ใหม่', 'Import this model again')}</b>
      <p>{t('ลายนี้นำเข้าก่อนวันที่ 20 พ.ย. 2569 ตอนนั้นระบบนับ 1 รูเป็น 1 ช่อง แต่ฝีกากบาทจริงอยู่ระหว่าง 4 รู ช่องในลายนี้จึงเลื่อนไปครึ่งช่องจากโมเดลจริง นำเข้าไฟล์เดิมอีกครั้งเพื่อให้ตรง แล้วค่อยลงสีในลายใหม่',
        'This pattern was imported before 20 Nov 2026, when each hole was read as one cell. A cross stitch really sits between four holes, so these cells are half a cell off from your model. Import the same file again to line them up, then colour the new pattern.')}</p>
      <div className="coach-foot">
        <span />
        <button className="btn ghost sm" onClick={dismiss}>{t('ไว้ทีหลัง', 'Later')}</button>
        <a className="btn primary sm" href="#/new/template">{t('นำเข้าใหม่', 'Import again')}</a>
      </div>
    </div>
  );
}
