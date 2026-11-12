import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CountUp, SuccessCheck, useFreshIds } from '../components/fx'
import { Btn, Card, ErrorBox, Pill, StatusBadge, inputCls } from '../components/ui'
import { BatchPreview, rowState, type BatchRow } from '../components/entry/BatchPreview'
import {
  MAX_QTY, REASONS_BY_CATEGORY, aiTypes, compress, fitReason, invokeFn, recognizePhoto, useSpeech,
  type AiRows,
} from '../components/entry/ai'
import { useAuth } from '../lib/auth'
import { dmy, monthEnd, monthKey, monthLabel, monthStart, num, today } from '../lib/format'
import { CATEGORY, REASON, useLang } from '../lib/i18n'
import { errText, supabase } from '../lib/supabase'
import { trustIndex, type Trust } from '../lib/trust'
import type { Category, Disposal, Entry, Reason, Report, WasteType } from '../lib/types'

type Draft = { typeId: string; qty: string; disposalId: string; reason: Reason | ''; date: string }
type Batch = { kind: 'text' | 'journal'; rows: BatchRow[]; note?: string; photo?: string }
const AUTO_MS = 5000

/** Большая понятная кнопка-действие: значок + 2–3 слова. */
function ActionCard({ icon, label, hint, active, busy, onClick }: { icon: string; label: string; hint: string; active?: boolean; busy?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={busy}
      className={`fx-pop flex min-h-28 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-3 text-center ring-1 transition disabled:opacity-70 ${active ? 'bg-brand-700 text-white ring-brand-700' : 'bg-brand-50 text-slate-800 ring-brand-200 hover:bg-brand-100'}`}>
      <span className={`text-3xl leading-none ${busy ? 'animate-pulse' : ''}`} aria-hidden="true">{icon}</span>
      <span className="text-sm font-semibold leading-tight">{label}</span>
      <span className={`text-[11px] leading-tight ${active ? 'text-white/80' : 'text-slate-500'}`}>{hint}</span>
    </button>
  )
}

function AiLine({ busy, busyText, note }: { busy: boolean; busyText: string; note: { tone: 'good' | 'warn' | 'bad'; text: string } | null }) {
  if (!busy && !note) return null
  return (
    <div role="status" className={`fx-fade-up flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ring-1 ${
      busy ? 'bg-slate-50 text-slate-700 ring-slate-200'
        : note?.tone === 'good' ? 'bg-emerald-50 text-emerald-900 ring-emerald-200'
        : note?.tone === 'warn' ? 'bg-amber-50 text-amber-900 ring-amber-200'
        : 'bg-rose-50 text-rose-900 ring-rose-200'}`}>
      <span className={`text-base leading-5 ${busy ? 'animate-pulse' : ''}`}>🤖</span>
      <span>{busy ? busyText : note?.text}</span>
    </div>
  )
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
  const [aiBusy, setAiBusy] = useState<'' | 'photo' | 'text' | 'journal'>('')
  const [aiNote, setAiNote] = useState<{ tone: 'good' | 'warn' | 'bad'; text: string } | null>(null)
  const [panel, setPanel] = useState<'' | 'text'>('')
  const [text, setText] = useState('')
  const [batch, setBatch] = useState<Batch | null>(null)
  const [more, setMore] = useState(false)
  const [check, setCheck] = useState<Trust | null>(null)
  const [autoLeft, setAutoLeft] = useState(0)
  const [cancelledKey, setCancelledKey] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const journalRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const typesRef = useRef<WasteType[]>([])
  typesRef.current = types

  const speech = useSpeech(lang, setText)
  const editable = report ? report.status === 'draft' || report.status === 'returned' : false
  const period = { start: report?.period_start ?? `${month}-01`, end: report?.period_end ?? monthEnd(month) }

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
  const defaultDisposal = (t: WasteType) => t.default_disposal_id ?? disposals[0]?.id ?? ''

  function pickType(t: WasteType, aiReason?: Reason | null) {
    setForm((f) => ({ ...f, typeId: t.id, disposalId: t.default_disposal_id || f.disposalId || disposals[0]?.id || '', reason: fitReason(t.category, aiReason) }))
  }

  function useScale() {
    if (!scale) return
    setForm((f) => ({ ...f, qty: String(scale.weight) }))
    setSource('scale')
    supabase.from('scale_readings').update({ used: true }).eq('id', scale.id).then(() => undefined)
    setScale(null)
  }

  /** Добавляет вид отхода в справочник организации (или находит уже существующий с тем же названием). */
  async function ensureType(rawName: string, category: Category | null, unit: 'kg' | 'l' = 'kg'): Promise<WasteType> {
    const nm = rawName.trim()
    const low = nm.toLowerCase()
    const found = typesRef.current.find((t) => t.name_ru.toLowerCase() === low || t.name_kk.toLowerCase() === low)
    if (found) return found
    const cat: Category = category ?? 'avoidable'
    const food = cat !== 'packaging'
    const { data, error } = await supabase.from('waste_types').insert({
      org_id: org!.id, name_ru: nm, name_kk: nm, unit,
      category: cat, recyclable: cat === 'packaging', co2_factor: food ? 2.5 : 0,
      default_disposal_id: disposals[0]?.id ?? null, created_by: profile?.id,
    }).select('*').single()
    if (error) throw error
    const t = data as WasteType
    typesRef.current = [...typesRef.current, t]
    setTypes((list) => [...list, t])
    return t
  }

  async function addType() {
    if (!newType || !org || !newType.name.trim()) return
    try {
      const t = await ensureType(newType.name, newType.category, newType.unit)
      setNewType(null)
      pickType(t)
    } catch (err) { setError(errText(err)) }
  }

  const aiFail = (status: number, code: string) => status === 404
    ? L('Помощник ИИ ещё включается на сервере. Попробуйте через минуту или выберите вид плиткой ниже.', 'ЖИ көмекшісі серверде әлі қосылуда. Бір минуттан кейін көріңіз немесе түрін төменнен таңдаңыз.')
    : code === 'network'
      ? L('Нет связи с ИИ. Проверьте интернет или выберите вид плиткой ниже.', 'ЖИ-мен байланыс жоқ. Интернетті тексеріңіз немесе түрін төменнен таңдаңыз.')
      : L(`ИИ сейчас недоступен (${code}). Выберите вид плиткой ниже.`, `ЖИ қазір қолжетімсіз (${code}). Түрін төменнен таңдаңыз.`)

  // 1. Фото отхода: ИИ выбирает вид и причину, неизвестный вид сам добавляет в справочник.
  async function onPhoto(file: File | undefined) {
    if (!file) return
    setAiNote(null); setBatch(null); setPanel('')
    let data = ''
    try {
      data = await compress(file)
      setPhoto(data)
    } catch {
      setAiNote({ tone: 'bad', text: L('Не удалось прочитать фото. Попробуйте ещё раз.', 'Фотоны оқу мүмкін болмады. Қайталап көріңіз.') })
      return
    }
    setAiBusy('photo')
    try {
      const r = await recognizePhoto(data, types)
      if (r.error !== undefined) {
        setAiNote({ tone: 'bad', text: `${aiFail(r.status, r.error)} ${L('Фото прикреплено.', 'Фото тіркелді.')}` })
        return
      }
      const ai = r.data
      const note = ai.note_ru?.trim().replace(/[.!\s]+$/, '')
      let hit = ai.waste_type_id ? typeById.get(ai.waste_type_id) : undefined
      let created = false
      if (!hit && ai.new_type_name?.trim()) {
        const before = typesRef.current.length
        hit = await ensureType(ai.new_type_name, ai.new_type_category)
        created = typesRef.current.length > before
      }
      const next = scale ? L('Вес с весов сохраню сам через 5 секунд.', 'Таразы салмағын 5 секундтан кейін өзім сақтаймын.') : L('Введите вес и нажмите «Сохранить».', 'Салмағын енгізіп, «Сақтау» басыңыз.')
      if (hit) {
        pickType(hit, ai.reason); setSource('photo')
        const sure = ai.confidence === 'high'
        setAiNote({
          tone: sure ? 'good' : 'warn',
          text: L(`ИИ определил: «${hit.name_ru}»${created ? ' — новый вид, добавил в список' : ''}${sure ? '' : ' (не уверен — проверьте)'}. ${note ? `${note}. ` : ''}${next}`,
            `ЖИ анықтады: «${hit.name_kk}»${created ? ' — жаңа түр, тізімге қостым' : ''}${sure ? '' : ' (сенімсіз — тексеріңіз)'}. ${next}`),
        })
        setTimeout(() => formRef.current?.querySelector<HTMLInputElement>('input[inputmode="decimal"]')?.focus(), 50)
      } else {
        setAiNote({ tone: 'warn', text: L(`ИИ не узнал отход${note ? `: ${note}` : ''}. Фото прикреплено — выберите вид ниже.`, 'ЖИ қалдықты танымады. Фото тіркелді — түрін төменнен таңдаңыз.') })
      }
    } catch (err) {
      setAiNote({ tone: 'bad', text: errText(err) })
    } finally { setAiBusy('') }
  }

  const toRows = (list: AiRows['entries'], withDates: boolean): BatchRow[] => list.map((e, i) => {
    const t = e.waste_type_id ? typeById.get(e.waste_type_id) : undefined
    return {
      key: `${Date.now()}-${i}`,
      typeId: t?.id ?? '',
      newName: t ? '' : (e.new_type_name ?? '').trim(),
      category: t?.category ?? e.new_type_category ?? 'avoidable',
      qty: e.quantity != null ? String(e.quantity).replace('.', ',') : '',
      reason: e.reason,
      date: withDates && e.entry_date ? e.entry_date : form.date,
    }
  })

  // 2. Голос или текст: «хлеб 3 кг, гарнир 2,5» → список строк.
  async function parseText() {
    if (!text.trim()) return
    setAiNote(null); setBatch(null)
    setAiBusy('text')
    const r = await invokeFn<AiRows>('ai', { mode: 'parse_text', text: text.trim(), types: aiTypes(types) })
    setAiBusy('')
    if (r.error !== undefined) return setAiNote({ tone: 'bad', text: aiFail(r.status, r.error) })
    setBatch({ kind: 'text', rows: toRows(r.data.entries ?? [], false), note: r.data.note_ru })
  }

  // 3. Фото бумажного журнала: ИИ переписывает таблицу в строки с датами.
  async function onJournal(file: File | undefined) {
    if (!file) return
    setAiNote(null); setBatch(null); setPanel('')
    let big = '', small = ''
    try {
      [big, small] = await Promise.all([compress(file, 1600, 0.75), compress(file)])
    } catch {
      return setAiNote({ tone: 'bad', text: L('Не удалось прочитать фото. Попробуйте ещё раз.', 'Фотоны оқу мүмкін болмады. Қайталап көріңіз.') })
    }
    setAiBusy('journal')
    const r = await invokeFn<AiRows>('ai', { mode: 'parse_journal', image: big, types: aiTypes(types) })
    setAiBusy('')
    if (r.error !== undefined) return setAiNote({ tone: 'bad', text: aiFail(r.status, r.error) })
    setBatch({ kind: 'journal', rows: toRows(r.data.entries ?? [], true), note: r.data.note_ru, photo: small })
  }

  async function saveBatch() {
    if (!batch || !report || !org) return
    const ok = batch.rows.filter((r) => rowState(r, period) === 'ok')
    if (ok.length === 0) return
    setError(''); setFlash(''); setSaving(true)
    try {
      const rows = []
      for (const r of ok) {
        const t = r.typeId ? typeById.get(r.typeId) ?? typesRef.current.find((x) => x.id === r.typeId) : await ensureType(r.newName, r.category)
        if (!t) continue
        const disposal = defaultDisposal(t)
        if (!disposal) throw new Error(L('В справочнике нет способов утилизации', 'Анықтамалықта кәдеге жарату тәсілі жоқ'))
        rows.push({
          report_id: report.id, org_id: org.id, entry_date: r.date, waste_type_id: t.id, quantity: Number(r.qty.replace(',', '.')),
          disposal_id: disposal, reason: fitReason(t.category, r.reason) || null,
          source: batch.kind === 'journal' ? 'photo' as const : 'manual' as const, has_photo: Boolean(batch.photo),
        })
      }
      const { data, error } = await supabase.from('entries').insert(rows).select('id')
      if (error) throw error
      if (batch.photo && data?.length) {
        await supabase.from('entry_photos').insert(data.map((d) => ({ entry_id: d.id, org_id: org.id, data: batch.photo })))
      }
      setFlash(L(`Сохранено записей: ${rows.length}`, `Сақталған жазба: ${rows.length}`))
      setBatch(null); setText(''); setPanel(''); setAiNote(null)
      await load()
    } catch (err) { setError(errText(err)) } finally { setSaving(false) }
  }

  function reset() {
    setForm({ typeId: '', qty: '', disposalId: '', reason: '', date: form.date })
    setPhoto(''); setEditingId(''); setSource('manual'); setAiNote(null)
    try { localStorage.removeItem(draftKey) } catch { /* хранилище недоступно */ }
  }

  async function save(auto = false) {
    if (!report || !org || !selected) return
    setError(''); setFlash('')
    const fromScale = auto && scale ? scale : null
    const qty = fromScale ? fromScale.weight : Number(form.qty.replace(',', '.'))
    const src: Entry['source'] = fromScale ? 'scale' : source
    const disposalId = form.disposalId || defaultDisposal(selected)
    if (!Number.isFinite(qty) || qty <= 0) return setError(L('Укажите количество больше нуля', 'Нөлден үлкен мөлшерді енгізіңіз'))
    if (qty > MAX_QTY) return setError(L(`Слишком большое значение: не больше ${MAX_QTY}`, `Мән тым үлкен: ${MAX_QTY}-ден аспауы тиіс`))
    if (form.date > today()) return setError(L('Дата не может быть в будущем', 'Күн болашақта болмауы тиіс'))
    if (form.date < period.start || form.date > period.end) return setError(L('Дата вне месяца этого отчёта', 'Күн осы есеп айынан тыс'))
    if (!disposalId) { setMore(true); return setError(L('Выберите способ утилизации', 'Кәдеге жарату тәсілін таңдаңыз')) }
    if (!auto) {
      const dup = entries.find((e) => e.id !== editingId && e.entry_date === form.date && e.waste_type_id === form.typeId && Number(e.quantity) === qty)
      if (dup && !confirm(L('Такая запись за этот день уже есть. Возможно, это дубль. Всё равно сохранить?', 'Бұл күнге осындай жазба бар. Қайталануы мүмкін. Сонда да сақтау керек пе?'))) return
    }

    setSaving(true)
    try {
      const row = {
        report_id: report.id, org_id: org.id, entry_date: form.date, waste_type_id: form.typeId, quantity: qty,
        disposal_id: disposalId, reason: form.reason || null, source: src, has_photo: Boolean(photo) || undefined,
      }
      if (editingId) {
        const { error } = await supabase.from('entries').update(row).eq('id', editingId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('entries').insert({ ...row, has_photo: Boolean(photo) }).select('id').single()
        if (error) throw error
        if (photo) await supabase.from('entry_photos').insert({ entry_id: data.id, org_id: org.id, data: photo })
      }
      if (fromScale) {
        supabase.from('scale_readings').update({ used: true }).eq('id', fromScale.id).then(() => undefined)
        setScale(null)
      }
      setFlash(L('Сохранено', 'Сақталды'))
      reset()
      await load()
    } catch (err) { setError(errText(err)) } finally { setSaving(false) }
  }
  const saveRef = useRef(save)
  saveRef.current = save

  // Автосохранение с весов: вес пришёл с весов и вид выбран → через 5 секунд запись сохранится сама.
  // Вес, введённый руками, никогда не сохраняется автоматически.
  const autoKey = editable && !editingId && selected && !saving && !batch
    ? scale ? `s${scale.id}|${form.typeId}` : source === 'scale' && form.qty ? `f${form.qty}|${form.typeId}` : ''
    : ''
  useEffect(() => {
    if (!autoKey || autoKey === cancelledKey) { setAutoLeft(0); return }
    const end = Date.now() + AUTO_MS
    setAutoLeft(AUTO_MS)
    const id = setInterval(() => {
      const left = end - Date.now()
      if (left > 0) return setAutoLeft(left)
      clearInterval(id); setAutoLeft(0); setCancelledKey(autoKey)
      saveRef.current(true)
    }, 100)
    return () => clearInterval(id)
  }, [autoKey, cancelledKey])

  async function remove(id: string) {
    if (!confirm(L('Удалить запись?', 'Жазбаны жою керек пе?'))) return
    const { error } = await supabase.from('entries').delete().eq('id', id)
    if (error) setError(errText(error)); else load()
  }

  function edit(e: Entry) {
    setEditingId(e.id); setPhoto(''); setSource(e.source); setBatch(null)
    setForm({ typeId: e.waste_type_id, qty: String(e.quantity), disposalId: e.disposal_id ?? '', reason: e.reason ?? '', date: e.entry_date })
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function savePortions(v: string) {
    setPortions(v)
    const n = Number(v)
    if (!org || !v || !Number.isInteger(n) || n < 0) return
    await supabase.from('daily_portions').upsert({ org_id: org.id, day: today(), portions: n })
  }

  async function submit() {
    if (!report) return
    const { error } = await supabase.rpc('submit_report', { p_report: report.id })
    setCheck(null)
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
  const dayEntries = entries.filter((e) => e.entry_date === form.date)
  // Только оформление: итог с «докручивающимися» числами и отметка только что добавленных строк.
  const totalFx = (t: { kg: number; l: number }) => <><CountUp value={t.kg} /> {unitLabel('kg')}{t.l ? <> + <CountUp value={t.l} /> {unitLabel('l')}</> : ''}</>
  const isFresh = useFreshIds(loading ? null : entries.map((e) => e.id))
  const saved = flash.startsWith(L('Сохранено', 'Сақтал')) || flash === L('Отчёт отправлен на проверку', 'Есеп тексеруге жіберілді')

  if (!org) return <Card>{L('Вам ещё не назначена организация. Обратитесь к администратору.', 'Сізге әлі ұйым тағайындалмаған. Әкімшіге хабарласыңыз.')}</Card>
  if (loading) return (
    <div className="mx-auto max-w-xl space-y-3" role="status" aria-busy="true" aria-label={L('Загрузка формы…', 'Форма жүктелуде…')}>
      <div className="fx-shimmer h-7 w-2/3" />
      <div className="fx-shimmer h-4 w-1/3" />
      <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i} className="fx-shimmer h-28" />)}</div>
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
        <div className="grid grid-cols-2 gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="fx-shimmer h-14" />)}</div>
        <div className="fx-shimmer h-[52px]" />
      </div>
    </div>
  )

  const reasonList = selected ? REASONS_BY_CATEGORY[selected.category] : []
  const disposalName = name(disposals.find((d) => d.id === (form.disposalId || (selected ? defaultDisposal(selected) : ''))))
  const summary = [
    form.date === today() ? L('сегодня', 'бүгін') : dmy(form.date),
    selected ? disposalName : null,
    form.reason ? L(...REASON[form.reason]) : null,
  ].filter(Boolean).join(' · ')
  const busyText: Record<string, string> = {
    photo: L('ИИ смотрит на фото…', 'ЖИ фотоны қарап жатыр…'),
    text: L('ИИ разбирает, что вы сказали…', 'ЖИ айтқаныңызды талдап жатыр…'),
    journal: L('ИИ читает журнал… это займёт до минуты', 'ЖИ журналды оқып жатыр… бір минутқа дейін'),
  }
  let checkBody: ReactNode = null
  if (check) {
    checkBody = (
      <Card className="fx-fade-up space-y-2 ring-2 ring-brand-300">
        <div className="font-semibold">{L('Проверка перед отправкой', 'Жіберер алдында тексеру')}</div>
        {check.reasons.length === 0
          ? <div className="text-sm text-emerald-800">✓ {L('Замечаний нет', 'Ескерту жоқ')}</div>
          : (
            <ul className="space-y-1 text-sm text-amber-900">
              {check.reasons.map((r, i) => <li key={i} className="flex gap-1.5"><span>⚠️</span><span>{L(r.ru, r.kk)}</span></li>)}
            </ul>
          )}
        <div className="text-xs text-slate-500">{L(`Отчёт за ${monthLabel(month, lang)}. После отправки записи менять нельзя.`, `${monthLabel(month, lang)} есебі. Жіберілгеннен кейін жазбаларды өзгертуге болмайды.`)}</div>
        <div className="flex gap-2">
          <Btn size="lg" className="fx-pop min-h-12 flex-1" onClick={submit}>{L('Отправить', 'Жіберу')}</Btn>
          <Btn size="lg" variant="ghost" className="min-h-12 flex-1" onClick={() => { setCheck(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>{L('Исправить', 'Түзету')}</Btn>
        </div>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
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
        <>
          <div>
            <div className="mb-1.5 text-sm font-medium text-slate-600">{L('Как удобнее записать отход?', 'Қалдықты қалай жазған ыңғайлы?')}</div>
            <div className="grid grid-cols-3 gap-2">
              <ActionCard icon={photo ? '✅' : '📷'} label={L('Сфотографировать', 'Суретке түсіру')} hint={L('ИИ узнает, что это', 'ЖИ не екенін таниды')}
                busy={aiBusy === 'photo'} active={Boolean(photo)} onClick={() => fileRef.current?.click()} />
              <ActionCard icon="🎤" label={L('Сказать или написать', 'Айту не жазу')} hint={L('«хлеб 3 кг»', '«нан 3 келі»')}
                busy={aiBusy === 'text'} active={panel === 'text'} onClick={() => { setPanel(panel === 'text' ? '' : 'text'); setBatch(null) }} />
              <ActionCard icon="📄" label={L('Бумажный журнал', 'Қағаз журнал')} hint={L('фото страницы', 'беттің суреті')}
                busy={aiBusy === 'journal'} active={batch?.kind === 'journal'} onClick={() => journalRef.current?.click()} />
            </div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = '' }} />
            <input ref={journalRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onJournal(e.target.files?.[0]); e.target.value = '' }} />
          </div>

          <AiLine busy={Boolean(aiBusy)} busyText={busyText[aiBusy] ?? ''} note={aiNote} />

          {panel === 'text' && (
            <Card className="fx-fade-up space-y-2">
              <label className="block text-sm font-medium text-slate-600" htmlFor="say">{L('Скажите или напишите, что и сколько выбросили', 'Не және қанша тасталғанын айтыңыз немесе жазыңыз')}</label>
              <div className="flex gap-2">
                <textarea id="say" rows={2} className={`${inputCls} min-w-0 flex-1 resize-none text-base`} value={text} onChange={(e) => setText(e.target.value)}
                  placeholder={L('например: хлеб 3 кг, гарнир 2,5', 'мысалы: нан 3 келі, гарнир 2,5')} />
                {speech.supported && (
                  <button onClick={() => speech.toggle(text)} aria-label={L('Говорить', 'Сөйлеу')}
                    className={`fx-pop w-14 shrink-0 rounded-xl text-2xl ring-1 ${speech.listening ? 'animate-pulse bg-rose-600 text-white ring-rose-600' : 'bg-slate-50 ring-slate-300'}`}>
                    {speech.listening ? '⏹' : '🎤'}
                  </button>
                )}
              </div>
              {speech.listening && <div className="text-xs text-rose-700">{L('Слушаю… говорите', 'Тыңдап тұрмын… сөйлеңіз')}</div>}
              {!batch && <Btn size="lg" className="fx-pop min-h-12 w-full" onClick={parseText} disabled={!text.trim() || aiBusy === 'text'}>{L('Разобрать', 'Талдау')}</Btn>}
            </Card>
          )}

          {batch && (
            <BatchPreview rows={batch.rows} types={types} period={period} withDates={batch.kind === 'journal'} note={batch.note} saving={saving}
              onChange={(rows) => setBatch({ ...batch, rows })} onSave={saveBatch} onCancel={() => setBatch(null)} />
          )}

          <div ref={formRef}>
            <Card className="space-y-3">
              {scale && !autoLeft && (
                <button onClick={useScale} className="fx-fade-up fx-pop flex min-h-12 w-full items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-left ring-1 ring-amber-300">
                  <span className="text-sm font-medium text-amber-900">⚖️ {L('С весов пришло', 'Таразыдан келді')}: <b>{num(scale.weight, 2)} {unitLabel('kg')}</b>
                    {!selected && <span className="block text-xs font-normal">{L('выберите вид — сохраню сам', 'түрін таңдаңыз — өзім сақтаймын')}</span>}</span>
                  <span className="shrink-0 text-sm font-semibold text-amber-800">{L('Подставить', 'Қою')}</span>
                </button>
              )}
              {autoLeft > 0 && selected && (
                <div role="status" className="fx-fade-up space-y-2 rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-300">
                  <div className="flex items-center justify-between gap-2 text-sm text-emerald-900">
                    <span>⚖️ <b>{name(selected)}</b> — {num(scale ? scale.weight : Number(form.qty.replace(',', '.')), 2)} {unitLabel(selected.unit)}. {L('Сохраню через', 'Сақтаймын:')} {Math.ceil(autoLeft / 1000)} {L('с', 'с')}</span>
                    <Btn size="sm" variant="ghost" onClick={() => setCancelledKey(autoKey)}>{L('Отменить', 'Болдырмау')}</Btn>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-emerald-100">
                    <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-100 ease-linear" style={{ width: `${(autoLeft / AUTO_MS) * 100}%` }} />
                  </div>
                </div>
              )}

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-600">{editingId ? L('Исправление записи', 'Жазбаны түзету') : L('Или выберите сами', 'Немесе өзіңіз таңдаңыз')}</span>
                  <button className="text-sm font-semibold text-brand-700" onClick={() => setNewType({ name: '', unit: 'kg', category: 'avoidable' })}>+ {L('новый вид', 'жаңа түр')}</button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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
                    <Btn size="sm" onClick={addType} disabled={!newType.name.trim()}>{L('Добавить в список', 'Тізімге қосу')}</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setNewType(null)}>{L('Отмена', 'Бас тарту')}</Btn>
                  </div>
                </div>
              )}

              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-600">{L('Сколько', 'Қанша')}, {unitLabel(selected?.unit)}</span>
                <input className={`${inputCls} text-2xl font-bold`} inputMode="decimal" placeholder="0,0" value={form.qty}
                  onChange={(e) => { setForm({ ...form, qty: e.target.value.replace(/[^0-9.,]/g, '') }); if (source === 'scale') setSource('manual') }} />
              </label>

              <div>
                <button className="text-sm text-slate-500 underline decoration-dotted underline-offset-4" onClick={() => setMore(!more)} aria-expanded={more}>
                  {more ? '▾' : '▸'} {L('Подробнее', 'Толығырақ')}: {summary}
                </button>
                {more && (
                  <div className="fx-fade-up mt-2 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block min-w-0">
                        <span className="mb-1 block text-sm font-medium text-slate-600">{L('Куда утилизировали', 'Қайда кәдеге жаратылды')}</span>
                        <select className={inputCls} value={form.disposalId} onChange={(e) => setForm({ ...form, disposalId: e.target.value })}>
                          <option value="">—</option>
                          {disposals.map((d) => <option key={d.id} value={d.id}>{name(d)}</option>)}
                        </select>
                      </label>
                      <label className="block min-w-0">
                        <span className="mb-1 block text-sm font-medium text-slate-600">{L('Дата', 'Күні')}</span>
                        <input type="date" className={inputCls} value={form.date} min={report?.period_start} max={isCurrentMonth ? today() : report?.period_end}
                          onChange={(e) => e.target.value && setForm({ ...form, date: e.target.value })} />
                      </label>
                    </div>
                    {reasonList.length > 1 && (
                      <div>
                        <span className="mb-1.5 block text-sm font-medium text-slate-600">{L('Почему выбросили', 'Неге тасталды')}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {reasonList.map((r) => (
                            <button key={r} onClick={() => setForm({ ...form, reason: form.reason === r ? '' : r })}
                              className={`fx-pop min-h-10 rounded-full px-3 py-1.5 text-sm ring-1 ${form.reason === r ? 'bg-wheat text-white ring-wheat' : 'bg-white text-slate-700 ring-slate-300'}`}>
                              {L(...REASON[r])}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Btn size="lg" className="fx-pop min-h-14 flex-1" onClick={() => save(Boolean(scale && !form.qty))} disabled={saving || !form.typeId || (!form.qty && !autoLeft)}>
                  {editingId ? L('Сохранить изменения', 'Өзгерістерді сақтау') : L('Сохранить', 'Сақтау')}
                </Btn>
                {(editingId || form.typeId) && <Btn size="lg" variant="ghost" className="fx-pop min-h-14" onClick={reset} aria-label={L('Очистить', 'Тазалау')}>✕</Btn>}
              </div>
              <p className="text-center text-xs text-slate-400">{L('Ответственный', 'Жауапты')}: {profile?.full_name} · {L('черновик сохраняется автоматически', 'жоба автоматты түрде сақталады')}</p>
            </Card>
          </div>
        </>
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
                <div className="truncate text-xs text-slate-500">
                  {name(disposals.find((d) => d.id === e.disposal_id))}
                  {e.has_photo && ' · 📷'}{e.source === 'scale' && ' · ⚖️'}{e.source === 'photo' && ' · ИИ'}
                </div>
              </div>
              <div className="font-bold tabular-nums">{num(Number(e.quantity), 2)} {unitLabel(t?.unit)}</div>
              {editable && (
                <>
                  <button className="rounded-lg px-2 py-1 text-slate-500 ring-1 ring-slate-200" onClick={() => edit(e)} aria-label={L('Исправить', 'Түзету')}>✎</button>
                  <button className="rounded-lg px-2 py-1 text-rose-600 ring-1 ring-rose-200" onClick={() => remove(e.id)} aria-label={L('Удалить', 'Жою')}>🗑</button>
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

      {editable && !check && report && (
        <Btn size="lg" variant="soft" className="fx-pop min-h-12 w-full" disabled={entries.length === 0}
          onClick={() => setCheck(trustIndex(entries, report, new Map(), org.type === 'lab'))}>
          {L('Отправить отчёт на проверку', 'Есепті тексеруге жіберу')} →
        </Btn>
      )}
      {editable && checkBody}
      <div className="flex items-center justify-between text-sm">
        <Link to="/reports" className="font-medium text-brand-700">{L('Все отчёты и история', 'Барлық есептер мен тарих')}</Link>
        {!isCurrentMonth && <Link to="/entry" className="text-slate-500">{L('К текущему месяцу', 'Ағымдағы айға')}</Link>}
        <Pill>{entries.length} {L('записей', 'жазба')}</Pill>
      </div>
    </div>
  )
}
