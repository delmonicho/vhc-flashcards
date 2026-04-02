export default function Logo({ size = 'sm' }) {
  const dim = size === 'lg' ? 120 : 32
  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Cô Ơi lotus logo"
      className="logo-lotus"
    >
      <style>{`
        .logo-lotus .petal { transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); transform-origin: 50px 75px; }
        .logo-lotus:hover .petal-left-outer  { transform: rotate(-12deg); }
        .logo-lotus:hover .petal-right-outer { transform: rotate(12deg); }
        .logo-lotus:hover .petal-left-inner  { transform: rotate(-7deg); }
        .logo-lotus:hover .petal-right-inner { transform: rotate(7deg); }
        .logo-lotus:hover .petal-side-left   { transform: rotate(-16deg); }
        .logo-lotus:hover .petal-side-right  { transform: rotate(16deg); }
      `}</style>

      {/* Center petal */}
      <path className="petal petal-center" d="M50 75 C36 42 36 16 50 5 C64 16 64 42 50 75Z" fill="#E890B8" />

      {/* Side petals — lightest pink */}
      <path className="petal petal-side-left" d="M50 75 C40 62 22 58 12 68 C2 76 32 84 50 75Z" fill="#FDD5E8" />
      <path className="petal petal-side-right" d="M50 75 C60 62 78 58 88 68 C98 76 68 84 50 75Z" fill="#FDD5E8" />
      {/* Golden center */}
      <circle cx="50" cy="50" r="7" fill="#F5C842" />
      <circle cx="50" cy="50" r="3.5" fill="#FFE060" />

      {/* Outer petals */}
      <path className="petal petal-left-outer" d="M50 75 C18 68 8 36 26 18 C36 50 44 64 50 75Z" fill="#F9A8C9" />
      <path className="petal petal-right-outer" d="M50 75 C82 68 92 36 74 18 C64 50 56 64 50 75Z" fill="#F9A8C9" />
      {/* Inner petals */}
      <path className="petal petal-left-inner" d="M50 75 C25 55 24 24 38 10 C44 42 48 60 50 75Z" fill="#F0A0C2" />
      <path className="petal petal-right-inner" d="M50 75 C75 55 76 24 62 10 C56 42 52 60 50 75Z" fill="#F0A0C2" />

    </svg>
  )
}
