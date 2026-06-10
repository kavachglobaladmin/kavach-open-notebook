'use client'

import { i_NotesResponse } from '@/lib/types/api'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { EmptyState } from '@/components/common/EmptyState'
import { Book, ChevronDown, ChevronRight, Plus, MoreVertical, Archive, ArchiveRestore, Trash2, Users, User, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { useTranslation } from '@/lib/hooks/use-translation'
import { useRouter } from 'next/navigation'
import { useUpdatei_Notes } from '@/lib/hooks/use-i_Notes'
import { useAuthStore } from '@/lib/stores/auth-store'
import { hasRoleAccess } from '@/lib/auth/roles'
import { I_NotesDeleteDialog } from './i_NotesDeleteDialog'
import { I_NotesAccessDialog } from './i_NotesAccessDialog'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface I_NotesListProps {
  i_Notes?: i_NotesResponse[]
  isLoading: boolean
  title: string
  collapsible?: boolean
  emptyTitle?: string
  emptyDescription?: string
  onAction?: () => void
  actionLabel?: string
}

// Consistent mock helpers based on case ID
const getCaseCode = (id: string) => {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  const code = Math.abs(hash % 9000) + 1000
  return `INV-${code}`
}

const getAssignee = (id: string) => {
  const assignees = [
    'Sarah Johnson',
    'Mike Chen',
    'Emily Rodriguez',
    'David Kim',
    'Lisa Thompson',
    'James Wilson',
    'Maria Garcia',
    'Robert Brown'
  ]
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return assignees[Math.abs(hash) % assignees.length]
}

const getTeam = (id: string) => {
  const teams = ['Finance Team', 'Cyber Crime', 'Operations', 'Investigation', 'HR Team', 'Legal']
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return teams[Math.abs(hash) % teams.length]
}

const getPriority = (id: string) => {
  const priorities = ['High', 'Critical', 'Medium', 'Low']
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return priorities[Math.abs(hash) % priorities.length]
}

const getStatus = (caseItem: i_NotesResponse) => {
  if (caseItem.archived) return 'Review'
  const statuses = ['Active', 'Pending', 'Active', 'Active']
  let hash = 0
  for (let i = 0; i < caseItem.id.length; i++) {
    hash = caseItem.id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return statuses[Math.abs(hash) % statuses.length]
}

const getProgress = (caseItem: i_NotesResponse) => {
  const hasLimit = caseItem.storage_limit_mb != null && caseItem.storage_limit_mb > 0
  if (hasLimit) {
    const usedMb = caseItem.storage_used_mb ?? 0
    const limitMb = caseItem.storage_limit_mb ?? 100
    return Math.min(Math.round((usedMb / limitMb) * 100), 100)
  }
  const progresses = [65, 82, 45, 30, 58, 90, 40, 75]
  let hash = 0
  for (let i = 0; i < caseItem.id.length; i++) {
    hash = caseItem.id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return progresses[Math.abs(hash) % progresses.length]
}

const getDueDate = (id: string) => {
  const dueDates = ['Jun 15, 2026', 'Jun 12, 2026', 'Jun 20, 2026', 'Jun 25, 2026', 'Jun 18, 2026', 'Jun 16, 2026', 'Jun 22, 2026', 'Jun 10, 2026']
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash)
  }
  return dueDates[Math.abs(hash) % dueDates.length]
}

function CaseTableRow({ caseItem }: { caseItem: i_NotesResponse }) {
  const router = useRouter()
  const { t } = useTranslation()
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showAccessDialog, setShowAccessDialog] = useState(false)
  const updatei_Notes = useUpdatei_Notes()
  const currentUserRole = useAuthStore(s => s.currentUserRole)
  const currentUserEmail = useAuthStore(s => s.currentUserEmail)
  const canManageAccess = hasRoleAccess(currentUserRole, 'admin')

  const caseCode = getCaseCode(caseItem.id)
  const assignee = getAssignee(caseItem.id)
  const team = getTeam(caseItem.id)
  const priority = getPriority(caseItem.id)
  const status = getStatus(caseItem)
  const progress = getProgress(caseItem)
  const dueDate = getDueDate(caseItem.id)

  const handleRowClick = () => {
    const shortId = caseItem.id.includes(':') ? caseItem.id.split(':')[1] : caseItem.id
    router.push(`/i_Notes/${shortId}`)
  }

  const handleArchiveToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    updatei_Notes.mutate({ id: caseItem.id, data: { archived: !caseItem.archived } })
  }

  return (
    <>
      <tr 
        onClick={handleRowClick}
        className="hover:bg-slate-50/50 transition-colors cursor-pointer border-b border-slate-100"
      >
        <td className="px-6 py-4 font-bold text-[#00B074] whitespace-nowrap text-[14px]">{caseCode}</td>
        <td className="px-6 py-4 font-bold text-slate-900 whitespace-nowrap text-[14px]">{caseItem.name}</td>
        <td className="px-6 py-4 text-slate-700 whitespace-nowrap text-[14px]">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{assignee}</span>
          </div>
        </td>
        <td className="px-6 py-4 text-slate-500 whitespace-nowrap text-[14px]">{team}</td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={cn(
            "inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold",
            priority === 'Critical' && "bg-[#FEE2E2] text-[#EF4444]",
            priority === 'High'     && "bg-[#FEF3C7] text-[#D97706]",
            priority === 'Medium'   && "bg-[#DBEAFE] text-[#2563EB]",
            priority === 'Low'      && "bg-[#F1F5F9] text-[#64748B]"
          )}>
            {priority}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <span className={cn(
            "inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold",
            status === 'Active'  && "bg-[#ECFDF5] text-[#10B981]",
            status === 'Pending' && "bg-[#FFFBEB] text-[#D97706]",
            status === 'Review'  && "bg-[#F5F3FF] text-[#7C3AED]"
          )}>
            {status}
          </span>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-2 min-w-[100px]">
            <div className="relative h-1.5 w-16 rounded-full bg-slate-100 overflow-hidden shrink-0">
              <div 
                className="absolute left-0 top-0 h-full rounded-full bg-[#10B981] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="font-semibold text-slate-700 text-[12px]">{progress}%</span>
          </div>
        </td>
        <td className="px-6 py-4 text-slate-500 whitespace-nowrap text-[14px]">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <span>{dueDate}</span>
          </div>
        </td>
        <td className="px-6 py-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:bg-slate-50 rounded-full h-8 w-8 shrink-0 focus:outline-none"
              >
                <MoreVertical className="h-[17px] w-[17px]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl shadow-lg">
              <DropdownMenuItem onClick={handleArchiveToggle} className="rounded-lg cursor-pointer">
                {caseItem.archived ? (
                  <><ArchiveRestore className="h-4 w-4 mr-2" />{t.i_Notes.unarchive}</>
                ) : (
                  <><Archive className="h-4 w-4 mr-2" />{t.i_Notes.archive}</>
                )}
              </DropdownMenuItem>
              {canManageAccess && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowAccessDialog(true)}
                    className="rounded-lg cursor-pointer text-[#8A2BE2] focus:bg-purple-50 focus:text-[#7A26C9]"
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Manage Access
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                onClick={() => setShowDeleteDialog(true)}
                className="text-red-600 focus:bg-red-50 focus:text-red-700 rounded-lg cursor-pointer"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t.common.delete}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </td>
      </tr>

      <I_NotesDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        i_NotesId={caseItem.id}
        i_NotesName={caseItem.name}
      />

      {canManageAccess && (
        <I_NotesAccessDialog
          open={showAccessDialog}
          onOpenChange={setShowAccessDialog}
          i_NotesId={caseItem.id.includes(':') ? caseItem.id.split(':')[1] : caseItem.id}
          i_NotesName={caseItem.name}
          currentUserEmail={currentUserEmail ?? ''}
          currentUserRole={currentUserRole ?? 'user'}
        />
      )}
    </>
  )
}

export function I_NotesList({ 
  i_Notes, 
  isLoading, 
  title, 
  collapsible = false,
  emptyTitle,
  emptyDescription,
  onAction,
  actionLabel,
}: I_NotesListProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(!collapsible)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!i_Notes || i_Notes.length === 0) {
    return (
      <EmptyState
        icon={Book}
        title={emptyTitle ?? t.common.noResults}
        description={emptyDescription ?? "Start by creating your first i_Notes to organize your research."}
        action={onAction && actionLabel ? (
          <Button 
            onClick={onAction} 
            className="mt-4 bg-[#F1F5F9] hover:bg-slate-200 text-slate-800 rounded-md px-4 py-2 border-0 flex items-center gap-1.5 font-semibold text-[13px] shadow-sm select-none cursor-pointer"
          >
            <Plus className="h-4 w-4 shrink-0" />
            {actionLabel}
          </Button>
        ) : undefined}
      />
    )
  }

  const totalPages = Math.ceil(i_Notes.length / itemsPerPage)
  const paginatedItems = i_Notes.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center gap-2">
          {collapsible && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
          <h2 className="text-lg font-semibold">{title}</h2>
          <span className="text-sm text-muted-foreground">({i_Notes.length})</span>
        </div>
      )}

      {isExpanded && (
        <div className="bg-white rounded-[20px] shadow-[0_2px_16px_rgba(0,0,0,0.03)] border border-slate-100/80 overflow-hidden w-full">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[12px] font-semibold text-slate-400 uppercase tracking-wider select-none">
                  <th className="px-6 py-4">Case ID</th>
                  <th className="px-6 py-4">Case Name</th>
                  <th className="px-6 py-4">Assignee</th>
                  <th className="px-6 py-4">Team</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Progress</th>
                  <th className="px-6 py-4">Due Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[14px]">
                {paginatedItems.map((caseItem) => (
                  <CaseTableRow key={caseItem.id} caseItem={caseItem} />
                ))}
              </tbody>
            </table>
          </div>

          {i_Notes.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 bg-white select-none">
              <span className="text-[13px] font-semibold text-slate-400">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, i_Notes.length)} of {i_Notes.length} cases
              </span>
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 text-[13px] h-9 px-3"
                  >
                    Previous
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className={cn(
                        "rounded-lg text-[13px] h-9 w-9 p-0 font-bold",
                        currentPage === page 
                          ? "bg-[#00B074] hover:bg-[#009662] text-white" 
                          : "border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50 text-[13px] h-9 px-3"
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
