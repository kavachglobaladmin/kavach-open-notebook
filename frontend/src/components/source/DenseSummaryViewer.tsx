'use client'

import { useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
    .replace(/^based on the provided content[^.]*\.\s*/i, '')
    .replace(/^i['']ve extracted[^.]*\.\s*/i, '')
    .trim()
}

export function DenseSummaryViewer({ content, createdAt }: DenseSummaryViewerProps) {
  const cleaned = useMemo(() => stripPreamble(content), [content])

  return (
    <div className="space-y-3 pb-2">
      {/* Timestamp */}
      {createdAt && (() => {
        const d = new Date(createdAt)
        return !isNaN(d.getTime()) ? (
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(d, { addSuffix: true })}
          </p>
        ) : null
      })()}

      {/* Markdown-rendered content */}
      <div className="prose prose-sm prose-slate dark:prose-invert max-w-none
        [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
        [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-1.5 [&_h2]:text-foreground
        [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
        [&_p]:text-sm [&_p]:leading-relaxed [&_p]:mb-2
        [&_ul]:space-y-1 [&_ul]:my-2 [&_li]:text-sm [&_li]:leading-relaxed
        [&_ol]:space-y-1 [&_ol]:my-2
        [&_strong]:font-semibold [&_strong]:text-foreground
        [&_em]:italic">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {cleaned}
        </ReactMarkdown>
      </div>
    </div>
  )
}
