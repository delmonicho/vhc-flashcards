export default function Logo({ size = 'sm' }) {
  const dim = size === 'sm' ? 40 : size === 'md' ? 80 : 160
  const C = 50 // viewBox center

  // Polar → cartesian, angle 0 = north
  const pt = (deg, r) => {
    const rad = (deg - 90) * (Math.PI / 180)
    return [C + r * Math.cos(rad), C + r * Math.sin(rad)]
  }

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Cô Ơi lotus logo"
      role="img"
    >
      {/* Golden background */}
      <rect x="0" y="0" width="100" height="100" rx="12" fill="#F5A623" />

      {/* Fractal filaments — 24 spokes at 15°, Y-split × 2 levels, behind petals */}
      {Array.from({ length: 24 }, (_, i) => {
        const a = i * 15
        const [sx, sy]   = pt(a,       18)
        const [a1x, a1y] = pt(a -  9,  28)
        const [b1x, b1y] = pt(a +  9,  28)
        const [a2x, a2y] = pt(a - 15,  36)
        const [b2x, b2y] = pt(a -  3,  36)
        const [c2x, c2y] = pt(a +  3,  36)
        const [d2x, d2y] = pt(a + 15,  36)
        const op = i % 2 === 0 ? 0.55 : 0.35
        return (
          <g key={i} opacity={op} stroke="#C9607A" fill="none">
            <line x1={C}   y1={C}   x2={sx}  y2={sy}  strokeWidth="0.5" />
            <line x1={sx}  y1={sy}  x2={a1x} y2={a1y} strokeWidth="0.38" />
            <line x1={sx}  y1={sy}  x2={b1x} y2={b1y} strokeWidth="0.38" />
            <line x1={a1x} y1={a1y} x2={a2x} y2={a2y} strokeWidth="0.25" />
            <line x1={a1x} y1={a1y} x2={b2x} y2={b2y} strokeWidth="0.25" />
            <line x1={b1x} y1={b1y} x2={c2x} y2={c2y} strokeWidth="0.25" />
            <line x1={b1x} y1={b1y} x2={d2x} y2={d2y} strokeWidth="0.25" />
          </g>
        )
      })}

      {/* Radial spokes — 12 directions */}
      {Array.from({ length: 12 }, (_, i) => {
        const [x, y] = pt(i * 30, 40)
        return (
          <line
            key={i}
            x1={C} y1={C} x2={x} y2={y}
            stroke="#C04060"
            strokeWidth="0.6"
            opacity="0.6"
          />
        )
      })}

      {/* Outer petals — 12 pink ellipses at 30° increments, centered ~25px from lotus center */}
      {Array.from({ length: 12 }, (_, i) => (
        <ellipse
          key={i}
          cx={C} cy={25}
          rx={6.5} ry={12}
          fill="#F9A8C9"
          stroke="#E8526A"
          strokeWidth="0.5"
          opacity="0.9"
          transform={`rotate(${i * 30} ${C} ${C})`}
        />
      ))}

      {/* Mid petals — 8 rose ellipses at 45° increments */}
      {Array.from({ length: 8 }, (_, i) => (
        <ellipse
          key={i}
          cx={C} cy={34}
          rx={5} ry={9}
          fill="#F08090"
          stroke="#D04060"
          strokeWidth="0.5"
          opacity="0.92"
          transform={`rotate(${i * 45} ${C} ${C})`}
        />
      ))}

      {/* Core petals — 6 deep red-rose ellipses at 60° increments */}
      {Array.from({ length: 6 }, (_, i) => (
        <ellipse
          key={i}
          cx={C} cy={41}
          rx={3.8} ry={7}
          fill="#E8526A"
          stroke="#C03050"
          strokeWidth="0.5"
          opacity="0.95"
          transform={`rotate(${i * 60} ${C} ${C})`}
        />
      ))}

      {/* Glowing center: orange → golden → cream */}
      <circle cx={C} cy={C} r={6.5} fill="#FF6030" opacity="0.95" />
      <circle cx={C} cy={C} r={4.5} fill="#FFB830" />
      <circle cx={C} cy={C} r={2}   fill="#FFF0A0" />
    </svg>
  )
}
