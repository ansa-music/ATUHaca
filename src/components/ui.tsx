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

const CARD_BASE = 'card-v2 rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5'

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
    primary: 'btn-primary-v2 bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900',
    soft: 'bg-brand-100 text-brand-800 hover:bg-brand-200 hover:shadow-sm',
    ghost: 'bg-white text-slate-700 shadow-sm ring-1 ring-slate-300 hover:bg-slate-50 hover:ring-slate-400',
    danger: 'btn-primary-v2 bg-rose-600 text-white hover:bg-rose-700',
  }[variant]
  const s = { sm: 'min-h-9 px-3 py-1.5 text-sm', md: 'min-h-11 px-4 py-2.5', lg: 'min-h-13 px-5 py-3.5 text-lg' }[size]
  return (
    <button
      {...p}
      className={`btn-v2 inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-[-0.005em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 ${v} ${s} ${className}`}
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
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ring-black/5 ${cls}`}
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
          {L(ru, kk)}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'rose' | 'blue' }) {
  const c = {
    slate: 'bg-slate-100 text-slate-700', green: 'bg-emerald-100 text-emerald-800', amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-800', blue: 'bg-blue-100 text-blue-800',
  }[tone]
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ring-black/5 ${c}`}>{children}</span>
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'input-v2 min-h-11 w-full rounded-xl border border-slate-300 bg-white/95 px-3 py-2.5 outline-none placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-600 focus:bg-white'

export function Spinner({ text }: { text?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-10 text-slate-500">
      <span className="relative h-6 w-6">
        <span className="absolute inset-0 rounded-full border-2 border-brand-200" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
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
      className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200"
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
          <span aria-hidden="true" className="h-6 w-1.5 rounded-full bg-gradient-to-b from-wheat-light to-brand-600" />
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
  const c = { slate: 'text-slate-900', green: 'text-emerald-700', amber: 'text-amber-700', rose: 'text-rose-700' }[tone]
  const bar = { slate: 'from-brand-500 to-brand-300', green: 'from-emerald-500 to-emerald-300', amber: 'from-wheat to-wheat-light', rose: 'from-rose-500 to-rose-300' }[tone]
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className="grid"
    >
      <Card className="relative overflow-hidden !p-3.5">
        <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${bar} opacity-80`} />
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
        <div className={`tnum mt-1 text-2xl font-bold tracking-tight ${c}`}>{value}</div>
        {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
      </Card>
    </motion.div>
  )
}
