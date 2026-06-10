"use client"

import { FormSection } from "@/components/ui/form-section"
import { useTranslation } from "@/lib/hooks/use-translation"
import { CheckboxList } from "@/components/ui/checkbox-list"
import { i_NotesResponse } from "@/lib/types/api"

interface i_NotesStepProps {
  i_Notes: i_NotesResponse[]
  selectedi_Notes: string[]
  onTogglei_Notes: (i_NotesId: string) => void
  loading?: boolean
}

export function i_NotesStep({
  i_Notes,
  selectedi_Notes,
  onTogglei_Notes,
  loading = false
}: i_NotesStepProps) {
  const { t } = useTranslation()
  const i_NotesItems = i_Notes.map((i_Notes) => ({
    id: i_Notes.id,
    title: i_Notes.name,
    description: i_Notes.description || undefined
  }))

  return (
    <div className="space-y-6">
      <FormSection
        title={`${t.i_Notes.title} (${t.common.optional})`}
        description={t.sources.addExistingDesc}
      >
        <CheckboxList
          items={i_NotesItems}
          selectedIds={selectedi_Notes}
          onToggle={onTogglei_Notes}
          loading={loading}
          emptyMessage={t.sources.noi_NotesFound}
        />
      </FormSection>
    </div>
  )
}