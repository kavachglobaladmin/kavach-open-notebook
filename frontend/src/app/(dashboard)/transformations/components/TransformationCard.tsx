'use client'

import { useState } from 'react'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronRight, Trash2 } from 'lucide-react'
import { Transformation } from '@/lib/types/transformations'
import { useDeleteTransformation } from '@/lib/hooks/use-transformations'
import { useTranslation } from '@/lib/hooks/use-translation'

interface TransformationCardProps {
  transformation: Transformation
  onPlayground?: () => void
  onEdit?: () => void
}

export function TransformationCard({ transformation, onPlayground, onEdit }: TransformationCardProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const deleteTransformation = useDeleteTransformation()

  const handleDelete = () => {
    deleteTransformation.mutate(transformation.id)
    setShowDeleteDialog(false)
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
