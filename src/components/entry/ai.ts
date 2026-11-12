import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Category, Reason, WasteType } from '../../lib/types'

export const REASONS_BY_CATEGORY: Record<Category, Reason[]> = {
  avoidable: ['overproduction', 'expired', 'spoilage', 'plate'],
  unavoidable: ['trimmings'],
  packaging: [],
}
export const MAX_QTY = 500

/** Причина, подходящая к категории: от ИИ, если она допустима, иначе единственная очевидная. */
export function fitReason(category: Category, ai?: Reason | null): Reason | '' {
  const allowed = REASONS_BY_CATEGORY[category]
  if (ai && allowed.includes(ai)) return ai
  return allowed.length === 1 ? allowed[0] : ''
}

/** Сжимает фото до max px по большей стороне (JPEG). */
export function compress(file: File, max = 720, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(img.src)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export type AiCategory = Category | null
export interface AiRecognize {
  waste_type_id: string | null
  new_type_name: string | null
  new_type_category: AiCategory
  reason: Reason | null
  confidence: 'high' | 'medium' | 'low'
  note_ru: string
}
export interface AiRow {
  entry_date?: string | null
  waste_type_id: string | null
  new_type_name: string | null
  new_type_category: AiCategory
  quantity: number | null
  reason: Reason | null
}
export interface AiRows { entries: AiRow[]; note_ru?: string }

export type AiResult<T> = { data: T; error?: undefined; status?: undefined } | { data?: undefined; error: string; status: number }

export const aiTypes = (types: WasteType[]) => types.map((t) => ({ id: t.id, name: t.name_ru, unit: t.unit }))

/** Вызов серверной функции ИИ. Ошибку возвращает текстом (код от сервера, если есть) и HTTP-статусом. */
export async function invokeFn<T>(fn: string, body: Record<string, unknown>): Promise<AiResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke(fn, { body })
    if (error) {
      const ctx = (error as { context?: Response }).context
      let code = ''
      try { code = (await ctx?.json())?.error ?? '' } catch { /* без кода */ }
      return { error: code || 'unavailable', status: ctx?.status ?? 0 }
    }
    return { data: data as T }
  } catch {
    return { error: 'network', status: 0 }
  }
}

/** Распознавание фото: новая функция `ai`, при её отсутствии (404) — старая `recognize`. */
export async function recognizePhoto(image: string, types: WasteType[]): Promise<AiResult<AiRecognize>> {
  const r = await invokeFn<AiRecognize>('ai', { mode: 'recognize', image, types: aiTypes(types) })
  if (!r.error || r.status !== 404) return r
  const old = await invokeFn<{ waste_type_id: string | null; confidence: AiRecognize['confidence']; note_ru: string }>('recognize', {
    image, types: types.map((t) => ({ id: t.id, name: t.name_ru })),
  })
  if (old.error !== undefined) return old
  return { data: { new_type_name: null, new_type_category: null, reason: null, ...old.data } }
}

/* ---------- Голосовой ввод (Web Speech API) ---------- */

interface SpeechResultList { length: number; [i: number]: { 0: { transcript: string }; isFinal: boolean } }
interface SpeechRec {
  lang: string; interimResults: boolean; continuous: boolean
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start(): void; stop(): void
}
type SpeechCtor = new () => SpeechRec

const speechCtor = (): SpeechCtor | undefined => {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

/** Диктовка в текстовое поле. supported=false — кнопку микрофона не показываем. */
export function useSpeech(lang: 'ru' | 'kk', onText: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const recRef = useRef<SpeechRec | null>(null)
  const cbRef = useRef(onText)
  cbRef.current = onText
  const supported = Boolean(speechCtor())

  useEffect(() => () => recRef.current?.stop(), [])

  const toggle = useCallback((base: string) => {
    if (recRef.current) { recRef.current.stop(); return }
    const Ctor = speechCtor()
    if (!Ctor) return
    const rec = new Ctor()
    rec.lang = lang === 'kk' ? 'kk-KZ' : 'ru-RU'
    rec.interimResults = true
    rec.continuous = false
    const prefix = base.trim() ? `${base.trim()}, ` : ''
    rec.onresult = (e) => {
      let text = ''
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript
      cbRef.current(prefix + text.trim())
    }
    rec.onend = () => { recRef.current = null; setListening(false) }
    rec.onerror = () => { recRef.current = null; setListening(false) }
    recRef.current = rec
    setListening(true)
    try { rec.start() } catch { recRef.current = null; setListening(false) }
  }, [lang])

  return { supported, listening, toggle }
}
