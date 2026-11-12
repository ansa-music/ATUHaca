import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Btn, Card, ErrorBox, Field, inputCls } from '../components/ui'
import { LangSwitch } from '../components/Layout'
import { useLang } from '../lib/i18n'
import { errText, isConfigured, supabase } from '../lib/supabase'

// Гостевая учётная запись жюри: доступ только к «Демо-точке жюри», пароль намеренно публичный.
const GUEST = { email: 'jury@qadir.kz', password: 'qadir-guest' }

export default function Login() {
  const { L } = useLang()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(''); setInfo('')
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: fullName.trim() } } })
        if (error) throw error
        if (!data.session) setInfo(L('Заявка создана. Подтвердите e-mail, затем войдите.', 'Өтінім жасалды. E-mail-ді растап, содан кейін кіріңіз.'))
      }
    } catch (err) {
      const m = errText(err)
      setError(m.includes('Invalid login') ? L('Неверный e-mail или пароль', 'E-mail немесе құпиясөз қате') : m)
    } finally { setBusy(false) }
  }

  async function guest() {
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword(GUEST)
    if (error) setError(errText(error))
    setBusy(false)
  }

  return (
    <div className="flex min-h-full flex-col bg-brand-800">
      <div className="flex justify-end p-4"><LangSwitch /></div>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 pb-10">
        <div className="mb-6 text-center text-white">
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-wheat text-4xl shadow-lg">🌾</div>
          <h1 className="text-4xl font-bold tracking-tight">Qadir</h1>
          <p className="mt-1 text-white/80">{L('Нанның қадірі — учёт и сокращение пищевых отходов АТУ', 'Нанның қадірі — АТУ тағам қалдықтарын есепке алу және азайту')}</p>
        </div>

        <Card>
          {!isConfigured && (
            <div className="mb-3"><ErrorBox>{L('Не задано подключение к Supabase: заполните .env.local', 'Supabase қосылымы берілмеген: .env.local толтырыңыз')}</ErrorBox></div>
          )}
          {params.get('guest') !== null && (
            <div className="mb-4">
              <Btn size="lg" className="w-full" onClick={guest} disabled={busy}>{L('Войти как гость жюри', 'Қазылар алқасының қонағы ретінде кіру')}</Btn>
              <div className="mt-3 text-center text-xs text-slate-400">{L('или обычный вход', 'немесе әдеттегі кіру')}</div>
            </div>
          )}
          <form onSubmit={submit} className="space-y-3">
            {mode === 'up' && (
              <Field label={L('ФИО', 'ТАӘ')}>
                <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
              </Field>
            )}
            <Field label="E-mail">
              <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" inputMode="email" />
            </Field>
            <Field label={L('Пароль', 'Құпиясөз')}>
              <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
            </Field>
            <ErrorBox>{error}</ErrorBox>
            {info && <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</div>}
            <Btn type="submit" size="lg" className="w-full" disabled={busy}>
              {mode === 'in' ? L('Войти', 'Кіру') : L('Зарегистрироваться', 'Тіркелу')}
            </Btn>
          </form>
          <button className="mt-3 w-full text-center text-sm text-brand-700" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError('') }}>
            {mode === 'in' ? L('Нет учётной записи? Регистрация', 'Тіркелгі жоқ па? Тіркелу') : L('Уже есть учётная запись? Войти', 'Тіркелгі бар ма? Кіру')}
          </button>
          {mode === 'up' && (
            <p className="mt-2 text-center text-xs text-slate-500">
              {L('Роль и организацию после регистрации назначает администратор.', 'Тіркелгеннен кейін рөл мен ұйымды әкімші тағайындайды.')}
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}
