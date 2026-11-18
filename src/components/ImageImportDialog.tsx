import { useEffect, useMemo, useRef, useState } from 'react';
import type { Pattern, ThreadColor } from '../types';
import { DEFAULT_IMPORT, convertImage, loadSourceImage, type ImportOpts, type ImportResult, type SourceImage } from '../lib/imageImport';
import { contrastText } from '../lib/threads';
import { Thumb } from './Thumb';
import { Icon } from './Icon';
import { t } from '../lib/i18n';

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
      <div className="modal" role="dialog" aria-label={t('แปลงรูปภาพเป็นลายปัก', 'Image to pattern')}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}>
        <header className="modal-head">
          <h3><Icon name="image" /> {t('แปลงรูปภาพเป็นลายปัก', 'Image to pattern')}</h3>
          <button className="icon-btn" onClick={onClose} title={t('ปิด (Esc)', 'Close (Esc)')}><Icon name="close" /></button>
        </header>
        <input ref={fileRef} type="file" accept="image/*" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) open(f); e.target.value = ''; }} />

        {!src ? (
          <button className={'drop-zone' + (dragOver ? ' over' : '')} onClick={() => fileRef.current?.click()}>
            <Icon name="upload" size={36} />
            <b>{busy ? t('กำลังเปิดรูป…', 'Opening image…') : t('เลือกรูป ลากมาวาง หรือกด Ctrl/⌘+V เพื่อวางรูป', 'Choose an image, drag it here, or paste with Ctrl/⌘+V')}</b>
            <span>{t('PNG / JPG / WebP · รูปพื้นหลังโปร่งใสหรือพื้นสีเรียบ ภาพการ์ตูน โลโก้ ให้ผลดีที่สุด', 'PNG / JPG / WebP · works best with transparent or plain backgrounds, cartoons and logos')}</span>
            {err && <span className="error">{err}</span>}
          </button>
        ) : (
          <div className="modal-body">
            <div className="import-controls">
              <div className="src-row">
                <img src={srcUrl} alt={t('รูปต้นฉบับ', 'Original image')} className="src-img" />
                <div>
                  <small className="muted">{src.width}×{src.height} px</small>
                  <button className="btn sm" onClick={() => fileRef.current?.click()}><Icon name="upload" size={14} /> {t('เปลี่ยนรูป', 'Change image')}</button>
                </div>
              </div>

              <label>{t('จำนวนสีสูงสุด:', 'Max colors:')} <b>{opts.colors}</b>
                <input type="range" min={2} max={24} value={opts.colors} disabled={opts.paletteMode === 'current'}
                  onChange={(e) => set({ colors: +e.target.value })} />
              </label>
              <label>{t('เลือกสีด้ายจาก', 'Thread colors from')}
                <div className="seg full">
                  {([['dmc', t('ด้าย DMC', 'DMC threads')], ['exact', t('สีตามรูป', 'Image colors')], ['current', t('จานสีปัจจุบัน', 'Current palette')]] as const).map(([v, l]) => (
                    <button key={v} className={opts.paletteMode === v ? 'on' : ''} onClick={() => set({ paletteMode: v })}>{l}</button>
                  ))}
                </div>
              </label>
              <p className="hint">
                {opts.paletteMode === 'dmc' && t('จับคู่กับด้าย DMC ที่ใกล้ที่สุด พร้อมรหัสสำหรับซื้อด้าย', 'Matches the closest DMC threads, with codes for buying')}
                {opts.paletteMode === 'exact' && t('ใช้สีเฉลี่ยจากรูปตรงๆ (ต้องหาด้ายสีใกล้เคียงเอง)', 'Uses the image’s colors as they are (you find matching threads yourself)')}
                {opts.paletteMode === 'current' && t(`ใช้เฉพาะ ${pattern.palette.length} สีที่มีในจานสีตอนนี้`, `Uses only the ${pattern.palette.length} ${pattern.palette.length === 1 ? 'color' : 'colors'} in your current palette`)}
              </p>

              <label>{t('ขนาดรูป:', 'Image size:')} <b>{Math.round(opts.scale * 100)}%</b>
                <input type="range" min={0.3} max={2} step={0.05} value={opts.scale} onChange={(e) => set({ scale: +e.target.value })} />
              </label>
              <div className="row2">
                <label>{t('เลื่อนซ้าย-ขวา', 'Move left-right')}
                  <input type="range" min={-0.5} max={0.5} step={0.01} value={opts.offsetX} onChange={(e) => set({ offsetX: +e.target.value })} />
                </label>
                <label>{t('เลื่อนขึ้น-ลง', 'Move up-down')}
                  <input type="range" min={-0.5} max={0.5} step={0.01} value={opts.offsetY} onChange={(e) => set({ offsetY: +e.target.value })} />
                </label>
              </div>

              <label className="check">
                <input type="checkbox" checked={opts.autoCrop} onChange={(e) => set({ autoCrop: e.target.checked })} />
                <span>{t(<>ตัดขอบว่างรอบรูปออก <small>(ให้ลายเต็มพื้นที่)</small></>, <>Trim empty edges <small>(fill the whole area)</small></>)}</span>
              </label>
              <label className="check">
                <input type="checkbox" checked={opts.skipBackground} disabled={!src.bg}
                  onChange={(e) => set({ skipBackground: e.target.checked })} />
                <span>{t('ไม่ปักพื้นหลัง', 'Skip the background')}
                  {src.bgHex ? <i className="bg-swatch" style={{ background: src.bgHex }} /> : <small>{t(` (ไม่พบพื้นสีเรียบ${src.hasAlpha ? ' · ใช้ความโปร่งใสแทน' : ''})`, ` (no plain background found${src.hasAlpha ? ' · using transparency instead' : ''})`)}</small>}
                </span>
              </label>
              {src.bg && opts.skipBackground && (
                <label>{t('ความไวในการตัดพื้นหลัง', 'Background removal sensitivity')}
                  <input type="range" min={3} max={45} value={opts.bgTolerance} onChange={(e) => set({ bgTolerance: +e.target.value })} />
                </label>
              )}
              <label className="check">
                <input type="checkbox" checked={opts.cleanup} onChange={(e) => set({ cleanup: e.target.checked })} />
                <span>{t('ลดจุดเดี่ยวๆ ให้ปักง่ายขึ้น', 'Remove stray single stitches')}</span>
              </label>
              <label className="check">
                <input type="checkbox" checked={!opts.keepExisting} onChange={(e) => set({ keepExisting: !e.target.checked })} />
                <span>{t(<>ล้างลายเดิมก่อน <small>(ไม่ติ๊ก = เติมเฉพาะช่องที่ยังว่าง)</small></>, <>Clear the current pattern first <small>(unticked = fill empty cells only)</small></>)}</span>
              </label>
              <label className="check">
                <input type="checkbox" checked={opts.pruneUnused} onChange={(e) => set({ pruneUnused: e.target.checked })} />
                <span>{t('ลบสีที่ไม่ได้ใช้ออกจากจานสี', 'Remove unused colors from the palette')}</span>
              </label>
            </div>

            <div className="import-preview">
              <div className="import-canvas"><Thumb pattern={preview} max={440} view="stitch" /></div>
              {result && (
                <>
                  <p className="muted">{t(<>{result.colorsUsed} สี · {result.stitched.toLocaleString()} ฝีเข็ม · ตาราง {pattern.cols}×{pattern.rows}</>, <>{result.colorsUsed} {result.colorsUsed === 1 ? 'color' : 'colors'} · {result.stitched.toLocaleString()} {result.stitched === 1 ? 'stitch' : 'stitches'} · grid {pattern.cols}×{pattern.rows}</>)}</p>
                  <div className="chips">
                    {used.map(({ t: tc, n }) => (
                      <span key={tc.id} className="sym-chip" title={t(`${n} ฝีเข็ม`, `${n} ${n === 1 ? 'stitch' : 'stitches'}`)}>
                        <span className="sym sm" style={{ background: tc.hex, color: contrastText(tc.hex) }}>{tc.symbol}</span>
                        {tc.code || tc.hex}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <footer className="modal-foot">
          <span className="hint hide-xs">{t('ปรับรายละเอียดต่อได้ด้วยเครื่องมือวาด และกดเลิกทำ (Ctrl/⌘+Z) ได้หากไม่ชอบ', 'Refine it with the drawing tools afterwards, or undo (Ctrl/⌘+Z) if you don’t like it')}</span>
          <div className="spacer" />
          <button className="btn ghost" onClick={onClose}>{t('ยกเลิก', 'Cancel')}</button>
          <button className="btn primary" disabled={!result || !result.stitched}
            onClick={() => result && onApply(result.cells, result.palette, t(`นำเข้ารูปแล้ว: ${result.colorsUsed} สี, ${result.stitched.toLocaleString()} ฝีเข็ม`, `Image imported: ${result.colorsUsed} ${result.colorsUsed === 1 ? 'color' : 'colors'}, ${result.stitched.toLocaleString()} ${result.stitched === 1 ? 'stitch' : 'stitches'}`))}>
            <Icon name="check" size={16} /> {t('ใช้ลายนี้', 'Use pattern')}
          </button>
        </footer>
      </div>
    </div>
  );
}
