import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Icon, Logo } from '../Icon'
import { LangSwitch } from '../Layout'
import { useLang } from '../../lib/i18n'
import GrainField from './GrainField'
import { EASE } from './shared'

/** Силуэт буханки на тарелке, контур «прорисовывается» как в титрах фильма. */
function BreadPlate({ reduce }: { reduce: boolean }) {
  const draw = (delay: number, dur = 1.8) => ({
    initial: reduce ? false : { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { pathLength: { delay, duration: dur, ease: EASE }, opacity: { delay, duration: 0.3 } },
  })
  return (
    <svg viewBox="0 0 400 260" className="h-full w-full" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <defs>
        <radialGradient id="lp-glow" cx="50%" cy="60%" r="50%">
          <stop offset="0" stopColor="#e9b958" stopOpacity="0.35" />
          <stop offset="1" stopColor="#e9b958" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lp-loaf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3cf7e" stopOpacity="0.32" />
          <stop offset="1" stopColor="#c98a1b" stopOpacity="0.08" />
        </linearGradient>
      </defs>
      <motion.ellipse cx="200" cy="150" rx="190" ry="110" fill="url(#lp-glow)"
        initial={reduce ? false : { opacity: 0 }} animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }} />
      {/* тарелка */}
      <motion.ellipse cx="200" cy="205" rx="170" ry="34" stroke="#e9b958" strokeOpacity="0.55" strokeWidth="2" {...draw(0.6)} />
      <motion.ellipse cx="200" cy="205" rx="128" ry="22" stroke="#e9b958" strokeOpacity="0.3" strokeWidth="1.5" {...draw(0.9)} />
      {/* буханка */}
      <motion.path d="M86 190 C70 120 130 70 200 70 C270 70 330 120 314 190 Z" fill="url(#lp-loaf)" stroke="#f3cf7e" strokeWidth="2.5" {...draw(1.2, 2.2)} />
      {[0, 1, 2, 3].map((i) => (
        <motion.path key={i} d={`M${140 + i * 38} ${100 + Math.abs(1.5 - i) * 8} q14 20 6 44`} stroke="#f3cf7e" strokeOpacity="0.7" strokeWidth="2.5" {...draw(2.2 + i * 0.18, 0.8)} />
      ))}
      {/* пар над хлебом */}
      {[0, 1, 2].map((i) => (
        <motion.path key={`s${i}`} d={`M${170 + i * 30} 58 c-10 -14 10 -22 0 -36`} stroke="#fff" strokeOpacity="0.35" strokeWidth="2"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={reduce ? { opacity: 0.4 } : { opacity: [0, 0.6, 0], y: [6, -10, -20] }}
          transition={{ delay: 3 + i * 0.5, duration: 3.2, repeat: Infinity, ease: 'easeOut' }} />
      ))}
    </svg>
  )
}

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
    <header ref={ref} className="lp-hero on-dark relative flex min-h-[100svh] flex-col overflow-hidden text-white">
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
          <Link to="/login" className="hidden rounded-lg px-3 py-1.5 text-sm font-semibold text-white/90 ring-1 ring-white/30 transition hover:bg-white/10 sm:block">{L('Войти', 'Кіру')}</Link>
        </div>
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-6 px-4 pb-20 pt-4 lg:grid-cols-[1.15fr_1fr] lg:pb-24">
        <motion.div style={{ y: yText, opacity: fade }} className="max-w-2xl">
          <motion.div {...up(0.1)} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 ring-1 ring-white/20 backdrop-blur-sm">
            <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-wheat-light" />
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

          <motion.div {...up(0.85)} className="mt-4 text-lg font-semibold tracking-wide text-wheat-light sm:text-2xl">«Нанның қадірі»</motion.div>

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
          <motion.p {...up(1.6)} className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-white/75 sm:text-lg">
            {L(
              'Qadir превращает бумажные журналы отходов в живую систему: измеряет, проверяет, объясняет и сокращает пищевые отходы АТУ.',
              'Qadir қағаз журналдарды тірі жүйеге айналдырады: АТУ тағам қалдықтарын өлшейді, тексереді, түсіндіреді және азайтады.',
            )}
          </motion.p>

          <motion.div {...up(1.85)} className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link to="/login" className={`${cta} bg-white text-brand-800 shadow-lg shadow-black/20 hover:bg-brand-50`}>
              {L('Войти', 'Кіру')} <Icon name="arrowRight" size={18} />
            </Link>
            <Link to="/login?guest=1" className={`${cta} bg-wheat text-white shadow-lg shadow-black/20 hover:brightness-110`}>
              {L('Гость жюри', 'Қазылар қонағы')}
            </Link>
            <Link to="/rescue" className={`${cta} bg-white/5 text-white ring-1 ring-white/40 backdrop-blur-sm hover:bg-white/15`}>
              <Icon name="bowl" size={18} /> {L('Спасённые порции', 'Құтқарылған порциялар')}
            </Link>
          </motion.div>
        </motion.div>

        <motion.div style={{ y: yBread }} className="pointer-events-none mx-auto hidden aspect-[400/260] w-full max-w-[520px] lg:block">
          <BreadPlate reduce={reduce} />
        </motion.div>
      </div>

      <div className="lp-scroll-cue absolute bottom-5 hidden sm:block left-1/2 z-10 -translate-x-1/2 text-white/60" aria-hidden="true">
        <svg width="22" height="34" viewBox="0 0 22 34" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="1" width="20" height="32" rx="10" /><path d="M11 8v7" strokeLinecap="round" /></svg>
      </div>
    </header>
  )
}
