import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import { Btn, Card, ErrorBox, Field, inputCls } from '../components/ui'
import { Icon, Logo, type IconName } from '../components/Icon'
import { LangSwitch } from '../components/Layout'
import ParticleField from '../components/shell/ParticleField'

import { useLang } from '../lib/i18n'
import { errText, isConfigured, supabase } from '../lib/supabase'

// Гостевая учётная запись жюри: доступ только к «Демо-точке жюри», пароль намеренно публичный.
const GUEST = { email: 'jury@qadir.kz', password: 'qadir-guest' }

// Только для показа: демо-учётные записи из 002_seed.sql (см. README). Кнопки видны лишь по ссылке /login?demo=1.
// В рабочей установке этих учётных записей быть не должно.
const DEMO_PASSWORD = 'Qadir-2026'
const DEMO: { email: string; ru: string; kk: string; icon: IconName }[] = [
  { email: 'iskander@qadir.kz', ru: 'Повар (Искандер)', kk: 'Аспаз (Искандер)', icon: 'scale' },
  { email: 'reviewer@qadir.kz', ru: 'Проверяющий', kk: 'Тексеруші', icon: 'check' },
  { email: 'rector@qadir.kz', ru: 'Руководство', kk: 'Басшылық', icon: 'chart' },
  { email: 'admin@qadir.kz', ru: 'Администратор', kk: 'Әкімші', icon: 'gear' },
]

const list: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.18 } } }
const item: Variants = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 30 } } }

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
  const reduce = useReducedMotion()

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

  // Демо-вход: так же, как гость жюри, только под демо-учётной записью нужной роли.
  async function demo(demoEmail: string) {
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: demoEmail, password: DEMO_PASSWORD })
    if (error) setError(errText(error))
    setBusy(false)
  }

  return (
    <div className="brand-surface relative flex min-h-full flex-col overflow-hidden">
      {/* Кинематографичный фон, нарисованный кодом: лучи света, плывущие зёрна, колосья */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="light-beam absolute -left-1/4 -top-1/3 h-[140%] w-1/2 bg-gradient-to-b from-wheat-light/25 via-wheat-light/5 to-transparent blur-3xl" />
        <div className="light-beam absolute -right-1/4 -top-1/3 h-[140%] w-1/3 bg-gradient-to-b from-brand-300/20 via-transparent to-transparent blur-3xl" style={{ animationDelay: '-7s' }} />
        <ParticleField variant="grain" />

        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgb(255_201_40/0.18))]" />
      </div>

      <div className="relative z-10 flex items-center justify-between p-4">
        <Link to="/" className="flex min-h-10 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">
          <Icon name="arrowLeft" size={16} /> {L('О проекте', 'Жоба туралы')}
        </Link>
        <LangSwitch />
      </div>
      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 pb-10">
        <motion.div initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="mb-6 text-center text-slate-900">
          <motion.div
            className="mb-3 flex justify-center"
            initial={reduce ? false : { scale: 0.4, rotate: -25, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.05 }}
          >
            <span className="relative">
              <span aria-hidden="true" className="absolute -inset-4 rounded-full bg-wheat-light/40 blur-2xl" />
              <Logo size={72} className="relative" />
            </span>
          </motion.div>
          <h1 className="bg-gradient-to-b from-slate-900 to-brand-700 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">Qadir</h1>
          <p className="mt-1 text-slate-600">{L('Нанның қадірі — учёт и сокращение пищевых отходов АТУ', 'Нанның қадірі — АТУ тағам қалдықтарын есепке алу және азайту')}</p>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 40, scale: 0.94, rotateX: 12 }}
          animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
          transition={{ type: 'spring', stiffness: 170, damping: 20, delay: 0.1 }}
          style={{ transformPerspective: 1000 }}
        >
          <Card accent className="!p-5 shadow-[0_30px_80px_-30px_rgb(120_90_0/0.35)]">
            <motion.div variants={list} initial={reduce ? false : 'hidden'} animate="show">
              {!isConfigured && (
                <div className="mb-3"><ErrorBox>{L('Не задано подключение к Supabase: заполните .env.local', 'Supabase қосылымы берілмеген: .env.local толтырыңыз')}</ErrorBox></div>
              )}
              {params.get('demo') !== null && (
                <motion.div variants={item} className="mb-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-700">
                    <span className="h-px flex-1 bg-gradient-to-r from-transparent to-wheat/50" />
                    {L('Демо-вход', 'Демо-кіру')}
                    <span className="h-px flex-1 bg-gradient-to-l from-transparent to-wheat/50" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {DEMO.map((d) => (
                      <motion.button
                        key={d.email}
                        type="button"
                        onClick={() => demo(d.email)}
                        disabled={busy}
                        whileHover={reduce ? undefined : { y: -2 }}
                        whileTap={reduce ? undefined : { scale: 0.96 }}
                        title={d.email}
                        className="flex min-h-12 min-w-0 flex-col items-start gap-1 rounded-xl bg-brand-50 px-2.5 py-2 text-left text-[13px] font-semibold leading-tight text-brand-900 ring-1 ring-brand-200 transition-colors hover:bg-brand-100 disabled:opacity-50"
                      >
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white text-brand-700 shadow-sm"><Icon name={d.icon} size={14} /></span>
                        <span className="min-w-0 max-w-full break-words">{L(d.ru, d.kk)}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}
              {params.get('guest') !== null && (
                <motion.div variants={item} className="mb-4">
                  <Btn size="lg" className="w-full" onClick={guest} disabled={busy}>{L('Войти как гость жюри', 'Қазылар алқасының қонағы ретінде кіру')}</Btn>
                  <div className="mt-3 text-center text-xs text-slate-400">{L('или обычный вход', 'немесе әдеттегі кіру')}</div>
                </motion.div>
              )}
              <form onSubmit={submit} className="space-y-3">
                {mode === 'up' && (
                  <motion.div initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <Field label={L('ФИО', 'ТАӘ')}>
                      <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" />
                    </Field>
                  </motion.div>
                )}
                <motion.div variants={item}>
                  <Field label="E-mail">
                    <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" inputMode="email" />
                  </Field>
                </motion.div>
                <motion.div variants={item}>
                  <Field label={L('Пароль', 'Құпиясөз')}>
                    <input className={inputCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
                  </Field>
                </motion.div>
                <ErrorBox>{error}</ErrorBox>
                {info && <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{info}</div>}
                <motion.div variants={item}>
                  <Btn type="submit" size="lg" className="w-full" disabled={busy}>
                    {busy && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                    {mode === 'in' ? L('Войти', 'Кіру') : L('Зарегистрироваться', 'Тіркелу')}
                  </Btn>
                </motion.div>
              </form>
              <motion.div variants={item}>
                <button type="button" className="mt-3 min-h-10 w-full rounded-lg py-1 text-center text-sm font-medium text-brand-700 transition-colors hover:text-brand-900" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError('') }}>
                  {mode === 'in' ? L('Нет учётной записи? Регистрация', 'Тіркелгі жоқ па? Тіркелу') : L('Уже есть учётная запись? Войти', 'Тіркелгі бар ма? Кіру')}
                </button>
              </motion.div>
              {mode === 'up' && (
                <p className="mt-2 text-center text-xs text-slate-500">
                  {L('Роль и организацию после регистрации назначает администратор.', 'Тіркелгеннен кейін рөл мен ұйымды әкімші тағайындайды.')}
                </p>
              )}
            </motion.div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
