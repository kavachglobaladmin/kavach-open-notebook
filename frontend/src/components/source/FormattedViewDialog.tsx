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

// ── Detect & parse ────────────────────────────────────────────────────────────
function parseDoc(text: string): ParsedDoc {
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

function toPlainHtml(text: string): string {
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
  // We use a data attribute on the container to allow parent to call navigate
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

  return (
    <div ref={(el) => {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
      if (typeof forwardedRef === 'function') forwardedRef(el)
      else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = el
    }} className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr>
            <th className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-left font-semibold border-b border-slate-200 dark:border-slate-700 text-slate-500 w-12 sticky top-0">#</th>
            {headers.map((h, i) => (
              <th key={i} className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-left font-semibold border-b border-slate-200 dark:border-slate-700 whitespace-nowrap sticky top-0">{h}</th>
            ))}
          </tr>
        </thead>
      </table>
      <div ref={scrollRef} style={{ height: Math.min(totalH, 540), overflowY: 'auto' }} onScroll={e => setScrollTop((e.target as HTMLDivElement).scrollTop)}>
        <div style={{ height: totalH, position: 'relative' }}>
          <table className="w-full text-xs border-collapse" style={{ position: 'absolute', top: offsetY, width: '100%' }}>
            <tbody>
              {visibleRows.map((row, i) => {
                const absIdx = startIdx + i
                const isCurrent = absIdx === currentRow && query.trim() !== ''
                return (
                  <tr key={absIdx}
                    className={isCurrent
                      ? 'bg-orange-50 dark:bg-orange-900/20 outline outline-2 outline-orange-400'
                      : absIdx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/30'
                    }>
                    <td className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-slate-400 w-12 text-right font-mono">{absIdx + 1}</td>
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={cell}
                        dangerouslySetInnerHTML={{ __html: hlCell(cell) }} />
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="text-xs text-slate-400 px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 flex items-center justify-between">
        <span>{query.trim() ? `${filteredRows.length} of ${rows.length} rows match` : `${rows.length} rows · ${headers.length} columns`}</span>
        {query.trim() && filteredRows.length > 0 && (
          <span className="text-slate-500">Row {currentRow + 1} of {filteredRows.length}</span>
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
  const matchEls = useRef<HTMLElement[]>([])

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
    const marks: HTMLElement[] = []

    for (const tn of textNodes) {
      const val = tn.nodeValue ?? ''
      if (!re.test(val)) { re.lastIndex = 0; continue }
      re.lastIndex = 0

      const frag = document.createDocumentFragment()
      let last = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(val)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(val.slice(last, m.index)))
        const mark = document.createElement('mark')
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
  const [query, setQuery]           = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const doc = useMemo(() => parseDoc(text), [text])

  const [plainMatchCount, setPlainMatchCount] = useState(0)
  const [plainCurrentMatch, setPlainCurrentMatch] = useState(0)
  const plainMatchElsRef = useRef<HTMLElement[]>([])
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
    const marks: HTMLElement[] = []

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
        const mark = document.createElement('mark')
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

  const scrollToMark = (mark: HTMLElement) => {
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
    <div className="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-slate-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-slate-900 dark:bg-slate-950 border-b border-slate-800 shrink-0">
        <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center">
          <span className="text-white text-xs font-black">DR</span>
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Document Reader</p>
          <h2 className="text-sm font-bold text-white">Formatted View</h2>
        </div>

        {/* Search */}
        <div className="ml-6 flex items-center gap-2 flex-1 max-w-md">
          <input
            ref={inputRef}
            type="text"
            placeholder={isTable ? 'Filter rows... (case-insensitive)' : 'Search... (case-insensitive)'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') navigate(1) }}
            className="flex-1 px-3 py-1.5 text-sm rounded-md bg-white/10 text-white placeholder:text-slate-400 outline-none border border-white/20 focus:border-blue-400"
          />
          {/* Match count — plain text */}
          {!isTable && plainMatchCount > 0 && (
            <span className="text-xs text-slate-300 whitespace-nowrap font-medium">
              {plainCurrentMatch} / {plainMatchCount}
            </span>
          )}
          {!isTable && query.trim() && plainMatchCount === 0 && (
            <span className="text-xs text-red-400 whitespace-nowrap">No results</span>
          )}
          {/* Navigate buttons — always shown */}
          {!isTable && (
            <>
              <button onClick={() => navigate(-1)} disabled={plainMatchCount === 0}
                className="h-7 w-7 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 disabled:opacity-30">
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => navigate(1)} disabled={plainMatchCount === 0}
                className="h-7 w-7 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 disabled:opacity-30">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        <button onClick={onClose}
          className="ml-auto h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto bg-slate-50 dark:bg-[#0a0c10]">
        {isTable ? (
          <div className="p-4">
            <VirtualTable ref={tableRef} headers={doc.headers} rows={doc.rows} query={query} />
          </div>
        ) : (
          <div className="max-w-[1100px] mx-auto bg-white dark:bg-slate-900 min-h-full px-8 py-8 shadow-sm border-x border-slate-200 dark:border-slate-800">
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
              dangerouslySetInnerHTML={{ __html: doc.plainHtml }}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shrink-0">
        <span className="text-xs text-slate-500">
          {(text.length / 1000).toFixed(1)}K characters · {doc.type.toUpperCase()}
          {isTable && ` · ${doc.headers.length} columns`}
        </span>
        <Button size="sm" variant="outline" onClick={onClose} className="font-semibold px-6">
          Close View
        </Button>
      </div>
    </div>
  )
}
