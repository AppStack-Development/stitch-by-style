import { useEffect, useState } from 'react';
import type { Pattern } from '../types';
import { postPattern, setLike, type Post } from '../lib/community';
import { useCloud } from '../lib/cloud';
import { DIFFICULTY_LABEL } from '../lib/pattern';
import { t } from '../lib/i18n';
import { navigate } from '../App';
import { Thumb } from './Thumb';
import { Icon } from './Icon';
import { askConfirm } from './ConfirmDialog';

/** Decodes a post's pattern for previews; null until ready (or if the data is broken). */
export function usePostPattern(post: Post | null): Pattern | null {
  const [p, setP] = useState<Pattern | null>(null);
  useEffect(() => {
    if (!post) return;
    let live = true;
    postPattern(post).then((x) => { if (live) setP(x); }).catch(() => { /* a broken post just shows no preview */ });
    return () => { live = false; };
  }, [post?.id, post?.data]); // eslint-disable-line react-hooks/exhaustive-deps
  return p;
}

/** "จากทีม" badge for the official XStitch.Design account. */
export function TeamBadge() {
  return <span className="team-badge">{t('จากทีม', 'Team')}</span>;
}

/**
 * Heart button with count. Signed out, it explains that liking needs an account. The change shows
 * at once and is rolled back if saving fails.
 */
export function LikeButton({ post, liked, onChange, size = 'sm' }: {
  post: Post; liked: boolean; onChange: (liked: boolean, count: number) => void; size?: 'sm' | 'md';
}) {
  const cloud = useCloud();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (cloud.status !== 'signed-in') {
      const go = await askConfirm({
        title: t('เข้าสู่ระบบเพื่อกดหัวใจ', 'Sign in to like patterns'),
        message: <p>{t('กดหัวใจเก็บลายที่ชอบได้เมื่อเข้าสู่ระบบ ไปหน้าเข้าสู่ระบบไหม?', 'You can like patterns once you’re signed in. Go to the sign-in page?')}</p>,
        ok: t('ไปหน้าเข้าสู่ระบบ', 'Go to sign in'),
        icon: 'heart',
      });
      if (go) navigate('#/account');
      return;
    }
    if (busy) return;
    const next = !liked;
    const count = Math.max(0, post.likeCount + (next ? 1 : -1));
    onChange(next, count);
    setBusy(true);
    try {
      await setLike(post.id, next);
    } catch (e) {
      onChange(liked, post.likeCount);
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className={`like-btn ${size}` + (liked ? ' on' : '')} onClick={toggle} aria-pressed={liked}
      title={liked ? t('เลิกกดหัวใจ', 'Unlike') : t('กดหัวใจ', 'Like')}
      aria-label={t(`หัวใจ ${post.likeCount}`, `${post.likeCount} likes`)}>
      <Icon name="heart" size={size === 'md' ? 18 : 16} /> <span>{post.likeCount.toLocaleString()}</span>
    </button>
  );
}

export function PostCard({ post, liked, onLike }: { post: Post; liked: boolean; onLike: (liked: boolean, count: number) => void }) {
  const p = usePostPattern(post);
  const href = `#/c/${post.id}`;
  return (
    <article className="sample-card post-card">
      <a className="sample-thumb" href={href} aria-label={post.title}>
        {p ? <Thumb pattern={p} max={150} view="stitch" /> : <span className="post-wait" aria-hidden="true" />}
        <span className={`sample-kind ${post.base}`}>{post.base === 'aida' ? t('ผ้า Aida', 'Aida') : '3D'}</span>
      </a>
      <div className="sample-body">
        <h3><a href={href}>{post.title}</a></h3>
        <div className="post-by">{t('โดย', 'by')} <b>{post.author.name}</b>{post.author.official && <TeamBadge />}</div>
        <div className="sample-meta">
          <span className={`diff ${post.difficulty}`}>{DIFFICULTY_LABEL[post.difficulty]}</span>
          <span>{t(`${post.colors} สี`, `${post.colors} colors`)}</span>
          <span>{t(`${post.stitches.toLocaleString()} ฝีเข็ม`, `${post.stitches.toLocaleString()} stitches`)}</span>
        </div>
      </div>
      <div className="post-foot">
        <LikeButton post={post} liked={liked} onChange={onLike} />
        <a className="btn sm ghost" href={href}>{t('ดูลาย', 'View')}</a>
      </div>
    </article>
  );
}
