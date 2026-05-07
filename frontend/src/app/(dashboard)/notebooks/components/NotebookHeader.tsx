'use client'

import { useState } from 'react'
import { NotebookResponse } from '@/lib/types/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Archive, ArchiveRestore, Trash2, ChevronLeft } from 'lucide-react'
import { useUpdateNotebook } from '@/lib/hooks/use-notebooks'
import { NotebookDeleteDialog } from './NotebookDeleteDialog'
import { formatDistanceToNow } from 'date-fns'
import { getDateLocale } from '@/lib/utils/date-locale'
import { InlineEdit } from '@/components/common/InlineEdit'
import { useTranslation } from '@/lib/hooks/use-translation'
import Link from 'next/link'

interface NotebookHeaderProps {
  notebook: NotebookResponse
}

export function NotebookHeader({ notebook }: NotebookHeaderProps) {
  const { t, language } = useTranslation()
  const dfLocale = getDateLocale(language)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const updateNotebook = useUpdateNotebook()

  return (
    <>
      <div className="pb-8">
        <Link href="/notebooks" className="text-[13px] font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-6 transition-colors">
          <ChevronLeft className="h-4 w-4" />
          Back to Cases
        </Link>

        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-3">
              <InlineEdit
                id="notebook-name"
                name="notebook-name"
                value={notebook.name}
                onSave={(name) => name && name !== notebook.name && updateNotebook.mutate({ id: notebook.id, data: { name } })}
                className="text-[36px] font-extrabold text-slate-900 tracking-tight"
                inputClassName="text-[36px] font-extrabold"
              />
              {notebook.archived && <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 px-3 py-1 rounded-full text-[12px] font-bold uppercase">{t.notebooks.archived}</Badge>}
            </div>
            
            <InlineEdit
              id="notebook-description"
              name="notebook-description"
              value={notebook.description || ''}
              onSave={(description) => description !== notebook.description && updateNotebook.mutate({ id: notebook.id, data: { description: description || undefined } })}
              className="text-[15px] text-slate-500 font-medium"
              placeholder="Add description..."
              multiline
            />
            
            <div className="text-[12px] font-semibold text-slate-400 pt-2 flex items-center gap-2">
              <span>Created {formatDistanceToNow(new Date(notebook.created), { addSuffix: true, locale: dfLocale })}</span>
              <span className="opacity-30">•</span>
              <span>Updated {formatDistanceToNow(new Date(notebook.updated), { addSuffix: true, locale: dfLocale })}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateNotebook.mutate({ id: notebook.id, data: { archived: !notebook.archived } })}
              className="bg-white border-slate-200 text-slate-700 hover:bg-slate-50 rounded-[12px] h-[40px] px-5 font-bold shadow-sm"
            >
              {notebook.archived ? <><ArchiveRestore className="h-4 w-4 mr-2" /> Unarchive</> : <><Archive className="h-4 w-4 mr-2" /> Archive</>}
            </Button>
            <Button
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              className="bg-[#f05252] hover:bg-[#de3e3e] text-white rounded-[12px] h-[40px] px-5 font-bold shadow-[0_4px_12px_rgba(240,82,82,0.3)]"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>
      </div>

      <NotebookDeleteDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog} notebookId={notebook.id} notebookName={notebook.name} redirectAfterDelete />
    </>
  )
}