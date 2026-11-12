/** Ряд колосьев вдоль нижнего края, нарисованный SVG; каждый колос покачивается со своей задержкой. */
export default function WheatStalks({ count = 14, className = '' }: { count?: number; className?: string }) {
  const stalks = Array.from({ length: count }, (_, i) => {
    const x = (i + 0.5) * (1000 / count) + ((i * 37) % 23) - 11
    const hgt = 120 + ((i * 53) % 90)
    return { x, hgt, delay: -((i * 0.73) % 7), op: 0.22 + ((i * 17) % 30) / 100 }
  })
  return (
    <svg viewBox="0 0 1000 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true" className={`pointer-events-none absolute inset-x-0 bottom-0 h-[28vh] w-full ${className}`}>
      <defs>
        <linearGradient id="stalk-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9b958" />
          <stop offset="1" stopColor="#c98a1b" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      {stalks.map((s, i) => {
        const top = 240 - s.hgt
        const grains = [0, 1, 2, 3, 4]
        return (
          <g key={i} className="animate-sway" style={{ animationDelay: `${s.delay}s`, animationDuration: `${6 + (i % 4)}s` }} opacity={s.op}>
            <path d={`M${s.x} 240 Q${s.x + 4} ${top + s.hgt / 2} ${s.x} ${top}`} stroke="url(#stalk-g)" strokeWidth="2" fill="none" />
            {grains.map((g) => (
              <g key={g}>
                <ellipse cx={s.x - 5} cy={top + 8 + g * 9} rx="3.2" ry="6.5" transform={`rotate(-28 ${s.x - 5} ${top + 8 + g * 9})`} fill="#e9b958" />
                <ellipse cx={s.x + 5} cy={top + 8 + g * 9} rx="3.2" ry="6.5" transform={`rotate(28 ${s.x + 5} ${top + 8 + g * 9})`} fill="#e9b958" />
              </g>
            ))}
            <ellipse cx={s.x} cy={top - 2} rx="2.6" ry="6" fill="#f3d48c" />
          </g>
        )
      })}
    </svg>
  )
}
