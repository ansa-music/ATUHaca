import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, ErrorBox, Kpi, PageTitle, Pill, Spinner, inputCls } from '../components/ui'
import { useAuth } from '../lib/auth'
import { kzt, monthEnd, monthKey, monthLabel, num } from '../lib/format'
import { CATEGORY, REASON, useLang } from '../lib/i18n'
import { anomalies, byMonth, byWeekday, delta, gramsPerPortion, groupSum, reasonSum, share, totals } from '../lib/metrics'
import { useRegistry } from '../lib/registry'
import { supabase } from '../lib/supabase'

const C = { avoidable: '#d9622b', unavoidable: '#2f8f57', packaging: '#6c8fb3' }
const PALETTE = ['#17633a', '#c98a1b', '#d9622b', '#6c8fb3', '#8a6fb0', '#3a9fa3', '#b0506a', '#7d8a3a', '#94a3b8']
const DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const DAYS_KK = ['Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сн', 'Жс']
const DAYS_FULL_RU = ['понедельникам', 'вторникам', 'средам', 'четвергам', 'пятницам', 'субботам', 'воскресеньям']
const DAYS_FULL_KK = ['дүйсенбі', 'сейсенбі', 'сәрсенбі', 'бейсенбі', 'жұма', 'сенбі', 'жексенбі']

function Trend({ pct, goodWhenDown = true }: { pct: number | null; goodWhenDown?: boolean }) {
  if (pct === null) return null
  const good = goodWhenDown ? pct <= 0 : pct >= 0
  return <span className={`font-semibold ${good ? 'text-emerald-700' : 'text-rose-700'}`}>{pct > 0 ? '▲' : '▼'} {num(Math.abs(pct), 0)}%</span>
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const { L, lang } = useLang()
  const { data, error } = useRegistry()
  const staff = profile?.role !== 'responsible'
  const [org, setOrg] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [redirect, setRedirect] = useState(50)
  const [rescue, setRescue] = useState({ portions: 0, revenue: 0 })

  useEffect(() => {
    supabase.from('surplus_offers').select('sold,price').then(({ data }) => {
      const list = data ?? []
      setRescue({ portions: list.reduce((s, o) => s + o.sold, 0), revenue: list.reduce((s, o) => s + o.sold * Number(o.price), 0) })
    })
  }, [data])

  const months = useMemo(() => [...new Set((data?.rows ?? []).map((r) => monthKey(r.entry_date)))].sort(), [data])
  const f = from || months[0] || ''
  const t = to || months[months.length - 1] || ''

  const rows = useMemo(
    () => (data?.rows ?? []).filter((r) => (!org || r.org_id === org) && r.entry_date >= `${f}-01` && r.entry_date <= monthEnd(t || '9999-12')),
    [data, org, f, t],
  )

  const m = useMemo(() => {
    const tot = totals(rows)
    const portions = (data?.portions ?? []).filter((p) => !org || p.org_id === org)
    const gpp = gramsPerPortion(rows, portions)
    const gppAvoid = gramsPerPortion(rows, portions, true)
    const monthly = byMonth(rows)
    // Сравнение периодов: последний месяц выборки к предыдущему.
    const last = monthly[monthly.length - 1], prev = monthly[monthly.length - 2]
    const sumOf = (x?: (typeof monthly)[number]) => (x ? x.avoidable + x.unavoidable + x.packaging : 0)
    const week = byWeekday(rows)
    const active = week.filter((w) => w.value > 0)
    const peak = active.length ? active.reduce((a, b) => (b.value > a.value ? b : a)) : null
    const rest = peak ? active.filter((w) => w.day !== peak.day) : []
    const restAvg = rest.length ? rest.reduce((s, w) => s + w.value, 0) / rest.length : 0
    const topAvoid = groupSum(rows.filter((r) => r.category === 'avoidable'), (r) => (lang === 'kk' ? r.waste_kk : r.waste_ru))[0]
    const topAvoidCost = topAvoid ? rows.filter((r) => (lang === 'kk' ? r.waste_kk : r.waste_ru) === topAvoid.name).reduce((s, r) => s + r.cost_kzt, 0) : 0
    return {
      tot, gpp, gppAvoid, monthly, last, prev,
      monthDelta: delta(sumOf(last), sumOf(prev)), avoidDelta: delta(last?.avoidable ?? 0, prev?.avoidable ?? 0),
      byWaste: groupSum(rows, (r) => (lang === 'kk' ? r.waste_kk : r.waste_ru)),
      byOrg: groupSum(rows, (r) => r.org_id),
      reasons: reasonSum(rows), week, peak, peakPct: peak && restAvg ? ((peak.value - restAvg) / restAvg) * 100 : 0,
      topAvoid, topAvoidCost,
      landfillRecyclable: rows.filter((r) => r.recyclable && !r.diverts).reduce((s, r) => s + r.mass_kg, 0),
      anomalies: anomalies(rows),
    }
  }, [rows, data, org, lang])

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!data) return <Spinner text={L('Загрузка аналитики…', 'Аналитика жүктелуде…')} />

  const orgName = (id: string) => { const o = data.orgs.find((x) => x.id === id); return o ? (lang === 'kk' ? o.name_kk : o.name_ru) : id }
  const short = (s: string) => (s.length > 26 ? `${s.slice(0, 25)}…` : s)
  const wasteTop = m.byWaste.slice(0, 8)
  const wasteRest = m.byWaste.slice(8).reduce((s, x) => s + x.value, 0)
  const pie = wasteRest > 0 ? [...wasteTop, { name: L('Прочее', 'Басқа'), value: wasteRest }] : wasteTop
  const landfill = m.tot.mass - m.tot.diverted
  const moved = (m.landfillRecyclable * redirect) / 100
  const fmtKg = (v: number) => `${num(v)} ${L('кг', 'кг')}`

  return (
    <div className="space-y-4">
      <PageTitle title={L('Аналитика', 'Аналитика')}
        sub={L('По принятым отчётам. Обновляется автоматически, когда проверяющий принимает отчёт.', 'Қабылданған есептер бойынша. Тексеруші есепті қабылдағанда автоматты түрде жаңарады.')}
        right={<Pill tone="green">● {L('обновляется вживую', 'тікелей жаңарады')}</Pill>} />

      <Card>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {staff && (
            <label className="col-span-2 text-xs font-medium text-slate-500">{L('Организация', 'Ұйым')}
              <select className={`${inputCls} mt-1 !py-2 text-sm`} value={org} onChange={(e) => setOrg(e.target.value)}>
                <option value="">{L('Все организации', 'Барлық ұйымдар')}</option>
                {data.orgs.map((o) => <option key={o.id} value={o.id}>{lang === 'kk' ? o.name_kk : o.name_ru}</option>)}
              </select>
            </label>
          )}
          <label className="text-xs font-medium text-slate-500">{L('С месяца', 'Айдан бастап')}
            <select className={`${inputCls} mt-1 !py-2 text-sm capitalize`} value={f} onChange={(e) => setFrom(e.target.value)}>
              {months.map((x) => <option key={x} value={x}>{monthLabel(x, lang)}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">{L('По месяц', 'Айға дейін')}
            <select className={`${inputCls} mt-1 !py-2 text-sm capitalize`} value={t} onChange={(e) => setTo(e.target.value)}>
              {months.map((x) => <option key={x} value={x}>{monthLabel(x, lang)}</option>)}
            </select>
          </label>
        </div>
      </Card>

      {rows.length === 0 ? <Card>{L('За выбранный период принятых данных нет.', 'Таңдалған кезеңде қабылданған дерек жоқ.')}</Card> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={L('Всего отходов', 'Барлық қалдық')} value={m.tot.mass >= 1000 ? `${num(m.tot.mass / 1000, 2)} т` : fmtKg(m.tot.mass)} sub={`${m.tot.count} ${L('взвешиваний', 'өлшеу')}`} />
            <Kpi tone="rose" label={L('Предотвратимые', 'Алдын алуға болатын')} value={`${num(share(m.tot.avoidable, m.tot.mass), 0)}%`} sub={`${fmtKg(m.tot.avoidable)} — ${L('то, что можно было не выбросить', 'тастамауға болатын еді')}`} />
            <Kpi tone="amber" label={L('Потери в деньгах', 'Ақшалай шығын')} value={kzt(m.tot.cost)} sub={L('оценка по ценам-допущениям', 'болжамды бағалар бойынша')} />
            <Kpi label={L('CO₂-эквивалент', 'CO₂-баламасы')} value={`${num(m.tot.co2 / 1000, 2)} т`} sub={L('2,5 кг CO₂-экв. на кг пищи (FAO, 2013)', '1 кг тағамға 2,5 кг CO₂-бал. (FAO, 2013)')} />
            <Kpi tone="green" label={L('Пригодно к переработке', 'Қайта өңдеуге жарамды')} value={`${num(share(m.tot.recyclable, m.tot.mass), 0)}%`} sub={fmtKg(m.tot.recyclable)} />
            <Kpi label={L('Реально переработано', 'Нақты қайта өңделді')} value={`${num(share(m.tot.diverted, m.tot.mass), 0)}%`} sub={L('по способу утилизации', 'кәдеге жарату тәсілі бойынша')} />
            <Kpi label={L('Граммов на порцию', 'Бір порцияға грамм')} value={m.gpp.overall === null ? '—' : `${num(m.gpp.overall, 0)} г`} sub={m.gppAvoid.overall === null ? L('нет данных о порциях', 'порция туралы дерек жоқ') : `${L('предотвратимых', 'алдын алуға болатын')}: ${num(m.gppAvoid.overall, 0)} г`} />
            <Kpi tone="green" label={L('Спасено порций', 'Сақталған порция')} value={String(rescue.portions)} sub={`${L('выручка', 'түсім')} ${kzt(rescue.revenue)}`} />
          </div>

          {m.last && m.prev && (
            <Card className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="font-semibold">{L('Сравнение периодов', 'Кезеңдерді салыстыру')} — {monthLabel(m.last.month, lang)} {L('к месяцу', '→')} {monthLabel(m.prev.month, lang, false)}:</span>
              <span>{L('вся масса', 'жалпы масса')} <Trend pct={m.monthDelta} /></span>
              <span>{L('предотвратимые', 'алдын алуға болатын')} <Trend pct={m.avoidDelta} /></span>
            </Card>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="mb-2 font-bold">{L('Динамика по месяцам, кг', 'Айлар бойынша динамика, кг')}</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={m.monthly.map((x) => ({ ...x, label: monthLabel(x.month, lang, false) }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} width={44} />
                  <Tooltip formatter={(v: number) => fmtKg(v)} /><Legend wrapperStyle={{ fontSize: 12 }} />
                  {(['avoidable', 'unavoidable', 'packaging'] as const).map((k) => <Bar key={k} dataKey={k} stackId="a" fill={C[k]} name={L(...CATEGORY[k])} />)}
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h2 className="mb-2 font-bold">{L('Структура по видам отходов', 'Қалдық түрлері бойынша құрылым')}</h2>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={1}>
                    {pie.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmtKg(v)} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11, maxWidth: '50%' }} formatter={(v: string) => short(v)} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            {staff && !org && (
              <Card>
                <h2 className="mb-2 font-bold">{L('Сравнение организаций, кг', 'Ұйымдарды салыстыру, кг')}</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart layout="vertical" data={m.byOrg.map((x) => ({ name: short(orgName(x.name)), value: x.value, gpp: m.gpp.perOrg.get(x.name) }))} margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12 }} /><YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number, _n, p) => [`${fmtKg(v)}${p.payload.gpp ? ` · ${num(p.payload.gpp, 0)} ${L('г на порцию', 'г/порция')}` : ''}`, L('Масса', 'Масса')]} />
                    <Bar dataKey="value" fill="#17633a" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            )}

            <Card>
              <h2 className="mb-2 font-bold">{L('Предотвратимые отходы по дням недели, кг в день', 'Апта күндері бойынша алдын алуға болатын қалдық, күніне кг')}</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={m.week.map((w) => ({ name: (lang === 'kk' ? DAYS_KK : DAYS_RU)[w.day], value: Number(w.value.toFixed(1)), peak: w.day === m.peak?.day }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} width={44} />
                  <Tooltip formatter={(v: number) => fmtKg(v)} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>{m.week.map((w, i) => <Cell key={i} fill={w.day === m.peak?.day ? C.avoidable : '#e7b79f'} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h2 className="mb-2 font-bold">{L('Причины предотвратимых потерь', 'Алдын алуға болатын шығын себептері')}</h2>
              <div className="space-y-2">
                {m.reasons.map((r, i) => (
                  <div key={r.name}>
                    <div className="flex justify-between text-sm"><span>{L(...REASON[r.name])}</span><span className="font-semibold tabular-nums">{fmtKg(r.value)} · {num(share(r.value, m.tot.avoidable), 0)}%</span></div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${share(r.value, m.reasons[0].value)}%`, background: PALETTE[(i + 2) % PALETTE.length] }} /></div>
                  </div>
                ))}
                {m.reasons.length === 0 && <p className="text-sm text-slate-400">{L('Причины не указаны', 'Себептер көрсетілмеген')}</p>}
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="font-bold">{L('Отклонения', 'Ауытқулар')}</h2>
              <p className="mb-2 text-sm text-slate-500">{m.anomalies.month ? `${L('Рост более чем на 20% за', '20%-дан астам өсу:')} ${monthLabel(m.anomalies.month, lang)} ${L('к среднему прошлых месяцев', 'өткен айлардағы орташамен салыстырғанда')}` : L('Нужно минимум два месяца данных', 'Кемінде екі айлық дерек қажет')}</p>
              <div className="space-y-2">
                {m.anomalies.list.slice(0, 6).map((a, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-rose-50 px-3 py-2 text-sm ring-1 ring-rose-100">
                    <span className="w-14 shrink-0 font-bold text-rose-700">+{num(a.pct, 0)}%</span>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{lang === 'kk' ? a.waste_kk : a.waste_ru}</div>
                      <div className="truncate text-xs text-slate-500">{lang === 'kk' ? a.org_kk : a.org_ru} · {num(a.now)} {L('кг против', 'кг, орташа')} {num(a.mean)}</div>
                    </div>
                  </div>
                ))}
                {m.anomalies.month && m.anomalies.list.length === 0 && <p className="text-sm text-emerald-700">✓ {L('Отклонений нет', 'Ауытқу жоқ')}</p>}
              </div>
            </Card>

            <Card>
              <h2 className="font-bold">{L('Что делать', 'Не істеу керек')}</h2>
              <p className="mb-2 text-sm text-slate-500">{L('Рекомендации по данным реестра. Порядок мер — по иерархии управления отходами Экологического кодекса РК: сначала предотвращение, затем переработка.', 'Тізілім деректері бойынша ұсынымдар. Шаралар реті — ҚР Экологиялық кодексіндегі қалдықтарды басқару иерархиясы бойынша: алдымен алдын алу, содан кейін қайта өңдеу.')}</p>
              <ul className="space-y-2 text-sm">
                {m.peak && m.peakPct > 12 && (
                  <li className="rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-100">📅 {L(`По ${DAYS_FULL_RU[m.peak.day]} предотвратимых отходов на ${num(m.peakPct, 0)}% больше, чем в остальные дни. Сократите выпуск и закупку на этот день.`, `${DAYS_FULL_KK[m.peak.day]} күндері алдын алуға болатын қалдық басқа күндерге қарағанда ${num(m.peakPct, 0)}%-ға көп. Осы күнге өндіріс пен сатып алуды азайтыңыз.`)}</li>
                )}
                {m.topAvoid && (
                  <li className="rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-100">💰 {L(`«${m.topAvoid.name}» — ${num(m.topAvoid.value)} кг и около ${kzt(m.topAvoidCost)} за период. Это главная точка экономии.`, `«${m.topAvoid.name}» — кезең ішінде ${num(m.topAvoid.value)} кг және шамамен ${kzt(m.topAvoidCost)}. Бұл — үнемдеудің басты нүктесі.`)}</li>
                )}
                {m.reasons.filter((r) => share(r.value, m.tot.avoidable) >= 15).map((r) => r.name === 'plate' ? (
                  <li key={r.name} className="rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-100">🍽️ {L(`Остатки с тарелок — ${num(share(r.value, m.tot.avoidable), 0)}% предотвратимых потерь. Введите половинные порции и пересмотрите блюда, которые чаще не доедают.`, `Табақтағы қалдық — алдын алуға болатын шығынның ${num(share(r.value, m.tot.avoidable), 0)}%-ы. Жарты порция енгізіп, жиі желінбейтін тағамдарды қайта қараңыз.`)}</li>
                ) : r.name === 'overproduction' ? (
                  <li key={r.name} className="rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-100">🍲 {L(`Перепроизводство — ${num(share(r.value, m.tot.avoidable), 0)}% предотвратимых потерь. Планируйте выпуск по дням недели, а остатки дня выставляйте в «Спасённые порции».`, `Артық өндіру — алдын алуға болатын шығынның ${num(share(r.value, m.tot.avoidable), 0)}%-ы. Өндірісті апта күндері бойынша жоспарлап, күн соңындағы қалдықты «Сақталған порцияларға» шығарыңыз.`)}</li>
                ) : null)}
                {m.landfillRecyclable > 0 && (
                  <li className="rounded-xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-100">♻️ {L(`${num(m.landfillRecyclable)} кг пригодных к переработке отходов ушло на вывоз ТБО. Направьте их на компост и вторсырьё.`, `Қайта өңдеуге жарамды ${num(m.landfillRecyclable)} кг қалдық ҚТҚ-ға кетті. Оларды компост пен қайталама шикізатқа бағыттаңыз.`)}</li>
                )}
              </ul>
            </Card>
          </div>

          <Card>
            <h2 className="font-bold">{L('Что если: перевод отходов с захоронения на переработку', 'Егер: қалдықты көмуден қайта өңдеуге ауыстырса')}</h2>
            <p className="text-sm text-slate-500">{L('Сейчас на вывоз ТБО уходит', 'Қазір ҚТҚ-ға кетеді')} <b>{fmtKg(landfill)}</b>, {L('из них пригодно к переработке', 'оның қайта өңдеуге жарамдысы')} <b>{fmtKg(m.landfillRecyclable)}</b>.</p>
            <div className="mt-3 flex items-center gap-3">
              <input type="range" min={0} max={100} step={5} value={redirect} onChange={(e) => setRedirect(Number(e.target.value))} className="flex-1 accent-brand-700" />
              <span className="w-14 text-right text-lg font-bold">{redirect}%</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
              <Kpi tone="green" label={L('Уйдёт с захоронения', 'Көмуден алынады')} value={fmtKg(moved)} />
              <Kpi tone="green" label={L('Захоронение сократится на', 'Көму азаяды')} value={`${num(share(moved, landfill), 0)}%`} />
              <Kpi label={L('Доля переработки станет', 'Қайта өңдеу үлесі болады')} value={`${num(share(m.tot.diverted + moved, m.tot.mass), 0)}%`} sub={`${L('сейчас', 'қазір')} ${num(share(m.tot.diverted, m.tot.mass), 0)}%`} />
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
