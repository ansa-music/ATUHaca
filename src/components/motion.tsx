import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Возвращает ref и флаг «элемент попал в область видимости». По умолчанию срабатывает один раз. */
export function useInView<T extends Element = HTMLDivElement>(opts: { once?: boolean; threshold?: number; rootMargin?: string } = {}) {
  const { once = true, threshold = 0.2, rootMargin = '0px 0px -8% 0px' } = opts
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setInView(true)
        if (once) io.disconnect()
      } else if (!once) setInView(false)
    }, { threshold, rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [once, threshold, rootMargin])

  return [ref, inView] as const
}

/** Плавное появление снизу, когда блок попадает в область видимости (один раз). */
export function Reveal({ children, delay = 0, className = '', threshold }: { children: ReactNode; delay?: number; className?: string; threshold?: number }) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: threshold ?? 0.15 })
  return (
    <div ref={ref} className={`reveal ${inView ? 'is-in' : ''} ${className}`} style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}>
      {children}
    </div>
  )
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Число, «добегающее» до значения: от 0 при первом показе и от предыдущего значения при обновлении.
 * Запускается, когда элемент виден на экране. При prefers-reduced-motion сразу показывает итог.
 */
export function CountUp({ value, duration = 700, format, className = '' }: { value: number; duration?: number; format?: (n: number) => string; className?: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>({ threshold: 0, rootMargin: '0px' })
  const [shown, setShown] = useState(0)
  const current = useRef(0)

  useEffect(() => {
    if (!inView) return
    const from = current.current
    const to = Number.isFinite(value) ? value : 0
    if (from === to) return
    if (prefersReducedMotion() || duration <= 0) {
      current.current = to
      setShown(to)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration)
      const v = from + (to - from) * easeOut(t)
      current.current = t === 1 ? to : v
      setShown(current.current)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration, inView])

  const fmt = format ?? ((n: number) => Math.round(n).toLocaleString('ru-RU'))
  return <span ref={ref} className={`tnum ${className}`}>{fmt(shown)}</span>
}
