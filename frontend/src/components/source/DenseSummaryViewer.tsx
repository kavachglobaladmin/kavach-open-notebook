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

// Strip common LLM preamble phrases
function stripPreamble(text: string): string {
  return text
    .replace(/^here is the combined output in a dense representation[:\s]*/i, '')
    .replace(/^here is a dense summary[:\s]*/i, '')
    .replace(/^dense summary[:\s]*/i, '')
    .replace(/^summary[:\s]*/i, '')
    .trim()
}

// Split into paragraphs — keep bullet lists as-is but group them
function parseParagraphs(text: string): string[] {
  const cleaned = stripPreamble(text)

  // Split on double newlines first
  const blocks = cleaned.split(/\n{2,}/).map(b => b.trim()).filter(Boolean)
  if (blocks.length > 1) return blocks

  // If single block with bullet points, split on bullets
  const bullets = cleaned.split(/(?:^|\n)\s*[•\-\*]\s+/m).map(s => s.trim()).filter(Boolean)
  if (bullets.length > 1) return bullets

  // Single paragraph — return as-is
  return [cleaned]
}

export function DenseSummaryViewer({ content, createdAt }: DenseSummaryViewerProps) {
  const paragraphs = useMemo(() => parseParagraphs(content), [content])

  return (
    <div className="space-y-4 pb-2">
      {/* Timestamp */}
      {createdAt && (() => {
        const d = new Date(createdAt)
        return !isNaN(d.getTime()) ? (
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(d, { addSuffix: true })}
          </p>
        ) : null
      })()}

      {/* Content — clean readable paragraphs */}
      <div className="space-y-3">
        {paragraphs.map((para, i) => (
          <p key={i} className="text-sm leading-relaxed text-foreground">
            {para}
          </p>
        ))}
      </div>
    </div>
  )
}
