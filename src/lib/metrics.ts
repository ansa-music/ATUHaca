import { monthKey, parseYmd } from './format'
import type { Category, Reason, RegistryRow } from './types'

export interface Totals {
  mass: number        // кг
  avoidable: number   // кг предотвратимых отходов
  recyclable: number  // кг пригодных к переработке (по признаку вида отхода)
  diverted: number    // кг фактически отведённых от захоронения (по способу утилизации)
  cost: number        // оценка потерь, тенге
  co2: number         // кг CO2-экв.
  count: number
}

export function totals(rows: RegistryRow[]): Totals {
  const t: Totals = { mass: 0, avoidable: 0, recyclable: 0, diverted: 0, cost: 0, co2: 0, count: rows.length }
  for (const r of rows) {
    t.mass += r.mass_kg
    if (r.category === 'avoidable') t.avoidable += r.mass_kg
    if (r.recyclable) t.recyclable += r.mass_kg
    if (r.diverts) t.diverted += r.mass_kg
    t.cost += r.cost_kzt
    t.co2 += r.co2_kg
  }
  return t
}

export const share = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0)
export const delta = (now: number, prev: number) => (prev > 0 ? ((now - prev) / prev) * 100 : null)

/** Масса по месяцам с разбивкой по категориям — для графика динамики. */
export function byMonth(rows: RegistryRow[]) {
  const m = new Map<string, Record<Category, number>>()
  for (const r of rows) {
    const k = monthKey(r.entry_date)
    const v = m.get(k) ?? { avoidable: 0, unavoidable: 0, packaging: 0 }
    v[r.category] += r.mass_kg
    m.set(k, v)
  }
  return [...m].sort((a, b) => a[0].localeCompare(b[0])).map(([month, v]) => ({ month, ...v }))
}

export function groupSum<K extends string>(rows: RegistryRow[], key: (r: RegistryRow) => K | null, value: (r: RegistryRow) => number = (r) => r.mass_kg) {
  const m = new Map<K, number>()
  for (const r of rows) {
    const k = key(r)
    if (k === null) continue
    m.set(k, (m.get(k) ?? 0) + value(r))
  }
  return [...m].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
}

/** Средняя масса предотвратимых отходов за рабочий день по дням недели (пн = 0). */
export function byWeekday(rows: RegistryRow[]) {
  const sum = Array(7).fill(0) as number[]
  const days = Array.from({ length: 7 }, () => new Set<string>())
  for (const r of rows) {
    if (r.category !== 'avoidable') continue
    const d = (parseYmd(r.entry_date).getDay() + 6) % 7
    sum[d] += r.mass_kg; days[d].add(r.entry_date)
  }
  return sum.map((s, i) => ({ day: i, value: days[i].size ? s / days[i].size : 0 }))
}

/** Граммы отходов на одну выданную порцию: позволяет честно сравнивать столовую с кофейней. */
export function gramsPerPortion(rows: RegistryRow[], portions: { org_id: string; day: string; portions: number }[], avoidableOnly = false) {
  const key = (org: string, day: string) => `${org}|${day}`
  const mass = new Map<string, number>()
  for (const r of rows) {
    if (avoidableOnly && r.category !== 'avoidable') continue
    mass.set(key(r.org_id, r.entry_date), (mass.get(key(r.org_id, r.entry_date)) ?? 0) + r.mass_kg)
  }
  const byOrg = new Map<string, [number, number]>()
  for (const p of portions) {
    const kg = mass.get(key(p.org_id, p.day))
    if (kg === undefined || !p.portions) continue      // считаем только дни, где есть и масса, и порции
    const v = byOrg.get(p.org_id) ?? [0, 0]
    byOrg.set(p.org_id, [v[0] + kg, v[1] + p.portions])
  }
  let kg = 0, n = 0
  const perOrg = new Map<string, number>()
  for (const [org, [k, p]] of byOrg) { perOrg.set(org, (k / p) * 1000); kg += k; n += p }
  return { overall: n ? (kg / n) * 1000 : null, perOrg }
}

export interface Anomaly { org_id: string; org_ru: string; org_kk: string; waste_ru: string; waste_kk: string; now: number; mean: number; pct: number }

/** Отклонения: вид отхода в организации вырос за последний месяц более чем на threshold % к среднему прошлых месяцев. */
export function anomalies(rows: RegistryRow[], threshold = 20): { month: string | null; list: Anomaly[] } {
  const months = [...new Set(rows.map((r) => monthKey(r.entry_date)))].sort()
  if (months.length < 2) return { month: null, list: [] }
  const last = months[months.length - 1]
  const acc = new Map<string, { r: RegistryRow; now: number; prev: number; prevMonths: Set<string> }>()
  for (const r of rows) {
    const k = `${r.org_id}|${r.waste_type_id}`
    const a = acc.get(k) ?? { r, now: 0, prev: 0, prevMonths: new Set<string>() }
    const m = monthKey(r.entry_date)
    if (m === last) a.now += r.mass_kg; else { a.prev += r.mass_kg; a.prevMonths.add(m) }
    acc.set(k, a)
  }
  const list: Anomaly[] = []
  for (const a of acc.values()) {
    if (!a.prevMonths.size) continue
    const mean = a.prev / a.prevMonths.size
    const pct = mean > 0 ? ((a.now - mean) / mean) * 100 : 0
    if (pct > threshold && a.now - mean > 5) list.push({ org_id: a.r.org_id, org_ru: a.r.org_ru, org_kk: a.r.org_kk, waste_ru: a.r.waste_ru, waste_kk: a.r.waste_kk, now: a.now, mean, pct })
  }
  return { month: last, list: list.sort((a, b) => b.pct - a.pct) }
}

export const reasonSum = (rows: RegistryRow[]) =>
  groupSum<Reason>(rows.filter((r) => r.category === 'avoidable'), (r) => r.reason)
