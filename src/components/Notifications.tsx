import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useLang } from '../lib/i18n'
import { supabase } from '../lib/supabase'

export interface Notice {
  id: number
  kind: string
  title_ru: string
  title_kk: string
  body_ru: string | null
  body_kk: string | null
  link: string | null
  created_at: string
  read_at: string | null
}

const KIND_ICON: Record<string, string> = {
  report_submitted: '📥', report_returned: '↩️', report_accepted: '✅', month_complete: '🎉',
  anomaly: '⚠️', anomaly_self: '⚠️', daily_reminder: '⏰', deadline: '📅', not_submitted: '📋',
  review_overdue: '⌛', month_opened: '🗓️', weekly_digest: '📊',
}

function ago(iso: string, L: (ru: string, kk: string) => string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return L('только что', 'жаңа ғана')
  if (m < 60) return L(`${m} мин назад`, `${m} мин бұрын`)
  const h = Math.round(m / 60)
  if (h < 24) return L(`${h} ч назад`, `${h} сағ бұрын`)
  return new Date(iso).toLocaleDateString('ru-RU')
}

/**
 * Колокольчик уведомлений. Уведомления создаёт сервер (триггеры и расписание в 003_automations.sql),
 * сюда они приходят в реальном времени; новое уведомление на секунды всплывает поверх экрана.
 */
export default function Notifications({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const { profile } = useAuth()
  const { L } = useLang()
  const nav = useNavigate()
  const [items, setItems] = useState<Notice[]>([])
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState<Notice | null>(null)
  const box = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    if (!profile) return
    const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(30)
    setItems((data ?? []) as Notice[])
  }, [profile])

  useEffect(() => {
    load()
    if (!profile) return
    const ch = supabase.channel(`notices-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, (p) => {
        const n = p.new as Notice
        setItems((list) => [n, ...list].slice(0, 30))
        setToast(n)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile, load])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  async function go(n: Notice) {
    setOpen(false); setToast(null)
    if (!n.read_at) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)))
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
    }
    if (n.link) nav(n.link)
  }

  async function readAll() {
    const ids = items.filter((n) => !n.read_at).map((n) => n.id)
    if (!ids.length) return
    const now = new Date().toISOString()
    setItems((list) => list.map((x) => ({ ...x, read_at: x.read_at ?? now })))
    await supabase.from('notifications').update({ read_at: now }).in('id', ids)
  }

  if (!profile) return null
  const unread = items.filter((n) => !n.read_at).length
  const title = (n: Notice) => L(n.title_ru, n.title_kk)
  const body = (n: Notice) => L(n.body_ru ?? '', n.body_kk ?? n.body_ru ?? '')

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label={L('Уведомления', 'Хабарламалар')}
        className={`relative grid h-9 w-9 place-items-center rounded-lg ${tone === 'dark' ? 'text-white ring-1 ring-white/30 hover:bg-white/10' : 'text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50'}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-14 z-50 max-h-[70vh] overflow-auto rounded-2xl bg-white text-slate-800 shadow-xl ring-1 ring-black/10 sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96">
          <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-2.5">
            <span className="font-semibold">{L('Уведомления', 'Хабарламалар')}</span>
            {unread > 0 && <button className="text-sm font-medium text-brand-700" onClick={readAll}>{L('Прочитать все', 'Барлығын оқу')}</button>}
          </div>
          {items.map((n) => (
            <button key={n.id} onClick={() => go(n)} className={`flex w-full gap-3 border-t border-slate-100 px-4 py-3 text-left first:border-t-0 hover:bg-slate-50 ${n.read_at ? '' : 'bg-brand-50/60'}`}>
              <span className="text-lg leading-none">{KIND_ICON[n.kind] ?? '🔔'}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-snug">{title(n)}</span>
                {body(n) && <span className="mt-0.5 block text-sm leading-snug text-slate-600">{body(n)}</span>}
                <span className="mt-1 block text-xs text-slate-400">{ago(n.created_at, L)}</span>
              </span>
              {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" />}
            </button>
          ))}
          {items.length === 0 && <div className="px-4 py-8 text-center text-sm text-slate-400">{L('Уведомлений пока нет', 'Әзірге хабарлама жоқ')}</div>}
        </div>
      )}

      {toast && !open && (
        <button onClick={() => go(toast)} className="fixed inset-x-3 top-3 z-[60] flex gap-3 rounded-2xl bg-white p-3.5 text-left text-slate-800 shadow-2xl ring-1 ring-black/10 sm:inset-x-auto sm:right-4 sm:w-96">
          <span className="text-xl leading-none">{KIND_ICON[toast.kind] ?? '🔔'}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold leading-snug">{title(toast)}</span>
            {body(toast) && <span className="mt-0.5 block text-sm leading-snug text-slate-600">{body(toast)}</span>}
          </span>
        </button>
      )}
    </div>
  )
}
