'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Loader2,
  PhoneCall,
  FileText,
  Activity,
  Users,
  Clock,
  MessageSquare,
  MapPin,
  Cpu,
  AlertTriangle,
  Brain,
  RefreshCcw,
  RadioTower,
  Route,
} from 'lucide-react'
import apiClient from '@/lib/api/client'
import { useTranslation } from '@/lib/hooks/use-translation'

interface MobileDataAnalysisDialogProps {
  sourceId: string
  open: boolean
  onClose: () => void
}

type UnknownRecord = Record<string, unknown>

type Summary = {
  parsed_rows?: number
  unique_contacts?: number
  total_calls_est?: number
  sms_count?: number
  total_duration_min?: number
  avg_duration_sec?: number | null
  date_range?: string
  night_activity_pct?: number
  operators_detected?: string[]
}

type CallActivityRow = { period?: string; count?: number }
type HourRow = { hour?: number; count?: number }

type TopContact = {
  number?: string
  call_count?: number
  total_duration_sec?: number
  inbound?: number
  outbound?: number
}

type TimePattern = {
  by_hour?: HourRow[]
  peak_hour?: number | null
  night_activity_pct?: number
}

type OperatorSms = {
  operators_plaintext?: string[]
  sms_like_rows?: number
  notes?: string
}

type LocationInfo = {
  lac_values?: string[]
  cell_id_values?: string[]
  notes?: string
  location_values?: string[]
  lat_long_values?: string[]
  network_circle_values?: string[]
  top_towers?: UnknownRecord[]
  movement_rows?: UnknownRecord[]
}

type DeviceSim = {
  imei_candidates?: string[]
  imsi_candidates?: string[]
  notes?: string
}

type SuspiciousItem = {
  title?: string
  detail?: string
  severity?: string
}

type Intelligence = {
  insights?: string[]
  behavior_summary?: string
}

type SmsActivityRow = {
  period?: string
  count?: number
  inbound?: number
  outbound?: number
  unique_contacts?: number
  [key: string]: unknown
}

type CallMovementRow = {
  period?: string
  datetime?: string
  from?: string
  to?: string
  lac?: string
  cell_id?: string
  location?: string
  latitude?: number | string
  longitude?: number | string
  count?: number
  [key: string]: unknown
}

type DetectedFields = {
  phone_fields?: string[]
  datetime_fields?: string[]
  duration_fields?: string[]
  direction_fields?: string[]
  location_fields?: string[]
  device_fields?: string[]
  [key: string]: unknown
}

type MobileAnalysisResponse = {
  source_id?: string
  total_records?: number
  summary?: Summary
  call_activity?: CallActivityRow[]
  sms_activity?: SmsActivityRow[] | UnknownRecord
  call_movement?: CallMovementRow[] | UnknownRecord
  top_contacts?: TopContact[]
  time_pattern?: TimePattern
  operator_sms?: OperatorSms
  location?: LocationInfo
  device_sim?: DeviceSim
  suspicious?: SuspiciousItem[]
  intelligence?: Intelligence
  informative_insights?: UnknownRecord
  detected_fields?: DetectedFields
  dynamic_reports?: UnknownRecord
  _searchable_stub?: string
  [key: string]: unknown
}

const card: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.92)',
  border: '1px solid rgba(226, 232, 240, 0.9)',
  boxShadow: '0 18px 45px -32px rgba(15, 23, 42, 0.45)',
  borderRadius: 22,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  backdropFilter: 'blur(16px)',
}

const glassCard: React.CSSProperties = {
  ...card,
  background: 'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(248,250,252,0.88))',
}

const sectionHead = (accent: string, bgGradient: string): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '16px 20px',
  borderBottom: '1px solid rgba(226, 232, 240, 0.75)',
  background: bgGradient,
  color: accent,
})

const body: React.CSSProperties = { padding: 20 }

const pill = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: bg,
  color,
  border: `1px solid ${color}22`,
  borderRadius: 999,
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 700,
})

const asArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[]
  return []
}

const asRecord = (value: unknown): UnknownRecord => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as UnknownRecord
  return {}
}

const valueText = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const formatNumber = (value: unknown) => {
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'string' && value.trim()) return value
  return '—'
}

const hasMeaningfulValue = (value: unknown): boolean => {
  if (value === null || value === undefined || value === '') return false
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item))
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0
  if (typeof value === 'string') {
    const text = value.trim()
    return Boolean(text && text !== '—' && text !== '-')
  }
  if (typeof value === 'object') return Object.values(value as UnknownRecord).some((item) => hasMeaningfulValue(item))
  return true
}

const friendlyEmpty = (label: string) => `No ${label.toLowerCase()} found in the uploaded source.`

const isMeaningfulProviderName = (value: unknown): boolean => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return false
  const normalized = text.toLowerCase()
  if (['none', 'null', 'nil', 'na', 'n/a', '-', '—', 'unknown'].includes(normalized)) return false
  if (/\b(target\s*no|target\s*number|mobile\s*no|subscriber\s*no|msisdn|customer|record|row|date|time)\b/i.test(text)) return false
  const letters = (text.match(/[a-z]/gi) || []).length
  const digits = (text.match(/\d/g) || []).length
  return letters >= 4 && digits <= letters
}

const providerList = (values: unknown): string[] => {
  const arr = Array.isArray(values) ? values : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of arr) {
    const text = String(value ?? '').replace(/\s+/g, ' ').trim()
    if (!isMeaningfulProviderName(text) || seen.has(text.toLowerCase())) continue
    seen.add(text.toLowerCase())
    out.push(text)
  }
  return out
}

const toNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim())
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

const formatDateDDMMYYYY = (value: unknown): string => {
  const raw = String(value ?? '').trim()
  if (!raw || raw === '—') return '—'

  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(.*)$/)
  if (iso) return `${iso[3].padStart(2, '0')}-${iso[2].padStart(2, '0')}-${iso[1]}${iso[4] || ''}`

  const slash = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(.*)$/)
  if (slash) {
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3]
    return `${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}-${year}${slash[4] || ''}`
  }

  return raw
}

const formatDateRangeDDMMYYYY = (value: unknown): string => {
  const raw = String(value ?? '').trim()
  if (!raw || raw === '—') return '—'
  return raw
    .split(/\s*→\s*|\s+-\s+|\s+to\s+/i)
    .map((part) => formatDateDDMMYYYY(part))
    .join(' → ')
}

const compactValueText = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) {
    if (!value.length) return '—'
    return value
      .slice(0, 8)
      .map((item) => {
        if (item && typeof item === 'object') {
          const record = item as UnknownRecord
          return Object.entries(record)
            .slice(0, 3)
            .map(([key, val]) => `${key}: ${valueText(val)}`)
            .join(' · ')
        }
        return valueText(item)
      })
      .join(', ')
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as UnknownRecord)
    if (!entries.length) return '—'
    return entries
      .slice(0, 6)
      .map(([key, val]) => `${key}: ${compactValueText(val)}`)
      .join(' · ')
  }
  return String(value)
}

function TrendBars({
  rows,
  accent,
  labelKey = 'period',
  valueKey = 'count',
  emptyText,
  height = 190,
}: {
  rows: UnknownRecord[]
  accent: string
  labelKey?: string
  valueKey?: string
  emptyText: string
  height?: number
}) {
  const visibleRows = rows.slice(-40)
  const max = Math.max(1, ...visibleRows.map((row) => toNumber(row[valueKey])))

  if (!visibleRows.length) {
    return <div style={{ padding: 36, color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>{emptyText}</div>
  }

  return (
    <div style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height, borderBottom: '1px solid #e2e8f0', paddingBottom: 12 }}>
        {visibleRows.map((row, idx) => {
          const value = toNumber(row[valueKey])
          const barHeight = Math.max(8, Math.round((value / max) * (height - 24)))
          return (
            <div key={`${idx}-${valueText(row[labelKey])}`} style={{ flex: 1, minWidth: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
              <div style={{ fontSize: 10, color: '#475569', fontWeight: 800 }}>{value || '—'}</div>
              <div
                title={`${formatDateDDMMYYYY(row[labelKey])}: ${value}`}
                style={{
                  width: '100%',
                  maxWidth: 26,
                  height: barHeight,
                  borderRadius: '10px 10px 3px 3px',
                  background: `linear-gradient(180deg, ${accent}, ${accent}aa)`,
                  boxShadow: `0 14px 22px -16px ${accent}`,
                }}
              />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(visibleRows.length, 10)}, 1fr)`, gap: 8, marginTop: 12 }}>
        {visibleRows.filter((_, idx) => idx % Math.max(1, Math.ceil(visibleRows.length / 10)) === 0).slice(0, 10).map((row, idx) => (
          <div key={`${idx}-${valueText(row[labelKey])}`} style={{ fontSize: 10, color: '#64748b', textAlign: 'center', whiteSpace: 'nowrap' }}>
            {formatDateDDMMYYYY(row[labelKey])}
          </div>
        ))}
      </div>
    </div>
  )
}

function ContactBars({ contacts, emptyText }: { contacts: TopContact[]; emptyText: string }) {
  const visible = contacts.slice(0, 12)
  const max = Math.max(1, ...visible.map((row) => toNumber(row.call_count)))

  if (!visible.length) return <div style={{ padding: 36, color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>{emptyText}</div>

  return (
    <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {visible.map((row, idx) => {
        const count = toNumber(row.call_count)
        const width = Math.max(4, Math.round((count / max) * 100))
        return (
          <div key={`${row.number}-${idx}`} style={{ display: 'grid', gridTemplateColumns: '46px minmax(160px, 260px) 1fr 92px', gap: 14, alignItems: 'center' }}>
            <div style={{ width: 34, height: 34, borderRadius: 12, background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 12 }}>
              {idx + 1}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.number || '—'}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>In {row.inbound ?? 0} · Out {row.outbound ?? 0} · Dur {row.total_duration_sec ?? 0}s</div>
            </div>
            <div style={{ height: 12, borderRadius: 999, background: '#ecfdf5', overflow: 'hidden' }}>
              <div style={{ width: `${width}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #10b981, #059669)' }} />
            </div>
            <div style={{ textAlign: 'right', fontSize: 14, fontWeight: 900, color: '#0f172a' }}>{formatNumber(count)}</div>
          </div>
        )
      })}
    </div>
  )
}


function BreakdownBars({ rows, labelKey, valueKey = 'count', accent, emptyText }: { rows: UnknownRecord[]; labelKey: string; valueKey?: string; accent: string; emptyText: string }) {
  const visible = rows.filter((row) => toNumber(row[valueKey]) > 0).slice(0, 12)
  const max = Math.max(1, ...visible.map((row) => toNumber(row[valueKey])))

  if (!visible.length) {
    return <div style={{ padding: 18, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>{emptyText}</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {visible.map((row, idx) => {
        const count = toNumber(row[valueKey])
        const width = Math.max(5, Math.round((count / max) * 100))
        return (
          <div key={`${idx}-${valueText(row[labelKey])}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 220px) 1fr 56px', gap: 12, alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: '#334155', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{valueText(row[labelKey])}</div>
            <div style={{ height: 10, background: `${accent}14`, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${width}%`, background: accent, borderRadius: 999 }} />
            </div>
            <div style={{ fontSize: 12, color: '#0f172a', fontWeight: 900, textAlign: 'right' }}>{formatNumber(count)}</div>
          </div>
        )
      })}
    </div>
  )
}

function SparkLine({ rows, accent, emptyText, label = 'Unique contacts' }: { rows: UnknownRecord[]; accent: string; emptyText: string; label?: string }) {
  const visible = rows.filter((row) => toNumber(row.count) > 0).slice(-30)
  if (!visible.length) return <div style={{ padding: 24, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>{emptyText}</div>

  const width = 520
  const height = 150
  const max = Math.max(1, ...visible.map((row) => toNumber(row.count)))
  const points = visible.map((row, idx) => {
    const x = visible.length === 1 ? width / 2 : (idx / (visible.length - 1)) * width
    const y = height - 20 - (toNumber(row.count) / max) * (height - 44)
    return { x, y, row }
  })
  const path = points.map((point, idx) => `${idx === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')
  const area = `${path} L ${points[points.length - 1].x.toFixed(1)} ${height - 10} L ${points[0].x.toFixed(1)} ${height - 10} Z`

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 14, background: '#ffffff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Peak {Math.max(...visible.map((row) => toNumber(row.count))).toLocaleString()}</div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label={label} style={{ display: 'block', overflow: 'visible' }}>
        <path d={area} fill={`${accent}18`} />
        <path d={path} fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, idx) => (
          <circle key={idx} cx={point.x} cy={point.y} r="4" fill="#ffffff" stroke={accent} strokeWidth="3">
            <title>{`${formatDateDDMMYYYY(point.row.period)}: ${toNumber(point.row.count)}`}</title>
          </circle>
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: '#64748b', fontSize: 10, fontWeight: 700 }}>
        <span>{formatDateDDMMYYYY(visible[0]?.period)}</span>
        <span>{formatDateDDMMYYYY(visible[visible.length - 1]?.period)}</span>
      </div>
    </div>
  )
}

function readableEventLabel(value: unknown) {
  const text = valueText(value).trim()
  if (!text || text === '—') return 'Communication row'
  const normalized = text.toLowerCase()
  if (['unclassified', 'unknown', 'none', 'null', 'na', 'n/a'].includes(normalized)) return 'Communication row'
  return text
}

function SmsActivityPanel({ meta, emptyText }: { meta: UnknownRecord; emptyText: string }) {
  const byDay = asArray<UnknownRecord>(meta.by_day)
  const byHour = asArray<UnknownRecord>(meta.by_hour)
  const uniqueByDay = asArray<UnknownRecord>(meta.unique_contacts_by_day)
  const topContacts = asArray<UnknownRecord>(meta.top_sms_contacts)
  const eventBreakdown = asArray<UnknownRecord>(meta.source_event_breakdown).map((row) => ({ ...row, event_type: readableEventLabel(row.event_type) }))
  const totalSms = toNumber(meta.total_sms)
  const messageLike = toNumber(meta.message_like_rows)
  const totalCommunication = messageLike || byDay.reduce((sum, row) => sum + toNumber(row.count), 0)
  const hasTrend = byDay.some((row) => toNumber(row.count) > 0)

  return (
    <div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'minmax(480px, 1.25fr) minmax(360px, 0.85fr)', gap: 22, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {totalSms > 0 && <MiniMetric label="Explicit SMS rows" value={formatNumber(totalSms)} accent="#0891b2" icon={<MessageSquare size={18} />} />}
          <MiniMetric label="Communication rows" value={formatNumber(totalCommunication)} accent="#0d9488" icon={<Activity size={18} />} />
          <MiniMetric label="Unique communication contacts" value={formatNumber(topContacts.length)} accent="#2563eb" icon={<Users size={18} />} />
        </div>

        <div style={{ border: '1px solid #cffafe', borderRadius: 20, overflow: 'hidden', background: '#ffffff' }}>
          <div style={{ padding: '13px 16px', fontSize: 12, fontWeight: 900, color: '#0e7490', background: 'linear-gradient(90deg, #ecfeff, #ffffff)' }}>
            Communication volume by date
          </div>
          {hasTrend ? <TrendBars rows={byDay.map((row) => ({ ...row, period: formatDateDDMMYYYY(row.period) }))} accent="#0891b2" emptyText={emptyText} height={190} /> : <div style={{ padding: 30, color: '#64748b', fontSize: 13, lineHeight: 1.55 }}>{emptyText}</div>}
        </div>

        <SparkLine rows={uniqueByDay} accent="#0d9488" emptyText="No unique-contact trend available" label="Unique contacts trend" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 20, padding: 16, background: '#f8fafc' }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>Source event breakdown</div>
          <BreakdownBars rows={eventBreakdown} labelKey="event_type" accent="#0891b2" emptyText="No event type breakdown found" />
        </div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 20, padding: 16, background: '#f8fafc' }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>Top communication contacts</div>
          <BreakdownBars rows={topContacts} labelKey="number" valueKey="sms_count" accent="#0d9488" emptyText="No communication contacts found" />
        </div>
        {byHour.length > 0 && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 20, padding: 16, background: '#f8fafc' }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>Hourly communication pattern</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))', gap: 4, alignItems: 'end', height: 96 }}>
              {byHour.map((row, idx) => {
                const max = Math.max(1, ...byHour.map((x) => toNumber(x.count)))
                const h = Math.max(4, Math.round((toNumber(row.count) / max) * 82))
                return <div key={idx} title={`${valueText(row.hour)}: ${valueText(row.count)}`} style={{ height: h, background: '#0891b2', borderRadius: '7px 7px 2px 2px', opacity: toNumber(row.count) ? 1 : 0.16 }} />
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function CallMovementPanel({ meta, emptyText }: { meta: UnknownRecord; emptyText: string }) {
  const movement = asArray<UnknownRecord>(meta.movement_sequence)
  const communication = asArray<UnknownRecord>(meta.communication_sequence).map((row) => ({ ...row, type: readableEventLabel(row.type) }))
  const transitions = asArray<UnknownRecord>(meta.top_contact_transitions)
  const sequenceByDay = asArray<UnknownRecord>(meta.sequence_by_day)
  const topTowers = asArray<UnknownRecord>(meta.top_towers)
  const hasTowerMovement = movement.length > 0
  const sequenceRows = (hasTowerMovement ? movement : communication).slice(-18)
  const sequenceTotal = toNumber(meta.total_sequence_rows) || communication.length || movement.length

  return (
    <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {toNumber(meta.total_location_rows) > 0 && <MiniMetric label="Location rows" value={formatNumber(meta.total_location_rows)} accent="#0d9488" icon={<MapPin size={18} />} />}
        {toNumber(meta.unique_towers) > 0 && <MiniMetric label="Unique towers" value={formatNumber(meta.unique_towers)} accent="#0f766e" icon={<RadioTower size={18} />} />}
        <MiniMetric label="Sequence rows" value={formatNumber(sequenceTotal)} accent="#2563eb" icon={<Route size={18} />} />
        <MiniMetric label="Unique transition paths" value={formatNumber(transitions.length)} accent="#7c3aed" icon={<Activity size={18} />} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(520px, 1.3fr) minmax(360px, 0.7fr)', gap: 18, alignItems: 'stretch' }}>
        <SparkLine rows={sequenceByDay} accent="#2563eb" emptyText="No sequence trend available" label="Daily unique movement / contact trend" />
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 16, background: '#f8fafc', minHeight: 180 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>Top contact transitions</div>
          <BreakdownBars rows={transitions} labelKey="transition" accent="#2563eb" emptyText="No transitions found" />
        </div>
      </div>

      {topTowers.length > 0 && (
        <div style={{ border: '1px solid #ccfbf1', borderRadius: 18, padding: 16, background: '#f0fdfa' }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: '#0f766e', marginBottom: 12 }}>Top towers / cells</div>
          <BreakdownBars rows={topTowers} labelKey="tower" accent="#0d9488" emptyText="No tower fields found" />
        </div>
      )}

      <div style={{ border: '1px solid #ccfbf1', borderRadius: 20, overflow: 'hidden', background: '#ffffff' }}>
        <div style={{ padding: '13px 16px', fontSize: 12, fontWeight: 900, color: '#0f766e', background: 'linear-gradient(90deg, #f0fdfa, #ffffff)' }}>
          {hasTowerMovement ? 'Tower / location movement sequence' : 'Communication sequence'}
        </div>
        {sequenceRows.length ? (
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, maxHeight: 420, overflowY: 'auto' }}>
            {sequenceRows.map((row, idx) => (
              <div key={`${idx}-${compactValueText(row)}`} style={{ border: '1px solid #ccfbf1', background: 'linear-gradient(145deg, #ffffff, #f0fdfa)', borderRadius: 16, padding: 14 }}>
                <div style={{ fontSize: 11, color: '#0f766e', fontWeight: 900, textTransform: 'uppercase' }}>{formatDateDDMMYYYY(row.period || row.datetime || idx + 1)}</div>
                {hasTowerMovement ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                    {hasMeaningfulValue(row.lac) && <div><strong>LAC:</strong> {valueText(row.lac)}</div>}
                    {hasMeaningfulValue(row.cell_id) && <div><strong>Cell:</strong> {valueText(row.cell_id)}</div>}
                    {hasMeaningfulValue(row.address || row.location) && <div><strong>Location:</strong> {valueText(row.address || row.location)}</div>}
                    {hasMeaningfulValue(row.latitude) && hasMeaningfulValue(row.longitude) && <div><strong>Lat / Long:</strong> {valueText(row.latitude)}, {valueText(row.longitude)}</div>}
                  </div>
                ) : (
                  <div style={{ marginTop: 8, fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                    <div><strong>From:</strong> {valueText(row.from)}</div>
                    <div><strong>To:</strong> {valueText(row.to)}</div>
                    <div><strong>Event:</strong> {readableEventLabel(row.type)}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : <div style={{ padding: 30, color: '#94a3b8', fontSize: 13, textAlign: 'center' }}>{emptyText}</div>}
      </div>
    </div>
  )
}

function MiniMetric({
  label,
  value,
  accent = '#7c3aed',
  icon,
}: {
  label: string
  value: string
  accent?: string
  icon?: React.ReactNode
}) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(145deg, #ffffff, #f8fafc)',
        border: '1px solid #e2e8f0',
        borderRadius: 18,
        padding: '14px 16px',
        boxShadow: '0 10px 24px -20px rgba(15, 23, 42, 0.65)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          right: -16,
          top: -18,
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: `${accent}14`,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 800 }}>
            {label}
          </div>
          <div style={{ fontSize: 21, fontWeight: 850, color: '#0f172a', marginTop: 6, wordBreak: 'break-word' }}>{value}</div>
        </div>
        {icon && (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: `${accent}12`,
              color: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}


function SourceNetworkDetailsPanel({ summary }: { summary: Summary }) {
  const operators = providerList(summary.operators_detected)

  if (!operators.length) return null

  return (
    <div style={card}>
      <div style={sectionHead('#0f766e', 'linear-gradient(to right, #f0fdfa, #ffffff)')}>
        <RadioTower size={20} />
        <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Network details</span>
      </div>
      <div style={body}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
          <MiniMetric label="Operators / providers" value={operators.join(', ')} accent="#2563eb" icon={<RadioTower size={18} />} />
        </div>
      </div>
    </div>
  )
}

function InformativeInsightsPanel({ data }: { data: MobileAnalysisResponse }) {
  const summary = asRecord(data.summary) as Summary
  const movementMeta = asRecord(data.call_movement)
  const location = asRecord(data.location) as LocationInfo
  const deviceSim = asRecord(data.device_sim) as DeviceSim
  const suspicious = asArray<SuspiciousItem>(data.suspicious)
  const intelligence = asRecord(data.intelligence) as Intelligence
  const operators = asArray<string>(summary.operators_detected || asRecord(data.source_details).operators)
  const transitionRows = asArray<UnknownRecord>(movementMeta.top_contact_transitions)
  const movementRows = asArray<UnknownRecord>(movementMeta.communication_sequence || movementMeta.movement_sequence)
  const topTransition = transitionRows[0]
  const imeis = asArray<string>(deviceSim.imei_candidates)
  const locationValues = [
    ...asArray<string>(location.location_values),
    ...asArray<string>(location.network_circle_values),
    ...asArray<string>(location.lac_values).map((x) => `LAC ${x}`),
    ...asArray<string>(location.cell_id_values).map((x) => `Cell ${x}`),
    ...asArray<string>(location.lat_long_values),
  ].filter(Boolean)

  const insightCards = [
    {
      title: 'Communication concentration',
      value: topTransition ? `${valueText(topTransition.transition)} (${formatNumber(topTransition.count)})` : 'No dominant transition found',
      detail: topTransition ? 'Most frequent observed source-to-destination communication path.' : 'No transition path was detected from parsed source rows.',
      accent: '#2563eb',
    },
    {
      title: 'Network / provider evidence',
      value: operators.length ? operators.join(', ') : 'Provider not detected',
      detail: operators.length ? 'Provider values are taken from detected provider/operator fields only.' : 'No reliable provider/operator value was present in parsed rows.',
      accent: '#0d9488',
    },
    {
      title: 'Device identifiers',
      value: imeis.length ? imeis.slice(0, 3).join(', ') : 'No device identifiers detected',
      detail: imeis.length ? `${imeis.length} IMEI-like candidate${imeis.length === 1 ? '' : 's'} found. Validate against original export.` : 'No IMEI/IMSI field or reliable 15-digit device candidate was available.',
      accent: '#6366f1',
    },
    {
      title: 'Location evidence',
      value: locationValues.length ? locationValues.slice(0, 3).join(', ') : 'No tower/location columns detected',
      detail: locationValues.length ? 'Location information is displayed from detected LAC, Cell ID, tower, region or coordinate fields.' : 'The report uses communication sequence evidence because tower/location columns were not present.',
      accent: '#0891b2',
    },
  ]

  const timeline = movementRows.slice(-6)
  const backendInsights = asRecord(data.informative_insights)
  const backendCards = asArray<UnknownRecord>(backendInsights.cards)
  const backendSummary = asArray<UnknownRecord>(backendInsights.summary_rows)
  const backendEvidence = asArray<UnknownRecord>(backendInsights.evidence_trail)
  const generatedInsights = asArray<string>(backendInsights.observations).length
    ? asArray<string>(backendInsights.observations)
    : asArray<string>(intelligence.insights)

  const displayInsightCards = backendCards.length
    ? backendCards.map((item, idx) => ({
        title: valueText(item.title || `Insight ${idx + 1}`),
        value: valueText(item.value),
        detail: valueText(item.detail),
        accent: typeof item.accent === 'string' ? item.accent : '#7c3aed',
      }))
    : insightCards

  const displayTimeline = backendEvidence.length ? backendEvidence.slice(-8) : timeline

  return (
    <div style={card}>
      <div style={sectionHead('#7c3aed', 'linear-gradient(to right, #f5f3ff, #ffffff)')}>
        <Brain size={20} />
        <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Informative insights</span>
      </div>
      <div style={{ ...body, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {displayInsightCards.map((item) => (
            <div key={item.title} style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 16, background: 'linear-gradient(145deg, #ffffff, #f8fafc)' }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: item.accent, textTransform: 'uppercase', letterSpacing: 0.6 }}>{item.title}</div>
              <div style={{ fontSize: 15, fontWeight: 850, color: '#0f172a', marginTop: 8, wordBreak: 'break-word' }}>{item.value}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 8, lineHeight: 1.55 }}>{item.detail}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 1fr) minmax(360px, 1fr)', gap: 16 }}>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 16, background: '#ffffff' }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>Analysis summary</div>
            <div style={{ display: 'grid', gap: 10, fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
              {backendSummary.length ? (
                backendSummary.map((row, idx) => (
                  <div key={idx}>
                    <strong>{valueText(row.label)}:</strong> {valueText(row.value)}
                  </div>
                ))
              ) : (
                <>
                  <div><strong>Parsed communication rows:</strong> {formatNumber(data.total_records || summary.parsed_rows)}</div>
                  <div><strong>Unique contacts:</strong> {formatNumber(summary.unique_contacts)}</div>
                  <div><strong>Date span:</strong> {formatDateRangeDDMMYYYY(summary.date_range)}</div>
                  <div><strong>Night activity:</strong> {formatNumber(summary.night_activity_pct)}%</div>
                  {suspicious.length > 0 && <div><strong>Review flags:</strong> {suspicious.map((x) => x.title).filter(Boolean).join(', ')}</div>}
                </>
              )}
            </div>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: 18, padding: 16, background: '#ffffff' }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a', marginBottom: 12 }}>Recent evidence trail</div>
            {displayTimeline.length ? (
              <div style={{ display: 'grid', gap: 8, maxHeight: 190, overflowY: 'auto' }}>
                {displayTimeline.map((row, idx) => (
                  <div key={`${idx}-${compactValueText(row)}`} style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 10, background: '#f8fafc', fontSize: 12, color: '#334155' }}>
                    {hasMeaningfulValue(row.label) ? (
                      <>
                        <strong>{valueText(row.label)}</strong>: {valueText(row.detail || row.value)}
                      </>
                    ) : (
                      <>
                        <strong>{formatDateDDMMYYYY(row.period || row.datetime || idx + 1)}</strong>: {valueText(row.from || row.number || row.lac || row.cell_id)} {hasMeaningfulValue(row.to) ? `→ ${valueText(row.to)}` : ''}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#94a3b8', fontSize: 13 }}>No recent movement evidence available.</div>
            )}
          </div>
        </div>

        {generatedInsights.length > 0 && (
          <div style={{ border: '1px solid #ddd6fe', borderRadius: 18, padding: 16, background: '#faf5ff' }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: '#6d28d9', marginBottom: 12 }}>Generated observations</div>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 10 }}>
              {generatedInsights.map((line, idx) => (
                <li key={idx} style={{ display: 'flex', gap: 10, fontSize: 13, color: '#334155', lineHeight: 1.55 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#8b5cf6', marginTop: 7, flexShrink: 0 }} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function MobileDataContent({ data }: { data: MobileAnalysisResponse }) {
  const { t } = useTranslation()
  const m = t.sources.mobileData

  const summary = asRecord(data.summary) as Summary
  const callActivity = asArray<CallActivityRow>(data.call_activity)
  const topContacts = asArray<TopContact>(data.top_contacts)
  const timePattern = asRecord(data.time_pattern) as TimePattern
  const smsActivityRows = Array.isArray(data.sms_activity) ? (data.sms_activity as UnknownRecord[]) : []
  const smsActivityMeta = !Array.isArray(data.sms_activity) ? asRecord(data.sms_activity) : {}
  const movementRows = Array.isArray(data.call_movement) ? (data.call_movement as UnknownRecord[]) : []
  const movementMeta = !Array.isArray(data.call_movement) ? asRecord(data.call_movement) : {}

  const maxHourlyCount = useMemo(() => Math.max(1, ...asArray<HourRow>(timePattern.by_hour).map((x) => Number(x.count || 0))), [timePattern.by_hour])



  return (
    <>
      {/* SUMMARY OVERVIEW */}
      <div style={card}>
        <div style={sectionHead('#7c3aed', 'linear-gradient(to right, #f3e8ff, #ffffff)')}>
          <FileText size={20} />
          <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{m.sectionSummary}</span>
        </div>
        <div style={body}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 16 }}>
            <MiniMetric label={m.uniqueContacts} value={formatNumber(summary.unique_contacts)} accent="#16a34a" icon={<Users size={18} />} />
            <MiniMetric label={m.totalCalls} value={formatNumber(summary.total_calls_est)} accent="#2563eb" icon={<PhoneCall size={18} />} />
            {toNumber(summary.sms_count) > 0 && (
              <MiniMetric label={m.smsRows} value={formatNumber(summary.sms_count)} accent="#0891b2" icon={<MessageSquare size={18} />} />
            )}
            {toNumber(summary.total_duration_min) > 0 && (
              <MiniMetric label={m.totalMinutes} value={formatNumber(summary.total_duration_min)} accent="#d97706" icon={<Clock size={18} />} />
            )}
            {summary.avg_duration_sec != null && toNumber(summary.avg_duration_sec) > 0 && (
              <MiniMetric label={m.avgDurationSec} value={formatNumber(summary.avg_duration_sec)} accent="#6366f1" icon={<Activity size={18} />} />
            )}
            <MiniMetric label={m.dateRange} value={formatDateRangeDDMMYYYY(summary.date_range)} accent="#0d9488" icon={<Route size={18} />} />
            <MiniMetric label={m.nightActivity} value={`${summary.night_activity_pct ?? 0}%`} accent="#dc2626" icon={<AlertTriangle size={18} />} />
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
            {providerList(summary.operators_detected).length > 0 && (
              <span style={pill('#f8fafc', '#475569')}>
                <RadioTower size={13} />
                <strong style={{ color: '#0f172a' }}>{m.operatorsInFile}:</strong> {providerList(summary.operators_detected).join(', ')}
              </span>
            )}
          </div>
        </div>
      </div>

      <SourceNetworkDetailsPanel summary={summary} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(520px, 1fr))', gap: 24 }}>
        {/* CALL ACTIVITY */}
        <div style={card}>
          <div style={sectionHead('#2563eb', 'linear-gradient(to right, #eff6ff, #ffffff)')}>
            <Activity size={20} />
            <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{m.sectionCallActivity}</span>
          </div>
          <div style={{ ...body, padding: 0, minHeight: 280 }}>
            <TrendBars
              emptyText={m.noData}
              rows={callActivity.map((x) => ({ period: formatDateDDMMYYYY(x.period), count: x.count }))}
              accent="#2563eb"
              height={220}
            />
          </div>
        </div>

        {/* TIME PATTERN */}
        <div style={card}>
          <div style={sectionHead('#d97706', 'linear-gradient(to right, #fffbeb, #ffffff)')}>
            <Clock size={20} />
            <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{m.sectionTimePattern}</span>
          </div>
          <div style={{ ...body, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: 12, marginBottom: 24, border: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
                {m.peakHour}: <strong style={{ color: '#0f172a' }}>{timePattern.peak_hour ?? '—'}</strong>
                <span style={{ margin: '0 12px', color: '#cbd5e1' }}>|</span>
                {m.nightWindow}: <strong style={{ color: '#0f172a' }}>{timePattern.night_activity_pct ?? summary.night_activity_pct ?? 0}%</strong>
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))', gap: 4, alignItems: 'end', marginTop: 'auto' }}>
              {asArray<HourRow>(timePattern.by_hour).map((h) => {
                const count = Number(h.count || 0)
                const barPx = Math.max(4, Math.round((count / maxHourlyCount) * 100))
                return (
                  <div key={h.hour} style={{ textAlign: 'center' }}>
                    <div style={{ height: 110, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                      <div
                        style={{
                          width: '100%',
                          maxWidth: 16,
                          height: barPx,
                          background: 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)',
                          borderRadius: '8px 8px 2px 2px',
                          boxShadow: '0 8px 16px -12px rgba(245, 158, 11, 0.75)',
                          transition: 'height 0.3s ease',
                        }}
                        title={`${count} events`}
                      />
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 8, fontWeight: 650 }}>{h.hour}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* TOP CONTACTS */}
      <div style={card}>
        <div style={sectionHead('#16a34a', 'linear-gradient(to right, #f0fdf4, #ffffff)')}>
          <Users size={20} />
          <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>{m.sectionTopContacts}</span>
        </div>
        <div style={{ ...body, padding: 0, minHeight: 360 }}>
          <ContactBars contacts={topContacts} emptyText={m.noData} />
        </div>
      </div>

      {/* NEW DYNAMIC REPORTS - full width stacked layout */}
      <div style={card}>
        <div style={sectionHead('#0891b2', 'linear-gradient(to right, #ecfeff, #ffffff)')}>
          <MessageSquare size={20} />
          <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Communication / SMS Activity</span>
        </div>
        <div style={{ ...body, padding: 0 }}>
          <SmsActivityPanel meta={smsActivityRows.length ? { by_day: smsActivityRows } : smsActivityMeta} emptyText={m.noData} />
        </div>
      </div>

      <div style={card}>
        <div style={sectionHead('#0d9488', 'linear-gradient(to right, #f0fdfa, #ffffff)')}>
          <Route size={20} />
          <span style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Call Movement</span>
        </div>
        <div style={{ ...body, padding: 0 }}>
          <CallMovementPanel meta={movementRows.length ? { movement_sequence: movementRows } : movementMeta} emptyText={m.noData} />
        </div>
      </div>

      <InformativeInsightsPanel data={data} />
    </>
  )
}

const shouldRefreshCachedPayload = (payload: MobileAnalysisResponse): boolean => {
  const sms = asRecord(payload.sms_activity)
  const movement = asRecord(payload.call_movement)
  return !(payload.source_details || sms.source_event_breakdown || movement.total_sequence_rows !== undefined)
}

export function MobileDataAnalysisDialog({ sourceId, open, onClose }: MobileDataAnalysisDialogProps) {
  const { t } = useTranslation()
  const [data, setData] = useState<MobileAnalysisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchAnalysis = useCallback(
    async (forceRefresh = false) => {
      if (!sourceId) return

      const encodedId = encodeURIComponent(sourceId)
      const requestUrl = `/sources/${encodedId}/mobile-analysis`
      const postUrl = `/sources/${encodedId}/mobile-analysis${forceRefresh ? '?force_refresh=true' : ''}`

      setError('')
      if (forceRefresh) {
        setRefreshing(true)
      } else {
        setLoading(true)
        setData(null)
      }

      console.info('[MobileDataAnalysisDialog] Fetching analysis', {
        sourceId,
        forceRefresh,
        getUrl: requestUrl,
        postUrl,
      })

      try {
        let response

        if (forceRefresh) {
          response = await apiClient.post(postUrl, {})
        } else {
          try {
            response = await apiClient.get(requestUrl)
            if (shouldRefreshCachedPayload(response.data || {})) {
              console.info('[MobileDataAnalysisDialog] Cached payload is older than the current mobile report shape. Refreshing analysis.', { sourceId })
              response = await apiClient.post(`/sources/${encodedId}/mobile-analysis?force_refresh=true`, {})
            }
          } catch (getError) {
            console.info('[MobileDataAnalysisDialog] Cached analysis not available, running POST analysis', {
              sourceId,
              error: getError,
            })
            response = await apiClient.post(postUrl, {})
          }
        }

        const payload = {
          ...(response.data || {}),
          source_id: response.data?.source_id || sourceId,
        } as MobileAnalysisResponse

        console.info('[MobileDataAnalysisDialog] Analysis response connected', {
          sourceId,
          responseSourceId: payload.source_id,
          totalRecords: payload.total_records,
          keys: Object.keys(payload),
        })

        setData(payload)
      } catch (e: any) {
        console.error('[MobileDataAnalysisDialog] Analysis failed', {
          sourceId,
          error: e,
        })
        setError(e?.response?.data?.detail ?? e.message ?? 'Analysis failed')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [sourceId]
  )

  useEffect(() => {
    if (!open || !sourceId) return
    fetchAnalysis(false)
  }, [open, sourceId, fetchAnalysis])

  if (!open || !mounted) return null


  const dialogContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        height: '100dvh',
        maxHeight: '100dvh',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        background:
          'radial-gradient(circle at top left, rgba(16,185,129,0.18), transparent 34%), radial-gradient(circle at top right, rgba(124,58,237,0.13), transparent 30%), #f8fafc',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#0f172a',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          flexShrink: 0,
          minHeight: 76,
          background: 'rgba(255,255,255,0.86)',
          borderBottom: '1px solid rgba(226,232,240,0.85)',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          boxShadow: '0 16px 40px -34px rgba(15,23,42,0.75)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #10b981 0%, #059669 48%, #0f766e 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 14px 24px -16px rgba(5, 150, 105, 0.85)',
          }}
        >
          <PhoneCall size={22} color="#ffffff" />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 10, color: '#047857', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 850 }}>
            {t.sources.mobileData.analysisTitle}
          </div>
          <div
            style={{
              fontSize: 19,
              fontWeight: 850,
              color: '#0f172a',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginTop: 2,
            }}
          >
            {t.sources.mobileData.reportHeading}
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchAnalysis(true)}
          disabled={loading || refreshing}
          style={{
            background: refreshing ? '#e2e8f0' : '#ecfdf5',
            border: '1px solid #bbf7d0',
            color: '#047857',
            borderRadius: 999,
            padding: '9px 14px',
            cursor: loading || refreshing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 750,
            flexShrink: 0,
          }}
          title="Run analysis again for this source"
        >
          <RefreshCcw size={15} className={refreshing ? 'animate-spin' : undefined} />
          {refreshing ? 'Refreshing' : 'Refresh'}
        </button>

        <div style={{ width: 1, height: 28, background: '#e2e8f0', margin: '0 4px' }} />

        <button
          type="button"
          onClick={onClose}
          style={{
            background: '#f1f5f9',
            border: 'none',
            borderRadius: '50%',
            width: 38,
            height: 38,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#475569',
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#e2e8f0'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#f1f5f9'
          }}
        >
          <X size={18} />
        </button>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
          padding: '18px 16px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, minHeight: 'min-content', width: '100%', maxWidth: 'none', margin: 0 }}>
          {loading && (
            <div
              style={{
                ...glassCard,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 420,
                gap: 16,
                color: '#64748b',
              }}
            >
              <Loader2 size={38} color="#059669" className="animate-spin" />
              <p style={{ fontSize: 14, margin: 0, textAlign: 'center', maxWidth: 340, fontWeight: 650 }}>{t.sources.mobileData.loading}</p>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: 20,
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: 16,
                color: '#b91c1c',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <AlertTriangle size={20} />
              <div>
                <div style={{ fontWeight: 850 }}>Mobile analysis failed for this source.</div>
                <div style={{ marginTop: 4 }}>{error}</div>
              </div>
            </div>
          )}

          {data && !loading && <MobileDataContent data={data} />}
        </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          background: 'rgba(255,255,255,0.9)',
          borderTop: '1px solid rgba(226,232,240,0.85)',
          padding: '14px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backdropFilter: 'blur(18px)',
        }}
      >
        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 650 }}>
          {''}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'linear-gradient(135deg, #059669, #047857)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 12,
            padding: '10px 24px',
            fontSize: 14,
            fontWeight: 750,
            cursor: 'pointer',
            boxShadow: '0 12px 24px -18px rgba(5, 150, 105, 0.9)',
            transition: 'transform 0.2s',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          {t.common.close}
        </button>
      </div>
    </div>
  )

  return createPortal(dialogContent, document.body)
}
