import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion, type Variants } from 'motion/react'
import { Btn, Card, ErrorBox } from '../components/ui'
import { Icon, Logo, type IconName } from '../components/Icon'
import { LangSwitch } from '../components/Layout'
import ParticleField from '../components/shell/ParticleField'

import { useLang } from '../lib/i18n'
import { errText, isConfigured, supabase } from '../lib/supabase'

// Гостевая учётная запись жюри: доступ только к «Демо-точке жюри», пароль намеренно публичный.
const GUEST = { email: 'jury@qadir.kz', password: 'qadir-guest' }

// Демо-учётные записи из 002_seed.sql (см. README): вход одним касанием, регистрации нет.
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const reduce = useReducedMotion()

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
              {/* Только демо-вход: регистрации и формы пароля нет — одно касание, и вы внутри нужной роли */}
              <motion.div variants={item} className="mb-1 text-center text-sm font-semibold text-slate-700">
                {L('Выберите, кем войти', 'Кім ретінде кіретініңізді таңдаңыз')}
              </motion.div>
              <motion.div variants={item} className="mb-3">
                <Btn size="lg" className="w-full" onClick={guest} disabled={busy}>
                  {busy && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
                  {L('Войти как гость жюри', 'Қазылар қонағы ретінде кіру')}
                </Btn>
              </motion.div>
              <motion.div variants={item} className="grid grid-cols-2 gap-2">
                {DEMO.map((d) => (
                  <motion.button
                    key={d.email}
                    type="button"
                    onClick={() => demo(d.email)}
                    disabled={busy}
                    whileHover={reduce ? undefined : { y: -2 }}
                    whileTap={reduce ? undefined : { scale: 0.96 }}
                    className="flex min-h-14 min-w-0 flex-col items-start gap-1 rounded-xl bg-brand-50 px-2.5 py-2 text-left text-[13px] font-semibold leading-tight text-brand-900 ring-1 ring-brand-200 transition-colors hover:bg-brand-100 disabled:opacity-50"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white text-brand-700 shadow-sm"><Icon name={d.icon} size={14} /></span>
                    <span className="min-w-0 max-w-full break-words">{L(d.ru, d.kk)}</span>
                  </motion.button>
                ))}
              </motion.div>
              <div className="mt-3"><ErrorBox>{error}</ErrorBox></div>
              <p className="mt-2 text-center text-xs text-slate-500">
                {L('Демо-версия: все функции открыты, данные — по образцам АТУ.', 'Демо-нұсқа: барлық функция ашық, деректер — АТУ үлгілері бойынша.')}
              </p>
            </motion.div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
