'use client'

import { useRouter } from 'next/navigation'
import { NotebookResponse } from '@/lib/types/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MoreVertical, Archive, ArchiveRestore, Trash2, FileText, StickyNote, HardDrive, Clock, Play, Pause } from 'lucide-react'
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
import { cn } from '@/lib/utils'

interface NotebookCardProps {
  notebook: NotebookResponse
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

  // Persist one toast per ascending storage band per notebook
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

  // Generate stable mock visuals based on ID to precisely match the reference image's design feel
  const mockIndex = Math.abs(notebook.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 4;
  const categories = ['Machine Learning', 'Research', 'Data Processing', 'Quality Assurance'];
  const priorities = ['High Priority', 'Medium', 'Low', 'High Priority'];
  const colors = ['blue', 'pink', 'green', 'purple'];
  const defaultProgress = [75, 45, 100, 90];
  const isPausedArr = [true, true, false, true];

  const categoryTag = categories[mockIndex];
  const priorityTag = priorities[mockIndex];
  const colorScheme = colors[mockIndex];
  // If the notebook has a storage limit, use real usage as "Progress", otherwise fallback to visual match
  const displayProgress = hasLimit ? Math.round(usedPct) : defaultProgress[mockIndex];
  const showPause = displayProgress !== 100 ? isPausedArr[mockIndex] : false;

  return (
    <>
      <div
        onClick={handleCardClick}
        className="bg-white p-6 rounded-[20px] shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-slate-100/80 space-y-4 relative group cursor-pointer transition-all hover:shadow-[0_6px_28px_rgba(0,0,0,0.07)] hover:-translate-y-0.5"
      >
        {/* Top Row: Tags & Menu */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {notebook.archived ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                {t.notebooks.archived || 'Archived'}
              </span>
            ) : (
              <>
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#F3F4F6] text-slate-500">
                  {categoryTag}
                </span>
                <span className={cn(
                  "inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold",
                  priorityTag === 'High Priority' && "bg-[#FEF2F2] text-[#EF4444]",
                  priorityTag === 'Medium'        && "bg-[#FFFBEB] text-[#F59E0B]",
                  priorityTag === 'Low'           && "bg-[#EFF6FF] text-[#3B82F6]"
                )}>
                  {priorityTag}
                </span>
              </>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:bg-slate-50 -mr-1 rounded-full h-8 w-8 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-[17px] w-[17px]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="rounded-xl shadow-lg">
              <DropdownMenuItem onClick={handleArchiveToggle} className="rounded-lg cursor-pointer">
                {notebook.archived ? (
                  <><ArchiveRestore className="h-4 w-4 mr-2" />{t.notebooks.unarchive}</>
                ) : (
                  <><Archive className="h-4 w-4 mr-2" />{t.notebooks.archive}</>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(true) }}
                className="text-red-600 focus:bg-red-50 focus:text-red-700 rounded-lg cursor-pointer"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t.common.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Title and Description */}
        <div>
          <h3 className="text-[20px] font-bold text-slate-900 tracking-tight leading-snug">
            {notebook.name}
          </h3>
          <p className="text-[13px] text-slate-500 font-medium mt-1 line-clamp-1">
            {notebook.description || t.chat.noDescription}
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[12px] font-semibold">
            <span className="text-slate-500">{hasLimit ? 'Storage' : 'Progress'}</span>
            <span className="text-slate-800">{displayProgress}%</span>
          </div>
          <div className="relative h-[6px] w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={cn(
                "absolute left-0 top-0 h-full rounded-full transition-all duration-700 ease-out bg-gradient-to-r",
                colorScheme === 'blue'   && "from-[#4665F0] to-[#7C3AED]",
                colorScheme === 'pink'   && "from-[#D946EF] to-[#EC4899]",
                colorScheme === 'green'  && "from-[#10B981] to-[#34D399]",
                colorScheme === 'purple' && "from-[#A855F7] to-[#7C3AED]"
              )}
              style={{ width: `${displayProgress}%` }}
            />
          </div>
        </div>

        {/* Bottom Row: Metadata + action icon */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-4 text-[12px] font-medium text-slate-400">
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Updated {formatDistanceToNow(new Date(notebook.updated), { addSuffix: true, locale: getDateLocale(language) })}
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {notebook.source_count} sources
            </div>
            {hasLimit && (
              <div className="flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5" />
                {usedMb.toFixed(1)} MB
              </div>
            )}
          </div>

          <div className={cn(
            "h-7 w-7 rounded-full flex items-center justify-center transition-colors",
            displayProgress === 100 || !showPause
              ? "bg-[#EEF2FF] text-[#4665F0]"
              : "bg-[#ECFDF5] text-[#10B981]"
          )}>
            {displayProgress === 100 || !showPause ? (
              <Play className="h-3 w-3 ml-0.5 fill-current" />
            ) : (
              <Pause className="h-3 w-3 fill-current" />
            )}
          </div>
        </div>
      </div>

      <NotebookDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        notebookId={notebook.id}
        notebookName={notebook.name}
      />
    </>
  )
}