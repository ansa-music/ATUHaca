import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react'
import { Logo } from '../Icon'
import { useLang } from '../../lib/i18n'
import { EASE, SectionTitle } from './shared'

const ROWS = [
  { d: '11.11', ru: 'Хлеб', kk: 'Нан', kg: '3,2', hand: '3.2 кг?' },
  { d: '11.11', ru: 'Гарнир из зала', kk: 'Залдан гарнир', kg: '4,7', hand: '47' },
  { d: '12.11', ru: 'Подготовка', kk: 'Дайындық', kg: '1,9', hand: '~2' },
  { d: '12.11', ru: 'Супы', kk: 'Сорпалар', kg: '2,6', hand: '2,6' },
]

/** Бумажный журнал «растворяется» и собирается в живую таблицу. Цикл повторяется, пока секция на экране. */
export default function PaperToDigital() {
  const { L } = useLang()
  const reduce = !!useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.35 })
  const [digital, setDigital] = useState(reduce)

  useEffect(() => {
    if (reduce) { setDigital(true); return }
    if (!inView) return
    const id = window.setInterval(() => setDigital((d) => !d), 4200)
    const first = window.setTimeout(() => setDigital(true), 1200)
    return () => { clearInterval(id); clearTimeout(first) }
  }, [inView, reduce])

  const paper = [
    L('Сводится вручную раз в месяц', 'Айына бір рет қолмен жинақталады'),
    L('Нельзя проверить, когда сделана запись', 'Жазба қашан жасалғанын тексеру мүмкін емес'),
    L('Причины потерь не видны', 'Шығын себептері көрінбейді'),
  ]
  const qadir = [
    L('Запись со смартфона в момент взвешивания', 'Өлшеу сәтінде смартфоннан жазу'),
    L('Автопроверка и история изменений', 'Автотексеру және өзгерістер тарихы'),
    L('Аналитика в ₸, CO₂ и граммах на порцию', '₸, CO₂ және порцияға грамм бойынша аналитика'),
  ]

  return (
    <section className="border-y border-black/5 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <SectionTitle kicker={L('Было → стало', 'Болған → болды')} title={L('Бумажный журнал → Qadir', 'Қағаз журнал → Qadir')} sub={L('Те же записи — но теперь проверяемые и живые.', 'Сол жазбалар — енді тексерілетін және тірі.')} />

        <div ref={ref} className="relative mx-auto h-[330px] max-w-xl sm:h-[340px]">
          {/* бумага */}
          <motion.div className="lp-paper absolute inset-0 rounded-2xl p-5 pl-12 shadow-lift ring-1 ring-black/10"
            animate={digital ? { rotate: -6, x: -18, y: 14, scale: 0.92, opacity: 0.35, filter: 'blur(2px)' } : { rotate: -2, x: 0, y: 0, scale: 1, opacity: 1, filter: 'blur(0px)' }}
            transition={{ duration: reduce ? 0 : 0.9, ease: EASE }}>
            <div className="lp-hand text-lg text-slate-700">{L('Журнал отходов · ноябрь', 'Қалдық журналы · қараша')}</div>
            <div className="mt-4 space-y-[8px]">
              {ROWS.map((r, i) => (
                <motion.div key={i} className="lp-hand flex gap-4 text-[17px] leading-6 text-blue-900/80" style={{ rotate: `${(i % 2 ? 1 : -1) * 0.8}deg` }}
                  animate={digital ? { opacity: 0, x: 40, filter: 'blur(6px)' } : { opacity: 1, x: 0, filter: 'blur(0px)' }}
                  transition={{ delay: reduce ? 0 : digital ? i * 0.12 : 0.3 + i * 0.1, duration: reduce ? 0 : 0.5 }}>
                  <span className="w-12 shrink-0">{r.d}</span>
                  <span className="min-w-0 flex-1 truncate">{L(r.ru, r.kk)}</span>
                  <span className={i === 1 ? 'text-red-700 line-through decoration-2' : ''}>{r.hand}</span>
                </motion.div>
              ))}
              <div className="lp-hand pt-2 text-[15px] text-slate-400">{L('подпись: ______', 'қолы: ______')}</div>
            </div>
          </motion.div>

          {/* живая таблица */}
          <AnimatePresence>
            {digital && (
              <motion.div className="absolute inset-0 overflow-hidden rounded-2xl bg-white shadow-lift ring-2 ring-brand-500/40"
                initial={reduce ? false : { opacity: 0, rotate: 3, x: 24, y: -10, scale: 0.95 }} animate={{ opacity: 1, rotate: 1, x: 10, y: -6, scale: 1 }} exit={{ opacity: 0, x: 30, rotate: 4 }}
                transition={{ duration: 0.7, ease: EASE }}>
                <div className="flex items-center justify-between bg-brand-800 px-4 py-2.5 text-white">
                  <div className="flex items-center gap-2 text-sm font-bold"><Logo size={22} /> {L('Реестр взвешиваний', 'Өлшеулер тізілімі')}</div>
                  <span className="flex items-center gap-1.5 text-[11px] text-white/80"><span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-wheat-light" />live</span>
                </div>
                <table className="w-full text-left text-sm">
                  <thead className="text-[11px] uppercase text-slate-400">
                    <tr><th className="px-4 py-2 font-semibold">{L('Дата', 'Күні')}</th><th className="py-2 font-semibold">{L('Категория', 'Санат')}</th><th className="px-4 py-2 text-right font-semibold">{L('кг', 'кг')}</th></tr>
                  </thead>
                  <tbody>
                    {ROWS.map((r, i) => (
                      <motion.tr key={i} className="border-t border-black/5"
                        initial={reduce ? false : { opacity: 0, y: -14, backgroundColor: 'rgba(233,185,88,0.35)' }} animate={{ opacity: 1, y: 0, backgroundColor: 'rgba(255,255,255,0)' }}
                        transition={{ delay: 0.35 + i * 0.14, duration: 0.6, ease: EASE }}>
                        <td className="tnum px-4 py-2 text-slate-500">{r.d}</td>
                        <td className="truncate py-2 font-medium text-slate-800">{L(r.ru, r.kk)}</td>
                        <td className="tnum px-4 py-2 text-right font-bold text-brand-800">{r.kg}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
                <motion.div className="mx-4 mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-[11px] font-semibold text-brand-800"
                  initial={reduce ? false : { opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.1 }}>
                  ✓ {L('«47» исправлено на 4,7 кг после проверки', '«47» тексеруден кейін 4,7 кг болып түзетілді')}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
          <ul className="space-y-3 rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
            {paper.map((t) => <li key={t} className="flex gap-2.5 text-slate-600"><span className="text-slate-400">✕</span>{t}</li>)}
          </ul>
          <ul className="space-y-3 rounded-2xl bg-brand-50 p-5 ring-2 ring-brand-500/30">
            {qadir.map((t) => <li key={t} className="flex gap-2.5 font-medium text-brand-900"><span className="text-brand-600">✓</span>{t}</li>)}
          </ul>
        </div>
      </div>
    </section>
  )
}
