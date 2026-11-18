import { useEffect, useMemo, useState } from 'react';
import type { Pattern } from '../types';
import { fontText, pixelText, pixelUnsupported, stamp, stitchArea, type Bitmap } from '../lib/textStamp';
import { contrastText } from '../lib/threads';
import { Thumb } from './Thumb';
import { Icon } from './Icon';

interface Props {
  pattern: Pattern;
  initialColor: number;
  onApply: (cells: number[], summary: string) => void;
  onClose: () => void;
}

type Mode = 'pixel' | 'font';

/** Type a name or message, see it on the piece, nudge it into place, then stamp it in one colour. */
export function TextDialog({ pattern: p, initialColor, onApply, onClose }: Props) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState<Mode>('pixel');
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(10);
  const [bold, setBold] = useState(true);
  const [threshold, setThreshold] = useState(0.45);
  const [color, setColor] = useState(Math.max(0, Math.min(initialColor, p.palette.length - 1)));
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [bmp, setBmp] = useState<Bitmap>({ w: 0, h: 0, bits: new Uint8Array(0) });

  const unsupported = mode === 'pixel' ? pixelUnsupported(text) : [];

  // build the text bitmap (the real-font path is async: it waits for the web font)
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => {
      const b = mode === 'pixel' ? pixelText(text, scale) : await fontText(text, { height, bold, threshold });
      if (live) setBmp(b);
    }, 120);
    return () => { live = false; clearTimeout(t); };
  }, [text, mode, scale, height, bold, threshold]);

  // centred on the stitchable area, then shifted by the user's nudges
  const area = useMemo(() => stitchArea(p.mask, p.cols, p.rows), [p.mask, p.cols, p.rows]);
  const ox = Math.round((area.x0 + area.x1 + 1) / 2 - bmp.w / 2) + dx;
  const oy = Math.round((area.y0 + area.y1 + 1) / 2 - bmp.h / 2) + dy;
  const result = useMemo(() => stamp(p.cells, p.mask, p.cols, p.rows, bmp, ox, oy, color), [p, bmp, ox, oy, color]);
  const preview = useMemo(() => ({ ...p, cells: result.cells }), [p, result]);

  const nudge = (x: number, y: number) => { setDx((v) => v + x); setDy((v) => v + y); };

  // largest size whose text box still fits the stitchable area, then re-centre
  const areaW = area.x1 - area.x0 + 1, areaH = area.y1 - area.y0 + 1;
  const fitToArea = () => {
    if (!bmp.w) return;
    if (mode === 'pixel') {
      const bw = bmp.w / scale, bh = bmp.h / scale;
      let best = 1;
      for (let k = 1; k <= 3; k++) if (bw * k <= areaW - 2 && bh * k <= areaH - 2) best = k;
      setScale(best);
    } else {
      const aspect = bmp.w / bmp.h;
      setHeight(Math.max(5, Math.min(areaH - 2, Math.floor((areaW - 2) / aspect))));
    }
    setDx(0);
    setDy(0);
  };
  const tooBig = bmp.w > areaW || bmp.h > areaH;

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if ((e.target as HTMLElement)?.tagName === 'TEXTAREA' || (e.target as HTMLElement)?.tagName === 'INPUT') return;
      const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (d[e.key]) { e.preventDefault(); nudge(...d[e.key]); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);

  const thread = p.palette[color];
  const canApply = result.placed > 0;

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-label="ใส่ตัวอักษร">
        <header className="modal-head">
          <h3><Icon name="text" /> ใส่ชื่อ / ข้อความ</h3>
          <button className="icon-btn" onClick={onClose} title="ปิด (Esc)"><Icon name="close" /></button>
        </header>
        <div className="modal-body">
          <div className="import-controls">
            <label>ข้อความ (ขึ้นบรรทัดใหม่ได้)
              <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)}
                // focus straight away only with a mouse: on phones it would scroll the preview away and pop the keyboard
                autoFocus={window.matchMedia('(pointer: fine)').matches}
                placeholder={mode === 'pixel' ? 'เช่น ANNA ♥' : 'เช่น น้องมะลิ'} />
            </label>
            <label>รูปแบบตัวอักษร
              <div className="seg full">
                <button className={mode === 'pixel' ? 'on' : ''} onClick={() => setMode('pixel')}>พิกเซล A–Z</button>
                <button className={mode === 'font' ? 'on' : ''} onClick={() => setMode('font')}>ฟอนต์ทั่วไป (ไทยได้)</button>
              </div>
            </label>
            {mode === 'pixel' ? (
              <>
                <p className="hint">คมชัดแม้ตัวเล็ก เหมาะกับพวงกุญแจ · รองรับ A–Z 0–9 . , ! ? - + &amp; ' : / ( ) ♥ ★ (ตัวพิมพ์เล็กจะเป็นตัวใหญ่)</p>
                {unsupported.length > 0 && (
                  <p className="error small">
                    ไม่มีตัว “{unsupported.slice(0, 8).join(' ')}” ในฟอนต์พิกเซล{' '}
                    <button className="guide-link" onClick={() => setMode('font')}>ใช้ฟอนต์ทั่วไปแทน</button>
                  </p>
                )}
                <label>ขนาด
                  <div className="seg full">
                    {[1, 2, 3].map((s) => <button key={s} className={scale === s ? 'on' : ''} onClick={() => setScale(s)}>×{s} ({7 * s} ช่อง)</button>)}
                  </div>
                </label>
              </>
            ) : (
              <>
                <label>ความสูง: <b>{height} ช่อง</b>
                  <input type="range" min={5} max={Math.max(12, Math.min(60, p.rows))} value={height} onChange={(e) => setHeight(+e.target.value)} />
                </label>
                <label>ความหนาเส้น
                  <input type="range" min={0.2} max={0.7} step={0.05} value={0.9 - threshold} onChange={(e) => setThreshold(+(0.9 - +e.target.value).toFixed(2))} />
                </label>
                <label className="check"><input type="checkbox" checked={bold} onChange={(e) => setBold(e.target.checked)} /><span>ตัวหนา</span></label>
                <p className="hint">ภาษาไทยที่มีสระบน/ล่าง ควรสูงอย่างน้อย 12 ช่องเพื่อให้อ่านออก</p>
              </>
            )}
            <label>สีด้าย
              <div className="text-colors">
                {p.palette.map((t, i) => (
                  <button key={t.id} className={'swatch' + (i === color ? ' on' : '')} style={{ background: t.hex, color: contrastText(t.hex) }}
                    onClick={() => setColor(i)} title={`${[t.brand, t.code].filter(Boolean).join(' ')} ${t.name}`}>{t.symbol}</button>
                ))}
              </div>
            </label>
            <div className="nudge">
              <span>ตำแหน่ง</span>
              <button className="icon-btn sm bg" onClick={() => nudge(-1, 0)} title="ซ้าย (←)">←</button>
              <button className="icon-btn sm bg" onClick={() => nudge(0, -1)} title="ขึ้น (↑)">↑</button>
              <button className="icon-btn sm bg" onClick={() => nudge(0, 1)} title="ลง (↓)">↓</button>
              <button className="icon-btn sm bg" onClick={() => nudge(1, 0)} title="ขวา (→)">→</button>
              <button className="btn sm ghost" onClick={() => { setDx(0); setDy(0); }}>กึ่งกลาง</button>
              <button className={'btn sm' + (tooBig ? ' primary' : ' ghost')} onClick={fitToArea} disabled={!bmp.w}>พอดีพื้นที่</button>
            </div>
          </div>
          <div className="import-preview">
            <div className="import-canvas"><Thumb pattern={preview} max={420} view="color" grid /></div>
            {bmp.w > 0 ? (
              <p className="muted">
                ข้อความ {bmp.w}×{bmp.h} ช่อง ({(bmp.w * p.pitchMm).toFixed(0)}×{(bmp.h * p.pitchMm).toFixed(0)} มม.) · {result.placed} ฝีเข็ม
                {result.missed > 0 && <> · <span className="warn">{result.missed} ช่องอยู่นอกพื้นที่ปัก</span></>}
              </p>
            ) : (
              <p className="muted">พิมพ์ข้อความเพื่อดูตัวอย่าง</p>
            )}
          </div>
        </div>
        <footer className="modal-foot">
          <span className="hint hide-xs">เลื่อนตำแหน่งด้วยลูกศรบนคีย์บอร์ด · กดเลิกทำ (Ctrl/⌘+Z) ได้หลังวาง</span>
          <div className="spacer" />
          <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" disabled={!canApply}
            onClick={() => onApply(result.cells, `ใส่ข้อความแล้ว: ${result.placed} ฝีเข็ม ด้วย ${[thread?.brand, thread?.code].filter(Boolean).join(' ') || thread?.name || ''}`)}>
            <Icon name="check" size={16} /> วางข้อความ
          </button>
        </footer>
      </div>
    </div>
  );
}
