import { useEffect, useState, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { STATUS, useLang } from '../lib/i18n'
import type { Status } from '../lib/types'

/** Наклон карточки за курсором имеет смысл только с мышью — на сенсорных экранах выключен. */
function useFinePointer() {
  const [fine, setFine] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia?.('(hover: hover) and (pointer: fine)')
    if (!mq) return
    setFine(mq.matches)
    const on = () => setFine(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return fine
}

/** Вид q-card из темы: белая поверхность, тёплая граница, радиус 16px, мягкая тень. */
const CARD_BASE = 'rounded-2xl border border-[var(--border)] bg-white p-4 shadow-[var(--q-shadow-sm)]'

function TiltCard({ children, className }: { children: ReactNode; className: string }) {
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [3.5, -3.5]), { stiffness: 260, damping: 22 })
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-4.5, 4.5]), { stiffness: 260, damping: 22 })
  const move = (e: MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    mx.set((e.clientX - r.left) / r.width - 0.5)
    my.set((e.clientY - r.top) / r.height - 0.5)
  }
  const leave = () => { mx.set(0); my.set(0) }
  return (
    <motion.div
      onMouseMove={move}
      onMouseLeave={leave}
      whileHover={{ y: -4, boxShadow: 'var(--shadow-lift)' }}
      transition={{ type: 'spring', stiffness: 320, damping: 24 }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * Карточка. `interactive` — подъём и лёгкий наклон за курсором (только мышь, без prefers-reduced-motion).
 * `hover` — старый вариант: только подъём. `accent` — градиентная рамка для главных поверхностей.
 */
export function Card({ children, className = '', hover = false, interactive = false, accent = false }: { children: ReactNode; className?: string; hover?: boolean; interactive?: boolean; accent?: boolean }) {
  const fine = useFinePointer()
  const reduce = useReducedMotion()
  const cls = `${CARD_BASE} ${accent ? 'ring-gradient !ring-0' : ''} ${hover || interactive ? 'transition duration-200 hover:-translate-y-0.5 hover:shadow-lift' : ''} ${className}`
  if (interactive && fine && !reduce) return <TiltCard className={`${CARD_BASE} ${accent ? 'ring-gradient !ring-0' : ''} ${className}`}>{children}</TiltCard>
  return <div className={cls}>{children}</div>
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'soft'; size?: 'md' | 'lg' | 'sm' }
/** Кнопка: пружинное нажатие и блик — на CSS, чтобы ни одна анимация не задерживала клик. */
export function Btn({ variant = 'primary', size = 'md', className = '', ...p }: BtnProps) {
  const v = {
    primary: 'btn-primary-v2 bg-[var(--accent)] text-[var(--accent-text)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent)]',
    soft: 'border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-3)]',
    ghost: 'bg-white text-[var(--text-2)] ring-1 ring-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--text)] hover:ring-[var(--border-strong)]',
    danger: 'btn-danger-v2 bg-[var(--danger)] text-[var(--on-danger)] hover:brightness-110',
  }[variant]
  const s = { sm: 'min-h-9 px-3 py-1.5 text-sm', md: 'min-h-11 px-4 py-2.5', lg: 'min-h-13 px-5 py-3.5 text-lg' }[size]
  return (
    <button
      {...p}
      className={`btn-v2 inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-[-0.005em] focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-[#ffc928]/60 disabled:cursor-not-allowed disabled:opacity-50 ${v} ${s} ${className}`}
    />
  )
}

/** Бейдж статуса. Смена статуса — плавная смена цвета и подписи, поэтому любой переход отчёта виден. */
export function StatusBadge({ status }: { status: Status }) {
  const { L } = useLang()
  const reduce = useReducedMotion()
  const [ru, kk, cls] = STATUS[status]
  return (
    <span className="relative inline-grid align-middle">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={status}
          initial={reduce ? false : { opacity: 0, scale: 0.7, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.85, y: -4 }}
          transition={{ type: 'spring', stiffness: 420, damping: 26 }}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
          {L(ru, kk)}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'rose' | 'blue' }) {
  const c = {
    slate: 'bg-[var(--surface-3)] text-[var(--text-2)]', green: 'bg-[var(--accent-soft)] text-[var(--accent-ink)]', amber: 'bg-[var(--warn-soft)] text-[var(--warn)]',
    rose: 'bg-[var(--danger-soft)] text-[var(--danger)]', blue: 'bg-[var(--info-soft)] text-[var(--info)]',
  }[tone]
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${c}`}>{children}</span>
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[var(--text-2)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-[var(--muted)]">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'input-v2 min-h-11 w-full rounded-[10px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-[var(--text)] outline-none placeholder:text-[var(--muted)] hover:border-[var(--border-strong)] focus:border-[var(--accent)] focus:bg-white'

export function Spinner({ text }: { text?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-10 text-slate-500">
      <span className="relative h-6 w-6">
        <span className="absolute inset-0 rounded-full border-2 border-brand-100" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </span>
      {text}
    </div>
  )
}

/** Плейсхолдер загрузки с переливом. Размер задаётся классами: <Skeleton className="h-8 w-32" /> */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block ${className}`} />
}

export function ErrorBox({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion()
  if (!children) return null
  return (
    <motion.div
      role="alert"
      initial={reduce ? false : { opacity: 0, x: -6 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, x: [0, -4, 4, -2, 0] }}
      transition={{ duration: 0.35 }}
      className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger)] ring-1 ring-[var(--danger)]/30"
    >
      {children}
    </motion.div>
  )
}

export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
        <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.7rem]">
          <span aria-hidden="true" className="h-6 w-1.5 rounded-full bg-gradient-to-b from-[#ffc928] to-[#c77d14]" />
          {title}
        </h1>
        {sub && <p className="mt-1 pl-4 text-sm text-slate-500">{sub}</p>}
      </motion.div>
      {right}
    </div>
  )
}

export function Kpi({ label, value, sub, tone = 'slate' }: { label: string; value: ReactNode; sub?: string; tone?: 'slate' | 'green' | 'amber' | 'rose' }) {
  const reduce = useReducedMotion()
  const c = { slate: 'text-[var(--text)]', green: 'text-[var(--accent-ink)]', amber: 'text-[var(--warn)]', rose: 'text-[var(--danger)]' }[tone]
  const bar = { slate: 'from-[#ffc928] to-[#ffe594]', green: 'from-[#f5b301] to-[#ffd54f]', amber: 'from-[#c77d14] to-[#f5b301]', rose: 'from-[#c4372d] to-[#f08a80]' }[tone]
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="grid"
    >
      <Card className="relative overflow-hidden !p-3.5">
        <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${bar}`} />
        <div className="q-label">{label}</div>
        <div className={`q-num tnum mt-1 text-2xl font-extrabold tracking-tight ${c}`}>{value}</div>
        {sub && <div className="mt-0.5 text-xs text-[var(--muted)]">{sub}</div>}
      </Card>
    </motion.div>
  )
}
