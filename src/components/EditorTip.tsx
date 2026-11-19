import { useEffect, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { t } from '../lib/i18n';

const KEY = 'sbs:tip:editor';

/** UI element the current tip step points at (the editor outlines it). */
export type CoachTarget = 'colors' | 'pencil' | 'more' | 'tools' | 'export';

function seen(): boolean {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [query]);
  return match;
}

/**
 * First-run coach card for the editor: a few short steps, not a modal (the editor stays usable
 * underneath). Dismissal is remembered in localStorage.
 */
export function EditorTip({ onTarget }: { onTarget: (target: CoachTarget | null) => void }) {
  const [open, setOpen] = useState(() => !seen());
  const [step, setStep] = useState(0);
  const phone = useMedia('(max-width: 900px)');
  const stacked = useMedia('(max-width: 900px)'); // side panel sits below the canvas

  const steps: { target: CoachTarget; title: string; body: ReactNode }[] = [
    {
      target: 'colors',
      title: t('1. เลือกสีด้าย', '1. Pick a thread color'),
      body: stacked
        ? t('แตะสีที่ต้องการในแท็บ “สีด้าย” ด้านล่าง หรือกด “เลือกจากด้าย DMC” เพื่อเพิ่มสี', 'Tap a color in the “Colors” tab below, or use “Pick DMC thread” to add one.')
        : t('คลิกสีที่ต้องการในแท็บ “สีด้าย” ด้านขวา หรือกด “เลือกจากด้าย DMC” เพื่อเพิ่มสี', 'Click a color in the “Colors” tab on the right, or use “Pick DMC thread” to add one.'),
    },
    {
      target: 'pencil',
      title: t('2. ปักด้วยดินสอ', '2. Paint with Pencil'),
      body: phone
        ? t('เลือก “ดินสอ” แล้วแตะหรือลากบนตาราง ถ้าปักผิดใช้ “ยางลบ” หรือปุ่มเลิกทำด้านบน', 'Choose “Pencil”, then tap or drag on the grid. Made a mistake? Use “Eraser” or Undo at the top.')
        : t('เลือก “ดินสอ” (B) แล้วคลิกหรือลากบนตาราง คลิกขวาเพื่อลบ และกด Ctrl/⌘+Z เพื่อเลิกทำ', 'Choose “Pencil” (B), then click or drag on the grid. Right-click erases; Ctrl/⌘+Z undoes.'),
    },
    phone
      ? {
        target: 'more',
        title: t('3. เครื่องมืออื่นอยู่ใน “เพิ่มเติม”', '3. More tools under “More”'),
        body: t('เส้นตรง กรอบสี่เหลี่ยม สมมาตร ใส่ชื่อ / ข้อความ และอื่น ๆ ซูมได้ด้วยการหยิกสองนิ้ว (ลากสองนิ้วเพื่อเลื่อน) หรือปุ่ม + − ที่มุมขวาของตาราง', 'Line, Rectangle, Mirror, Name / text and more. Pinch with two fingers to zoom (drag with two to move), or use the + − buttons at the corner of the grid.'),
      }
      : {
        target: 'tools',
        title: t('3. เครื่องมือทั้งหมดอยู่แถบซ้าย', '3. All tools on the left'),
        body: t('ชี้ที่ปุ่มเพื่อดูชื่อและคีย์ลัด เช่น เส้นตรง (L), กรอบสี่เหลี่ยม (R), สมมาตรซ้าย-ขวา (X), ใส่ชื่อ / ข้อความ (T)', 'Hover a button to see its name and shortcut, e.g. Line (L), Rectangle (R), Mirror left-right (X), Name / text (T).'),
      },
    {
      target: 'export',
      title: t('4. พิมพ์หรือแชร์', '4. Print or share'),
      body: t(
        <>เสร็จแล้วกดปุ่ม <Icon name="download" size={14} /> “ส่งออก / แชร์” มุมขวาบน เพื่อพิมพ์ บันทึกเป็น PDF หรือส่งให้เพื่อน งานของคุณบันทึกอัตโนมัติ</>,
        <>When you’re done, use <Icon name="download" size={14} /> “Export / share” at the top right to print, save as PDF or send it to a friend. Your work saves automatically.</>,
      ),
    },
  ];
  const cur = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;

  useEffect(() => {
    onTarget(open ? cur.target : null);
  }, [open, cur.target, onTarget]);

  if (!open) return null;

  const dismiss = () => {
    try { localStorage.setItem(KEY, '1'); } catch { /* storage blocked: hide for this visit only */ }
    setOpen(false);
  };

  return (
    <div className="coach" role="status" aria-live="polite">
      <div className="coach-head">
        <span className="coach-kicker">{t(`เริ่มต้นใช้งาน · ${step + 1}/${steps.length}`, `Getting started · ${step + 1}/${steps.length}`)}</span>
        <button className="icon-btn sm" onClick={dismiss} aria-label={t('ปิดคำแนะนำ', 'Close tips')} title={t('ปิดคำแนะนำ', 'Close tips')}>
          <Icon name="close" size={16} />
        </button>
      </div>
      <b className="coach-title">{cur.title}</b>
      <p>{cur.body}</p>
      <div className="coach-foot">
        <span className="coach-dots" aria-hidden="true">
          {steps.map((s, i) => <i key={s.target} className={i === step ? 'on' : ''} />)}
        </span>
        {step > 0 && <button className="btn ghost sm" onClick={() => setStep(step - 1)}>{t('ย้อนกลับ', 'Back')}</button>}
        <button className="btn primary sm" onClick={() => (last ? dismiss() : setStep(step + 1))}>
          {last ? t('เข้าใจแล้ว', 'Got it') : t('ถัดไป', 'Next')}
        </button>
      </div>
    </div>
  );
}
