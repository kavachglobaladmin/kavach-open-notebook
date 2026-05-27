'use client'

import { FileText, Lightbulb, StickyNote } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ContextIndicatorProps {
  sourcesInsights: number
  sourcesFull: number
  notesCount: number
  tokenCount?: number
  charCount?: number
  className?: string
}

// Helper function to format large numbers with K/M suffixes
function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`
  }
  return num.toString()
}

export function ContextIndicator({
  sourcesInsights,
  sourcesFull,
  notesCount,
  tokenCount,
  charCount,
  className,
}: ContextIndicatorProps) {
  const totalSources = sourcesInsights + sourcesFull
  const hasContext = totalSources > 0 || notesCount > 0

  if (!hasContext) {
    return (
      <div className={cn('flex-shrink-0 text-xs text-muted-foreground py-2 px-3 border-t', className)}>
        No sources or notes included in context. Toggle icons on cards to include them.
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex-shrink-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 px-3 border-t bg-muted/30',
        className,
      )}
    >
      {/* Left: context badges */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Context:</span>

        {/* Total source count badge — always shown when there are sources */}
        {totalSources > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="text-xs flex items-center gap-1 px-1.5 py-0.5 text-primary border-primary/50 cursor-default"
              >
                <FileText className="h-3 w-3" />
                <span>{totalSources}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {totalSources} source{totalSources !== 1 ? 's' : ''} in context
                {sourcesInsights > 0 && ` (${sourcesInsights} via insights)`}
                {sourcesFull > 0 && ` (${sourcesFull} full text)`}
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Insight count badge — shown when any sources are in insights mode */}
        {sourcesInsights > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="text-xs flex items-center gap-1 px-1.5 py-0.5 text-amber-600 border-amber-600/50 cursor-default"
              >
                <Lightbulb className="h-3 w-3" />
                <span>{sourcesInsights}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>Insights for {sourcesInsights} source{sourcesInsights !== 1 ? 's' : ''}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Notes badge */}
        {notesCount > 0 && (
          <>
            {totalSources > 0 && <span className="text-muted-foreground">•</span>}
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-xs flex items-center gap-1 px-1.5 py-0.5 text-primary border-primary/50 cursor-default"
                >
                  <StickyNote className="h-3 w-3" />
                  <span>{notesCount}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{notesCount} full note{notesCount !== 1 ? 's' : ''}</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      {/* Right: token / char counts */}
      {(tokenCount !== undefined || charCount !== undefined) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
          {tokenCount !== undefined && tokenCount > 0 && (
            <span>{formatNumber(tokenCount)} tokens</span>
          )}
          {tokenCount !== undefined &&
            charCount !== undefined &&
            tokenCount > 0 &&
            charCount > 0 && <span>/</span>}
          {charCount !== undefined && charCount > 0 && (
            <span>{formatNumber(charCount)} chars</span>
          )}
        </div>
      )}
    </div>
  )
}
