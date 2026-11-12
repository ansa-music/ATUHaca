import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Btn, Card, ErrorBox, PageTitle, Pill, Spinner, inputCls } from '../components/ui'
import { useAuth } from '../lib/auth'
import { kzt } from '../lib/format'
import { useLang } from '../lib/i18n'
import { errText, supabase } from '../lib/supabase'

export interface Offer {
  id: string; org_id: string; title: string; portions: number; price: number; old_price: number
  available_until: string; sold: number; is_active: boolean
}

const hm = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })

/** «Спасённые порции»: точка питания выставляет остатки дня со скидкой — еда продаётся, а не выбрасывается. */
export default function OffersPage() {
  const { org } = useAuth()
  const { L } = useLang()
  const [offers, setOffers] = useState<Offer[] | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: '', portions: '5', old_price: '', price: '', until: '18:00' })

  const load = useCallback(async () => {
    if (!org) return
    const { data, error } = await supabase.from('surplus_offers').select('*').eq('org_id', org.id).order('created_at', { ascending: false }).limit(30)
    if (error) setError(errText(error)); else setOffers((data ?? []) as Offer[])
  }, [org])

  useEffect(() => {
    load()
    if (!org) return
    const ch = supabase.channel(`offers-${org.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'surplus_offers' }, () => load()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [org, load])

  async function add() {
    if (!org) return
    setError('')
    const [h, m] = form.until.split(':').map(Number)
    const until = new Date(); until.setHours(h, m, 0, 0)
    if (until <= new Date()) return setError(L('Время окончания уже прошло', 'Аяқталу уақыты өтіп кетті'))
    const { error } = await supabase.from('surplus_offers').insert({
      org_id: org.id, title: form.title.trim(), portions: Number(form.portions), old_price: Number(form.old_price), price: Number(form.price), available_until: until.toISOString(),
    })
    if (error) return setError(errText(error))
    setForm({ ...form, title: '', old_price: '', price: '' }); load()
  }

  if (!org) return <Card>{L('Организация не назначена.', 'Ұйым тағайындалмаған.')}</Card>
  if (!offers) return <Spinner />
  const sold = offers.reduce((s, o) => s + o.sold, 0)
  const revenue = offers.reduce((s, o) => s + o.sold * Number(o.price), 0)

  return (
    <div className="mx-auto max-w-xl space-y-3">
      <PageTitle title={L('Спасённые порции', 'Сақталған порциялар')} sub={L('Выставьте остатки дня со скидкой — студенты увидят их на открытой странице', 'Күн соңындағы қалдықты жеңілдікпен шығарыңыз — студенттер оны ашық беттен көреді')} />
      <div className="grid grid-cols-2 gap-3">
        <Card className="!p-3.5"><div className="text-xs uppercase tracking-wide text-slate-500">{L('Спасено порций', 'Сақталған порция')}</div><div className="mt-1 text-2xl font-bold text-emerald-700">{sold}</div></Card>
        <Card className="!p-3.5"><div className="text-xs uppercase tracking-wide text-slate-500">{L('Выручка вместо отходов', 'Қалдықтың орнына түсім')}</div><div className="mt-1 text-2xl font-bold text-emerald-700">{kzt(revenue)}</div></Card>
      </div>

      <Card className="space-y-2">
        <h2 className="font-bold">{L('Выставить остатки', 'Қалдықты шығару')}</h2>
        <input className={inputCls} placeholder={L('Блюдо, например «Плов, порция»', 'Тағам, мысалы «Палау, порция»')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <div className="grid grid-cols-4 gap-2">
          <label className="text-xs text-slate-500">{L('Порций', 'Порция')}<input className={`${inputCls} mt-1`} inputMode="numeric" value={form.portions} onChange={(e) => setForm({ ...form, portions: e.target.value.replace(/\D/g, '') })} /></label>
          <label className="text-xs text-slate-500">{L('Было, ₸', 'Болған, ₸')}<input className={`${inputCls} mt-1`} inputMode="numeric" value={form.old_price} onChange={(e) => setForm({ ...form, old_price: e.target.value.replace(/\D/g, '') })} /></label>
          <label className="text-xs text-slate-500">{L('Стало, ₸', 'Жаңа, ₸')}<input className={`${inputCls} mt-1`} inputMode="numeric" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/\D/g, '') })} /></label>
          <label className="text-xs text-slate-500">{L('До', 'Дейін')}<input type="time" className={`${inputCls} mt-1`} value={form.until} onChange={(e) => setForm({ ...form, until: e.target.value })} /></label>
        </div>
        <ErrorBox>{error}</ErrorBox>
        <Btn className="w-full" onClick={add} disabled={!form.title.trim() || !Number(form.portions) || !form.price || !form.old_price}>{L('Выставить', 'Шығару')}</Btn>
        <p className="text-xs text-slate-500">{L('Только продукция в пределах срока годности и только в день приготовления.', 'Тек жарамдылық мерзімі ішіндегі өнім және тек дайындалған күні.')}</p>
      </Card>

      <Card className="!p-0">
        {offers.map((o) => {
          const live = o.is_active && new Date(o.available_until) > new Date() && o.sold < o.portions
          return (
            <div key={o.id} className="flex items-center gap-3 border-t border-slate-100 px-4 py-2.5 first:border-t-0">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{o.title}</div>
                <div className="text-xs text-slate-500">{kzt(Number(o.price))} <s>{kzt(Number(o.old_price))}</s> · {L('до', 'дейін')} {hm(o.available_until)} · {L('продано', 'сатылды')} {o.sold}/{o.portions}</div>
              </div>
              {live ? <Pill tone="green">{L('в продаже', 'сатылымда')}</Pill> : <Pill>{L('завершено', 'аяқталды')}</Pill>}
              {live && <Btn size="sm" variant="ghost" onClick={async () => { await supabase.from('surplus_offers').update({ is_active: false }).eq('id', o.id); load() }}>{L('Снять', 'Алу')}</Btn>}
            </div>
          )
        })}
        {offers.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-400">{L('Пока ничего не выставлено', 'Әзірге ештеңе шығарылмаған')}</div>}
      </Card>
      <Link to="/rescue" className="block text-center text-sm font-medium text-brand-700">{L('Открытая страница для студентов', 'Студенттерге арналған ашық бет')} →</Link>
    </div>
  )
}
