export type Role = 'responsible' | 'reviewer' | 'admin' | 'management'
export type Status = 'draft' | 'submitted' | 'in_review' | 'accepted' | 'returned'
export type Category = 'avoidable' | 'unavoidable' | 'packaging'
export type Reason = 'overproduction' | 'expired' | 'spoilage' | 'plate' | 'trimmings' | 'other'

export interface Org {
  id: string
  name_ru: string
  name_kk: string
  type: string
  building: string | null
  is_active: boolean
  is_demo: boolean
}

export interface Profile {
  id: string
  full_name: string
  email: string
  role: Role
  org_id: string | null
}

export interface Disposal {
  id: string
  name_ru: string
  name_kk: string
  diverts: boolean
  is_active: boolean
}

export interface WasteType {
  id: string
  org_id: string | null
  name_ru: string
  name_kk: string
  unit: 'kg' | 'l'
  kg_per_unit: number
  default_disposal_id: string | null
  recyclable: boolean
  category: Category
  co2_factor: number
  cost_per_unit: number
  is_active: boolean
}

export interface Report {
  id: string
  org_id: string
  period_start: string
  period_end: string
  status: Status
  submitted_at: string | null
  reviewer_id: string | null
  decided_at: string | null
}

export interface Entry {
  id: string
  report_id: string
  org_id: string
  entry_date: string
  waste_type_id: string
  quantity: number
  disposal_id: string | null
  reason: Reason | null
  user_id: string | null
  has_photo: boolean
  source: 'manual' | 'photo' | 'scale'
  qty_estimated?: boolean
  created_at: string
}

export interface HistoryRow {
  id: number
  report_id: string
  from_status: Status | null
  to_status: Status
  user_id: string | null
  comment: string | null
  created_at: string
}

/** Строка единого реестра (представление registry: записи принятых отчётов). */
export interface RegistryRow {
  id: string
  entry_date: string
  org_id: string
  report_id: string
  waste_type_id: string
  disposal_id: string | null
  quantity: number
  reason: Reason | null
  source: string
  has_photo: boolean
  created_at: string
  org_ru: string
  org_kk: string
  org_type: string
  waste_ru: string
  waste_kk: string
  unit: 'kg' | 'l'
  category: Category
  recyclable: boolean
  mass_kg: number
  co2_kg: number
  cost_kzt: number
  disposal_ru: string | null
  disposal_kk: string | null
  diverts: boolean
  responsible: string | null
}
