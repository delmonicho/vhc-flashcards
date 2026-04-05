export default function LotusLoader({ size = 80 }) {
  const petals = [
    ['M50 75 C36 42 36 16 50 5 C64 16 64 42 50 75Z',          '#E890B8'],
    ['M50 75 C75 55 76 24 62 10 C56 42 52 60 50 75Z',         '#F0A0C2'],
    ['M50 75 C82 68 92 36 74 18 C64 50 56 64 50 75Z',         '#F9A8C9'],
    ['M50 75 C60 62 78 58 88 68 C98 76 68 84 50 75Z',         '#FDD5E8'],
    ['M50 75 C40 62 22 58 12 68 C2 76 32 84 50 75Z',          '#FDD5E8'],
    ['M50 75 C18 68 8 36 26 18 C36 50 44 64 50 75Z',          '#F9A8C9'],
    ['M50 75 C25 55 24 24 38 10 C44 42 48 60 50 75Z',         '#F0A0C2'],
  ]

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Loading"
      role="img"
      style={{ animation: 'petal-glow 2s ease-in-out infinite' }}
    >
      {petals.map(([d, fill], i) => (
        <path key={i} d={d} fill={fill} />
      ))}
      <circle cx="50" cy="55" r="7"   fill="#F5C842" />
      <circle cx="50" cy="55" r="3.5" fill="#FFE060" />
    </svg>
  )
}
