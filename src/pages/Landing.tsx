import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, Logo, type IconName } from '../components/Icon'
import { LangSwitch } from '../components/Layout'
import { CountUp, Reveal, useInView } from '../components/motion'
import { Skeleton } from '../components/ui'
import { kzt, num } from '../lib/format'
import { useLang } from '../lib/i18n'
import { supabase } from '../lib/supabase'

type Stats = { mass_kg: number; avoidable_kg: number; recyclable_kg: number; cost_kzt: number; co2_kg: number; entries: number; months: number; orgs: number; rescued_portions: number }
const STAT_KEYS: (keyof Stats)[] = ['mass_kg', 'avoidable_kg', 'recyclable_kg', 'cost_kzt', 'co2_kg', 'entries', 'months', 'orgs', 'rescued_portions']

/** Открытые итоги по принятым отчётам: функция public_stats доступна без входа. */
function usePublicStats() {
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

/* ---------- Иллюстрации ---------- */

function WheatEar({ className = '', style }: { className?: string; style?: CSSProperties }) {
  const rows = [0, 1, 2, 3, 4, 5, 6, 7]
  return (
    <svg viewBox="0 0 140 420" className={className} style={style} aria-hidden="true">
      <defs>
        <linearGradient id="ear-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f3cf7e" />
          <stop offset="1" stopColor="#c98a1b" />
        </linearGradient>
      </defs>
      <g className="animate-sway" style={{ animationDelay: style?.animationDelay }}>
        <path d="M70 420C67 340 73 270 70 168" fill="none" stroke="url(#ear-fill)" strokeWidth="3.500" strokeLinecap="round" />
        <path d="M70 318c22-30 42-38 56-32-12 18-30 28-56 32z" fill="url(#ear-fill)" opacity="0.850" />
        <path d="M70 352c-20-24-38-30-50-24 11 15 27 22 50 24z" fill="url(#ear-fill)" opacity="0.700" />
        {rows.map((i) => (
          <g key={i} transform={`translate(70 ${170 - i * 17}) scale(${1 - i * 0.045})`} fill="url(#ear-fill)">
            <path d="M0 0C-16-4-22-20-14-34-2-28 2-14 0 0z" />
            <path d="M0 0C16-4 22-20 14-34 2-28-2-14 0 0z" />
            <path d="M-14-34l-9-30M14-34l9-30" fill="none" stroke="#f3cf7e" strokeWidth="1" strokeLinecap="round" opacity="0.700" />
          </g>
        ))}
        <path d="M70 36c-8-12-7-27 0-38 7 11 8 26 0 38z" fill="url(#ear-fill)" transform="translate(0 6)" />
      </g>
    </svg>
  )
}

function SectionTitle({ kicker, title, sub }: { kicker: string; title: string; sub?: string }) {
  return (
    <Reveal className="mx-auto mb-8 max-w-2xl text-center sm:mb-10">
      <div className="text-xs font-bold uppercase tracking-[0.18em] text-wheat">{kicker}</div>
      <h2 className="mt-2 text-balance text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      {sub && <p className="mt-3 text-pretty text-base text-slate-600 sm:text-lg">{sub}</p>}
    </Reveal>
  )
}

function Example() {
  const { L } = useLang()
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{L('пример экрана', 'экран мысалы')}</span>
}

/* ---------- Разделы ---------- */

function Hero() {
  const { L } = useLang()
  const cta = 'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-base font-semibold transition duration-150 ease-out active:scale-[0.97]'
  return (
    <header className="brand-surface on-dark relative overflow-hidden text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-2">
          <Logo size={34} />
          <span className="text-lg font-bold tracking-tight">Qadir</span>
        </div>
        <div className="flex items-center gap-3">
          <LangSwitch />
          <Link to="/login" className="hidden rounded-lg px-3 py-1.5 text-sm font-semibold text-white/90 ring-1 ring-white/30 transition hover:bg-white/10 sm:block">{L('Войти', 'Кіру')}</Link>
        </div>
      </div>

      {/* Колосья: на телефоне — фоном справа, на широком экране — полноценная иллюстрация */}
      <div className="pointer-events-none absolute -right-6 bottom-0 flex items-end opacity-30 sm:right-4 sm:opacity-60 lg:right-[6%] lg:opacity-100">
        <WheatEar className="-mr-10 h-56 w-auto sm:h-72 lg:h-[26rem]" style={{ animationDelay: '-2.5s' }} />
        <WheatEar className="h-72 w-auto sm:h-96 lg:h-[34rem]" />
        <WheatEar className="-ml-12 hidden h-64 w-auto sm:block lg:h-[24rem]" style={{ animationDelay: '-4.5s' }} />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 sm:pb-24 sm:pt-16 lg:pb-32 lg:pt-24">
        <div className="max-w-2xl">
          <div className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 ring-1 ring-white/20">
            <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-wheat-light" />
            {L('Хакатон ATU Smart Food Industries · Трек 1', 'ATU Smart Food Industries хакатоны · 1-трек')}
          </div>
          <h1 className="animate-fade-up mt-5 text-6xl font-extrabold leading-none tracking-tight sm:text-7xl lg:text-8xl" style={{ animationDelay: '80ms' }}>Qadir</h1>
          <p className="animate-fade-up mt-5 max-w-xl text-pretty text-lg leading-relaxed text-white/85 sm:text-xl" style={{ animationDelay: '160ms' }}>
            {L('Нанның қадірі — уважение к хлебу. Учитываем и сокращаем пищевые отходы АТУ.', 'Нанның қадірі. АТУ тағам қалдықтарын есепке аламыз және азайтамыз.')}
          </p>
          <div className="animate-fade-up mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap" style={{ animationDelay: '240ms' }}>
            <Link to="/login" className={`${cta} bg-white text-brand-800 shadow-lg shadow-black/10 hover:bg-brand-50`}>
              {L('Войти', 'Кіру')} <Icon name="arrowRight" size={18} />
            </Link>
            <Link to="/login?guest=1" className={`${cta} bg-wheat text-white shadow-lg shadow-black/10 hover:brightness-110`}>
              {L('Гость жюри', 'Қазылар қонағы')}
            </Link>
            <Link to="/rescue" className={`${cta} bg-white/5 text-white ring-1 ring-white/40 backdrop-blur-sm hover:bg-white/15`}>
              <Icon name="bowl" size={18} /> {L('Спасённые порции', 'Құтқарылған порциялар')}
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}

function StatCard({ label, children, sub, wide, delay }: { label: string; children: ReactNode; sub?: string; wide?: boolean; delay: number }) {
  return (
    <Reveal delay={delay} className={wide ? 'col-span-2 lg:col-span-1' : ''}>
      <div className="h-full rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5 sm:p-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-2 whitespace-nowrap text-3xl font-extrabold tracking-tight text-brand-800 sm:text-4xl lg:text-5xl">{children}</div>
        {sub && <div className="mt-1.5 text-xs text-slate-500 sm:text-sm">{sub}</div>}
      </div>
    </Reveal>
  )
}

function LiveNumbers({ stats }: { stats: Stats | null }) {
  const { L } = useLang()
  const unit = (s: string) => <span className="ml-1 text-lg font-bold text-brand-600 sm:text-2xl">{s}</span>
  const D = 1100

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
      <SectionTitle
        kicker={L('Данные из базы', 'Базадағы деректер')}
        title={L('Что уже посчитано', 'Қазірдің өзінде есептелгені')}
        sub={L('Цифры считаются из принятых отчётов организаций АТУ в момент открытия страницы.', 'Сандар бет ашылған сәтте АТУ ұйымдарының қабылданған есептерінен есептеледі.')}
      />
      {!stats ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5 sm:p-6 ${i === 0 || i === 3 ? 'col-span-2 lg:col-span-1' : ''}`}>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-9 w-28 sm:h-12" />
              <Skeleton className="mt-3 h-3 w-20" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <StatCard wide delay={0} label={L('Учтено отходов', 'Есепке алынған қалдық')} sub={L('по взвешиваниям', 'өлшеулер бойынша')}>
            <CountUp value={stats.mass_kg / 1000} duration={D} format={(n) => num(n, 1)} />{unit(L('т', 'т'))}
          </StatCard>
          <StatCard delay={70} label={L('Предотвратимые', 'Алдын алуға болатын')} sub={L('доля от массы', 'массадағы үлесі')}>
            <CountUp value={stats.mass_kg > 0 ? (stats.avoidable_kg / stats.mass_kg) * 100 : 0} duration={D} format={(n) => num(n, 0)} />{unit('%')}
          </StatCard>
          <StatCard delay={140} label={L('CO₂-эквивалент', 'CO₂-баламасы')} sub={L('расчётная оценка', 'есептік бағалау')}>
            <CountUp value={stats.co2_kg / 1000} duration={D} format={(n) => num(n, 1)} />{unit(L('т', 'т'))}
          </StatCard>
          <StatCard wide delay={0} label={L('Потери в деньгах', 'Ақшалай шығын')} sub={L('оценка по допущениям', 'болжамдар бойынша бағалау')}>
            <CountUp value={stats.cost_kzt} duration={D} format={kzt} />
          </StatCard>
          <StatCard delay={70} label={L('Взвешиваний', 'Өлшеулер')} sub={L('записей в реестре', 'тізілімдегі жазба')}>
            <CountUp value={stats.entries} duration={D} />
          </StatCard>
          <StatCard delay={140} label={L('Организаций', 'Ұйымдар')} sub={L('подключено', 'қосылған')}>
            <CountUp value={stats.orgs} duration={D} />
          </StatCard>
        </div>
      )}
      <p className="mx-auto mt-6 max-w-3xl text-pretty text-center text-xs leading-relaxed text-slate-500 sm:text-sm">
        {stats && L(
          `Данные принятых отчётов за ${stats.months} мес. `,
          `Қабылданған есептердің ${stats.months} айдағы деректері. `,
        )}
        {L(
          'Суммы в тенге — оценка по принятым допущениям о стоимости продуктов, а не бухгалтерские данные. CO₂-эквивалент рассчитан по коэффициенту 2,5 кг CO₂e на 1 кг пищевых отходов (FAO, 2013).',
          'Теңгедегі сомалар — өнім құны туралы қабылданған болжамдар бойынша бағалау, бухгалтерлік дерек емес. CO₂-баламасы 1 кг тағам қалдығына 2,5 кг CO₂e коэффициентімен есептелген (FAO, 2013).',
        )}
      </p>
    </section>
  )
}

function Compare() {
  const { L } = useLang()
  const paper = [
    L('Данные сводят вручную раз в месяц', 'Деректер айына бір рет қолмен жинақталады'),
    L('Не видно причин потерь', 'Шығын себептері көрінбейді'),
    L('Нельзя проверить достоверность записей', 'Жазбалардың шынайылығын тексеру мүмкін емес'),
    L('Нет данных для ESG-отчётности', 'ESG есептілігіне дерек жоқ'),
  ]
  const qadir = [
    L('Запись со смартфона за секунды', 'Смартфоннан бірнеше секундта жазу'),
    L('Проверка отчёта с историей изменений', 'Есепті өзгерістер тарихымен тексеру'),
    L('Единый реестр и свод в Excel одной кнопкой', 'Бірыңғай тізілім және бір батырмамен Excel жиынтығы'),
    L('Аналитика в деньгах и CO₂', 'Ақша мен CO₂ бойынша аналитика'),
  ]
  return (
    <section className="border-y border-black/5 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <SectionTitle kicker={L('Было → стало', 'Болған → болды')} title={L('Бумажный журнал → Qadir', 'Қағаз журнал → Qadir')} />
        <div className="grid gap-4 md:grid-cols-2 md:gap-6">
          <Reveal>
            <div className="h-full rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200 sm:p-7">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-200 text-slate-600"><Icon name="pencil" /></span>
                <h3 className="text-lg font-bold text-slate-700">{L('Бумажный журнал', 'Қағаз журнал')}</h3>
              </div>
              <ul className="mt-5 space-y-3.5">
                {paper.map((t) => (
                  <li key={t} className="flex gap-3 text-slate-600">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-500"><Icon name="x" size={12} strokeWidth={2.6} /></span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="h-full rounded-2xl bg-brand-50 p-5 shadow-card ring-2 ring-brand-500/40 sm:p-7">
              <div className="flex items-center gap-3">
                <Logo size={40} />
                <h3 className="text-lg font-bold text-brand-900">Qadir</h3>
              </div>
              <ul className="mt-5 space-y-3.5">
                {qadir.map((t) => (
                  <li key={t} className="flex gap-3 font-medium text-brand-900">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3.200" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.500l4.500 4.500L19 7.500" /></svg>
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function Flow() {
  const { L } = useLang()
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.25 })
  const steps: { icon: IconName; title: string; text: string }[] = [
    { icon: 'scale', title: L('Измерить', 'Өлшеу'), text: L('Ввод со смартфона, с весов или по фото', 'Смартфоннан, таразыдан немесе фото арқылы енгізу') },
    { icon: 'shield', title: L('Проверить', 'Тексеру'), text: L('Проверяющий и индекс достоверности отчёта', 'Тексеруші және есептің шынайылық индексі') },
    { icon: 'chart', title: L('Понять', 'Түсіну'), text: L('Предотвратимые отходы, ₸, CO₂, граммы на порцию', 'Алдын алуға болатын қалдық, ₸, CO₂, бір порцияға грамм') },
    { icon: 'bulb', title: L('Действовать', 'Әрекет ету'), text: L('Спасённые порции, рекомендации, отчёт ЦУР 12.3', 'Құтқарылған порциялар, ұсынымдар, ТДМ 12.3 есебі') },
  ]
  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
      <SectionTitle
        kicker={L('Как это работает', 'Қалай жұмыс істейді')}
        title={L('От взвешивания до решения', 'Өлшеуден шешімге дейін')}
        sub={L('Один непрерывный контур вместо разрозненных таблиц.', 'Бытыраңқы кестелердің орнына бір үздіксіз контур.')}
      />
      <div ref={ref} className={`relative mx-auto max-w-md md:max-w-none ${inView ? 'is-in' : ''}`}>
        <ol className="relative grid gap-7 md:grid-cols-4 md:gap-4">
          {steps.map((s, i) => (
            <li key={s.title} className="flow-step relative flex items-start gap-4 md:flex-col md:items-center md:gap-0 md:text-center" style={{ '--step-delay': `${150 + i * 480}ms` } as CSSProperties}>
              {/* соединительная линия к следующему шагу: вертикальная на телефоне, горизонтальная на широком экране */}
              {i < steps.length - 1 && (
                <span aria-hidden="true" className="absolute -bottom-7 left-7 top-14 w-0.5 -translate-x-1/2 bg-slate-200 md:bottom-auto md:left-[calc(50%+28px)] md:top-7 md:h-0.5 md:w-[calc(100%-40px)] md:-translate-y-1/2 md:translate-x-0">
                  <span className="flow-line block h-full w-full bg-brand-600" />
                </span>
              )}
              <span className="flow-dot grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-slate-400 ring-1 ring-slate-200">
                <Icon name={s.icon} size={24} />
              </span>
              <div className="flow-text pt-1 md:mt-5 md:px-2 md:pt-0">
                <div className="text-xs font-bold text-wheat">{L('Шаг', 'Қадам')} {i + 1}</div>
                <h3 className="text-lg font-bold text-slate-900">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function FeatureCard({ icon, title, text, children, delay }: { icon: IconName; title: string; text: string; children: ReactNode; delay: number }) {
  return (
    <Reveal delay={delay}>
      <article className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-card ring-1 ring-black/5 transition duration-200 hover:-translate-y-1 hover:shadow-lift sm:p-6">
        <div className="mb-5 rounded-xl bg-paper p-4 ring-1 ring-black/5">{children}</div>
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-100 text-brand-700"><Icon name={icon} size={18} /></span>
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
      </article>
    </Reveal>
  )
}

function Features({ stats }: { stats: Stats | null }) {
  const { L } = useLang()
  const R = 40
  const len = 2 * Math.PI * R
  const score = 58
  return (
    <section className="border-t border-black/5 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <SectionTitle kicker={L('Чем отличается', 'Айырмашылығы')} title={L('Не просто «сколько выбросили»', 'Жай ғана «қанша тасталды» емес')} />
        <div className="grid gap-4 md:grid-cols-3 md:gap-6">
          <FeatureCard
            delay={0} icon="chart" title={L('Правильная метрика', 'Дұрыс метрика')}
            text={L('Отходы делятся на предотвратимые и неизбежные и пересчитываются в граммы на порцию — так видно, над чем реально можно работать.', 'Қалдықтар алдын алуға болатын және болмай қоймайтын болып бөлініп, бір порцияға граммен есептеледі — нақты немен жұмыс істеуге болатыны көрінеді.')}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>{L('Структура отходов', 'Қалдық құрылымы')}</span><Example />
            </div>
            <div className="mt-3 flex h-3.5 overflow-hidden rounded-full bg-slate-200">
              <div className="bar-grow h-full w-[58%] bg-wheat" />
              <div className="bar-grow h-full w-[42%] bg-brand-500" style={{ '--bar-delay': '0.45s' } as CSSProperties} />
            </div>
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-wheat" />{L('предотвратимые', 'алдын алуға болатын')}</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-brand-500" />{L('неизбежные', 'болмай қоймайтын')}</span>
            </div>
            <div className="mt-4 flex items-baseline gap-2 border-t border-black/5 pt-3">
              <span className="tnum text-3xl font-extrabold tracking-tight text-slate-900">84</span>
              <span className="text-sm font-medium text-slate-500">{L('г на порцию', 'г / порция')}</span>
            </div>
          </FeatureCard>

          <FeatureCard
            delay={120} icon="shield" title={L('Индекс достоверности', 'Шынайылық индексі')}
            text={L('Автопроверка ищет признаки заполнения «задним числом» и «на глаз». Проверяющий видит оценку 0–100 и её причины.', 'Автотексеру «өткен күнмен» және «көзбен шамалап» толтыру белгілерін іздейді. Тексеруші 0–100 бағасын және себептерін көреді.')}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>{L('Отчёт на проверке', 'Тексерудегі есеп')}</span><Example />
            </div>
            <div className="mt-3 flex items-center gap-4">
              <div className="relative h-24 w-24 shrink-0">
                <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
                  <circle cx="50" cy="50" r={R} fill="none" stroke="#e2e8f0" strokeWidth="9" />
                  <circle
                    cx="50" cy="50" r={R} fill="none" stroke="var(--color-wheat)" strokeWidth="9" strokeLinecap="round" className="ring-progress"
                    style={{ '--ring-len': len, '--ring-off': len * (1 - score / 100) } as CSSProperties}
                  />
                </svg>
                <div className="absolute inset-0 grid place-items-center text-2xl font-extrabold text-slate-900"><CountUp value={score} duration={1200} /></div>
              </div>
              <ul className="min-w-0 space-y-1.5 text-xs text-slate-600">
                {[L('записи внесены пачкой', 'жазбалар топтап енгізілген'), L('много круглых значений', 'дөңгелек мәндер көп'), L('пропущены дни', 'күндер өткізілген')].map((r) => (
                  <li key={r} className="flex items-start gap-1.5"><i className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-wheat" />{r}</li>
                ))}
              </ul>
            </div>
          </FeatureCard>

          <FeatureCard
            delay={240} icon="bowl" title={L('Контур действия', 'Әрекет контуры')}
            text={L('Столовая выставляет остатки дня со скидкой, студенты видят их на открытой странице. Еда достаётся людям, а не баку.', 'Асхана күн соңындағы қалдықты жеңілдікпен ұсынады, студенттер оны ашық беттен көреді. Тамақ қоқысқа емес, адамдарға жетеді.')}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>{L('Спасённые порции', 'Құтқарылған порциялар')}</span><Example />
            </div>
            <div className="mt-3 rounded-xl bg-white p-3 shadow-card ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-bold text-slate-900">{L('Плов с говядиной', 'Сиыр етінен палау')}</div>
                  <div className="text-xs text-slate-500">{L('6 порций · до 16:00', '6 порция · 16:00-ге дейін')}</div>
                </div>
                <span className="shrink-0 rounded-full bg-wheat-soft px-2 py-0.5 text-xs font-bold text-wheat">−40%</span>
              </div>
              <div className="mt-3 rounded-lg bg-brand-700 py-1.5 text-center text-xs font-semibold text-white">{L('Забронировать', 'Брондау')}</div>
            </div>
            {stats && stats.rescued_portions > 0 && (
              <div className="mt-3 text-xs text-slate-600">
                {L('Уже спасено порций:', 'Құтқарылған порция:')} <b className="text-brand-700"><CountUp value={stats.rescued_portions} duration={1000} /></b>
              </div>
            )}
          </FeatureCard>
        </div>

        <Reveal className="mt-12 text-center">
          <Link to="/login?guest=1" className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-6 py-3.5 text-base font-semibold text-white shadow-sm shadow-brand-900/20 transition duration-150 hover:bg-brand-800 active:scale-[0.97]">
            {L('Попробовать как гость жюри', 'Қазылар қонағы ретінде байқап көру')} <Icon name="arrowRight" size={18} />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

function Footer() {
  const { L } = useLang()
  return (
    <footer className="on-dark bg-brand-950 text-white/70">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-8 text-center text-sm sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-3">
          <Logo size={28} />
          <span>{L('Qadir Team · хакатон ATU Smart Food Industries · Трек 1', 'Qadir Team · ATU Smart Food Industries хакатоны · 1-трек')}</span>
        </div>
        <div className="flex items-center gap-5 font-semibold text-white/85">
          <Link to="/rescue" className="transition-colors hover:text-white">{L('Спасённые порции', 'Құтқарылған порциялар')}</Link>
          <Link to="/login" className="transition-colors hover:text-white">{L('Войти', 'Кіру')}</Link>
        </div>
      </div>
    </footer>
  )
}

export default function Landing() {
  const { stats, failed } = usePublicStats()
  return (
    <div className="flex min-h-full flex-col overflow-x-clip bg-paper">
      <Hero />
      <main className="flex-1">
        {!failed && <LiveNumbers stats={stats} />}
        <Compare />
        <Flow />
        <Features stats={stats} />
      </main>
      <Footer />
    </div>
  )
}
