import { useEffect, useState, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { CountUp } from '../motion'
import { kzt, num } from '../../lib/format'
import { useLang } from '../../lib/i18n'
import { supabase } from '../../lib/supabase'
import { EASE, SectionTitle } from './shared'

export type Stats = { mass_kg: number; avoidable_kg: number; recyclable_kg: number; cost_kzt: number; co2_kg: number; entries: number; months: number; orgs: number; rescued_portions: number }
const STAT_KEYS: (keyof Stats)[] = ['mass_kg', 'avoidable_kg', 'recyclable_kg', 'cost_kzt', 'co2_kg', 'entries', 'months', 'orgs', 'rescued_portions']

/** Открытые итоги по принятым отчётам: функция public_stats доступна без входа. */
export function usePublicStats() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    supabase.rpc('public_stats').then(
      ({ data, error }) => {
        if (!alive) return
        const raw = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null
        if (error || !raw || typeof raw !== 'object') { setFailed(true); return }
        const s = {} as Stats
        for (const k of STAT_KEYS) s[k] = Number(raw[k]) || 0
        setStats(s)
      },
      () => { if (alive) setFailed(true) },
    )
    return () => { alive = false }
  }, [])
  return { stats, failed }
}

function StatCard({ label, children, sub, wide, i }: { label: string; children: ReactNode; sub?: string; wide?: boolean; i: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={wide ? 'col-span-2 lg:col-span-1' : ''}
      initial={reduce ? false : { opacity: 0, y: 30, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ delay: (i % 3) * 0.08, duration: 0.7, ease: EASE }}
    >
      <div className="group relative h-full overflow-hidden rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5 transition duration-300 hover:-translate-y-1 hover:shadow-lift sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-wheat-soft opacity-70 transition-transform duration-500 group-hover:scale-125" />
        <div className="relative text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="relative mt-2 whitespace-nowrap text-[1.7rem] font-extrabold tracking-tight text-brand-800 sm:text-4xl lg:text-5xl">{children}</div>
        {sub && <div className="relative mt-1.5 text-xs text-slate-500 sm:text-sm">{sub}</div>}
      </div>
    </motion.div>
  )
}

export default function LiveNumbers({ stats, failed }: { stats: Stats | null; failed: boolean }) {
  const { L } = useLang()
  if (failed) return null
  const unit = (s: string) => <span className="ml-1 text-base font-bold text-brand-600 sm:text-2xl">{s}</span>
  const D = 1400
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
      <SectionTitle
        kicker={L('Живые данные', 'Тірі деректер')}
        title={L('Что уже посчитано', 'Қазірдің өзінде есептелгені')}
        sub={L('Цифры считаются из принятых отчётов организаций АТУ в момент открытия страницы.', 'Сандар бет ашылған сәтте АТУ ұйымдарының қабылданған есептерінен есептеледі.')}
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {!stats ? (
          [0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5 sm:p-6 ${i === 0 || i === 3 ? 'col-span-2 lg:col-span-1' : ''}`}>
              <div className="lp-skel h-3 w-24" />
              <div className="lp-skel mt-3 h-9 w-28 sm:h-12" />
              <div className="lp-skel mt-3 h-3 w-20" />
            </div>
          ))
        ) : (
          <>
            <StatCard wide i={0} label={L('Учтено отходов', 'Есепке алынған қалдық')} sub={L('по взвешиваниям', 'өлшеулер бойынша')}>
              <CountUp value={stats.mass_kg / 1000} duration={D} format={(n) => num(n, 1)} />{unit('т')}
            </StatCard>
            <StatCard i={1} label={L('Предотвратимые', 'Алдын алуға болатын')} sub={L('доля от массы', 'массадағы үлесі')}>
              <CountUp value={stats.mass_kg > 0 ? (stats.avoidable_kg / stats.mass_kg) * 100 : 0} duration={D} format={(n) => num(n, 0)} />{unit('%')}
            </StatCard>
            <StatCard i={2} label={L('CO₂-эквивалент', 'CO₂-баламасы')} sub={L('расчётная оценка', 'есептік бағалау')}>
              <CountUp value={stats.co2_kg / 1000} duration={D} format={(n) => num(n, 1)} />{unit('т')}
            </StatCard>
            <StatCard wide i={3} label={L('Потери в деньгах', 'Ақшалай шығын')} sub={L('оценка по допущениям', 'болжамдар бойынша бағалау')}>
              <CountUp value={stats.cost_kzt} duration={D} format={kzt} />
            </StatCard>
            <StatCard i={4} label={L('Взвешиваний', 'Өлшеулер')} sub={L('записей в реестре', 'тізілімдегі жазба')}>
              <CountUp value={stats.entries} duration={D} />
            </StatCard>
            <StatCard i={5} label={stats.rescued_portions > 0 ? L('Спасено порций', 'Құтқарылған порция') : L('Организаций', 'Ұйымдар')} sub={stats.rescued_portions > 0 ? L('через «Спасённые порции»', '«Құтқарылған порциялар» арқылы') : L('подключено', 'қосылған')}>
              <CountUp value={stats.rescued_portions > 0 ? stats.rescued_portions : stats.orgs} duration={D} />
            </StatCard>
          </>
        )}
      </div>
      <p className="mx-auto mt-6 max-w-3xl text-pretty text-center text-xs leading-relaxed text-slate-500 sm:text-sm">
        {stats && L(`Данные принятых отчётов за ${stats.months} мес., организаций: ${stats.orgs}. `, `Қабылданған есептердің ${stats.months} айдағы деректері, ұйымдар: ${stats.orgs}. `)}
        {L(
          'Суммы в тенге — оценка по принятым допущениям о стоимости продуктов, а не бухгалтерские данные. CO₂-эквивалент рассчитан по коэффициенту 2,5 кг CO₂e на 1 кг пищевых отходов (FAO, 2013).',
          'Теңгедегі сомалар — өнім құны туралы қабылданған болжамдар бойынша бағалау, бухгалтерлік дерек емес. CO₂-баламасы 1 кг тағам қалдығына 2,5 кг CO₂e коэффициентімен есептелген (FAO, 2013).',
        )}
      </p>
    </section>
  )
}
