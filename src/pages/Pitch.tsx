import { AnimatePresence, motion } from 'motion/react'
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Презентация Qadir для защиты — 12 слайдов 16:9 по структуре п. 11.5 регламента.
 * Листание: ← → / пробел / клик по краям. F — полный экран. P — печать в PDF (все слайды по одному на страницу).
 * Фоновые ролики сгенерированы в Higgsfield (Seedance 2.5, 480p) и лежат в /public/pitch.
 */

type Stats = { mass_kg: number; avoidable_kg: number; recyclable_kg: number; cost_kzt: number; co2_kg: number; entries: number; months: number; orgs: number }

const C = { bg: '#fff9e8', ink: '#2a2106', ink2: '#5a4a1c', muted: '#725f2e', yellow: '#ffc928', gold: '#8a5d00', soft: '#fff1c2', border: '#f1e3b5', green: '#1f7a45', red: '#c4372d' }
const fmt = (n: number, d = 0) => n.toLocaleString('ru-RU', { maximumFractionDigits: d })
const SITE = 'https://qadir-atu.vercel.app'

function Bg({ video, dark = false }: { video?: string; dark?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {video && <video className="pitch-video absolute inset-0 h-full w-full object-cover" src={video} autoPlay muted loop playsInline />}
      <div className="absolute inset-0" style={{ background: dark ? 'linear-gradient(90deg, rgba(25,18,2,.82) 0%, rgba(25,18,2,.55) 55%, rgba(25,18,2,.25) 100%)' : 'linear-gradient(90deg, rgba(255,249,232,.97) 0%, rgba(255,249,232,.9) 52%, rgba(255,249,232,.35) 100%)' }} />
    </div>
  )
}

function Kicker({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return <div className="text-[1.3cqw] font-bold uppercase tracking-[0.18em]" style={{ color: dark ? C.yellow : C.gold }}>{children}</div>
}
function H({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return <h2 className="mt-[0.8cqw] text-[3.6cqw] font-extrabold leading-[1.05] tracking-tight" style={{ color: dark ? '#fff' : C.ink }}>{children}</h2>
}
function Stat({ value, label, sub, dark }: { value: string; label: string; sub?: string; dark?: boolean }) {
  return (
    <div className="rounded-[1.2cqw] p-[1.2cqw]" style={{ background: dark ? 'rgba(255,255,255,.1)' : '#fff', border: `1px solid ${dark ? 'rgba(255,255,255,.18)' : C.border}` }}>
      <div className="text-[3cqw] font-extrabold leading-none tabular-nums" style={{ color: dark ? C.yellow : C.ink }}>{value}</div>
      <div className="mt-[0.5cqw] text-[1.15cqw] font-semibold" style={{ color: dark ? '#fff' : C.ink2 }}>{label}</div>
      {sub && <div className="mt-[0.2cqw] text-[0.95cqw]" style={{ color: dark ? 'rgba(255,255,255,.7)' : C.muted }}>{sub}</div>}
    </div>
  )
}
const Note = ({ children }: { children: ReactNode }) => <div className="absolute bottom-[1.6cqw] left-[4cqw] right-[4cqw] text-[0.85cqw]" style={{ color: C.muted }}>{children}</div>
const Bullet = ({ children, dark }: { children: ReactNode; dark?: boolean }) => (
  <li className="flex gap-[0.8cqw] text-[1.45cqw] leading-snug" style={{ color: dark ? 'rgba(255,255,255,.92)' : C.ink2 }}>
    <span className="mt-[0.55cqw] h-[0.7cqw] w-[0.7cqw] shrink-0 rounded-full" style={{ background: C.yellow }} />
    <span>{children}</span>
  </li>
)

export default function Pitch() {
  const [i, setI] = useState(0)
  const [stats, setStats] = useState<Stats | null>(null)
  // ?print=1 — все слайды подряд (для сохранения в PDF без диалога, например headless-браузером).
  const printParam = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('print')
  const [printing, setPrinting] = useState(printParam)

  useEffect(() => {
    supabase.rpc('public_stats').then(({ data }) => { if (data) setStats(data as Stats) })
  }, [])

  const s = stats ?? { mass_kg: 8385, avoidable_kg: 3996, recyclable_kg: 3523, cost_kzt: 5168855, co2_kg: 18932, entries: 1784, months: 4, orgs: 5 }
  const perYear = (v: number) => (s.months ? (v / s.months) * 12 : v)
  const avoidShare = s.mass_kg ? (s.avoidable_kg / s.mass_kg) * 100 : 0
  // Экономика — допущения команды (подписаны на слайде).
  const lossYear = perYear(s.cost_kzt)
  const saveFood = lossYear * 0.2            // сокращение предотвратимых потерь на 20 %
  const hoursYear = 186                      // экономия часов учёта и сведения в год (расчёт на слайде 3)
  const saveHours = hoursYear * 2500         // ₸ за час работы сотрудника
  const capex = 300000, opexYear = 20000 * 12
  const benefit = saveFood + saveHours - opexYear
  const paybackMonths = benefit > 0 ? (capex / benefit) * 12 : 0

  const slides: { video?: string; dark?: boolean; body: ReactNode }[] = [
    // 1. Титул
    {
      video: '/pitch/1.mp4',
      body: (
        <div className="flex h-full flex-col justify-center">
          <div className="flex items-center gap-[1.4cqw]">
            <img src="/logo.png" alt="" className="h-[7cqw] w-[7cqw]" />
            <div>
              <div className="text-[6.5cqw] font-black leading-none tracking-tight" style={{ color: C.ink }}>Qadir</div>
              <div className="mt-[0.4cqw] text-[1.6cqw] font-semibold" style={{ color: C.gold }}>«Нанның қадірі» — уважение к хлебу</div>
            </div>
          </div>
          <p className="mt-[2.4cqw] max-w-[50cqw] text-[2cqw] font-semibold leading-snug" style={{ color: C.ink }}>
            Цифровая система учёта и сокращения пищевых отходов университетского комплекса АТУ
          </p>
          <div className="mt-[2cqw] flex flex-wrap gap-[0.8cqw] text-[1.15cqw] font-semibold">
            {['Хакатон ATU Smart Food Industries', 'Трек 1 · Digital Food Waste Management', 'Qadir Team'].map((t) => (
              <span key={t} className="rounded-full px-[1.1cqw] py-[0.4cqw]" style={{ background: C.soft, color: C.gold }}>{t}</span>
            ))}
          </div>
          <div className="mt-[3cqw] text-[1.2cqw]" style={{ color: C.ink2 }}>Работающая система: <b>{SITE.replace('https://', '')}</b></div>
        </div>
      ),
    },
    // 2. Проблема в цифрах
    {
      video: '/pitch/2.mp4', dark: true,
      body: (
        <div className="flex h-full flex-col justify-center">
          <Kicker dark>Проблема</Kicker>
          <H dark>Еду выбрасывают — и никто не знает, сколько и почему</H>
          <div className="mt-[2.4cqw] grid max-w-[60cqw] grid-cols-3 gap-[1cqw]">
            <Stat dark value="1,05 млрд т" label="еды выброшено в мире за 2022 год" sub="UNEP Food Waste Index 2024" />
            <Stat dark value="28 %" label="из них — общепит" sub="UNEP, 2024" />
            <Stat dark value={`${fmt(avoidShare)} %`} label="отходов АТУ можно было не выбрасывать" sub="демо-данные по образцам АТУ" />
          </div>
          <ul className="mt-[2cqw] max-w-[58cqw] space-y-[0.6cqw]">
            <Bullet dark>5 подразделений АТУ ведут учёт на бумаге, сводят журналы вручную</Bullet>
            <Bullet dark>Нет причин потерь, нет проверки, нет данных для ESG и рейтинга по ЦУР 12</Bullet>
            <Bullet dark>Деньги уходят на лишние закупки и вывоз отходов</Bullet>
          </ul>
        </div>
      ),
    },
    // 3. Как есть → как будет
    {
      body: (
        <div className="flex h-full flex-col justify-center">
          <Kicker>Процесс</Kicker>
          <H>Как есть → как будет</H>
          <div className="mt-[2cqw] grid grid-cols-2 gap-[1.6cqw]">
            {[
              { t: 'Сейчас: бумажный журнал', c: C.red, rows: [['Запись взвешивания', '~3 мин'], ['Сведение журнала за месяц', '~1 ч на точку'], ['Свод по 5 точкам + отчёт', '~6,5 ч'], ['Проверка достоверности', 'нет'], ['Данные для ЦУР / ESG', 'нет']] },
              { t: 'С Qadir', c: C.green, rows: [['Запись: фото → ИИ → «Сохранить»', '10–20 с'], ['Итоги дня и месяца', 'сами'], ['Свод и Excel', '1 кнопка'], ['Проверка', 'индекс + заключение ИИ'], ['Отчёт ЦУР 12.3', '1 кнопка']] },
            ].map((col) => (
              <div key={col.t} className="rounded-[1.4cqw] bg-white p-[1.6cqw]" style={{ border: `2px solid ${col.c}22` }}>
                <div className="text-[1.6cqw] font-bold" style={{ color: col.c }}>{col.t}</div>
                <div className="mt-[1cqw] space-y-[0.6cqw]">
                  {col.rows.map(([a, b]) => (
                    <div key={a} className="flex items-baseline justify-between gap-[1cqw] border-b pb-[0.5cqw] text-[1.3cqw]" style={{ borderColor: C.border, color: C.ink2 }}>
                      <span>{a}</span><b className="whitespace-nowrap" style={{ color: C.ink }}>{b}</b>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-[1.6cqw] rounded-[1cqw] px-[1.4cqw] py-[0.9cqw] text-[1.5cqw] font-bold" style={{ background: C.yellow, color: C.ink }}>
            Экономия ≈ 15,5 часа в месяц ≈ {hoursYear} часов в год на учёте и сведении
          </div>
          <Note>Допущения команды: 22 рабочих дня, 5 точек; проверка в Qadir ~10 мин на отчёт. Замер «бумага против телефона» — на пилоте.</Note>
        </div>
      ),
    },
    // 4. Аналоги
    {
      body: (
        <div className="flex h-full flex-col justify-center">
          <Kicker>Анализ</Kicker>
          <H>Аналоги и их ограничения</H>
          <table className="mt-[2cqw] w-full text-left text-[1.25cqw]" style={{ color: C.ink2 }}>
            <thead><tr className="text-[1cqw] uppercase tracking-wider" style={{ color: C.muted }}>
              <th className="py-[0.6cqw]"> </th><th>Winnow, Leanpath, Orbisk</th><th>Excel / бумага</th><th style={{ color: C.gold }}>Qadir</th>
            </tr></thead>
            <tbody>
              {[
                ['Оборудование', 'специальные весы и камеры', 'нет', 'смартфон; весы по желанию (API)'],
                ['Стоимость', 'подписка + оборудование', 'бесплатно', 'бесплатный пилот, затем подписка'],
                ['Проверка данных', 'частично', 'нет', 'отчёт + индекс достоверности + ИИ'],
                ['Отчётность РК, ЦУР 12', 'нет', 'вручную', 'свод по бланкам АТУ, отчёт ЦУР 12.3'],
                ['Казахский язык', 'нет', '—', 'да'],
                ['Несколько подразделений вуза', 'ориентир на кухню', 'отдельные файлы', 'единый реестр, роли'],
              ].map((r) => (
                <tr key={r[0]} className="border-t" style={{ borderColor: C.border }}>
                  <td className="py-[0.75cqw] font-semibold" style={{ color: C.ink }}>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td><td className="font-semibold" style={{ color: C.ink }}>{r[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ),
    },
    // 5. Решение
    {
      video: '/pitch/3.mp4',
      body: (
        <div className="flex h-full flex-col justify-center">
          <Kicker>Решение</Kicker>
          <H>Измерить → Проверить → Понять → Действовать</H>
          <div className="mt-[2cqw] grid max-w-[60cqw] grid-cols-2 gap-[1cqw]">
            {[
              ['📷 Измерить', 'Фото — ИИ узнаёт вид отхода и оценивает вес. Голос, текст, весы, перенос бумажного журнала.'],
              ['✅ Проверить', 'Отчёт за месяц одной кнопкой. Индекс достоверности и заключение ИИ для проверяющего.'],
              ['📊 Понять', 'Единый реестр, свод, дашборд: предотвратимые отходы, ₸, CO₂, граммы на порцию.'],
              ['🍲 Действовать', 'Рекомендации ИИ, «Спасённые порции», отчёт ЦУР 12.3, напоминания и автоматизации.'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-[1.2cqw] bg-white/95 p-[1.3cqw]" style={{ border: `1px solid ${C.border}` }}>
                <div className="text-[1.6cqw] font-bold" style={{ color: C.ink }}>{t}</div>
                <div className="mt-[0.4cqw] text-[1.2cqw] leading-snug" style={{ color: C.ink2 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    // 6. Технология и демо
    {
      body: (
        <div className="grid h-full grid-cols-[1.35fr_1fr] items-center gap-[3cqw]">
          <div>
            <Kicker>Технология и демо</Kicker>
            <H>Работающий MVP — полный цикл ТЗ</H>
            <div className="mt-[1.6cqw] space-y-[0.7cqw] text-[1.3cqw]" style={{ color: C.ink2 }}>
              {[
                ['Интерфейс', 'React + TypeScript, телефон и ноутбук, русский и казахский'],
                ['Данные', 'PostgreSQL (Supabase), права ролей на сервере (RLS)'],
                ['Автоматизации', 'триггеры и расписание pg_cron, уведомления вживую'],
                ['ИИ', 'Claude API: фото, вес, голос, OCR журнала, заключения, аналитика'],
                ['Безопасность', 'вход по паролю, хэши, ключи только на сервере'],
              ].map(([a, b]) => (
                <div key={a} className="flex gap-[1cqw]"><b className="w-[11cqw] shrink-0" style={{ color: C.ink }}>{a}</b><span>{b}</span></div>
              ))}
            </div>
            <div className="mt-[1.6cqw] text-[1.25cqw] font-semibold" style={{ color: C.gold }}>
              Демо: повар вносит отход по фото → проверяющий получает заключение ИИ → данные в реестре, на табло и в отчёте ЦУР
            </div>
          </div>
          <div className="rounded-[1.6cqw] bg-white p-[1.8cqw] text-center shadow-xl" style={{ border: `2px solid ${C.yellow}` }}>
            <div className="text-[1.5cqw] font-bold" style={{ color: C.ink }}>Жюри, попробуйте сами</div>
            <div className="mx-auto mt-[1cqw] w-[17cqw]"><QRCodeSVG value={`${SITE}/login?guest=1`} style={{ width: '100%', height: 'auto' }} /></div>
            <div className="mt-[0.8cqw] text-[1.1cqw]" style={{ color: C.ink2 }}>Сканируйте → «Гость жюри» → сфотографируйте любую еду</div>
          </div>
        </div>
      ),
    },
    // 7. ИИ и автоматизации
    {
      video: '/pitch/4.mp4',
      body: (
        <div className="flex h-full flex-col justify-center">
          <Kicker>Инновации</Kicker>
          <H>ИИ делает работу — человек только подтверждает</H>
          <div className="mt-[2cqw] grid max-w-[62cqw] grid-cols-2 gap-x-[2cqw] gap-y-[0.8cqw]">
            <ul className="space-y-[0.7cqw]">
              <Bullet>Фото → вид отхода, причина и примерный вес (помечен «оценка ИИ»)</Bullet>
              <Bullet>«Хлеб 3 кг, гарнир 2,5» — голосом или текстом</Bullet>
              <Bullet>Фото бумажного журнала → все строки в отчёт</Bullet>
              <Bullet>Электронные весы: вес приходит сам (API)</Bullet>
            </ul>
            <ul className="space-y-[0.7cqw]">
              <Bullet>Индекс достоверности: ловит журнал «на глаз»</Bullet>
              <Bullet>Заключение ИИ и готовый комментарий проверяющему</Bullet>
              <Bullet>ИИ-аналитик для руководства и отчёт ЦУР 12.3</Bullet>
              <Bullet>9 автоматизаций: напоминания, сроки, сводки, автоприёмка</Bullet>
            </ul>
          </div>
        </div>
      ),
    },
    // 8. Бизнес-модель
    {
      body: (
        <div className="flex h-full flex-col justify-center">
          <Kicker>Бизнес-модель</Kicker>
          <H>Кто платит и за что</H>
          <div className="mt-[2cqw] grid grid-cols-3 gap-[1.2cqw]">
            {[
              ['Потребители', 'Университеты и колледжи; корпоративные столовые; предприятия Союза пищевых предприятий Казахстана'],
              ['Модель', 'SaaS-подписка за точку питания в месяц; пилот бесплатно; обучение и интеграция с весами — разово'],
              ['Ценность', 'Экономия на закупках и вывозе, часы сотрудников, готовая ESG-отчётность и данные для рейтингов'],
            ].map(([t, d]) => (
              <div key={t} className="rounded-[1.3cqw] bg-white p-[1.5cqw]" style={{ border: `1px solid ${C.border}` }}>
                <div className="text-[1.6cqw] font-bold" style={{ color: C.gold }}>{t}</div>
                <div className="mt-[0.6cqw] text-[1.35cqw] leading-snug" style={{ color: C.ink2 }}>{d}</div>
              </div>
            ))}
          </div>
          <div className="mt-[1.8cqw] text-[1.4cqw]" style={{ color: C.ink2 }}>Каналы: кафедра ИС и АТУ как первый референс → вузы РК → предприятия через Союз пищевых предприятий.</div>
        </div>
      ),
    },
    // 9. Экономика
    {
      body: (
        <div className="flex h-full flex-col justify-center">
          <Kicker>Экономический эффект · АТУ, год</Kicker>
          <H>Окупаемость — меньше {paybackMonths < 1 ? 'месяца' : `${Math.ceil(paybackMonths)} мес.`}</H>
          <div className="mt-[2cqw] grid grid-cols-4 gap-[1cqw]">
            <Stat value={`${fmt(lossYear / 1e6, 1)} млн ₸`} label="потери на еде в год" sub="по ценам-допущениям" />
            <Stat value={`${fmt(saveFood / 1e6, 1)} млн ₸`} label="экономия при −20 % предотвратимых" />
            <Stat value={`${fmt(saveHours / 1e3)} тыс ₸`} label={`${hoursYear} ч сотрудников`} sub="2 500 ₸/ч" />
            <Stat value={`${fmt(capex / 1e3)} тыс ₸`} label="CAPEX: внедрение, обучение" sub={`OPEX ${fmt(opexYear / 1e3)} тыс ₸/год: хостинг + ИИ`} />
          </div>
          <div className="mt-[1.8cqw] rounded-[1cqw] px-[1.4cqw] py-[0.9cqw] text-[1.55cqw] font-bold" style={{ background: C.yellow, color: C.ink }}>
            Чистый эффект ≈ {fmt(benefit / 1e6, 1)} млн ₸ в год на 5 точках АТУ
          </div>
          <Note>Допущения команды: потери пересчитаны на год по {s.months} мес. данных; цены потерь — оценочные; сокращение предотвратимых отходов на 20 % — консервативная цель первого года (зарубежные системы учёта сообщают о большем). Оборудование не требуется — смартфоны уже есть.</Note>
        </div>
      ),
    },
    // 10. Экология
    {
      video: '/pitch/5.mp4', dark: true,
      body: (
        <div className="flex h-full flex-col justify-center">
          <Kicker dark>Экологический эффект · ЦУР 12.3</Kicker>
          <H dark>Вдвое сократить пищевые отходы к 2030 году</H>
          <div className="mt-[2.2cqw] grid max-w-[62cqw] grid-cols-4 gap-[1cqw]">
            <Stat dark value={`${fmt(perYear(s.mass_kg) / 1000, 1)} т`} label="отходов в год" />
            <Stat dark value={`${fmt(perYear(s.co2_kg) / 1000, 0)} т`} label="CO₂-экв. в год" sub="FAO, 2013" />
            <Stat dark value={`−${fmt(perYear(s.avoidable_kg) * 0.2 / 1000, 1)} т`} label="еды в год при −20 %" sub={`−${fmt(perYear(s.avoidable_kg) * 0.2 * 2.5 / 1000, 0)} т CO₂`} />
            <Stat dark value={`0 → ${fmt(s.mass_kg ? s.recyclable_kg / s.mass_kg * 100 : 0)} %`} label="доля переработки" sub="пригодное — в компост и вторсырьё" />
          </div>
          <ul className="mt-[2cqw] max-w-[58cqw] space-y-[0.6cqw]">
            <Bullet dark>Отчёт ЦУР 12.3 и ESG одной кнопкой — данные для рейтинга университета</Bullet>
            <Bullet dark>Главный показатель — предотвратимые отходы на порцию: сравним с любыми вузами</Bullet>
          </ul>
        </div>
      ),
    },
    // 11. Внедрение
    {
      body: (
        <div className="flex h-full flex-col justify-center">
          <Kicker>План внедрения</Kicker>
          <H>Пилот → весь АТУ → другие вузы</H>
          <div className="mt-[2.2cqw] grid grid-cols-3 gap-[1.2cqw]">
            {[
              ['Декабрь 2026', 'Пилот', 'Столовая «Искандер»: обучение 1 час, QR на кухне, замер «бумага против телефона», 1 месяц'],
              ['I квартал 2027', 'Весь АТУ', '5 точек и кафедры, электронные весы, автоприёмка честных отчётов, первый отчёт ЦУР'],
              ['2027', 'Масштаб', 'Вузы Алматы и РК, корпоративные столовые, предприятия Союза пищевых предприятий'],
            ].map(([d, t, x], k) => (
              <div key={t} className="relative rounded-[1.3cqw] bg-white p-[1.5cqw]" style={{ border: `1px solid ${C.border}` }}>
                <div className="grid h-[3cqw] w-[3cqw] place-items-center rounded-full text-[1.4cqw] font-black" style={{ background: C.yellow, color: C.ink }}>{k + 1}</div>
                <div className="mt-[0.8cqw] text-[1.1cqw] font-semibold" style={{ color: C.gold }}>{d}</div>
                <div className="text-[1.8cqw] font-bold" style={{ color: C.ink }}>{t}</div>
                <div className="mt-[0.5cqw] text-[1.2cqw] leading-snug" style={{ color: C.ink2 }}>{x}</div>
              </div>
            ))}
          </div>
          <div className="mt-[1.6cqw] text-[1.25cqw]" style={{ color: C.ink2 }}>
            <b style={{ color: C.ink }}>Риски:</b> сотрудники не вносят данные → вход по QR, фото и голос, напоминания · недостоверные цифры → индекс достоверности и проверка · нет интернета на кухне → черновик сохраняется на телефоне.
          </div>
        </div>
      ),
    },
    // 12. Команда и запрос
    {
      video: '/pitch/6.mp4',
      body: (
        <div className="flex h-full flex-col justify-center">
          <Kicker>Команда и запрос</Kicker>
          <H>Qadir Team</H>
          <div className="mt-[1.6cqw] max-w-[52cqw] space-y-[0.6cqw] text-[1.4cqw]" style={{ color: C.ink2 }}>
            <div><b style={{ color: C.ink }}>Разработка</b> — система, база, ИИ-функции, развёртывание</div>
            <div><b style={{ color: C.ink }}>Продукт и дизайн</b> — интерфейс, сценарии повара и проверяющего</div>
            <div><b style={{ color: C.ink }}>Исследование и экономика</b> — расчёты, ЦУР, презентация</div>
          </div>
          <div className="mt-[2.2cqw] max-w-[52cqw] rounded-[1.3cqw] p-[1.6cqw]" style={{ background: C.yellow }}>
            <div className="text-[1.8cqw] font-black" style={{ color: C.ink }}>Наш запрос</div>
            <div className="mt-[0.5cqw] text-[1.4cqw] font-semibold leading-snug" style={{ color: C.ink }}>Пилот в столовой АТУ в декабре · доступ к реальным журналам · поддержка кафедры для внедрения во все подразделения</div>
          </div>
          <div className="mt-[1.8cqw] text-[1.6cqw] font-bold" style={{ color: C.gold }}>Нанның қадірі. Спасибо!</div>
        </div>
      ),
    },
  ]

  const n = slides.length
  const go = useCallback((d: number) => setI((x) => Math.max(0, Math.min(n - 1, x + d))), [n])

  const printAll = useCallback(() => {
    setPrinting(true)
    setTimeout(() => { window.print(); setPrinting(false) }, 400)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); go(1) }
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(-1) }
      else if (e.key === 'Home') setI(0)
      else if (e.key === 'End') setI(n - 1)
      else if (e.key.toLowerCase() === 'f') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.() }
      else if (e.key.toLowerCase() === 'p') printAll()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, n, printAll])

  const Slide = ({ k }: { k: number }) => (
    <div className="pitch-slide relative aspect-video w-full overflow-hidden" style={{ background: C.bg, containerType: 'inline-size', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <Bg video={slides[k].video} dark={slides[k].dark} />
      <div className="relative h-full px-[4cqw] py-[3cqw]">{slides[k].body}</div>
      <div className="absolute bottom-[1.4cqw] right-[2cqw] flex items-center gap-[0.6cqw] text-[0.95cqw] font-semibold" style={{ color: slides[k].dark ? 'rgba(255,255,255,.7)' : C.muted }}>
        <img src="/logo.png" alt="" className="h-[1.8cqw] w-[1.8cqw]" /> Qadir · {k + 1}/{n}
      </div>
    </div>
  )

  if (printing) {
    return (
      <div className="pitch-print">
        <style>{`@page { size: 16in 9in; margin: 0 } body { margin: 0 } .pitch-print .pitch-slide { width: 16in; height: 9in; page-break-after: always; break-after: page }`}</style>
        {slides.map((_, k) => <Slide key={k} k={k} />)}
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1a1404] p-0 sm:p-4">
      <div className="relative w-full max-w-[min(100vw,calc(100vh*16/9))]">
        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, scale: 0.985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
            <Slide k={i} />
          </motion.div>
        </AnimatePresence>
        <button aria-label="Назад" className="absolute inset-y-0 left-0 w-[12%] cursor-w-resize" onClick={() => go(-1)} />
        <button aria-label="Вперёд" className="absolute inset-y-0 right-0 w-[12%] cursor-e-resize" onClick={() => go(1)} />
        <div className="absolute left-0 right-0 top-0 h-[3px] bg-white/10"><div className="h-full transition-all" style={{ width: `${((i + 1) / n) * 100}%`, background: C.yellow }} /></div>
      </div>
      <div className="fixed bottom-3 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-black/60 px-3 py-1.5 text-xs text-white/80 opacity-30 transition hover:opacity-100">
        <button onClick={() => go(-1)}>←</button><span>{i + 1}/{n}</span><button onClick={() => go(1)}>→</button>
        <button onClick={() => document.documentElement.requestFullscreen?.()}>Полный экран (F)</button>
        <button onClick={printAll}>PDF (P)</button>
      </div>
    </div>
  )
}
