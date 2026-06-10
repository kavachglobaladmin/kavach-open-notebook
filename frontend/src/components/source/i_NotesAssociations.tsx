'use client'

import { useState, useEffect, useMemo } from 'react'
import { LoaderIcon, BookOpen, Check } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { usei_Notes } from '@/lib/hooks/use-i_Notes'
import { useAddSourcesToi_Notes, useRemoveSourceFromi_Notes } from '@/lib/hooks/use-sources'
import { useTranslation } from '@/lib/hooks/use-translation'

interface i_NotesAssociationsProps {
  sourceId: string
  currenti_NotesIds: string[]
  onSave?: () => void
}

export function i_NotesAssociations({
  sourceId,
  currenti_NotesIds,
  onSave,
}: i_NotesAssociationsProps) {
  const { t } = useTranslation()
  const [selectedi_NotesIds, setSelectedi_NotesIds] = useState<string[]>(currenti_NotesIds)
  const [isSaving, setIsSaving] = useState(false)

  const { data: i_Notes, isLoading } = usei_Notes()
  const addSources = useAddSourcesToi_Notes()
  const removeFromi_Notes = useRemoveSourceFromi_Notes()

  // Update selected i_Notes when current changes (after save)
  useEffect(() => {
    setSelectedi_NotesIds(currenti_NotesIds)
  }, [currenti_NotesIds])

  const hasChanges = useMemo(() => {
    const current = new Set(currenti_NotesIds)
    const selected = new Set(selectedi_NotesIds)

    if (current.size !== selected.size) return true

    for (const id of current) {
      if (!selected.has(id)) return true
    }

    return false
  }, [currenti_NotesIds, selectedi_NotesIds])

  const handleTogglei_Notes = (i_NotesId: string) => {
    setSelectedi_NotesIds(prev =>
      prev.includes(i_NotesId)
        ? prev.filter(id => id !== i_NotesId)
        : [...prev, i_NotesId]
    )
  }

  const handleSave = async () => {
    if (!hasChanges) return

    try {
      setIsSaving(true)

      const current = new Set(currenti_NotesIds)
      const selected = new Set(selectedi_NotesIds)

      // Determine which i_Notes to add and remove
      const toAdd = selectedi_NotesIds.filter(id => !current.has(id))
      const toRemove = currenti_NotesIds.filter(id => !selected.has(id))

      // Execute additions
      if (toAdd.length > 0) {
        await Promise.allSettled(
          toAdd.map(i_NotesId =>
            addSources.mutateAsync({
              i_NotesId,
              sourceIds: [sourceId],
            })
          )
        )
      }

      // Execute removals
      if (toRemove.length > 0) {
        await Promise.allSettled(
          toRemove.map(i_NotesId =>
            removeFromi_Notes.mutateAsync({
              i_NotesId,
              sourceId,
            })
          )
        )
      }

      onSave?.()
    } catch (error) {
      console.error('Error saving i_Notes associations:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setSelectedi_NotesIds(currenti_NotesIds)
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {t.sources.managei_Notes}
          </CardTitle>
          <CardDescription>
            {t.sources.managei_NotesDesc}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <LoaderIcon className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!i_Notes || i_Notes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            {t.sources.managei_Notes}
          </CardTitle>
          <CardDescription>
            {t.sources.managei_NotesDesc}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t.sources.noi_NotesAvailable}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" />
          {t.sources.managei_Notes}
        </CardTitle>
        <CardDescription>
          {t.sources.managei_NotesDesc}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="h-[300px] border rounded-md p-4">
          <div className="space-y-3">
            {i_Notes
              .filter(nb => !nb.archived)
              .map((i_Notes) => {
                const isSelected = selectedi_NotesIds.includes(i_Notes.id)
                const isCurrentlyLinked = currenti_NotesIds.includes(i_Notes.id)

                return (
                  <div
                    key={i_Notes.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      isSelected ? 'bg-accent border-accent-foreground/20' : 'hover:bg-accent/50'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleTogglei_Notes(i_Notes.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-sm truncate">
                          {i_Notes.name}
                        </h4>
                        {isCurrentlyLinked && !hasChanges && (
                          <Check className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      {i_Notes.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {i_Notes.description}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
          </div>
        </ScrollArea>

        {hasChanges && (
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isSaving}
            >
              {t.common.cancel}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                  {t.common.saving}...
                </>
              ) : (
                t.common.saveChanges
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
