import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

/** Подписка на media query (например, широкий экран для «прилипающих» секций). */
export function useMedia(query: string) {
  const get = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches
  const [match, setMatch] = useState(get)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

export const EASE = [0.22, 1, 0.36, 1] as const

export function SectionTitle({ kicker, title, sub, dark }: { kicker: string; title: string; sub?: string; dark?: boolean }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className="mx-auto mb-8 max-w-2xl text-center sm:mb-12"
      initial={reduce ? false : { opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.7, ease: EASE }}
    >
      <div className={`text-xs font-bold uppercase tracking-[0.2em] ${dark ? 'text-wheat-light' : 'text-wheat'}`}>{kicker}</div>
      <h2 className={`mt-2 text-balance text-[1.7rem] font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl ${dark ? 'text-white' : 'text-slate-900'}`}>{title}</h2>
      {sub && <p className={`mt-3 text-pretty text-base sm:text-lg ${dark ? 'text-white/75' : 'text-slate-600'}`}>{sub}</p>}
    </motion.div>
  )
}

/** Кольцо индекса достоверности (0–100). */
export function TrustRing({ value, size = 96, color, animate = true, label }: { value: number; size?: number; color: string; animate?: boolean; label?: string }) {
  const R = 40
  const len = 2 * Math.PI * R
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={R} fill="none" stroke="#e2e8f0" strokeWidth="9" />
        <motion.circle
          cx="50" cy="50" r={R} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={len}
          initial={animate ? { strokeDashoffset: len } : false}
          animate={{ strokeDashoffset: len * (1 - value / 100), stroke: color }}
          transition={{ duration: animate ? 1.1 : 0, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="tnum font-extrabold text-slate-900" style={{ fontSize: size * 0.28 }}>{value}</span>
        {label && <span className="sr-only">{label}</span>}
      </div>
    </div>
  )
}
