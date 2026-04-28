'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { TransformationCard } from './TransformationCard'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Wand2 } from 'lucide-react'
import { Transformation } from '@/lib/types/transformations'
import { TransformationEditorDialog } from './TransformationEditorDialog'
import { useTranslation } from '@/lib/hooks/use-translation'

interface TransformationsListProps {
  transformations: Transformation[] | undefined
  isLoading: boolean
  onPlayground?: (transformation: Transformation) => void
}

export function TransformationsList({ transformations, isLoading, onPlayground }: TransformationsListProps) {
  const { t } = useTranslation()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTransformation, setEditingTransformation] = useState<Transformation | undefined>()

  const handleOpenEditor = (trans?: Transformation) => {
    setEditingTransformation(trans)
    setEditorOpen(true)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!transformations || transformations.length === 0) {
    return (
      <>
        <EmptyState
          icon={Wand2}
          title={t.transformations.noTransformations}
          description={t.transformations.createOne}
          action={
            <button
              onClick={() => handleOpenEditor()}
              className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#FF7043] hover:bg-[#f4622e] text-white text-sm font-semibold transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t.transformations.createNew}
            </button>
          }
        />
        <TransformationEditorDialog
          open={editorOpen}
          onOpenChange={(open) => {
            setEditorOpen(open)
            if (!open) setEditingTransformation(undefined)
          }}
          transformation={editingTransformation}
        />
      </>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {/* Section header — matches reference */}
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">
            {t.transformations.listTitle}
          </h2>
          <button
            onClick={() => handleOpenEditor()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#FF7043] hover:bg-[#f4622e] text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            {t.transformations.createNew}
          </button>
        </div>

        {/* Transformation rows */}
        <div className="space-y-3">
          {transformations.map((transformation) => (
            <TransformationCard
              key={transformation.id}
              transformation={transformation}
              onPlayground={onPlayground ? () => onPlayground(transformation) : undefined}
              onEdit={() => handleOpenEditor(transformation)}
            />
          ))}
        </div>
      </div>

      <TransformationEditorDialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open)
          if (!open) setEditingTransformation(undefined)
        }}
        transformation={editingTransformation}
      />
    </>
  )
}
