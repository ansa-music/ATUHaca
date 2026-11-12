import { useMemo, useState } from 'react'
import { Btn, Card, ErrorBox, PageTitle, Pill, Spinner, StatusBadge, inputCls } from '../components/ui'
import { exportSummary, type SummaryBlock } from '../lib/excel'
import { monthKey, monthLabel, monthStart, monthsBetween, num, periodRange, quarterOf } from '../lib/format'
import { useLang } from '../lib/i18n'
import { useRegistry } from '../lib/registry'

type Kind = 'month' | 'quarter' | 'year'

/** Сводный отчёт за месяц / квартал / год по организациям и видам отходов, выгрузка в Excel, контроль несдавших. */
export default function SummaryPage() {
  const { L, lang } = useLang()
  const { data, error } = useRegistry()
  const now = monthKey(monthStart())
  const [kind, setKind] = useState<Kind>('quarter')
  // По умолчанию — последний завершённый квартал.
  const [value, setValue] = useState(`${now.slice(0, 4)}-Q${Math.max(1, quarterOf(now) - 1)}`)
  const [busy, setBusy] = useState(false)

  const choices = useMemo(() => {
    const y = Number(now.slice(0, 4))
    if (kind === 'year') return [String(y), String(y - 1)]
    if (kind === 'quarter') return [4, 3, 2, 1].filter((q) => q <= quarterOf(now)).map((q) => `${y}-Q${q}`)
    return monthsBetween(`${y}-01-01`, `${now}-01`).reverse()
  }, [kind, now])

  const current = choices.includes(value) ? value : choices[0]
  const [from, to] = periodRange(kind, current)
  const months = useMemo(() => monthsBetween(from, to).filter((m) => m <= now), [from, to, now])

  const { blocks, rows, missing } = useMemo(() => {
    const all = (data?.rows ?? []).filter((r) => r.entry_date >= from && r.entry_date <= to)
    const blocks: SummaryBlock[] = (data?.orgs ?? []).map((org) => {
      const map = new Map<string, SummaryBlock['lines'][number]>()
      let totalKg = 0, totalL = 0
      for (const r of all) {
        if (r.org_id !== org.id) continue
        const key = r.waste_type_id
        if (!map.has(key)) map.set(key, { waste: lang === 'kk' ? r.waste_kk : r.waste_ru, unit: r.unit === 'l' ? 'л' : 'кг', disposal: (lang === 'kk' ? r.disposal_kk : r.disposal_ru) ?? '', byMonth: months.map(() => 0), total: 0 })
        const line = map.get(key)!
        const i = months.indexOf(monthKey(r.entry_date))
        if (i >= 0) line.byMonth[i] += r.quantity
        line.total += r.quantity
        if (r.unit === 'l') totalL += r.quantity; else totalKg += r.quantity
      }
      return { org, lines: [...map.values()].sort((a, b) => b.total - a.total), totalKg, totalL }
    })
    // Контроль несдавших: организации без принятого отчёта за месяц периода.
    const missing = months.map((m) => ({
      month: m,
      orgs: (data?.orgs ?? []).filter((o) => !(data?.reports ?? []).some((r) => r.org_id === o.id && monthKey(r.period_start) === m && r.status === 'accepted')),
    }))
    return { blocks, rows: all, missing }
  }, [data, from, to, months, lang])

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!data) return <Spinner text={L('Формируем свод…', 'Жиынтық қалыптастырылуда…')} />

  const title = kind === 'year' ? `${L('Сводный отчёт за', 'Жиынтық есеп:')} ${current} ${L('год', 'жыл')}`
    : kind === 'quarter' ? `${L('Сводный отчёт за', 'Жиынтық есеп:')} ${current.split('-Q')[1]} ${L('квартал', 'тоқсан')} ${current.slice(0, 4)}`
    : `${L('Сводный отчёт за', 'Жиынтық есеп:')} ${monthLabel(current, lang)}`
  const grandKg = blocks.reduce((s, b) => s + b.totalKg, 0)
  const grandL = blocks.reduce((s, b) => s + b.totalL, 0)
  const statusOf = (orgId: string, m: string) => data.reports.find((r) => r.org_id === orgId && monthKey(r.period_start) === m)?.status

  async function download() {
    setBusy(true)
    try {
      await exportSummary({
        title, months, blocks, rows,
        missing: missing.map((m) => ({ month: m.month, orgs: m.orgs.map((o) => o.name_ru) })),
        fileName: `Qadir_svod_${current}.xlsx`,
      })
    } finally { setBusy(false) }
  }

  return (
    <div>
      <PageTitle title={L('Сводный отчёт', 'Жиынтық есеп')} sub={title}
        right={<Btn onClick={download} disabled={busy || rows.length === 0}>⬇ {L('Скачать Excel', 'Excel жүктеу')}</Btn>} />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-xl ring-1 ring-slate-300">
            {(['month', 'quarter', 'year'] as Kind[]).map((k) => (
              <button key={k} onClick={() => setKind(k)} className={`px-3 py-2 text-sm font-medium ${kind === k ? 'bg-brand-700 text-white' : 'bg-white text-slate-700'}`}>
                {k === 'month' ? L('Месяц', 'Ай') : k === 'quarter' ? L('Квартал', 'Тоқсан') : L('Год', 'Жыл')}
              </button>
            ))}
          </div>
          <select className={`${inputCls} !w-auto !py-2 text-sm capitalize`} value={current} onChange={(e) => setValue(e.target.value)}>
            {choices.map((c) => <option key={c} value={c}>{kind === 'month' ? monthLabel(c, lang) : kind === 'quarter' ? `${c.split('-Q')[1]} ${L('квартал', 'тоқсан')} ${c.slice(0, 4)}` : c}</option>)}
          </select>
          <span className="ml-auto text-sm text-slate-600">{L('Всего по комплексу', 'Кешен бойынша барлығы')}: <b>{num(grandKg)} {L('кг', 'кг')}</b>{grandL > 0 && <> + <b>{num(grandL)} {L('л', 'л')}</b></>}</span>
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-2 font-bold">{L('Контроль сдачи отчётов', 'Есеп тапсыруды бақылау')}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500">
              <th className="py-1.5 pr-3 text-left font-medium">{L('Организация', 'Ұйым')}</th>
              {months.map((m) => <th key={m} className="px-2 py-1.5 text-left font-medium capitalize">{monthLabel(m, lang, false)}</th>)}
            </tr></thead>
            <tbody>
              {data.orgs.map((o) => (
                <tr key={o.id} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3">{lang === 'kk' ? o.name_kk : o.name_ru}</td>
                  {months.map((m) => {
                    const s = statusOf(o.id, m)
                    return <td key={m} className="px-2 py-1.5">{s ? <StatusBadge status={s} /> : <Pill tone="rose">{L('не сдан', 'тапсырылмады')}</Pill>}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {missing.some((m) => m.orgs.length > 0) && (
          <p className="mt-3 text-sm text-rose-800">
            <b>{L('Нет принятого отчёта', 'Қабылданған есеп жоқ')}:</b>{' '}
            {missing.filter((m) => m.orgs.length).map((m) => `${monthLabel(m.month, lang, false)} — ${m.orgs.map((o) => (lang === 'kk' ? o.name_kk : o.name_ru)).join(', ')}`).join('; ')}
          </p>
        )}
      </Card>

      <div className="space-y-4">
        {blocks.map((b) => (
          <Card key={b.org.id} className="!p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-brand-50 px-4 py-2.5">
              <span className="font-bold">{lang === 'kk' ? b.org.name_kk : b.org.name_ru}</span>
              <span className="text-sm font-semibold text-brand-800">{num(b.totalKg)} {L('кг', 'кг')}{b.totalL > 0 && ` + ${num(b.totalL)} ${L('л', 'л')}`}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-slate-500">
                  <th className="px-4 py-2 text-left font-medium">{L('Наименование отходов', 'Қалдықтардың атауы')}</th>
                  <th className="hidden px-3 py-2 text-left font-medium md:table-cell">{L('Способ утилизации', 'Кәдеге жарату тәсілі')}</th>
                  {months.map((m) => <th key={m} className="px-3 py-2 text-right font-medium capitalize">{monthLabel(m, lang, false)}</th>)}
                  <th className="px-4 py-2 text-right font-medium">{L('Итого', 'Жиыны')}</th>
                </tr></thead>
                <tbody>
                  {b.lines.map((l) => (
                    <tr key={l.waste} className="border-t border-slate-100">
                      <td className="px-4 py-1.5">{l.waste}</td>
                      <td className="hidden px-3 py-1.5 text-slate-500 md:table-cell">{l.disposal}</td>
                      {l.byMonth.map((q, i) => <td key={i} className="px-3 py-1.5 text-right tabular-nums">{q ? num(q) : '—'}</td>)}
                      <td className="whitespace-nowrap px-4 py-1.5 text-right font-bold tabular-nums">{num(l.total)} {l.unit === 'л' ? L('л', 'л') : L('кг', 'кг')}</td>
                    </tr>
                  ))}
                  {b.lines.length === 0 && <tr><td colSpan={months.length + 3} className="px-4 py-4 text-center text-slate-400">{L('Нет принятых данных за период', 'Кезең бойынша қабылданған дерек жоқ')}</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
