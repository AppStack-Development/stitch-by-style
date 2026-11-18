import { useEffect, useMemo, useState } from 'react';
import type { Pattern } from '../types';
import { computeStats, fmtInch, fmtMm } from '../lib/stats';
import { BASE_LABEL, DIFFICULTY_LABEL, STITCH_LABEL } from '../lib/pattern';
import { contrastText } from '../lib/threads';
import { ChartSVG, type ChartMode } from '../components/ChartSVG';
import { Thumb } from '../components/Thumb';
import { Icon } from '../components/Icon';

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
    ['ขนาดชิ้นงาน', `${fmtMm(stats.widthMm)} × ${fmtMm(stats.heightMm)} (${fmtInch(stats.widthMm)} × ${fmtInch(stats.heightMm)})`],
    ['ตาราง', `${p.cols} × ${p.rows} ช่อง · ระยะห่าง ${p.pitchMm.toFixed(2)} มม.`],
    ['จำนวนฝีเข็ม', `${stats.total.toLocaleString()} ฝีเข็ม · ${used.length} สี`],
    ['พื้นที่ปัก', d.baseType === 'aida' ? `${BASE_LABEL.aida} ${d.aidaCount} ct` : BASE_LABEL[d.baseType] + (p.templateName ? ` — ${p.templateName}` : '')],
    ...(d.baseType === 'print3d' ? [['ชิ้นงาน 3D', `${d.filament}, หนา ${d.thicknessMm} มม., รู ${(p.pitchMm * d.holeRatio).toFixed(2)} มม.`] as [string, string]] : []),
    ['รูปแบบการปัก', STITCH_LABEL[d.stitchType]],
    ['ด้าย', `${d.threadBrand || '-'} · ใช้ ${d.strands} เส้น`],
    ['เข็ม', `${d.needleType} ${d.needleSize}`],
    ['ระดับความยาก', DIFFICULTY_LABEL[d.difficulty] + (d.estHours ? ` · ประมาณ ${d.estHours}` : '')],
  ];

  return (
    <div className="print-root">
      <div className="print-toolbar no-print">
        {onBack
          ? <button className="btn ghost" onClick={onBack}><Icon name="back" size={16} /> กลับ</button>
          : <a className="btn ghost" href={backHref}><Icon name="back" size={16} /> กลับ</a>}
        <div className="seg">
          {([['both', 'สี + สัญลักษณ์'], ['symbol', 'สัญลักษณ์ (ขาวดำ)'], ['color', 'สีอย่างเดียว']] as const).map(([v, l]) => (
            <button key={v} className={mode === v ? 'on' : ''} onClick={() => setMode(v)}>{l}</button>
          ))}
        </div>
        <label className="inline">ช่องต่อหน้า
          <select value={perPage} onChange={(e) => setPerPage(+e.target.value)}>
            {[25, 30, 40, 50, 60].map((n) => <option key={n} value={n}>{n} คอลัมน์</option>)}
          </select>
        </label>
        <span className="muted">{pages.length + 1} หน้า (A4)</span>
        <div className="spacer" />
        <button className="btn primary" onClick={() => window.print()}><Icon name="print" size={16} /> พิมพ์ / บันทึก PDF</button>
      </div>

      <div className="sheet">
        <header className="sheet-head">
          <div>
            <h1>{p.name}</h1>
            <p className="muted">
              {d.author && <>ออกแบบโดย {d.author} · </>}
              {new Date(p.updatedAt).toLocaleDateString('th-TH', { dateStyle: 'long' })}
              {d.tags.length > 0 && <> · {d.tags.map((t) => '#' + t).join(' ')}</>}
            </p>
          </div>
          <span className="sheet-brand">Stitch by Style</span>
        </header>
        <div className="sheet-cover">
          <div className="sheet-thumb"><Thumb pattern={p} max={260} view="stitch" /></div>
          <table className="info-table"><tbody>{rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
        </div>
        {d.description && <p className="sheet-desc">{d.description}</p>}
        <h3>รายการด้าย</h3>
        <table className="legend-table">
          <thead><tr><th>สัญลักษณ์</th><th>ยี่ห้อ / รหัส</th><th>ชื่อสี</th><th>ฝีเข็ม</th><th>ความยาว*</th><th>ไจ</th><th>✓</th></tr></thead>
          <tbody>
            {used.map((c) => {
              const t = p.palette[c.index];
              return (
                <tr key={t.id}>
                  <td><span className="sym" style={{ background: mode === 'symbol' ? '#fff' : t.hex, color: mode === 'symbol' ? '#111' : contrastText(t.hex) }}>{t.symbol}</span></td>
                  <td>{[t.brand, t.code].filter(Boolean).join(' ') || '-'}</td>
                  <td>{t.name}</td>
                  <td>{c.count.toLocaleString()}</td>
                  <td>{c.strandM.toFixed(1)} ม.</td>
                  <td>{Math.max(0.1, c.skeins).toFixed(1)}</td>
                  <td><span className="checkbox" /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="hint">*ความยาวด้ายเส้นเดี่ยวรวม ({d.strands} เส้น) โดยประมาณ เผื่อเก็บปลาย 20% · 1 ไจ = 8 ม. × 6 เส้น · ▲ สีแดง = จุดกึ่งกลาง · ช่องลายเฉียง = โครงทึบ</p>
        {d.notes && (
          <>
            <h3>บันทึก / ขั้นตอน</h3>
            <p className="sheet-notes">{d.notes}</p>
          </>
        )}
      </div>

      {pages.map((pg, i) => (
        <div className="sheet chart-sheet" key={i}>
          <header className="sheet-head small">
            <b>{p.name}</b>
            <span className="muted">แผนผังหน้า {i + 1}/{pages.length} · คอลัมน์ {pg.x0 + 1}–{pg.x1} · แถว {pg.y0 + 1}–{pg.y1}</span>
          </header>
          <ChartSVG pattern={p} {...pg} cellMm={cellMm} mode={mode} />
          <div className="chart-legend">
            {used.map((c) => {
              const t = p.palette[c.index];
              return (
                <span key={t.id}>
                  <span className="sym sm" style={{ background: mode === 'symbol' ? '#fff' : t.hex, color: mode === 'symbol' ? '#111' : contrastText(t.hex) }}>{t.symbol}</span>
                  {t.code || t.name}
                </span>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
