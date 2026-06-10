'use client'

import { useRouter } from 'next/navigation'
import { i_NotesResponse } from '@/lib/types/api'
import { Button } from '@/components/ui/button'
import { MoreVertical, Archive, ArchiveRestore, Trash2, FileText, HardDrive, Clock, Play, Pause, Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useUpdatei_Notes } from '@/lib/hooks/use-i_Notes'
import { I_NotesDeleteDialog } from './i_NotesDeleteDialog'
import { I_NotesAccessDialog } from './i_NotesAccessDialog'
import { useState, useEffect } from 'react'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getDateLocale } from '@/lib/utils/date-locale'
import { useToast } from '@/lib/hooks/use-toast'
import { takei_NotestorageToastBand } from '@/lib/utils/i_Notes-storage-alerts'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/stores/auth-store'
import { hasRoleAccess } from '@/lib/auth/roles'

interface I_NotesCardProps {
  i_Notes: i_NotesResponse
}

export function I_NotesCard({ i_Notes }: I_NotesCardProps) {
  const { t, language } = useTranslation()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showAccessDialog, setShowAccessDialog] = useState(false)
  const router = useRouter()
  const updatei_Notes = useUpdatei_Notes()
  const { toast } = useToast()
  const currentUserRole = useAuthStore(s => s.currentUserRole)
  const currentUserEmail = useAuthStore(s => s.currentUserEmail)
  const canManageAccess = hasRoleAccess(currentUserRole, 'admin')

  // Storage calculations
  const hasLimit = i_Notes.storage_limit_mb != null && i_Notes.storage_limit_mb > 0
  const usedMb   = i_Notes.storage_used_mb ?? 0
  const limitMb  = i_Notes.storage_limit_mb ?? 0
  const usedPct  = hasLimit ? Math.min((usedMb / limitMb) * 100, 100) : 0

  useEffect(() => {
    if (!hasLimit) return
    const nextBand = takei_NotestorageToastBand(i_Notes.id, usedPct)
    if (!nextBand) return
    const payloads: Record<50 | 75 | 100, { title: string; desc: string; variant: 'default' | 'destructive' }> = {
      100: { title: 'Storage Full', desc: `"${i_Notes.name}" has reached its ${limitMb} MB limit. No more uploads allowed.`, variant: 'destructive' },
      75:  { title: 'Storage at 75%', desc: `"${i_Notes.name}" has used ${usedMb.toFixed(1)} MB of ${limitMb} MB.`, variant: 'destructive' },
      50:  { title: 'Storage at 50%', desc: `"${i_Notes.name}" has used ${usedMb.toFixed(1)} MB of ${limitMb} MB.`, variant: 'default' },
    }
    const p = payloads[nextBand]
    toast({ title: p.title, description: p.desc, variant: p.variant })
  }, [usedPct, hasLimit, limitMb, usedMb, i_Notes.id, i_Notes.name, toast])

  const handleArchiveToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    updatei_Notes.mutate({ id: i_Notes.id, data: { archived: !i_Notes.archived } })
  }

  const handleCardClick = () => {
    const shortId = i_Notes.id.includes(':') ? i_Notes.id.split(':')[1] : i_Notes.id
    router.push(`/i_Notes/${shortId}`)
  }

  const mockIndex = Math.abs(i_Notes.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 4
  const categories = ['Machine Learning', 'Research', 'Data Processing', 'Quality Assurance']
  const priorities = ['High Priority', 'Medium', 'Low', 'High Priority']
  const colors = ['blue', 'pink', 'green', 'purple']
  const defaultProgress = [75, 45, 100, 90]
  const isPausedArr = [true, true, false, true]

  const categoryTag = categories[mockIndex]
  const priorityTag = priorities[mockIndex]
  const colorScheme = colors[mockIndex]
  const displayProgress = hasLimit ? Math.round(usedPct) : defaultProgress[mockIndex]
  const showPause = displayProgress !== 100 ? isPausedArr[mockIndex] : false

  return (
    <>
      <div
        onClick={handleCardClick}
        className="bg-white p-6 rounded-[20px] shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-slate-100/80 space-y-4 relative group cursor-pointer transition-all hover:shadow-[0_6px_28px_rgba(0,0,0,0.07)] hover:-translate-y-0.5"
      >
        {/* Top Row: Tags & Menu */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            {i_Notes.archived ? (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600">
                {t.i_Notes.archived || 'Archived'}
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
                {i_Notes.archived ? (
                  <><ArchiveRestore className="h-4 w-4 mr-2" />{t.i_Notes.unarchive}</>
                ) : (
                  <><Archive className="h-4 w-4 mr-2" />{t.i_Notes.archive}</>
                )}
              </DropdownMenuItem>
              {canManageAccess && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={(e) => { e.stopPropagation(); setShowAccessDialog(true) }}
                    className="rounded-lg cursor-pointer text-[#8A2BE2] focus:bg-purple-50 focus:text-[#7A26C9]"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Manage Access
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
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
            {i_Notes.name}
          </h3>
          <p className="text-[13px] text-slate-500 font-medium mt-1 line-clamp-1">
            {i_Notes.description || t.chat.noDescription}
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
              Updated {formatDistanceToNow(new Date(i_Notes.updated), { addSuffix: true, locale: getDateLocale(language) })}
            </div>
            <div className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              {i_Notes.source_count} sources
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

      <I_NotesDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        i_NotesId={i_Notes.id}
        i_NotesName={i_Notes.name}
      />

      {canManageAccess && (
        <I_NotesAccessDialog
          open={showAccessDialog}
          onOpenChange={setShowAccessDialog}
          i_NotesId={i_Notes.id.includes(':') ? i_Notes.id.split(':')[1] : i_Notes.id}
          i_NotesName={i_Notes.name}
          currentUserEmail={currentUserEmail ?? ''}
          currentUserRole={currentUserRole ?? 'user'}
        />
      )}
    </>
  )
}
