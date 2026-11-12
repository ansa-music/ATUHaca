import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useState } from 'react'
import { Btn, Card, ErrorBox, PageTitle, Pill, Spinner, inputCls } from '../components/ui'
import { CATEGORY, ORG_TYPE, ROLE, useLang } from '../lib/i18n'
import { errText, supabase } from '../lib/supabase'
import type { Category, Disposal, Org, Profile, Role, WasteType } from '../lib/types'

type Tab = 'orgs' | 'users' | 'waste' | 'disposal'
const cell = `${inputCls} !py-1.5 text-sm`

/** Администрирование: организации (с QR-кодами форм), пользователи, справочники. Новые организации подключаются без изменения кода. */
export default function AdminPage() {
  const { L, name } = useLang()
  const [tab, setTab] = useState<Tab>('orgs')
  const [orgs, setOrgs] = useState<Org[]>([])
  const [users, setUsers] = useState<Profile[]>([])
  const [waste, setWaste] = useState<WasteType[]>([])
  const [disposal, setDisposal] = useState<Disposal[]>([])
  const [tokens, setTokens] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qr, setQr] = useState<Org | null>(null)
  const [newOrg, setNewOrg] = useState({ name_ru: '', name_kk: '', type: 'canteen', building: '' })
  const [newWaste, setNewWaste] = useState({ org_id: '', name_ru: '', name_kk: '', unit: 'kg', category: 'avoidable' as Category })
  const [newDisp, setNewDisp] = useState({ name_ru: '', name_kk: '', diverts: false })
  const [wasteOrg, setWasteOrg] = useState('')

  const load = useCallback(async () => {
    const [o, u, w, d, s] = await Promise.all([
      supabase.from('organizations').select('*').order('created_at'),
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('waste_types').select('*').order('created_at'),
      supabase.from('disposal_methods').select('*').order('name_ru'),
      supabase.from('org_secrets').select('*'),
    ])
    setOrgs((o.data ?? []) as Org[]); setUsers((u.data ?? []) as Profile[])
    setWaste((w.data ?? []) as WasteType[]); setDisposal((d.data ?? []) as Disposal[])
    setTokens(new Map((s.data ?? []).map((x) => [x.org_id as string, x.scale_token as string])))
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function run(p: PromiseLike<{ error: unknown }>) {
    setError('')
    const { error } = await p
    if (error) setError(errText(error)); else await load()
  }

  async function addOrg() {
    setError('')
    const { data, error } = await supabase.from('organizations').insert({ ...newOrg, name_kk: newOrg.name_kk || newOrg.name_ru }).select('id').single()
    if (error) return setError(errText(error))
    await supabase.from('org_secrets').insert({ org_id: data.id })
    setNewOrg({ name_ru: '', name_kk: '', type: 'canteen', building: '' })
    load()
  }

  if (loading) return <Spinner />
  const origin = window.location.origin
  const formUrl = (o: Org) => (o.is_demo ? `${origin}/login?guest=1` : `${origin}/entry?org=${o.id}`)
  const tabs: [Tab, string][] = [['orgs', L('Организации', 'Ұйымдар')], ['users', L('Пользователи', 'Пайдаланушылар')], ['waste', L('Виды отходов', 'Қалдық түрлері')], ['disposal', L('Способы утилизации', 'Кәдеге жарату тәсілдері')]]

  return (
    <div>
      <PageTitle title={L('Управление системой', 'Жүйені басқару')} />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${tab === k ? 'bg-brand-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300'}`}>{label}</button>
        ))}
      </div>
      <div className="mb-3"><ErrorBox>{error}</ErrorBox></div>

      {tab === 'orgs' && (
        <div className="space-y-3">
          <Card>
            <h2 className="mb-2 font-bold">{L('Подключить новую организацию', 'Жаңа ұйымды қосу')}</h2>
            <div className="grid gap-2 md:grid-cols-5">
              <input className={cell} placeholder={L('Название (рус.)', 'Атауы (орыс.)')} value={newOrg.name_ru} onChange={(e) => setNewOrg({ ...newOrg, name_ru: e.target.value })} />
              <input className={cell} placeholder={L('Название (каз.)', 'Атауы (қаз.)')} value={newOrg.name_kk} onChange={(e) => setNewOrg({ ...newOrg, name_kk: e.target.value })} />
              <select className={cell} value={newOrg.type} onChange={(e) => setNewOrg({ ...newOrg, type: e.target.value })}>
                {Object.entries(ORG_TYPE).map(([k, v]) => <option key={k} value={k}>{L(...v)}</option>)}
              </select>
              <input className={cell} placeholder={L('Корпус / адрес', 'Корпус / мекенжай')} value={newOrg.building} onChange={(e) => setNewOrg({ ...newOrg, building: e.target.value })} />
              <Btn size="sm" onClick={addOrg} disabled={!newOrg.name_ru.trim()}>+ {L('Добавить', 'Қосу')}</Btn>
            </div>
          </Card>
          {orgs.map((o) => (
            <Card key={o.id} className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{name(o)} {o.is_demo && <Pill tone="blue">{L('демо', 'демо')}</Pill>} {!o.is_active && <Pill tone="rose">{L('отключена', 'өшірілген')}</Pill>}</div>
                <div className="text-sm text-slate-500">
                  {L(...(ORG_TYPE[o.type] ?? ORG_TYPE.other))}{o.building ? ` · ${o.building}` : ''} · {L('ответственные', 'жауаптылар')}: {users.filter((u) => u.org_id === o.id).map((u) => u.full_name || u.email).join(', ') || '—'}
                </div>
              </div>
              <Btn size="sm" variant="soft" onClick={() => setQr(o)}>QR {L('формы', 'форма')}</Btn>
              {tokens.get(o.id) && <a className="text-sm font-medium text-brand-700" href={`/scale-sim?token=${tokens.get(o.id)}`} target="_blank" rel="noreferrer">⚖️ {L('весы', 'таразы')}</a>}
              <Btn size="sm" variant="ghost" onClick={() => run(supabase.from('organizations').update({ is_active: !o.is_active }).eq('id', o.id))}>{o.is_active ? L('Отключить', 'Өшіру') : L('Включить', 'Қосу')}</Btn>
            </Card>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <Card className="!p-0">
          <p className="border-b border-slate-100 px-4 py-2.5 text-sm text-slate-500">{L('Пользователь регистрируется сам, администратор назначает роль и организацию. Пароли хранятся только в виде хэша.', 'Пайдаланушы өзі тіркеледі, әкімші рөл мен ұйымды тағайындайды. Құпиясөздер тек хэш түрінде сақталады.')}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-slate-500"><th className="px-4 py-2 text-left font-medium">{L('ФИО', 'ТАӘ')}</th><th className="px-3 py-2 text-left font-medium">E-mail</th><th className="px-3 py-2 text-left font-medium">{L('Роль', 'Рөл')}</th><th className="px-4 py-2 text-left font-medium">{L('Организация', 'Ұйым')}</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-slate-100">
                    <td className="px-4 py-1.5">{u.full_name || '—'}</td>
                    <td className="px-3 py-1.5 text-slate-600">{u.email}</td>
                    <td className="px-3 py-1.5">
                      <select className={cell} value={u.role} onChange={(e) => run(supabase.from('profiles').update({ role: e.target.value as Role, org_id: e.target.value === 'responsible' ? u.org_id : null }).eq('id', u.id))}>
                        {(Object.keys(ROLE) as Role[]).map((r) => <option key={r} value={r}>{L(...ROLE[r])}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-1.5">
                      <select className={cell} value={u.org_id ?? ''} disabled={u.role !== 'responsible'} onChange={(e) => run(supabase.from('profiles').update({ org_id: e.target.value || null }).eq('id', u.id))}>
                        <option value="">—</option>
                        {orgs.map((o) => <option key={o.id} value={o.id}>{name(o)}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === 'waste' && (
        <div className="space-y-3">
          <Card>
            <h2 className="mb-2 font-bold">{L('Добавить вид отхода', 'Қалдық түрін қосу')}</h2>
            <div className="grid gap-2 md:grid-cols-6">
              <select className={cell} value={newWaste.org_id} onChange={(e) => setNewWaste({ ...newWaste, org_id: e.target.value })}>
                <option value="">{L('Общий для всех', 'Барлығына ортақ')}</option>
                {orgs.map((o) => <option key={o.id} value={o.id}>{name(o)}</option>)}
              </select>
              <input className={cell} placeholder={L('Название (рус.)', 'Атауы (орыс.)')} value={newWaste.name_ru} onChange={(e) => setNewWaste({ ...newWaste, name_ru: e.target.value })} />
              <input className={cell} placeholder={L('Название (каз.)', 'Атауы (қаз.)')} value={newWaste.name_kk} onChange={(e) => setNewWaste({ ...newWaste, name_kk: e.target.value })} />
              <select className={cell} value={newWaste.unit} onChange={(e) => setNewWaste({ ...newWaste, unit: e.target.value })}><option value="kg">кг</option><option value="l">л</option></select>
              <select className={cell} value={newWaste.category} onChange={(e) => setNewWaste({ ...newWaste, category: e.target.value as Category })}>
                {(Object.keys(CATEGORY) as Category[]).map((c) => <option key={c} value={c}>{L(...CATEGORY[c])}</option>)}
              </select>
              <Btn size="sm" disabled={!newWaste.name_ru.trim()} onClick={async () => {
                await run(supabase.from('waste_types').insert({ ...newWaste, org_id: newWaste.org_id || null, name_kk: newWaste.name_kk || newWaste.name_ru, co2_factor: newWaste.category === 'packaging' ? 0 : 2.5, recyclable: newWaste.category === 'packaging', default_disposal_id: disposal[0]?.id ?? null }))
                setNewWaste({ ...newWaste, name_ru: '', name_kk: '' })
              }}>+ {L('Добавить', 'Қосу')}</Btn>
            </div>
          </Card>
          <select className={`${cell} !w-auto`} value={wasteOrg} onChange={(e) => setWasteOrg(e.target.value)}>
            <option value="">{L('Все организации', 'Барлық ұйымдар')}</option>
            {orgs.map((o) => <option key={o.id} value={o.id}>{name(o)}</option>)}
          </select>
          <Card className="!p-0">
            <p className="border-b border-slate-100 px-4 py-2.5 text-sm text-slate-500">{L('Вид отхода с записями нельзя удалить — только отключить. Коэффициент CO₂ и цена потери используются в аналитике.', 'Жазбалары бар қалдық түрін жоюға болмайды — тек өшіруге болады. CO₂ коэффициенті мен шығын бағасы аналитикада қолданылады.')}</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-slate-500">
                  <th className="px-4 py-2 text-left font-medium">{L('Вид отхода', 'Қалдық түрі')}</th><th className="px-2 py-2 text-left font-medium">{L('Ед.', 'Бірл.')}</th>
                  <th className="px-2 py-2 text-left font-medium">{L('Категория', 'Санат')}</th><th className="px-2 py-2 text-left font-medium">{L('Способ по умолчанию', 'Әдепкі тәсіл')}</th>
                  <th className="px-2 py-2 text-center font-medium">♻️</th><th className="px-2 py-2 text-left font-medium">CO₂/кг</th><th className="px-2 py-2 text-left font-medium">₸/{L('ед.', 'бірл.')}</th><th className="px-4 py-2" />
                </tr></thead>
                <tbody>
                  {waste.filter((w) => !wasteOrg || w.org_id === wasteOrg).map((w) => {
                    const upd = (patch: Partial<WasteType>) => run(supabase.from('waste_types').update(patch).eq('id', w.id))
                    return (
                      <tr key={w.id} className={`border-t border-slate-100 ${w.is_active ? '' : 'opacity-50'}`}>
                        <td className="px-4 py-1.5"><div className="font-medium">{name(w)}</div><div className="text-xs text-slate-500">{name(orgs.find((o) => o.id === w.org_id)) === '—' ? L('общий', 'ортақ') : name(orgs.find((o) => o.id === w.org_id))}</div></td>
                        <td className="px-2 py-1.5">{w.unit === 'l' ? 'л' : 'кг'}</td>
                        <td className="px-2 py-1.5"><select className={cell} value={w.category} onChange={(e) => upd({ category: e.target.value as Category })}>{(Object.keys(CATEGORY) as Category[]).map((c) => <option key={c} value={c}>{L(...CATEGORY[c])}</option>)}</select></td>
                        <td className="px-2 py-1.5"><select className={cell} value={w.default_disposal_id ?? ''} onChange={(e) => upd({ default_disposal_id: e.target.value || null })}><option value="">—</option>{disposal.map((d) => <option key={d.id} value={d.id}>{name(d)}</option>)}</select></td>
                        <td className="px-2 py-1.5 text-center"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={w.recyclable} onChange={(e) => upd({ recyclable: e.target.checked })} /></td>
                        <td className="px-2 py-1.5"><input className={`${cell} !w-20`} defaultValue={w.co2_factor} inputMode="decimal" onBlur={(e) => Number(e.target.value) !== Number(w.co2_factor) && upd({ co2_factor: Number(e.target.value.replace(',', '.')) || 0 })} /></td>
                        <td className="px-2 py-1.5"><input className={`${cell} !w-24`} defaultValue={w.cost_per_unit} inputMode="decimal" onBlur={(e) => Number(e.target.value) !== Number(w.cost_per_unit) && upd({ cost_per_unit: Number(e.target.value.replace(',', '.')) || 0 })} /></td>
                        <td className="px-4 py-1.5 text-right"><Btn size="sm" variant="ghost" onClick={() => upd({ is_active: !w.is_active })}>{w.is_active ? L('Отключить', 'Өшіру') : L('Включить', 'Қосу')}</Btn></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'disposal' && (
        <div className="space-y-3">
          <Card>
            <div className="grid gap-2 md:grid-cols-4">
              <input className={cell} placeholder={L('Название (рус.)', 'Атауы (орыс.)')} value={newDisp.name_ru} onChange={(e) => setNewDisp({ ...newDisp, name_ru: e.target.value })} />
              <input className={cell} placeholder={L('Название (каз.)', 'Атауы (қаз.)')} value={newDisp.name_kk} onChange={(e) => setNewDisp({ ...newDisp, name_kk: e.target.value })} />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={newDisp.diverts} onChange={(e) => setNewDisp({ ...newDisp, diverts: e.target.checked })} />{L('уводит от захоронения', 'көмуден алып кетеді')}</label>
              <Btn size="sm" disabled={!newDisp.name_ru.trim()} onClick={async () => { await run(supabase.from('disposal_methods').insert({ ...newDisp, name_kk: newDisp.name_kk || newDisp.name_ru })); setNewDisp({ name_ru: '', name_kk: '', diverts: false }) }}>+ {L('Добавить', 'Қосу')}</Btn>
            </div>
          </Card>
          <Card className="!p-0">
            {disposal.map((d) => (
              <div key={d.id} className={`flex items-center gap-3 border-t border-slate-100 px-4 py-2.5 first:border-t-0 ${d.is_active ? '' : 'opacity-50'}`}>
                <span className="flex-1 font-medium">{name(d)}</span>
                {d.diverts ? <Pill tone="green">♻️ {L('переработка', 'қайта өңдеу')}</Pill> : <Pill>{L('захоронение', 'көму')}</Pill>}
                <Btn size="sm" variant="ghost" onClick={() => run(supabase.from('disposal_methods').update({ is_active: !d.is_active }).eq('id', d.id))}>{d.is_active ? L('Отключить', 'Өшіру') : L('Включить', 'Қосу')}</Btn>
              </div>
            ))}
          </Card>
        </div>
      )}

      {qr && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setQr(null)}>
          <div className="rounded-2xl bg-white p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 text-lg font-bold">{name(qr)}</div>
            <div className="mb-4 text-sm text-slate-500">{qr.is_demo ? L('Вход гостя жюри одной кнопкой', 'Қазылар алқасы қонағының бір батырмамен кіруі') : L('Наведите камеру — откроется форма ввода', 'Камераны бағыттаңыз — енгізу формасы ашылады')}</div>
            <QRCodeSVG value={formUrl(qr)} size={260} includeMargin />
            <div className="mt-3 max-w-[280px] break-all text-xs text-slate-500">{formUrl(qr)}</div>
            <div className="no-print mt-4 flex justify-center gap-2"><Btn size="sm" onClick={() => window.print()}>{L('Печать', 'Басып шығару')}</Btn><Btn size="sm" variant="ghost" onClick={() => setQr(null)}>{L('Закрыть', 'Жабу')}</Btn></div>
          </div>
        </div>
      )}
    </div>
  )
}
