import { supabase } from '../../lib/supabase'

export type Tone = 'good' | 'warn' | 'bad'

export interface AiReview {
  verdict: 'accept' | 'return' | 'check'
  confidence: 'high' | 'medium' | 'low'
  summary_ru: string
  summary_kk: string
  comment_ru: string
  comment_kk: string
  points: { ru: string; kk: string; tone: Tone }[]
}

export interface AiInsight {
  headline_ru: string
  headline_kk: string
  findings: { ru: string; kk: string }[]
  actions: { ru: string; kk: string }[]
  generated_at: string
}

/** Вызов серверной функции ИИ. Любая ошибка (в том числе 404, пока функция не развёрнута) превращается в исключение. */
async function callAi<T>(body: Record<string, unknown>): Promise<T> {
  // Не держим скелетон бесконечно: через 60 с считаем, что ИИ недоступен.
  const { data, error } = await Promise.race([
    supabase.functions.invoke('ai', { body }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 60000)),
  ])
  if (error) {
    let msg = error.message
    try {
      const j = await (error as { context?: Response }).context?.json()
      if (j?.error) msg = String(j.error)
    } catch { /* тело ответа не JSON */ }
    throw new Error(msg)
  }
  if (!data || typeof data !== 'object' || (data as { error?: string }).error) throw new Error((data as { error?: string })?.error || 'empty')
  return data as T
}

export const aiReview = (report_id: string) => callAi<AiReview>({ mode: 'review', report_id })

const CACHE = 'qadir.ai.insight.'

export function cachedInsight(key: string): AiInsight | null {
  try {
    const s = sessionStorage.getItem(CACHE + key)
    return s ? (JSON.parse(s) as AiInsight) : null
  } catch { return null }
}

export async function aiInsight(from: string, to: string, org_id?: string): Promise<AiInsight> {
  const key = `${from}|${to}|${org_id ?? ''}`
  const hit = cachedInsight(key)
  if (hit) return hit
  const res = await callAi<AiInsight>({ mode: 'insight', from, to, ...(org_id ? { org_id } : {}) })
  if (!res.headline_ru || !Array.isArray(res.findings) || !Array.isArray(res.actions)) throw new Error('bad shape')
  try { sessionStorage.setItem(CACHE + key, JSON.stringify(res)) } catch { /* хранилище недоступно */ }
  return res
}

export const insightKey = (from: string, to: string, org_id?: string) => `${from}|${to}|${org_id ?? ''}`
