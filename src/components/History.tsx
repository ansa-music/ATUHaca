import { useEffect, useState } from 'react'
import { dateTime } from '../lib/format'
import { STATUS, useLang } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import type { HistoryRow } from '../lib/types'

/** История изменений отчёта: кто, когда, какое действие, комментарий (ФТ-3.5). */
export default function History({ reportId, version = 0 }: { reportId: string; version?: number }) {
  const { L } = useLang()
  const [rows, setRows] = useState<(HistoryRow & { who: string })[]>([])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await supabase.from('status_history').select('*').eq('report_id', reportId).order('created_at')
      const list = (data ?? []) as HistoryRow[]
      const ids = [...new Set(list.map((r) => r.user_id).filter(Boolean))] as string[]
      const { data: people } = ids.length ? await supabase.from('profiles').select('id,full_name').in('id', ids) : { data: [] }
      const names = new Map((people ?? []).map((p) => [p.id as string, p.full_name as string]))
      if (alive) setRows(list.map((r) => ({ ...r, who: (r.user_id && names.get(r.user_id)) || '—' })))
    })()
    return () => { alive = false }
  }, [reportId, version])

  return (
    <ol className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="flex gap-3 text-sm">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
          <div>
            <div>
              <span className="font-semibold">{L(STATUS[r.to_status][0], STATUS[r.to_status][1])}</span>
              <span className="text-slate-500"> · {r.who} · {dateTime(r.created_at)}</span>
            </div>
            {r.comment && <div className="text-slate-600">«{r.comment}»</div>}
          </div>
        </li>
      ))}
      {rows.length === 0 && <li className="text-sm text-slate-400">{L('История пуста', 'Тарих бос')}</li>}
    </ol>
  )
}
