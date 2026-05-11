// ── Pure helper functions — all original logic preserved ──────────────────────

import type { InfographicResponse, DocumentType, ThemeTokens } from './types'

export function clean(text: unknown): string {
  if (text === null || text === undefined) return ''
  const s = String(text)
  return s.replace(/\*{1,3}/g, '').replace(/_{1,3}/g, '').replace(/#+\s/g, '').trim()
}

export function hasValue(text: unknown): boolean {
  const value = clean(text)
  if (!value) return false
  const lowered = value.toLowerCase()
  return !['null', 'none', 'n/a', 'na', '...', '-', '--', 'unknown'].includes(lowered)
}

function repairJson(raw: string): string {
  let s = raw
  s = s.replace(/,\s*\.\.\.\s*([}\]])/g, '$1')
  s = s.replace(/\.\.\.\s*([}\]])/g, '$1')
  s = s.replace(/:\s*(-?\d{1,3}(?:,\d{3})+(?:\.\d+)?)/g, (_, n) => ': ' + n.replace(/,/g, ''))
  s = s.replace(/,\s*([}\]])/g, '$1')
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
    if (b.top_contacts?.length) {
      const existing = merged.top_contacts ?? []
      const nums = new Set(existing.map(c => c.number))
      merged.top_contacts = [...existing, ...b.top_contacts.filter(c => c.number && !nums.has(c.number))]
    }
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
    if (!merged.header?.title && b.header?.title) merged.header = b.header
    if (!merged.stat?.value && b.stat?.value) merged.stat = b.stat
  }

  if (merged.timeline_events) {
    const seen = new Set<string>()
    merged.timeline_events = merged.timeline_events
      .filter(e => hasValue(e.date) && hasValue(e.event))
      .filter(e => { const k = `${e.date}|${e.event?.slice(0, 30)}`; if (seen.has(k)) return false; seen.add(k); return true })
      .sort((a, b) => a.date.localeCompare(b.date))
  }
  if (merged.highlights) merged.highlights = merged.highlights.filter(h => hasValue(h.title) || hasValue(h.description))
  if (merged.case_details) merged.case_details = merged.case_details.filter(c => hasValue(c.fir_no) || hasValue(c.section) || hasValue(c.date) || hasValue(c.police_station) || hasValue(c.status))
  if (merged.associates) merged.associates = merged.associates.filter(a => hasValue(a.name) || hasValue(a.relation))
  return merged
}

export function flattenSubject(subject: unknown): Record<string, string> {
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
    for (const [k, v] of Object.entries(result)) {
      if (!hasValue(k) || !hasValue(v)) delete result[k]
    }
    return result
  }
  return {}
}

export function resolveType(data: InfographicResponse): DocumentType {
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

export function resolveTheme(type: DocumentType): ThemeTokens {
  switch (type) {
    case 'bank':
      return {
        accent: '#059669', accentLight: '#d1fae5', accentDim: '#05966920',
        bg: '#0a1628', cardBg: '#0f2040', cardBorder: '#1a3a5c',
        headerBg: '#071020', textPrimary: '#e2f0ff', textMuted: '#7aa3c8',
        badge: '#059669', badgeText: '#fff', label: '🏦 BANK STATEMENT ANALYSIS',
      }
    case 'cdr':
      return {
        accent: '#0ea5e9', accentLight: '#e0f2fe', accentDim: '#0ea5e920',
        bg: '#060d1a', cardBg: '#0c1830', cardBorder: '#162a48',
        headerBg: '#040a14', textPrimary: '#dff0ff', textMuted: '#6b9ec0',
        badge: '#0ea5e9', badgeText: '#fff', label: '📡 MOBILE CDR ANALYSIS',
      }
    case 'criminal':
      return {
        accent: '#6366f1', accentLight: '#ede9fe', accentDim: '#6366f115',
        bg: '#f8fafc', cardBg: '#ffffff', cardBorder: '#e2e8f0',
        headerBg: '#1e293b', textPrimary: '#1e293b', textMuted: '#64748b',
        badge: '#1e40af', badgeText: '#fff', label: '🛡️ CRIMINAL INTELLIGENCE FILE',
      }
    default:
      return {
        accent: '#7c3aed', accentLight: '#ede9fe', accentDim: '#7c3aed18',
        bg: '#0d1117', cardBg: '#1a1f2e', cardBorder: '#2d3550',
        headerBg: '#111827', textPrimary: '#f0f0f0', textMuted: '#a0aab8',
        badge: '#7c3aed', badgeText: '#fff', label: '📄 DOCUMENT ANALYSIS',
      }
  }
}

export function parseMarkdownToInfographic(raw: string): InfographicResponse {
  const lines = raw.split('\n')
  const sections: { title: string; description: string; icon: string }[] = []
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
