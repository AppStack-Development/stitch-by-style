import { useMemo, useState } from 'react';
import { SAMPLES, type Sample } from '../lib/samples';
import { computeStats } from '../lib/stats';
import { DIFFICULTY_LABEL } from '../lib/pattern';
import { listPatterns } from '../lib/storage';
import { findDraft, putDraft } from '../lib/drafts';
import { t } from '../lib/i18n';
import { Thumb } from './Thumb';
import { Icon } from './Icon';
import { navigate } from '../App';
import { trackStep } from '../lib/analytics';

type Filter = 'all' | Sample['base'];

/** Seasonal ready-made patterns: one tap copies a sample into "My patterns" and opens it. */
export function SampleGallery() {
  const [filter, setFilter] = useState<Filter>('all');
  // previews are built once; opening a sample builds a fresh copy with its own id
  const previews = useMemo(() => SAMPLES.map((s) => ({ s, p: s.make() })), []);
  const shown = previews.filter(({ s }) => filter === 'all' || s.base === filter);

  const open = (s: Sample, where: 'stitch' | 'edit') => {
    trackStep(`/sample/${s.id}`);
    // already have a copy of this sample? reopen it (keeps its progress) instead of piling up duplicates
    const mine = listPatterns().filter((x) => x.sampleId === s.id).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    if (mine) {
      navigate(`#/${where}/${mine.id}`);
      return;
    }
    // otherwise try it as a draft: it only goes into My patterns once they stitch or edit (lib/drafts.ts)
    const p = findDraft((x) => x.sampleId === s.id) ?? { ...s.make(), sampleId: s.id };
    putDraft(p);
    navigate(`#/${where}/${p.id}`);
  };

  return (
    <section className="samples">
      <div className="section-head">
        <h2>{t('ลายตัวอย่าง', 'Sample patterns')} <small>{t('คริสต์มาสและปีใหม่ · กดเพื่อลองปักได้ทันที', 'Christmas & New Year · tap one to try it')}</small></h2>
        <div className="seg" role="tablist" aria-label={t('กรองลายตัวอย่าง', 'Filter samples')}>
          {([['all', t('ทั้งหมด', 'All')], ['aida', t('บนผ้า', 'Fabric')], ['print3d', t('ชิ้นงาน 3D', '3D prints')]] as [Filter, string][]).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="sample-grid">
        {shown.map(({ s, p }) => {
          const st = computeStats(p);
          const colors = st.colors.filter((c) => c.count > 0).length;
          return (
            <article key={s.id} className="sample-card">
              <button className="sample-thumb" onClick={() => open(s, 'stitch')} aria-label={t(`ลองปัก ${s.name}`, `Stitch ${s.name}`)}>
                <Thumb pattern={p} max={150} view="stitch" />
                <span className={`sample-kind ${s.base}`}>{s.base === 'aida' ? t('ผ้า Aida', 'Aida') : t('3D', '3D')}</span>
              </button>
              <div className="sample-body">
                <h3>{s.name}</h3>
                <p>{s.description}</p>
                <div className="sample-meta">
                  <span className={`diff ${s.difficulty}`}>{DIFFICULTY_LABEL[s.difficulty]}</span>
                  <span>{t(`${colors} สี`, `${colors} colors`)}</span>
                  <span>{t(`${st.total} ฝีเข็ม`, `${st.total} stitches`)}</span>
                </div>
              </div>
              <div className="sample-actions">
                <button className="btn sm primary" onClick={() => open(s, 'stitch')}><Icon name="needle" size={15} /> {t('ลองปัก', 'Stitch it')}</button>
                <button className="btn sm ghost" onClick={() => open(s, 'edit')}><Icon name="edit" size={15} /> {t('แก้ไข', 'Edit')}</button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
