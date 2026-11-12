import { parseYmd, today, ymd } from './format'
import type { Entry, Report } from './types'

export interface TrustReason { ru: string; kk: string; penalty: number }
export interface Trust {
  score: number                 // 0–100, чем выше, тем больше доверия к отчёту
  level: 'high' | 'medium' | 'low'
  reasons: TrustReason[]
  flagged: Map<string, string>  // id записи → почему подсвечена
  suggestion: string            // черновик комментария для возврата
}

const DAY = 86_400_000

/**
 * Индекс достоверности отчёта: ищет признаки того, что журнал заполняли «задним числом» или на глаз.
 * Это подсказка проверяющему, решение остаётся за человеком.
 *
 * @param entries записи отчёта
 * @param report  отчёт (нужен период)
 * @param means   среднее количество на одну запись по виду отхода за предыдущие месяцы (из единого реестра)
 * @param isLab   у учебных лабораторий записи идут только в дни занятий — пропуски дней не считаем
 */
export function trustIndex(entries: Entry[], report: Report, means: Map<string, number>, isLab: boolean): Trust {
  const reasons: TrustReason[] = []
  const flagged = new Map<string, string>()
  const notes: string[] = []
  if (entries.length === 0) return { score: 0, level: 'low', reasons: [{ ru: 'В отчёте нет записей', kk: 'Есепте жазба жоқ', penalty: 100 }], flagged, suggestion: 'В отчёте нет записей.' }

  // 1. Внесено задним числом: запись создана позже чем через 2 дня после даты взвешивания.
  const late = entries.filter((e) => new Date(e.created_at).getTime() - parseYmd(e.entry_date).getTime() > 3 * DAY)
  const lateShare = late.length / entries.length
  // …и пачкой: больше половины записей создано в пределах одного часа.
  const times = entries.map((e) => new Date(e.created_at).getTime()).sort((a, b) => a - b)
  let burst = 0
  for (let i = 0, j = 0; i < times.length; i++) {
    while (times[i] - times[j] > 3_600_000) j++
    burst = Math.max(burst, i - j + 1)
  }
  const burstShare = burst / entries.length
  if (lateShare > 0.3) {
    const p = Math.round(Math.min(35, lateShare * 35 + (burstShare > 0.5 ? 10 : 0)))
    const pct = Math.round(lateShare * 100)
    reasons.push({
      ru: `${pct}% записей внесены позже чем через 2 дня после взвешивания${burstShare > 0.5 ? `, из них ${burst} — за один час` : ''}`,
      kk: `Жазбалардың ${pct}%-ы өлшеуден 2 күннен кейін енгізілген${burstShare > 0.5 ? `, оның ${burst}-і — бір сағат ішінде` : ''}`,
      penalty: p,
    })
    notes.push('записи внесены не в день взвешивания, а одной пачкой')
    for (const e of late) flagged.set(e.id, 'late')
  }

  // 2. Круглые значения: при реальном взвешивании целые числа встречаются редко.
  const round = entries.filter((e) => Number(e.quantity) % 1 === 0)
  const roundShare = round.length / entries.length
  if (entries.length >= 8 && roundShare > 0.5) {
    reasons.push({
      ru: `${Math.round(roundShare * 100)}% значений — целые числа, похоже на оценку «на глаз»`,
      kk: `Мәндердің ${Math.round(roundShare * 100)}%-ы — бүтін сандар, «көзбен» бағалауға ұқсайды`,
      penalty: Math.round(Math.min(20, (roundShare - 0.3) * 30)),
    })
    notes.push('значения округлены до целых')
  }

  // 3. Повторы: одно и то же количество по виду отхода изо дня в день.
  const byType = new Map<string, number[]>()
  for (const e of entries) byType.set(e.waste_type_id, [...(byType.get(e.waste_type_id) ?? []), Number(e.quantity)])
  let repeatSum = 0, repeatN = 0
  for (const list of byType.values()) {
    if (list.length < 4) continue
    const freq = new Map<number, number>()
    for (const q of list) freq.set(q, (freq.get(q) ?? 0) + 1)
    repeatSum += Math.max(...freq.values()) / list.length; repeatN++
  }
  const repeatShare = repeatN ? repeatSum / repeatN : 0
  if (repeatShare > 0.5) {
    reasons.push({
      ru: `Одинаковые значения повторяются в ${Math.round(repeatShare * 100)}% записей по виду отхода`,
      kk: `Қалдық түрі бойынша жазбалардың ${Math.round(repeatShare * 100)}%-ында бірдей мәндер қайталанады`,
      penalty: Math.round(Math.min(20, (repeatShare - 0.3) * 30)),
    })
    notes.push('количество по дням совпадает')
  }

  // 4. Пропущенные рабочие дни.
  if (!isLab) {
    const days = new Set(entries.map((e) => e.entry_date))
    const last = report.period_end < today() ? report.period_end : today()
    const missing: string[] = []
    for (let d = parseYmd(report.period_start); ymd(d) <= last; d = new Date(d.getTime() + DAY)) {
      const dow = d.getDay()
      if (dow !== 0 && dow !== 6 && !days.has(ymd(d)) && ymd(d) !== today()) missing.push(ymd(d))
    }
    if (missing.length > 0) {
      const list = missing.slice(0, 6).map((m) => `${m.slice(8, 10)}.${m.slice(5, 7)}`).join(', ')
      reasons.push({
        ru: `Нет записей за ${missing.length} раб. дн.: ${list}${missing.length > 6 ? '…' : ''}`,
        kk: `${missing.length} жұмыс күніне жазба жоқ: ${list}${missing.length > 6 ? '…' : ''}`,
        penalty: Math.min(15, missing.length * 3),
      })
      notes.push(`нет записей за ${list}`)
    }
  }

  // 5. Выбросы к среднему за предыдущие месяцы.
  let outliers = 0
  for (const e of entries) {
    const m = means.get(e.waste_type_id)
    if (!m) continue
    const q = Number(e.quantity)
    if (q > m * 2.5 || q < m * 0.25) { outliers++; flagged.set(e.id, 'outlier') }
  }
  if (outliers > 0) {
    reasons.push({
      ru: `${outliers} значений сильно отличаются от среднего за прошлые месяцы`,
      kk: `${outliers} мән өткен айлардағы орташадан қатты ерекшеленеді`,
      penalty: Math.min(10, outliers * 2),
    })
    notes.push('часть значений резко отличается от обычных')
  }

  const score = Math.max(0, 100 - reasons.reduce((s, r) => s + r.penalty, 0))
  const level = score >= 80 ? 'high' : score >= 55 ? 'medium' : 'low'
  const suggestion = notes.length
    ? `Просим уточнить данные: ${notes.join('; ')}. Исправьте записи по фактическим взвешиваниям и отправьте отчёт повторно.`
    : ''
  return { score, level, reasons, flagged, suggestion }
}
