import { createContext, useContext, useState, type ReactNode } from 'react'
import type { Category, Reason, Role, Status } from './types'

export type Lang = 'ru' | 'kk'
type Ctx = { lang: Lang; setLang: (l: Lang) => void; L: (ru: string, kk: string) => string; name: (o: { name_ru: string; name_kk: string } | null | undefined) => string }

const LangCtx = createContext<Ctx>(null as unknown as Ctx)

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try { return (localStorage.getItem('qadir.lang') as Lang) || 'ru' } catch { return 'ru' }
  })
  const setLang = (l: Lang) => {
    setLangState(l)
    try { localStorage.setItem('qadir.lang', l) } catch { /* хранилище недоступно */ }
  }
  const L = (ru: string, kk: string) => (lang === 'kk' ? kk : ru)
  const name: Ctx['name'] = (o) => (o ? (lang === 'kk' ? o.name_kk : o.name_ru) : '—')
  return <LangCtx.Provider value={{ lang, setLang, L, name }}>{children}</LangCtx.Provider>
}

export const useLang = () => useContext(LangCtx)

export const STATUS: Record<Status, [string, string, string]> = {
  draft: ['Черновик', 'Жоба', 'bg-[var(--surface-3)] text-[var(--text-2)]'],
  submitted: ['Отправлено', 'Жіберілді', 'bg-[var(--info-soft)] text-[var(--info)]'],
  in_review: ['На проверке', 'Тексеруде', 'bg-[var(--warn-soft)] text-[var(--warn)]'],
  accepted: ['Принято', 'Қабылданды', 'bg-[var(--accent-soft)] text-[var(--accent-ink)]'],
  returned: ['Возвращено на доработку', 'Пысықтауға қайтарылды', 'bg-[var(--danger-soft)] text-[var(--danger)]'],
}

export const ROLE: Record<Role, [string, string]> = {
  responsible: ['Ответственное лицо', 'Жауапты тұлға'],
  reviewer: ['Проверяющий', 'Тексеруші'],
  admin: ['Администратор', 'Әкімші'],
  management: ['Руководство', 'Басшылық'],
}

export const CATEGORY: Record<Category, [string, string]> = {
  avoidable: ['Предотвратимые', 'Алдын алуға болатын'],
  unavoidable: ['Неизбежные', 'Болмай қоймайтын'],
  packaging: ['Упаковка', 'Орама'],
}

export const REASON: Record<Reason, [string, string]> = {
  overproduction: ['Перепроизводство', 'Артық өндіру'],
  expired: ['Истёк срок', 'Мерзімі өтті'],
  spoilage: ['Порча', 'Бұзылу'],
  plate: ['Остатки с тарелок', 'Табақтағы қалдық'],
  trimmings: ['Обрезки, очистки', 'Кесінді, қабық'],
  other: ['Другое', 'Басқа'],
}

export const ORG_TYPE: Record<string, [string, string]> = {
  lab: ['Учебная лаборатория', 'Оқу зертханасы'],
  canteen: ['Столовая', 'Асхана'],
  cafe: ['Кофейня', 'Кофехана'],
  hotel: ['Общепит / гостиница', 'Қоғамдық тамақтану / қонақ үй'],
  other: ['Другое', 'Басқа'],
}

export const MONTHS_RU = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
export const MONTHS_KK = ['қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым', 'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан']
