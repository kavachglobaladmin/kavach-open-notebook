'use client'

import { useEffect, useState } from 'react'
import {
  RefreshCw,
  FileText,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  LayoutList,
  AlignLeft,
} from 'lucide-react'
import { sourcesApi } from '@/lib/api/sources'

interface PartIVViewProps {
  sourceId: string
}

interface PartIVData {
  sections: Record<string, string>
  raw: string
  source_id: string
  found: boolean
}

// ── Section accent colours ─────────────────────────────────────────────────────
const SECTION_COLORS = [
  { border: 'border-blue-400',    bg: 'bg-blue-50',    badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-400'    },
  { border: 'border-emerald-400', bg: 'bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400' },
  { border: 'border-violet-400',  bg: 'bg-violet-50',  badge: 'bg-violet-100 text-violet-700',  dot: 'bg-violet-400'  },
  { border: 'border-amber-400',   bg: 'bg-amber-50',   badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400'   },
  { border: 'border-rose-400',    bg: 'bg-rose-50',    badge: 'bg-rose-100 text-rose-700',     dot: 'bg-rose-400'    },
  { border: 'border-cyan-400',    bg: 'bg-cyan-50',    badge: 'bg-cyan-100 text-cyan-700',     dot: 'bg-cyan-400'    },
]
function getColor(idx: number) { return SECTION_COLORS[idx % SECTION_COLORS.length] }

// ── Prose renderer — renders narrative text as clean full-width paragraphs ─────
function ProseContent({ text }: { text: string }) {
  if (!text.trim()) {
    return <p className="text-sm text-slate-400 italic">No content available for this section.</p>
  }

  // Split into paragraph blocks on blank lines
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <div className="w-full space-y-3">
      {paragraphs.map((para, i) => (
        <p key={i} className="text-sm text-slate-700 leading-relaxed w-full">
          {para}
        </p>
      ))}
    </div>
  )
}

// ── Collapsible section card ───────────────────────────────────────────────────
function SectionCard({
  title,
  content,
  colorIdx,
  defaultOpen = true,
}: {
  title: string
  content: string
  colorIdx: number
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const c = getColor(colorIdx)
  const wordCount = content.split(/\s+/).filter(Boolean).length

  return (
    <div className={`w-full rounded-xl border-l-4 ${c.border} bg-white shadow-sm overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className={`inline-block h-2.5 w-2.5 rounded-full flex-shrink-0 ${c.dot}`} />
          <span className="font-semibold text-slate-800 text-sm leading-snug">{title}</span>
          {wordCount > 0 && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${c.badge}`}>
              {wordCount} words
            </span>
          )}
        </div>
        {open
          ? <ChevronUp   className="h-4 w-4 text-slate-400 flex-shrink-0 ml-3" />
          : <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0 ml-3" />
        }
      </button>

      {/* Body */}
      {open && (
        <div className={`w-full px-5 pb-5 pt-4 border-t border-slate-100 ${c.bg}`}>
          <ProseContent text={content} />
        </div>
      )}
    </div>
  )
}

// ── Full raw text view ─────────────────────────────────────────────────────────
function RawView({ raw }: { raw: string }) {
  if (!raw.trim()) {
    return (
      <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center text-slate-400 text-sm">
        No content available.
      </div>
    )
  }
  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
        <AlignLeft className="h-4 w-4 text-slate-400" />
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          PART IV — Full Narrative
        </span>
      </div>
      <div className="w-full p-5">
        <ProseContent text={raw} />
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export function PartIVView({ sourceId }: PartIVViewProps) {
  const [data, setData]         = useState<PartIVData | null>(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'structured' | 'raw'>('structured')

  useEffect(() => {
    if (!sourceId) return
    setLoading(true)
    setError(null)

    sourcesApi.getPartIV(sourceId)
      .then((d) => {
        setData(d)
        if (!d.sections || Object.keys(d.sections).length === 0) {
          setViewMode('raw')
        }
        setLoading(false)
      })
      .catch((e) => {
        setError(e?.response?.data?.detail || e?.message || 'Failed to load Part IV')
        setLoading(false)
      })
  }, [sourceId])

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-3 bg-white min-h-[600px] rounded-xl border border-slate-200">
        <RefreshCw className="h-5 w-5 animate-spin text-blue-500" />
        <span className="text-slate-500 font-medium">Loading Part IV…</span>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-white min-h-[600px] rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 text-sm text-red-600 rounded-lg border border-red-100">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      </div>
    )
  }

  // ── Not found ────────────────────────────────────────────────────────────
  if (!data || !data.found) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-white min-h-[600px] rounded-xl border border-slate-200">
        <FileText className="h-10 w-10 text-slate-300" />
        <p className="text-slate-500 font-medium">No PART IV section found in this document.</p>
        <p className="text-slate-400 text-sm">The document may not contain a PART IV block.</p>
      </div>
    )
  }

  const sectionKeys = Object.keys(data.sections)
  const hasSections = sectionKeys.length > 0

  return (
    <div className="w-full h-full overflow-y-auto bg-slate-50">

      {/* ── Sticky header ───────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-5 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />
          <span className="font-semibold text-slate-800 text-sm whitespace-nowrap">
            PART IV — Background &amp; History
          </span>
          {hasSections && (
            <span className="text-xs bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-2 py-0.5 font-medium whitespace-nowrap">
              {sectionKeys.length} section{sectionKeys.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* View toggle */}
        {hasSections && data.raw && (
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 flex-shrink-0 ml-4">
            <button
              onClick={() => setViewMode('structured')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                viewMode === 'structured'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <LayoutList className="h-3.5 w-3.5" />
              Sections
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                viewMode === 'raw'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <AlignLeft className="h-3.5 w-3.5" />
              Full Text
            </button>
          </div>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="w-full p-5 space-y-3">
        {viewMode === 'structured' && hasSections ? (
          <>
            {sectionKeys.map((key, idx) => (
              <SectionCard
                key={key}
                title={key}
                content={data.sections[key] || ''}
                colorIdx={idx}
                defaultOpen={true}
              />
            ))}

            {/* Collapsible full raw text at the bottom */}
            {data.raw && (
              <details className="group w-full">
                <summary className="cursor-pointer list-none flex items-center gap-2 text-xs text-slate-400 hover:text-slate-600 transition-colors py-2 select-none">
                  <ChevronDown className="h-3.5 w-3.5 group-open:hidden" />
                  <ChevronUp   className="h-3.5 w-3.5 hidden group-open:block" />
                  Show full raw text
                </summary>
                <div className="mt-1 w-full">
                  <RawView raw={data.raw} />
                </div>
              </details>
            )}
          </>
        ) : (
          <RawView raw={data.raw} />
        )}
      </div>
    </div>
  )
}

export default PartIVView
