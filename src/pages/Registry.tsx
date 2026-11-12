import { useMemo, useState } from 'react'
import { Btn, Card, ErrorBox, PageTitle, Spinner, inputCls } from '../components/ui'
import { dmy, num, today } from '../lib/format'
import { useLang } from '../lib/i18n'
import { useRegistry } from '../lib/registry'

const PAGE = 50

/** Единый реестр принятых данных с фильтрами по периоду, организации, виду отходов и способу утилизации. */
export default function RegistryPage() {
  const { L, lang } = useLang()
  const { data, error } = useRegistry()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(today())
  const [org, setOrg] = useState('')
  const [waste, setWaste] = useState('')
  const [disposal, setDisposal] = useState('')
  const [page, setPage] = useState(0)

  const options = useMemo(() => {
    const rows = data?.rows ?? []
    const uniq = (get: (r: (typeof rows)[number]) => string | null) => [...new Set(rows.map(get).filter(Boolean) as string[])].sort()
    return {
      // Одинаковые виды отходов в разных организациях (например, «Картонная тара») фильтруются по названию.
      wastes: uniq((r) => (lang === 'kk' ? r.waste_kk : r.waste_ru)),
      disposals: uniq((r) => (lang === 'kk' ? r.disposal_kk : r.disposal_ru)),
    }
  }, [data, lang])

  const filtered = useMemo(() => {
    const rows = data?.rows ?? []
    return rows.filter((r) =>
      (!from || r.entry_date >= from) && (!to || r.entry_date <= to) && (!org || r.org_id === org)
      && (!waste || (lang === 'kk' ? r.waste_kk : r.waste_ru) === waste)
      && (!disposal || (lang === 'kk' ? r.disposal_kk : r.disposal_ru) === disposal),
    ).reverse()
  }, [data, from, to, org, waste, disposal, lang])

  const totals = useMemo(() => {
    let kg = 0, l = 0
    for (const r of filtered) if (r.unit === 'l') l += r.quantity; else kg += r.quantity
    return { kg, l }
  }, [filtered])

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!data) return <Spinner text={L('Загрузка реестра…', 'Тізілім жүктелуде…')} />
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE))
  const p = Math.min(page, pages - 1)
  const reset = () => { setFrom(''); setTo(today()); setOrg(''); setWaste(''); setDisposal(''); setPage(0) }

  return (
    <div>
      <PageTitle title={L('Единый реестр', 'Бірыңғай тізілім')} sub={L('Только записи принятых отчётов. Данные попадают сюда автоматически после решения проверяющего.', 'Тек қабылданған есептердің жазбалары. Деректер тексерушінің шешімінен кейін автоматты түрде түседі.')} />
      <Card className="mb-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <label className="text-xs font-medium text-slate-500">{L('Период с', 'Кезең басы')}
            <input type="date" className={`${inputCls} mt-1 !py-2 text-sm`} value={from} onChange={(e) => { setFrom(e.target.value); setPage(0) }} />
          </label>
          <label className="text-xs font-medium text-slate-500">{L('по', 'соңы')}
            <input type="date" className={`${inputCls} mt-1 !py-2 text-sm`} value={to} onChange={(e) => { setTo(e.target.value); setPage(0) }} />
          </label>
          <label className="col-span-2 text-xs font-medium text-slate-500 md:col-span-1">{L('Организация', 'Ұйым')}
            <select className={`${inputCls} mt-1 !py-2 text-sm`} value={org} onChange={(e) => { setOrg(e.target.value); setPage(0) }}>
              <option value="">{L('Все', 'Барлығы')}</option>
              {data.orgs.map((o) => <option key={o.id} value={o.id}>{lang === 'kk' ? o.name_kk : o.name_ru}</option>)}
            </select>
          </label>
          <label className="col-span-2 text-xs font-medium text-slate-500 md:col-span-1">{L('Вид отходов', 'Қалдық түрі')}
            <select className={`${inputCls} mt-1 !py-2 text-sm`} value={waste} onChange={(e) => { setWaste(e.target.value); setPage(0) }}>
              <option value="">{L('Все', 'Барлығы')}</option>
              {options.wastes.map((w) => <option key={w}>{w}</option>)}
            </select>
          </label>
          <label className="col-span-2 text-xs font-medium text-slate-500 md:col-span-1">{L('Способ утилизации', 'Кәдеге жарату тәсілі')}
            <select className={`${inputCls} mt-1 !py-2 text-sm`} value={disposal} onChange={(e) => { setDisposal(e.target.value); setPage(0) }}>
              <option value="">{L('Все', 'Барлығы')}</option>
              {options.disposals.map((w) => <option key={w}>{w}</option>)}
            </select>
          </label>
          <div className="col-span-2 flex items-end md:col-span-1"><Btn variant="ghost" size="sm" className="w-full" onClick={reset}>{L('Сбросить', 'Тазарту')}</Btn></div>
        </div>
      </Card>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-slate-600">{L('Найдено', 'Табылды')}: <b>{filtered.length}</b> · {L('итого', 'жиыны')} <b>{num(totals.kg)} {L('кг', 'кг')}</b>{totals.l > 0 && <> + <b>{num(totals.l)} {L('л', 'л')}</b></>}</span>
        <span className="flex items-center gap-2">
          <Btn size="sm" variant="ghost" disabled={p === 0} onClick={() => setPage(p - 1)}>←</Btn>
          {p + 1} / {pages}
          <Btn size="sm" variant="ghost" disabled={p >= pages - 1} onClick={() => setPage(p + 1)}>→</Btn>
        </span>
      </div>

      <Card className="!p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-xs text-slate-500">
              <th className="px-4 py-2 text-left font-medium">{L('Дата', 'Күні')}</th>
              <th className="px-3 py-2 text-left font-medium">{L('Организация', 'Ұйым')}</th>
              <th className="px-3 py-2 text-left font-medium">{L('Наименование отходов', 'Қалдықтардың атауы')}</th>
              <th className="px-3 py-2 text-right font-medium">{L('Вес / объём', 'Салмағы / көлемі')}</th>
              <th className="px-3 py-2 text-left font-medium">{L('Способ утилизации', 'Кәдеге жарату тәсілі')}</th>
              <th className="px-4 py-2 text-left font-medium">{L('Ответственное лицо', 'Жауапты тұлға')}</th>
            </tr></thead>
            <tbody>
              {filtered.slice(p * PAGE, p * PAGE + PAGE).map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="whitespace-nowrap px-4 py-1.5">{dmy(r.entry_date)}</td>
                  <td className="px-3 py-1.5">{lang === 'kk' ? r.org_kk : r.org_ru}</td>
                  <td className="px-3 py-1.5">{lang === 'kk' ? r.waste_kk : r.waste_ru}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums">{num(r.quantity, 2)} {r.unit === 'l' ? L('л', 'л') : L('кг', 'кг')}</td>
                  <td className="px-3 py-1.5 text-slate-600">{(lang === 'kk' ? r.disposal_kk : r.disposal_ru) ?? '—'}</td>
                  <td className="px-4 py-1.5 text-slate-600">{r.responsible ?? '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">{L('По выбранным фильтрам записей нет', 'Таңдалған сүзгілер бойынша жазба жоқ')}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
