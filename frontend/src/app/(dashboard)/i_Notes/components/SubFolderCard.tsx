'use client'

import { useRouter } from 'next/navigation'
import { i_NotesResponse } from '@/lib/types/api'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  MoreVertical,
  FolderOpen,
  FileText,
  Clock,
  Unlink,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { getDateLocale } from '@/lib/utils/date-locale'
import { useTranslation } from '@/lib/hooks/use-translation'
import { cn } from '@/lib/utils'

interface SubFolderCardProps {
  i_Notes: i_NotesResponse
  parentId: string
  onUnlink?: (childId: string) => void
}

const FOLDER_COLORS = [
  { from: '#6149f6', to: '#8b5cf6', bg: '#F5F3FF', text: '#6149f6' },
  { from: '#3b82f6', to: '#6366f1', bg: '#EFF6FF', text: '#3b82f6' },
  { from: '#10b981', to: '#34d399', bg: '#ECFDF5', text: '#10b981' },
  { from: '#f59e0b', to: '#fbbf24', bg: '#FFFBEB', text: '#f59e0b' },
]

export function SubFolderCard({ i_Notes, parentId, onUnlink }: SubFolderCardProps) {
  const { language } = useTranslation()
  const router = useRouter()

  // Stable color derived from the i_Notes ID
  const colorIdx =
    Math.abs(
      i_Notes.id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0),
    ) % FOLDER_COLORS.length
  const color = FOLDER_COLORS[colorIdx]

  const handleOpen = () => {
    const shortParentId = parentId.includes(':') ? parentId.split(':')[1] : parentId
    const shortChildId = i_Notes.id.includes(':') ? i_Notes.id.split(':')[1] : i_Notes.id
    router.push(`/i_Notes/${shortParentId}/sub/${shortChildId}`)
  }

  return (
    <div
      onClick={handleOpen}
      className="group bg-white rounded-[20px] border border-slate-100/80 shadow-[0_2px_16px_rgba(0,0,0,0.04)] p-5 cursor-pointer transition-all hover:shadow-[0_6px_28px_rgba(0,0,0,0.09)] hover:-translate-y-0.5 relative flex flex-col gap-4"
    >
      {/* Top row: folder icon + menu */}
      <div className="flex items-start justify-between gap-3">
        <div
          className="w-12 h-12 rounded-[14px] flex items-center justify-center shrink-0 shadow-sm"
          style={{
            background: `linear-gradient(135deg, ${color.from} 0%, ${color.to} 100%)`,
          }}
        >
          <FolderOpen className="h-6 w-6 text-white" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onClick={(e) => e.stopPropagation()}
            className="rounded-xl shadow-lg"
          >
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                handleOpen()
              }}
              className="rounded-lg cursor-pointer"
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Open Sub-folder
            </DropdownMenuItem>
            {onUnlink && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onUnlink(i_Notes.id)
                }}
                className="text-red-600 focus:bg-red-50 focus:text-red-700 rounded-lg cursor-pointer"
              >
                <Unlink className="h-4 w-4 mr-2" />
                Remove from folder
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Name & description */}
      <div className="flex-1">
        <h3 className="text-[17px] font-bold text-slate-900 leading-snug tracking-tight line-clamp-1">
          {i_Notes.name}
        </h3>
        {i_Notes.description && (
          <p className="text-[12px] text-slate-500 font-medium mt-1 line-clamp-2 leading-relaxed">
            {i_Notes.description}
          </p>
        )}
      </div>

      {/* Footer meta */}
      <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-400">
        <div className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {i_Notes.source_count} sources
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(i_Notes.updated), {
            addSuffix: true,
            locale: getDateLocale(language),
          })}
        </div>
      </div>

      {/* Colored bottom accent bar */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 h-[3px] rounded-b-[20px] opacity-0 group-hover:opacity-100 transition-opacity',
        )}
        style={{
          background: `linear-gradient(90deg, ${color.from}, ${color.to})`,
        }}
      />
    </div>
  )
}
