import { useMemo, useState, type FormEvent } from 'react';
import { DMC_LIBRARY, DMC_SORTED, contrastText } from '../lib/threads';
import { useStash } from '../lib/stash';
import { Icon } from '../components/Icon';
import { AccountButton } from '../components/AccountButton';
import { t } from '../lib/i18n';

type Hue = 'red' | 'orange' | 'green' | 'blue' | 'purple' | 'brown' | 'neutral';

const HUES: { id: Hue | 'all'; label: string; dot?: string }[] = [
  { id: 'all', label: t('ทั้งหมด', 'All') },
  { id: 'red', label: t('แดง/ชมพู', 'Reds/pinks'), dot: '#c72b3b' },
  { id: 'orange', label: t('ส้ม/เหลือง', 'Oranges/yellows'), dot: '#f2a33d' },
  { id: 'green', label: t('เขียว', 'Greens'), dot: '#4f9a4f' },
  { id: 'blue', label: t('ฟ้า/น้ำเงิน', 'Blues'), dot: '#3b6fb3' },
  { id: 'purple', label: t('ม่วง', 'Purples'), dot: '#7d4fa3' },
  { id: 'brown', label: t('น้ำตาล/เบจ', 'Browns/beiges'), dot: '#8a5a3b' },
  { id: 'neutral', label: t('ขาว/เทา/ดำ', 'Neutrals'), dot: '#9aa0ad' },
];

/** Rough colour family from a hex value (HSL based). */
function hueOf(hex: string): Hue {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2, d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (s < 0.12 || d < 0.06) return 'neutral';
  let h = 0;
  if (max === r) h = ((g - b) / d + 6) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  // muted or dark oranges/yellows read as browns and beiges
  if (h >= 12 && h < 55 && (l < 0.42 || s < 0.45)) return 'brown';
  if (h >= 345 || h < 12) return 'red';
  if (h < 62) return 'orange';
  if (h < 170) return 'green';
  if (h < 255) return 'blue';
  if (h < 328) return 'purple';
  return 'red';
}

const HUE_OF = new Map(DMC_LIBRARY.map((d) => [d.code, hueOf(d.hex)]));
/** lower-case code → code as stored ("white" → "White", "b5200" → "B5200") */
const BY_CODE = new Map(DMC_LIBRARY.map((d) => [d.code.toLowerCase(), d.code]));
const ALIASES: Record<string, string> = { blanc: 'White', 'ขาว': 'White' };

/** Split "310, 321 666 / B5200; DMC ecru" into known DMC codes and unknown words. */
function parseCodes(text: string): { known: string[]; unknown: string[] } {
  const known: string[] = [], unknown: string[] = [];
  for (const raw of text.split(/[\s,;/、，|+]+/)) {
    const tok = raw.replace(/^#/, '').trim().toLowerCase();
    if (!tok || tok === 'dmc') continue;
    const code = BY_CODE.get(tok) ?? ALIASES[tok] ?? BY_CODE.get(tok.replace(/^dmc[-:]?/, ''));
    if (code) { if (!known.includes(code)) known.push(code); }
    else if (!unknown.includes(raw)) unknown.push(raw);
  }
  return { known, unknown };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function MyThreads() {
  const stash = useStash();
  const { codes } = stash;
  const [q, setQ] = useState('');
  const [hue, setHue] = useState<Hue | 'all'>('all');
  const [mineOnly, setMineOnly] = useState(false);
  const [quick, setQuick] = useState('');
  const [msg, setMsg] = useState<{ text: string; warn?: boolean } | null>(null);

  const owned = DMC_LIBRARY.filter((d) => codes.has(d.code)).length;

  const ql = q.trim().toLowerCase();
  const shown = useMemo(() => {
    const list = DMC_SORTED.filter((d) =>
      (hue === 'all' || HUE_OF.get(d.code) === hue)
      && (!mineOnly || codes.has(d.code))
      && (!ql || d.code.toLowerCase().includes(ql) || d.name.toLowerCase().includes(ql)));
    // an exact code ("310") goes first, then codes that start with the search
    if (ql) {
      const rank = (c: string) => (c.toLowerCase() === ql ? 0 : c.toLowerCase().startsWith(ql) ? 1 : 2);
      list.sort((a, b) => rank(a.code) - rank(b.code));
    }
    return list;
  }, [hue, mineOnly, ql, codes]);

  const quickAdd = (e: FormEvent) => {
    e.preventDefault();
    const { known, unknown } = parseCodes(quick);
    if (!known.length && !unknown.length) return;
    const fresh = known.filter((c) => !codes.has(c));
    if (fresh.length) stash.add(fresh);
    const already = known.length - fresh.length;
    const parts: string[] = [];
    if (fresh.length) parts.push(t(`เพิ่มแล้ว ${fresh.length} สี`, `Added ${plural(fresh.length, 'thread', 'threads')}`));
    if (already) parts.push(t(`มีอยู่แล้ว ${already} สี`, `${already} already in your list`));
    if (unknown.length) parts.push(t(`ไม่พบรหัส: ${unknown.join(', ')}`, `Unknown ${unknown.length === 1 ? 'code' : 'codes'}: ${unknown.join(', ')}`));
    setMsg({ text: parts.join(' · '), warn: unknown.length > 0 });
    // keep only the codes we couldn't read, so they can be fixed
    setQuick(unknown.join(' '));
  };

  const clearAll = () => {
    if (!confirm(t(`ลบด้ายทั้ง ${owned} สีออกจากรายการ “ด้ายของฉัน” หรือไม่?`, `Remove all ${plural(owned, 'thread', 'threads')} from “My threads”?`))) return;
    stash.replace([]);
    setMineOnly(false);
    setMsg(null);
  };

  return (
    <div className="threads-page">
      <header className="site-head">
        <a className="icon-btn" href="#/account" title={t('กลับไปหน้าของฉัน', 'Back to My stuff')} aria-label={t('กลับไปหน้าของฉัน', 'Back to My stuff')}><Icon name="back" /></a>
        <h2><Icon name="palette" size={18} /> {t('ด้ายของฉัน', 'My threads')}</h2>
        <span className={'th-count' + (owned ? ' on' : '')} aria-live="polite">
          {t(`มี ${owned} สี`, `${owned} owned`)}
        </span>
        <AccountButton />
      </header>

      <main className="threads-main">
        {owned === 0 && (
          <section className="th-empty">
            <h3>{t('บันทึกด้ายที่คุณมีอยู่แล้ว', 'Keep track of the threads you already own')}</h3>
            <ul>
              <li>{t(<>ตอนแปลงรูปเป็นลาย เลือก <b>“ด้ายที่ฉันมี”</b> เพื่อใช้เฉพาะสีที่มีอยู่ ไม่ต้องซื้อด้ายใหม่</>, <>When turning a photo into a pattern, choose <b>“My threads”</b> to use only colors you have, so there’s no new thread to buy</>)}</li>
              <li>{t('ในหน้าออกแบบและหน้าพิมพ์แผนผัง จะเห็นว่าสีไหนมีแล้ว สีไหนต้องซื้อ', 'The editor and the printed chart show which threads you have and which ones to buy')}</li>
            </ul>
            <p className="hint">{t('แตะสีด้านล่างเพื่อทำเครื่องหมายว่ามีแล้ว หรือพิมพ์รหัสหลายสีพร้อมกันในช่องด้านล่างนี้', 'Tap colors below to mark them as owned, or type several codes at once in the box below')}</p>
          </section>
        )}

        <form className="th-quick" onSubmit={quickAdd}>
          <label htmlFor="th-quick-in">{t('เพิ่มหลายสีพร้อมกัน', 'Add several at once')}</label>
          <div className="th-quick-row">
            <input id="th-quick-in" value={quick} onChange={(e) => setQuick(e.target.value)} autoComplete="off" autoCapitalize="off" spellCheck={false}
              placeholder={t('พิมพ์หรือวางรหัส DMC เช่น 310, 321 666 B5200', 'Type or paste DMC codes, e.g. 310, 321 666 B5200')} />
            <button className="btn primary" type="submit" disabled={!quick.trim()}><Icon name="plus" size={16} /> {t('เพิ่ม', 'Add')}</button>
          </div>
          {msg && <p className={'hint' + (msg.warn ? ' warn' : ' ok')} role="status">{msg.text}</p>}
        </form>

        <div className="th-filters">
          <div className="th-search">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('ค้นหาด้าย', 'Search threads')}
              placeholder={t('ค้นหารหัสหรือชื่อสี เช่น 310, red', 'Search code or name, e.g. 310, red')} />
            <button type="button" className={'chip th-mine' + (mineOnly ? ' on' : '')} aria-pressed={mineOnly} onClick={() => setMineOnly(!mineOnly)}>
              <Icon name="check" size={14} /> {t(`เฉพาะที่มี (${owned})`, `Only mine (${owned})`)}
            </button>
          </div>
          <div className="th-hues" role="group" aria-label={t('กลุ่มสี', 'Color family')}>
            {HUES.map((h) => (
              <button key={h.id} type="button" className={'chip' + (hue === h.id ? ' on' : '')} aria-pressed={hue === h.id} onClick={() => setHue(h.id)}>
                {h.dot && <i style={{ background: h.dot }} />}{h.label}
              </button>
            ))}
          </div>
        </div>

        <div className="th-grid">
          {shown.map((d) => {
            const own = codes.has(d.code);
            return (
              <button key={d.code} type="button" className={'th-sw' + (own ? ' own' : '')} aria-pressed={own}
                title={`DMC ${d.code} ${d.name}`} onClick={() => stash.toggle(d.code)}>
                <span className="th-color" style={{ background: d.hex, color: contrastText(d.hex) }}>
                  {own && <span className="th-tick"><Icon name="check" size={16} /></span>}
                </span>
                <span className="th-code">{d.code}</span>
                <span className="th-name">{d.name}</span>
              </button>
            );
          })}
        </div>
        {!shown.length && (
          <p className="th-none muted">
            {mineOnly && !owned
              ? t('ยังไม่ได้เลือกด้ายที่มี แตะ “เฉพาะที่มี” อีกครั้งเพื่อดูสีทั้งหมด', 'You haven’t marked any threads yet. Tap “Only mine” again to see all colors.')
              : t('ไม่พบสีที่ค้นหา', 'No matching colors')}
          </p>
        )}

        <footer className="th-foot">
          <p className="hint">
            {t(`แสดง ${shown.length} จาก ${DMC_SORTED.length} สี · `, `Showing ${shown.length} of ${DMC_SORTED.length} colors · `)}
            {t('บันทึกไว้ในเบราว์เซอร์ของเครื่องนี้ · สีบนจอเป็นค่าประมาณ ควรเทียบกับด้ายจริง', 'Saved in this device’s browser · screen colors are approximate, so compare with the real thread')}
          </p>
          {owned > 0 && (
            <button type="button" className="btn ghost sm th-clear" onClick={clearAll}><Icon name="trash" size={14} /> {t('ล้างรายการทั้งหมด', 'Clear all')}</button>
          )}
        </footer>
      </main>
    </div>
  );
}
