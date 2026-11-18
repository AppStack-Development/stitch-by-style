import { useEffect, useRef, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { t } from '../lib/i18n';

export type SheetItem = {
  key: string;
  icon: IconName;
  label: string;
  /** tooltip (e.g. with the keyboard shortcut) */
  title?: string;
  /** highlighted: the active tool, or a toggle that is switched on */
  on?: boolean;
  /** an on/off switch: shows its state and keeps the sheet open when tapped */
  toggle?: boolean;
  onSelect: () => void;
};

export type SheetSection = { title: string; items: SheetItem[] };

/**
 * Phone bottom sheet listing the tools that don't fit in the bottom tool bar, each with its name.
 * Picking a tool closes it; toggles stay open so their new state is visible.
 * Closes on a tap outside, on Esc and with the close button.
 */
export function ToolSheet({ title, sections, footer, onClose }: {
  title: string;
  sections: SheetSection[];
  footer?: ReactNode;
  onClose: () => void;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    sheet.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close.current(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      // give focus back to the More button, unless something else took it (e.g. the text dialog)
      const now = document.activeElement;
      if (!now || now === document.body) prev?.focus?.();
    };
  }, []);

  return (
    <div className="tool-sheet-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tool-sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={sheet}>
        <div className="tool-sheet-head">
          <b>{title}</b>
          <button className="icon-btn" onClick={onClose} aria-label={t('ปิด', 'Close')} title={t('ปิด (Esc)', 'Close (Esc)')}>
            <Icon name="close" />
          </button>
        </div>
        {sections.map((s) => (
          <section key={s.title}>
            <h5>{s.title}</h5>
            <div className="tool-sheet-grid">
              {s.items.map((it) => (
                <button key={it.key} className={'sheet-tool' + (it.on ? ' on' : '')} title={it.title}
                  aria-pressed={it.toggle ? !!it.on : undefined}
                  onClick={() => { it.onSelect(); if (!it.toggle) onClose(); }}>
                  <Icon name={it.icon} size={22} />
                  <span>{it.label}</span>
                  {it.toggle && <small>{it.on ? t('เปิดอยู่', 'On') : t('ปิดอยู่', 'Off')}</small>}
                </button>
              ))}
            </div>
          </section>
        ))}
        {footer}
      </div>
    </div>
  );
}
