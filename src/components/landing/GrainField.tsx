import { useEffect, useRef } from 'react'

type Grain = { x: number; y: number; r: number; vx: number; vy: number; rot: number; vr: number; a: number; ph: number }
type Stalk = { x: number; h: number; ph: number; w: number; a: number; layer: number }

/**
 * «Видео» героя, нарисованное кодом: поле колосьев качается на ветру, зёрна летят вверх.
 * Цикл останавливается, когда сцена вне экрана или вкладка скрыта. DPR ≤ 2, частиц ~60 на телефоне.
 */
export default function GrainField({ reduce }: { reduce: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0, h = 0, dpr = 1
    let grains: Grain[] = []
    let stalks: Stalk[] = []
    let raf = 0
    let visible = true
    let running = false
    let last = performance.now()
    let t = 0

    const rand = (a: number, b: number) => a + Math.random() * (b - a)

    const build = () => {
      const rect = canvas.getBoundingClientRect()
      w = Math.max(1, rect.width)
      h = Math.max(1, rect.height)
      dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const mobile = w < 768
      const n = mobile ? 60 : 140
      grains = Array.from({ length: n }, () => ({
        x: rand(0, w), y: rand(0, h), r: rand(1.2, mobile ? 3 : 3.6),
        vx: rand(-6, 10), vy: rand(-26, -8), rot: rand(0, Math.PI), vr: rand(-1, 1),
        a: rand(0.25, 0.9), ph: rand(0, Math.PI * 2),
      }))
      const ns = mobile ? 16 : 38
      stalks = Array.from({ length: ns }, (_, i) => {
        const layer = i % 3
        return { x: (i + rand(-0.4, 0.4)) * (w / ns), h: h * rand(0.16, 0.3) * (1 + layer * 0.28), ph: rand(0, Math.PI * 2), w: rand(0.8, 1.4), a: 0.22 + layer * 0.2, layer }
      }).sort((a, b) => a.layer - b.layer)
    }

    const drawStalk = (s: Stalk, time: number) => {
      const sway = Math.sin(time * 0.9 + s.ph + s.x * 0.004) * (10 + s.layer * 6) + Math.sin(time * 2.1 + s.ph) * 2
      const bx = s.x, by = h + 4
      const tx = bx + sway, ty = h - s.h
      ctx.strokeStyle = `rgba(199,125,20,${s.a * 0.8})`
      ctx.lineWidth = s.w + s.layer * 0.5
      ctx.beginPath()
      ctx.moveTo(bx, by)
      ctx.quadraticCurveTo(bx + sway * 0.2, by - s.h * 0.5, tx, ty)
      ctx.stroke()
      // колос: зёрна ёлочкой вдоль верхушки
      ctx.fillStyle = `rgba(245,179,1,${s.a})`
      const dx = (tx - (bx + sway * 0.2)) / (s.h * 0.5)
      const ang = Math.atan2(-1, dx) + Math.PI / 2
      const k = 5 + s.layer * 2
      const size = 2.4 + s.layer * 1.3
      for (let i = 0; i < 7; i++) {
        const px = tx - dx * i * k * 0.9
        const py = ty + i * k
        for (const side of [-1, 1]) {
          ctx.beginPath()
          ctx.ellipse(px + side * size * 0.9, py, size * 0.55, size * 1.25, ang + side * 0.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      ctx.beginPath()
      ctx.ellipse(tx, ty - size, size * 0.5, size * 1.3, ang, 0, Math.PI * 2)
      ctx.fill()
    }

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      t += dt
      ctx.clearRect(0, 0, w, h)
      for (const g of grains) {
        g.x += (g.vx + Math.sin(t * 0.8 + g.ph) * 8) * dt
        g.y += g.vy * dt
        g.rot += g.vr * dt
        if (g.y < -10) { g.y = h + 10; g.x = rand(0, w) }
        if (g.x < -10) g.x = w + 10
        if (g.x > w + 10) g.x = -10
        const tw = 0.6 + 0.4 * Math.sin(t * 2 + g.ph)
        ctx.fillStyle = `rgba(245,179,1,${g.a * tw})`
        ctx.beginPath()
        ctx.ellipse(g.x, g.y, g.r * 0.6, g.r, g.rot, 0, Math.PI * 2)
        ctx.fill()
      }
      for (const s of stalks) drawStalk(s, t)
      if (running) raf = requestAnimationFrame(frame)
    }

    const start = () => {
      if (running || reduce || !visible || document.hidden) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    const stop = () => { running = false; cancelAnimationFrame(raf) }

    build()
    if (reduce) { t = 1; frame(performance.now()); running = false } else start()

    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else stop() })
      : null
    io?.observe(canvas)
    const onVis = () => { if (document.hidden) stop(); else start() }
    document.addEventListener('visibilitychange', onVis)
    let rt = 0
    const onResize = () => {
      clearTimeout(rt)
      rt = window.setTimeout(() => { build(); if (!running) frame(performance.now()) }, 150)
    }
    window.addEventListener('resize', onResize)

    return () => {
      stop()
      io?.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('resize', onResize)
      clearTimeout(rt)
    }
  }, [reduce])

  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden="true" />
}
