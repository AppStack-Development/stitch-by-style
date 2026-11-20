import { useMemo, useState } from 'react';
import type { Pattern, ThreadColor } from '../types';
import { DMC_SORTED, SYMBOLS, contrastText, makeThread } from '../lib/threads';
import { colorSortKey } from '../lib/dmc';
import { nearestDmc } from '../lib/imageImport';
import { computeStats } from '../lib/stats';
import { ownsThread, useStash } from '../lib/stash';
import { Icon } from './Icon';
import { t } from '../lib/i18n';

const FAMILIES: { id: string; label: string; buckets: number[] | 'neutral' }[] = [
  { id: 'all', label: t('ทั้งหมด', 'All'), buckets: [] },
  { id: 'red', label: t('แดง/ชมพู', 'Red/pink'), buckets: [0, 11] },
  { id: 'orange', label: t('ส้ม/น้ำตาล', 'Orange/brown'), buckets: [1] },
  { id: 'yellow', label: t('เหลือง/ทอง', 'Yellow/gold'), buckets: [2] },
  { id: 'green', label: t('เขียว', 'Green'), buckets: [3, 4, 5] },
  { id: 'blue', label: t('ฟ้า/น้ำเงิน', 'Blue'), buckets: [6, 7, 8] },
  { id: 'purple', label: t('ม่วง', 'Purple'), buckets: [9, 10] },
  { id: 'neutral', label: t('ขาว/เทา/ดำ', 'White/gray/black'), buckets: 'neutral' },
];

function inFamily(hex: string, fam: (typeof FAMILIES)[number]): boolean {
  if (fam.id === 'all') return true;
  const [neutral, bucket] = colorSortKey(hex);
  if (fam.buckets === 'neutral') return neutral === 1;
  return neutral === 0 && fam.buckets.includes(bucket);
}

interface Props {
  pattern: Pattern;
  active: number;
  setActive: (i: number) => void;
  /** replace palette; optional remap(oldIndex) -> newIndex for cells */
  onPalette: (palette: ThreadColor[], remap?: (i: number) => number) => void;
}

/** Offer the closest real DMC thread for a palette colour that isn't one already. */
function DmcSuggest({ color, onApply }: { color: ThreadColor; onApply: (d: { hex: string; name: string; code: string }) => void }) {
  const best = useMemo(() => nearestDmc(color.hex, 1)[0], [color.hex]);
  // a DMC code typed by hand that doesn't match the swatch: offer that thread's real colour and name
  const typed = useMemo(() => {
    if (color.brand.trim().toUpperCase() !== 'DMC') return undefined;
    const code = color.code.trim().toUpperCase();
    return DMC_SORTED.find((d) => d.code.toUpperCase() === code);
  }, [color.brand, color.code]);
  if (typed && (typed.hex.toLowerCase() !== color.hex.toLowerCase() || typed.name !== color.name)) {
    return (
      <div className="dmc-suggest">
        <span className="dot" style={{ background: typed.hex }} />
        <span>{t('รหัสนี้คือ', 'This code is')} <b>DMC {typed.code}</b> {typed.name}</span>
        <button className="btn sm" onClick={() => onApply(typed)}>{t('ใช้สีตามรหัส', 'Use its colour')}</button>
      </div>
    );
  }
  if (color.brand === 'DMC' && color.code === best.code) return null;
  return (
    <div className="dmc-suggest">
      <span className="dot" style={{ background: best.hex }} />
      <span>{t('ด้ายที่ใกล้ที่สุด:', 'Closest thread:')} <b>DMC {best.code}</b> {best.name} <small>(ΔE {best.dE.toFixed(1)})</small></span>
      <button className="btn sm" onClick={() => onApply(best)}>{t('ใช้สีนี้', 'Use this')}</button>
    </div>
  );
}

export function PalettePanel({ pattern: p, active, setActive, onPalette }: Props) {
  const [editing, setEditing] = useState<number | null>(null);
  const [lib, setLib] = useState(false);
  const [q, setQ] = useState('');
  const [family, setFamily] = useState('all');
  const [probe, setProbe] = useState('#c8507a');
  const stats = useMemo(() => computeStats(p), [p]);
  const { codes: stash } = useStash();

  const update = (i: number, patch: Partial<ThreadColor>) =>
    onPalette(p.palette.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const remove = (i: number) => {
    const count = stats.colors[i]?.count ?? 0;
    if (count > 0 && !confirm(t(`สีนี้ใช้อยู่ ${count} ช่อง ต้องการลบและล้างช่องเหล่านั้นหรือไม่?`, `This color is used in ${count} ${count === 1 ? 'cell' : 'cells'}. Delete it and clear ${count === 1 ? 'that cell' : 'those cells'}?`))) return;
    onPalette(p.palette.filter((_, j) => j !== i), (k) => (k === i ? -1 : k > i ? k - 1 : k));
    setEditing(null);
    if (active >= p.palette.length - 1) setActive(Math.max(0, p.palette.length - 2));
  };

  const add = (t: Partial<ThreadColor> & { hex: string }) => {
    const exists = p.palette.findIndex((c) => c.code && c.code === t.code && c.brand === t.brand);
    if (exists >= 0) {
      setActive(exists);
      return;
    }
    onPalette([...p.palette, makeThread(t, p.palette)]);
    setActive(p.palette.length);
  };

  const fam = FAMILIES.find((f) => f.id === family)!;
  const ql = q.trim().toLowerCase();
  const filtered = DMC_SORTED.filter(
    (d) => inFamily(d.hex, fam) && (!ql || d.code.toLowerCase().includes(ql) || d.name.toLowerCase().includes(ql)),
  );
  const inPalette = new Set(p.palette.filter((c) => c.brand === 'DMC').map((c) => c.code));
  const probeMatches = useMemo(() => nearestDmc(probe, 6), [probe]);

  return (
    <div className="panel-body">
      <div className="palette-list">
        {p.palette.map((c, i) => (
          <div key={c.id} className={'palette-row' + (i === active ? ' active' : '')}>
            <button className="swatch" style={{ background: c.hex, color: contrastText(c.hex) }}
              onClick={() => setActive(i)} title={t(`เลือกสี (${i < 9 ? 'กด ' + (i + 1) : ''})`, `Select color (${i < 9 ? 'press ' + (i + 1) : ''})`)}>
              {c.symbol}
            </button>
            <button className="palette-label" onClick={() => setActive(i)}>
              <span className="pl-code">
                {[c.brand, c.code].filter(Boolean).join(' ') || t('กำหนดเอง', 'Custom')}
                {ownsThread(stash, c) && (
                  <span className="have-badge" title={t('อยู่ใน “ด้ายของฉัน” แล้ว', 'In “My threads”')}>
                    <Icon name="check" size={11} /><span>{t('มีแล้ว', 'Have')}</span>
                  </span>
                )}
              </span>
              <span className="pl-name">{c.name}</span>
            </button>
            <span className="pl-count" title={t('จำนวนฝีเข็ม', 'Stitches')}>{stats.colors[i]?.count ?? 0}</span>
            <button className="icon-btn sm" onClick={() => setEditing(editing === i ? null : i)} title={t('แก้ไขสี', 'Edit color')}>
              <Icon name="edit" size={15} />
            </button>
            {editing === i && (
              <div className="palette-edit">
                <label>{t('สี', 'Color')}<input type="color" value={c.hex} onChange={(e) => update(i, { hex: e.target.value })} /></label>
                <label>{t('ชื่อสี', 'Color name')}<input value={c.name} onChange={(e) => update(i, { name: e.target.value })} /></label>
                <div className="row2">
                  <label>{t('ยี่ห้อ', 'Brand')}<input value={c.brand} onChange={(e) => update(i, { brand: e.target.value })} placeholder="DMC, Anchor…" /></label>
                  <label>{t('รหัสสี', 'Code')}<input value={c.code} onChange={(e) => update(i, { code: e.target.value })} /></label>
                </div>
                <label>{t('สัญลักษณ์ในแผนผัง', 'Chart symbol')}
                  <select value={c.symbol} onChange={(e) => update(i, { symbol: e.target.value })}>
                    {SYMBOLS.map((s) => (
                      <option key={s} value={s} disabled={s !== c.symbol && p.palette.some((o) => o.symbol === s)}>{s}</option>
                    ))}
                  </select>
                </label>
                <DmcSuggest color={c} onApply={(d) => update(i, { hex: d.hex, name: d.name, code: d.code, brand: 'DMC' })} />
                <button className="btn danger sm" onClick={() => remove(i)}><Icon name="trash" size={15} /> {t('ลบสีนี้', 'Delete color')}</button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="palette-add">
        <button className="btn sm" onClick={() => setLib(!lib)}><Icon name="palette" size={15} /> {t('เลือกจากด้าย DMC', 'Pick DMC thread')}</button>
        <label className="btn sm ghost color-add">
          <Icon name="plus" size={15} /> {t('สีกำหนดเอง', 'Custom color')}
          <input type="color" onChange={(e) => add({ hex: e.target.value, name: t('สีกำหนดเอง ', 'Custom ') + e.target.value })} />
        </label>
      </div>
      {lib && (
        <div className="lib">
          <div className="probe">
            <label className="probe-pick" title={t('เลือกสีที่ต้องการ แล้วระบบจะหาด้าย DMC ที่ใกล้ที่สุด', 'Pick any color and we’ll find the closest DMC threads')}>
              <input type="color" value={probe} onChange={(e) => setProbe(e.target.value)} />
            </label>
            <div className="probe-body">
              <b>{t('หาด้ายที่ใกล้สีนี้', 'Find threads close to this color')}</b>
              <div className="probe-list">
                {probeMatches.map((d) => (
                  <button key={d.code} className="lib-chip" title={t(`DMC ${d.code} ${d.name} · ต่างกัน ΔE ${d.dE.toFixed(1)}`, `DMC ${d.code} ${d.name} · difference ΔE ${d.dE.toFixed(1)}`)}
                    onClick={() => add({ hex: d.hex, name: d.name, code: d.code, brand: 'DMC' })}>
                    <span style={{ background: d.hex }} />{d.code}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <input className="lib-search" placeholder={t('ค้นหารหัสหรือชื่อสี เช่น 310, red, rose', 'Search code or name, e.g. 310, red, rose')} value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="fam-row">
            {FAMILIES.map((f) => (
              <button key={f.id} className={'chip sm' + (family === f.id ? ' on' : '')} onClick={() => setFamily(f.id)}>{f.label}</button>
            ))}
          </div>
          <div className="lib-grid">
            {filtered.map((d) => (
              <button key={d.code} className={'lib-chip' + (inPalette.has(d.code) ? ' have' : '') + (stash.has(d.code) ? ' own' : '')}
                title={`DMC ${d.code} ${d.name}` + (stash.has(d.code) ? t(' · มีแล้ว', ' · you have it') : '')}
                onClick={() => add({ hex: d.hex, name: d.name, code: d.code, brand: 'DMC' })}>
                <span style={{ background: d.hex }} />
                {d.code}
              </button>
            ))}
            {!filtered.length && <p className="muted">{t('ไม่พบสีที่ค้นหา', 'No matching colors')}</p>}
          </div>
          <p className="hint">{t(<>แสดง {filtered.length} จาก {DMC_SORTED.length} สี · ขีดเส้นใต้ = มีในจานสีแล้ว{stash.size > 0 && <> · จุดเขียว = มีด้ายนี้แล้ว</>} · สีบนจอเป็นค่าประมาณ ควรเทียบกับการ์ดสีจริงก่อนซื้อด้าย</>, <>Showing {filtered.length} of {DMC_SORTED.length} colors · underlined = already in palette{stash.size > 0 && <> · green dot = you have this thread</>} · screen colors are approximate, so check a real color card before buying thread</>)}</p>
        </div>
      )}
    </div>
  );
}
