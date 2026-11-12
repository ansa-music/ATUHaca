import '../fx.css'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

/** Пользователь просил в системе меньше движения — тогда анимации отключаются. */
export const reducedMotion = () =>
  typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

/**
 * Число, которое «докручивается» от предыдущего значения к новому.
 * `from` задаёт стартовое значение при первом показе (по умолчанию — без анимации на первом показе).
 */
export function CountUp({ value, digits = 1, duration = 400, from }: { value: number; digits?: number; duration?: number; from?: number }) {
  const start = from !== undefined && Number.isFinite(value) && !reducedMotion() ? from : value
  const [shown, setShown] = useState(start)
  const cur = useRef(start)

  useEffect(() => {
    const a = cur.current
    if (a === value || !Number.isFinite(value) || !Number.isFinite(a) || reducedMotion()) {
      cur.current = value; setShown(value)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const finish = () => { cur.current = value; setShown(value) }
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration)
      if (p >= 1) return finish()
      cur.current = a + (value - a) * (1 - Math.pow(1 - p, 3))
      setShown(cur.current)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // В фоновой вкладке кадры не приходят — итоговое значение всё равно должно появиться.
    const safety = window.setTimeout(() => { cancelAnimationFrame(raf); finish() }, duration + 80)
    return () => { cancelAnimationFrame(raf); clearTimeout(safety) }
  }, [value, duration])

  return <span className="tabular-nums">{shown.toLocaleString('ru-RU', { maximumFractionDigits: digits })}</span>
}

const RING = {
  high: { arc: '#059669', track: '#a7f3d0', fill: '#ecfdf5', text: '#047857' },
  medium: { arc: '#d97706', track: '#fde68a', fill: '#fffbeb', text: '#b45309' },
  low: { arc: '#e11d48', track: '#fecdd3', fill: '#fff1f2', text: '#be123c' },
} as const

/** Кольцо индекса достоверности: дуга заполняется от 0 до score, число в центре считает вверх. */
export function TrustRing({ score, level }: { score: number; level: 'high' | 'medium' | 'low' }) {
  const c = RING[level]
  const r = 35
  const len = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score))
  return (
    <div className="relative grid h-20 w-20 shrink-0 place-items-center" role="img" aria-label={String(score)}>
      <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill={c.fill} stroke={c.track} strokeWidth="6" />
        <circle className="fx-ring-arc" cx="40" cy="40" r={r} fill="none" stroke={c.arc} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={len} strokeDashoffset={len * (1 - pct / 100)} style={{ '--fx-c': len } as CSSProperties} />
      </svg>
      <span className="relative text-2xl font-bold" style={{ color: c.text }}><CountUp value={score} digits={0} duration={700} from={0} /></span>
    </div>
  )
}

/** Галочка, которая прорисовывается после успешного действия. */
export function SuccessCheck({ size = 20 }: { size?: number }) {
  return (
    <svg className="fx-check" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#059669" />
      <path d="M6.5 12.5l3.6 3.6 7.4-8" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Обёртка с каскадным появлением: i — порядковый номер в каскаде. */
export function FadeUp({ i = 0, step = 45, className = '', children }: { i?: number; step?: number; className?: string; children: ReactNode }) {
  return <div className={`fx-fade-up ${className}`} style={{ animationDelay: `${i * step}ms` }}>{children}</div>
}

/**
 * Какие строки списка появились только что. Первый полученный список считается исходным и не анимируется;
 * id, которых в нём не было, считаются новыми в течение ttl мс.
 */
export function useFreshIds(ids: readonly string[] | null | undefined, ttl = 1200) {
  const seen = useRef<Map<string, number> | null>(null)
  const now = Date.now()
  if (ids) {
    if (!seen.current) seen.current = new Map(ids.map((id) => [id, 0]))
    else for (const id of ids) if (!seen.current.has(id)) seen.current.set(id, now)
  }
  return (id: string) => now - (seen.current?.get(id) ?? 0) < ttl
}

/** У каких ключей только что изменилось значение (например, статус отчёта). Первое значение не считается изменением. */
export function useChangedKeys(values: ReadonlyMap<string, string> | null | undefined, ttl = 1200) {
  const prev = useRef<Map<string, string> | null>(null)
  const at = useRef(new Map<string, number>())
  const now = Date.now()
  if (values) {
    if (prev.current) for (const [k, v] of values) if (prev.current.has(k) && prev.current.get(k) !== v) at.current.set(k, now)
    prev.current = new Map(values)
  }
  return (k: string) => now - (at.current.get(k) ?? 0) < ttl
}

/**
 * Позволяет передать анимированное значение в компонент, который объявляет проп как строку, но просто выводит его
 * (Kpi из ui.tsx), не меняя сам компонент.
 */
export const asText = (node: ReactNode) => node as unknown as string
