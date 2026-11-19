// /api/og?id=<post id>&v=<updated_at>: the pattern drawn as cross stitches on a 1200×630 card (PNG),
// for link previews. Unknown or hidden posts get the plain brand card. Long cache: `v` changes on edits.
import { decodePattern, encodePng, fetchPost, renderPreview, validId } from './_pattern.js';

export async function GET(request) {
  const id = new URL(request.url).searchParams.get('id') || '';
  let pattern = null;
  if (validId(id)) {
    const post = await fetchPost(id).catch(() => null);
    if (post?.data) {
      try { pattern = decodePattern(post.data); } catch { pattern = null; }
    }
  }
  const png = encodePng(renderPreview(pattern));
  return new Response(png, {
    status: 200,
    headers: {
      'content-type': 'image/png',
      'cache-control': pattern
        ? 'public, max-age=86400, s-maxage=31536000, immutable'
        : 'public, max-age=300, s-maxage=300',
    },
  });
}
