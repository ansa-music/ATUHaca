import { useEffect, useState, type ReactNode } from 'react'
import { Card, Skeleton } from '../ui'
import { useLang } from '../../lib/i18n'
import { aiInsight, cachedInsight, insightKey, type AiInsight, type AiReview, type Tone } from './api'

const DOT: Record<Tone, string> = { good: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-rose-500' }

function AiBadge({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-700">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-100 text-sm" aria-hidden="true">✨</span>
      {children}
    </div>
  )
}

/** «Заключение ИИ» по отчёту: вердикт, короткое объяснение и пункты с цветными точками. */
export function AiVerdictCard({ ai }: { ai: AiReview | 'loading' }) {
  const { L } = useLang()
  if (ai === 'loading') {
    return (
      <Card className="space-y-3 ring-brand-200">
        <AiBadge>{L('Заключение ИИ', 'ЖИ қорытындысы')}</AiBadge>
        <Skeleton className="h-7 w-40 rounded-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <p className="text-xs text-slate-400">{L('ИИ читает отчёт и сравнивает с прошлыми месяцами…', 'ЖИ есепті оқып, өткен айлармен салыстыруда…')}</p>
      </Card>
    )
  }
  const v = {
    accept: [L('Можно принять', 'Қабылдауға болады'), 'bg-emerald-100 text-emerald-800 ring-emerald-200', '✓'],
    return: [L('Стоит вернуть', 'Қайтарған жөн'), 'bg-rose-100 text-rose-800 ring-rose-200', '↩'],
    check: [L('Проверьте вручную', 'Қолмен тексеріңіз'), 'bg-amber-100 text-amber-800 ring-amber-200', '?'],
  }[ai.verdict] ?? [L('Проверьте вручную', 'Қолмен тексеріңіз'), 'bg-amber-100 text-amber-800 ring-amber-200', '?']
  const conf = { high: L('уверенность высокая', 'сенімділік жоғары'), medium: L('уверенность средняя', 'сенімділік орташа'), low: L('уверенность низкая', 'сенімділік төмен') }[ai.confidence]
  return (
    <Card className="fx-fade-up space-y-3 ring-brand-200">
      <AiBadge>{L('Заключение ИИ', 'ЖИ қорытындысы')}</AiBadge>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-base font-bold ring-1 ${v[1]}`}>{v[2]} {v[0]}</span>
        {conf && <span className="text-xs text-slate-500">{conf}</span>}
      </div>
      <p className="break-words text-[15px] leading-relaxed text-slate-800">{L(ai.summary_ru, ai.summary_kk || ai.summary_ru)}</p>
      {ai.points?.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {ai.points.slice(0, 5).map((p, i) => (
            <li key={i} className="fx-fade-up flex gap-2" style={{ animationDelay: `${100 + i * 60}ms` }}>
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[p.tone] ?? DOT.warn}`} aria-hidden="true" />
              <span className="min-w-0 break-words">{L(p.ru, p.kk || p.ru)}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-400">{L('Это подсказка. Решение принимаете вы.', 'Бұл — кеңес. Шешімді сіз қабылдайсыз.')}</p>
    </Card>
  )
}

/**
 * «ИИ-аналитик» на дашборде: короткий вывод по принятым данным за период.
 * Пока идёт загрузка — скелетон; при ошибке показывается fallback (правила без ИИ).
 */
export function AiInsightCard({ from, to, orgId, fallback }: { from: string; to: string; orgId?: string; fallback: ReactNode }) {
  const { L } = useLang()
  const key = insightKey(from, to, orgId)
  const [state, setState] = useState<{ key: string; data: AiInsight | null; failed: boolean }>(() => ({ key, data: cachedInsight(key), failed: false }))

  useEffect(() => {
    const hit = cachedInsight(key)
    if (hit) { setState({ key, data: hit, failed: false }); return }
    setState({ key, data: null, failed: false })
    let alive = true
    const timer = window.setTimeout(() => {
      aiInsight(from, to, orgId)
        .then((d) => { if (alive) setState({ key, data: d, failed: false }) })
        .catch(() => { if (alive) setState({ key, data: null, failed: true }) })
    }, 600)
    return () => { alive = false; clearTimeout(timer) }
  }, [key, from, to, orgId])

  if (state.key !== key || (!state.data && !state.failed)) {
    return (
      <div className="fx-hero space-y-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-white/70">✨ {L('ИИ-аналитик', 'ЖИ-талдаушы')}</div>
        <span className="block h-6 w-4/5 animate-pulse rounded bg-white/25" />
        <span className="block h-4 w-3/5 animate-pulse rounded bg-white/20" />
        <span className="block h-4 w-2/3 animate-pulse rounded bg-white/20" />
        <p className="text-xs text-white/70">{L('ИИ изучает принятые отчёты за период…', 'ЖИ кезеңдегі қабылданған есептерді зерттеуде…')}</p>
      </div>
    )
  }
  if (!state.data) return <>{fallback}</>
  const d = state.data
  const time = (() => {
    const t = new Date(d.generated_at)
    return Number.isNaN(t.getTime()) ? '' : t.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  })()
  return (
    <div className="fx-hero fx-fade-up space-y-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-white/70">✨ {L('ИИ-аналитик', 'ЖИ-талдаушы')}</div>
      <p className="break-words text-lg font-bold leading-snug sm:text-2xl">{L(d.headline_ru, d.headline_kk || d.headline_ru)}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {d.findings.length > 0 && (
          <ul className="space-y-1.5 text-sm text-white/90">
            {d.findings.slice(0, 4).map((x, i) => <li key={i} className="flex gap-2"><span aria-hidden="true">•</span><span className="min-w-0 break-words">{L(x.ru, x.kk || x.ru)}</span></li>)}
          </ul>
        )}
        {d.actions.length > 0 && (
          <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-white/70">{L('Что сделать', 'Не істеу керек')}</div>
            <ol className="space-y-1.5 text-sm">
              {d.actions.slice(0, 3).map((x, i) => <li key={i} className="flex gap-2"><span className="font-bold">{i + 1}.</span><span className="min-w-0 break-words">{L(x.ru, x.kk || x.ru)}</span></li>)}
            </ol>
          </div>
        )}
      </div>
      <p className="text-xs text-white/60">{L('Сгенерировано ИИ по принятым отчётам', 'Қабылданған есептер бойынша ЖИ жасаған')}{time && ` · ${time}`}</p>
    </div>
  )
}
