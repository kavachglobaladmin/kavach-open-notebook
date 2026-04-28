'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, RefreshCw } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useInsight } from '@/lib/hooks/use-insights'
import { useModalManager } from '@/lib/hooks/use-modal-manager'
import { useTranslation } from '@/lib/hooks/use-translation'
import { MindMapInsightViewer, isMindMapInsight } from '@/components/source/MindMapInsightViewer'
import { BankAnalysisInsightViewer, isBankAnalysisInsight } from '@/components/source/BankAnalysisInsightViewer'
import { InfographicInsightViewer, isInfographicInsight } from '@/components/source/InfographicInsightViewer'
import { TimelineAnalysisInsightViewer, isTimelineAnalysisInsight } from '@/components/source/TimelineAnalysisInsightViewer'
import { InvestigativeProfileInsightViewer, isInvestigativeProfileInsight } from '@/components/source/InvestigativeProfileInsightViewer'
import { DenseSummaryViewer, isDenseSummaryInsight } from '@/components/source/DenseSummaryViewer'
import { toast } from 'sonner'

interface SourceInsightDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  insight?: {
    id: string
    insight_type?: string
    content?: string
    created?: string
    source_id?: string
  }
  onDelete?: (insightId: string) => Promise<void>
}

export function SourceInsightDialog({ open, onOpenChange, insight, onDelete }: SourceInsightDialogProps) {
  const { t } = useTranslation()
  const { openModal } = useModalManager()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [regeneratedContent, setRegeneratedContent] = useState<string | null>(null)

  // Ensure insight ID has 'source_insight:' prefix for API calls
  const insightIdWithPrefix = insight?.id
    ? (insight.id.includes(':') ? insight.id : `source_insight:${insight.id}`)
    : ''

  const { data: fetchedInsight, isLoading } = useInsight(insightIdWithPrefix, { enabled: open && !!insight?.id })

  // Use fetched data if available, otherwise fall back to passed-in insight
  const displayInsight = fetchedInsight ?? insight
  // Override content if regenerated
  const displayContent = regeneratedContent ?? displayInsight?.content ?? ''

  // Get source_id from fetched data (preferred) or passed-in insight
  const sourceId = fetchedInsight?.source_id ?? insight?.source_id

  // Detect mind-map insight
  const isMindMap = !!(displayInsight?.insight_type && isMindMapInsight(displayInsight.insight_type))
  // Detect bank analysis insight
  const isBankAnalysis = !!(displayInsight?.insight_type && isBankAnalysisInsight(displayInsight.insight_type))
  // Detect infographic insight
  const isInfographic = !!(displayInsight?.insight_type && isInfographicInsight(displayInsight.insight_type))
  // Detect timeline analysis insight
  const isTimeline = !!(displayInsight?.insight_type && isTimelineAnalysisInsight(displayInsight.insight_type))
  // Detect investigative profile insight
  const isInvestigativeProfile = !!(displayInsight?.insight_type && isInvestigativeProfileInsight(displayInsight.insight_type))
  // Detect dense summary insight
  const isDenseSummary = !!(displayInsight?.insight_type && isDenseSummaryInsight(displayInsight.insight_type))

  const handleViewSource = () => {
    if (sourceId) {
      openModal('source', sourceId)
    }
  }

  const handleDelete = async () => {
    if (!insight?.id || !onDelete) return
    setIsDeleting(true)
    try {
      await onDelete(insight.id)
      onOpenChange(false)
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleRegenerate = async () => {
    if (!sourceId) return
    setIsRegenerating(true)
    setRegeneratedContent(null)
    try {
      // Delete old mindmap insights then regenerate via the mindmap API
      await fetch(`/api/sources/${encodeURIComponent(sourceId)}/insights/mindmap`, { method: 'DELETE' })
      const res = await fetch(`/api/sources/${encodeURIComponent(sourceId)}/mindmap`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      if (!res.ok) throw new Error(`Regeneration failed: ${res.status}`)
      const data = await res.json()
      setRegeneratedContent(JSON.stringify(data.mind_map))
      toast.success('Mind map regenerated successfully')
    } catch (e) {
      toast.error('Regeneration failed: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setIsRegenerating(false)
    }
  }

  // Reset delete confirmation when dialog closes
  useEffect(() => {
    if (!open) {
      setShowDeleteConfirm(false)
      setRegeneratedContent(null)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Wider dialog for mind-map insights so the graph has room */}
      <DialogContent className={`flex flex-col max-h-[98vh] ${isMindMap ? 'sm:max-w-[98vw] w-[98vw] h-[95vh]' : isBankAnalysis ? 'sm:max-w-5xl w-[90vw]' : isInfographic ? 'sm:max-w-[95vw] w-[95vw] h-[95vh]' : isTimeline ? 'sm:max-w-5xl w-[90vw]' : isInvestigativeProfile ? 'sm:max-w-4xl w-[90vw]' : 'sm:max-w-3xl'}`}>

        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>{t.sources.sourceInsight}</span>
            <div className="flex items-center gap-2">
              {displayInsight?.insight_type && (
                <Badge variant="outline" className="text-xs uppercase">
                  {displayInsight.insight_type}
                </Badge>
              )}
              {sourceId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewSource}
                  className="gap-1"
                >
                  <FileText className="h-3 w-3" />
                  {t.sources.viewSource}
                </Button>
              )}
              {isMindMap && sourceId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                  {isRegenerating ? 'Regenerating...' : 'Regenerate'}
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {showDeleteConfirm ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <p className="text-center text-muted-foreground">
              {t.sources.deleteInsightConfirm.split(/[?？]/)[0]}?<br />
              <span className="text-sm">{t.sources.deleteInsightConfirm.split(/[?？]/)[1]?.trim() || t.common.deleteForever}</span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                {t.common.cancel}
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? t.common.deleting : t.common.delete}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-10">
                <span className="text-sm text-muted-foreground">{t.common.loading}</span>
              </div>
            ) : displayInsight ? (
              isMindMap && sourceId ? (
                /* ── Mind-map insight: interactive graph viewer ── */
                <MindMapInsightViewer
                  content={displayContent}
                  sourceId={sourceId}
                  title={displayInsight?.insight_type}
                />
              ) : isBankAnalysis ? (
                /* ── Bank Analysis Profile: structured dashboard ── */
                <BankAnalysisInsightViewer content={displayContent} />
              ) : isInfographic ? (
                /* ── Infographic: structured card layout ── */
                <InfographicInsightViewer content={displayContent} />
              ) : isTimeline ? (
                /* ── Timeline Analysis: communication log dashboard ── */
                <TimelineAnalysisInsightViewer content={displayContent} />
              ) : isInvestigativeProfile ? (
                /* ── Investigative Profile: structured intelligence dashboard ── */
                <InvestigativeProfileInsightViewer content={displayContent} />
              ) : isDenseSummary ? (
                /* ── Dense Summary: clean readable paragraph layout ── */
                <DenseSummaryViewer content={displayContent} createdAt={displayInsight.created} />
              ) : (
                /* ── Regular insight: markdown renderer ── */
                <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ children }) => (
                        <div className="my-4 overflow-x-auto">
                          <table className="min-w-full border-collapse border border-border">{children}</table>
                        </div>
                      ),
                      thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
                      tbody: ({ children }) => <tbody>{children}</tbody>,
                      tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
                      th: ({ children }) => <th className="border border-border px-3 py-2 text-left font-semibold">{children}</th>,
                      td: ({ children }) => <td className="border border-border px-3 py-2">{children}</td>,
                    }}
                  >
                    {displayContent}
                  </ReactMarkdown>
                </div>
              )
            ) : (
              <p className="text-sm text-muted-foreground">{t.sources.noInsightSelected}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
