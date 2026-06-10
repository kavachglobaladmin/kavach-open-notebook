'use client'

import { useState, useEffect } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { useTranslation } from '@/lib/hooks/use-translation'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { useNotebookDeletePreview, useDeleteNotebook } from '@/lib/hooks/use-i_Notes'
import { useRouter } from 'next/navigation'

interface I_NotesDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  i_NotesId: string
  i_NotesName: string
  redirectAfterDelete?: boolean
}

export function I_NotesDeleteDialog({
  open,
  onOpenChange,
  i_NotesId,
  i_NotesName,
  redirectAfterDelete = false,
}: I_NotesDeleteDialogProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const [sourceAction, setSourceAction] = useState<'keep' | 'delete'>('keep')

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSourceAction('keep')
    }
  }, [open, i_NotesId])

  // Fetch delete preview when dialog is open
  const { data: preview, isLoading: isLoadingPreview, error: previewError } = useNotebookDeletePreview(
    i_NotesId,
    open
  )

  const deleteNotebook = useDeleteNotebook()

  const handleConfirm = async () => {
    await deleteNotebook.mutateAsync({
      id: i_NotesId,
      deleteExclusiveSources: sourceAction === 'delete',
    })
    onOpenChange(false)
    if (redirectAfterDelete) {
      router.push('/i_Notes')
    }
  }

  const isDeleting = deleteNotebook.isPending

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.i_Notes.deleteNotebook}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.i_Notes.deletei_NotesDesc.replace('{name}', i_NotesName)}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4 space-y-3">
          {isLoadingPreview ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <LoadingSpinner size="sm" />
              <span>{t.i_Notes.deletei_NotesLoading}</span>
            </div>
          ) : previewError ? (
            <div className="text-sm text-destructive">
              {t.common.error}: {previewError.message || 'Failed to load preview'}
            </div>
          ) : preview ? (
            <>
              {/* Notes section */}
              <div className="text-sm">
                {preview.note_count > 0 ? (
                  <p className="text-destructive font-medium">
                    {t.i_Notes.deletei_NotesNotes.replace(
                      '{count}',
                      String(preview.note_count)
                    )}
                  </p>
                ) : (
                  <p className="text-muted-foreground">{t.i_Notes.deletei_NotesNoNotes}</p>
                )}
              </div>

              {/* Shared sources - always above the line */}
              {preview.shared_source_count > 0 && (
                <div className="text-sm">
                  <p className="text-muted-foreground">
                    {t.i_Notes.deletei_NotesharedSources.replace(
                      '{count}',
                      String(preview.shared_source_count)
                    )}
                  </p>
                </div>
              )}

              {/* No sources message */}
              {preview.exclusive_source_count === 0 && preview.shared_source_count === 0 && (
                <div className="text-sm">
                  <p className="text-muted-foreground">{t.i_Notes.deletei_NotesNoSources}</p>
                </div>
              )}

              {/* Exclusive sources section - below the line with radio buttons */}
              {preview.exclusive_source_count > 0 && (
                <div className="pt-3 border-t space-y-3">
                  <p className="text-sm text-destructive font-medium">
                    {t.i_Notes.deletei_NotesExclusiveSources.replace(
                      '{count}',
                      String(preview.exclusive_source_count)
                    )}
                  </p>
                  <RadioGroup
                    value={sourceAction}
                    onValueChange={(value) => setSourceAction(value as 'keep' | 'delete')}
                    disabled={isDeleting}
                  >
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="delete" id="delete-sources" />
                      <Label htmlFor="delete-sources" className="text-sm cursor-pointer">
                        {t.i_Notes.deleteExclusiveSourcesLabel}
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <RadioGroupItem value="keep" id="keep-sources" />
                      <Label htmlFor="keep-sources" className="text-sm cursor-pointer">
                        {t.i_Notes.keepExclusiveSourcesLabel}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}
            </>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>{t.common.cancel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isDeleting || isLoadingPreview}
            className="bg-red-600 hover:bg-red-700"
          >
            {isDeleting ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                {t.common.deleting}
              </>
            ) : (
              t.common.delete
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

