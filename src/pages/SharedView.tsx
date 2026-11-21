import { useEffect, useState } from 'react';
import { StitchLoader } from '../components/StitchLoader';
import type { Pattern } from '../types';
import { decodeShare } from '../lib/share';
import { savePattern } from '../lib/storage';
import { uid, contrastText } from '../lib/threads';
import { computeStats } from '../lib/stats';
import { Thumb } from '../components/Thumb';
import { Icon } from '../components/Icon';
import { LogoMark, Wordmark } from '../components/LogoMark';
import { PrintView } from './PrintView';
import { LangSwitch } from '../components/LangSwitch';
import { AccountButton } from '../components/AccountButton';
import { navigate } from '../App';
import { t } from '../lib/i18n';
import { templateLabel } from '../lib/templates';
import { APP_NAME } from '../lib/brand';

export function SharedView({ data }: { data: string }) {
  const [p, setP] = useState<Pattern | null>(null);
  const [err, setErr] = useState('');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    decodeShare(data).then(setP).catch(() => setErr(t('ลิงก์นี้ไม่ถูกต้องหรือข้อมูลไม่ครบ', 'This link is invalid or incomplete')));
  }, [data]);

  if (err) return <div className="empty-state"><h2>{err}</h2><a className="btn primary" href="#/">{t('ไปหน้าแรก', 'Go to home')}</a></div>;
  if (!p) return <div className="empty-state"><StitchLoader label={t('กำลังเปิดลาย…', 'Opening pattern…')} /></div>;
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
        <a className="brand" href="#/" aria-label={t(`${APP_NAME} หน้าแรก`, `${APP_NAME} home`)}><LogoMark size={34} className="logo-mark" tight /><Wordmark /></a>
        <div className="spacer" /><AccountButton /><LangSwitch />
      </header>
      <div className="shared-body">
        <div className="preview-card"><Thumb pattern={p} max={420} view="stitch" /></div>
        <div className="form-card">
          <p className="muted">{t('มีคนแชร์ลายปักนี้ให้คุณ', 'Someone shared this pattern with you')}</p>
          <h1>{p.name}</h1>
          {p.details.author && <p>{t('ออกแบบโดย', 'Designed by')} {p.details.author}</p>}
          {p.details.description && <p>{p.details.description}</p>}
          <p className="hint">
            {templateLabel(p.templateName) ?? t('ออกแบบอิสระ', 'Free design')} · {p.cols}×{p.rows} {t('ช่อง', 'cells')} · {stats.widthMm.toFixed(0)}×{stats.heightMm.toFixed(0)} {t('มม.', 'mm')} · {stats.total.toLocaleString()} {t('ฝีเข็ม', 'stitches')}
          </p>
          <div className="chips">
            {used.map((c) => {
              const thr = p.palette[c.index];
              return <span key={thr.id} className="sym-chip"><span className="sym sm" style={{ background: thr.hex, color: contrastText(thr.hex) }}>{thr.symbol}</span>{thr.code || thr.name}</span>;
            })}
          </div>
          <div className="btn-row">
            <button className="btn primary" onClick={saveCopy}><Icon name="copy" size={16} /> {t('บันทึกเป็นลายของฉัน', 'Save as my pattern')}</button>
            <button className="btn" onClick={() => setPrinting(true)}><Icon name="print" size={16} /> {t('ดูแผนผัง / พิมพ์', 'Chart / print')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
