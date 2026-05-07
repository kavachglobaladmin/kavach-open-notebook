'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { SourceListResponse } from '@/lib/types/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, FileText, Link2, ChevronDown, Loader2 } from 'lucide-react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { EmptyState } from '@/components/common/EmptyState'
import { AddSourceDialog } from '@/components/sources/AddSourceDialog'
import { AddExistingSourceDialog } from '@/components/sources/AddExistingSourceDialog'
import { SourceCard } from '@/components/sources/SourceCard'
import { useDeleteSource, useRetrySource, useRemoveSourceFromNotebook } from '@/lib/hooks/use-sources'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { useModalManager } from '@/lib/hooks/use-modal-manager'
import { ContextMode } from '../[id]/page'
import { CollapsibleColumn, createCollapseButton } from '@/components/notebooks/CollapsibleColumn'
import { useNotebookColumnsStore } from '@/lib/stores/notebook-columns-store'
import { useTranslation } from '@/lib/hooks/use-translation'
import { CommonGraphModal } from '@/components/sources/CommonGraphModal'
import { cn } from '@/lib/utils'

interface SourcesColumnProps {
  sources?: SourceListResponse[]
  isLoading: boolean
  notebookId: string
  notebookName?: string
  onRefresh?: () => void
  contextSelections?: Record<string, ContextMode>
  onContextModeChange?: (sourceId: string, mode: ContextMode) => void
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  fetchNextPage?: () => void
}

export function SourcesColumn({
  sources,
  isLoading,
  notebookId,
  onRefresh,
  contextSelections,
  onContextModeChange,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: SourcesColumnProps) {
  const { t } = useTranslation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addExistingDialogOpen, setAddExistingDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [sourceToDelete, setSourceToDelete] = useState<string | null>(null)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [sourceToRemove, setSourceToRemove] = useState<string | null>(null)
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([])
  const [commonGraphOpen, setCommonGraphOpen] = useState(false)

  const { openModal } = useModalManager()
  const deleteSource = useDeleteSource()
  const retrySource = useRetrySource()
  const removeFromNotebook = useRemoveSourceFromNotebook()

  const { sourcesCollapsed, toggleSources } = useNotebookColumnsStore()
  const collapseButton = useMemo(
    () => createCollapseButton(toggleSources, t.navigation.sources),
    [toggleSources, t.navigation.sources]
  )

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container || !hasNextPage || isFetchingNextPage || !fetchNextPage) return
    const { scrollTop, scrollHeight, clientHeight } = container
    if (scrollHeight - scrollTop - clientHeight < 200) {
      fetchNextPage()
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])
  
  const handleDeleteConfirm = async () => {
    if (!sourceToDelete) return
    try {
      await deleteSource.mutateAsync(sourceToDelete)
      setDeleteDialogOpen(false)
      setSourceToDelete(null)
      onRefresh?.()
    } catch (error) { console.error(error) }
  }

  const handleRemoveConfirm = async () => {
    if (!sourceToRemove) return
    try {
      await removeFromNotebook.mutateAsync({ notebookId, sourceId: sourceToRemove })
      setRemoveDialogOpen(false)
      setSourceToRemove(null)
    } catch (error) { console.error(error) }
  }

  const handleToggleSourceSelection = (sourceId: string, checked: boolean) => {
    setSelectedSourceIds((prev) => checked 
      ? (prev.includes(sourceId) ? prev : [...prev, sourceId]) 
      : prev.filter((id) => id !== sourceId))
  }

  return (
    <>
      <CollapsibleColumn
        isCollapsed={sourcesCollapsed}
        onToggle={toggleSources}
        collapsedIcon={FileText}
        collapsedLabel={t.navigation.sources}
      >
        <Card className="h-full flex flex-col flex-1 overflow-hidden bg-white border-none rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <CardHeader className="pb-3 pt-6 px-6 flex-shrink-0">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-[20px] font-bold text-slate-900">{t.navigation.sources}</CardTitle>
                <div className="flex items-center gap-2">
                  <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" className="bg-[#6149f6] hover:bg-[#523cdb] text-white rounded-[12px] h-[40px] px-5 font-semibold shadow-[0_4px_12px_rgba(97,73,246,0.35)] transition-all">
                        <Plus className="h-4 w-4 mr-1" />
                        {t.sources.addSource}
                        <ChevronDown className="h-4 w-4 ml-1 opacity-70" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl p-1">
                      <DropdownMenuItem onClick={() => { setDropdownOpen(false); setAddDialogOpen(true); }}>
                        <Plus className="h-4 w-4 mr-2" /> {t.sources.addSource}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setDropdownOpen(false); setAddExistingDialogOpen(true); }}>
                        <Link2 className="h-4 w-4 mr-2" /> {t.sources.addExistingTitle}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {collapseButton}
                </div>
              </div>
              <p className="text-[13px] text-slate-500 font-medium leading-relaxed">
                {selectedSourceIds.length > 0
                  ? `${selectedSourceIds.length} sources selected`
                  : 'Select at least two sources to create a common graph.'}
              </p>
            </div>
          </CardHeader>

          <CardContent ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 pb-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><LoadingSpinner /></div>
            ) : !sources || sources.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center pt-10">
                <div className="w-16 h-16 bg-[#f1f3f6] rounded-2xl flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-[#94a3b8]" />
                </div>
                <h3 className="text-[16px] font-bold text-slate-900 mb-1">{t.sources.noSourcesYet}</h3>
                <p className="text-[13px] text-slate-500 text-center max-w-[200px] leading-relaxed">
                  {t.sources.createFirstSource}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sources.map((source) => (
                  <SourceCard
                    key={source.id}
                    source={source}
                    onClick={() => openModal('source', source.id)}
                    onDelete={(id) => { setSourceToDelete(id); setDeleteDialogOpen(true); }}
                    onRetry={(id) => retrySource.mutateAsync({ sourceId: id, notebookId })}
                    onRemoveFromNotebook={(id) => { setSourceToRemove(id); setRemoveDialogOpen(true); }}
                    onRefresh={onRefresh}
                    showRemoveFromNotebook={true}
                    contextMode={contextSelections?.[source.id]}
                    onContextModeChange={onContextModeChange ? (mode) => onContextModeChange(source.id, mode) : undefined}
                    selectable={true}
                    selected={selectedSourceIds.includes(source.id)}
                    onSelectChange={(checked) => handleToggleSourceSelection(source.id, checked)}
                  />
                ))}
                {isFetchingNextPage && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </CollapsibleColumn>

      <AddSourceDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} defaultNotebookId={notebookId} onSuccess={onRefresh} />
      <AddExistingSourceDialog open={addExistingDialogOpen} onOpenChange={setAddExistingDialogOpen} notebookId={notebookId} onSuccess={onRefresh} />
      <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} title={t.sources.delete} description={t.sources.deleteConfirm} confirmText={t.common.delete} onConfirm={handleDeleteConfirm} isLoading={deleteSource.isPending} confirmVariant="destructive" />
      <ConfirmDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen} title={t.sources.removeFromNotebook} description={t.sources.removeConfirm} confirmText={t.common.remove} onConfirm={handleRemoveConfirm} isLoading={removeFromNotebook.isPending} confirmVariant="default" />
      <CommonGraphModal open={commonGraphOpen} onOpenChange={setCommonGraphOpen} sourceIds={selectedSourceIds} />
    </>
  )
}