'use client'

import { useState, useEffect, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Loader2, AlertCircle, CheckCircle2, XCircle, Clock, ChevronDown } from 'lucide-react'
import { embeddingApi } from '@/lib/api/embedding'
import type { RebuildEmbeddingsRequest, RebuildStatusResponse } from '@/lib/api/embedding'
import { useTranslation } from '@/lib/hooks/use-translation'

// ── Simple FAQ accordion item ─────────────────────────────────────────────────
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between py-3 text-left text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors"
      >
        {question}
        <ChevronDown
          className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <p className="pb-3 text-sm text-slate-500 leading-relaxed">{answer}</p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function RebuildEmbeddings() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'existing' | 'all'>('existing')
  const [includeSources, setIncludeSources] = useState(true)
  const [includeNotes, setIncludeNotes] = useState(true)
  const [includeInsights, setIncludeInsights] = useState(true)
  const [commandId, setCommandId] = useState<string | null>(null)
  const [status, setStatus] = useState<RebuildStatusResponse | null>(null)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)

  // Rebuild mutation — logic preserved exactly
  const rebuildMutation = useMutation({
    mutationFn: async (request: RebuildEmbeddingsRequest) => {
      return embeddingApi.rebuildEmbeddings(request)
    },
    onSuccess: (data) => {
      setCommandId(data.command_id)
      startPolling(data.command_id)
    },
  })

  const startPolling = (cmdId: string) => {
    if (pollingInterval) clearInterval(pollingInterval)
    const interval = setInterval(async () => {
      try {
        const statusData = await embeddingApi.getRebuildStatus(cmdId)
        setStatus(statusData)
        if (statusData.status === 'completed' || statusData.status === 'failed') {
          stopPolling()
        }
      } catch (error) {
        console.error('Failed to fetch rebuild status:', error)
      }
    }, 5000)
    setPollingInterval(interval)
  }

  const stopPolling = useCallback(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval)
      setPollingInterval(null)
    }
  }, [pollingInterval])

  useEffect(() => {
    return () => { stopPolling() }
  }, [stopPolling])

  const handleStartRebuild = () => {
    rebuildMutation.mutate({
      mode,
      include_sources: includeSources,
      include_notes: includeNotes,
      include_insights: includeInsights,
    })
  }

  const handleReset = () => {
    stopPolling()
    setCommandId(null)
    setStatus(null)
    rebuildMutation.reset()
  }

  const isAnyTypeSelected = includeSources || includeNotes || includeInsights
  const isRebuildActive = commandId && status && (status.status === 'queued' || status.status === 'running')

  const progressData = status?.progress
  const stats = status?.stats

  const totalItems = progressData?.total_items ?? progressData?.total ?? 0
  const processedItems = progressData?.processed_items ?? progressData?.processed ?? 0
  const derivedProgressPercent = progressData?.percentage ?? (totalItems > 0 ? (processedItems / totalItems) * 100 : 0)
  const progressPercent = Number.isFinite(derivedProgressPercent) ? derivedProgressPercent : 0

  const sourcesProcessed = stats?.sources_processed ?? stats?.sources ?? 0
  const notesProcessed = stats?.notes_processed ?? stats?.notes ?? 0
  const insightsProcessed = stats?.insights_processed ?? stats?.insights ?? 0
  const failedItems = stats?.failed_items ?? stats?.failed ?? 0

  const computedDuration = status?.started_at && status?.completed_at
    ? (new Date(status.completed_at).getTime() - new Date(status.started_at).getTime()) / 1000
    : undefined
  const processingTimeSeconds = stats?.processing_time ?? computedDuration

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-50">
        <h2 className="text-lg font-bold text-slate-900">{t.advanced.rebuildEmbeddings}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{t.advanced.rebuildEmbeddingsDesc}</p>
      </div>

      <div className="px-6 py-5 space-y-6">
        {/* Configuration form */}
        {!isRebuildActive && (
          <div className="space-y-5">
            {/* Rebuild Mode */}
            <div className="space-y-2">
              <Label htmlFor="mode" className="text-sm font-semibold text-slate-700">
                {t.advanced.rebuild.mode}
              </Label>
              <Select value={mode} onValueChange={(value) => setMode(value as 'existing' | 'all')}>
                <SelectTrigger
                  id="mode"
                  className="w-40 h-9 text-sm rounded-lg border-slate-200 focus:ring-[#FF7043] focus:border-[#FF7043]"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="existing">{t.advanced.rebuild.existing}</SelectItem>
                  <SelectItem value="all">{t.advanced.rebuild.all}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">
                {mode === 'existing' ? t.advanced.rebuild.existingDesc : t.advanced.rebuild.allDesc}
              </p>
            </div>

            {/* Include in Rebuild */}
            <div className="space-y-2" role="group" aria-labelledby="include-label">
              <span id="include-label" className="text-sm font-semibold text-slate-700">
                {t.advanced.rebuild.include}
              </span>
              <div className="space-y-2 pt-1">
                {[
                  { id: 'sources', checked: includeSources, onChange: setIncludeSources, label: t.navigation.sources },
                  { id: 'notes',   checked: includeNotes,   onChange: setIncludeNotes,   label: t.common.notes },
                  { id: 'insights',checked: includeInsights,onChange: setIncludeInsights,label: t.common.insights },
                ].map(item => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Checkbox
                      id={item.id}
                      checked={item.checked}
                      onCheckedChange={(checked) => item.onChange(checked === true)}
                      className="accent-[#FF7043] data-[state=checked]:bg-[#FF7043] data-[state=checked]:border-[#FF7043]"
                    />
                    <Label htmlFor={item.id} className="font-normal cursor-pointer text-sm text-slate-700">
                      {item.label}
                    </Label>
                  </div>
                ))}
              </div>
              {!isAnyTypeSelected && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{t.advanced.rebuild.selectOneError}</AlertDescription>
                </Alert>
              )}
            </div>

            {/* Start Rebuild button — blue, full-width, matches reference */}
            <button
              type="button"
              onClick={handleStartRebuild}
              disabled={!isAnyTypeSelected || rebuildMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors shadow-sm"
            >
              {rebuildMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.advanced.rebuild.starting}
                </>
              ) : (
                <>
                  <span>⚡</span>
                  {t.advanced.rebuild.startBtn}
                </>
              )}
            </button>

            {rebuildMutation.isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t.advanced.rebuild.failed}: {(rebuildMutation.error as Error)?.message || t.common.error}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Status display — logic preserved exactly */}
        {status && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {status.status === 'queued'    && <Clock        className="h-5 w-5 text-yellow-500" />}
                {status.status === 'running'   && <Loader2      className="h-5 w-5 text-blue-500 animate-spin" />}
                {status.status === 'completed' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                {status.status === 'failed'    && <XCircle      className="h-5 w-5 text-red-500" />}
                <div className="flex flex-col">
                  <span className="font-medium text-sm">
                    {status.status === 'queued'    && t.advanced.rebuild.queued}
                    {status.status === 'running'   && t.advanced.rebuild.running}
                    {status.status === 'completed' && t.advanced.rebuild.completed}
                    {status.status === 'failed'    && t.advanced.rebuild.failed}
                  </span>
                  {status.status === 'running' && (
                    <span className="text-xs text-slate-400">{t.advanced.rebuild.leavePageHint}</span>
                  )}
                </div>
              </div>
              {(status.status === 'completed' || status.status === 'failed') && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium transition-colors"
                >
                  {t.advanced.rebuild.startNew}
                </button>
              )}
            </div>

            {progressData && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{t.common.progress}</span>
                  <span className="font-medium">
                    {t.advanced.rebuild.itemsProcessed
                      .replace('{processed}', processedItems.toString())
                      .replace('{total}', totalItems.toString())
                      .replace('{percent}', progressPercent.toFixed(1))}
                  </span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                {failedItems > 0 && (
                  <p className="text-xs text-yellow-600">
                    ⚠️ {t.advanced.rebuild.failedItems.replace('{count}', failedItems.toString())}
                  </p>
                )}
              </div>
            )}

            {stats && (
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: t.navigation.sources, value: sourcesProcessed },
                  { label: t.common.notes,        value: notesProcessed },
                  { label: t.common.insights,     value: insightsProcessed },
                  { label: t.advanced.rebuild.time, value: processingTimeSeconds !== undefined ? `${processingTimeSeconds.toFixed(1)}s` : '—' },
                ].map(item => (
                  <div key={item.label} className="space-y-1">
                    <p className="text-xs text-slate-400">{item.label}</p>
                    <p className="text-2xl font-bold text-slate-900">{item.value}</p>
                  </div>
                ))}
              </div>
            )}

            {status.error_message && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{status.error_message}</AlertDescription>
              </Alert>
            )}

            {status.started_at && (
              <div className="text-xs text-slate-400 space-y-0.5">
                <p>{t.common.created.replace('{time}', new Date(status.started_at).toLocaleString())}</p>
                {status.completed_at && (
                  <p>{t.notebooks.updated}: {new Date(status.completed_at).toLocaleString()}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* FAQ accordion — simple chevron rows matching reference */}
        <div className="border-t border-slate-100 pt-4 space-y-0">
          <FaqItem question={t.advanced.rebuild.whenToRebuild} answer={t.advanced.rebuild.whenToRebuildAns} />
          <FaqItem question={t.advanced.rebuild.howLong}       answer={t.advanced.rebuild.howLongAns} />
          <FaqItem question={t.advanced.rebuild.isSafe}        answer={t.advanced.rebuild.isSafeAns} />
        </div>
      </div>
    </div>
  )
}
