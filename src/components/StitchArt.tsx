/**
 * Small stitched pictures for empty and not-found screens, in the logo's threads:
 *   hoop   — an embroidery hoop with the first few stitches and a needle (an invitation to start)
 *   lost   — a stitched square with one cross missing (something isn't here)
 *   skeins — three skeins of thread (My threads)
 * Purely decorative: the text beside them says everything.
 */
const RED = '#c72b3b', RED_D = '#a3202f', NAVY = '#243b6b', GOLD = '#e0a526', GREEN = '#2f7d4f';

function X({ x, y, s = 9, c = RED, d = RED_D }: { x: number; y: number; s?: number; c?: string; d?: string }) {
  const p = s * 0.18;
  return (
    <g strokeLinecap="round" strokeWidth={s * 0.24}>
      <line x1={x + p} y1={y + p} x2={x + s - p} y2={y + s - p} stroke={d} />
      <line x1={x + s - p} y1={y + p} x2={x + p} y2={y + s - p} stroke={c} />
    </g>
  );
}

export function StitchArt({ kind, size = 96 }: { kind: 'hoop' | 'lost' | 'skeins'; size?: number }) {
  if (kind === 'skeins') {
    return (
      <svg className="stitch-art" width={size} height={size * 0.62} viewBox="0 0 120 74" aria-hidden="true">
        {[[RED, 6], [GREEN, 44], [GOLD, 82]].map(([c, x]) => (
          <g key={x as number} transform={`translate(${x} 10)`}>
            <rect width="32" height="54" rx="12" fill={c as string} />
            <rect y="20" width="32" height="14" fill="#fbf8f2" opacity=".9" />
            <path d="M6 8v38M14 6v42M22 6v42" stroke="#fff" strokeOpacity=".28" strokeWidth="2" />
          </g>
        ))}
      </svg>
    );
  }
  if (kind === 'lost') {
    const cells: [number, number][] = [];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (!(x === 2 && y === 1)) cells.push([x, y]);
    return (
      <svg className="stitch-art" width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
        <rect x="12" y="12" width="72" height="72" rx="10" fill="#fbf8f2" stroke="#e7e0d3" strokeWidth="2" />
        {cells.map(([x, y]) => <X key={`${x},${y}`} x={22 + x * 13.5} y={22 + y * 13.5} s={12} c={NAVY} d="#1a2b50" />)}
        {/* the missing stitch and its loose thread */}
        <rect x={22 + 2 * 13.5 + 1} y={22 + 13.5 + 1} width="10" height="10" rx="2" fill="none" stroke={RED} strokeWidth="1.6" strokeDasharray="2.5 2.5" />
        <path d="M60 38c6-14 22-16 28-6s-2 20 2 30" fill="none" stroke={RED} strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className="stitch-art" width={size} height={size} viewBox="0 0 96 96" aria-hidden="true">
      <rect x="44" y="4" width="8" height="10" rx="2" fill="#b88a4e" />
      <circle cx="48" cy="52" r="38" fill="#fbf8f2" stroke="#c99a5b" strokeWidth="6" />
      {Array.from({ length: 49 }, (_, i) => {
        const x = 24 + (i % 7) * 8, y = 28 + ((i / 7) | 0) * 8;
        return Math.hypot(x - 48, y - 52) < 30 ? <circle key={i} cx={x} cy={y} r="1" fill="#d8cfbe" /> : null;
      })}
      <X x={28} y={56} /><X x={36} y={48} /><X x={44} y={40} />
      {/* needle and thread, mid-stitch */}
      <path d="M53 44c6 6 10 2 14-4s10-10 16-6" fill="none" stroke={RED} strokeWidth="2" strokeLinecap="round" />
      <line x1="62" y1="22" x2="82" y2="34" stroke="#8b93a3" strokeWidth="2.4" strokeLinecap="round" />
      <ellipse cx="80" cy="32.8" rx="2.2" ry="1" transform="rotate(31 80 32.8)" fill="#fbf8f2" />
    </svg>
  );
}
