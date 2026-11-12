import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && key)

// Публичный anon-ключ безопасен в браузере: доступ к данным ограничивают политики RLS на сервере.
export const supabase = createClient(url ?? 'https://not-configured.supabase.co', key ?? 'not-configured')

/** Загружает все строки запроса постранично (у Supabase лимит 1000 строк на ответ). */
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const page = 1000
  const out: T[] = []
  for (let from = 0; ; from += page) {
    const { data, error } = await build(from, from + page - 1)
    if (error) throw error
    out.push(...(data ?? []))
    if (!data || data.length < page) return out
  }
}

export function errText(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}
