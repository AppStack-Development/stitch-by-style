import type { MouseEvent, ReactNode } from 'react';
import { t } from '../lib/i18n';

/** Loose equality for setting values: numbers compare with a small tolerance (e.g. 25.4 / 14 ≈ 1.814). */
export function sameValue(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 1e-3;
  return a === b;
}

interface Props<T> {
  /** current value of the field */
  value: T;
  /** the starting value the app set (kind="default") or computed from other inputs (kind="suggested") */
  def: T;
  /**
   * "default": a fixed starting value → tag "Default".
   * "suggested": a value the app works out from other inputs → tag "Suggested".
   */
  kind?: 'default' | 'suggested';
  /** short reason shown in the tooltip, mainly for suggested values */
  reason?: string;
  /** restores `def`; without it nothing is shown once the value has been changed */
  onReset?: () => void;
  /** custom equality (defaults to `sameValue`) */
  equals?: (a: T, b: T) => boolean;
}

/**
 * Small marker next to a field label: "Default" / "Suggested" while the value is the one the app set,
 * or a "Reset" text button once the user has changed it.
 * Put it inside the label's heading row, e.g. `<FieldHead label={…}><DefaultTag … /></FieldHead>`.
 */
export function DefaultTag<T>({ value, def, kind = 'default', reason, onReset, equals = sameValue }: Props<T>) {
  if (equals(value, def)) {
    const title = kind === 'suggested'
      ? t('ระบบคำนวณค่านี้ให้', 'Worked out for you') + (reason ? ` — ${reason}` : '') + t(' · แก้ไขได้', ' · feel free to change it')
      : (reason ? `${reason} · ` : '') + t('ระบบตั้งค่านี้ให้ แก้ไขได้', 'Set for you — feel free to change it');
    return (
      <span className={'def-tag' + (kind === 'suggested' ? ' suggested' : '')} title={title}>
        {kind === 'suggested' ? t('แนะนำ', 'Suggested') : t('ค่าเริ่มต้น', 'Default')}
      </span>
    );
  }
  if (!onReset) return null;
  const click = (e: MouseEvent) => {
    // the tag usually sits inside a <label>: don't let the click reach the field
    e.preventDefault();
    e.stopPropagation();
    onReset();
  };
  return (
    <button type="button" className="def-reset" onClick={click}
      title={kind === 'suggested'
        ? t('กลับไปใช้ค่าที่ระบบแนะนำ', 'Go back to the suggested value') + (reason ? ` — ${reason}` : '')
        : t('กลับไปใช้ค่าที่ระบบตั้งไว้ตอนแรก', 'Go back to the starting value')}>
      {kind === 'suggested' ? t('ใช้ค่าแนะนำ', 'Use suggested') : t('คืนค่าเริ่มต้น', 'Reset')}
    </button>
  );
}

/** A label's text plus its tag on one line that wraps on narrow screens. */
export function FieldHead({ label, children }: { label: ReactNode; children?: ReactNode }) {
  return <span className="field-head"><span className="field-head-text">{label}</span>{children}</span>;
}
