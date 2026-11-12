import { useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react'
import { Icon, type IconName } from '../Icon'
import { CountUp } from '../motion'
import { useLang } from '../../lib/i18n'
import { EASE, SectionTitle, TrustRing, useMedia } from './shared'

/* ---------- Мини-визуалы шагов ---------- */

function ScaleVisual() {
  const { L } = useLang()
  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 160 140" className="h-36 w-40 shrink-0" aria-hidden="true">
        <rect x="20" y="96" width="120" height="30" rx="8" fill="#14532d" />
        <rect x="52" y="104" width="56" height="14" rx="3" fill="#0a2a18" />
        <motion.g initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 12, delay: 0.2 }}>
          <path d="M34 92 h92 l-10 -26 h-72 z" fill="#e2e8f0" stroke="#94a3b8" />
          <ellipse cx="80" cy="64" rx="34" ry="12" fill="#f3cf7e" />
          <ellipse cx="68" cy="60" rx="12" ry="6" fill="#c98a1b" />
        </motion.g>
        <motion.text x="80" y="115" textAnchor="middle" fill="#e9b958" fontSize="11" fontWeight="700" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.6, 1] }} transition={{ delay: 0.8, duration: 0.6 }}>4,70 kg</motion.text>
      </svg>
      <div className="min-w-0 space-y-2 text-sm">
        <motion.div className="rounded-xl bg-white px-3 py-2 shadow-card ring-1 ring-black/5" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9 }}>
          <div className="text-[10px] font-semibold uppercase text-slate-400">{L('Весы · Bluetooth', 'Таразы · Bluetooth')}</div>
          <div className="tnum text-xl font-extrabold text-brand-800"><CountUp value={4.7} duration={900} format={(n) => n.toFixed(1).replace('.', ',')} /> {L('кг', 'кг')}</div>
        </motion.div>
        <motion.div className="inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-semibold text-brand-800" initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.3, type: 'spring' }}>
          <Icon name="camera" size={14} /> {L('фото + ИИ', 'фото + ЖИ')}
        </motion.div>
      </div>
    </div>
  )
}

function TrustVisual() {
  const { L } = useLang()
  return (
    <div className="flex items-center gap-5">
      <TrustRing value={86} size={128} color="#1f7a45" label={L('индекс достоверности', 'шынайылық индексі')} />
      <ul className="min-w-0 space-y-2 text-sm text-slate-600">
        {[L('нет записей «пачкой»', '«топтап» жазу жоқ'), L('вес в типичном диапазоне', 'салмақ әдеттегі шекте'), L('фото приложены', 'фото тіркелген')].map((r, i) => (
          <motion.li key={r} className="flex items-center gap-2" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.18 }}>
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">✓</span>{r}
          </motion.li>
        ))}
      </ul>
    </div>
  )
}

function ChartVisual() {
  const { L } = useLang()
  const bars = [[70, 30], [64, 36], [55, 45], [48, 52]]
  return (
    <div>
      <div className="flex h-36 items-end gap-3">
        {bars.map(([a, b], i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end gap-0.5">
            <motion.div className="rounded-t bg-wheat" initial={{ height: 0 }} animate={{ height: `${a}%` }} transition={{ delay: 0.15 + i * 0.12, duration: 0.7, ease: EASE }} />
            <motion.div className="rounded-b bg-brand-500" initial={{ height: 0 }} animate={{ height: `${b * 0.5}%` }} transition={{ delay: 0.35 + i * 0.12, duration: 0.7, ease: EASE }} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-wheat" />{L('предотвратимые', 'алдын алуға болатын')}</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-brand-500" />{L('неизбежные', 'болмай қоймайтын')}</span>
        <span className="text-slate-400">{L('₸ · CO₂ · г/порция', '₸ · CO₂ · г/порция')}</span>
      </div>
    </div>
  )
}

function RescueVisual() {
  const { L } = useLang()
  return (
    <motion.div className="mx-auto max-w-xs rounded-2xl bg-white p-4 shadow-lift ring-1 ring-black/5" initial={{ rotate: -4, y: 20, opacity: 0 }} animate={{ rotate: 0, y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 16 }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-bold text-slate-900">{L('Плов с говядиной', 'Сиыр етінен палау')}</div>
          <div className="text-xs text-slate-500">{L('6 порций · до 16:00', '6 порция · 16:00-ге дейін')}</div>
        </div>
        <motion.span className="shrink-0 rounded-full bg-wheat-soft px-2 py-0.5 text-xs font-bold text-wheat" initial={{ scale: 0 }} animate={{ scale: [0, 1.25, 1] }} transition={{ delay: 0.5 }}>−40%</motion.span>
      </div>
      <motion.div className="mt-3 rounded-lg bg-brand-700 py-2 text-center text-sm font-semibold text-white" animate={{ scale: [1, 1, 0.95, 1] }} transition={{ delay: 1, duration: 0.5 }}>{L('Забронировать', 'Брондау')}</motion.div>
    </motion.div>
  )
}

const VISUALS = [ScaleVisual, TrustVisual, ChartVisual, RescueVisual]

function useSteps() {
  const { L } = useLang()
  const steps: { icon: IconName; title: string; text: string }[] = [
    { icon: 'scale', title: L('Измерить', 'Өлшеу'), text: L('Ввод со смартфона за секунды, с весов или по фото — ИИ подсказывает, что в контейнере.', 'Смартфоннан бірнеше секундта, таразыдан немесе фото арқылы енгізу — ЖИ ыдыста не бар екенін айтады.') },
    { icon: 'shield', title: L('Проверить', 'Тексеру'), text: L('Автопроверка считает индекс достоверности 0–100 и объясняет причины. Проверяющий принимает или возвращает отчёт.', 'Автотексеру 0–100 шынайылық индексін есептеп, себебін түсіндіреді. Тексеруші есепті қабылдайды не қайтарады.') },
    { icon: 'chart', title: L('Понять', 'Түсіну'), text: L('Предотвратимые и неизбежные отходы, ₸, CO₂ и граммы на порцию — видно, где реально можно работать.', 'Алдын алуға болатын және болмай қоймайтын қалдық, ₸, CO₂, бір порцияға грамм — нақты қай жерде жұмыс істеуге болатыны көрінеді.') },
    { icon: 'bowl', title: L('Действовать', 'Әрекет ету'), text: L('Остатки дня уходят студентам через «Спасённые порции», а руководство получает рекомендации.', 'Күн қалдығы «Құтқарылған порциялар» арқылы студенттерге жетеді, басшылық ұсыным алады.') },
  ]
  return steps
}

/** Широкий экран: секция «прилипает», шаги переключаются прокруткой. */
function Pinned() {
  const { L } = useLang()
  const steps = useSteps()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [active, setActive] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', (v) => setActive(Math.min(steps.length - 1, Math.max(0, Math.floor(v * steps.length * 0.999)))))
  const Visual = VISUALS[active]

  return (
    <div ref={ref} style={{ height: `${steps.length * 85 + 40}vh` }} className="relative">
      <div className="sticky top-0 flex h-screen items-center">
        <div className="mx-auto grid w-full max-w-6xl grid-cols-[1fr_1.05fr] items-center gap-14 px-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-wheat">{L('Как это работает', 'Қалай жұмыс істейді')}</div>
            <h2 className="mt-2 text-5xl font-extrabold tracking-tight text-slate-900">{L('Один контур вместо журнала', 'Журналдың орнына бір контур')}</h2>
            <ol className="mt-10 space-y-2">
              {steps.map((s, i) => (
                <li key={s.title} className={`relative rounded-2xl p-4 pl-16 transition-all duration-500 ${i === active ? 'bg-white shadow-card ring-1 ring-black/5' : 'opacity-45'}`}>
                  <span className={`absolute left-4 top-4 grid h-9 w-9 place-items-center rounded-full transition-colors duration-500 ${i <= active ? 'bg-brand-700 text-white' : 'bg-slate-200 text-slate-500'}`}><Icon name={s.icon} size={18} /></span>
                  <div className="text-xl font-bold text-slate-900">{s.title}</div>
                  <AnimatePresence initial={false}>
                    {i === active && (
                      <motion.p className="overflow-hidden text-slate-600" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: EASE }}>
                        <span className="block pt-1">{s.text}</span>
                      </motion.p>
                    )}
                  </AnimatePresence>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative">
            <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-brand-100 via-paper to-wheat-soft" />
            <div className="relative grid min-h-[360px] place-items-center rounded-[2rem] bg-paper/70 p-10 ring-1 ring-black/5 backdrop-blur">
              <div className="absolute left-6 top-5 text-7xl font-black text-brand-900/10 tnum">0{active + 1}</div>
              <>
                <motion.div key={active} className="w-full" initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -24, scale: 0.98 }} transition={{ duration: 0.45, ease: EASE }}>
                  <Visual />
                </motion.div>
              </>
              <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 gap-1.5">
                {steps.map((_, i) => <span key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === active ? 'w-8 bg-brand-700' : 'w-1.5 bg-brand-900/20'}`} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Телефон и reduced motion: простая вертикальная последовательность. */
function Stacked() {
  const { L } = useLang()
  const steps = useSteps()
  const reduce = useReducedMotion()
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:py-24">
      <SectionTitle kicker={L('Как это работает', 'Қалай жұмыс істейді')} title={L('Измерить → Проверить → Понять → Действовать', 'Өлшеу → Тексеру → Түсіну → Әрекет ету')} />
      <ol className="space-y-5">
        {steps.map((s, i) => {
          const Visual = VISUALS[i]
          return (
            <motion.li key={s.title} className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/5"
              initial={reduce ? false : { opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.6, ease: EASE }}>
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-700 text-white"><Icon name={s.icon} size={20} /></span>
                  <div>
                    <div className="text-xs font-bold text-wheat">{L('Шаг', 'Қадам')} {i + 1}</div>
                    <h3 className="text-lg font-bold text-slate-900">{s.title}</h3>
                  </div>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.text}</p>
              </div>
              <InViewMount><div className="border-t border-black/5 bg-paper p-4"><Visual /></div></InViewMount>
            </motion.li>
          )
        })}
      </ol>
    </div>
  )
}

/** Монтирует детей, когда блок становится видимым, чтобы их анимации стартовали на экране. */
function InViewMount({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false)
  return (
    <motion.div className="min-h-[176px]" onViewportEnter={() => setShown(true)} viewport={{ once: true, amount: 0.3 }}>
      {shown && children}
    </motion.div>
  )
}

export default function ScrollStory() {
  const wide = useMedia('(min-width: 1024px) and (min-height: 640px)')
  const reduce = useReducedMotion()
  return <section className="relative">{wide && !reduce ? <Pinned /> : <Stacked />}</section>
}
