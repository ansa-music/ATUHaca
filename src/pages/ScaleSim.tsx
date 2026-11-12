import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Btn, Card, ErrorBox } from '../components/ui'
import { num } from '../lib/format'
import { errText, supabase } from '../lib/supabase'

/**
 * Симулятор электронных весов (стык с Треком 2).
 * Настоящие весы делают то же самое: вызывают push_scale_reading с токеном организации и весом.
 */
export default function ScaleSim() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [weight, setWeight] = useState(3.4)
  const [sent, setSent] = useState<number[]>([])
  const [error, setError] = useState('')

  async function send(w: number) {
    setError('')
    const { error } = await supabase.rpc('push_scale_reading', { p_token: token, p_weight: w })
    if (error) setError(errText(error)); else setSent((s) => [w, ...s].slice(0, 5))
  }

  return (
    <div className="grid min-h-full place-items-center bg-slate-900 p-4">
      <Card className="w-full max-w-sm text-center">
        <div className="text-sm font-semibold uppercase tracking-widest text-slate-400">Электронные весы · симулятор</div>
        <div className="my-4 rounded-2xl bg-slate-900 py-6 font-mono text-6xl font-bold text-emerald-400">{weight.toFixed(2)}<span className="text-2xl"> кг</span></div>
        <input type="range" min={0.1} max={25} step={0.05} value={weight} onChange={(e) => setWeight(Number(e.target.value))} className="w-full accent-emerald-600" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Btn variant="ghost" onClick={() => setWeight(Number((0.3 + Math.random() * 12).toFixed(2)))}>Положить груз</Btn>
          <Btn onClick={() => send(weight)} disabled={!token}>Отправить вес</Btn>
        </div>
        <div className="mt-3"><ErrorBox>{error || (!token && 'В ссылке нет токена весов. Откройте симулятор из раздела «Управление».')}</ErrorBox></div>
        {sent.length > 0 && <p className="mt-3 text-sm text-slate-500">Отправлено: {sent.map((s) => `${num(s, 2)} кг`).join(' · ')}</p>}
        <p className="mt-3 text-xs text-slate-400">POST /rest/v1/rpc/push_scale_reading · {'{ p_token, p_weight }'}</p>
      </Card>
    </div>
  )
}
