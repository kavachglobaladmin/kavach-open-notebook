'use client'

import { useState } from 'react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronRight, Trash2 } from 'lucide-react'
import { Transformation } from '@/lib/types/transformations'
import { useDeleteTransformation, useUpdateTransformation } from '@/lib/hooks/use-transformations'
import { useTranslation } from '@/lib/hooks/use-translation'
import { ModelSelector } from '@/components/common/ModelSelector'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface TransformationCardProps {
  transformation: Transformation
  onPlayground?: () => void
  onEdit?: () => void
}

export function TransformationCard({ transformation, onPlayground, onEdit }: TransformationCardProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showModelDialog, setShowModelDialog] = useState(false)
  const [selectedModelId, setSelectedModelId] = useState(transformation.model_id || '')
  const deleteTransformation = useDeleteTransformation()
  const updateTransformation = useUpdateTransformation()

  const handleDelete = () => {
    deleteTransformation.mutate(transformation.id)
    setShowDeleteDialog(false)
  }

  const handleSaveModel = async () => {
    if (selectedModelId !== transformation.model_id) {
      await updateTransformation.mutateAsync({
        id: transformation.id,
        data: { model_id: selectedModelId || undefined }
      })
    }
    setShowModelDialog(false)
    setSelectedModelId(transformation.model_id || '')
  }

  const handleCloseModelDialog = () => {
    setShowModelDialog(false)
    setSelectedModelId(transformation.model_id || '')
  }

  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          {/* Row: trigger (name+desc) + action buttons side by side */}
          <div className="flex items-center gap-4 px-6 py-4">
            {/* Left: CollapsibleTrigger wraps ONLY the chevron + text — no nested buttons */}
            <CollapsibleTrigger className="flex items-center gap-3 flex-1 min-w-0 text-left">
              <ChevronRight
                className={`h-5 w-5 text-slate-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
              />
              <div className="min-w-0">
                <p className="font-bold text-slate-900 text-[15px] truncate">
                  {transformation.name}
                </p>
                <p className="text-slate-500 text-sm truncate">
                  {transformation.description || t.chat.noDescription}
                </p>
              </div>
            </CollapsibleTrigger>

            {/* Right: action buttons — outside CollapsibleTrigger, no nesting issue */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Model selector button */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowModelDialog(true) }}
                className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-semibold transition-colors"
                title={t.transformations.selectModel || 'Select Model'}
              >
                {t.transformations.selectModel || 'Select Model'}
              </button>
              {onPlayground && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onPlayground() }}
                  className="px-4 py-2 rounded-lg bg-[#FF7043] hover:bg-[#f4622e] text-white text-xs font-semibold transition-colors"
                >
                  {t.transformations.playground}
                </button>
              )}
              {onEdit && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onEdit() }}
                  className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
                >
                  {t.common.edit}
                </button>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(true) }}
                className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                title={t.common.delete}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Expanded content */}
          <CollapsibleContent>
            <div className="px-6 pb-5 pt-2 space-y-4 border-t border-slate-100">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  {t.common.title}
                </p>
                <p className="text-sm font-medium text-slate-800">
                  {transformation.title || t.sources.untitledSource}
                </p>
              </div>

              {transformation.description && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    {t.common.description}
                  </p>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {transformation.description}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                  {t.transformations.systemPrompt}
                </p>
                <pre className="whitespace-pre-wrap rounded-lg bg-slate-50 border border-slate-200 p-4 text-xs font-mono text-slate-700 leading-relaxed">
                  {transformation.prompt}
                </pre>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Model selector dialog - Compact */}
      <Dialog open={showModelDialog} onOpenChange={(open) => {
        if (!open) {
          handleCloseModelDialog()
        } else {
          setShowModelDialog(true)
        }
      }}>
        <DialogContent className="max-w-xs w-80">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base font-bold">{t.transformations.selectModel || 'Select Model'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <ModelSelector
              modelType="language"
              value={selectedModelId}
              onChange={setSelectedModelId}
              placeholder={t.transformations.noModelSelected || 'Use default model'}
            />
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={handleCloseModelDialog}
                className="px-2.5 py-1 rounded text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors border border-slate-200"
              >
                {t.common.cancel}
              </button>
              <button
                onClick={handleSaveModel}
                disabled={updateTransformation.isPending}
                className="px-2.5 py-1 rounded bg-[#FF7043] hover:bg-[#f4622e] text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                {updateTransformation.isPending ? t.common.saving : t.common.save}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title={t.sources.delete}
        description={t.transformations.deleteConfirm}
        confirmText={t.common.delete}
        confirmVariant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteTransformation.isPending}
      />
    </>
  )
}
