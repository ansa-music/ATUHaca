import { useCallback, useEffect, useState } from 'react'
import { errText, fetchAll, supabase } from './supabase'
import type { Org, RegistryRow, Report } from './types'

export interface RegistryData {
  rows: RegistryRow[]
  orgs: Org[]          // активные организации без демо-точки
  reports: Report[]
  portions: { org_id: string; day: string; portions: number }[]
}

/**
 * Единый реестр: записи только принятых отчётов (представление registry).
 * Что именно увидит пользователь, решает сервер: ответственному политика RLS отдаёт только свою организацию.
 * Данные обновляются вживую, когда отчёт принимают или в него попадает новая запись.
 */
export function useRegistry() {
  const [data, setData] = useState<RegistryData | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [rows, orgs, reports, portions] = await Promise.all([
        fetchAll<RegistryRow>((from, to) => supabase.from('registry').select('*').order('entry_date').order('id').range(from, to)),
        supabase.from('organizations').select('*').eq('is_demo', false).order('name_ru'),
        supabase.from('reports').select('*'),
        fetchAll<{ org_id: string; day: string; portions: number }>((from, to) => supabase.from('daily_portions').select('*').order('day').range(from, to)),
      ])
      setData({
        rows: rows.map((r) => ({ ...r, quantity: Number(r.quantity), mass_kg: Number(r.mass_kg), co2_kg: Number(r.co2_kg), cost_kzt: Number(r.cost_kzt) })),
        orgs: ((orgs.data ?? []) as Org[]).filter((o) => o.is_active),
        reports: (reports.data ?? []) as Report[],
        portions,
      })
    } catch (e) { setError(errText(e)) }
  }, [])

  useEffect(() => {
    load()
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => { clearTimeout(timer); timer = setTimeout(load, 400) }
    const ch = supabase.channel(`registry-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entries' }, refresh)
      .subscribe()
    return () => { clearTimeout(timer); supabase.removeChannel(ch) }
  }, [load])

  return { data, error, reload: load }
}
