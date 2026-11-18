import { useEffect, useMemo, useState } from 'react';
import type { Pattern } from '../types';
import { computeStats, fmtInch, fmtMm } from '../lib/stats';
import { BASE_LABEL, DIFFICULTY_LABEL, STITCH_LABEL } from '../lib/pattern';
import { contrastText } from '../lib/threads';
import { ChartSVG, type ChartMode } from '../components/ChartSVG';
import { Thumb } from '../components/Thumb';
import { Icon } from '../components/Icon';
import { t, locale } from '../lib/i18n';

interface Props {
  pattern: Pattern;
  backHref?: string;
  onBack?: () => void;
}

export function PrintView({ pattern: p, backHref = '#/', onBack }: Props) {
  const [mode, setMode] = useState<ChartMode>('both');
  const [perPage, setPerPage] = useState(40);
  const stats = useMemo(() => computeStats(p), [p]);

  // A4 is 210 mm (~794 px) wide: scale the on-screen sheets down on narrow screens
  useEffect(() => {
    // clientWidth is the layout viewport; on phones innerWidth grows with wide content
    const fit = () => document.documentElement.style.setProperty('--sheet-zoom', String(Math.min(1, (document.documentElement.clientWidth - 16) / 794)));
    fit();
    window.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
      document.documentElement.style.removeProperty('--sheet-zoom');
    };
  }, []);
  const d = p.details;
  const used = stats.colors.filter((c) => c.count > 0);
  const area = stats.piece ?? { x0: 0, y0: 0, x1: p.cols - 1, y1: p.rows - 1 };

  // split the chart into A4-sized pages
  const pageCols = perPage, pageRows = Math.round(perPage * 1.35);
  const pages: { x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let y = area.y0; y <= area.y1; y += pageRows) {
    for (let x = area.x0; x <= area.x1; x += pageCols) {
      pages.push({ x0: x, y0: y, x1: Math.min(area.x1 + 1, x + pageCols), y1: Math.min(area.y1 + 1, y + pageRows) });
    }
  }
  const spanW = Math.min(pageCols, area.x1 - area.x0 + 1), spanH = Math.min(pageRows, area.y1 - area.y0 + 1);
  const cellMm = Math.min(7, 178 / (spanW + 3), 240 / (spanH + 3));

  const rows: [string, string][] = [
    [t('ขนาดชิ้นงาน', 'Finished size'), `${fmtMm(stats.widthMm)} × ${fmtMm(stats.heightMm)} (${fmtInch(stats.widthMm)} × ${fmtInch(stats.heightMm)})`],
    [t('ตาราง', 'Grid'), t(`${p.cols} × ${p.rows} ช่อง · ระยะห่าง ${p.pitchMm.toFixed(2)} มม.`, `${p.cols} × ${p.rows} cells · ${p.pitchMm.toFixed(2)} mm pitch`)],
    [t('จำนวนฝีเข็ม', 'Stitches'), t(`${stats.total.toLocaleString()} ฝีเข็ม · ${used.length} สี`, `${stats.total.toLocaleString()} stitches · ${used.length} ${used.length === 1 ? 'color' : 'colors'}`)],
    [t('พื้นที่ปัก', 'Stitched on'), d.baseType === 'aida' ? `${BASE_LABEL.aida} ${d.aidaCount} ct` : BASE_LABEL[d.baseType] + (p.templateName ? ` — ${p.templateName}` : '')],
    ...(d.baseType === 'print3d' ? [[t('ชิ้นงาน 3D', '3D piece'), t(`${d.filament}, หนา ${d.thicknessMm} มม., รู ${(p.pitchMm * d.holeRatio).toFixed(2)} มม.`, `${d.filament}, ${d.thicknessMm} mm thick, ${(p.pitchMm * d.holeRatio).toFixed(2)} mm holes`)] as [string, string]] : []),
    [t('รูปแบบการปัก', 'Stitch type'), STITCH_LABEL[d.stitchType]],
    [t('ด้าย', 'Thread'), t(`${d.threadBrand || '-'} · ใช้ ${d.strands} เส้น`, `${d.threadBrand || '-'} · ${d.strands} ${d.strands === 1 ? 'strand' : 'strands'}`)],
    [t('เข็ม', 'Needle'), `${d.needleType} ${d.needleSize}`],
    [t('ระดับความยาก', 'Difficulty'), DIFFICULTY_LABEL[d.difficulty] + (d.estHours ? t(` · ประมาณ ${d.estHours}`, ` · about ${d.estHours}`) : '')],
  ];

  return (
    <div className="print-root">
      <div className="print-toolbar no-print">
        {onBack
          ? <button className="btn ghost" onClick={onBack}><Icon name="back" size={16} /> {t('กลับ', 'Back')}</button>
          : <a className="btn ghost" href={backHref}><Icon name="back" size={16} /> {t('กลับ', 'Back')}</a>}
        <div className="seg">
          {([['both', t('สี + สัญลักษณ์', 'Color + symbol')], ['symbol', t('สัญลักษณ์ (ขาวดำ)', 'Symbols (B&W)')], ['color', t('สีอย่างเดียว', 'Color only')]] as const).map(([v, l]) => (
            <button key={v} className={mode === v ? 'on' : ''} onClick={() => setMode(v)}>{l}</button>
          ))}
        </div>
        <label className="inline">{t('ช่องต่อหน้า', 'Cells per page')}
          <select value={perPage} onChange={(e) => setPerPage(+e.target.value)}>
            {[25, 30, 40, 50, 60].map((n) => <option key={n} value={n}>{t(`${n} คอลัมน์`, `${n} columns`)}</option>)}
          </select>
        </label>
        <span className="muted">{t(`${pages.length + 1} หน้า (A4)`, `${pages.length + 1} pages (A4)`)}</span>
        <div className="spacer" />
        <button className="btn primary" onClick={() => window.print()}><Icon name="print" size={16} /> {t('พิมพ์ / บันทึก PDF', 'Print / save PDF')}</button>
      </div>

      <div className="sheet">
        <header className="sheet-head">
          <div>
            <h1>{p.name}</h1>
            <p className="muted">
              {d.author && <>{t('ออกแบบโดย', 'Designed by')} {d.author} · </>}
              {new Date(p.updatedAt).toLocaleDateString(locale, { dateStyle: 'long' })}
              {d.tags.length > 0 && <> · {d.tags.map((tag) => '#' + tag).join(' ')}</>}
            </p>
          </div>
          <span className="sheet-brand">Stitch by Style</span>
        </header>
        <div className="sheet-cover">
          <div className="sheet-thumb"><Thumb pattern={p} max={260} view="stitch" /></div>
          <table className="info-table"><tbody>{rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
        </div>
        {d.description && <p className="sheet-desc">{d.description}</p>}
        <h3>{t('รายการด้าย', 'Thread list')}</h3>
        <table className="legend-table">
          <thead><tr><th>{t('สัญลักษณ์', 'Symbol')}</th><th>{t('ยี่ห้อ / รหัส', 'Brand / code')}</th><th>{t('ชื่อสี', 'Color name')}</th><th>{t('ฝีเข็ม', 'Stitches')}</th><th>{t('ความยาว*', 'Length*')}</th><th>{t('ไจ', 'Skeins')}</th><th>✓</th></tr></thead>
          <tbody>
            {used.map((c) => {
              const thr = p.palette[c.index];
              return (
                <tr key={thr.id}>
                  <td><span className="sym" style={{ background: mode === 'symbol' ? '#fff' : thr.hex, color: mode === 'symbol' ? '#111' : contrastText(thr.hex) }}>{thr.symbol}</span></td>
                  <td>{[thr.brand, thr.code].filter(Boolean).join(' ') || '-'}</td>
                  <td>{thr.name}</td>
                  <td>{c.count.toLocaleString()}</td>
                  <td>{c.strandM.toFixed(1)} {t('ม.', 'm')}</td>
                  <td>{Math.max(0.1, c.skeins).toFixed(1)}</td>
                  <td><span className="checkbox" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="hint">{t(<>*ความยาวด้ายเส้นเดี่ยวรวม ({d.strands} เส้น) โดยประมาณ เผื่อเก็บปลาย 20% · 1 ไจ = 8 ม. × 6 เส้น · ▲ สีแดง = จุดกึ่งกลาง · ช่องลายเฉียง = โครงทึบ</>, <>*Approx. total single-strand length ({d.strands} strands), plus 20% for finishing ends · 1 skein = 8 m × 6 strands · red ▲ = center · hatched cells = solid frame</>)}</p>
        {d.notes && (
          <>
            <h3>{t('บันทึก / ขั้นตอน', 'Notes / steps')}</h3>
            <p className="sheet-notes">{d.notes}</p>
          </>
        )}
      </div>

      {pages.map((pg, i) => (
        <div className="sheet chart-sheet" key={i}>
          <header className="sheet-head small">
            <b>{p.name}</b>
            <span className="muted">{t(<>แผนผังหน้า {i + 1}/{pages.length} · คอลัมน์ {pg.x0 + 1}–{pg.x1} · แถว {pg.y0 + 1}–{pg.y1}</>, <>Chart page {i + 1}/{pages.length} · columns {pg.x0 + 1}–{pg.x1} · rows {pg.y0 + 1}–{pg.y1}</>)}</span>
          </header>
          <ChartSVG pattern={p} {...pg} cellMm={cellMm} mode={mode} />
          <div className="chart-legend">
            {used.map((c) => {
              const thr = p.palette[c.index];
              return (
                <span key={thr.id}>
                  <span className="sym sm" style={{ background: mode === 'symbol' ? '#fff' : thr.hex, color: mode === 'symbol' ? '#111' : contrastText(thr.hex) }}>{thr.symbol}</span>
                  {thr.code || thr.name}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
