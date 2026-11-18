import { useEffect, useMemo, useRef, useState } from 'react';
import type { Pattern, ThreadColor } from '../types';
import { DEFAULT_IMPORT, convertImage, loadSourceImage, type ImportOpts, type ImportResult, type SourceImage } from '../lib/imageImport';
import { contrastText } from '../lib/threads';
import { Thumb } from './Thumb';
import { Icon } from './Icon';

interface Props {
  pattern: Pattern;
  initialFile?: File | null;
  onApply: (cells: number[], palette: ThreadColor[], summary: string) => void;
  onClose: () => void;
}

export function ImageImportDialog({ pattern, initialFile, onApply, onClose }: Props) {
  const [src, setSrc] = useState<SourceImage | null>(null);
  const [srcUrl, setSrcUrl] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState<ImportOpts>(DEFAULT_IMPORT);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<ImportOpts>) => setOpts((o) => ({ ...o, ...patch }));

  const open = async (f: File) => {
    setErr('');
    setBusy(true);
    try {
      const s = await loadSourceImage(f);
      setSrc((old) => { old?.bitmap.close(); return s; });
      setSrcUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(f); });
      setOpts((o) => ({ ...o, skipBackground: !!s.bg || s.hasAlpha, offsetX: 0, offsetY: 0, scale: 1 }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { if (initialFile) open(initialFile); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (srcUrl) URL.revokeObjectURL(srcUrl); }, [srcUrl]);

  // live preview (debounced)
  useEffect(() => {
    if (!src) return;
    const t = setTimeout(() => setResult(convertImage(src, pattern, opts)), 90);
    return () => clearTimeout(t);
  }, [src, opts, pattern]);

  // Escape closes, paste replaces the image
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const paste = (e: ClipboardEvent) => {
      const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'));
      if (f) { e.preventDefault(); open(f); }
    };
    window.addEventListener('keydown', key);
    window.addEventListener('paste', paste);
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('paste', paste); };
  }, [onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = useMemo(() => (result ? { ...pattern, cells: result.cells, palette: result.palette } : pattern), [result, pattern]);
  const used = useMemo(() => {
    if (!result) return [];
    const counts = new Map<number, number>();
    result.cells.forEach((v, i) => { if (v >= 0 && pattern.mask[i] === '2') counts.set(v, (counts.get(v) ?? 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([i, n]) => ({ t: result.palette[i], n }));
  }, [result, pattern.mask]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/'));
    if (f) open(f);
  };

  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-label="แปลงรูปภาพเป็นลายปัก"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
        <header className="modal-head">
          <h3><Icon name="image" /> แปลงรูปภาพเป็นลายปัก</h3>
          <button className="icon-btn" onClick={onClose} title="ปิด (Esc)"><Icon name="close" /></button>
        </header>
        <input ref={fileRef} type="file" accept="image/*" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) open(f); e.target.value = ''; }} />

        {!src ? (
          <button className={'drop-zone' + (dragOver ? ' over' : '')} onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={36} />
            <b>{busy ? 'กำลังเปิดรูป…' : 'เลือกรูป ลากมาวาง หรือกด Ctrl/⌘+V เพื่อวางรูป'}</b>
            <span>PNG / JPG / WebP · รูปพื้นหลังโปร่งใสหรือพื้นสีเรียบ ภาพการ์ตูน โลโก้ ให้ผลดีที่สุด</span>
            {err && <span className="error">{err}</span>}
          </button>
        ) : (
          <div className="modal-body">
            <div className="import-controls">
              <div className="src-row">
                <img src={srcUrl} alt="รูปต้นฉบับ" className="src-img" />
                <div>
                  <small className="muted">{src.width}×{src.height} px</small>
                  <button className="btn sm" onClick={() => fileRef.current?.click()}><Icon name="upload" size={14} /> เปลี่ยนรูป</button>
                </div>
              </div>

              <label>จำนวนสีสูงสุด: <b>{opts.colors}</b>
                <input type="range" min={2} max={24} value={opts.colors} disabled={opts.paletteMode === 'current'}
                  onChange={(e) => set({ colors: +e.target.value })} />
              </label>
              <label>เลือกสีด้ายจาก
                <div className="seg full">
                  {([['dmc', 'ด้าย DMC'], ['exact', 'สีตามรูป'], ['current', 'จานสีปัจจุบัน']] as const).map(([v, l]) => (
                    <button key={v} className={opts.paletteMode === v ? 'on' : ''} onClick={() => set({ paletteMode: v })}>{l}</button>
                  ))}
                </div>
              </label>
              <p className="hint">
                {opts.paletteMode === 'dmc' && 'จับคู่กับด้าย DMC ที่ใกล้ที่สุด พร้อมรหัสสำหรับซื้อด้าย'}
                {opts.paletteMode === 'exact' && 'ใช้สีเฉลี่ยจากรูปตรงๆ (ต้องหาด้ายสีใกล้เคียงเอง)'}
                {opts.paletteMode === 'current' && `ใช้เฉพาะ ${pattern.palette.length} สีที่มีในจานสีตอนนี้`}
              </p>

              <label>ขนาดรูป: <b>{Math.round(opts.scale * 100)}%</b>
                <input type="range" min={0.3} max={2} step={0.05} value={opts.scale} onChange={(e) => set({ scale: +e.target.value })} />
              </label>
              <div className="row2">
                <label>เลื่อนซ้าย-ขวา
                  <input type="range" min={-0.5} max={0.5} step={0.01} value={opts.offsetX} onChange={(e) => set({ offsetX: +e.target.value })} />
                </label>
                <label>เลื่อนขึ้น-ลง
                  <input type="range" min={-0.5} max={0.5} step={0.01} value={opts.offsetY} onChange={(e) => set({ offsetY: +e.target.value })} />
                </label>
              </div>

              <label className="check">
                <input type="checkbox" checked={opts.autoCrop} onChange={(e) => set({ autoCrop: e.target.checked })} />
                <span>ตัดขอบว่างรอบรูปออก <small>(ให้ลายเต็มพื้นที่)</small></span>
              </label>
              <label className="check">
                <input type="checkbox" checked={opts.skipBackground} disabled={!src.bg}
                  onChange={(e) => set({ skipBackground: e.target.checked })} />
                <span>ไม่ปักพื้นหลัง
                  {src.bgHex ? <i className="bg-swatch" style={{ background: src.bgHex }} /> : <small> (ไม่พบพื้นสีเรียบ{src.hasAlpha ? ' · ใช้ความโปร่งใสแทน' : ''})</small>}
                </span>
              </label>
              {src.bg && opts.skipBackground && (
                <label>ความไวในการตัดพื้นหลัง
                  <input type="range" min={3} max={45} value={opts.bgTolerance} onChange={(e) => set({ bgTolerance: +e.target.value })} />
                </label>
              )}
              <label className="check">
                <input type="checkbox" checked={opts.cleanup} onChange={(e) => set({ cleanup: e.target.checked })} />
                <span>ลดจุดเดี่ยวๆ ให้ปักง่ายขึ้น</span>
              </label>
              <label className="check">
                <input type="checkbox" checked={!opts.keepExisting} onChange={(e) => set({ keepExisting: !e.target.checked })} />
                <span>ล้างลายเดิมก่อน <small>(ไม่ติ๊ก = เติมเฉพาะช่องที่ยังว่าง)</small></span>
              </label>
              <label className="check">
                <input type="checkbox" checked={opts.pruneUnused} onChange={(e) => set({ pruneUnused: e.target.checked })} />
                <span>ลบสีที่ไม่ได้ใช้ออกจากจานสี</span>
              </label>
            </div>

            <div className="import-preview">
              <div className="import-canvas"><Thumb pattern={preview} max={440} view="stitch" /></div>
              {result && (
                <>
                  <p className="muted">{result.colorsUsed} สี · {result.stitched.toLocaleString()} ฝีเข็ม · ตาราง {pattern.cols}×{pattern.rows}</p>
                  <div className="chips">
                    {used.map(({ t, n }) => (
                      <span key={t.id} className="sym-chip" title={`${n} ฝีเข็ม`}>
                        <span className="sym sm" style={{ background: t.hex, color: contrastText(t.hex) }}>{t.symbol}</span>
                        {t.code || t.hex}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <footer className="modal-foot">
          <span className="hint">ปรับรายละเอียดต่อได้ด้วยเครื่องมือวาด และกดเลิกทำ (Ctrl/⌘+Z) ได้หากไม่ชอบ</span>
          <div className="spacer" />
          <button className="btn ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn primary" disabled={!result || !result.stitched}
            onClick={() => result && onApply(result.cells, result.palette, `นำเข้ารูปแล้ว: ${result.colorsUsed} สี, ${result.stitched.toLocaleString()} ฝีเข็ม`)}>
            <Icon name="check" size={16} /> ใช้ลายนี้
          </button>
        </footer>
      </div>
    </div>
  );
}
