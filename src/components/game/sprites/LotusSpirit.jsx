export default function LotusSpirit({ size = 80, flashing = false }) {
  const cls = `lotus-float${flashing ? ' lotus-flash' : ''}`
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      overflow="visible"
      style={{ display: 'block' }}
    >
      <g className={cls}>
        {/* Left petal */}
        <rect x="8" y="56" width="20" height="16" fill="#E8526A" />
        {/* Right petal */}
        <rect x="52" y="56" width="20" height="16" fill="#E8526A" />
        {/* Center lower petal */}
        <rect x="28" y="52" width="24" height="20" fill="#FFCCD5" />
        {/* Left mid petal */}
        <rect x="16" y="48" width="16" height="12" fill="#E8526A" />
        {/* Right mid petal */}
        <rect x="48" y="48" width="16" height="12" fill="#E8526A" />
        {/* Body */}
        <rect x="20" y="24" width="40" height="32" fill="#E8526A" />
        {/* Face highlight */}
        <rect x="24" y="28" width="32" height="20" fill="#FFCCD5" />
        {/* Left eye white */}
        <rect x="28" y="32" width="8" height="8" fill="white" />
        {/* Right eye white */}
        <rect x="44" y="32" width="8" height="8" fill="white" />
        {/* Left pupil */}
        <rect x="30" y="34" width="4" height="4" fill="#2D1B12" />
        {/* Right pupil */}
        <rect x="46" y="34" width="4" height="4" fill="#2D1B12" />
        {/* Mouth */}
        <rect x="34" y="44" width="12" height="4" fill="white" />
        {/* Stem */}
        <rect x="36" y="72" width="8" height="8" fill="#5BAF7A" />
      </g>
    </svg>
  )
}
