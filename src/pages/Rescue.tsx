import { useCallback, useEffect, useState } from 'react'
import { LangSwitch } from '../components/Layout'
import { Btn, Card, Pill } from '../components/ui'
import { kzt } from '../lib/format'
import { useLang } from '../lib/i18n'
import { errText, supabase } from '../lib/supabase'
import type { Org } from '../lib/types'
import type { Offer } from './Offers'

/** Открытая страница без входа: что сегодня можно купить со скидкой вместо того, чтобы это выбросили. */
export default function RescuePage() {
  const { L, name } = useLang()
  const [offers, setOffers] = useState<Offer[]>([])
  const [orgs, setOrgs] = useState<Map<string, Org>>(new Map())
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [o, g] = await Promise.all([
      supabase.from('surplus_offers').select('*').eq('is_active', true).gt('available_until', new Date().toISOString()).order('available_until'),
      supabase.from('organizations').select('*'),
    ])
    setOffers(((o.data ?? []) as Offer[]).filter((x) => x.sold < x.portions))
    setOrgs(new Map(((g.data ?? []) as Org[]).map((x) => [x.id, x])))
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('rescue').on('postgres_changes', { event: '*', schema: 'public', table: 'surplus_offers' }, () => load()).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  async function claim(o: Offer) {
    const { error } = await supabase.rpc('claim_offer', { p_offer: o.id })
    setMsg(error ? errText(error) : L(`Порция «${o.title}» за вами. Покажите этот экран на кассе.`, `«${o.title}» порциясы сізге бекітілді. Осы экранды кассада көрсетіңіз.`))
    load()
  }

  return (
    <div className="min-h-full bg-brand-800">
      <div className="mx-auto max-w-md px-4 py-5">
        <div className="mb-5 flex items-center justify-between text-white">
          <div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-lg bg-wheat text-xl">🌾</span><span className="text-xl font-bold">Qadir</span></div>
          <LangSwitch />
        </div>
        <h1 className="text-3xl font-bold leading-tight text-white">{L('Спасённые порции', 'Сақталған порциялар')}</h1>
        <p className="mb-4 mt-1 text-white/80">{L('Свежая еда столовых АТУ со скидкой в конце дня. Купил — значит, не выбросили.', 'АТУ асханаларының жаңа тағамы күн соңында жеңілдікпен. Сатып алдыңыз — демек, тасталмады.')}</p>
        {msg && <div className="mb-3 rounded-xl bg-white px-3 py-2 text-sm font-medium text-brand-800">{msg}</div>}
        <div className="space-y-3">
          {offers.map((o) => (
            <Card key={o.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-bold leading-tight">{o.title}</div>
                  <div className="text-sm text-slate-500">{name(orgs.get(o.org_id))}</div>
                </div>
                <Pill tone="rose">−{Math.round((1 - Number(o.price) / Number(o.old_price)) * 100)}%</Pill>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <span className="text-2xl font-bold text-brand-700">{kzt(Number(o.price))}</span> <s className="text-slate-400">{kzt(Number(o.old_price))}</s>
                  <div className="text-xs text-slate-500">{L('осталось', 'қалды')} {o.portions - o.sold} · {L('до', 'дейін')} {new Date(o.available_until).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <Btn onClick={() => claim(o)}>{L('Забрать', 'Алу')}</Btn>
              </div>
            </Card>
          ))}
          {offers.length === 0 && <Card className="text-center text-slate-500">{L('Сейчас предложений нет. Загляните ближе к концу дня.', 'Қазір ұсыныс жоқ. Күн соңына қарай қайта кіріңіз.')}</Card>}
        </div>
      </div>
    </div>
  )
}
