import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react'
import { Icon } from '../Icon'
import { useLang } from '../../lib/i18n'
import { EASE, SectionTitle, TrustRing, useMedia } from './shared'

/* Сценарий ролика: длительность каждого шага в мс. Внутри шага всё считается от локального времени `t`. */
const STEPS = [4200, 1900, 3000, 3400, 3200]
const TOTAL = STEPS.reduce((a, b) => a + b, 0)
const START = STEPS.map((_, i) => STEPS.slice(0, i).reduce((a, b) => a + b, 0))

function stepAt(time: number) {
  for (let i = STEPS.length - 1; i >= 0; i--) if (time >= START[i]) return i
  return 0
}

/** Игровое время ролика: идёт, пока проигрывается и блок на экране. */
function useTimeline(playing: boolean) {
  const [time, setTime] = useState(0)
  const timeRef = useRef(0)
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let lastSet = 0
    const tick = (now: number) => {
      timeRef.current = (timeRef.current + Math.min(1000, now - last)) % TOTAL
      last = now
      if (now - lastSet > 40) { lastSet = now; setTime(timeRef.current) }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing])
  const seek = (v: number) => { timeRef.current = v; setTime(v) }
  return [time, seek] as const
}

/* ---------- Телефон: повар вносит взвешивание ---------- */

function PhoneScreen({ step, t }: { step: number; t: number }) {
  const { L } = useLang()
  const tiles = [
    { icon: 'bowl' as const, ru: 'Пищевые отходы из зала', kk: 'Залдан тағам қалдықтары' },
    { icon: 'scale' as const, ru: 'Кухня: подготовка', kk: 'Ас үй: дайындық' },
    { icon: 'clipboard' as const, ru: 'Хлеб и выпечка', kk: 'Нан және тоқаш' },
    { icon: 'chart' as const, ru: 'Порции без спроса', kk: 'Сұранысы жоқ порциялар' },
  ]
  const inForm = step > 0 || t > 1100
  const typed = step > 0 ? '4,7' : ['', '4', '4,', '4,7'][t < 1500 ? 0 : t < 1800 ? 1 : t < 2100 ? 2 : 3]
  const photo = step > 0 || t > 2500
  const ai = step > 0 || t > 3100
  const saved = step >= 1 && (step > 1 || t > 650)

  return (
    <div className="relative flex h-full flex-col bg-paper text-[11px] text-slate-800">
      <div className="flex items-center justify-between bg-brand-800 px-3 pb-2 pt-5 text-white">
        <span className="font-bold">Qadir</span>
        <span className="text-[10px] text-white/70">{L('Столовая №1', '№1 асхана')}</span>
      </div>
      <>
        {!inForm ? (
          <motion.div key="tiles" className="grid flex-1 grid-cols-2 content-start gap-2 p-3" exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
            <div className="col-span-2 mb-1 font-bold text-slate-900">{L('Что взвешиваем?', 'Нені өлшейміз?')}</div>
            {tiles.map((tl, i) => {
              const hot = i === 0 && t > 650
              return (
                <div key={i} className={`relative overflow-hidden rounded-xl bg-white p-2.5 shadow-card ring-1 transition-colors ${hot ? 'ring-2 ring-brand-500' : 'ring-black/5'}`}>
                  <Icon name={tl.icon} size={18} className={hot ? 'text-brand-700' : 'text-slate-400'} />
                  <div className="mt-1.5 font-semibold leading-tight">{L(tl.ru, tl.kk)}</div>
                  {i === 0 && t > 650 && <span className="lp-ripple absolute left-1/2 top-1/2 -ml-5 -mt-5 h-10 w-10 rounded-full bg-brand-500" />}
                </div>
              )
            })}
            {/* палец */}
            <motion.div className="pointer-events-none absolute h-7 w-7 rounded-full bg-slate-900/25 ring-2 ring-white"
              initial={{ left: '70%', top: '80%', opacity: 0 }}
              animate={t > 150 ? { left: '22%', top: '34%', opacity: 1, scale: t > 650 ? 0.8 : 1 } : {}}
              transition={{ duration: 0.5, ease: EASE }} />
          </motion.div>
        ) : !saved ? (
          <motion.div key="form" className="flex flex-1 flex-col gap-2.5 p-3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.3, ease: EASE }}>
            <div className="font-bold text-slate-900">{L('Пищевые отходы из зала', 'Залдан тағам қалдықтары')}</div>
            <div className="rounded-xl bg-white p-2.5 ring-1 ring-black/5">
              <div className="text-[10px] font-semibold uppercase text-slate-400">{L('Масса', 'Масса')}</div>
              <div className="tnum mt-0.5 text-2xl font-extrabold text-brand-800">
                {typed || <span className="text-slate-300">0</span>}{step === 0 && t < 2400 && <span className="lp-caret" />}<span className="ml-1 text-sm font-bold text-brand-600">{L('кг', 'кг')}</span>
              </div>
            </div>
            <div className="relative h-20 overflow-hidden rounded-xl bg-slate-200 ring-1 ring-black/5">
              {photo ? (
                <motion.div className="absolute inset-0" initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ duration: 0.6 }}
                  style={{ background: 'radial-gradient(circle at 50% 55%, #f3cf7e 0 18%, #c98a1b 19% 26%, #e2e8f0 27% 44%, #94a3b8 45% 47%, #cbd5e1 48%)' }} />
              ) : (
                <div className="grid h-full place-items-center text-slate-400"><Icon name="camera" size={22} /></div>
              )}
              <AnimatePresence>
                {photo && step === 0 && t < 2850 && (
                  <motion.div className="absolute inset-0 bg-white" initial={{ opacity: 1 }} animate={{ opacity: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }} />
                )}
              </AnimatePresence>
            </div>
            <AnimatePresence>
              {ai && (
                <motion.div className="self-start rounded-full bg-brand-100 px-2.5 py-1 font-semibold text-brand-800 ring-1 ring-brand-300"
                  initial={{ opacity: 0, scale: 0.6, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 22 }}>
                  🤖 {L('ИИ определил: хлеб, гарнир', 'ЖИ анықтады: нан, гарнир')}
                </motion.div>
              )}
            </AnimatePresence>
            <motion.div className="mt-auto rounded-xl bg-brand-700 py-2.5 text-center text-xs font-bold text-white"
              animate={step === 1 && t < 650 && t > 250 ? { scale: 0.94 } : { scale: 1 }} transition={{ duration: 0.15 }}>
              {L('Сохранить', 'Сақтау')}
            </motion.div>
          </motion.div>
        ) : (
          <motion.div key="done" className="flex flex-1 flex-col items-center justify-center gap-3 p-4 text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, ease: EASE }}>
            <svg viewBox="0 0 52 52" className="h-16 w-16" aria-hidden="true">
              <motion.circle cx="26" cy="26" r="24" fill="#17633a" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} style={{ originX: '50%', originY: '50%' }} />
              <motion.path d="M15 27l7 7 15-16" fill="none" stroke="#fff" strokeWidth="4.500" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.25, duration: 0.45 }} />
            </svg>
            <div className="text-sm font-bold text-slate-900">{L('Сохранено', 'Сақталды')}</div>
            <div className="text-slate-500">4,7 {L('кг · отправлено в отчёт месяца', 'кг · ай есебіне жіберілді')}</div>
          </motion.div>
        )}
      </>
    </div>
  )
}

function Phone({ children, active }: { children: ReactNode; active: boolean }) {
  return (
    <div className={`relative mx-auto aspect-[9/18.5] w-[210px] shrink-0 rounded-[2.2rem] bg-slate-900 p-2 shadow-2xl ring-1 ring-white/10 transition-all duration-500 sm:w-[230px] ${active ? 'opacity-100' : 'opacity-60 lg:scale-[0.96]'}`}>
      <div className="absolute left-1/2 top-3 z-10 h-4 w-16 -translate-x-1/2 rounded-full bg-slate-900" />
      <div className="relative h-full overflow-hidden rounded-[1.7rem]">{children}</div>
    </div>
  )
}

/* ---------- Ноутбук: проверяющий и руководство ---------- */

function LaptopScreen({ step, t }: { step: number; t: number }) {
  const { L } = useLang()
  const notif = step >= 2
  const reviewing = step === 2 || step === 3
  const clicked = step === 3 && t > 1100
  const accepted = step > 3 || (step === 3 && t > 2300)
  const score = step < 2 ? 0 : accepted ? 86 : 23
  const months = [62, 58, 55, 49, 44, 38]

  return (
    <div className="relative flex h-full bg-paper text-[10px] text-slate-800 sm:text-[11px]">
      <div className="hidden w-[22%] flex-col gap-1.5 bg-brand-900 p-2.5 text-white/70 sm:flex">
        <div className="mb-1 font-bold text-white">Qadir</div>
        {[L('Проверка', 'Тексеру'), L('Аналитика', 'Аналитика'), L('Реестр', 'Тізілім'), L('Отчёты', 'Есептер')].map((s, i) => (
          <div key={s} className={`rounded px-1.5 py-1 ${(i === 0 && step < 4) || (i === 1 && step === 4) ? 'bg-white/15 text-white' : ''}`}>{s}</div>
        ))}
      </div>
      <div className="relative min-w-0 flex-1 p-3">
        <>
          {step < 4 ? (
            <motion.div key="review" className="flex h-full flex-col" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3 }}>
              <div className="flex items-center justify-between gap-2">
                <div className="truncate font-bold text-slate-900">{L('Отчёт · Столовая №1 · ноябрь', 'Есеп · №1 асхана · қараша')}</div>
                <>
                  <motion.span key={accepted ? 'a' : clicked ? 'r' : 'p'}
                    className={`shrink-0 rounded-full px-2 py-0.5 font-bold ${accepted ? 'bg-brand-100 text-brand-800' : clicked ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'}`}
                    initial={{ rotateX: 90, opacity: 0 }} animate={{ rotateX: 0, opacity: 1 }} exit={{ rotateX: -90, opacity: 0 }} transition={{ duration: 0.25 }}>
                    {accepted ? L('Принято', 'Қабылданды') : clicked ? L('Возвращён', 'Қайтарылды') : L('На проверке', 'Тексеруде')}
                  </motion.span>
                </>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <TrustRing value={score} size={74} color={accepted ? '#1f7a45' : '#dc2626'} label={L('индекс достоверности', 'шынайылық индексі')} />
                <ul className="min-w-0 space-y-1 text-slate-600">
                  {accepted ? (
                    <li className="flex items-start gap-1.5 font-semibold text-brand-700">✓ {L('вес исправлен, фото приложено', 'салмақ түзетілді, фото тіркелді')}</li>
                  ) : (
                    [L('записи внесены пачкой', 'жазбалар топтап енгізілген'), L('нетипичный вес: 47 кг', 'әдеттен тыс салмақ: 47 кг'), L('пропущены дни', 'күндер өткізілген')].map((r, i) => (
                      <motion.li key={r} className="flex items-start gap-1.5" initial={{ opacity: 0, x: 8 }} animate={reviewing ? { opacity: 1, x: 0 } : {}} transition={{ delay: 0.9 + i * 0.15 }}>
                        <i className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />{r}
                      </motion.li>
                    ))
                  )}
                </ul>
              </div>
              <AnimatePresence>
                {clicked && !accepted && (
                  <motion.div className="mt-3 rounded-lg bg-white p-2 ring-1 ring-black/5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    💬 {L('Проверьте вес 12.11 — похоже на 4,7 кг, а не 47', '12.11 салмағын тексеріңіз — 47 емес, 4,7 кг сияқты')}
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                <motion.span className={`rounded-lg px-2.5 py-1.5 font-semibold ring-1 ${clicked ? 'bg-red-600 text-white ring-red-600' : 'bg-white text-red-700 ring-red-200'}`}
                  animate={step === 3 && t > 900 && t < 1150 ? { scale: 0.93 } : { scale: 1 }}>
                  {L('Вернуть с комментарием', 'Пікірмен қайтару')}
                </motion.span>
                <span className={`rounded-lg px-2.5 py-1.5 font-semibold ${accepted ? 'bg-brand-700 text-white' : 'bg-slate-100 text-slate-400'}`}>{L('Принять', 'Қабылдау')}</span>
              </div>
              {/* курсор проверяющего */}
              {step === 3 && (
                <motion.svg viewBox="0 0 24 24" className="pointer-events-none absolute h-5 w-5 drop-shadow" initial={{ right: '10%', top: '30%' }} animate={{ right: t > 1700 ? '18%' : '62%', top: '84%' }} transition={{ duration: 0.8, ease: EASE }} aria-hidden="true">
                  <path d="M4 2l16 9-7 2-3 7z" fill="#0f172a" stroke="#fff" strokeWidth="1.500" />
                </motion.svg>
              )}
            </motion.div>
          ) : (
            <motion.div key="dash" className="flex h-full flex-col" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}>
              <div className="font-bold text-slate-900">{L('Предотвратимые отходы, г на порцию', 'Алдын алуға болатын қалдық, г / порция')}</div>
              <div className="mt-2 flex min-h-0 flex-1 gap-2">
                {months.map((v, i) => (
                  <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <motion.div className={`w-full rounded-t ${i === months.length - 1 ? 'bg-brand-600' : 'bg-brand-300'}`}
                      initial={{ height: 0 }} animate={{ height: `${v * 1.3}%` }} transition={{ delay: 0.15 + i * 0.1, duration: 0.7, ease: EASE }} />
                    <span className="text-[9px] text-slate-400">{['VI', 'VII', 'VIII', 'IX', 'X', 'XI'][i]}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="tnum text-2xl font-extrabold text-brand-700 sm:text-3xl">−{Math.round(18 * Math.min(1, Math.max(0, (t - 700) / 1400)))} %</span>
                <span className="font-semibold text-slate-500">{L('предотвратимых', 'алдын алуға болатын')}</span>
              </div>
            </motion.div>
          )}
        </>

        {/* уведомление о новом отчёте */}
        <AnimatePresence>
          {notif && step === 2 && (
            <motion.div className="absolute right-2 top-2 z-10 max-w-[78%] rounded-xl bg-slate-900 p-2.5 text-white shadow-xl"
              initial={{ x: '120%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '120%', opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
              <div className="font-bold">🔔 {L('Новый отчёт на проверку', 'Тексеруге жаңа есеп')}</div>
              <div className="text-white/70">{L('индекс достоверности', 'шынайылық индексі')} <b className="text-red-400">23</b></div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Laptop({ children, active }: { children: ReactNode; active: boolean }) {
  return (
    <div className={`mx-auto w-full max-w-[560px] transition-all duration-500 ${active ? 'opacity-100' : 'opacity-60 lg:scale-[0.97]'}`}>
      <div className="rounded-t-2xl bg-slate-900 p-2 pb-2.5 shadow-2xl ring-1 ring-white/10 sm:p-3">
        <div className="aspect-[16/10] overflow-hidden rounded-md">{children}</div>
      </div>
      <div className="mx-[-4%] h-3 rounded-b-xl bg-gradient-to-b from-slate-300 to-slate-500" />
    </div>
  )
}

/* ---------- Секция ---------- */

export default function ProductFilm() {
  const { L } = useLang()
  const reduce = !!useReducedMotion()
  const wide = useMedia('(min-width: 1024px)')
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.3 })
  const [userPaused, setUserPaused] = useState(reduce)
  const playing = inView && !userPaused
  const [time, seek] = useTimeline(playing)
  const step = stepAt(time)
  const t = time - START[step]

  const captions: [string, string][] = [
    ['Повар выбирает «Пищевые отходы из зала», вводит вес и фотографирует — ИИ подсказывает состав.', 'Аспаз «Залдан тағам қалдықтарын» таңдап, салмақты енгізеді, суретке түсіреді — ЖИ құрамын айтады.'],
    ['Одно нажатие «Сохранить» — запись уже в отчёте месяца.', '«Сақтау» бір басу — жазба ай есебінде.'],
    ['Проверяющий получает отчёт: автопроверка дала индекс достоверности 23 из 100.', 'Тексерушіге есеп келеді: автотексеру шынайылық индексін 100-ден 23 деп берді.'],
    ['Отчёт возвращается с комментарием, исправляется и принимается.', 'Есеп пікірмен қайтарылады, түзетіліп, қабылданады.'],
    ['Руководство видит динамику и где отходы реально сокращаются.', 'Басшылық динамиканы және қалдық қай жерде азайғанын көреді.'],
  ]

  const phoneActive = step <= 1
  return (
    <section id="film" className="on-dark relative overflow-hidden bg-brand-950 text-white">
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(50% 60% at 50% 40%, rgb(31 122 69 / 0.35), transparent 70%)' }} />
      <div className="relative mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <SectionTitle dark kicker={L('Продуктовый фильм · 15 секунд', 'Өнім туралы фильм · 15 секунд')} title={L('Один отчёт: от кухни до решения', 'Бір есеп: ас үйден шешімге дейін')} />

        <div ref={ref}>
          <div className="relative flex min-h-[470px] items-center justify-center sm:min-h-[500px] lg:min-h-[480px] lg:gap-10">
            {wide ? (
              <>
                <Phone active={phoneActive}><PhoneScreen step={step} t={t} /></Phone>
                <Laptop active={!phoneActive}><LaptopScreen step={step} t={t} /></Laptop>
              </>
            ) : (
              <>
                <motion.div key={phoneActive ? 'p' : 'l'} className="w-full" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.35, ease: EASE }}>
                  {phoneActive ? <Phone active><PhoneScreen step={step} t={t} /></Phone> : <Laptop active><LaptopScreen step={step} t={t} /></Laptop>}
                </motion.div>
              </>
            )}
          </div>

          <div className="mx-auto mt-6 max-w-2xl text-center">
            <div className="min-h-[4.5rem] sm:min-h-[3.5rem]" aria-live="polite">
              <>
                <motion.p key={step} className="text-pretty text-base font-semibold sm:text-lg" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                  {L(...captions[step])}
                </motion.p>
              </>
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button type="button" onClick={() => setUserPaused((p) => !p)} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 ring-1 ring-white/25 transition hover:bg-white/20"
                aria-label={userPaused ? L('Воспроизвести', 'Ойнату') : L('Пауза', 'Кідірту')}>
                {userPaused
                  ? <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor" /></svg>
                  : <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5h3v11H3zM8 1.5h3v11H8z" fill="currentColor" /></svg>}
              </button>
              <div className="flex items-center gap-1.5">
                {STEPS.map((d, i) => (
                  <button key={i} type="button" onClick={() => seek(START[i])} aria-label={`${L('Шаг', 'Қадам')} ${i + 1}`} aria-current={i === step}
                    className="relative h-2.5 overflow-hidden rounded-full bg-white/20 transition-all" style={{ width: i === step ? 40 : 18 }}>
                    <span className="absolute inset-y-0 left-0 bg-wheat-light" style={{ width: i < step ? '100%' : i === step ? `${Math.min(100, (t / d) * 100)}%` : '0%' }} />
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 text-[11px] uppercase tracking-[0.18em] text-white/45">{L('анимация интерфейса · иллюстрация', 'интерфейс анимациясы · иллюстрация')}</div>
          </div>
        </div>
      </div>
    </section>
  )
}

export { TOTAL as FILM_DURATION }
