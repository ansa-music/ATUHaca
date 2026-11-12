import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CountUp, SuccessCheck, useFreshIds } from '../components/fx'
import { Btn, Card, ErrorBox, Pill, StatusBadge, inputCls } from '../components/ui'
import { useAuth } from '../lib/auth'
import { dmy, monthEnd, monthKey, monthLabel, monthStart, num, today } from '../lib/format'
import { CATEGORY, REASON, useLang } from '../lib/i18n'
import { errText, supabase } from '../lib/supabase'
import type { Category, Disposal, Entry, Reason, Report, WasteType } from '../lib/types'

const REASONS_BY_CATEGORY: Record<Category, Reason[]> = {
  avoidable: ['overproduction', 'expired', 'spoilage', 'plate'],
  unavoidable: ['trimmings'],
  packaging: [],
}
const MAX_QTY = 500

type Draft = { typeId: string; qty: string; disposalId: string; reason: Reason | ''; date: string }

/** Сжимает фото до 720 px по большей стороне (JPEG), чтобы запись уходила быстро даже по мобильной сети. */
function compress(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, 720 / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(img.src)
      resolve(c.toDataURL('image/jpeg', 0.6))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export default function EntryPage() {
  const { profile, org } = useAuth()
  const { L, lang, name } = useLang()
  const [params] = useSearchParams()
  const month = params.get('month') ?? monthKey(monthStart())
  const isCurrentMonth = month === monthKey(monthStart())
  const draftKey = `qadir.draft.${org?.id}.${month}`

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [types, setTypes] = useState<WasteType[]>([])
  const [disposals, setDisposals] = useState<Disposal[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [returnComment, setReturnComment] = useState('')

  const defaultDate = isCurrentMonth ? today() : monthEnd(month)
  const [form, setForm] = useState<Draft>({ typeId: '', qty: '', disposalId: '', reason: '', date: defaultDate })
  const [photo, setPhoto] = useState('')
  const [source, setSource] = useState<Entry['source']>('manual')
  const [editingId, setEditingId] = useState('')
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState('')
  const [portions, setPortions] = useState('')
  const [scale, setScale] = useState<{ id: number; weight: number } | null>(null)
  const [newType, setNewType] = useState<{ name: string; unit: 'kg' | 'l'; category: Category } | null>(null)
  const [aiBusy, setAiBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const editable = report ? report.status === 'draft' || report.status === 'returned' : false

  const load = useCallback(async () => {
    if (!org) return
    setError('')
    try {
      const { data: rep, error: e1 } = await supabase.rpc('get_or_create_report', { p_month: `${month}-01` })
      if (e1) throw e1
      const r = rep as Report
      setReport(r)
      const [t, d, e, p, h] = await Promise.all([
        supabase.from('waste_types').select('*').or(`org_id.eq.${org.id},org_id.is.null`).eq('is_active', true).order('created_at'),
        supabase.from('disposal_methods').select('*').eq('is_active', true).order('name_ru'),
        supabase.from('entries').select('*').eq('report_id', r.id).order('created_at', { ascending: false }),
        supabase.from('daily_portions').select('portions').eq('org_id', org.id).eq('day', today()).maybeSingle(),
        supabase.from('status_history').select('comment').eq('report_id', r.id).eq('to_status', 'returned').order('created_at', { ascending: false }).limit(1),
      ])
      if (t.error) throw t.error
      if (e.error) throw e.error
      setTypes((t.data ?? []) as WasteType[])
      setDisposals((d.data ?? []) as Disposal[])
      setEntries((e.data ?? []) as Entry[])
      setPortions(p.data?.portions != null ? String(p.data.portions) : '')
      setReturnComment(r.status === 'returned' ? (h.data?.[0]?.comment ?? '') : '')
    } catch (err) { setError(errText(err)) } finally { setLoading(false) }
  }, [org, month])

  useEffect(() => { load() }, [load])

  // Автосохранение черновика формы: незаконченный ввод переживает перезагрузку и потерю связи.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) setForm((f) => ({ ...f, ...(JSON.parse(raw) as Draft) }))
    } catch { /* хранилище недоступно */ }
  }, [draftKey])
  useEffect(() => {
    if (editingId) return
    try {
      if (form.typeId || form.qty) localStorage.setItem(draftKey, JSON.stringify(form))
      else localStorage.removeItem(draftKey)
    } catch { /* хранилище недоступно */ }
  }, [form, draftKey, editingId])

  // Показания электронных весов приходят в реальном времени.
  useEffect(() => {
    if (!org) return
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    supabase.from('scale_readings').select('id,weight').eq('org_id', org.id).eq('used', false).gte('created_at', since)
      .order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) setScale({ id: data[0].id, weight: Number(data[0].weight) }) })
    const ch = supabase.channel(`scale-${org.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'scale_readings', filter: `org_id=eq.${org.id}` },
        (payload) => setScale({ id: (payload.new as { id: number }).id, weight: Number((payload.new as { weight: number }).weight) }))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [org])

  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types])
  const selected = typeById.get(form.typeId)

  function pickType(t: WasteType) {
    setForm((f) => ({
      ...f, typeId: t.id, disposalId: t.default_disposal_id ?? f.disposalId,
      reason: REASONS_BY_CATEGORY[t.category].length === 1 ? REASONS_BY_CATEGORY[t.category][0] : '',
    }))
  }

  function useScale() {
    if (!scale) return
    setForm((f) => ({ ...f, qty: String(scale.weight) }))
    setSource('scale')
    supabase.from('scale_readings').update({ used: true }).eq('id', scale.id).then(() => undefined)
    setScale(null)
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return
    try {
      const data = await compress(file)
      setPhoto(data)
      // ИИ-подсказка вида отхода. Если серверная функция не развёрнута — фото просто прикрепляется.
      setAiBusy(true)
      const { data: ai } = await supabase.functions.invoke('recognize', {
        body: { image: data, types: types.map((t) => ({ id: t.id, name: t.name_ru })) },
      })
      const hit = ai?.waste_type_id ? typeById.get(ai.waste_type_id as string) : undefined
      if (hit) { pickType(hit); setSource('photo'); setFlash(L(`ИИ определил: ${hit.name_ru}. Проверьте и укажите вес.`, `ЖИ анықтады: ${hit.name_kk}. Тексеріп, салмағын енгізіңіз.`)) }
    } catch { /* распознавание недоступно — продолжаем без него */ } finally { setAiBusy(false) }
  }

  function reset() {
    setForm({ typeId: '', qty: '', disposalId: '', reason: '', date: form.date })
    setPhoto(''); setEditingId(''); setSource('manual')
    try { localStorage.removeItem(draftKey) } catch { /* хранилище недоступно */ }
  }

  async function save() {
    if (!report || !org || !selected) return
    setError(''); setFlash('')
    const qty = Number(form.qty.replace(',', '.'))
    if (!Number.isFinite(qty) || qty <= 0) return setError(L('Укажите количество больше нуля', 'Нөлден үлкен мөлшерді енгізіңіз'))
    if (qty > MAX_QTY) return setError(L(`Слишком большое значение: не больше ${MAX_QTY}`, `Мән тым үлкен: ${MAX_QTY}-ден аспауы тиіс`))
    if (form.date > today()) return setError(L('Дата не может быть в будущем', 'Күн болашақта болмауы тиіс'))
    if (!form.disposalId) return setError(L('Выберите способ утилизации', 'Кәдеге жарату тәсілін таңдаңыз'))
    const dup = entries.find((e) => e.id !== editingId && e.entry_date === form.date && e.waste_type_id === form.typeId && Number(e.quantity) === qty)
    if (dup && !confirm(L('Такая запись за этот день уже есть. Возможно, это дубль. Всё равно сохранить?', 'Бұл күнге осындай жазба бар. Қайталануы мүмкін. Сонда да сақтау керек пе?'))) return

    setSaving(true)
    try {
      const row = {
        report_id: report.id, org_id: org.id, entry_date: form.date, waste_type_id: form.typeId, quantity: qty,
        disposal_id: form.disposalId, reason: form.reason || null, source, has_photo: Boolean(photo) || undefined,
      }
      if (editingId) {
        const { error } = await supabase.from('entries').update(row).eq('id', editingId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('entries').insert({ ...row, has_photo: Boolean(photo) }).select('id').single()
        if (error) throw error
        if (photo) await supabase.from('entry_photos').insert({ entry_id: data.id, org_id: org.id, data: photo })
      }
      setFlash(L('Сохранено', 'Сақталды'))
      reset()
      await load()
    } catch (err) { setError(errText(err)) } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm(L('Удалить запись?', 'Жазбаны жою керек пе?'))) return
    const { error } = await supabase.from('entries').delete().eq('id', id)
    if (error) setError(errText(error)); else load()
  }

  function edit(e: Entry) {
    setEditingId(e.id); setPhoto(''); setSource(e.source)
    setForm({ typeId: e.waste_type_id, qty: String(e.quantity), disposalId: e.disposal_id ?? '', reason: e.reason ?? '', date: e.entry_date })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function addType() {
    if (!newType || !org || !newType.name.trim()) return
    const food = newType.category !== 'packaging'
    const { data, error } = await supabase.from('waste_types').insert({
      org_id: org.id, name_ru: newType.name.trim(), name_kk: newType.name.trim(), unit: newType.unit,
      category: newType.category, recyclable: newType.category === 'packaging', co2_factor: food ? 2.5 : 0,
      default_disposal_id: disposals[0]?.id ?? null, created_by: profile?.id,
    }).select('*').single()
    if (error) return setError(errText(error))
    setTypes((t) => [...t, data as WasteType])
    setNewType(null)
    pickType(data as WasteType)
  }

  async function savePortions(v: string) {
    setPortions(v)
    const n = Number(v)
    if (!org || !v || !Number.isInteger(n) || n < 0) return
    await supabase.from('daily_portions').upsert({ org_id: org.id, day: today(), portions: n })
  }

  async function submit() {
    if (!report) return
    if (!confirm(L(`Отправить отчёт за ${monthLabel(month, lang)} на проверку? После отправки записи нельзя менять.`, `${monthLabel(month, lang)} есебін тексеруге жіберу керек пе? Жіберілгеннен кейін жазбаларды өзгертуге болмайды.`))) return
    const { error } = await supabase.rpc('submit_report', { p_report: report.id })
    if (error) setError(errText(error)); else { setFlash(L('Отчёт отправлен на проверку', 'Есеп тексеруге жіберілді')); load() }
  }

  // Итоги считаются из записей, отдельно по килограммам и литрам.
  const totals = useMemo(() => {
    const sum = (list: Entry[]) => {
      const by = new Map<string, number>(); let kg = 0, l = 0
      for (const e of list) {
        const t = typeById.get(e.waste_type_id)
        by.set(e.waste_type_id, (by.get(e.waste_type_id) ?? 0) + Number(e.quantity))
        if (t?.unit === 'l') l += Number(e.quantity); else kg += Number(e.quantity)
      }
      return { by, kg, l }
    }
    return { day: sum(entries.filter((e) => e.entry_date === form.date)), month: sum(entries) }
  }, [entries, form.date, typeById])

  const unitLabel = (u?: string) => (u === 'l' ? L('л', 'л') : L('кг', 'кг'))
  const total = (t: { kg: number; l: number }) => `${num(t.kg)} ${unitLabel('kg')}${t.l ? ` + ${num(t.l)} ${unitLabel('l')}` : ''}`
  const dayEntries = entries.filter((e) => e.entry_date === form.date)
  // Только оформление: итог с «докручивающимися» числами и отметка только что добавленных строк.
  const totalFx = (t: { kg: number; l: number }) => <><CountUp value={t.kg} /> {unitLabel('kg')}{t.l ? <> + <CountUp value={t.l} /> {unitLabel('l')}</> : ''}</>
  const isFresh = useFreshIds(loading ? null : entries.map((e) => e.id))
  const saved = flash === L('Сохранено', 'Сақталды') || flash === L('Отчёт отправлен на проверку', 'Есеп тексеруге жіберілді')

  if (!org) return <Card>{L('Вам ещё не назначена организация. Обратитесь к администратору.', 'Сізге әлі ұйым тағайындалмаған. Әкімшіге хабарласыңыз.')}</Card>
  if (loading) return (
    <div className="mx-auto max-w-xl space-y-3" role="status" aria-busy="true" aria-label={L('Загрузка формы…', 'Форма жүктелуде…')}>
      <div className="fx-shimmer h-7 w-2/3" />
      <div className="fx-shimmer h-4 w-1/3" />
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="grid grid-cols-2 gap-2">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="fx-shimmer h-14" />)}</div>
        <div className="fx-shimmer h-[52px]" />
        <div className="fx-shimmer h-14" />
      </div>
      <div className="grid grid-cols-2 gap-3"><div className="fx-shimmer h-[74px]" /><div className="fx-shimmer h-[74px]" /></div>
    </div>
  )

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold leading-tight">{name(org)}</h1>
          <p className="text-sm text-slate-500">{L('Отчёт за', 'Есеп:')} {monthLabel(month, lang)}</p>
        </div>
        {report && <StatusBadge status={report.status} />}
      </div>

      {report?.status === 'returned' && (
        <div className="fx-fade-up rounded-2xl bg-rose-50 p-3 text-sm text-rose-900 ring-1 ring-rose-200">
          <div className="font-semibold">{L('Отчёт возвращён на доработку', 'Есеп пысықтауға қайтарылды')}</div>
          {returnComment && <div className="mt-1">«{returnComment}»</div>}
        </div>
      )}
      {report && !editable && (
        <div className="rounded-2xl bg-blue-50 p-3 text-sm text-blue-900 ring-1 ring-blue-200">
          {report.status === 'accepted'
            ? L('Отчёт принят и закрыт для изменений.', 'Есеп қабылданды және өзгертуге жабық.')
            : L('Отчёт на проверке. Изменения станут доступны, если его вернут на доработку.', 'Есеп тексеруде. Пысықтауға қайтарылса, өзгертуге болады.')}
        </div>
      )}
      <ErrorBox>{error}</ErrorBox>
      {flash && <div role="status" className="fx-fade-up flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">{saved && <SuccessCheck />}{flash}</div>}

      {editable && (
        <Card className="space-y-3">
          {scale && (
            <button onClick={useScale} className="fx-fade-up fx-pop flex min-h-12 w-full items-center justify-between rounded-xl bg-amber-50 px-3 py-2.5 text-left ring-1 ring-amber-300">
              <span className="text-sm font-medium text-amber-900">⚖️ {L('С весов пришло', 'Таразыдан келді')}: <b>{num(scale.weight, 2)} {unitLabel('kg')}</b></span>
              <span className="text-sm font-semibold text-amber-800">{L('Подставить', 'Қою')}</span>
            </button>
          )}

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">{L('Что выбросили', 'Не тасталды')}</span>
              <button className="text-sm font-semibold text-brand-700" onClick={() => setNewType({ name: '', unit: 'kg', category: 'avoidable' })}>+ {L('новый вид', 'жаңа түр')}</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {types.map((t) => (
                <button key={t.id} onClick={() => pickType(t)}
                  className={`fx-pop min-h-14 rounded-xl px-2.5 py-2 text-left text-sm font-medium leading-tight ring-1 transition ${form.typeId === t.id ? 'bg-brand-700 text-white ring-brand-700' : 'bg-slate-50 text-slate-800 ring-slate-200'}`}>
                  {name(t)}
                  <span className={`block text-xs font-normal transition-colors ${form.typeId === t.id ? 'text-white/75' : 'text-slate-500'}`}>{unitLabel(t.unit)} · {L(...CATEGORY[t.category])}</span>
                </button>
              ))}
            </div>
          </div>

          {newType && (
            <div className="space-y-2 rounded-xl bg-brand-50 p-3 ring-1 ring-brand-200">
              <input autoFocus className={inputCls} placeholder={L('Название нового вида отхода', 'Жаңа қалдық түрінің атауы')} value={newType.name} onChange={(e) => setNewType({ ...newType, name: e.target.value })} />
              <div className="flex gap-2">
                <select className={inputCls} value={newType.unit} onChange={(e) => setNewType({ ...newType, unit: e.target.value as 'kg' | 'l' })}>
                  <option value="kg">{L('килограммы', 'килограмм')}</option>
                  <option value="l">{L('литры', 'литр')}</option>
                </select>
                <select className={inputCls} value={newType.category} onChange={(e) => setNewType({ ...newType, category: e.target.value as Category })}>
                  {(Object.keys(CATEGORY) as Category[]).map((c) => <option key={c} value={c}>{L(...CATEGORY[c])}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <Btn size="sm" onClick={addType} disabled={!newType.name.trim()}>{L('Добавить в справочник', 'Анықтамалыққа қосу')}</Btn>
                <Btn size="sm" variant="ghost" onClick={() => setNewType(null)}>{L('Отмена', 'Бас тарту')}</Btn>
              </div>
            </div>
          )}

          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600">{L('Количество', 'Мөлшері')}, {unitLabel(selected?.unit)}</span>
              <input className={`${inputCls} text-2xl font-bold`} inputMode="decimal" placeholder="0,0" value={form.qty}
                onChange={(e) => { setForm({ ...form, qty: e.target.value.replace(/[^0-9.,]/g, '') }); if (source === 'scale') setSource('manual') }} />
            </label>
            <button onClick={() => fileRef.current?.click()} className={`fx-pop h-[52px] rounded-xl px-4 text-2xl ring-1 ${photo ? 'bg-brand-100 ring-brand-500' : 'bg-slate-50 ring-slate-300'}`} title={L('Фото', 'Фото')}>
              {aiBusy ? '…' : photo ? '✅' : '📷'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = '' }} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600">{L('Способ утилизации', 'Кәдеге жарату тәсілі')}</span>
              <select className={inputCls} value={form.disposalId} onChange={(e) => setForm({ ...form, disposalId: e.target.value })}>
                <option value="">—</option>
                {disposals.map((d) => <option key={d.id} value={d.id}>{name(d)}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-600">{L('Дата', 'Күні')}</span>
              <input type="date" className={inputCls} value={form.date} min={report?.period_start} max={isCurrentMonth ? today() : report?.period_end}
                onChange={(e) => e.target.value && setForm({ ...form, date: e.target.value })} />
            </label>
          </div>

          {selected && REASONS_BY_CATEGORY[selected.category].length > 1 && (
            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-600">{L('Причина потери', 'Шығын себебі')}</span>
              <div className="flex flex-wrap gap-1.5">
                {REASONS_BY_CATEGORY[selected.category].map((r) => (
                  <button key={r} onClick={() => setForm({ ...form, reason: form.reason === r ? '' : r })}
                    className={`fx-pop min-h-10 rounded-full px-3 py-1.5 text-sm ring-1 ${form.reason === r ? 'bg-wheat text-white ring-wheat' : 'bg-white text-slate-700 ring-slate-300'}`}>
                    {L(...REASON[r])}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Btn size="lg" className="fx-pop min-h-14 flex-1" onClick={save} disabled={saving || !form.typeId || !form.qty}>
              {editingId ? L('Сохранить изменения', 'Өзгерістерді сақтау') : L('Сохранить запись', 'Жазбаны сақтау')}
            </Btn>
            {(editingId || form.typeId) && <Btn size="lg" variant="ghost" className="fx-pop min-h-14" onClick={reset}>✕</Btn>}
          </div>
          <p className="text-center text-xs text-slate-400">{L('Ответственный', 'Жауапты')}: {profile?.full_name} · {L('черновик сохраняется автоматически', 'жоба автоматты түрде сақталады')}</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="!p-3.5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{L('Итого за', 'Жиыны:')} {dmy(form.date).slice(0, 5)}</div>
          <div className="mt-1 text-xl font-bold">{totalFx(totals.day)}</div>
        </Card>
        <Card className="!p-3.5">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{L('Итого за месяц', 'Ай бойынша жиыны')}</div>
          <div className="mt-1 text-xl font-bold">{totalFx(totals.month)}</div>
        </Card>
      </div>

      <Card className="!p-0">
        <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold">{L('Итоги по видам отходов', 'Қалдық түрлері бойынша қорытынды')}</div>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-slate-500">
            <th className="px-4 py-1.5 text-left font-medium">{L('Вид', 'Түрі')}</th>
            <th className="px-2 py-1.5 text-right font-medium">{L('День', 'Күн')}</th>
            <th className="px-4 py-1.5 text-right font-medium">{L('Месяц', 'Ай')}</th>
          </tr></thead>
          <tbody>
            {types.filter((t) => totals.month.by.has(t.id)).map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-1.5">{name(t)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{totals.day.by.has(t.id) ? num(totals.day.by.get(t.id)!) : '—'}</td>
                <td className="px-4 py-1.5 text-right font-semibold tabular-nums">{num(totals.month.by.get(t.id)!)} {unitLabel(t.unit)}</td>
              </tr>
            ))}
            {totals.month.by.size === 0 && <tr><td colSpan={3} className="px-4 py-4 text-center text-slate-400">{L('Записей пока нет', 'Әзірге жазба жоқ')}</td></tr>}
          </tbody>
        </table>
      </Card>

      <Card className="!p-0">
        <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold">{L('Записи за', 'Жазбалар:')} {dmy(form.date)}</div>
        {dayEntries.length === 0 && <div className="px-4 py-4 text-center text-sm text-slate-400">{L('За этот день записей нет', 'Бұл күнге жазба жоқ')}</div>}
        {dayEntries.map((e) => {
          const t = typeById.get(e.waste_type_id)
          return (
            <div key={e.id} className={`flex items-center gap-2 border-t border-slate-100 px-4 py-2 first:border-t-0 ${isFresh(e.id) ? 'fx-slide-in' : ''}`}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{name(t)}</div>
                <div className="text-xs text-slate-500">
                  {name(disposals.find((d) => d.id === e.disposal_id))}
                  {e.has_photo && ' · 📷'}{e.source === 'scale' && ' · ⚖️'}{e.source === 'photo' && ' · ИИ'}
                </div>
              </div>
              <div className="font-bold tabular-nums">{num(Number(e.quantity), 2)} {unitLabel(t?.unit)}</div>
              {editable && (
                <>
                  <button className="rounded-lg px-2 py-1 text-slate-500 ring-1 ring-slate-200" onClick={() => edit(e)}>✎</button>
                  <button className="rounded-lg px-2 py-1 text-rose-600 ring-1 ring-rose-200" onClick={() => remove(e.id)}>🗑</button>
                </>
              )}
            </div>
          )
        })}
      </Card>

      {isCurrentMonth && org.type !== 'lab' && (
        <Card className="flex items-center gap-3 !p-3.5">
          <div className="flex-1 text-sm">
            <div className="font-medium">{L('Порций выдано сегодня', 'Бүгін берілген порция')}</div>
            <div className="text-xs text-slate-500">{L('нужно для показателя «граммы на порцию»', '«бір порцияға грамм» көрсеткіші үшін қажет')}</div>
          </div>
          <input className={`${inputCls} !w-24 text-right font-semibold`} inputMode="numeric" value={portions} placeholder="0"
            onChange={(e) => savePortions(e.target.value.replace(/\D/g, ''))} />
        </Card>
      )}

      {editable && (
        <Btn size="lg" variant="soft" className="fx-pop min-h-12 w-full" onClick={submit} disabled={entries.length === 0}>
          {L('Отправить отчёт за месяц на проверку', 'Айлық есепті тексеруге жіберу')} →
        </Btn>
      )}
      <div className="flex items-center justify-between text-sm">
        <Link to="/reports" className="font-medium text-brand-700">{L('Все отчёты и история', 'Барлық есептер мен тарих')}</Link>
        {!isCurrentMonth && <Link to="/entry" className="text-slate-500">{L('К текущему месяцу', 'Ағымдағы айға')}</Link>}
        <Pill>{entries.length} {L('записей', 'жазба')}</Pill>
      </div>
    </div>
  )
}
