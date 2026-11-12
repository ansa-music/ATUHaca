import { MONTHS_KK, MONTHS_RU, type Lang } from './i18n'

const pad = (n: number) => String(n).padStart(2, '0')

/** Локальная дата в формате YYYY-MM-DD. */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const today = () => ymd(new Date())
export const monthStart = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
export const parseYmd = (s: string) => new Date(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)))
export const monthKey = (s: string) => s.slice(0, 7)

export function monthLabel(key: string, lang: Lang, withYear = true) {
  const m = Number(key.slice(5, 7)) - 1
  const name = (lang === 'kk' ? MONTHS_KK : MONTHS_RU)[m]
  return withYear ? `${name} ${key.slice(0, 4)}` : name
}

export const dmy = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}`

export function dateTime(iso: string) {
  const d = new Date(iso)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const num = (n: number, digits = 1) =>
  n.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: digits })

export const kzt = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₸`

/** Список месяцев (YYYY-MM) от from до to включительно. */
export function monthsBetween(from: string, to: string) {
  const out: string[] = []
  const d = parseYmd(from.slice(0, 7) + '-01')
  const end = parseYmd(to.slice(0, 7) + '-01')
  while (d <= end) {
    out.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`)
    d.setMonth(d.getMonth() + 1)
  }
  return out
}

export function monthEnd(key: string) {
  const d = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)
  return ymd(d)
}

export const quarterOf = (key: string) => Math.floor((Number(key.slice(5, 7)) - 1) / 3) + 1

/** Границы периода: месяц (YYYY-MM), квартал (YYYY-Qn) или год (YYYY). */
export function periodRange(kind: 'month' | 'quarter' | 'year', value: string): [string, string] {
  if (kind === 'month') return [`${value}-01`, monthEnd(value)]
  if (kind === 'year') return [`${value}-01-01`, `${value}-12-31`]
  const [y, q] = value.split('-Q')
  const m0 = (Number(q) - 1) * 3 + 1
  return [`${y}-${pad(m0)}-01`, monthEnd(`${y}-${pad(m0 + 2)}`)]
}
