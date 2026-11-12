import { Btn, inputCls } from '../ui'
import { dmy, today } from '../../lib/format'
import { useLang } from '../../lib/i18n'
import type { Category, Reason, WasteType } from '../../lib/types'
import { MAX_QTY } from './ai'

/** Строка, разобранная ИИ из текста, голоса или фото журнала. */
export interface BatchRow {
  key: string
  typeId: string        // '' — вида нет в справочнике
  newName: string       // новый вид, который ИИ предлагает добавить
  category: Category
  qty: string
  reason: Reason | null
  date: string
}

export type RowState = 'ok' | 'unknown' | 'qty' | 'date'

export function rowState(r: BatchRow, period: { start: string; end: string }): RowState {
  if (r.date > today() || r.date < period.start || r.date > period.end) return 'date'
  if (!r.typeId && !r.newName.trim()) return 'unknown'
  const q = Number(r.qty.replace(',', '.'))
  if (!Number.isFinite(q) || q <= 0 || q > MAX_QTY) return 'qty'
  return 'ok'
}

export function BatchPreview({ rows, types, period, withDates, note, saving, onChange, onSave, onCancel }: {
  rows: BatchRow[]
  types: WasteType[]
  period: { start: string; end: string }
  withDates: boolean
  note?: string
  saving: boolean
  onChange: (rows: BatchRow[]) => void
  onSave: () => void
  onCancel: () => void
}) {
  const { L, name } = useLang()
  const byId = new Map(types.map((t) => [t.id, t]))
  const states = rows.map((r) => rowState(r, period))
  const okCount = states.filter((s) => s === 'ok').length
  const set = (i: number, patch: Partial<BatchRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const unit = (u?: string) => (u === 'l' ? L('л', 'л') : L('кг', 'кг'))

  return (
    <div className="fx-fade-up space-y-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="text-sm font-semibold text-slate-700">
        {L('ИИ понял так — проверьте:', 'ЖИ былай түсінді — тексеріңіз:')}
      </div>
      {note && <div className="text-xs text-slate-500">🤖 {note}</div>}
      {rows.length === 0 && <div className="py-2 text-center text-sm text-slate-500">{L('Ничего не нашлось. Попробуйте сказать иначе: «хлеб 3 кг».', 'Ештеңе табылмады. Басқаша айтып көріңіз: «нан 3 кг».')}</div>}
      <ul className="space-y-1.5">
        {rows.map((r, i) => {
          const s = states[i]
          const t = byId.get(r.typeId)
          const struck = s === 'date'
          const tone = s === 'ok' ? 'bg-white ring-slate-200' : struck ? 'bg-slate-100 ring-slate-200 opacity-60' : 'bg-amber-50 ring-amber-300'
          return (
            <li key={r.key} className={`flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-2 ring-1 ${tone}`}>
              <div className={`min-w-0 flex-1 basis-36 text-sm ${struck ? 'line-through' : ''}`}>
                {withDates && <span className="mr-1.5 text-xs tabular-nums text-slate-500">{dmy(r.date).slice(0, 5)}</span>}
                {t ? <span className="font-medium">{name(t)}</span>
                  : r.newName ? <span className="font-medium">{r.newName} <span className="text-xs font-normal text-brand-700">({L('новый вид, добавим сами', 'жаңа түр, өзіміз қосамыз')})</span></span>
                  : (
                    <select className={`${inputCls} !py-1.5 text-sm`} value="" onChange={(e) => set(i, { typeId: e.target.value })} aria-label={L('Выберите вид', 'Түрін таңдаңыз')}>
                      <option value="">{L('Не понял что — выберите', 'Түсінбедім — таңдаңыз')}</option>
                      {types.map((x) => <option key={x.id} value={x.id}>{name(x)}</option>)}
                    </select>
                  )}
                {struck && <span className="block text-xs text-slate-500 no-underline">{L('дата вне отчёта — пропустим', 'күн есептен тыс — өткіземіз')}</span>}
              </div>
              <div className="flex items-center gap-1">
                <input className={`${inputCls} !w-20 !py-1.5 text-right font-semibold ${s === 'qty' ? '!border-amber-500' : ''}`} inputMode="decimal" placeholder="0"
                  value={r.qty} disabled={struck} aria-label={L('Количество', 'Мөлшері')}
                  onChange={(e) => set(i, { qty: e.target.value.replace(/[^0-9.,]/g, '') })} />
                <span className="w-5 text-xs text-slate-500">{unit(t?.unit)}</span>
                <button className="rounded-lg px-2 py-1 text-slate-400 hover:text-rose-600" onClick={() => onChange(rows.filter((_, j) => j !== i))}
                  aria-label={L('Убрать строку', 'Жолды алып тастау')}>✕</button>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="flex gap-2 pt-1">
        <Btn size="lg" className="fx-pop min-h-12 flex-1" onClick={onSave} disabled={saving || okCount === 0}>
          {withDates
            ? L(`Добавить ${okCount} записей`, `${okCount} жазба қосу`)
            : okCount > 1 ? L(`Сохранить все (${okCount})`, `Барлығын сақтау (${okCount})`) : L('Сохранить', 'Сақтау')}
        </Btn>
        <Btn size="lg" variant="ghost" className="min-h-12" onClick={onCancel}>{L('Отмена', 'Бас тарту')}</Btn>
      </div>
      {okCount < rows.length && rows.length > 0 && (
        <div className="text-xs text-amber-800">{L('Жёлтые строки не сохранятся, пока не исправите вид или вес.', 'Сары жолдар түрі не салмағы түзетілмейінше сақталмайды.')}</div>
      )}
    </div>
  )
}
