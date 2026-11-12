import { dmy, monthLabel, num } from './format'
import type { Org, RegistryRow } from './types'

export interface SummaryBlock {
  org: Org
  lines: { waste: string; unit: string; disposal: string; byMonth: number[]; total: number }[]
  totalKg: number
  totalL: number
}

/**
 * Сводный отчёт в Excel по структуре действующих таблиц АТУ:
 * лист «Свод» (организации × виды отходов × месяцы) и по листу на организацию с журналом взвешиваний
 * (дата, наименование отходов, вес/объём, способ утилизации, ответственное лицо).
 */
export async function exportSummary(opts: {
  title: string
  months: string[]
  blocks: SummaryBlock[]
  rows: RegistryRow[]
  missing: { month: string; orgs: string[] }[]
  fileName: string
}) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Qadir'
  const head = { bold: true, color: { argb: 'FFFFFFFF' } }
  const fill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF14532D' } }
  const soft = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFDCEFE1' } }
  const border = { top: { style: 'thin' as const }, left: { style: 'thin' as const }, bottom: { style: 'thin' as const }, right: { style: 'thin' as const } }

  const ws = wb.addWorksheet('Свод')
  const cols = 4 + opts.months.length
  ws.mergeCells(1, 1, 1, cols)
  ws.getCell(1, 1).value = 'Таблица учёта пищевых отходов в университетском комплексе АО «АТУ»'
  ws.getCell(1, 1).font = { bold: true, size: 14 }
  ws.mergeCells(2, 1, 2, cols)
  ws.getCell(2, 1).value = `${opts.title}. Сформировано системой Qadir ${dmy(new Date().toISOString().slice(0, 10))}. В свод входят только принятые отчёты.`
  ws.getCell(2, 1).font = { italic: true, color: { argb: 'FF555555' } }

  const header = ['Наименование отходов', 'Ед.', 'Способ переработки / утилизации', ...opts.months.map((m) => monthLabel(m, 'ru')), 'Итого']
  const hr = ws.addRow([]); hr.values = []
  const h = ws.addRow(header)
  h.eachCell((c) => { c.font = head; c.fill = fill; c.border = border; c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' } })

  let grandKg = 0, grandL = 0
  for (const b of opts.blocks) {
    const r = ws.addRow([b.org.name_ru])
    ws.mergeCells(r.number, 1, r.number, cols)
    r.getCell(1).font = { bold: true }; r.getCell(1).fill = soft; r.getCell(1).border = border
    for (const l of b.lines) {
      const row = ws.addRow([l.waste, l.unit, l.disposal, ...l.byMonth, l.total])
      row.eachCell((c, i) => { c.border = border; if (i > 3) c.numFmt = '0.0' })
      row.getCell(cols).font = { bold: true }
    }
    const t = ws.addRow([`Итого по организации: ${num(b.totalKg)} кг${b.totalL ? ` + ${num(b.totalL)} л` : ''}`])
    ws.mergeCells(t.number, 1, t.number, cols)
    t.getCell(1).font = { bold: true, italic: true }; t.getCell(1).border = border
    grandKg += b.totalKg; grandL += b.totalL
  }
  ws.addRow([])
  const g = ws.addRow([`ВСЕГО по университетскому комплексу: ${num(grandKg)} кг${grandL ? ` + ${num(grandL)} л` : ''}`])
  ws.mergeCells(g.number, 1, g.number, cols)
  g.getCell(1).font = { bold: true, size: 12 }

  if (opts.missing.some((m) => m.orgs.length)) {
    ws.addRow([])
    ws.addRow(['Не сдали отчёт (нет принятого отчёта за период):']).getCell(1).font = { bold: true }
    for (const m of opts.missing) if (m.orgs.length) ws.addRow([`${monthLabel(m.month, 'ru')}: ${m.orgs.join('; ')}`])
  }
  ws.getColumn(1).width = 46; ws.getColumn(2).width = 6; ws.getColumn(3).width = 30
  for (let i = 4; i <= cols; i++) ws.getColumn(i).width = 15

  // Журналы организаций — в том же виде, что бумажные бланки.
  for (const b of opts.blocks) {
    const sheet = wb.addWorksheet(b.org.name_ru.replace(/[\\/*?:[\]]/g, ' ').slice(0, 31))
    sheet.mergeCells(1, 1, 1, 5)
    sheet.getCell(1, 1).value = `${b.org.name_ru} — журнал учёта пищевых отходов`
    sheet.getCell(1, 1).font = { bold: true, size: 13 }
    const hh = sheet.addRow(['Дата', 'Наименование отходов', 'Вес (кг) / Объём (л)', 'Способ переработки / утилизации', 'Ответственное лицо'])
    hh.eachCell((c) => { c.font = head; c.fill = fill; c.border = border; c.alignment = { wrapText: true, vertical: 'middle' } })
    for (const r of opts.rows.filter((x) => x.org_id === b.org.id)) {
      const row = sheet.addRow([dmy(r.entry_date), r.waste_ru, `${num(r.quantity, 2)} ${r.unit === 'l' ? 'л' : 'кг'}`, r.disposal_ru ?? '', r.responsible ?? ''])
      row.eachCell((c) => { c.border = border })
    }
    sheet.getColumn(1).width = 12; sheet.getColumn(2).width = 44; sheet.getColumn(3).width = 20; sheet.getColumn(4).width = 30; sheet.getColumn(5).width = 32
  }

  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = opts.fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}
