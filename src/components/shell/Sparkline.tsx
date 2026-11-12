import { useId, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'motion/react'

/**
 * Мини-график: значения по дням, последняя точка (сегодня) подсвечена и плавно «дорастает» при каждом обновлении.
 * Рисуется SVG; форма линии меняется CSS-переходом свойства d, линия при первом показе «прорисовывается».
 */
export default function Sparkline({ values, className = '' }: { values: number[]; className?: string }) {
  const id = useId().replace(/:/g, '')
  const reduce = useReducedMotion()
  const W = 300, H = 64, P = 6
  const vs = values.length > 1 ? values : [0, values[0] ?? 0]
  const max = Math.max(1, ...vs)
  const pts = vs.map((v, i) => [P + (i * (W - P * 2)) / (vs.length - 1), H - P - (v / max) * (H - P * 2 - 4)] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z`
  const [lx, ly] = pts[pts.length - 1]
  const ease = 'cubic-bezier(0.34, 1.3, 0.64, 1)'
  const tr = (prop: string): CSSProperties => (reduce ? {} : { transition: `${prop} 0.9s ${ease}` })
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className={`block w-full overflow-visible ${className}`}>
      <defs>
        <linearGradient id={`sa-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e9b958" stopOpacity="0.45" />
          <stop offset="1" stopColor="#e9b958" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#sa-${id})`} style={{ d: `path("${area}")`, ...tr('d') } as CSSProperties} />
      <motion.path
        d={line} fill="none" stroke="#e9b958" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
        style={{ d: `path("${line}")`, ...tr('d') } as CSSProperties}
        initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
      />
      <g style={{ transform: `translate(${lx}px, ${ly}px)`, ...tr('transform') }}>
        {!reduce && <circle r="4" cx="0" cy="0" fill="none" stroke="#e9b958" strokeWidth="1.5" className="ping-ring" style={{ animationIterationCount: 'infinite', animationDuration: '1.8s', transformBox: 'fill-box', transformOrigin: 'center' }} />}
        <circle r="4" cx="0" cy="0" fill="#fff4d6" stroke="#e9b958" strokeWidth="2" />
      </g>
    </svg>
  )
}
