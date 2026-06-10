'use client'

import { useState } from 'react'
import { i_NotesResponse } from '@/lib/types/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Archive, ArchiveRestore, Trash2, ChevronLeft } from 'lucide-react'
import { useUpdatei_Notes } from '@/lib/hooks/use-i_Notes'
import { I_NotesDeleteDialog } from './i_NotesDeleteDialog'
import { formatDistanceToNow } from 'date-fns'
import { getDateLocale } from '@/lib/utils/date-locale'
import { InlineEdit } from '@/components/common/InlineEdit'
import { useTranslation } from '@/lib/hooks/use-translation'
import Link from 'next/link'

interface I_NotesHeaderProps {
  i_Notes: i_NotesResponse
  /** Override the back-navigation href. Defaults to "/i_Notes". */
  backHref?: string
  /** Override the back-navigation label. Defaults to "Back to Cases". */
  backLabel?: string
}

export function I_NotesHeader({ i_Notes, backHref = '/i_Notes', backLabel = 'Back to Cases' }: I_NotesHeaderProps) {
  const { t, language } = useTranslation()
  const dfLocale = getDateLocale(language)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const updatei_Notes = useUpdatei_Notes()

  return (
    <>
      <div className="pb-6 sm:pb-8">
        <Link href={backHref} className="text-[13px] font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-6 transition-colors">
          <ChevronLeft className="h-4 w-4" />
          {backLabel}
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <InlineEdit
                id="i_Notes-name"
                name="i_Notes-name"
                value={i_Notes.name}
                onSave={(name) => name && name !== i_Notes.name && updatei_Notes.mutate({ id: i_Notes.id, data: { name } })}
                className="text-[26px] sm:text-[32px] lg:text-[36px] font-extrabold text-slate-900 tracking-tight break-words"
                inputClassName="text-[26px] sm:text-[32px] lg:text-[36px] font-extrabold"
              />
              {i_Notes.archived && <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 px-3 py-1 rounded-full text-[12px] font-bold uppercase">{t.i_Notes.archived}</Badge>}
            </div>
            
            <InlineEdit
              id="i_Notes-description"
              name="i_Notes-description"
              value={i_Notes.description || ''}
              onSave={(description) => description !== i_Notes.description && updatei_Notes.mutate({ id: i_Notes.id, data: { description: description || undefined } })}
              className="text-[15px] text-slate-500 font-medium"
              placeholder="Add description..."
              multiline
            />
            
            <div className="text-[12px] font-semibold text-slate-400 pt-2 flex flex-wrap items-center gap-2">
              <span>Created {formatDistanceToNow(new Date(i_Notes.created), { addSuffix: true, locale: dfLocale })}</span>
              <span className="opacity-30">•</span>
              <span>Updated {formatDistanceToNow(new Date(i_Notes.updated), { addSuffix: true, locale: dfLocale })}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updatei_Notes.mutate({ id: i_Notes.id, data: { archived: !i_Notes.archived } })}
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 rounded-[12px] h-[40px] px-4 sm:px-5 font-bold shadow-sm"
            >
              {i_Notes.archived ? <><ArchiveRestore className="h-4 w-4 mr-2" /> Unarchive</> : <><Archive className="h-4 w-4 mr-2" /> Archive</>}
            </Button>
            <Button
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="bg-[#f05252] hover:bg-[#de3e3e] text-white rounded-[12px] h-[40px] px-4 sm:px-5 font-bold shadow-[0_4px_12px_rgba(240,82,82,0.3)]"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <I_NotesDeleteDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} i_NotesId={i_Notes.id} i_NotesName={i_Notes.name} redirectAfterDelete />
    </>
  )
}

