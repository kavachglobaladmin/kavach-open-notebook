'use client'

import React, { useMemo, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function clean(text: unknown): string {
  if (text === null || text === undefined) return ''
  const s = String(text)
  return s.replace(/\*{1,3}/g, '').replace(/_{1,3}/g, '').replace(/#+\s/g, '').trim()
}

function repairJson(raw: string): string {
  // Fix comma-formatted numbers: 15,099.00 → 15099.00 (only when after : or in array)
  let s = raw
  // Remove truncation markers like "..." or "…" inside arrays/objects
  s = s.replace(/,\s*\.\.\.\s*([}\]])/g, '$1')
  s = s.replace(/\.\.\.\s*([}\]])/g, '$1')
  // Fix numbers like: "value": 15,099.00 → "value": 15099.00
  s = s.replace(/:\s*(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?)/g, (_, n) => ': ' + n.replace(/,/g, ''))
  // Fix trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1')
  // Fix missing commas between } and { (merged objects)
  s = s.replace(/\}\s*\n\s*\{/g, '},\n{')
  return s
}

export function extractAndMergeJson(raw: string): InfographicResponse | null {
  const tryParse = (s: string): InfographicResponse | null => {
    try { return JSON.parse(s) as InfographicResponse } catch { /* try repair */ }
    try { return JSON.parse(repairJson(s)) as InfographicResponse } catch { return null }
  }

  const fenceRe = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/g
  const blocks: InfographicResponse[] = []
  let m: RegExpExecArray | null
  while ((m = fenceRe.exec(raw)) !== null) {
    const parsed = tryParse(m[1])
    if (parsed) blocks.push(parsed)
  }
  if (blocks.length === 0) {
    const start = raw.indexOf('{'), end = raw.lastIndexOf('}')
    if (start !== -1 && end > start) {
      const parsed = tryParse(raw.slice(start, end + 1))
      if (parsed) blocks.push(parsed)
    }
  }
  if (blocks.length === 0) return null
  if (blocks.length === 1) return blocks[0]

  // Prefer the most informative block as primary
  const primary = blocks.find(b => b.document_type === 'ir_document')
    ?? blocks.find(b => b.document_type === 'bank_statement')
    ?? blocks.find(b => b.document_type === 'mobile_cdr')
    ?? blocks.find(b => b.header?.title && b.stat?.value)
    ?? blocks[0]
  const merged: InfographicResponse = { ...primary }
  for (const b of blocks.slice(1)) {
    if (b.case_details?.length) merged.case_details = [...(merged.case_details ?? []), ...b.case_details]
    if (b.timeline_events?.length) merged.timeline_events = [...(merged.timeline_events ?? []), ...b.timeline_events]
    if (b.highlights?.length) merged.highlights = [...(merged.highlights ?? []), ...b.highlights]
    if (b.associates?.length) merged.associates = [...(merged.associates ?? []), ...b.associates]
    // Merge CDR-specific fields
    if (b.top_contacts?.length) {
      const existing = merged.top_contacts ?? []
      const nums = new Set(existing.map(c => c.number))
      merged.top_contacts = [...existing, ...b.top_contacts.filter(c => c.number && !nums.has(c.number))]
    }
    // Merge call_summary by summing counts
    if (b.call_summary && Object.keys(b.call_summary).length > 0) {
      const cs = merged.call_summary ?? {}
      const bcs = b.call_summary
      const sumField = (a?: string, bv?: string) => {
        const n1 = parseInt(a ?? '0') || 0
        const n2 = parseInt(bv ?? '0') || 0
        return n1 + n2 > 0 ? String(n1 + n2) : (a || bv || undefined)
      }
      merged.call_summary = {
        incoming: sumField(cs.incoming, bcs.incoming),
        outgoing: sumField(cs.outgoing, bcs.outgoing),
        sms: sumField(cs.sms, bcs.sms),
        data: sumField(cs.data, bcs.data),
      }
    }
    // Use first non-empty header
    if (!merged.header?.title && b.header?.title) merged.header = b.header
    // Use first non-null stat
    if (!merged.stat?.value && b.stat?.value) merged.stat = b.stat
  }
  if (merged.timeline_events) {
    const seen = new Set<string>()
    merged.timeline_events = merged.timeline_events
      .filter(e => { const k = `${e.date}|${e.event?.slice(0, 30)}`; if (seen.has(k)) return false; seen.add(k); return true })
      .sort((a, b) => a.date.localeCompare(b.date))
  }
  return merged
}

function flattenSubject(subject: unknown): Record<string, string> {
  if (!subject) return {}
  if (Array.isArray(subject)) {
    const result: Record<string, string> = {}
    for (const item of subject) {
      if (typeof item !== 'object' || item === null) continue
      const obj = item as Record<string, unknown>
      const key = String(obj['Field Name'] ?? obj['field_name'] ?? obj['key'] ?? '')
      const val = obj['Value'] ?? obj['value'] ?? ''
      if (!key) continue
      result[key] = Array.isArray(val)
        ? val.map(v => typeof v === 'object' ? Object.values(v as object).join(', ') : String(v)).join(' | ')
        : String(val)
    }
    return result
  }
  if (typeof subject === 'object') {
    const obj = subject as Record<string, unknown>
    const result: Record<string, string> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (v === null || v === undefined) continue
      if (typeof v === 'object') {
        result[k] = Array.isArray(v)
          ? (v as unknown[]).map(i => typeof i === 'object' ? Object.values(i as object).join(', ') : String(i)).join(' | ')
          : Object.keys(v as object).length > 0 ? JSON.stringify(v) : ''
      } else {
        result[k] = String(v)
      }
    }
    return result
  }
  return {}
}

function resolveType(data: InfographicResponse): 'cdr' | 'bank' | 'criminal' | 'general' {
  const raw = (data.document_type ?? '').toLowerCase()
  if (raw === 'bank_statement' || raw === 'bank') return 'bank'
  if (raw === 'mobile_cdr' || raw === 'cdr') return 'cdr'
  if (raw === 'ir_document' || raw === 'gangster_profile' || raw === 'case_details' || raw === 'criminal') return 'criminal'
  if (raw === 'general') {
    if (data.case_details?.length || data.timeline_events?.length || data.associates?.length) return 'criminal'
  }
  if (data.key_transactions?.length || data.financial_summary) return 'bank'
  if (data.call_summary || data.top_contacts?.length) return 'cdr'
  if (data.case_details?.length || data.associates?.length) return 'criminal'
  return 'general'
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const DARK_BG = '#0d1117'
const DARK_CARD = '#1a1f2e'
const DARK_BORDER = '#2d3550'
const DARK_TEXT = '#f0f0f0'
const DARK_MUTED = '#a0aab8'

const BANK_ACCENT = '#059669'
const CDR_ACCENT = '#0ea5e9'
const CRIMINAL_ACCENT = '#1e40af'
const GENERAL_ACCENT = '#7c3aed'

// ── Shared sub-components ─────────────────────────────────────────────────────

function SectionHeader({ label, color }: { label: string; color: string }) {
  return (
    <div style={{ background: '#1e2535', borderBottom: `1px solid ${DARK_BORDER}`, padding: '8px 14px' }}>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: 9, fontWeight: 700, letterSpacing: 2, color, textTransform: 'uppercase' as const }}>{label}</span>
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: DARK_CARD, border: `1px solid ${DARK_BORDER}`, borderRadius: 8, overflow: 'hidden', ...style }}>
      {children}
    </div>
  )
}

function KVRow({ label, value, accent, idx }: { label: string; value: string; accent: string; idx: number }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '5px 0', borderBottom: `0.5px solid ${DARK_BORDER}` }}>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: 8, fontWeight: 700, color: accent, width: 140, flexShrink: 0, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontFamily: 'Georgia, serif', fontSize: 9, color: DARK_TEXT, flex: 1 }}>{value || '—'}</span>
    </div>
  )
}

function StatBanner({ stat, accent }: { stat: { value: string; label: string }; accent: string }) {
  return (
    <div style={{ background: `${accent}12`, border: `1px solid ${accent}35`, borderRadius: 8, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ fontSize: 22 }}>📊</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: accent }}>{clean(stat.value)}</div>
        <div style={{ fontSize: 9, color: DARK_MUTED, marginTop: 2 }}>{clean(stat.label)}</div>
      </div>
    </div>
  )
}

function HighlightCards({ highlights, accent }: { highlights: { title: string; subtitle?: string; description: string }[]; accent: string }) {
  const icons = ['🔍', '📱', '⚠️', '💡', '🔗', '📋']
  const accents = [accent, '#dc2626', '#d97706', '#059669', '#7c3aed', accent]
  return (
    <Card>
      <SectionHeader label="Key Findings" color={accent} />
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {highlights.map((h, i) => {
          const c = accents[i % accents.length]
          return (
            <div key={i} style={{ display: 'flex', gap: 10, borderLeft: `3px solid ${c}`, paddingLeft: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icons[i % icons.length]}</span>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: DARK_TEXT, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{clean(h.title)}</div>
                {h.subtitle && <div style={{ fontSize: 9, color: c, fontWeight: 600, marginTop: 2 }}>{h.subtitle}</div>}
                <div style={{ fontSize: 9, color: DARK_MUTED, marginTop: 4, lineHeight: 1.5 }}>{clean(h.description ?? '')}</div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function TimelineSection({ events, accent }: { events: { date: string; event: string }[]; accent: string }) {
  const dotColors = [accent, '#d97706', '#dc2626', accent, '#d97706', '#dc2626']
  const isLong = events.length > 6
  return (
    <Card>
      <SectionHeader label={`📅 Timeline of Events (${events.length})`} color={accent} />
      {isLong ? (
        <div style={{ padding: '8px 14px', maxHeight: 280, overflowY: 'auto' }}>
          {events.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '5px 0', borderBottom: `0.5px solid ${DARK_BORDER}` }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColors[i % dotColors.length], flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontSize: 9, color: accent, fontFamily: 'monospace', width: 140, flexShrink: 0 }}>{e.date}</span>
              <span style={{ fontSize: 9, color: DARK_TEXT, lineHeight: 1.4 }}>{e.event}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '12px 16px', overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: events.length * 160 }}>
            {events.map((e, i) => (
              <div key={i} style={{ flex: 1, minWidth: 150, position: 'relative', paddingTop: 22 }}>
                <div style={{ position: 'absolute', top: 9, left: i === 0 ? '50%' : 0, right: i === events.length - 1 ? '50%' : 0, height: 2, background: DARK_BORDER }} />
                <div style={{ position: 'absolute', top: 5, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, borderRadius: '50%', background: dotColors[i % dotColors.length], border: `2px solid ${DARK_BG}`, boxShadow: `0 0 0 1px ${DARK_BORDER}` }} />
                <div style={{ paddingLeft: 8, paddingRight: 8 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: dotColors[i % dotColors.length], marginBottom: 4 }}>{e.date}</div>
                  <div style={{ fontSize: 9, color: DARK_MUTED, lineHeight: 1.4 }}>{e.event}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

function CaseDetailsTable({ cases, accent }: { cases: { fir_no: string; section: string; date: string; police_station: string; status: string }[]; accent: string }) {
  return (
    <Card>
      <SectionHeader label="📋 FIR / Case Details" color={accent} />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ background: '#1e2535' }}>
              {['FIR No.', 'Section', 'Date', 'Police Station', 'Status'].map(h => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 8, fontWeight: 700, color: DARK_MUTED, textTransform: 'uppercase' as const, letterSpacing: 0.5, borderBottom: `1px solid ${DARK_BORDER}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cases.map((c, i) => {
              const sl = (c.status ?? '').toLowerCase()
              const sBg = sl.includes('trial') ? '#450a0a' : sl.includes('bail') ? '#451a03' : '#052e16'
              const sCol = sl.includes('trial') ? '#fca5a5' : sl.includes('bail') ? '#fcd34d' : '#86efac'
              return (
                <tr key={i} style={{ borderBottom: `1px solid ${DARK_BORDER}` }}>
                  <td style={{ padding: '6px 10px', color: DARK_TEXT, fontWeight: 500 }}>{c.fir_no || '—'}</td>
                  <td style={{ padding: '6px 10px', color: DARK_MUTED }}>{c.section || '—'}</td>
                  <td style={{ padding: '6px 10px', color: DARK_MUTED, fontFamily: 'monospace', fontSize: 9 }}>{c.date || '—'}</td>
                  <td style={{ padding: '6px 10px', color: DARK_MUTED }}>{c.police_station || '—'}</td>
                  <td style={{ padding: '6px 10px' }}>
                    <span style={{ background: sBg, color: sCol, fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 3 }}>{c.status || '—'}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// ── BankStatementView ─────────────────────────────────────────────────────────

function BankStatementView({ data }: { data: InfographicResponse }) {
  const accent = BANK_ACCENT
  const subjectMap = flattenSubject(data.subject)
  const hasSubject = Object.keys(subjectMap).length > 0
  const hasFinancial = !!(data.financial_summary && Object.keys(data.financial_summary).length > 0)
  const hasTransactions = !!(data.key_transactions?.length)
  const hasTimeline = !!(data.timeline_events?.length)
  const hasHighlights = !!(data.highlights?.length)

  return (
    <div style={{ background: DARK_BG, color: DARK_TEXT, fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 11, borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: DARK_CARD, borderBottom: `2px solid ${accent}`, padding: '12px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ background: accent, color: '#fff', fontSize: 8, fontWeight: 700, letterSpacing: 2, padding: '2px 8px', borderRadius: 2, textTransform: 'uppercase' as const }}>
            🏦 BANK STATEMENT ANALYSIS
          </span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: DARK_TEXT, lineHeight: 1.3 }}>
          {clean(data.header?.title ?? 'Bank Statement')}
        </div>
        {data.header?.subtitle && (
          <div style={{ fontSize: 10, color: DARK_MUTED, marginTop: 3 }}>{clean(data.header.subtitle)}</div>
        )}
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Stat banner */}
        {data.stat && <StatBanner stat={data.stat} accent={accent} />}

        {/* Account Details + Financial Summary side by side */}
        {(hasSubject || hasFinancial) && (
          <div style={{ display: 'grid', gridTemplateColumns: hasSubject && hasFinancial ? '1fr 1fr' : '1fr', gap: 10 }}>
            {hasSubject && (
              <Card>
                <SectionHeader label="Account Details" color={accent} />
                <div style={{ padding: '8px 14px' }}>
                  {Object.entries(subjectMap).map(([k, v], i) => (
                    <KVRow key={i} label={k} value={v} accent={accent} idx={i} />
                  ))}
                </div>
              </Card>
            )}
            {hasFinancial && (
              <Card>
                <SectionHeader label="Financial Summary" color={accent} />
                <div style={{ padding: '8px 14px' }}>
                  {Object.entries(data.financial_summary!).map(([k, v], i) => (
                    <KVRow key={i} label={k} value={v} accent={accent} idx={i} />
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Transactions table */}
        {hasTransactions && (
          <Card>
            <SectionHeader label="Key Transactions" color={accent} />
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9 }}>
                <thead>
                  <tr style={{ background: '#1e2535' }}>
                    {['Date', 'Description', 'Amount', 'Balance'].map(h => (
                      <th key={h} style={{ textAlign: (h === 'Amount' || h === 'Balance') ? 'right' as const : 'left' as const, padding: '6px 10px', fontSize: 8, fontWeight: 700, color: DARK_MUTED, textTransform: 'uppercase' as const, letterSpacing: 0.5, borderBottom: `1px solid ${DARK_BORDER}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.key_transactions!.slice(0, 20).map((t, i) => (
                    <tr key={i} style={{ borderBottom: `0.5px solid ${DARK_BORDER}` }}>
                      <td style={{ padding: '5px 10px', color: DARK_MUTED, fontFamily: 'monospace' }}>{t.date}</td>
                      <td style={{ padding: '5px 10px', color: DARK_TEXT, maxWidth: 220 }}>{t.description}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right' as const, fontWeight: 700, color: t.type === 'credit' ? '#22c55e' : '#ef4444' }}>
                        {t.type === 'credit' ? '+' : '-'}{t.amount}
                      </td>
                      <td style={{ padding: '5px 10px', textAlign: 'right' as const, color: DARK_MUTED }}>{t.balance ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Timeline */}
        {hasTimeline && <TimelineSection events={data.timeline_events!} accent={accent} />}

        {/* Key Findings */}
        {hasHighlights && <HighlightCards highlights={data.highlights!} accent={accent} />}
      </div>

      <div style={{ background: DARK_CARD, borderTop: `1px solid ${DARK_BORDER}`, padding: '6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 8, color: DARK_MUTED, letterSpacing: 1 }}>🏦 Bank Statement Analysis — Restricted</span>
        <span style={{ fontSize: 8, color: DARK_MUTED, letterSpacing: 1 }}>DO NOT DISTRIBUTE</span>
      </div>
    </div>
  )
}

// ── MobileCDRView ─────────────────────────────────────────────────────────────

function MobileCDRView({ data }: { data: InfographicResponse }) {
  const accent = CDR_ACCENT
  const subjectMap = flattenSubject(data.subject)
  const hasSubject = Object.keys(subjectMap).length > 0
  const hasCallSummary = !!(data.call_summary && (data.call_summary.outgoing || data.call_summary.incoming || data.call_summary.sms || data.call_summary.data))
  const hasTopContacts = !!(data.top_contacts?.length)
  const hasKeyLocations = !!(data.key_locations?.length)
  const hasTimeline = !!(data.timeline_events?.length)
  const hasHighlights = !!(data.highlights?.length)
  const hasCaseDetails = !!(data.case_details?.length)

  return (
    <div style={{ background: DARK_BG, color: DARK_TEXT, fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 11, borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: DARK_CARD, borderBottom: `2px solid ${accent}`, padding: '12px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ background: accent, color: '#fff', fontSize: 8, fontWeight: 700, letterSpacing: 2, padding: '2px 8px', borderRadius: 2, textTransform: 'uppercase' as const }}>
            📡 MOBILE CDR / NETWORK ANALYSIS
          </span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: DARK_TEXT, lineHeight: 1.3 }}>
          {clean(data.header?.title ?? 'Mobile CDR Analysis')}
        </div>
        {data.header?.subtitle && (
          <div style={{ fontSize: 10, color: DARK_MUTED, marginTop: 3 }}>{clean(data.header.subtitle)}</div>
        )}
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Stat banner */}
        {data.stat && <StatBanner stat={data.stat} accent={accent} />}

        {/* 4-box call summary */}
        {hasCallSummary && (() => {
          const cs = data.call_summary!
          const items = [
            { label: 'Outgoing', value: cs.outgoing, color: '#ef4444' },
            { label: 'Incoming', value: cs.incoming, color: '#22c55e' },
            { label: 'SMS', value: cs.sms, color: '#f59e0b' },
            { label: 'Data', value: cs.data, color: '#8b5cf6' },
          ].filter(i => i.value)
          return items.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length}, 1fr)`, gap: 8 }}>
              {items.map(({ label, value, color }) => (
                <div key={label} style={{ background: `${color}12`, border: `1px solid ${color}30`, borderRadius: 6, padding: '10px 6px', textAlign: 'center' as const }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontSize: 9, color: DARK_MUTED, marginTop: 2, textTransform: 'uppercase' as const, letterSpacing: 1 }}>{label}</div>
                </div>
              ))}
            </div>
          ) : null
        })()}

        {/* Subject details */}
        {hasSubject && (
          <Card>
            <SectionHeader label="Subject Details" color={accent} />
            <div style={{ padding: '8px 14px' }}>
              {Object.entries(subjectMap).map(([k, v], i) => (
                <KVRow key={i} label={k} value={v} accent={accent} idx={i} />
              ))}
            </div>
          </Card>
        )}

        {/* Top Contacts + Key Locations */}
        {(hasTopContacts || hasKeyLocations) && (
          <div style={{ display: 'grid', gridTemplateColumns: hasTopContacts && hasKeyLocations ? '1fr 1fr' : '1fr', gap: 10 }}>
            {hasTopContacts && (
              <Card>
                <SectionHeader label="Top Contacts" color={accent} />
                <div style={{ padding: '8px 12px' }}>
                  {data.top_contacts!.slice(0, 8).map((c, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: `0.5px solid ${DARK_BORDER}` }}>
                      <span style={{ fontSize: 9, color: DARK_TEXT, fontFamily: 'monospace' }}>{c.number}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 8, color: DARK_MUTED }}>{c.type}</span>
                        <span style={{ fontSize: 9, fontWeight: 700, color: accent, background: `${accent}15`, padding: '2px 6px', borderRadius: 4 }}>{c.calls}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {hasKeyLocations && (
              <Card>
                <SectionHeader label="Key Locations" color={accent} />
                <div style={{ padding: '8px 12px' }}>
                  {data.key_locations!.slice(0, 8).map((l, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: `0.5px solid ${DARK_BORDER}` }}>
                      <span style={{ fontSize: 9, color: DARK_MUTED }}>{l.area ?? l.cell_id}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, color: accent, background: `${accent}15`, padding: '2px 6px', borderRadius: 4 }}>{l.count}×</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Key Findings */}
        {hasHighlights && <HighlightCards highlights={data.highlights!} accent={accent} />}

        {/* Timeline */}
        {hasTimeline && <TimelineSection events={data.timeline_events!} accent={accent} />}

        {/* Case details if present */}
        {hasCaseDetails && <CaseDetailsTable cases={data.case_details!} accent={accent} />}
      </div>

      <div style={{ background: DARK_CARD, borderTop: `1px solid ${DARK_BORDER}`, padding: '6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 8, color: DARK_MUTED, letterSpacing: 1 }}>📡 Mobile CDR / Network Analysis — Restricted</span>
        <span style={{ fontSize: 8, color: DARK_MUTED, letterSpacing: 1 }}>DO NOT DISTRIBUTE</span>
      </div>
    </div>
  )
}

// ── GangsterProfileView ───────────────────────────────────────────────────────

export function GangsterProfileView({ data }: { data: InfographicResponse }) {
  const accent = CRIMINAL_ACCENT
  const subjectMap = flattenSubject(data.subject)
  const profileMap = data.profile_summary ? flattenSubject(data.profile_summary) : {}
  const allSubject = { ...subjectMap, ...profileMap }
  const hasSubject = Object.keys(allSubject).length > 0
  const hasHighlights = !!(data.highlights?.length)
  const hasTimeline = !!(data.timeline_events?.length)
  const hasCaseDetails = !!(data.case_details?.length)
  const hasAssociates = !!(data.associates?.length)
  const highlightAccents = [accent, '#dc2626', '#d97706', '#059669', '#7c3aed', accent]
  const icons = ['🔍', '⚠️', '🔗', '💡', '📋', '🛡️']

  // Light theme for criminal profile
  const bg = '#f8fafc'
  const cardBg = '#ffffff'
  const cardBorder = '#e2e8f0'
  const textColor = '#1e293b'
  const mutedColor = '#64748b'

  return (
    <div style={{ background: bg, color: textColor, fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 11, borderRadius: 12, overflow: 'hidden' }}>
      {/* Dark navy header */}
      <div style={{ background: '#1e293b', borderBottom: `2px solid ${accent}`, padding: '12px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ background: accent, color: '#fff', fontSize: 8, fontWeight: 700, letterSpacing: 2, padding: '2px 8px', borderRadius: 2, textTransform: 'uppercase' as const }}>
            🛡️ CRIMINAL INTELLIGENCE FILE
          </span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#ffffff', lineHeight: 1.3 }}>
          {clean(data.header?.title ?? 'Criminal Profile')}
        </div>
        {data.header?.subtitle && (
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{clean(data.header.subtitle)}</div>
        )}
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Stat banner */}
        {data.stat && (
          <div style={{ background: `${accent}10`, border: `1px solid ${accent}30`, borderRadius: 8, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>📊</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: accent }}>{clean(data.stat.value)}</div>
              <div style={{ fontSize: 9, color: mutedColor, marginTop: 2 }}>{clean(data.stat.label)}</div>
            </div>
          </div>
        )}

        {/* Subject Details — all key-value pairs */}
        {hasSubject && (
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ background: '#f1f5f9', borderBottom: `1px solid ${cardBorder}`, padding: '8px 14px' }}>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 9, fontWeight: 700, letterSpacing: 2, color: accent, textTransform: 'uppercase' as const }}>Subject Details</span>
            </div>
            <div style={{ padding: '8px 14px' }}>
              {Object.entries(allSubject).map(([k, v], i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '5px 0', borderBottom: `0.5px solid ${cardBorder}` }}>
                  <span style={{ fontFamily: 'Georgia, serif', fontSize: 8, fontWeight: 700, color: accent, width: 160, flexShrink: 0, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{k}</span>
                  <span style={{ fontFamily: 'Georgia, serif', fontSize: 9, color: textColor, flex: 1 }}>{v || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Associates */}
        {hasAssociates && (
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: accent, textTransform: 'uppercase' as const, marginBottom: 8 }}>Strategic Syndicate Alliances</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              {data.associates!.map((item, i) => {
                const c = highlightAccents[i % highlightAccents.length]
                return (
                  <div key={i} style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderTop: `3px solid ${c}`, borderRadius: 8, overflow: 'hidden', padding: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${c}20`, border: `2px solid ${c}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 14 }}>👤</span>
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: c, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 3 }}>{item.relation}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: textColor, lineHeight: 1.3 }}>{item.name}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Key Findings with emoji icons */}
        {hasHighlights && (
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ background: '#f1f5f9', borderBottom: `1px solid ${cardBorder}`, padding: '8px 14px' }}>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 9, fontWeight: 700, letterSpacing: 2, color: accent, textTransform: 'uppercase' as const }}>Key Findings</span>
            </div>
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.highlights!.map((h, i) => {
                const c = highlightAccents[i % highlightAccents.length]
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, borderLeft: `3px solid ${c}`, paddingLeft: 10 }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{icons[i % icons.length]}</span>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: textColor, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>{clean(h.title)}</div>
                      {h.subtitle && <div style={{ fontSize: 9, color: c, fontWeight: 600, marginTop: 2 }}>{h.subtitle}</div>}
                      <div style={{ fontSize: 9, color: mutedColor, marginTop: 4, lineHeight: 1.5 }}>{clean(h.description ?? '')}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Timeline — horizontal scrollable with colored dots */}
        {hasTimeline && (() => {
          const events = data.timeline_events!
          const dotColors = [accent, '#d97706', '#dc2626', accent, '#d97706', '#dc2626']
          const isLong = events.length > 6
          return (
            <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ background: '#f1f5f9', borderBottom: `1px solid ${cardBorder}`, padding: '8px 14px' }}>
                <span style={{ fontFamily: 'Georgia, serif', fontSize: 9, fontWeight: 700, letterSpacing: 2, color: accent, textTransform: 'uppercase' as const }}>📅 Timeline of Events ({events.length})</span>
              </div>
              {isLong ? (
                <div style={{ padding: '8px 14px', maxHeight: 280, overflowY: 'auto' }}>
                  {events.map((e, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '5px 0', borderBottom: `0.5px solid ${cardBorder}` }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColors[i % dotColors.length], flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: 9, color: accent, fontFamily: 'monospace', width: 140, flexShrink: 0 }}>{e.date}</span>
                      <span style={{ fontSize: 9, color: textColor, lineHeight: 1.4 }}>{e.event}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '12px 16px', overflowX: 'auto' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', minWidth: events.length * 160 }}>
                    {events.map((e, i) => (
                      <div key={i} style={{ flex: 1, minWidth: 150, position: 'relative', paddingTop: 22 }}>
                        <div style={{ position: 'absolute', top: 9, left: i === 0 ? '50%' : 0, right: i === events.length - 1 ? '50%' : 0, height: 2, background: cardBorder }} />
                        <div style={{ position: 'absolute', top: 5, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, borderRadius: '50%', background: dotColors[i % dotColors.length], border: `2px solid ${bg}`, boxShadow: `0 0 0 1px ${cardBorder}` }} />
                        <div style={{ paddingLeft: 8, paddingRight: 8 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: dotColors[i % dotColors.length], marginBottom: 4 }}>{e.date}</div>
                          <div style={{ fontSize: 9, color: mutedColor, lineHeight: 1.4 }}>{e.event}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* FIR / Case Details table with status badges */}
        {hasCaseDetails && (
          <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ background: '#f1f5f9', borderBottom: `1px solid ${cardBorder}`, padding: '8px 14px' }}>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: 9, fontWeight: 700, letterSpacing: 2, color: accent, textTransform: 'uppercase' as const }}>📋 FIR / Case Details</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                <thead>
                  <tr style={{ background: '#f1f5f9' }}>
                    {['FIR No.', 'Section', 'Date', 'Police Station', 'Status'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: 'left' as const, fontSize: 8, fontWeight: 700, color: mutedColor, textTransform: 'uppercase' as const, letterSpacing: 0.5, borderBottom: `1px solid ${cardBorder}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.case_details!.map((c, i) => {
                    const sl = (c.status ?? '').toLowerCase()
                    const sBg = sl.includes('trial') ? '#fef2f2' : sl.includes('bail') ? '#fffbeb' : '#f0fdf4'
                    const sCol = sl.includes('trial') ? '#dc2626' : sl.includes('bail') ? '#d97706' : '#16a34a'
                    return (
                      <tr key={i} style={{ borderBottom: `1px solid ${cardBorder}` }}>
                        <td style={{ padding: '6px 10px', color: textColor, fontWeight: 500 }}>{c.fir_no || '—'}</td>
                        <td style={{ padding: '6px 10px', color: mutedColor }}>{c.section || '—'}</td>
                        <td style={{ padding: '6px 10px', color: mutedColor, fontFamily: 'monospace', fontSize: 9 }}>{c.date || '—'}</td>
                        <td style={{ padding: '6px 10px', color: mutedColor }}>{c.police_station || '—'}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <span style={{ background: sBg, color: sCol, fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: 3 }}>{c.status || '—'}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Dark footer */}
      <div style={{ background: '#1e293b', borderTop: `1px solid #334155`, padding: '6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 8, color: '#94a3b8', letterSpacing: 1 }}>🛡️ Criminal Intelligence File — Restricted</span>
        <span style={{ fontSize: 8, color: '#94a3b8', letterSpacing: 1 }}>DO NOT DISTRIBUTE</span>
      </div>
    </div>
  )
}

// ── GenericView ───────────────────────────────────────────────────────────────

function GenericView({ data }: { data: InfographicResponse }) {
  const accent = GENERAL_ACCENT
  const hasHighlights = !!(data.highlights?.length)
  const hasLeft = !!(data.left_column?.length)
  const hasRight = !!(data.right_column?.length)
  const hasTimeline = !!(data.timeline_events?.length)
  const subjectMap = flattenSubject(data.subject)
  const hasSubject = Object.keys(subjectMap).length > 0

  return (
    <div style={{ background: DARK_BG, color: DARK_TEXT, fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 11, borderRadius: 12, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: DARK_CARD, borderBottom: `2px solid ${accent}`, padding: '12px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ background: accent, color: '#fff', fontSize: 8, fontWeight: 700, letterSpacing: 2, padding: '2px 8px', borderRadius: 2, textTransform: 'uppercase' as const }}>
            📄 DOCUMENT ANALYSIS
          </span>
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: DARK_TEXT, lineHeight: 1.3 }}>
          {clean(data.header?.title ?? 'Document Analysis')}
        </div>
        {data.header?.subtitle && (
          <div style={{ fontSize: 10, color: DARK_MUTED, marginTop: 3 }}>{clean(data.header.subtitle)}</div>
        )}
      </div>

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data.stat && <StatBanner stat={data.stat} accent={accent} />}

        {hasSubject && (
          <Card>
            <SectionHeader label="Details" color={accent} />
            <div style={{ padding: '8px 14px' }}>
              {Object.entries(subjectMap).map(([k, v], i) => (
                <KVRow key={i} label={k} value={v} accent={accent} idx={i} />
              ))}
            </div>
          </Card>
        )}

        {/* Left / Right columns */}
        {(hasLeft || hasRight) && (
          <div style={{ display: 'grid', gridTemplateColumns: hasLeft && hasRight ? '1fr 1fr' : '1fr', gap: 10 }}>
            {hasLeft && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.left_column!.map((item, i) => (
                  <Card key={i}>
                    <SectionHeader label={clean(item.title)} color={accent} />
                    <div style={{ padding: '8px 14px', fontSize: 9, color: DARK_MUTED, lineHeight: 1.6 }}>{item.description}</div>
                  </Card>
                ))}
              </div>
            )}
            {hasRight && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.right_column!.map((item, i) => (
                  <Card key={i}>
                    <SectionHeader label={clean(item.title)} color={accent} />
                    <div style={{ padding: '8px 14px', fontSize: 9, color: DARK_MUTED, lineHeight: 1.6 }}>{item.description}</div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {hasHighlights && <HighlightCards highlights={data.highlights!} accent={accent} />}
        {hasTimeline && <TimelineSection events={data.timeline_events!} accent={accent} />}
      </div>

      <div style={{ background: DARK_CARD, borderTop: `1px solid ${DARK_BORDER}`, padding: '6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 8, color: DARK_MUTED, letterSpacing: 1 }}>📄 Document Analysis — Restricted</span>
        <span style={{ fontSize: 8, color: DARK_MUTED, letterSpacing: 1 }}>DO NOT DISTRIBUTE</span>
      </div>
    </div>
  )
}

// ── Router ────────────────────────────────────────────────────────────────────

function InfographicRouter({ data }: { data: InfographicResponse }) {
  const type = resolveType(data)
  if (type === 'bank') return <BankStatementView data={data} />
  if (type === 'cdr') return <MobileCDRView data={data} />
  if (type === 'criminal') return <GangsterProfileView data={data} />
  return <GenericView data={data} />
}

// ── Fallback markdown parser ───────────────────────────────────────────────────

function parseMarkdownToInfographic(raw: string): InfographicResponse {
  const lines = raw.split('\n')
  const sections: InfographicColumn[] = []
  let firstHeading = ''
  let currentHeader = ''
  let currentContent: string[] = []

  const finalizeSection = () => {
    const desc = currentContent.join('\n').trim()
    if (!desc) return
    sections.push({ title: currentHeader || 'Section', description: desc, icon: 'info' })
    currentContent = []
  }

  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (!firstHeading && t.length > 5) firstHeading = t
    if (t.startsWith('**') && t.endsWith('**') && t.length > 5) {
      finalizeSection()
      currentHeader = t
    } else {
      currentContent.push(line)
    }
  }
  finalizeSection()

  return {
    source_id: '',
    document_type: 'general',
    header: { title: firstHeading || 'Document Analysis', subtitle: '' },
    left_column: sections.slice(0, Math.ceil(sections.length / 2)),
    right_column: sections.slice(Math.ceil(sections.length / 2)),
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

export function isInfographicInsight(insightType: string): boolean {
  return insightType.toLowerCase().includes('infographic')
}

export function InfographicInsightViewer({ content }: { content?: string }) {
  const [uploadedData, setUploadedData] = useState<InfographicResponse | null>(null)

  const staticData = useMemo<InfographicResponse | null>(() => {
    if (!content) return null
    const merged = extractAndMergeJson(content)
    if (merged && (merged.header || merged.document_type)) return merged
    return parseMarkdownToInfographic(content)
  }, [content])

  const data = staticData ?? uploadedData

  return (
    <div>
      {!staticData && !uploadedData && (
        <div style={{ padding: '20px', textAlign: 'center', color: DARK_MUTED, fontSize: 12 }}>
          No infographic data available.
        </div>
      )}
      {!staticData && uploadedData && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={() => setUploadedData(null)}
            style={{ fontSize: 11, padding: '4px 12px', background: 'rgba(255,255,255,0.06)', border: '1px solid #334155', borderRadius: 6, color: DARK_MUTED, cursor: 'pointer' }}
          >
            ↩ Upload another file
          </button>
        </div>
      )}
      {data && <InfographicRouter data={data} />}
    </div>
  )
}
