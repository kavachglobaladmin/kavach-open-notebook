// ── Infographic shared types ──────────────────────────────────────────────────

export interface InfographicColumn {
  title: string
  description: string
  icon: string
}

export interface InfographicResponse {
  source_id: string
  document_type: string
  header?: { title: string; subtitle: string }
  stat?: { value: string; label: string }
  subject?: unknown
  personal?: Record<string, string>
  account?: Record<string, string>
  left_column?: InfographicColumn[]
  right_column?: InfographicColumn[]
  call_summary?: { outgoing?: string; incoming?: string; sms?: string; data?: string }
  top_contacts?: { number: string; type: string; calls: string }[]
  key_locations?: { area?: string; cell_id?: string; count: string }[]
  financial_summary?: Record<string, string>
  key_transactions?: { date: string; description: string; amount: string; type: 'credit' | 'debit'; balance?: string }[]
  associates?: { name: string; relation: string }[]
  case_details?: { fir_no: string; section: string; date: string; police_station: string; status: string }[]
  timeline_events?: { date: string; event: string }[]
  highlights?: { title: string; subtitle?: string; description: string }[]
  profile_summary?: Record<string, string>
}

export type DocumentType = 'cdr' | 'bank' | 'criminal' | 'general'

export interface ThemeTokens {
  accent: string
  accentLight: string
  accentDim: string
  bg: string
  cardBg: string
  cardBorder: string
  headerBg: string
  textPrimary: string
  textMuted: string
  badge: string
  badgeText: string
  label: string
}
