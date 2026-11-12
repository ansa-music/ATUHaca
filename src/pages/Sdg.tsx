import { useMemo, useState } from 'react'
import { Btn, Card, ErrorBox, PageTitle, Spinner, inputCls } from '../components/ui'
import { dmy, kzt, monthLabel, num, today } from '../lib/format'
import { useLang } from '../lib/i18n'
import { byMonth, gramsPerPortion, share, totals } from '../lib/metrics'
import { useRegistry } from '../lib/registry'

/** Отчёт для ESG-отчётности и ЦУР 12.3: показатели по всему университету на одной странице, печать в PDF. */
export default function SdgPage() {
  const { L, lang } = useLang()
  const { data, error } = useRegistry()
  const [year, setYear] = useState(today().slice(0, 4))

  const m = useMemo(() => {
    const rows = (data?.rows ?? []).filter((r) => r.entry_date.startsWith(year))
    const tot = totals(rows)
    const perOrg = (data?.orgs ?? []).map((o) => ({ org: o, t: totals(rows.filter((r) => r.org_id === o.id)) }))
    return { rows, tot, perOrg, monthly: byMonth(rows), gpp: gramsPerPortion(rows, data?.portions ?? []) }
  }, [data, year])

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!data) return <Spinner />
  const months = m.monthly.length
  const perYear = (v: number) => (months ? (v / months) * 12 : 0)

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print">
        <PageTitle title={L('Отчёт ЦУР 12.3', 'ТДМ 12.3 есебі')} sub={L('Показатели для ESG-отчётности и рейтингов устойчивого развития', 'ESG-есептілік пен тұрақты даму рейтингтеріне арналған көрсеткіштер')}
          right={<div className="flex gap-2"><select className={`${inputCls} !w-auto !py-2 text-sm`} value={year} onChange={(e) => setYear(e.target.value)}>{[today().slice(0, 4), String(Number(today().slice(0, 4)) - 1)].map((y) => <option key={y}>{y}</option>)}</select><Btn onClick={() => window.print()}>🖨 {L('Печать / PDF', 'Басып шығару / PDF')}</Btn></div>} />
      </div>

      <Card className="space-y-5 print:shadow-none print:ring-0">
        <div className="border-b border-slate-200 pb-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-700">{L('Цель устойчивого развития 12 · задача 12.3', 'Тұрақты даму мақсаты 12 · 12.3-міндет')}</div>
          <h2 className="mt-1 text-2xl font-bold">{L('Пищевые отходы университетского комплекса АО «АТУ»', '«АТУ» АҚ университет кешенінің тағам қалдықтары')}, {year}</h2>
          <p className="text-sm text-slate-500">{L('Сформировано системой Qadir', 'Qadir жүйесі қалыптастырды')} {dmy(today())}. {L('Источник — единый реестр: только отчёты, принятые проверяющим.', 'Дереккөз — бірыңғай тізілім: тек тексеруші қабылдаған есептер.')} {L('Данные за', 'Деректер:')} {months} {L('мес.', 'ай')}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            [L('Образовано отходов', 'Түзілген қалдық'), `${num(m.tot.mass / 1000, 2)} т`, `${L('в пересчёте на год', 'жылға шаққанда')} ≈ ${num(perYear(m.tot.mass) / 1000, 1)} т`],
            [L('Переработано', 'Қайта өңделді'), `${num(share(m.tot.diverted, m.tot.mass), 0)}%`, `${num(m.tot.diverted)} кг`],
            [L('CO₂-эквивалент', 'CO₂-баламасы'), `${num(m.tot.co2 / 1000, 2)} т`, 'FAO, 2013: 2,5 кг/кг'],
            [L('На одну порцию', 'Бір порцияға'), m.gpp.overall === null ? '—' : `${num(m.gpp.overall, 0)} г`, L('пищевых отходов', 'тағам қалдығы')],
          ].map(([label, value, sub]) => (
            <div key={label} className="rounded-xl bg-brand-50 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
              <div className="mt-1 text-2xl font-bold text-brand-800">{value}</div>
              <div className="text-xs text-slate-500">{sub}</div>
            </div>
          ))}
        </div>

        <div>
          <h3 className="mb-2 font-bold">{L('Измерение отходов по подразделениям', 'Бөлімшелер бойынша қалдықты өлшеу')}</h3>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-xs text-slate-500">
              <th className="py-1.5 text-left font-medium">{L('Организация', 'Ұйым')}</th>
              <th className="py-1.5 text-right font-medium">{L('Всего, кг', 'Барлығы, кг')}</th>
              <th className="py-1.5 text-right font-medium">{L('Предотвратимые', 'Алдын алуға болатын')}</th>
              <th className="py-1.5 text-right font-medium">{L('Пригодно к переработке', 'Қайта өңдеуге жарамды')}</th>
              <th className="py-1.5 text-right font-medium">{L('Потери, ₸', 'Шығын, ₸')}</th>
            </tr></thead>
            <tbody>
              {m.perOrg.map(({ org, t }) => (
                <tr key={org.id} className="border-b border-slate-100">
                  <td className="py-1.5">{lang === 'kk' ? org.name_kk : org.name_ru}</td>
                  <td className="py-1.5 text-right tabular-nums">{num(t.mass)}</td>
                  <td className="py-1.5 text-right tabular-nums">{num(share(t.avoidable, t.mass), 0)}%</td>
                  <td className="py-1.5 text-right tabular-nums">{num(share(t.recyclable, t.mass), 0)}%</td>
                  <td className="py-1.5 text-right tabular-nums">{kzt(t.cost)}</td>
                </tr>
              ))}
              <tr className="font-bold"><td className="py-2">{L('Итого', 'Жиыны')}</td><td className="py-2 text-right tabular-nums">{num(m.tot.mass)}</td><td className="py-2 text-right">{num(share(m.tot.avoidable, m.tot.mass), 0)}%</td><td className="py-2 text-right">{num(share(m.tot.recyclable, m.tot.mass), 0)}%</td><td className="py-2 text-right">{kzt(m.tot.cost)}</td></tr>
            </tbody>
          </table>
        </div>

        <div>
          <h3 className="mb-2 font-bold">{L('Динамика по месяцам, кг', 'Айлар бойынша динамика, кг')}</h3>
          <div className="flex items-end gap-2">
            {m.monthly.map((x) => {
              const v = x.avoidable + x.unavoidable + x.packaging
              const max = Math.max(...m.monthly.map((y) => y.avoidable + y.unavoidable + y.packaging))
              return (
                <div key={x.month} className="flex-1 text-center">
                  <div className="text-xs font-semibold tabular-nums">{num(v, 0)}</div>
                  <div className="mx-auto mt-1 w-full max-w-16 rounded-t bg-brand-600" style={{ height: `${(v / max) * 110}px` }} />
                  <div className="mt-1 text-xs capitalize text-slate-500">{monthLabel(x.month, lang, false)}</div>
                </div>
              )
            })}
          </div>
        </div>

        <p className="border-t border-slate-200 pt-3 text-xs text-slate-500">
          {L('Методика: масса — сумма взвешиваний ответственных лиц, литры пересчитаны в килограммы по плотности. Предотвратимые отходы — нереализованная продукция и остатки из зала. Переработано — отходы, направленные на компост, вторсырьё, корм или переработчику. CO₂-эквивалент — оценка по среднему коэффициенту 2,5 кг CO₂-экв. на 1 кг пищевых отходов (FAO, Food Wastage Footprint, 2013); упаковка не учитывается. Потери в тенге — оценка по ценам-допущениям из справочника видов отходов.', 'Әдістеме: масса — жауапты тұлғалардың өлшеулерінің қосындысы, литр тығыздық бойынша килограммға аударылған. Алдын алуға болатын қалдық — сатылмаған өнім және залдан шыққан қалдық. Қайта өңделді — компостқа, қайталама шикізатқа, азыққа немесе өңдеушіге бағытталған қалдық. CO₂-баламасы — 1 кг тағам қалдығына 2,5 кг CO₂-бал. орташа коэффициенті бойынша бағалау (FAO, Food Wastage Footprint, 2013); орама есепке алынбайды. Теңгедегі шығын — қалдық түрлері анықтамалығындағы болжамды бағалар бойынша бағалау.')}
        </p>
      </Card>
    </div>
  )
}
