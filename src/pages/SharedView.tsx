import { useEffect, useState } from 'react';
import type { Pattern } from '../types';
import { decodeShare } from '../lib/share';
import { savePattern } from '../lib/storage';
import { uid, contrastText } from '../lib/threads';
import { computeStats } from '../lib/stats';
import { Thumb } from '../components/Thumb';
import { Icon } from '../components/Icon';
import { PrintView } from './PrintView';
import { navigate } from '../App';

export function SharedView({ data }: { data: string }) {
  const [p, setP] = useState<Pattern | null>(null);
  const [err, setErr] = useState('');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    decodeShare(data).then(setP).catch(() => setErr('ลิงก์นี้ไม่ถูกต้องหรือข้อมูลไม่ครบ'));
  }, [data]);

  if (err) return <div className="empty-state"><h2>{err}</h2><a className="btn primary" href="#/">ไปหน้าแรก</a></div>;
  if (!p) return <div className="empty-state"><p>กำลังเปิดลาย…</p></div>;
  if (printing) return <PrintView pattern={p} onBack={() => setPrinting(false)} />;

  const stats = computeStats(p);
  const used = stats.colors.filter((c) => c.count > 0);
  const saveCopy = () => {
    const now = Date.now();
    const copy = { ...p, id: uid(), createdAt: now, updatedAt: now };
    savePattern(copy);
    navigate(`#/edit/${copy.id}`);
  };

  return (
    <div className="shared">
      <header className="site-head">
        <a className="brand" href="#/"><span className="brand-mark"><Icon name="close" size={18} /></span>Stitch by Style</a>
      </header>
      <div className="shared-body">
        <div className="preview-card"><Thumb pattern={p} max={420} view="stitch" /></div>
        <div className="form-card">
          <p className="muted">มีคนแชร์ลายปักนี้ให้คุณ</p>
          <h1>{p.name}</h1>
          {p.details.author && <p>ออกแบบโดย {p.details.author}</p>}
          {p.details.description && <p>{p.details.description}</p>}
          <p className="hint">
            {p.templateName ?? 'ออกแบบอิสระ'} · {p.cols}×{p.rows} ช่อง · {stats.widthMm.toFixed(0)}×{stats.heightMm.toFixed(0)} มม. · {stats.total.toLocaleString()} ฝีเข็ม
          </p>
          <div className="chips">
            {used.map((c) => {
              const t = p.palette[c.index];
              return <span key={t.id} className="sym-chip"><span className="sym sm" style={{ background: t.hex, color: contrastText(t.hex) }}>{t.symbol}</span>{t.code || t.name}</span>;
            })}
          </div>
          <div className="btn-row">
            <button className="btn primary" onClick={saveCopy}><Icon name="copy" size={16} /> บันทึกเป็นลายของฉัน</button>
            <button className="btn" onClick={() => setPrinting(true)}><Icon name="print" size={16} /> ดูแผนผัง / พิมพ์</button>
          </div>
        </div>
      </div>
    </div>
  );
}
