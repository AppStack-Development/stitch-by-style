import { useEffect, useMemo, useState } from 'react';
import { communityEnabled, listPosts, type Post } from '../lib/community';
import { currentSeason, hideSeason, seasonHidden } from '../lib/seasons';
import { t } from '../lib/i18n';
import { usePostPattern } from './PostCard';
import { Thumb } from './Thumb';
import { Icon } from './Icon';

function PostThumb({ post }: { post: Post }) {
  const p = usePostPattern(post);
  return (
    <a className="season-thumb" href={`#/c/${post.id}`} title={post.title} aria-label={post.title}>
      {p ? <Thumb pattern={p} max={92} view="stitch" /> : <span className="season-wait" aria-hidden="true" />}
    </a>
  );
}

/**
 * A dated banner at the top of the home page (lib/seasons.ts), with a few of the team's designs for the
 * season. It hides itself outside its dates, and "close" hides it until the season comes round again.
 */
export function SeasonBanner() {
  const cur = useMemo(() => currentSeason(), []);
  const [hidden, setHidden] = useState(() => !cur || seasonHidden(cur.key));
  const [posts, setPosts] = useState<Post[]>([]);
  useEffect(() => {
    if (!cur || hidden || !communityEnabled) return;
    let live = true;
    listPosts({ tag: cur.season.tag, base: 'print3d', limit: 24 })
      .then((r) => {
        if (!live) return;
        // one design per piece, so the art shows different shapes
        const seen = new Set<string>();
        const pick = r.posts.filter((p) => {
          if (!p.author.official) return false;
          const k = p.templateName ?? p.id;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setPosts(pick.slice(0, 3));
      })
      .catch(() => { /* the banner still works without the art */ });
    return () => { live = false; };
  }, [cur, hidden]);
  if (!cur || hidden) return null;
  const s = cur.season;
  return (
    <section className="season" aria-label={t(s.title[0], s.title[1])}>
      <div className="season-card">
        <div className="season-text">
          <span className="season-badge">{t('ช่วงเทศกาล', 'Seasonal')}</span>
          <h3>{t(s.title[0], s.title[1])}</h3>
          <p>{t(s.text[0], s.text[1])}</p>
          <div className="season-actions">
            <a className="btn primary" href={s.href}>{t(s.cta[0], s.cta[1])} →</a>
            <a className="btn season-ghost" href={s.href2}>{t(s.cta2[0], s.cta2[1])}</a>
          </div>
        </div>
        {posts.length > 0 && <div className="season-art">{posts.map((p) => <PostThumb key={p.id} post={p} />)}</div>}
        <button className="icon-btn sm season-close" onClick={() => { hideSeason(cur.key); setHidden(true); }}
          title={t('ซ่อนจนถึงปีหน้า', 'Hide until next year')} aria-label={t('ซ่อนแบนเนอร์', 'Hide banner')}>
          <Icon name="close" size={16} />
        </button>
      </div>
    </section>
  );
}
