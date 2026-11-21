/**
 * Waiting, the cross-stitch way: three little crosses stitched one after another, over and over, next to
 * the message (styles in styles/delight.css; still crosses when the device asks for less motion).
 */
export function StitchLoader({ label, small = false }: { label: string; small?: boolean }) {
  return (
    <span className={'stitch-loader' + (small ? ' small' : '')} role="status">
      <span className="sl-x" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <svg key={i} viewBox="0 0 10 10" style={{ animationDelay: `${i * 0.18}s` }}>
            <path d="M2 2l6 6" className="u" /><path d="M8 2l-6 6" className="o" />
          </svg>
        ))}
      </span>
      <span>{label}</span>
    </span>
  );
}
