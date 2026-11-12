import { useCallback, useEffect, useState } from 'react'
import { dateTime } from '../lib/format'
import { useLang } from '../lib/i18n'
import { errText, supabase } from '../lib/supabase'
import { Btn, Card, ErrorBox, Pill } from './ui'

interface Run { id: number; job: string; forced: boolean; created: number; details: string | null; ran_at: string }

type Job = { key: string; icon: string; when: [string, string]; title: [string, string]; what: [string, string] }

/** Время указано по Алматы; в базе pg_cron работает по UTC (см. 003_automations.sql). */
const SCHEDULED: Job[] = [
  { key: 'open_month', icon: '🗓️', when: ['каждый день в 00:05', 'күн сайын 00:05'], title: ['Открытие отчётов месяца', 'Ай есептерін ашу'], what: ['1-го числа создаёт черновик отчёта для каждой организации и сообщает ответственным.', 'Айдың 1-інде әр ұйымға есеп жобасын жасап, жауаптыларға хабарлайды.'] },
  { key: 'daily_reminder', icon: '⏰', when: ['каждый день в 18:00', 'күн сайын 18:00'], title: ['Ежедневное напоминание', 'Күнделікті еске салу'], what: ['Напоминает точкам питания, если за день нет ни одного взвешивания; сообщает проверяющему об отчётах, которые ждут дольше 2 дней.', 'Күні бойы өлшеу болмаса, тамақтану нүктелеріне еске салады; 2 күннен ұзақ күтіп тұрған есептер туралы тексерушіге хабарлайды.'] },
  { key: 'deadline_reminder', icon: '📅', when: ['3, 5 и 6 числа в 10:00', '3, 5 және 6-сы 10:00'], title: ['Контроль срока сдачи', 'Тапсыру мерзімін бақылау'], what: ['Напоминает не сдавшим отчёт за прошлый месяц (срок — 5 число); 6 числа список должников уходит руководству.', 'Өткен ай есебін тапсырмағандарға еске салады (мерзімі — 5-і); 6-сы борыштылар тізімі басшылыққа жіберіледі.'] },
  { key: 'weekly_digest', icon: '📊', when: ['по понедельникам в 09:00', 'дүйсенбі сайын 09:00'], title: ['Недельная сводка руководству', 'Басшылыққа апталық қорытынды'], what: ['Масса отходов за неделю и динамика, доля предотвратимых, потери в тенге, точка с наибольшими потерями.', 'Аптадағы қалдық массасы мен динамикасы, алдын алуға болатын үлесі, теңгедегі шығын, ең көп шығынды нүкте.'] },
  { key: 'close_offers', icon: '🍲', when: ['каждые 15 минут', 'әр 15 минут'], title: ['Закрытие «Спасённых порций»', '«Сақталған порцияларды» жабу'], what: ['Снимает с продажи истёкшие и распроданные предложения.', 'Мерзімі өткен және сатылып біткен ұсыныстарды алып тастайды.'] },
]

const EVENTS: Omit<Job, 'key' | 'when'>[] = [
  { icon: '🔍', title: ['Автопроверка отчёта', 'Есепті автотексеру'], what: ['При отправке отчёта сервер считает индекс достоверности и сообщает проверяющему; подозрительные отчёты помечаются.', 'Есеп жіберілгенде сервер сенімділік индексін есептеп, тексерушіге хабарлайды; күдікті есептер белгіленеді.'] },
  { icon: '⚠️', title: ['Нетипичный вес', 'Әдеттен тыс салмақ'], what: ['Запись больше чем в 2,5 раза выше обычного — сразу уведомление ответственному и проверяющему.', 'Әдеттегіден 2,5 есе көп жазба — жауаптыға және тексерушіге бірден хабарлама.'] },
  { icon: '↩️', title: ['Решение проверяющего', 'Тексерушінің шешімі'], what: ['Возврат с комментарием и принятие отчёта мгновенно приходят ответственному лицу.', 'Түсініктемемен қайтару және есепті қабылдау жауапты тұлғаға бірден келеді.'] },
  { icon: '🎉', title: ['Месяц закрыт', 'Ай жабылды'], what: ['Когда последняя организация сдала отчёт, руководство получает сигнал: свод готов к выгрузке.', 'Соңғы ұйым есеп тапсырғанда басшылық белгі алады: жиынтық есеп дайын.'] },
]

export default function Automations() {
  const { L } = useLang()
  const [runs, setRuns] = useState<Run[]>([])
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('automation_runs').select('*').order('ran_at', { ascending: false }).limit(40)
    setRuns((data ?? []) as Run[])
  }, [])
  useEffect(() => { load() }, [load])

  async function run(job: Job) {
    setBusy(job.key); setError(''); setResult('')
    const { data, error } = await supabase.rpc('run_automation', { p_job: job.key })
    setBusy('')
    if (error) return setError(errText(error))
    setResult(L(`«${job.title[0]}»: создано уведомлений или изменений — ${data}`, `«${job.title[1]}»: хабарлама не өзгеріс саны — ${data}`))
    load()
  }

  const last = (key: string) => runs.find((r) => r.job === key)

  return (
    <div className="space-y-4">
      <Card className="bg-brand-50 !ring-brand-200">
        <p className="text-sm text-brand-900">
          {L('Автоматизации работают на сервере сами — даже когда сайт никто не открывает. Здесь можно запустить любую вручную: условия по дате при ручном запуске не проверяются, удобно для демонстрации.',
            'Автоматтандырулар серверде өздігінен жұмыс істейді — сайтты ешкім ашпаса да. Мұнда кез келгенін қолмен іске қосуға болады: қолмен іске қосқанда күн шарттары тексерілмейді, көрсетуге ыңғайлы.')}
        </p>
      </Card>
      <ErrorBox>{error}</ErrorBox>
      {result && <div className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">{result}</div>}

      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{L('По расписанию', 'Кесте бойынша')}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {SCHEDULED.map((j) => {
          const r = last(j.key)
          return (
            <Card key={j.key} className="flex flex-col gap-2">
              <div className="flex items-start gap-3">
                <span className="text-2xl leading-none">{j.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{L(...j.title)}</div>
                  <Pill tone="blue">{L(...j.when)}</Pill>
                </div>
              </div>
              <p className="text-sm text-slate-600">{L(...j.what)}</p>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-xs text-slate-500">
                  {r ? `${L('Последний запуск', 'Соңғы іске қосу')}: ${dateTime(r.ran_at)}${r.forced ? L(' (вручную)', ' (қолмен)') : ''}` : L('Ещё не запускалась', 'Әлі іске қосылмаған')}
                </span>
                <Btn size="sm" variant="soft" onClick={() => run(j)} disabled={busy !== ''}>
                  {busy === j.key ? '…' : `▶ ${L('Запустить сейчас', 'Қазір іске қосу')}`}
                </Btn>
              </div>
            </Card>
          )
        })}
      </div>

      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{L('По событиям — мгновенно', 'Оқиға бойынша — бірден')}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {EVENTS.map((e) => (
          <Card key={e.title[0]} className="flex gap-3">
            <span className="text-2xl leading-none">{e.icon}</span>
            <div>
              <div className="font-semibold">{L(...e.title)}</div>
              <p className="mt-0.5 text-sm text-slate-600">{L(...e.what)}</p>
            </div>
          </Card>
        ))}
      </div>

      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{L('Журнал запусков', 'Іске қосу журналы')}</h2>
      <Card className="!p-0">
        {runs.slice(0, 15).map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-slate-100 px-4 py-2 text-sm first:border-t-0">
            <span className="w-32 shrink-0 text-xs text-slate-500">{dateTime(r.ran_at)}</span>
            <span className="font-medium">{L(...(SCHEDULED.find((j) => j.key === r.job)?.title ?? [r.job, r.job]))}</span>
            <span className="flex-1 text-slate-600">{r.details}</span>
            {r.forced && <Pill>{L('вручную', 'қолмен')}</Pill>}
          </div>
        ))}
        {runs.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-400">{L('Запусков ещё не было', 'Әлі іске қосылмаған')}</div>}
      </Card>
    </div>
  )
}
