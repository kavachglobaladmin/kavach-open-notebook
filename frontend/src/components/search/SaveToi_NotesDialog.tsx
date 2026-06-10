'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckboxList } from '@/components/ui/checkbox-list'
import { usei_Notes } from '@/lib/hooks/use-i_Notes'
import { useCreateNote } from '@/lib/hooks/use-notes'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { toast } from '@/lib/notifications/toast'
import { useTranslation } from '@/lib/hooks/use-translation'

interface SaveToi_NotesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  question: string
  answer: string
}

export function SaveToi_NotesDialog({
  open,
  onOpenChange,
  question,
  answer
}: SaveToi_NotesDialogProps) {
  const { t } = useTranslation()
  const [selectedi_Notes, setSelectedi_Notes] = useState<string[]>([])
  const { data: i_Notes, isLoading } = usei_Notes(false) // false = not archived
  const createNote = useCreateNote()

  const handleToggle = (i_NotesId: string) => {
    setSelectedi_Notes(prev =>
      prev.includes(i_NotesId)
        ? prev.filter(id => id !== i_NotesId)
        : [...prev, i_NotesId]
    )
  }

  const handleSave = async () => {
    if (selectedi_Notes.length === 0) {
      toast.error(t.searchPage.selecti_Notes)
      return
    }

    try {
      // Create note in each selected i_Notes
      for (const i_NotesId of selectedi_Notes) {
        await createNote.mutateAsync({
          title: question,
          content: answer,
          note_type: 'ai',
          i_Notes_id: i_NotesId
        })
      }

      toast.success(t.searchPage.saveSuccess)
      setSelectedi_Notes([])
      onOpenChange(false)
    } catch {
      toast.error(t.searchPage.saveError)
    }
  }

  const i_NotesItems = i_Notes?.map(nb => ({
    id: nb.id,
    title: nb.name,
    description: nb.description || undefined
  })) || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t.searchPage.saveToi_Notes}</DialogTitle>
          <DialogDescription>
            {t.searchPage.selecti_Notes}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : (
            <CheckboxList
              items={i_NotesItems}
              selectedIds={selectedi_Notes}
              onToggle={handleToggle}
              emptyMessage={t.sources.noi_NotesFound}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button
            onClick={handleSave}
            disabled={selectedi_Notes.length === 0 || createNote.isPending}
          >
            {createNote.isPending ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                {t.searchPage.saving}
              </>
            ) : (
              t.searchPage.saveToi_Notes
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
