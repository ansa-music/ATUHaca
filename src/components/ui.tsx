import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { STATUS, useLang } from '../lib/i18n'
import type { Status } from '../lib/types'

export function Card({ children, className = '', hover = false }: { children: ReactNode; className?: string; hover?: boolean }) {
  return (
    <div className={`rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5 ${hover ? 'transition duration-200 hover:-translate-y-0.5 hover:shadow-lift' : ''} ${className}`}>
      {children}
    </div>
  )
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'soft'; size?: 'md' | 'lg' | 'sm' }
export function Btn({ variant = 'primary', size = 'md', className = '', ...p }: BtnProps) {
  const v = {
    primary: 'bg-brand-700 text-white shadow-sm shadow-brand-900/20 hover:bg-brand-800 active:bg-brand-900',
    soft: 'bg-brand-100 text-brand-800 hover:bg-brand-200',
    ghost: 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 hover:ring-slate-400',
    danger: 'bg-rose-600 text-white shadow-sm shadow-rose-900/20 hover:bg-rose-700',
  }[variant]
  const s = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5', lg: 'px-5 py-3.5 text-lg' }[size]
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 enabled:active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${v} ${s} ${className}`}
    />
  )
}

export function StatusBadge({ status }: { status: Status }) {
  const { L } = useLang()
  const [ru, kk, cls] = STATUS[status]
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>{L(ru, kk)}</span>
}

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'amber' | 'rose' | 'blue' }) {
  const c = {
    slate: 'bg-slate-100 text-slate-700', green: 'bg-emerald-100 text-emerald-800', amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-800', blue: 'bg-blue-100 text-blue-800',
  }[tone]
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${c}`}>{children}</span>
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
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition-shadow duration-150 placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-100'

export function Spinner({ text }: { text?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-10 text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      {text}
    </div>
  )
}

/** Плейсхолдер загрузки с переливом. Размер задаётся классами: <Skeleton className="h-8 w-32" /> */
export function Skeleton({ className = '' }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block ${className}`} />
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null
  return <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">{children}</div>
}

export function PageTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-slate-500">{sub}</p>}
      </div>
      {right}
    </div>
  )
}

export function Kpi({ label, value, sub, tone = 'slate' }: { label: string; value: string; sub?: string; tone?: 'slate' | 'green' | 'amber' | 'rose' }) {
  const c = { slate: 'text-slate-900', green: 'text-emerald-700', amber: 'text-amber-700', rose: 'text-rose-700' }[tone]
  return (
    <Card className="!p-3.5">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`tnum mt-1 text-2xl font-bold tracking-tight ${c}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </Card>
  )
}
