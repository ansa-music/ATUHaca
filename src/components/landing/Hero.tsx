import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Icon, Logo } from '../Icon'
import { LangSwitch } from '../Layout'
import { useLang } from '../../lib/i18n'
import GrainField from './GrainField'
import { EASE } from './shared'

export default function Hero() {
  const { L, lang } = useLang()
  const reduce = !!useReducedMotion()
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const yText = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 140])
  const yBack = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 260])
  const yBread = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 60])
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, reduce ? 1 : 0])

  const slogan = L('Уважение к хлебу — в каждом взвешивании.', 'Нанның қадірі — әр өлшеуде.')
  const words = slogan.split(' ')
  const cta = 'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-base font-semibold transition duration-150 ease-out active:scale-[0.97]'
  const up = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 22 },
    animate: { opacity: 1, y: 0 },
    transition: { delay, duration: 0.7, ease: EASE },
  })

  return (
    <header ref={ref} className="lp-hero relative flex min-h-[100svh] flex-col overflow-hidden text-slate-900">
      <motion.div className="absolute inset-0" style={{ y: yBack }}>
        <GrainField reduce={reduce} />
      </motion.div>
      <div className="lp-grain" />
      <div className="lp-vignette" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-2">
          <Logo size={34} />
          <span className="text-lg font-bold tracking-tight">Qadir</span>
        </div>
        <div className="flex items-center gap-3">
          <LangSwitch />
          <Link to="/login" className="hidden rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-800 ring-1 ring-slate-300 transition hover:bg-white sm:block">{L('Войти', 'Кіру')}</Link>
        </div>
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-6 px-4 pb-20 pt-4 lg:grid-cols-[1.15fr_1fr] lg:pb-24">
        <motion.div style={{ y: yText, opacity: fade }} className="max-w-2xl">
          <motion.div {...up(0.1)} className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-brand-200 backdrop-blur-sm">
            <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-brand-500" />
            {L('Хакатон ATU Smart Food Industries · Трек 1', 'ATU Smart Food Industries хакатоны · 1-трек')}
          </motion.div>

          <h1 className="mt-5 text-[4.5rem] font-black leading-[0.9] tracking-tighter sm:text-8xl lg:text-[9rem]" aria-label="Qadir">
            {'Qadir'.split('').map((ch, i) => (
              <motion.span
                key={i} aria-hidden="true" className="lp-gold-text inline-block"
                initial={reduce ? false : { opacity: 0, y: 60, rotateX: -80, filter: 'blur(10px)' }}
                animate={{ opacity: 1, y: 0, rotateX: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.25 + i * 0.09, duration: 0.9, ease: EASE }}
              >{ch}</motion.span>
            ))}
          </h1>

          <motion.div {...up(0.85)} className="mt-4 text-lg font-semibold tracking-wide text-brand-700 sm:text-2xl">«Нанның қадірі»</motion.div>

          <p key={lang} className="mt-3 max-w-xl text-pretty text-xl font-bold leading-snug sm:text-3xl">
            {words.map((wd, i) => (
              <motion.span
                key={i} className="mr-[0.28em] inline-block"
                initial={reduce ? false : { opacity: 0, y: 16, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 1.05 + i * 0.12, duration: 0.6, ease: EASE }}
              >{wd}</motion.span>
            ))}
          </p>
          <motion.p {...up(1.6)} className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-slate-600 sm:text-lg">
            {L(
              'Qadir превращает бумажные журналы отходов в живую систему: измеряет, проверяет, объясняет и сокращает пищевые отходы АТУ.',
              'Qadir қағаз журналдарды тірі жүйеге айналдырады: АТУ тағам қалдықтарын өлшейді, тексереді, түсіндіреді және азайтады.',
            )}
          </motion.p>

          <motion.div {...up(1.85)} className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link to="/login" className={`${cta} bg-white text-slate-900 shadow-sm ring-1 ring-slate-300 hover:bg-brand-50`}>
              {L('Войти', 'Кіру')} <Icon name="arrowRight" size={18} />
            </Link>
            <Link to="/login?guest=1" className={`${cta} btn-primary-v2 relative isolate bg-brand-400 text-[#2a1c00] hover:bg-brand-300`}>
              {L('Гость жюри', 'Қазылар қонағы')}
            </Link>
            <Link to="/rescue" className={`${cta} bg-transparent text-slate-800 ring-1 ring-slate-300 hover:bg-white/70`}>
              <Icon name="bowl" size={18} /> {L('Спасённые порции', 'Құтқарылған порциялар')}
            </Link>
          </motion.div>
        </motion.div>

        <motion.div style={{ y: yBread }} className="pointer-events-none mx-auto hidden aspect-[400/260] w-full max-w-[520px] lg:block">
          <div className="relative grid h-full place-items-center">
            <span aria-hidden="true" className="absolute inset-[12%] rounded-full bg-brand-300/40 blur-3xl" />
            <img src="/logo.png" alt="" width={260} height={260} className="q-logo relative h-[260px] w-[260px] drop-shadow-[0_24px_40px_rgb(120_90_0/0.25)]" />
          </div>
        </motion.div>
      </div>

      <div className="lp-scroll-cue absolute bottom-5 hidden sm:block left-1/2 z-10 -translate-x-1/2 text-slate-500" aria-hidden="true">
        <svg width="22" height="34" viewBox="0 0 22 34" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="1" width="20" height="32" rx="10" /><path d="M11 8v7" strokeLinecap="round" /></svg>
      </div>
    </header>
  )
}
