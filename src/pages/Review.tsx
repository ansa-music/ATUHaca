import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { TrustRing, useFreshIds } from '../components/fx'
import History from '../components/History'
import { AiVerdictCard } from '../components/ai/AiCards'
import { aiReview, type AiReview } from '../components/ai/api'
import { Btn, Card, ErrorBox, PageTitle, Pill, Spinner, StatusBadge, inputCls } from '../components/ui'
import { dateTime, dmy, monthKey, monthLabel, num, parseYmd, ymd } from '../lib/format'
import { useLang } from '../lib/i18n'
import { errText, supabase } from '../lib/supabase'
import { trustIndex } from '../lib/trust'
import type { Disposal, Entry, Org, Report, WasteType } from '../lib/types'

const TONE = { high: 'green', medium: 'amber', low: 'rose' } as const

/** Очередь проверяющего: отчёты, ждущие решения, и недавно рассмотренные. */
export function ReviewList() {
  const { L, lang, name } = useLang()
  const [rows, setRows] = useState<(Report & { org?: Org; count: number; trust_score?: number | null })[] | null>(null)

  const load = useCallback(async () => {
    const [{ data: reps }, { data: orgs }] = await Promise.all([
      supabase.from('reports').select('*').neq('status', 'draft').order('submitted_at', { ascending: false }).limit(60),
      supabase.from('organizations').select('*'),
    ])
    const byId = new Map(((orgs ?? []) as Org[]).map((o) => [o.id, o]))
    const list = (reps ?? []) as Report[]
    const counts = await Promise.all(list.map((r) => supabase.from('entries').select('id', { count: 'exact', head: true }).eq('report_id', r.id)))
    setRows(list.map((r, i) => ({ ...r, org: byId.get(r.org_id), count: counts[i].count ?? 0 })))
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('review-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  // Только оформление: отчёт, появившийся в очереди после первой загрузки, въезжает с подсветкой.
  const isFresh = useFreshIds(rows ? rows.map((r) => r.id) : null)

  if (!rows) return <Spinner />
  // Сначала самые подозрительные: по возрастанию индекса достоверности, отчёты без индекса — в конце.
  const score = (r: (typeof rows)[number]) => (typeof r.trust_score === 'number' ? r.trust_score : Infinity)
  const queue = rows.filter((r) => r.status === 'submitted' || r.status === 'in_review').sort((a, b) => score(a) - score(b))
  const done = rows.filter((r) => r.status === 'accepted' || r.status === 'returned')

  const Row = ({ r }: { r: (typeof rows)[number] }) => (
    <Link to={`/review/${r.id}`} className={`flex items-center gap-3 border-t border-slate-100 px-4 py-3 transition-colors first:border-t-0 hover:bg-slate-50 ${isFresh(r.id) ? 'fx-slide-in' : ''}`}>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{name(r.org)}</div>
        <div className="text-sm text-slate-500">
          <span className="capitalize">{monthLabel(monthKey(r.period_start), lang)}</span> · {r.count} {L('записей', 'жазба')}
          {r.submitted_at && ` · ${dateTime(r.submitted_at)}`}
        </div>
      </div>
      {typeof r.trust_score === 'number' && (r.status === 'submitted' || r.status === 'in_review') && (
        <span title={L('Индекс достоверности', 'Сенімділік индексі')}>
          <Pill tone={r.trust_score >= 80 ? 'green' : r.trust_score >= 50 ? 'amber' : 'rose'}>{Math.round(r.trust_score)}</Pill>
        </span>
      )}
      <StatusBadge status={r.status} />
    </Link>
  )

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title={L('Проверка отчётов', 'Есептерді тексеру')} sub={L('Новые отчёты появляются здесь без перезагрузки страницы', 'Жаңа есептер бетті қайта жүктемей-ақ осында пайда болады')} />
      <h2 className="mb-2 flex flex-wrap items-baseline gap-x-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
        <span>{L('Ждут решения', 'Шешім күтуде')} · {queue.length}</span>
        {queue.length > 1 && <span className="text-xs font-medium normal-case tracking-normal text-slate-400">{L('сначала самые подозрительные', 'алдымен ең күдіктілері')}</span>}
      </h2>
      <Card className="mb-5 !p-0">
        {queue.map((r) => <Row key={r.id} r={r} />)}
        {queue.length === 0 && <div className="px-4 py-6 text-center text-slate-400">{L('Очередь пуста', 'Кезек бос')}</div>}
      </Card>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{L('Рассмотренные', 'Қаралғандар')}</h2>
      <Card className="!p-0">{done.map((r) => <Row key={r.id} r={r} />)}</Card>
    </div>
  )
}

/** Карточка отчёта: индекс достоверности, итоги, записи, история и решение. */
export function ReviewDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { L, lang, name } = useLang()
  const [report, setReport] = useState<Report | null>(null)
  const [org, setOrg] = useState<Org | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [types, setTypes] = useState<Map<string, WasteType>>(new Map())
  const [disposals, setDisposals] = useState<Map<string, Disposal>>(new Map())
  const [means, setMeans] = useState<Map<string, number>>(new Map())
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)
  const [photo, setPhoto] = useState('')
  // Заключение ИИ: 'loading' — ждём ответ, null — ИИ недоступен (карточка скрыта).
  const [ai, setAi] = useState<AiReview | 'loading' | null>('loading')

  useEffect(() => {
    if (!id) return
    let alive = true
    setAi('loading')
    aiReview(id).then((r) => { if (alive) setAi(r) }).catch(() => { if (alive) setAi(null) })
    return () => { alive = false }
  }, [id])

  // Если ИИ советует вернуть — подставляем его готовый комментарий (его можно править).
  useEffect(() => {
    if (ai && ai !== 'loading' && ai.verdict === 'return') {
      const c = lang === 'kk' ? ai.comment_kk || ai.comment_ru : ai.comment_ru
      if (c) setComment((cur) => cur.trim() ? cur : c)
    }
  }, [ai, lang])

  const load = useCallback(async () => {
    if (!id) return
    setError('')
    try {
      let { data: rep, error: e0 } = await supabase.from('reports').select('*').eq('id', id).single()
      if (e0) throw e0
      // Открытие отправленного отчёта переводит его в статус «на проверке».
      if (rep.status === 'submitted') {
        const { data: started, error: e1 } = await supabase.rpc('start_review', { p_report: id })
        if (!e1 && started) rep = started
      }
      const r = rep as Report
      const from = parseYmd(r.period_start); from.setMonth(from.getMonth() - 3)
      const [o, es, wt, dm, hist] = await Promise.all([
        supabase.from('organizations').select('*').eq('id', r.org_id).single(),
        supabase.from('entries').select('*').eq('report_id', r.id).order('entry_date').order('created_at').limit(2000),
        supabase.from('waste_types').select('*'),
        supabase.from('disposal_methods').select('*'),
        supabase.from('registry').select('waste_type_id,quantity,entry_date').eq('org_id', r.org_id).gte('entry_date', ymd(from)).lt('entry_date', r.period_start).limit(5000),
      ])
      setReport(r); setOrg(o.data as Org)
      setEntries((es.data ?? []) as Entry[])
      setTypes(new Map(((wt.data ?? []) as WasteType[]).map((t) => [t.id, t])))
      setDisposals(new Map(((dm.data ?? []) as Disposal[]).map((d) => [d.id, d])))
      // Среднее на одно взвешивание по виду отхода за три предыдущих месяца.
      const sum = new Map<string, [number, number]>()
      for (const h of hist.data ?? []) {
        const s = sum.get(h.waste_type_id) ?? [0, 0]
        sum.set(h.waste_type_id, [s[0] + Number(h.quantity), s[1] + 1])
      }
      setMeans(new Map([...sum].map(([k, [q, n]]) => [k, q / n])))
      setVersion((v) => v + 1)
    } catch (err) { setError(errText(err)) }
  }, [id])

  useEffect(() => { load() }, [load])

  const trust = useMemo(() => (report ? trustIndex(entries, report, means, org?.type === 'lab') : null), [entries, report, means, org])
  // Итог за месяц и среднее на одно взвешивание: среднее не зависит от того, закончился ли месяц.
  const byType = useMemo(() => {
    const m = new Map<string, [number, number]>()
    for (const e of entries) {
      const v = m.get(e.waste_type_id) ?? [0, 0]
      m.set(e.waste_type_id, [v[0] + Number(e.quantity), v[1] + 1])
    }
    return [...m].map(([id, [q, n]]) => [id, q, q / n] as const).sort((a, b) => b[1] - a[1])
  }, [entries])

  async function decide(accept: boolean) {
    if (!report) return
    if (!accept && !comment.trim()) return setError(L('При возврате комментарий обязателен', 'Қайтарған кезде түсініктеме міндетті'))
    setBusy(true); setError('')
    const { error } = await supabase.rpc('decide_report', { p_report: report.id, p_accept: accept, p_comment: comment.trim() || null })
    setBusy(false)
    if (error) return setError(errText(error))
    setComment(''); nav('/review')
  }

  async function showPhoto(entryId: string) {
    const { data } = await supabase.from('entry_photos').select('data').eq('entry_id', entryId).maybeSingle()
    if (data?.data) setPhoto(data.data as string)
  }

  if (!report || !org || !trust) return error ? <ErrorBox>{error}</ErrorBox> : <Spinner />
  const pending = report.status === 'submitted' || report.status === 'in_review'
  const unit = (id: string) => (types.get(id)?.unit === 'l' ? 'л' : 'кг')
  const verdict = ai && ai !== 'loading' ? ai.verdict : null

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link to="/review" className="text-sm font-medium text-brand-700">← {L('К очереди', 'Кезекке')}</Link>
      <PageTitle title={name(org)} sub={`${L('Отчёт за', 'Есеп:')} ${monthLabel(monthKey(report.period_start), lang)} · ${entries.length} ${L('записей', 'жазба')}`} right={<StatusBadge status={report.status} />} />
      <ErrorBox>{error}</ErrorBox>

      {ai && (pending || ai !== 'loading') && <AiVerdictCard ai={ai} />}

      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <TrustRing score={trust.score} level={trust.level} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">{L('Индекс достоверности', 'Сенімділік индексі')}</h2>
              <Pill tone={TONE[trust.level]}>{trust.level === 'high' ? L('высокий', 'жоғары') : trust.level === 'medium' ? L('средний', 'орташа') : L('низкий', 'төмен')}</Pill>
            </div>
            <p className="text-sm text-slate-500">{L('Автопроверка ищет признаки заполнения «задним числом» и «на глаз». Решение принимает проверяющий.', 'Автотексеру «кейіннен» және «көзбен» толтыру белгілерін іздейді. Шешімді тексеруші қабылдайды.')}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {trust.reasons.map((r, i) => <li key={i} className="fx-fade-up flex gap-2" style={{ animationDelay: `${150 + i * 60}ms` }}><span className="font-semibold text-rose-700">−{r.penalty}</span>{L(r.ru, r.kk)}</li>)}
              {trust.reasons.length === 0 && <li className="fx-fade-up text-emerald-700" style={{ animationDelay: '150ms' }}>✓ {L('Замечаний нет: записи вносились в день взвешивания, значения правдоподобны', 'Ескерту жоқ: жазбалар өлшеу күні енгізілген, мәндер шынайы')}</li>}
            </ul>
          </div>
        </div>
      </Card>

      <Card className="!p-0">
        <div className="border-b border-slate-100 px-4 py-2.5 font-semibold">{L('Итоги по видам отходов', 'Қалдық түрлері бойынша қорытынды')}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500">
              <th className="px-4 py-2 text-left font-medium">{L('Вид отхода', 'Қалдық түрі')}</th>
              <th className="px-3 py-2 text-right font-medium">{L('За месяц', 'Ай бойынша')}</th>
              <th className="px-3 py-2 text-right font-medium">{L('В среднем за взвешивание', 'Бір өлшеуге орташа')}</th>
              <th className="px-3 py-2 text-right font-medium">{L('Обычно (3 мес.)', 'Әдетте (3 ай)')}</th>
              <th className="px-4 py-2 text-right font-medium">{L('Отклонение', 'Ауытқу')}</th>
            </tr></thead>
            <tbody>
              {byType.map(([tid, q, avg]) => {
                const prev = means.get(tid)
                const dev = prev ? ((avg - prev) / prev) * 100 : null
                return (
                  <tr key={tid} className="border-t border-slate-100">
                    <td className="px-4 py-2">{name(types.get(tid))}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">{num(q)} {unit(tid)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{num(avg, 2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{prev ? num(prev, 2) : '—'}</td>
                    <td className={`px-4 py-2 text-right font-semibold tabular-nums ${dev !== null && Math.abs(dev) > 25 ? 'text-rose-700' : 'text-slate-500'}`}>{dev === null ? '—' : `${dev > 0 ? '+' : ''}${num(dev, 0)}%`}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="!p-0">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
          <span className="font-semibold">{L('Записи отчёта', 'Есеп жазбалары')}</span>
          {trust.flagged.size > 0 && <Pill tone="amber">{trust.flagged.size} {L('подсвечено', 'белгіленді')}</Pill>}
        </div>
        <div className="max-h-[420px] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white"><tr className="text-xs text-slate-500">
              <th className="px-4 py-2 text-left font-medium">{L('Дата', 'Күні')}</th>
              <th className="px-3 py-2 text-left font-medium">{L('Вид отхода', 'Қалдық түрі')}</th>
              <th className="px-3 py-2 text-right font-medium">{L('Кол-во', 'Мөлшері')}</th>
              <th className="hidden px-3 py-2 text-left font-medium sm:table-cell">{L('Способ утилизации', 'Кәдеге жарату')}</th>
              <th className="px-4 py-2 text-left font-medium">{L('Внесено', 'Енгізілді')}</th>
            </tr></thead>
            <tbody>
              {entries.map((e) => {
                const f = trust.flagged.get(e.id)
                return (
                  <tr key={e.id} className={`border-t border-slate-100 ${f === 'outlier' ? 'bg-rose-50' : f === 'late' ? 'bg-amber-50' : ''}`}>
                    <td className="whitespace-nowrap px-4 py-1.5">{dmy(e.entry_date)}</td>
                    <td className="px-3 py-1.5">{name(types.get(e.waste_type_id))}{e.has_photo && <button className="ml-1" onClick={() => showPhoto(e.id)}>📷</button>}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right font-semibold tabular-nums">
                      {e.qty_estimated && <span title={L('Вес оценён ИИ по фото, не взвешен', 'Салмақты ЖИ фото бойынша бағалады')} className="mr-1 rounded bg-amber-100 px-1 text-xs font-medium text-amber-800">≈ ИИ</span>}
                      {num(Number(e.quantity), 2)} {unit(e.waste_type_id)}
                    </td>
                    <td className="hidden px-3 py-1.5 text-slate-600 sm:table-cell">{name(e.disposal_id ? disposals.get(e.disposal_id) : null)}</td>
                    <td className="whitespace-nowrap px-4 py-1.5 text-xs text-slate-500">{dateTime(e.created_at)}{f === 'late' && ' ⏱'}{f === 'outlier' && ' ⚠'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {pending && (
        <Card className="space-y-3">
          <h2 className="font-bold">{L('Решение', 'Шешім')}</h2>
          {verdict === 'return' && <p className="text-sm text-slate-500">{L('ИИ подготовил комментарий для возврата. Проверьте и при необходимости исправьте.', 'ЖИ қайтаруға түсініктеме дайындады. Тексеріп, қажет болса түзетіңіз.')}</p>}
          <textarea className={inputCls} rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder={L('Комментарий (обязателен при возврате)', 'Түсініктеме (қайтарған кезде міндетті)')} />
          {trust.suggestion && !comment && (
            <button className="text-left text-sm font-medium text-brand-700" onClick={() => setComment(trust.suggestion)}>
              ✨ {L('Подставить черновик комментария по замечаниям автопроверки', 'Автотексеру ескертпелері бойынша түсініктеме жобасын қою')}
            </button>
          )}
          {verdict === 'accept' ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Btn size="lg" className="w-full sm:w-auto" onClick={() => decide(true)} disabled={busy}>✓ {L('Принять отчёт', 'Есепті қабылдау')}</Btn>
              <Btn size="sm" variant="ghost" onClick={() => decide(false)} disabled={busy}>↩ {L('Вернуть', 'Қайтару')}</Btn>
            </div>
          ) : verdict === 'return' ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Btn size="lg" variant="danger" className="w-full sm:w-auto" onClick={() => decide(false)} disabled={busy}>↩ {L('Вернуть на доработку', 'Пысықтауға қайтару')}</Btn>
              <Btn size="sm" variant="ghost" onClick={() => decide(true)} disabled={busy}>✓ {L('Всё же принять', 'Бәрібір қабылдау')}</Btn>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => decide(true)} disabled={busy}>✓ {L('Принять отчёт', 'Есепті қабылдау')}</Btn>
              <Btn variant="danger" onClick={() => decide(false)} disabled={busy}>↩ {L('Вернуть на доработку', 'Пысықтауға қайтару')}</Btn>
            </div>
          )}
        </Card>
      )}

      <Card>
        <h2 className="mb-3 font-bold">{L('История изменений', 'Өзгерістер тарихы')}</h2>
        <History reportId={report.id} version={version} />
      </Card>

      {photo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setPhoto('')}>
          <img src={photo} alt="" className="max-h-full max-w-full rounded-xl" />
        </div>
      )}
    </div>
  )
}
