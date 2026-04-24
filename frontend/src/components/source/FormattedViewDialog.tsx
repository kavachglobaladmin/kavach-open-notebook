'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import { Sparkles, ChevronUp, ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface FormattedViewDialogProps {
  text: string
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

  // Count delimiters in sample
  const tabCount   = sample.filter(l => l.split('\t').length >= 3).length
  const commaCount = sample.filter(l => splitRow(l, ',').length >= 3).length

  const sep = tabCount >= 3 ? '\t' : commaCount >= 5 ? ',' : null

  if (sep) {
    const rows = lines.map(l => splitRow(l, sep))
    const maxCols = Math.max(...rows.map(r => r.length))
    // Normalize all rows to same column count
    const normalized = rows.map(r =>
      Array.from({ length: maxCols }, (_, i) => r[i] ?? '')
    )
    return {
      type: sep === '\t' ? 'tsv' : 'csv',
      headers: normalized[0],
      rows: normalized.slice(1),
      plainHtml: '',
    }
  }

  // Plain text
  return {
    type: 'plain',
    headers: [],
    rows: [],
    plainHtml: toPlainHtml(text),
  }
}

// ── CSV row splitter — handles single-quoted AND double-quoted values ─────────
function splitRow(line: string, sep: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === "'" && !inDouble) { inSingle = !inSingle; continue }
    if (ch === '"' && !inSingle) { inDouble = !inDouble; continue }
    if (ch === sep && !inSingle && !inDouble) {
      cells.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  cells.push(cur.trim())
  return cells
}

// ── Plain text → HTML ─────────────────────────────────────────────────────────
function toPlainHtml(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const parts: string[] = []
  let inUl = false
  const closeUl = () => { if (inUl) { parts.push('</ul>'); inUl = false } }

  for (const raw of lines) {
    const line = raw.trim()
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
    if (kv && !line.includes(',')) {
      closeUl(); parts.push(`<p><strong>${esc(kv[1])}:</strong> ${esc(kv[2])}</p>`); continue
    }

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

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Virtual table — renders only visible rows ─────────────────────────────────
const ROW_H = 32   // px per row
const VISIBLE = 30 // rows to render at once

function VirtualTable({
  headers,
  rows,
  query,
}: {
  headers: string[]
  rows: string[][]
  query: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows
    const q = query.toLowerCase()
    return rows.filter(row => row.some(cell => cell.toLowerCase().includes(q)))
  }, [rows, query])

  const totalH = filteredRows.length * ROW_H
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_H) - 5)
  const endIdx   = Math.min(filteredRows.length, startIdx + VISIBLE + 10)
  const visibleRows = filteredRows.slice(startIdx, endIdx)
  const offsetY = startIdx * ROW_H

  const highlight = (cell: string) => {
    if (!query.trim()) return cell
    const q = query.trim()
    const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    return cell.replace(re, '<mark>$1</mark>')
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-left font-semibold border border-slate-200 dark:border-slate-700 text-slate-500 w-12">#</th>
            {headers.map((h, i) => (
              <th key={i} className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-left font-semibold border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
      </table>
      <div
        ref={containerRef}
        style={{ height: Math.min(totalH, 600), overflowY: 'auto' }}
        onScroll={e => setScrollTop((e.target as HTMLDivElement).scrollTop)}
      >
        <div style={{ height: totalH, position: 'relative' }}>
          <table
            className="w-full text-xs border-collapse"
            style={{ position: 'absolute', top: offsetY, width: '100%' }}
          >
            <tbody>
              {visibleRows.map((row, i) => {
                const absIdx = startIdx + i
                return (
                  <tr key={absIdx} className={absIdx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800/30'}>
                    <td className="px-3 py-1.5 border border-slate-100 dark:border-slate-800 text-slate-400 w-12 text-right">{absIdx + 1}</td>
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className="px-3 py-1.5 border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 max-w-[200px] truncate"
                        title={cell}
                        dangerouslySetInnerHTML={{ __html: highlight(esc(cell)) }}
                      />
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="text-xs text-slate-400 px-2 py-1.5 border-t">
        {query.trim()
          ? `${filteredRows.length} matching rows of ${rows.length} total`
          : `${rows.length} rows`}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function FormattedViewDialog({ text, open, onClose }: FormattedViewDialogProps) {
  const [query, setQuery]               = useState('')
  const [matchCount, setMatchCount]     = useState(0)
  const [currentMatch, setCurrentMatch] = useState(0)
  const matchRefs = useRef<HTMLElement[]>([])
  const inputRef  = useRef<HTMLInputElement>(null)

  const doc = useMemo(() => parseDoc(text), [text])

  // Tiptap only for plain text
  const editor = useEditor({
    extensions: [StarterKit, Highlight.configure({ multicolor: false })],
    content: doc.type === 'plain' ? doc.plainHtml : '',
    editable: false,
    immediatelyRender: false,
  })

  useEffect(() => {
    if (editor && doc.type === 'plain') editor.commands.setContent(doc.plainHtml)
  }, [editor, doc])

  // Plain text search via Tiptap marks
  const doSearch = useCallback(() => {
    if (!editor || doc.type !== 'plain') return
    editor.commands.unsetHighlight()
    matchRefs.current = []
    setMatchCount(0)
    setCurrentMatch(0)

    const q = query.trim()
    if (!q) return

    const { doc: edDoc } = editor.state
    const matches: { from: number; to: number }[] = []
    const lower = q.toLowerCase()

    edDoc.descendants((node, pos) => {
      if (!node.isText || !node.text) return
      const t = node.text.toLowerCase()
      let idx = 0
      while ((idx = t.indexOf(lower, idx)) !== -1) {
        matches.push({ from: pos + idx, to: pos + idx + q.length })
        idx += q.length
      }
    })

    if (!matches.length) return

    const tr = editor.state.tr
    matches.forEach(({ from, to }) => {
      tr.addMark(from, to, editor.schema.marks.highlight.create())
    })
    editor.view.dispatch(tr)
    setMatchCount(matches.length)
    setCurrentMatch(1)

    setTimeout(() => {
      const marks = document.querySelectorAll<HTMLElement>('.tiptap mark')
      matchRefs.current = Array.from(marks)
      if (marks[0]) {
        marks[0].style.background = '#f97316'
        marks[0].style.color = '#fff'
        marks[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 50)
  }, [editor, query, doc.type])

  useEffect(() => { doSearch() }, [doSearch])

  const navigate = (dir: 1 | -1) => {
    const marks = matchRefs.current
    if (!marks.length) return
    const next = ((currentMatch - 1 + dir + marks.length) % marks.length)
    setCurrentMatch(next + 1)
    marks.forEach((m, i) => {
      m.style.background = i === next ? '#f97316' : '#fef08a'
      m.style.color = i === next ? '#fff' : 'inherit'
    })
    marks[next]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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
          <Sparkles className="h-5 w-5 text-white" />
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
            onKeyDown={e => { if (e.key === 'Enter' && !isTable) navigate(1) }}
            className="flex-1 px-3 py-1.5 text-sm rounded-md bg-white/10 text-white placeholder:text-slate-400 outline-none border border-white/20 focus:border-blue-400"
          />
          {!isTable && matchCount > 0 && (
            <span className="text-xs text-slate-300 whitespace-nowrap font-medium">
              {currentMatch} / {matchCount}
            </span>
          )}
          {!isTable && query.trim() && matchCount === 0 && (
            <span className="text-xs text-red-400 whitespace-nowrap">No results</span>
          )}
          {!isTable && (
            <>
              <button onClick={() => navigate(-1)} disabled={matchCount === 0}
                className="h-7 w-7 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 disabled:opacity-30">
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => navigate(1)} disabled={matchCount === 0}
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
      <div className="flex-1 overflow-auto bg-slate-50 dark:bg-[#0a0c10]">
        {isTable ? (
          <div className="p-4">
            <VirtualTable headers={doc.headers} rows={doc.rows} query={query} />
          </div>
        ) : (
          <div className="max-w-[1100px] mx-auto bg-white dark:bg-slate-900 min-h-full px-8 py-8 shadow-sm border-x border-slate-200 dark:border-slate-800">
            <EditorContent
              editor={editor}
              className="tiptap prose prose-sm prose-slate dark:prose-invert max-w-none
                [&_h1]:text-base [&_h1]:font-black [&_h1]:mt-6 [&_h1]:mb-2
                [&_h2]:text-[11px] [&_h2]:font-black [&_h2]:tracking-widest [&_h2]:uppercase [&_h2]:text-slate-400 [&_h2]:mt-7 [&_h2]:mb-2 [&_h2]:border-b [&_h2]:pb-1
                [&_h3]:text-sm [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-1
                [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-1.5
                [&_ul]:space-y-1 [&_li]:text-sm
                [&_strong]:font-semibold
                [&_mark]:bg-yellow-200 [&_mark]:rounded-sm [&_mark]:px-0.5"
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
