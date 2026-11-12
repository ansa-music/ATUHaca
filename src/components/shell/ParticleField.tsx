import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'

type Variant = 'grain' | 'live'

/**
 * Фон, нарисованный кодом на canvas: медленно плывущие зёрна и пылинки света
 * (вариант `grain` — экран входа) или светящиеся точки-данные (вариант `live` — табло).
 * Кадр рисуется не чаще ~40 раз в секунду, на скрытой вкладке не рисуется вовсе.
 * При prefers-reduced-motion рисуется один статичный кадр.
 */
export default function ParticleField({ variant = 'grain', className = '' }: { variant?: Variant; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    let w = 0, h = 0, dpr = 1
    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number; rot: number; vr: number; tw: number; kind: 0 | 1 }
    let ps: P[] = []

    const seed = () => {
      const area = w * h
      const n = Math.min(variant === 'live' ? 90 : 70, Math.round(area / (variant === 'live' ? 16000 : 18000)))
      ps = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.12, vy: -(0.08 + Math.random() * 0.22),
        r: variant === 'live' ? 0.8 + Math.random() * 1.8 : 2 + Math.random() * 3.2,
        a: 0.15 + Math.random() * 0.5,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.006,
        tw: Math.random() * Math.PI * 2,
        kind: Math.random() < (variant === 'live' ? 0.15 : 0.55) ? 1 : 0,
      }))
    }
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1)
      const r = cv.getBoundingClientRect()
      w = Math.max(1, r.width); h = Math.max(1, r.height)
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed()
    }

    const drawGrain = (p: P) => {
      // зерно пшеницы — вытянутый эллипс с бороздкой
      ctx.save()
      ctx.translate(p.x, p.y); ctx.rotate(p.rot)
      ctx.fillStyle = `rgba(233,185,88,${p.a})`
      ctx.beginPath(); ctx.ellipse(0, 0, p.r * 0.62, p.r * 1.25, 0, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = `rgba(120,80,10,${p.a * 0.5})`; ctx.lineWidth = 0.6
      ctx.beginPath(); ctx.moveTo(0, -p.r * 0.9); ctx.lineTo(0, p.r * 0.9); ctx.stroke()
      ctx.restore()
    }
    const drawDot = (p: P, t: number) => {
      const tw = 0.55 + 0.45 * Math.sin(t * 0.0012 + p.tw)
      const a = p.a * tw
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5)
      const c = variant === 'live' && p.kind === 1 ? '233,185,88' : variant === 'live' ? '140,201,161' : '255,244,214'
      g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`)
      ctx.fillStyle = g
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2); ctx.fill()
    }
    const drawLinks = () => {
      ctx.lineWidth = 0.6
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const dx = ps[i].x - ps[j].x, dy = ps[i].y - ps[j].y, d2 = dx * dx + dy * dy
        if (d2 < 12000) {
          ctx.strokeStyle = `rgba(140,201,161,${0.12 * (1 - d2 / 12000)})`
          ctx.beginPath(); ctx.moveTo(ps[i].x, ps[i].y); ctx.lineTo(ps[j].x, ps[j].y); ctx.stroke()
        }
      }
    }

    const frame = (t: number) => {
      ctx.clearRect(0, 0, w, h)
      if (variant === 'live') drawLinks()
      for (const p of ps) {
        if (variant === 'grain' && p.kind === 1) drawGrain(p)
        else drawDot(p, t)
      }
    }
    const step = () => {
      for (const p of ps) {
        p.x += p.vx; p.y += p.vy; p.rot += p.vr
        if (p.y < -20) { p.y = h + 20; p.x = Math.random() * w }
        if (p.x < -20) p.x = w + 20
        if (p.x > w + 20) p.x = -20
      }
    }

    resize()
    let raf = 0, last = 0
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (document.hidden || t - last < 24) return
      const k = Math.min(3, (t - last) / 16.7)
      last = t
      for (let i = 0; i < Math.round(k); i++) step()
      frame(t)
    }
    if (reduce) frame(0)
    else raf = requestAnimationFrame(loop)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { resize(); if (reduce) frame(0) }) : null
    ro?.observe(cv)
    return () => { cancelAnimationFrame(raf); ro?.disconnect() }
  }, [variant, reduce])

  return <canvas ref={ref} aria-hidden="true" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />
}
