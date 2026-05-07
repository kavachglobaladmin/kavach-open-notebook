'use client'

import { useState, useMemo } from 'react'
import { NoteResponse } from '@/lib/types/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, StickyNote, Bot, User, MoreVertical, Trash2 } from 'lucide-react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import { NoteEditorDialog } from './NoteEditorDialog'
import { getDateLocale } from '@/lib/utils/date-locale'
import { formatDistanceToNow } from 'date-fns'
import { ContextToggle } from '@/components/common/ContextToggle'
import { ContextMode } from '../[id]/page'
import { useDeleteNote } from '@/lib/hooks/use-notes'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { CollapsibleColumn, createCollapseButton } from '@/components/notebooks/CollapsibleColumn'
import { useNotebookColumnsStore } from '@/lib/stores/notebook-columns-store'
import { useTranslation } from '@/lib/hooks/use-translation'

interface NotesColumnProps {
  notes?: NoteResponse[]
  isLoading: boolean
  notebookId: string
  contextSelections?: Record<string, ContextMode>
  onContextModeChange?: (noteId: string, mode: ContextMode) => void
}

export function NotesColumn({
  notes,
  isLoading,
  notebookId,
  contextSelections,
  onContextModeChange
}: NotesColumnProps) {
  const { t, language } = useTranslation()
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingNote, setEditingNote] = useState<NoteResponse | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [noteToDelete, setNoteToDelete] = useState<string | null>(null)

  const deleteNote = useDeleteNote()
  const { notesCollapsed, toggleNotes } = useNotebookColumnsStore()
  const collapseButton = useMemo(
    () => createCollapseButton(toggleNotes, t.common.notes),
    [toggleNotes, t.common.notes]
  )

  const handleDeleteConfirm = async () => {
    if (!noteToDelete) return
    try {
      await deleteNote.mutateAsync(noteToDelete)
      setDeleteDialogOpen(false)
      setNoteToDelete(null)
    } catch (error) { console.error(error) }
  }

  return (
    <>
      <CollapsibleColumn
        isCollapsed={notesCollapsed}
        onToggle={toggleNotes}
        collapsedIcon={StickyNote}
        collapsedLabel={t.common.notes}
      >
        <Card className="h-full flex flex-col flex-1 overflow-hidden bg-white border-none rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
          <CardHeader className="pb-3 pt-6 px-6 flex-shrink-0">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-[20px] font-bold text-slate-900">{t.common.notes}</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="bg-[#6149f6] hover:bg-[#523cdb] text-white rounded-[12px] h-[40px] px-5 font-semibold shadow-[0_4px_12px_rgba(97,73,246,0.35)] transition-all"
                  onClick={() => { setEditingNote(null); setShowAddDialog(true); }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t.common.writeNote}
                </Button>
                {collapseButton}
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto px-6 pb-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><LoadingSpinner /></div>
            ) : !notes || notes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center pt-10">
                <div className="w-16 h-16 bg-[#f1f3f6] rounded-2xl flex items-center justify-center mb-4">
                  <StickyNote className="w-8 h-8 text-[#94a3b8]" />
                </div>
                <h3 className="text-[16px] font-bold text-slate-900 mb-1">{t.notebooks.noNotesYet}</h3>
                <p className="text-[13px] text-slate-500 text-center max-w-[200px] leading-relaxed">
                  {t.sources.createFirstNote}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="p-4 border border-slate-100 rounded-2xl hover:border-slate-200 transition-all cursor-pointer group relative" onClick={() => setEditingNote(note)}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {note.note_type === 'ai' ? <Bot className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-slate-400" />}
                        <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0">
                          {note.note_type === 'ai' ? t.common.aiGenerated : t.common.human}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 font-medium">
                          {formatDistanceToNow(new Date(note.updated), { addSuffix: true, locale: getDateLocale(language) })}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 rounded-full" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setNoteToDelete(note.id); setDeleteDialogOpen(true); }} className="text-red-600">
                              <Trash2 className="h-4 w-4 mr-2" /> {t.notebooks.deleteNote}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                    {note.title && <h4 className="text-[14px] font-bold text-slate-900 mb-1">{note.title}</h4>}
                    {note.content && <p className="text-[13px] text-slate-500 line-clamp-3 leading-relaxed">{note.content}</p>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </CollapsibleColumn>
      <NoteEditorDialog open={showAddDialog || Boolean(editingNote)} onOpenChange={(open) => { if (!open) { setShowAddDialog(false); setEditingNote(null); } else setShowAddDialog(true); }} notebookId={notebookId} note={editingNote ?? undefined} />
      <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} title={t.notebooks.deleteNote} description={t.notebooks.deleteNoteConfirm} confirmText={t.common.delete} onConfirm={handleDeleteConfirm} isLoading={deleteNote.isPending} confirmVariant="destructive" />
    </>
  )
}