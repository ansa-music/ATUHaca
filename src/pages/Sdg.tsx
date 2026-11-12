import { useEffect, useMemo, useState } from 'react'
import { AiInsightCard } from '../components/ai/AiCards'
import { Btn, Card, ErrorBox, PageTitle, Spinner, inputCls } from '../components/ui'
import { dmy, kzt, monthEnd, monthKey, monthLabel, num, today } from '../lib/format'
import { useLang } from '../lib/i18n'
import { gramsPerPortion, share, totals } from '../lib/metrics'
import { useRegistry } from '../lib/registry'
import { supabase } from '../lib/supabase'

/**
 * Отчёт по ЦУР 12.3 и ESG-метрикам для рейтингов устойчивого развития.
 * Всё считается из единого реестра — только из отчётов, принятых проверяющим.
 *
 * Коэффициенты (оценки, FAO «Food Wastage Footprint», 2013: 1,3 млрд т пищевых потерь в год):
 *  - CO2-экв.: 3,3 млрд т → ~2,5 кг CO2-экв. на 1 кг пищевых отходов (задан в справочнике видов отходов);
 *  - вода: 250 км³ «голубой» воды → ~0,19 м³ на 1 кг пищевых отходов (упаковка не учитывается).
 */
const WATER_M3_PER_KG = 0.19

type Gov = { expected: number; accepted: number; onTime: number; avgTrust: number | null }

export default function SdgPage() {
  const { L, lang } = useLang()
  const { data, error } = useRegistry()
  const [year, setYear] = useState(today().slice(0, 4))
  const [rescue, setRescue] = useState({ portions: 0, revenue: 0 })

  useEffect(() => {
    supabase.from('surplus_offers').select('sold,price,created_at').then(({ data: offers }) => {
      const list = (offers ?? []).filter((o) => String(o.created_at).startsWith(year))
      setRescue({ portions: list.reduce((s, o) => s + o.sold, 0), revenue: list.reduce((s, o) => s + o.sold * Number(o.price), 0) })
    })
  }, [year])

  const m = useMemo(() => {
    const rows = (data?.rows ?? []).filter((r) => r.entry_date.startsWith(year))
    const tot = totals(rows)
    const months = [...new Set(rows.map((r) => monthKey(r.entry_date)))].sort()
    const portions = (data?.portions ?? []).filter((p) => p.day.startsWith(year))
    const food = rows.filter((r) => r.category !== 'packaging')
    const foodKg = food.reduce((s, r) => s + r.mass_kg, 0)

    // ЦУР 12.3: предотвратимые пищевые отходы на одну порцию по месяцам — база (первый месяц) и текущий месяц.
    const perMonth = months.map((mk) => {
      const mr = rows.filter((r) => monthKey(r.entry_date) === mk)
      const g = gramsPerPortion(mr, portions.filter((p) => monthKey(p.day) === mk), true).overall
      const t = totals(mr)
      return { month: mk, g, mass: t.mass, avoidable: t.avoidable, diverted: t.diverted }
    })
    const withG = perMonth.filter((p) => p.g !== null)
    const baseline = withG[0]?.g ?? null
    const current = withG[withG.length - 1]?.g ?? null
    const target = baseline !== null ? baseline / 2 : null
    const progress = baseline && current !== null ? Math.max(0, Math.min(100, ((baseline - current) / (baseline - (target ?? 0))) * 100)) : null

    // Управление (G): дисциплина сдачи и достоверность отчётности.
    const orgs = data?.orgs ?? []
    const repsYear = (data?.reports ?? []).filter((r) => r.period_start.startsWith(year) && r.period_end < today())
    const closedMonths = months.filter((mk) => monthEnd(mk) < today())
    const expected = orgs.length * closedMonths.length
    const accepted = repsYear.filter((r) => r.status === 'accepted').length
    const onTime = repsYear.filter((r) => {
      if (!r.submitted_at) return false
      const deadline = new Date(r.period_end + 'T23:59:59'); deadline.setDate(deadline.getDate() + 5)
      return new Date(r.submitted_at) <= deadline
    }).length
    const trust = repsYear.map((r) => (r as unknown as { trust_score: number | null }).trust_score).filter((x): x is number => typeof x === 'number')
    const gov: Gov = { expected, accepted, onTime, avgTrust: trust.length ? trust.reduce((a, b) => a + b, 0) / trust.length : null }
    const verified = rows.filter((r) => r.has_photo || r.source === 'scale' || r.source === 'photo').length

    const perOrg = orgs.map((o) => ({ org: o, t: totals(rows.filter((r) => r.org_id === o.id)) })).filter((x) => x.t.count > 0)
    const year12 = months.length ? 12 / months.length : 0
    return { rows, tot, months, perMonth, baseline, current, target, progress, gov, verified, perOrg, foodKg, year12 }
  }, [data, year])

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!data) return <Spinner />

  const t = (kg: number, d = 2) => `${num(kg / 1000, d)} т`
  const landfill = m.tot.mass - m.tot.diverted
  const water = m.foodKg * WATER_M3_PER_KG
  const from = `${year}-01-01`
  const to = m.months.length ? monthEnd(m.months[m.months.length - 1]) : `${year}-12-31`

  async function exportExcel() {
    const ExcelJS = (await import('exceljs')).default
    const wb = new ExcelJS.Workbook()
    const head = { bold: true, color: { argb: 'FFFFFFFF' } }
    const fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF14532D' } }
    const ws = wb.addWorksheet('ЦУР 12.3 и ESG')
    ws.addRow([`Отчёт по ЦУР 12.3 и ESG-метрикам — пищевые отходы АО «АТУ», ${year}`]).font = { bold: true, size: 14 }
    ws.addRow([`Сформировано системой Qadir ${dmy(today())}. Источник — единый реестр (только принятые отчёты). Месяцев с данными: ${m.months.length}.`])
    ws.addRow([])
    const h = ws.addRow(['Блок', 'Показатель', 'Значение', 'Ед.', 'Примечание'])
    h.eachCell((c) => { c.font = head; c.fill = fill })
    const rows: [string, string, number | string, string, string][] = [
      ['ЦУР 12.3', 'Предотвратимые отходы на порцию — база', m.baseline !== null ? Math.round(m.baseline) : '—', 'г', m.perMonth.find((p) => p.g !== null)?.month ?? ''],
      ['ЦУР 12.3', 'Предотвратимые отходы на порцию — сейчас', m.current !== null ? Math.round(m.current) : '—', 'г', m.perMonth.filter((p) => p.g !== null).slice(-1)[0]?.month ?? ''],
      ['ЦУР 12.3', 'Цель 2030 (−50 % к базе)', m.target !== null ? Math.round(m.target) : '—', 'г', 'Задача 12.3: вдвое сократить пищевые отходы'],
      ['E', 'Образовано отходов', +(m.tot.mass / 1000).toFixed(3), 'т', `в пересчёте на год ≈ ${(m.tot.mass * m.year12 / 1000).toFixed(1)} т`],
      ['E', 'Предотвратимые отходы', +share(m.tot.avoidable, m.tot.mass).toFixed(1), '%', `${Math.round(m.tot.avoidable)} кг`],
      ['E', 'Пригодно к переработке', +share(m.tot.recyclable, m.tot.mass).toFixed(1), '%', `${Math.round(m.tot.recyclable)} кг`],
      ['E', 'Фактически переработано / компост', +share(m.tot.diverted, m.tot.mass).toFixed(1), '%', `${Math.round(m.tot.diverted)} кг`],
      ['E', 'Направлено на захоронение (ТБО)', +(landfill / 1000).toFixed(3), 'т', ''],
      ['E', 'CO2-эквивалент', +(m.tot.co2 / 1000).toFixed(3), 'т', '2,5 кг CO2-экв./кг, FAO 2013'],
      ['E', 'Вода, заложенная в выброшенную еду', Math.round(water), 'м³', 'оценка 0,19 м³/кг, FAO 2013'],
      ['E', 'Потери в деньгах', Math.round(m.tot.cost), '₸', 'по ценам-допущениям'],
      ['S', 'Спасено порций', rescue.portions, 'порций', `выручка ${Math.round(rescue.revenue)} ₸`],
      ['G', 'Принято отчётов из положенных', m.gov.expected ? `${m.gov.accepted} из ${m.gov.expected}` : '—', '', 'закрытые месяцы × организации'],
      ['G', 'Отчёты сданы в срок (до 5 числа)', m.gov.onTime, 'шт.', ''],
      ['G', 'Средний индекс достоверности', m.gov.avgTrust !== null ? Math.round(m.gov.avgTrust) : '—', 'из 100', 'автопроверка'],
      ['G', 'Взвешивания с фото или весов', +share(m.verified, m.rows.length).toFixed(1), '%', `${m.verified} из ${m.rows.length}`],
    ]
    rows.forEach((r) => ws.addRow(r))
    ws.columns.forEach((c, i) => { c.width = [10, 42, 14, 8, 44][i] })
    const wo = wb.addWorksheet('По организациям')
    const ho = wo.addRow(['Организация', 'Всего, кг', 'Предотвратимые, %', 'Пригодно к переработке, %', 'Переработано, %', 'CO2-экв., кг', 'Потери, ₸'])
    ho.eachCell((c) => { c.font = head; c.fill = fill })
    m.perOrg.forEach(({ org, t: x }) => wo.addRow([org.name_ru, Math.round(x.mass), +share(x.avoidable, x.mass).toFixed(1), +share(x.recyclable, x.mass).toFixed(1), +share(x.diverted, x.mass).toFixed(1), Math.round(x.co2), Math.round(x.cost)]))
    wo.columns.forEach((c, i) => { c.width = i === 0 ? 46 : 18 })
    const wm = wb.addWorksheet('По месяцам')
    const hm = wm.addRow(['Месяц', 'Всего, кг', 'Предотвратимые, кг', 'Переработано, кг', 'Предотвратимые на порцию, г'])
    hm.eachCell((c) => { c.font = head; c.fill = fill })
    m.perMonth.forEach((p) => wm.addRow([monthLabel(p.month, 'ru'), Math.round(p.mass), Math.round(p.avoidable), Math.round(p.diverted), p.g !== null ? Math.round(p.g) : '—']))
    wm.columns.forEach((c) => { c.width = 26 })
    const buf = await wb.xlsx.writeBuffer()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
    a.download = `Qadir_SDG12_${year}.xlsx`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }

  const Metric = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
    <div className="rounded-xl bg-white/70 p-3 ring-1 ring-black/5">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="tnum mt-1 text-xl font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
  const maxMass = Math.max(1, ...m.perMonth.map((p) => p.mass))

  return (
    <div className="mx-auto max-w-5xl">
      <div className="no-print">
        <PageTitle title={L('Отчёт ЦУР 12.3 и ESG', 'ТДМ 12.3 және ESG есебі')} sub={L('Для рейтингов устойчивого развития и ESG-отчётности университета', 'Университеттің тұрақты даму рейтингтері мен ESG-есептілігіне арналған')}
          right={<div className="flex flex-wrap gap-2">
            <select className={`${inputCls} !w-auto !py-2 text-sm`} value={year} onChange={(e) => setYear(e.target.value)}>
              {[today().slice(0, 4), String(Number(today().slice(0, 4)) - 1)].map((y) => <option key={y}>{y}</option>)}
            </select>
            <Btn variant="soft" onClick={exportExcel} disabled={!m.rows.length}>⬇ Excel</Btn>
            <Btn onClick={() => window.print()}>🖨 {L('PDF', 'PDF')}</Btn>
          </div>} />
      </div>

      {!m.rows.length ? <Card>{L('За выбранный год принятых данных нет.', 'Таңдалған жылы қабылданған дерек жоқ.')}</Card> : (
        <div className="space-y-4">
          <Card className="print:shadow-none print:ring-0">
            <div className="text-xs font-semibold uppercase tracking-widest text-brand-700">{L('Цель устойчивого развития ООН 12 · задача 12.3', 'БҰҰ тұрақты даму мақсаты 12 · 12.3-міндет')}</div>
            <h2 className="mt-1 text-2xl font-bold">{L('Пищевые отходы университетского комплекса АО «АТУ»', '«АТУ» АҚ университет кешенінің тағам қалдықтары')}, {year}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {L('Сформировано системой Qadir', 'Qadir жүйесі қалыптастырды')} {dmy(today())} · {L('только отчёты, принятые проверяющим', 'тек тексеруші қабылдаған есептер')} · {L('месяцев с данными', 'деректі айлар')}: {m.months.length} · {L('взвешиваний', 'өлшеу')}: {m.rows.length.toLocaleString('ru-RU')}
            </p>
          </Card>

          {/* ЦУР 12.3: сократить вдвое */}
          <Card className="bg-gradient-to-br from-brand-800 to-brand-900 text-white print:bg-white print:text-black">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-wheat-light print:text-brand-700">{L('Задача 12.3 — к 2030 году вдвое сократить пищевые отходы', '12.3-міндет — 2030 жылға қарай тағам қалдықтарын екі есе азайту')}</div>
                <p className="mt-1 max-w-2xl text-sm text-white/75 print:text-slate-600">{L('Измеряем предотвратимые пищевые отходы на одну выданную порцию: так показатель не зависит от числа студентов и сравним с другими вузами.', 'Бір берілген порцияға шаққандағы алдын алуға болатын тағам қалдығын өлшейміз: көрсеткіш студенттер санына тәуелсіз және басқа ЖОО-мен салыстыруға болады.')}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                [L('База', 'Базалық'), m.baseline],
                [L('Сейчас', 'Қазір'), m.current],
                [L('Цель 2030', '2030 мақсаты'), m.target],
              ].map(([label, v]) => (
                <div key={String(label)} className="rounded-xl bg-white/10 p-3 print:bg-slate-50">
                  <div className="text-xs uppercase tracking-wide text-white/70 print:text-slate-500">{label}</div>
                  <div className="tnum text-2xl font-bold">{v === null ? '—' : `${num(v as number, 0)} г`}</div>
                  <div className="text-xs text-white/60 print:text-slate-500">{L('на порцию', 'порцияға')}</div>
                </div>
              ))}
            </div>
            {m.progress !== null && (
              <div className="mt-4">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span>{L('Путь к цели', 'Мақсатқа жол')}: <b>{num(m.progress, 0)}%</b></span>
                  {m.baseline !== null && m.current !== null && (() => {
                    const d = ((m.current - m.baseline) / m.baseline) * 100
                    return d > 0
                      ? <b className="rounded-full bg-rose-500/90 px-2.5 py-0.5 text-xs text-white">▲ {num(d, 0)}% {L('к базе — отходы растут, нужны меры', 'базаға — қалдық өсуде, шара қажет')}</b>
                      : <b className="rounded-full bg-emerald-500/90 px-2.5 py-0.5 text-xs text-white">▼ {num(-d, 0)}% {L('к базе', 'базаға')}</b>
                  })()}
                </div>
                <div className="mt-1.5 h-3 rounded-full bg-white/15 print:bg-slate-200"><div className="h-3 rounded-full bg-wheat-light" style={{ width: `${Math.max(2, m.progress)}%` }} /></div>
                <p className="mt-1.5 text-xs text-white/60 print:text-slate-500">{L('База — первый месяц учёта в Qadir. Порции вносят столовая, гостиница и кофейня; лаборатории в этот показатель не входят.', 'База — Qadir-дағы есептің бірінші айы. Порцияларды асхана, қонақ үй және кофехана енгізеді; зертханалар бұл көрсеткішке кірмейді.')}</p>
              </div>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <h3 className="font-bold"><span className="mr-2 rounded-md bg-emerald-100 px-1.5 py-0.5 text-emerald-800">E</span>{L('Экология', 'Экология')}</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-3">
                <Metric label={L('Образовано', 'Түзілді')} value={t(m.tot.mass)} sub={`${L('в год', 'жылына')} ≈ ${t(m.tot.mass * m.year12, 1)}`} />
                <Metric label={L('Предотвратимые', 'Алдын алуға болатын')} value={`${num(share(m.tot.avoidable, m.tot.mass), 0)}%`} sub={t(m.tot.avoidable)} />
                <Metric label={L('Переработано', 'Қайта өңделді')} value={`${num(share(m.tot.diverted, m.tot.mass), 0)}%`} sub={`${L('пригодно', 'жарамды')} ${num(share(m.tot.recyclable, m.tot.mass), 0)}%`} />
                <Metric label={L('На захоронение', 'Көмуге')} value={t(landfill)} sub={L('вывоз ТБО', 'ҚТҚ шығару')} />
                <Metric label="CO₂-экв." value={t(m.tot.co2)} sub="FAO, 2013" />
                <Metric label={L('Вода в еде', 'Тағамдағы су')} value={`${num(water, 0)} м³`} sub={L('оценка, FAO 2013', 'бағалау, FAO 2013')} />
              </div>
            </Card>
            <div className="space-y-4">
              <Card>
                <h3 className="font-bold"><span className="mr-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-amber-800">S</span>{L('Общество', 'Қоғам')}</h3>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Metric label={L('Спасено порций', 'Сақталған порция')} value={rescue.portions.toLocaleString('ru-RU')} />
                  <Metric label={L('Выручка', 'Түсім')} value={kzt(rescue.revenue)} />
                </div>
                <p className="mt-2 text-xs text-slate-500">{L('Остатки дня продаются студентам со скидкой вместо вывоза.', 'Күн қалдығы шығарудың орнына студенттерге жеңілдікпен сатылады.')}</p>
              </Card>
              <Card>
                <h3 className="font-bold"><span className="mr-2 rounded-md bg-blue-100 px-1.5 py-0.5 text-blue-800">G</span>{L('Управление', 'Басқару')}</h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  <li className="flex justify-between gap-2"><span>{L('Принято отчётов', 'Қабылданған есеп')}</span><b className="tnum">{m.gov.expected ? `${m.gov.accepted} / ${m.gov.expected}` : '—'}</b></li>
                  <li className="flex justify-between gap-2"><span>{L('Сдано в срок', 'Мерзімінде тапсырылды')}</span><b className="tnum">{m.gov.onTime}</b></li>
                  <li className="flex justify-between gap-2"><span>{L('Индекс достоверности', 'Сенімділік индексі')}</span><b className="tnum">{m.gov.avgTrust === null ? '—' : num(m.gov.avgTrust, 0)}</b></li>
                  <li className="flex justify-between gap-2"><span>{L('С фото или весов', 'Фото немесе таразымен')}</span><b className="tnum">{num(share(m.verified, m.rows.length), 0)}%</b></li>
                </ul>
              </Card>
            </div>
          </div>

          <div className="no-print">
            <AiInsightCard from={from} to={to} fallback={null} />
          </div>

          <Card>
            <h3 className="mb-2 font-bold">{L('Измерение отходов по подразделениям', 'Бөлімшелер бойынша қалдықты өлшеу')}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-1.5 text-left font-medium">{L('Организация', 'Ұйым')}</th>
                  <th className="py-1.5 text-right font-medium">{L('Всего, кг', 'Барлығы, кг')}</th>
                  <th className="py-1.5 text-right font-medium">{L('Предотвр.', 'Алдын алу')}</th>
                  <th className="py-1.5 text-right font-medium">{L('Перераб.', 'Қайта өңд.')}</th>
                  <th className="py-1.5 text-right font-medium">CO₂, кг</th>
                  <th className="py-1.5 text-right font-medium">{L('Потери', 'Шығын')}</th>
                </tr></thead>
                <tbody>
                  {m.perOrg.map(({ org, t: x }) => (
                    <tr key={org.id} className="border-b border-slate-100">
                      <td className="py-1.5">{lang === 'kk' ? org.name_kk : org.name_ru}</td>
                      <td className="tnum py-1.5 text-right">{num(x.mass, 0)}</td>
                      <td className="tnum py-1.5 text-right">{num(share(x.avoidable, x.mass), 0)}%</td>
                      <td className="tnum py-1.5 text-right">{num(share(x.diverted, x.mass), 0)}%</td>
                      <td className="tnum py-1.5 text-right">{num(x.co2, 0)}</td>
                      <td className="tnum py-1.5 text-right">{kzt(x.cost)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold"><td className="py-2">{L('Итого', 'Жиыны')}</td><td className="tnum py-2 text-right">{num(m.tot.mass, 0)}</td><td className="tnum py-2 text-right">{num(share(m.tot.avoidable, m.tot.mass), 0)}%</td><td className="tnum py-2 text-right">{num(share(m.tot.diverted, m.tot.mass), 0)}%</td><td className="tnum py-2 text-right">{num(m.tot.co2, 0)}</td><td className="tnum py-2 text-right">{kzt(m.tot.cost)}</td></tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <h3 className="mb-3 font-bold">{L('Динамика по месяцам', 'Айлар бойынша динамика')}</h3>
            <div className="flex items-end gap-2">
              {m.perMonth.map((p) => (
                <div key={p.month} className="flex-1 text-center">
                  <div className="tnum text-xs font-semibold">{num(p.mass, 0)} {L('кг', 'кг')}</div>
                  <div className="mx-auto mt-1 flex w-full max-w-16 flex-col justify-end overflow-hidden rounded-t" style={{ height: `${(p.mass / maxMass) * 120}px` }}>
                    <div className="bg-orange-500" style={{ height: `${share(p.avoidable, p.mass)}%` }} />
                    <div className="flex-1 bg-brand-600" />
                  </div>
                  <div className="mt-1 text-xs capitalize text-slate-500">{monthLabel(p.month, lang, false)}</div>
                  <div className="tnum text-xs text-slate-400">{p.g === null ? '' : `${num(p.g, 0)} г/порц.`}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-4 text-xs text-slate-500"><span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-orange-500" />{L('предотвратимые', 'алдын алуға болатын')}</span><span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-brand-600" />{L('остальные', 'басқалары')}</span></div>
          </Card>

          <Card>
            <h3 className="font-bold">{L('Методика и источники', 'Әдістеме және дереккөздер')}</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
              <li>{L('Масса — сумма взвешиваний ответственных лиц из отчётов, принятых проверяющим; литры переведены в килограммы по плотности.', 'Масса — тексеруші қабылдаған есептердегі жауапты тұлғалар өлшеулерінің қосындысы; литр тығыздық бойынша килограммға аударылған.')}</li>
              <li>{L('Предотвратимые — нереализованная продукция и остатки из зала; неизбежные — очистки, кости, скорлупа; упаковка учитывается отдельно.', 'Алдын алуға болатыны — сатылмаған өнім мен залдағы қалдық; болмай қоймайтыны — қабық, сүйек; орама бөлек есептеледі.')}</li>
              <li>{L('Переработано — отходы, направленные на компост, вторсырьё, корм или переработчику масла.', 'Қайта өңделді — компостқа, қайталама шикізатқа, азыққа немесе май өңдеушіге жіберілген қалдық.')}</li>
              <li>{L('CO₂-экв. 2,5 кг и вода 0,19 м³ на 1 кг пищевых отходов — средние оценки FAO «Food Wastage Footprint» (2013); упаковка не учитывается.', '1 кг тағам қалдығына 2,5 кг CO₂-бал. және 0,19 м³ су — FAO «Food Wastage Footprint» (2013) орташа бағалары; орама есепке алынбайды.')}</li>
              <li>{L('Потери в тенге — оценка по ценам-допущениям из справочника видов отходов. Годовая оценка — пересчёт по числу месяцев с данными.', 'Теңгедегі шығын — қалдық түрлері анықтамалығындағы болжамды бағалар бойынша бағалау. Жылдық бағалау — деректі айлар саны бойынша қайта есептеу.')}</li>
            </ul>
          </Card>
        </div>
      )}
    </div>
  )
}

