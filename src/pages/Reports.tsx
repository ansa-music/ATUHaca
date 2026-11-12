import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useChangedKeys } from '../components/fx'
import History from '../components/History'
import { Btn, Card, ErrorBox, PageTitle, Spinner, StatusBadge } from '../components/ui'
import { useAuth } from '../lib/auth'
import { dateTime, monthKey, monthLabel, num } from '../lib/format'
import { useLang } from '../lib/i18n'
import { errText, supabase } from '../lib/supabase'
import type { Report } from '../lib/types'

type Row = Report & { count: number; total: number; comment: string }

/** Отчёты организации: статус, комментарий проверяющего, история, отправка на проверку. */
export default function ReportsPage() {
  const { org } = useAuth()
  const { L, lang } = useLang()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [open, setOpen] = useState('')
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)

  const load = useCallback(async () => {
    if (!org) return
    const { data: reps, error } = await supabase.from('reports').select('*').eq('org_id', org.id).order('period_start', { ascending: false })
    if (error) return setError(errText(error))
    const list = (reps ?? []) as Report[]
    const out: Row[] = await Promise.all(list.map(async (r) => {
      const [{ data: es }, { data: h }] = await Promise.all([
        supabase.from('entries').select('quantity').eq('report_id', r.id),
        supabase.from('status_history').select('comment').eq('report_id', r.id).eq('to_status', 'returned').order('created_at', { ascending: false }).limit(1),
      ])
      return {
        ...r, count: es?.length ?? 0, total: (es ?? []).reduce((s, e) => s + Number(e.quantity), 0),
        comment: r.status === 'returned' ? (h?.[0]?.comment ?? '') : '',
      }
    }))
    setRows(out); setVersion((v) => v + 1)
  }, [org])

  useEffect(() => { load() }, [load])

  // Статус меняется у проверяющего — показываем это сразу, без перезагрузки.
  useEffect(() => {
    if (!org) return
    const ch = supabase.channel(`reports-${org.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reports', filter: `org_id=eq.${org.id}` }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [org, load])

  async function submit(r: Row) {
    if (!confirm(L(`Отправить отчёт за ${monthLabel(monthKey(r.period_start), lang)} на проверку?`, `${monthLabel(monthKey(r.period_start), lang)} есебін тексеруге жіберу керек пе?`))) return
    const { error } = await supabase.rpc('submit_report', { p_report: r.id })
    if (error) setError(errText(error)); else load()
  }

  // Только оформление: значок статуса подсвечивается, когда статус отчёта изменился.
  const statusChanged = useChangedKeys(rows ? new Map(rows.map((r) => [r.id, r.status])) : null)

  if (!org) return <Card>{L('Организация не назначена.', 'Ұйым тағайындалмаған.')}</Card>
  if (!rows) return <Spinner />

  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle title={L('Отчёты организации', 'Ұйым есептері')} sub={L('Отчёт — все записи за месяц, отправляется на проверку одним действием', 'Есеп — бір айдағы барлық жазба, тексеруге бір әрекетпен жіберіледі')} />
      <ErrorBox>{error}</ErrorBox>
      <div className="mt-2 space-y-3">
        {rows.map((r) => {
          const editable = r.status === 'draft' || r.status === 'returned'
          const m = monthKey(r.period_start)
          return (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-bold capitalize">{monthLabel(m, lang)}</div>
                  <div className="text-sm text-slate-500">
                    {r.count} {L('записей', 'жазба')} · {num(r.total)} {L('кг/л', 'кг/л')}
                    {r.submitted_at && ` · ${L('отправлен', 'жіберілді')} ${dateTime(r.submitted_at)}`}
                  </div>
                </div>
                <span className={`inline-flex shrink-0 rounded-full ${statusChanged(r.id) ? 'fx-flash' : ''}`}><StatusBadge status={r.status} /></span>
              </div>
              {r.comment && (
                <div className="fx-fade-up mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-900 ring-1 ring-rose-200">
                  <span className="font-semibold">{L('Комментарий проверяющего', 'Тексерушінің түсініктемесі')}:</span> «{r.comment}»
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to={`/entry?month=${m}`}><Btn size="sm" variant={editable ? 'primary' : 'ghost'}>{editable ? L('Открыть и исправить', 'Ашып түзету') : L('Посмотреть', 'Қарау')}</Btn></Link>
                {editable && <Btn size="sm" variant="soft" onClick={() => submit(r)} disabled={r.count === 0}>{L('Отправить на проверку', 'Тексеруге жіберу')}</Btn>}
                <Btn size="sm" variant="ghost" onClick={() => setOpen(open === r.id ? '' : r.id)}>{L('История', 'Тарих')}</Btn>
              </div>
              {open === r.id && <div className="mt-3 border-t border-slate-100 pt-3"><History reportId={r.id} version={version} /></div>}
            </Card>
          )
        })}
        {rows.length === 0 && <Card>{L('Отчётов пока нет. Начните с ввода взвешиваний.', 'Әзірге есеп жоқ. Өлшеулерді енгізуден бастаңыз.')}</Card>}
      </div>
    </div>
  )
}
