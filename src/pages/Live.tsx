import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Icon, Logo, type IconName } from '../components/Icon'
import { LangSwitch } from '../components/Layout'
import { CountUp } from '../components/motion'
import { Skeleton } from '../components/ui'
import { monthLabel, monthStart, num, today } from '../lib/format'
import { useLang } from '../lib/i18n'
import { errText, fetchAll, supabase } from '../lib/supabase'

type FeedRow = { id: string; org_id: string; entry_date: string; waste_type_id: string; quantity: number; source: 'manual' | 'photo' | 'scale'; created_at: string }
type MonthRow = { id: string; quantity: number; waste_type_id: string; entry_date: string }
type OrgRef = { id: string; name_ru: string; name_kk: string }
type WasteRef = { id: string; name_ru: string; name_kk: string; unit: 'kg' | 'l'; kg_per_unit: number }

const FEED_SIZE = 12
const FEED_COLS = 'id, org_id, entry_date, waste_type_id, quantity, source, created_at'
const SOURCE_ICON: Record<FeedRow['source'], IconName> = { manual: 'phone', photo: 'camera', scale: 'scale' }
const pad = (n: number) => String(n).padStart(2, '0')

function byId<T extends { id: string }>(rows: T[]) {
  const m: Record<string, T> = {}
  for (const r of rows) m[r.id] = r
  return m
}

function Counter({ label, value, format, unit, accent }: { label: string; value: number; format?: (n: number) => string; unit?: string; accent?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  // лёгкий «толчок» цифры при каждом обновлении
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const el = ref.current
    if (!el) return
    el.classList.remove('animate-pop')
    void el.offsetWidth
    el.classList.add('animate-pop')
  }, [value])
  return (
    <div className="rounded-3xl bg-white/[0.07] p-5 ring-1 ring-white/10 backdrop-blur-sm lg:p-7">
      <div className="text-sm font-semibold uppercase tracking-wider text-white/60 lg:text-base">{label}</div>
      <div ref={ref} className={`mt-1 origin-left whitespace-nowrap text-6xl font-extrabold leading-none tracking-tight lg:text-7xl xl:text-8xl ${accent ? 'text-wheat-light' : 'text-white'}`}>
        <CountUp value={value} duration={900} format={format} />
        {unit && <span className="ml-2 text-2xl font-bold text-white/60 lg:text-3xl">{unit}</span>}
      </div>
    </div>
  )
}

export default function LivePage() {
  const { L, name } = useLang()
  const [orgs, setOrgs] = useState<Record<string, OrgRef>>({})
  const [wastes, setWastes] = useState<Record<string, WasteRef>>({})
  const [feed, setFeed] = useState<FeedRow[] | null>(null)
  const [month, setMonth] = useState<MonthRow[]>([])
  const [fresh, setFresh] = useState<Set<string>>(() => new Set())
  const [online, setOnline] = useState(false)
  const [error, setError] = useState('')
  const [now, setNow] = useState(() => new Date())
  const seen = useRef<Set<string> | null>(null)
  const wastesRef = useRef(wastes)
  wastesRef.current = wastes

  const markFresh = useCallback((ids: string[]) => {
    if (ids.length) setFresh((prev) => new Set([...prev, ...ids]))
  }, [])

  const load = useCallback(async () => {
    try {
      const [o, w, f, m] = await Promise.all([
        supabase.from('organizations').select('id, name_ru, name_kk'),
        supabase.from('waste_types').select('id, name_ru, name_kk, unit, kg_per_unit'),
        supabase.from('entries').select(FEED_COLS).order('created_at', { ascending: false }).limit(FEED_SIZE),
        fetchAll<MonthRow>((from, to) => supabase.from('entries').select('id, quantity, waste_type_id, entry_date').gte('entry_date', monthStart()).order('id').range(from, to)),
      ])
      if (o.error) throw o.error
      if (w.error) throw w.error
      if (f.error) throw f.error
      const rows = (f.data ?? []) as FeedRow[]
      setOrgs(byId((o.data ?? []) as OrgRef[]))
      setWastes(byId((w.data ?? []) as WasteRef[]))
      setFeed(rows)
      setMonth(m)
      // всё, что появилось после первой загрузки, считаем новым и подсвечиваем
      if (seen.current) markFresh(rows.filter((r) => !seen.current!.has(r.id)).map((r) => r.id))
      else seen.current = new Set()
      for (const r of rows) seen.current.add(r.id)
      setError('')
    } catch (e) {
      setError(errText(e))
    }
  }, [markFresh])

  useEffect(() => {
    load()
    const ch = supabase
      .channel('live-wall')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'entries' }, (payload) => {
        const r = payload.new as FeedRow
        if (!r?.id) return
        const row: FeedRow = { ...r, quantity: Number(r.quantity) }
        if (seen.current && !seen.current.has(row.id)) { seen.current.add(row.id); markFresh([row.id]) }
        setFeed((prev) => (!prev || prev.some((x) => x.id === row.id) ? prev : [row, ...prev].slice(0, FEED_SIZE)))
        if (row.entry_date >= monthStart()) setMonth((prev) => (prev.some((x) => x.id === row.id) ? prev : [...prev, row]))
        if (!wastesRef.current[row.waste_type_id]) load() // новый вид отхода, добавленный прямо в форме
      })
      .subscribe((status) => setOnline(status === 'SUBSCRIBED'))
    // страховка на случай обрыва realtime-соединения
    const poll = window.setInterval(load, 30_000)
    const clock = window.setInterval(() => setNow(new Date()), 10_000)
    return () => {
      supabase.removeChannel(ch)
      window.clearInterval(poll)
      window.clearInterval(clock)
    }
  }, [load, markFresh])

  const totals = useMemo(() => {
    const t = today()
    const ms = monthStart()
    let entriesToday = 0, kgToday = 0, kgMonth = 0
    for (const r of month) {
      if (r.entry_date < ms) continue
      const kg = Number(r.quantity) * (wastes[r.waste_type_id]?.kg_per_unit ?? 1)
      kgMonth += kg
      if (r.entry_date === t) { entriesToday += 1; kgToday += kg }
    }
    return { entriesToday, kgToday, kgMonth }
    // now — чтобы итоги «за сегодня» пересчитались после полуночи
  }, [month, wastes, now])

  const timeOf = (iso: string) => {
    const d = new Date(iso)
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
    return d.toDateString() === now.toDateString() ? hm : `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${hm}`
  }
  const kgFmt = (n: number) => num(n, 1)
  const guestUrl = `${window.location.origin}/login?guest=1`
  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.().catch(() => { /* браузер не разрешил */ })
  }
  const ctl = 'grid h-9 w-9 place-items-center rounded-lg text-white/80 ring-1 ring-white/25 transition duration-150 hover:bg-white/10 hover:text-white active:scale-95'

  return (
    <div className="brand-surface on-dark flex min-h-full flex-col text-white">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 lg:px-8 lg:py-5">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div className="leading-tight">
            <div className="text-xl font-extrabold tracking-tight lg:text-2xl">Qadir</div>
            <div className="text-xs text-white/65 lg:text-sm">{L('Живое табло взвешиваний', 'Өлшеулердің тікелей таблосы')}</div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold ring-1 ring-white/15 lg:text-sm">
            <span className={`h-2 w-2 rounded-full ${online ? 'animate-pulse-dot bg-emerald-300' : 'bg-white/40'}`} />
            {online ? L('в эфире', 'тікелей эфир') : L('подключение…', 'қосылуда…')}
          </div>
          <div className="tnum hidden text-2xl font-bold sm:block lg:text-3xl">{pad(now.getHours())}:{pad(now.getMinutes())}</div>
          <LangSwitch />
          <button type="button" onClick={fullscreen} title={L('На весь экран', 'Толық экран')} aria-label={L('На весь экран', 'Толық экран')} className={`hidden sm:grid ${ctl}`}><Icon name="expand" size={18} /></button>
          <Link to="/" title={L('Закрыть табло', 'Таблоны жабу')} aria-label={L('Закрыть табло', 'Таблоны жабу')} className={ctl}><Icon name="x" size={18} /></Link>
        </div>
      </header>

      {error && <div className="mx-4 rounded-xl bg-rose-500/20 px-4 py-2 text-sm text-rose-100 ring-1 ring-rose-300/30 lg:mx-8">{L('Не удалось обновить данные:', 'Деректерді жаңарту мүмкін болмады:')} {error}</div>}

      <main className="grid flex-1 gap-4 px-4 pb-6 pt-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8 lg:px-8 lg:pb-8">
        <section className="flex flex-col gap-4 lg:gap-5">
          <Counter accent label={L('Записей сегодня', 'Бүгінгі жазбалар')} value={totals.entriesToday} />
          <Counter label={L('Взвешено сегодня', 'Бүгін өлшенді')} value={totals.kgToday} format={kgFmt} unit={L('кг', 'кг')} />
          <Counter label={L(`За ${monthLabel(monthStart().slice(0, 7), 'ru', false)}`, `${monthLabel(monthStart().slice(0, 7), 'kk', false)} айында`)} value={totals.kgMonth} format={kgFmt} unit={L('кг', 'кг')} />

          <div className="mt-auto flex items-center gap-4 rounded-3xl bg-white/[0.07] p-4 ring-1 ring-white/10 backdrop-blur-sm lg:gap-6 lg:p-5">
            <div className="shrink-0 rounded-2xl bg-white p-2.5 shadow-lg">
              <QRCodeSVG value={guestUrl} size={132} level="M" fgColor="#0f3f23" className="block h-28 w-28 lg:h-36 lg:w-36" />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-extrabold leading-tight lg:text-3xl">{L('Сканируйте и внесите запись', 'Сканерлеп, жазба енгізіңіз')}</div>
              <div className="mt-1.5 text-sm text-white/70 lg:text-base">{L('Вход гостя жюри — запись сразу появится на этом экране.', 'Қазылар қонағы ретінде кіру — жазба осы экранда бірден пайда болады.')}</div>
              <div className="mt-2 truncate text-xs text-white/50 lg:text-sm">{guestUrl.replace(/^https?:\/\//, '')}</div>
            </div>
          </div>
        </section>

        <section className="flex min-h-0 flex-col rounded-3xl bg-black/15 p-3 ring-1 ring-white/10 lg:p-5">
          <h2 className="mb-3 flex items-center gap-2 px-2 text-sm font-semibold uppercase tracking-wider text-white/60 lg:text-base">
            <Icon name="live" size={18} /> {L('Последние записи', 'Соңғы жазбалар')}
          </h2>
          {!feed ? (
            <div className="space-y-2">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full !rounded-2xl lg:h-16" />)}</div>
          ) : feed.length === 0 ? (
            <div className="grid flex-1 place-items-center px-4 py-10 text-center text-lg text-white/60">{L('Пока записей нет — отсканируйте QR-код и внесите первую.', 'Әзірге жазба жоқ — QR-кодты сканерлеп, біріншісін енгізіңіз.')}</div>
          ) : (
            <ol className="space-y-2 overflow-hidden">
              {feed.map((r) => {
                const w = wastes[r.waste_type_id]
                return (
                  <li key={r.id} className={`flex items-center gap-3 rounded-2xl bg-white/[0.06] px-3 py-2.5 lg:gap-5 lg:px-5 lg:py-3 ${fresh.has(r.id) ? 'animate-row-in' : ''}`}>
                    <span className="tnum w-12 shrink-0 text-sm font-semibold text-white/60 lg:w-20 lg:text-lg">{timeOf(r.created_at)}</span>
                    <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-white/80 sm:grid"><Icon name={SOURCE_ICON[r.source] ?? 'phone'} size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-bold lg:text-xl">{w ? name(w) : '—'}</span>
                      <span className="block truncate text-xs text-white/60 lg:text-sm">{name(orgs[r.org_id])}</span>
                    </span>
                    <span className="tnum shrink-0 whitespace-nowrap text-xl font-extrabold text-wheat-light lg:text-3xl">
                      {num(Number(r.quantity), 2)}<span className="ml-1 text-sm font-semibold text-white/60 lg:text-base">{w?.unit === 'l' ? L('л', 'л') : L('кг', 'кг')}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </main>
    </div>
  )
}
