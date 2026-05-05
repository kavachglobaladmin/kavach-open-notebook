'use client'

import { useRouter } from 'next/navigation'
import { NotebookResponse } from '@/lib/types/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MoreHorizontal, Archive, ArchiveRestore, Trash2, FileText, StickyNote, HardDrive } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUpdateNotebook } from '@/lib/hooks/use-notebooks'
import { NotebookDeleteDialog } from './NotebookDeleteDialog'
import { useState, useEffect } from 'react'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getDateLocale } from '@/lib/utils/date-locale'
import { useToast } from '@/lib/hooks/use-toast'
import { takeNotebookStorageToastBand } from '@/lib/utils/notebook-storage-alerts'

interface NotebookCardProps {
  notebook: NotebookResponse
}

// Returns bar color based on usage %
function storageBarColor(pct: number): string {
  if (pct >= 100) return 'bg-red-500'
  if (pct >= 75)  return 'bg-orange-400'
  if (pct >= 50)  return 'bg-yellow-400'
  return 'bg-blue-500'
}

export function NotebookCard({ notebook }: NotebookCardProps) {
  const { t, language } = useTranslation()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const router = useRouter()
  const updateNotebook = useUpdateNotebook()
  const { toast } = useToast()

  // Storage calculations
  const hasLimit = notebook.storage_limit_mb != null && notebook.storage_limit_mb > 0
  const usedMb   = notebook.storage_used_mb ?? 0
  const limitMb  = notebook.storage_limit_mb ?? 0
  const usedPct  = hasLimit ? Math.min((usedMb / limitMb) * 100, 100) : 0

  // Persist one toast per ascending storage band per notebook — survives refresh and matches notification center clears
  useEffect(() => {
    if (!hasLimit) return

    const nextBand = takeNotebookStorageToastBand(notebook.id, usedPct)
    if (!nextBand) return

    const payloads: Record<
      50 | 75 | 100,
      { title: string; desc: string; variant: 'default' | 'destructive' }
    > = {
      100: {
        title: 'Storage Full',
        desc: `"${notebook.name}" has reached its ${limitMb} MB limit. No more uploads allowed.`,
        variant: 'destructive',
      },
      75: {
        title: 'Storage at 75%',
        desc: `"${notebook.name}" has used ${usedMb.toFixed(1)} MB of ${limitMb} MB.`,
        variant: 'destructive',
      },
      50: {
        title: 'Storage at 50%',
        desc: `"${notebook.name}" has used ${usedMb.toFixed(1)} MB of ${limitMb} MB.`,
        variant: 'default',
      },
    }
    const p = payloads[nextBand]
    toast({ title: p.title, description: p.desc, variant: p.variant })
  }, [usedPct, hasLimit, limitMb, usedMb, notebook.id, notebook.name, toast])

  const handleArchiveToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateNotebook.mutate({ id: notebook.id, data: { archived: !notebook.archived } })
  }

  const handleCardClick = () => {
    router.push(`/notebooks/${encodeURIComponent(notebook.id)}`)
  }

  return (
    <>
      <Card
        className="group card-hover"
        onClick={handleCardClick}
        style={{ cursor: 'pointer' }}
      >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base truncate group-hover:text-primary transition-colors">
                  {notebook.name}
                </CardTitle>
                {notebook.archived && (
                  <Badge variant="secondary" className="mt-1">
                    {t.notebooks.archived}
                  </Badge>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={handleArchiveToggle}>
                    {notebook.archived ? (
                      <><ArchiveRestore className="h-4 w-4 mr-2" />{t.notebooks.unarchive}</>
                    ) : (
                      <><Archive className="h-4 w-4 mr-2" />{t.notebooks.archive}</>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(true) }}
                    className="text-red-600"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t.common.delete}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>

          <CardContent>
            <CardDescription className="line-clamp-2 text-sm">
              {notebook.description || t.chat.noDescription}
            </CardDescription>

            <div className="mt-3 text-xs text-muted-foreground">
              {t.common.updated.replace('{time}', formatDistanceToNow(new Date(notebook.updated), {
                addSuffix: true,
                locale: getDateLocale(language)
              }))}
            </div>

            {/* Item counts + storage footer */}
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-xs flex items-center gap-1 px-1.5 py-0.5 text-primary border-primary/50">
                  <FileText className="h-3 w-3" />
                  <span>{notebook.source_count}</span>
                </Badge>
                <Badge variant="outline" className="text-xs flex items-center gap-1 px-1.5 py-0.5 text-primary border-primary/50">
                  <StickyNote className="h-3 w-3" />
                  <span>{notebook.note_count}</span>
                </Badge>
              </div>

              {/* Storage — always visible */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                <HardDrive className="h-3 w-3 shrink-0" />
                {hasLimit ? (
                  <>
                    <span className={usedPct >= 100 ? 'text-red-500 font-semibold' : usedPct >= 75 ? 'text-orange-500 font-medium' : ''}>
                      {usedMb.toFixed(1)}/{limitMb}MB
                    </span>
                    <div className="h-1.5 w-14 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${storageBarColor(usedPct)}`}
                        style={{ width: `${usedPct}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <span>{usedMb.toFixed(1)} MB</span>
                )}
              </div>
            </div>
          </CardContent>
      </Card>

      <NotebookDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        notebookId={notebook.id}
        notebookName={notebook.name}
      />
    </>
  )
}