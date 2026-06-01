'use client'

import { useEffect, useRef, useState, useMemo, forwardRef } from 'react'
import { ChevronUp, ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FormattedViewDialogProps {
  text: string
  sourceId?: string
  open: boolean
  onClose: () => void
}

// ── Types ─────────────────────────────────────────────────────────────────────
type DocType = 'csv' | 'tsv' | 'plain'

interface ParsedDoc {
  type: DocType
  headers: string[]
  rows: string[][]
  plainHtml: string
}

function parseCdrCsvExcerpt(text: string): ParsedDoc | null {
  const normalized = text.replace(/\r\n/g, '\n')
  const excerptIdx = normalized.indexOf('=== SOURCE EXCERPT ===')
  const body = excerptIdx >= 0 ? normalized.slice(excerptIdx + '=== SOURCE EXCERPT ==='.length) : normalized
  const lines = body.split('\n').map(line => line.trim()).filter(Boolean)

  const headerIdx = lines.findIndex(line => {
    const low = line.toLowerCase()
    return low.includes('target no') && low.includes('call type') && (low.includes('dur(s)') || low.includes('dur'))
  })
  if (headerIdx < 0) return null

  const headers = splitRow(lines[headerIdx], ',').map(col => col.replace(/^'+|'+$/g, '').trim())
  if (headers.length < 8) return null

  const rows: string[][] = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line || line.startsWith('===')) break
    const parsed = splitRow(line, ',').map(col => col.replace(/^'+|'+$/g, '').trim())
    if (parsed.length < 5) continue
    const nonEmpty = parsed.filter(Boolean).length
    if (nonEmpty < 4) continue
    const normalizedRow = Array.from({ length: headers.length }, (_, idx) => parsed[idx] ?? '')
    rows.push(normalizedRow)
    if (rows.length >= 5000) break
  }

  if (rows.length === 0) return null
  return { type: 'csv', headers, rows, plainHtml: '' }
}

function parseGenericDelimitedTable(text: string): ParsedDoc | null {
  const lines = text.replace(/\r\n/g, '\n').split('\n').map(line => line.trim()).filter(Boolean)
  if (lines.length < 5) return null

  const separators = ['\t', ',', '|', ';']
  for (const sep of separators) {
    let headerIdx = -1
    let headers: string[] = []
    let expectedCols = 0

    for (let i = 0; i < Math.min(lines.length - 3, 350); i++) {
      const c0 = splitRow(lines[i], sep).map(c => c.trim())
      if (c0.length < 3) continue
      const c1 = splitRow(lines[i + 1], sep).map(c => c.trim())
      const c2 = splitRow(lines[i + 2], sep).map(c => c.trim())
      const c3 = splitRow(lines[i + 3], sep).map(c => c.trim())
      const near = (n: number) => n >= Math.max(2, c0.length - 1)
      if (near(c1.length) && near(c2.length) && near(c3.length)) {
        headerIdx = i
        headers = c0.map(c => c.replace(/^'+|'+$/g, '').trim())
        expectedCols = headers.length
        break
      }
    }

    if (headerIdx < 0 || expectedCols < 3) continue

    const rows: string[][] = []
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line || /^===\s*.+\s*===$/.test(line)) break
      const parsed = splitRow(line, sep).map(c => c.replace(/^'+|'+$/g, '').trim())
      const nonEmpty = parsed.filter(Boolean).length
      if (nonEmpty < Math.max(2, Math.floor(expectedCols * 0.4))) continue
      rows.push(Array.from({ length: expectedCols }, (_, idx) => parsed[idx] ?? ''))
      if (rows.length >= 8000) break
    }

    if (rows.length >= 3) {
      return {
        type: sep === '\t' ? 'tsv' : 'csv',
        headers,
        rows,
        plainHtml: '',
      }
    }
  }

  return null
}

// ── Deduplicate repeated content blocks ───────────────────────────────────────
function deduplicateContent(text: string): string {
  if (!text) return text
  // Mobile-data summaries intentionally contain repetitive, high-volume rows.
  // Deduping them corrupts structure and breaks formatted rendering.
  const mobileSignals = [
    '=== MOBILE DATA SUMMARY ===',
    '=== TOP CONTACTS (sample) ===',
    '=== CALL ACTIVITY BY DAY (sample) ===',
    '=== SOURCE EXCERPT ===',
  ]
  if (mobileSignals.some(signal => text.includes(signal))) return text

  const lines = text.split('\n')
  const WINDOW = 5
  const seen = new Set<string>()
  const keep = new Array<boolean>(lines.length).fill(true)
  const nonEmptyIdx: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim()) nonEmptyIdx.push(i)
  }
  for (let w = 0; w <= nonEmptyIdx.length - WINDOW; w++) {
    const windowLines = nonEmptyIdx.slice(w, w + WINDOW)
    const fingerprint = windowLines.map(i => lines[i].trim().toLowerCase().replace(/\s+/g, ' ')).join('|')
    if (seen.has(fingerprint)) {
      for (const idx of windowLines) keep[idx] = false
    } else {
      seen.add(fingerprint)
    }
  }
  const result = lines.filter((_, i) => keep[i])
  const rejoined = result.join('\n')
  const paras = rejoined.split(/\n{2,}/)
  const seenParas = new Set<string>()
  const uniqueParas: string[] = []
  for (const para of paras) {
    const key = para.trim().replace(/\s+/g, ' ').toLowerCase()
    if (!key) { uniqueParas.push(para); continue }
    if (seenParas.has(key)) continue
    seenParas.add(key)
    uniqueParas.push(para)
  }
  return uniqueParas.join('\n\n')
}

// ── Detect & parse ────────────────────────────────────────────────────────────
function parseDoc(text: string): ParsedDoc {
  const mobileSummaryHtml = parseMobileSummaryHtml(text)
  if (mobileSummaryHtml) {
    return { type: 'plain', headers: [], rows: [], plainHtml: mobileSummaryHtml }
  }

  const cdrTable = parseCdrCsvExcerpt(text)
  if (cdrTable) return cdrTable

  const genericTable = parseGenericDelimitedTable(text)
  if (genericTable) return genericTable

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const sample = lines.slice(0, 30)

  const tabCount   = sample.filter(l => l.split('\t').length >= 3).length
  const commaCount = sample.filter(l => splitRow(l, ',').length >= 3).length
  const sep = tabCount >= 3 ? '\t' : commaCount >= 5 ? ',' : null

  if (sep) {
    const rows = lines.map(l => splitRow(l, sep))
    const maxCols = Math.max(...rows.map(r => r.length))
    const normalized = rows.map(r => Array.from({ length: maxCols }, (_, i) => r[i] ?? ''))
    return { type: sep === '\t' ? 'tsv' : 'csv', headers: normalized[0], rows: normalized.slice(1), plainHtml: '' }
  }

  return { type: 'plain', headers: [], rows: [], plainHtml: toPlainHtml(text) }
}

function splitRow(line: string, sep: string): string[] {
  const cells: string[] = []
  let cur = '', inSingle = false, inDouble = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === "'" && !inDouble) { inSingle = !inSingle; continue }
    if (ch === '"' && !inSingle) { inDouble = !inDouble; continue }
    if (ch === sep && !inSingle && !inDouble) { cells.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  cells.push(cur.trim())
  return cells
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatNumeric(value: string): string {
  const n = Number(String(value).replace(/[^0-9.-]/g, ''))
  if (!Number.isFinite(n)) return value
  return n.toLocaleString('en-IN')
}

function parseMobileSummaryHtml(text: string): string | null {
  const lines = text.replace(/\r\n/g, '\n').split('\n').map(line => line.trim()).filter(Boolean)
  const hasMobileHeader = lines.some(line => /^===\s*mobile data summary\s*===$/i.test(line))
  const hasContactPattern = lines.some(line => /\|\s*count\s*=\s*\d+/i.test(line) && /\|\s*dur_?sec\s*=\s*\d+/i.test(line))
  const hasActivityPattern = lines.some(line => /^\d{4}-\d{2}-\d{2}\s*:\s*\d+$/i.test(line))
  const hasSummaryPattern = lines.some(line => /^(parsed rows|unique contacts|sms rows|date range)\s*:/i.test(line))
  if (!hasMobileHeader && !hasContactPattern && !hasActivityPattern && !hasSummaryPattern) return null

  type ContactRow = { number: string; count: string; incoming: string; outgoing: string; durSec: string }
  type ActivityRow = { date: string; count: string }

  const summaryLines: string[] = []
  const contactLines: string[] = []
  const activityLines: string[] = []
  const excerptLines: string[] = []
  const extraLines: string[] = []

  let section: 'summary' | 'contacts' | 'activity' | 'excerpt' | 'other' = 'summary'
  for (const line of lines) {
    const marker = line.match(/^===\s*(.+?)\s*===$/i)
    if (marker) {
      const label = marker[1].toLowerCase()
      if (label.includes('top contacts')) section = 'contacts'
      else if (label.includes('call activity by day')) section = 'activity'
      else if (label.includes('source excerpt')) section = 'excerpt'
      else if (label.includes('mobile data summary')) section = 'summary'
      else section = 'other'
      continue
    }

    // Heuristic section detection when markers are missing.
    if (!marker) {
      if (/\|\s*count\s*=\s*\d+/i.test(line) && /\|\s*dur_?sec\s*=\s*\d+/i.test(line)) {
        contactLines.push(line)
        continue
      }
      if (/^\d{4}-\d{2}-\d{2}\s*:\s*\d+$/i.test(line)) {
        activityLines.push(line)
        continue
      }
      if (/^(parsed rows|unique contacts|sms rows|date range)\s*:/i.test(line)) {
        summaryLines.push(line)
        continue
      }
    }

    if (section === 'summary') summaryLines.push(line)
    else if (section === 'contacts') contactLines.push(line)
    else if (section === 'activity') activityLines.push(line)
    else if (section === 'excerpt') excerptLines.push(line)
    else extraLines.push(line)
  }

  const summaryPairs = summaryLines
    .map(line => {
      const kv = line.match(/^([^:]{2,80}):\s*(.+)$/)
      if (!kv) return null
      return { key: kv[1].trim(), value: kv[2].trim() }
    })
    .filter((item): item is { key: string; value: string } => !!item)

  const contacts: ContactRow[] = contactLines
    .map(line => {
      const parts = line.split('|').map(part => part.trim()).filter(Boolean)
      if (!parts.length) return null
      const row: ContactRow = {
        number: parts[0] ?? '',
        count: '',
        incoming: '',
        outgoing: '',
        durSec: '',
      }
      for (const part of parts.slice(1)) {
        const m = part.match(/^([a-z_]+)\s*=\s*(.+)$/i)
        if (!m) continue
        const key = m[1].toLowerCase()
        const value = m[2].trim()
        if (key === 'count' || key === 'call_count') row.count = value
        else if (key === 'in' || key === 'incoming') row.incoming = value
        else if (key === 'out' || key === 'outgoing') row.outgoing = value
        else if (key === 'dur_sec' || key === 'duration_sec') row.durSec = value
      }
      return row.number ? row : null
    })
    .filter((item): item is ContactRow => !!item)

  const activity: ActivityRow[] = activityLines
    .map(line => {
      const m = line.match(/^(\d{4}-\d{2}-\d{2})\s*:\s*(\d+)$/)
      if (!m) return null
      return { date: m[1], count: m[2] }
    })
    .filter((item): item is ActivityRow => !!item)

  const parts: string[] = []
  parts.push('<h1>Mobile Data Summary</h1>')

  if (summaryPairs.length > 0) {
    const rows = summaryPairs
      .map(item => `<tr><td class="kv-key">${esc(item.key)}</td><td class="kv-val">${esc(item.value)}</td></tr>`)
      .join('\n')
    parts.push(`<table class="kv-table"><tbody>${rows}</tbody></table>`)
  }

  if (contacts.length > 0) {
    const rows = contacts
      .map(
        (row, index) =>
          `<tr>
            <td class="mds-num">${index + 1}</td>
            <td>${esc(row.number)}</td>
            <td>${esc(formatNumeric(row.count || '-'))}</td>
            <td>${esc(formatNumeric(row.incoming || '-'))}</td>
            <td>${esc(formatNumeric(row.outgoing || '-'))}</td>
            <td>${esc(formatNumeric(row.durSec || '-'))}</td>
          </tr>`
      )
      .join('\n')
    parts.push('<h2>Top Contacts</h2>')
    parts.push(`
      <div class="mds-table-wrap">
        <table class="mds-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Number</th>
              <th>Count</th>
              <th>Incoming</th>
              <th>Outgoing</th>
              <th>Duration (sec)</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `)
  }

  if (activity.length > 0) {
    const rows = activity
      .map(
        row =>
          `<tr>
            <td>${esc(row.date)}</td>
            <td>${esc(formatNumeric(row.count))}</td>
          </tr>`
      )
      .join('\n')
    parts.push('<h2>Call Activity By Day</h2>')
    parts.push(`
      <div class="mds-table-wrap">
        <table class="mds-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Total Events</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `)
  }

  if (extraLines.length > 0) {
    parts.push('<h2>Additional Details</h2>')
    const preview = extraLines.slice(0, 40)
    for (const line of preview) {
      parts.push(`<p>${esc(line)}</p>`)
    }
    if (extraLines.length > preview.length) {
      const rest = extraLines.slice(preview.length, preview.length + 800)
      parts.push(`
        <details class="mds-details">
          <summary>Show more details (${(extraLines.length - preview.length).toLocaleString()} lines)</summary>
          <pre class="mds-pre">${esc(rest.join('\n'))}</pre>
        </details>
      `)
    }
  }

  if (excerptLines.length > 0) {
    const csvCandidates = excerptLines
      .map(line => splitRow(line, ','))
      .filter(cols => cols.length >= 6)

    let excerptBody = ''
    if (csvCandidates.length >= 4) {
      const header = csvCandidates[0]
      const rows = csvCandidates.slice(1, 201)
      const headHtml = header.map(col => `<th>${esc(col)}</th>`).join('')
      const rowHtml = rows
        .map(
          row => `<tr>${row.map(col => `<td>${esc(col)}</td>`).join('')}</tr>`
        )
        .join('\n')
      excerptBody = `
        <div class="mds-table-wrap">
          <table class="mds-table">
            <thead><tr>${headHtml}</tr></thead>
            <tbody>${rowHtml}</tbody>
          </table>
        </div>
        <p class="mds-note">Showing first ${rows.length} parsed rows from source excerpt.</p>
      `
    } else {
      const previewLines = excerptLines.slice(0, 2000)
      excerptBody = `
        <pre class="mds-pre">${esc(previewLines.join('\n'))}</pre>
        <p class="mds-note">Showing first ${previewLines.length.toLocaleString()} lines from source excerpt.</p>
      `
    }

    parts.push('<h2>Source Excerpt</h2>')
    parts.push(`
      <details class="mds-details">
        <summary>Open raw source excerpt preview</summary>
        ${excerptBody}
      </details>
    `)
  }

  return parts.join('\n')
}

function toPlainHtml(text: string): string {
  const mobileSummaryHtml = parseMobileSummaryHtml(text)
  if (mobileSummaryHtml) return mobileSummaryHtml

  const lines = text.replace(/\r\n/g, '\n').split('\n').map(l => l.trim())

  const isLabel = (s: string) =>
    s.length > 0 && s.length < 60 &&
    !/^\d{2}[-/]\d{2}[-/]\d{4}/.test(s) &&
    !/^\d+(\.\d+)?$/.test(s) &&
    !/^[A-Z0-9]{6,}$/.test(s)

  let labelValuePairs = 0
  for (let i = 0; i < Math.min(lines.length - 1, 40); i++) {
    if (lines[i] && lines[i + 1] && isLabel(lines[i]) && !isLabel(lines[i + 1])) labelValuePairs++
  }

  if (labelValuePairs >= 4) return parseLabelValueDoc(lines)

  const parts: string[] = []
  let inUl = false
  const closeUl = () => { if (inUl) { parts.push('</ul>'); inUl = false } }

  for (const line of lines) {
    if (!line) { closeUl(); parts.push('<p></p>'); continue }
    const pageMarker = line.match(/^===\s*(Page\s+\d+)\s*===$/i)
    if (pageMarker) { closeUl(); parts.push(`<h2>${esc(pageMarker[1])}</h2>`); continue }
    const h1 = line.match(/^#\s+(.+)/);   if (h1) { closeUl(); parts.push(`<h1>${esc(h1[1])}</h1>`); continue }
    const h2 = line.match(/^##\s+(.+)/);  if (h2) { closeUl(); parts.push(`<h2>${esc(h2[1])}</h2>`); continue }
    const h3 = line.match(/^###\s+(.+)/); if (h3) { closeUl(); parts.push(`<h3>${esc(h3[1])}</h3>`); continue }
    const bold = line.match(/^\*{1,2}([^*]{2,80})\*{1,2}$/)
    if (bold) { closeUl(); parts.push(`<h3>${esc(bold[1])}</h3>`); continue }
    if (/^[A-Z][A-Z\s\d:,.()\-/]{3,}$/.test(line) && line.length < 80 && !/[a-z]/.test(line)) {
      closeUl(); parts.push(`<h2>${esc(line)}</h2>`); continue
    }
    const kv = line.match(/^([^:\n]{2,40}):\s+(.+)$/)
    if (kv && !line.includes(',')) { closeUl(); parts.push(`<p><strong>${esc(kv[1])}:</strong> ${esc(kv[2])}</p>`); continue }
    const eqKv = line.match(/^([A-Za-z][A-Za-z0-9 _\/().-]{1,48})\s*=\s*(.+)$/)
    if (eqKv && !line.includes(',')) { closeUl(); parts.push(`<p><strong>${esc(eqKv[1])}:</strong> ${esc(eqKv[2])}</p>`); continue }
    if (/^[-•*]\s+/.test(line)) {
      if (!inUl) { parts.push('<ul>'); inUl = true }
      parts.push(`<li>${esc(line.replace(/^[-•*]\s+/, ''))}</li>`)
      continue
    }
    closeUl()
    parts.push(`<p>${esc(line)}</p>`)
  }
  closeUl()
  return parts.join('\n')
}

function parseLabelValueDoc(lines: string[]): string {
  const parts: string[] = []
  let tableRows: [string, string][] = []
  let i = 0
  const flushTable = () => {
    if (!tableRows.length) return
    const rows = tableRows.map(([k, v]) => `<tr><td class="kv-key">${esc(k)}</td><td class="kv-val">${esc(v)}</td></tr>`).join('\n')
    parts.push(`<table class="kv-table"><tbody>${rows}</tbody></table>`)
    tableRows = []
  }
  while (i < lines.length) {
    const line = lines[i]
    if (!line) { i++; continue }
    const pageMarker = line.match(/^===\s*(Page\s+\d+)\s*===$/i)
    if (pageMarker) { flushTable(); parts.push(`<h2>${esc(pageMarker[1])}</h2>`); i++; continue }
    const kv = line.match(/^([^:\n]{2,50}):\s+(.+)$/)
    if (kv) { tableRows.push([kv[1].trim(), kv[2].trim()]); i++; continue }
    const nextIdx = lines.findIndex((l, j) => j > i && l.trim() !== '')
    const next = nextIdx >= 0 ? lines[nextIdx] : ''
    const looksLikeLabel = line.length < 60 && !/^\d{2}[-/]\d{2}[-/]\d{4}/.test(line) && !/^\d+(\.\d+)?$/.test(line)
    const looksLikeValue = next.length > 0 && (/^\d/.test(next) || next.length < 50 || /^[A-Z]{2,}/.test(next))
    if (looksLikeLabel && looksLikeValue && nextIdx === i + 1) { tableRows.push([line, next]); i += 2; continue }
    if (/^[A-Z][A-Z\s\d:,.()\-/]{3,}$/.test(line) && !/[a-z]/.test(line) && line.length < 80) {
      flushTable(); parts.push(`<h2>${esc(line)}</h2>`); i++; continue
    }
    if (/^\d{2}[-/]\d{2}[-/]\d{4}/.test(line)) { flushTable(); parts.push(`<p class="txn">${esc(line)}</p>`); i++; continue }
    flushTable(); parts.push(`<p>${esc(line)}</p>`); i++
  }
  flushTable()
  return parts.join('\n')
}

// ── Virtual table ─────────────────────────────────────────────────────────────
const ROW_H = 32
const VISIBLE = 30

const VirtualTable = forwardRef<HTMLDivElement, { headers: string[]; rows: string[][]; query: string }>(
  function VirtualTable({ headers, rows, query }, forwardedRef) {
  const [scrollTop, setScrollTop] = useState(0)
  const [currentRow, setCurrentRow] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.toLowerCase()
    return rows.filter(row => row.some(cell => cell.toLowerCase().includes(q)))
  }, [rows, query])

  // Reset current row when query changes
  useEffect(() => { setCurrentRow(0) }, [query])

  const totalH = filteredRows.length * ROW_H
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - 5)
  const endIdx = Math.min(filteredRows.length, startIdx + VISIBLE + 10)
  const visibleRows = filteredRows.slice(startIdx, endIdx)
  const offsetY = startIdx * ROW_H

  // Scroll to a specific row index
  const scrollToRow = (idx: number) => {
    const sc = scrollRef.current
    if (!sc) return
    const targetTop = idx * ROW_H
    const scH = sc.clientHeight
    const currentScroll = sc.scrollTop
    if (targetTop < currentScroll || targetTop + ROW_H > currentScroll + scH) {
      sc.scrollTo({ top: targetTop - scH / 2 + ROW_H / 2, behavior: 'smooth' })
    }
  }

  // Expose navigate function via imperative handle pattern
  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: Event) => {
      const dir = (e as CustomEvent).detail as 1 | -1
      if (!filteredRows.length) return
      const next = ((currentRow + dir + filteredRows.length) % filteredRows.length)
      setCurrentRow(next)
      scrollToRow(next)
    }
    el.addEventListener('navigate', handler)
    return () => el.removeEventListener('navigate', handler)
  }, [currentRow, filteredRows.length])

  const hlCell = (cell: string) => {
    if (!query.trim()) return esc(cell)
    const re = new RegExp(`(${query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return esc(cell).replace(re, '<mark style="background:#fef08a;border-radius:2px;padding:0 1px">$1</mark>')
  }

  // Calculate dynamic minimum table width to ensure columns aren't completely squished
  // and force horizontal scroll if necessary.
  const minTableWidth = Math.max(800, headers.length * 150 + 48)

  // Shared column definitions to perfectly align the header table and the body table
  const colGroup = (
    <colgroup>
      <col style={{ width: '48px' }} />
      {headers.map((_, i) => (
        <col key={i} />
      ))}
    </colgroup>
  )

  return (
    <div ref={(el) => {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
      if (typeof forwardedRef === 'function') forwardedRef(el)
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = el
    }} className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm relative">
      <div style={{ minWidth: minTableWidth }}>
        
        {/* Header Table */}
        <table className="w-full text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
          {colGroup}
          <thead>
            <tr>
              <th className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-left font-semibold border-b border-slate-200 dark:border-slate-700 text-slate-500 truncate sticky top-0 z-10">#</th>
              {headers.map((h, i) => (
                <th key={i} className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-left font-semibold border-b border-slate-200 dark:border-slate-700 truncate sticky top-0 z-10" title={h}>{h}</th>
              ))}
            </tr>
          </thead>
        </table>

        {/* Body Container */}
        <div ref={scrollRef} style={{ height: Math.min(totalH, 540), overflowY: 'auto' }} onScroll={e => setScrollTop((e.target as HTMLDivElement).scrollTop)}>
          <div style={{ height: totalH, position: 'relative' }}>
            
            {/* Body Table */}
            <table className="w-full text-xs border-collapse" style={{ tableLayout: 'fixed', position: 'absolute', top: offsetY }}>
              {colGroup}
              <tbody>
                {visibleRows.map((row, i) => {
                  const absIdx = startIdx + i
                  const isCurrent = absIdx === currentRow && query.trim() !== ''
                  return (
                    <tr key={absIdx}
                      className={isCurrent
                        ? 'bg-orange-50 dark:bg-orange-900/20 outline outline-2 outline-orange-400 z-10 relative'
                        : absIdx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/30'
                      }>
                      <td className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-slate-400 text-right font-mono truncate">{absIdx + 1}</td>
                      {row.map((cell, j) => (
                        <td key={j} className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 truncate" title={cell}
                          dangerouslySetInnerHTML={{ __html: hlCell(cell) }} />
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Sticky footer wrapper to ensure it stays in view while scrolling horizontally */}
      <div className="sticky left-0 right-0 w-full text-xs text-slate-400 px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between pointer-events-none">
        <span className="pointer-events-auto">{query.trim() ? `${filteredRows.length} of ${rows.length} rows match` : `${rows.length} rows · ${headers.length} columns`}</span>
        {query.trim() && filteredRows.length > 0 && (
          <span className="text-slate-500 font-medium pointer-events-auto">Row {currentRow + 1} of {filteredRows.length}</span>
        )}
      </div>
    </div>
  )
})

// ── Plain text viewer with DOM-based search ───────────────────────────────────
function PlainViewer({ html, query }: { html: string; query: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [matchCount, setMatchCount] = useState(0)
  const [currentMatch, setCurrentMatch] = useState(0)
  const matchEls = useRef<HTMLMapElement[]>([])

  // Re-render with highlights whenever query changes
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Always reset to clean HTML first
    el.innerHTML = html

    const q = query.trim()
    if (!q) {
      setMatchCount(0)
      setCurrentMatch(0)
      matchEls.current = []
      return
    }

    // Walk text nodes and wrap matches
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []
    let node: Node | null
    while ((node = walker.nextNode())) textNodes.push(node as Text)

    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const marks: HTMLMapElement[] = []

    for (const tn of textNodes) {
      const val = tn.nodeValue ?? ''
      if (!re.test(val)) { re.lastIndex = 0; continue }
      re.lastIndex = 0

      const frag = document.createDocumentFragment()
      let last = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(val)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(val.slice(last, m.index)))
        const mark = document.createElement('mark') as HTMLMapElement
        mark.style.cssText = 'background:#fef08a;border-radius:2px;padding:0 1px;color:inherit'
        mark.textContent = m[0]
        frag.appendChild(mark)
        marks.push(mark)
        last = m.index + m[0].length
      }
      if (last < val.length) frag.appendChild(document.createTextNode(val.slice(last)))
      tn.parentNode?.replaceChild(frag, tn)
    }

    matchEls.current = marks
    setMatchCount(marks.length)
    setCurrentMatch(marks.length > 0 ? 1 : 0)

    if (marks[0]) {
      marks[0].style.background = '#f97316'
      marks[0].style.color = '#fff'
      marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [html, query])

  return (
    <div
      ref={containerRef}
      className="prose prose-sm prose-slate dark:prose-invert max-w-none
        [&_h1]:text-base [&_h1]:font-black [&_h1]:mt-6 [&_h1]:mb-2
        [&_h2]:text-[11px] [&_h2]:font-black [&_h2]:tracking-widest [&_h2]:uppercase [&_h2]:text-slate-400 [&_h2]:mt-7 [&_h2]:mb-2 [&_h2]:border-b [&_h2]:pb-1
        [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-1
        [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-1.5
        [&_ul]:space-y-1 [&_li]:text-sm [&_strong]:font-semibold
        [&_.kv-table]:w-full [&_.kv-table]:mb-4 [&_.kv-table]:border-collapse
        [&_.kv-key]:text-xs [&_.kv-key]:font-semibold [&_.kv-key]:text-slate-500 [&_.kv-key]:uppercase [&_.kv-key]:tracking-wide [&_.kv-key]:py-1.5 [&_.kv-key]:pr-4 [&_.kv-key]:pl-2 [&_.kv-key]:w-48 [&_.kv-key]:border-b [&_.kv-key]:border-slate-100 [&_.kv-key]:align-top
        [&_.kv-val]:text-sm [&_.kv-val]:text-slate-800 dark:[&_.kv-val]:text-slate-200 [&_.kv-val]:py-1.5 [&_.kv-val]:border-b [&_.kv-val]:border-slate-100 [&_.kv-val]:font-medium
        [&_.txn]:font-mono [&_.txn]:text-xs [&_.txn]:text-slate-600 [&_.txn]:bg-slate-50 [&_.txn]:px-2 [&_.txn]:py-1 [&_.txn]:rounded [&_.txn]:mb-1"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function FormattedViewDialog({ text, open, onClose }: FormattedViewDialogProps) {
  const MAX_PARSE_CHARS = 2_000_000
  const [query, setQuery]           = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  // Keep source text intact for reliable structure detection across all document types.
  // Parse only a safe preview slice to avoid memory spikes on huge documents.
  const parseText = useMemo(
    () => (text.length > MAX_PARSE_CHARS ? text.slice(0, MAX_PARSE_CHARS) : text),
    [text]
  )
  const isTruncatedForView = text.length > MAX_PARSE_CHARS
  const doc = useMemo(() => parseDoc(parseText), [parseText])

  const [plainMatchCount, setPlainMatchCount] = useState(0)
  const [plainCurrentMatch, setPlainCurrentMatch] = useState(0)
  const plainMatchElsRef = useRef<HTMLMapElement[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // DOM-based search for plain text
  useEffect(() => {
    const el = containerRef.current
    if (!el || doc.type !== 'plain') return

    // Reset to clean HTML
    el.innerHTML = doc.plainHtml

    const q = query.trim()
    if (!q) {
      setPlainMatchCount(0)
      setPlainCurrentMatch(0)
      plainMatchElsRef.current = []
      return
    }

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []
    let node: Node | null
    while ((node = walker.nextNode())) textNodes.push(node as Text)

    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const marks: HTMLMapElement[] = []

    for (const tn of textNodes) {
      const val = tn.nodeValue ?? ''
      re.lastIndex = 0
      if (!re.test(val)) continue
      re.lastIndex = 0

      const frag = document.createDocumentFragment()
      let last = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(val)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(val.slice(last, m.index)))
        const mark = document.createElement('mark') as HTMLMapElement
        mark.style.cssText = 'background:#fef08a;border-radius:2px;padding:0 1px;color:inherit'
        mark.textContent = m[0]
        frag.appendChild(mark)
        marks.push(mark)
        last = m.index + m[0].length
      }
      if (last < val.length) frag.appendChild(document.createTextNode(val.slice(last)))
      tn.parentNode?.replaceChild(frag, tn)
    }

    plainMatchElsRef.current = marks
    setPlainMatchCount(marks.length)
    setPlainCurrentMatch(marks.length > 0 ? 1 : 0)

    if (marks[0]) {
      marks[0].style.background = '#f97316'
      marks[0].style.color = '#fff'
      setTimeout(() => {
        const sc = scrollContainerRef.current
        if (sc) {
          const markTop = marks[0].getBoundingClientRect().top
          const scTop = sc.getBoundingClientRect().top
          const offset = markTop - scTop - sc.clientHeight / 2
          sc.scrollBy({ top: offset, behavior: 'smooth' })
        } else {
          marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 30)
    }
  }, [doc, query])

  const tableRef = useRef<HTMLDivElement>(null)

  const scrollToMark = (mark: HTMLMapElement) => {
    const sc = scrollContainerRef.current
    if (!sc) { mark.scrollIntoView({ behavior: 'smooth', block: 'center' }); return }
    const markTop = mark.getBoundingClientRect().top
    const scTop = sc.getBoundingClientRect().top
    const scH = sc.clientHeight
    const offset = markTop - scTop - scH / 2 + mark.clientHeight / 2
    sc.scrollBy({ top: offset, behavior: 'smooth' })
  }

  const navigate = (dir: 1 | -1) => {
    if (isTable) {
      // Dispatch custom event to VirtualTable
      tableRef.current?.dispatchEvent(new CustomEvent('navigate', { detail: dir }))
      return
    }
    // Plain text navigation
    const marks = plainMatchElsRef.current
    if (!marks.length) return
    const next = ((plainCurrentMatch - 1 + dir + marks.length) % marks.length)
    setPlainCurrentMatch(next + 1)
    marks.forEach((m, i) => {
      m.style.background = i === next ? '#f97316' : '#fef08a'
      m.style.color = i === next ? '#fff' : 'inherit'
    })
    scrollToMark(marks[next])
  }

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  if (!open) return null

  const isTable = doc.type === 'csv' || doc.type === 'tsv'

  return (
    // Fixed the sidebar overlap by increasing the z-index to 99999 to guarantee top-layer rendering
    <div className="fixed inset-0 z-[99999] flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 sm:px-6 py-4 bg-white border-b border-slate-200 shrink-0">
        <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
          <span className="text-white text-xs font-black">DR</span>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Document Reader</p>
          <h2 className="text-sm font-bold text-slate-900">Formatted View</h2>
        </div>

        {/* Search */}
        <div className="ml-3 sm:ml-6 flex items-center gap-2 flex-1 max-w-md">
          <input
            ref={inputRef}
            type="text"
            placeholder={isTable ? 'Filter rows... (case-insensitive)' : 'Search... (case-insensitive)'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') navigate(1) }}
            className="flex-1 px-3 py-2 text-sm rounded-md bg-white text-slate-900 placeholder:text-slate-400 outline-none border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          {/* Match count — plain text */}
          {!isTable && plainMatchCount > 0 && (
            <span className="text-xs text-slate-600 whitespace-nowrap font-medium">
              {plainCurrentMatch} / {plainMatchCount}
            </span>
          )}
          {!isTable && query.trim() && plainMatchCount === 0 && (
            <span className="text-xs text-red-500 whitespace-nowrap">No results</span>
          )}
          {/* Navigate buttons — always shown */}
          {!isTable && (
            <>
              <button onClick={() => navigate(-1)} disabled={plainMatchCount === 0}
                className="h-8 w-8 rounded border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600 disabled:opacity-30">
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => navigate(1)} disabled={plainMatchCount === 0}
                className="h-8 w-8 rounded border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600 disabled:opacity-30">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        <button onClick={onClose}
          className="ml-auto h-9 w-9 rounded-full border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div ref={scrollContainerRef} className="overflow-auto bg-white flex-1">
        {isTable ? (
          <div className="p-4 w-full h-full">
            <VirtualTable ref={tableRef} headers={doc.headers} rows={doc.rows} query={query} />
          </div>
        ) : (
          <div className="w-full bg-white min-h-full px-4 sm:px-8 lg:px-12 py-8">
            <div
              ref={containerRef}
              className="prose prose-sm prose-slate max-w-none
                [&_h1]:text-base [&_h1]:font-black [&_h1]:mt-6 [&_h1]:mb-2
                [&_h2]:text-[11px] [&_h2]:font-black [&_h2]:tracking-widest [&_h2]:uppercase [&_h2]:text-slate-400 [&_h2]:mt-7 [&_h2]:mb-2 [&_h2]:border-b [&_h2]:pb-1
                [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-1
                [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-1.5
                [&_ul]:space-y-1 [&_li]:text-sm [&_strong]:font-semibold
                [&_table]:w-full [&_table]:table-fixed [&_table]:border-collapse
                [&_td]:break-words [&_th]:break-words
                [&_.kv-table]:w-full [&_.kv-table]:mb-4 [&_.kv-table]:border-collapse
                [&_.kv-key]:text-xs [&_.kv-key]:font-semibold [&_.kv-key]:text-slate-500 [&_.kv-key]:uppercase [&_.kv-key]:tracking-wide [&_.kv-key]:py-1.5 [&_.kv-key]:pr-4 [&_.kv-key]:pl-2 [&_.kv-key]:w-48 [&_.kv-key]:border-b [&_.kv-key]:border-slate-100 [&_.kv-key]:align-top
                [&_.kv-val]:text-sm [&_.kv-val]:text-slate-800 [&_.kv-val]:py-1.5 [&_.kv-val]:border-b [&_.kv-val]:border-slate-100 [&_.kv-val]:font-medium
                [&_.txn]:font-mono [&_.txn]:text-xs [&_.txn]:text-slate-600 [&_.txn]:bg-slate-50 [&_.txn]:px-2 [&_.txn]:py-1 [&_.txn]:rounded [&_.txn]:mb-1
                [&_.mds-table-wrap]:mb-4 [&_.mds-table-wrap]:overflow-x-auto [&_.mds-table-wrap]:rounded-lg [&_.mds-table-wrap]:border [&_.mds-table-wrap]:border-slate-200
                [&_.mds-table]:w-full [&_.mds-table]:border-collapse [&_.mds-table]:text-sm [&_.mds-table]:table-auto
                [&_.mds-table_th]:bg-slate-100 [&_.mds-table_th]:px-3 [&_.mds-table_th]:py-2 [&_.mds-table_th]:text-left [&_.mds-table_th]:font-semibold [&_.mds-table_th]:text-slate-700 [&_.mds-table_th]:border-b [&_.mds-table_th]:border-slate-200
                [&_.mds-table_td]:px-3 [&_.mds-table_td]:py-2 [&_.mds-table_td]:border-b [&_.mds-table_td]:border-slate-100
                [&_.mds-table_tbody_tr:nth-child(even)]:bg-slate-50 [&_.mds-num]:text-xs [&_.mds-num]:text-slate-500 [&_.mds-num]:font-medium
                [&_.mds-details]:rounded-lg [&_.mds-details]:border [&_.mds-details]:border-slate-200 [&_.mds-details]:bg-slate-50 [&_.mds-details]:p-3
                [&_.mds-details_summary]:cursor-pointer [&_.mds-details_summary]:font-semibold [&_.mds-details_summary]:text-slate-700
                [&_.mds-pre]:mt-3 [&_.mds-pre]:max-h-[460px] [&_.mds-pre]:overflow-auto [&_.mds-pre]:rounded-md [&_.mds-pre]:bg-white [&_.mds-pre]:border [&_.mds-pre]:border-slate-200 [&_.mds-pre]:p-3 [&_.mds-pre]:text-xs [&_.mds-pre]:leading-5 [&_.mds-pre]:whitespace-pre
                [&_.mds-note]:mt-2 [&_.mds-note]:text-xs [&_.mds-note]:text-slate-500"
              dangerouslySetInnerHTML={{ __html: doc.plainHtml }}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-t border-slate-200 bg-white shrink-0">
        <span className="text-xs text-slate-500">
          {(parseText.length / 1000).toFixed(1)}K characters | {doc.type.toUpperCase()}
          {isTable && ` | ${doc.headers.length} columns`}
          {isTruncatedForView ? ' | preview mode' : ''}
        </span>
        <Button size="sm" variant="outline" onClick={onClose} className="font-semibold px-6">
          Close View
        </Button>
      </div>
    </div>
  )
}

