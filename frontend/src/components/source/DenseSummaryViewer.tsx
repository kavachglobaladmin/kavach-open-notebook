'use client'

import { useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'

interface DenseSummaryViewerProps {
  content: string
  createdAt?: string
}

export function isDenseSummaryInsight(insightType: string): boolean {
  const t = insightType.toLowerCase()
  return t.includes('dense') || t.includes('dense summary') || t.includes('dense_summary')
}

function stripPreamble(text: string): string {
  return text
    .replace(/^here is the (combined output|dense summary)[^.]*\.\s*/i, '')
    .replace(/^based on the provided content[^.]*\.\s*/i, '')
    .replace(/^i['']ve extracted[^.]*\.\s*/i, '')
    .replace(/^note:.*$/im, '')
    .trim()
}

function deduplicateParagraphs(text: string): string {
  const paras = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  const seen = new Set<string>()
  return paras
    .filter(p => {
      const key = p.slice(0, 80).toLowerCase().replace(/\s+/g, ' ')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .join('\n\n')
}

export function DenseSummaryViewer({ content, createdAt }: DenseSummaryViewerProps) {
  const paragraphs = useMemo(() => {
    const cleaned = deduplicateParagraphs(stripPreamble(content))
    return cleaned.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
  }, [content])

  return (
    <div className="space-y-1 pb-2">
      {/* Timestamp */}
      {createdAt && (() => {
        const d = new Date(createdAt)
        return !isNaN(d.getTime()) ? (
          <p className="text-xs text-muted-foreground mb-3">
            {formatDistanceToNow(d, { addSuffix: true })}
          </p>
        ) : null
      })()}

      {/* Paragraphs */}
      <div className="space-y-4">
        {paragraphs.map((para, i) => (
          <p
            key={i}
            className="text-sm leading-[1.8] text-foreground"
            style={{ textAlign: 'justify' }}
          >
            {para}
          </p>
        ))}
      </div>

      {/* Word count */}
      <p className="text-xs text-muted-foreground pt-3 border-t mt-4">
        {content.split(/\s+/).filter(Boolean).length} words
      </p>
    </div>
  )
}
