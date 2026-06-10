'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { I_NotesList } from './components/i_NotesList'
import { Button } from '@/components/ui/button'
import { Plus, TrendingUp, Users, Target, Disc, Folder, Search } from 'lucide-react'
import { usei_Notes } from '@/lib/hooks/use-i_Notes'
import { Createi_NotesDialog } from '@/components/i_Notes/Createi_NotesDialog'
import { useTranslation } from '@/lib/hooks/use-translation'
import { useAuthStore } from '@/lib/stores/auth-store'
import { i_NotesApi } from '@/lib/api/i_Notes'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/api/query-client'
import { motion } from 'framer-motion'
import { getAllChildIds } from '@/lib/hooks/use-sub-folders'
import { cn } from '@/lib/utils'

// Consistent mock helpers matching i_NotesList.tsx for search filtering
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

export default function i_NotesPage() {
  const { t } = useTranslation()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const { data: i_Notes, isLoading } = usei_Notes(false)
  const { data: archivedi_Notes } = usei_Notes(true)
  const currentUserEmail = useAuthStore(s => s.currentUserEmail)
  const queryClient = useQueryClient()

  // ── Claim unowned i_Notes once per session per user ──────────────────────
  const claimedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!currentUserEmail) return
    const sessionKey = `i_Notes_claimed_${currentUserEmail}`
    if (sessionStorage.getItem(sessionKey) === 'true') return
    if (claimedRef.current === currentUserEmail) return
    claimedRef.current = currentUserEmail

    i_NotesApi.claimUnowned()
      .then((result) => {
        sessionStorage.setItem(sessionKey, 'true')
        if (result.claimed > 0) {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.i_Notes })
        }
      })
      .catch(() => {})
  }, [currentUserEmail, queryClient])

  const normalizedQuery = searchTerm.trim().toLowerCase()

  // ── Exclude sub-folders from the top-level Cases list ───────────────────
  // getAllChildIds reads from localStorage synchronously so it's safe in useMemo.
  const childIdsSet = useMemo(() => getAllChildIds(), [
    // Re-compute whenever the i_Notes list changes (new sub-folder created
    // writes to localStorage, then React Query re-fetches the i_Notes list).
    i_Notes,
    archivedi_Notes,
  ])

  const filteredActive = useMemo(() => {
    if (!i_Notes) return undefined
    const topLevel = i_Notes.filter((nb) => !childIdsSet.has(nb.id))
    if (!normalizedQuery) return topLevel
    return topLevel.filter((i_Notes) => {
      const nameMatch = i_Notes.name.toLowerCase().includes(normalizedQuery)
      const codeMatch = getCaseCode(i_Notes.id).toLowerCase().includes(normalizedQuery)
      const assigneeMatch = getAssignee(i_Notes.id).toLowerCase().includes(normalizedQuery)
      return nameMatch || codeMatch || assigneeMatch
    })
  }, [i_Notes, normalizedQuery, childIdsSet])

  const filteredArchived = useMemo(() => {
    if (!archivedi_Notes) return undefined
    const topLevel = archivedi_Notes.filter((nb) => !childIdsSet.has(nb.id))
    if (!normalizedQuery) return topLevel
    return topLevel.filter((i_Notes) => {
      const nameMatch = i_Notes.name.toLowerCase().includes(normalizedQuery)
      const codeMatch = getCaseCode(i_Notes.id).toLowerCase().includes(normalizedQuery)
      const assigneeMatch = getAssignee(i_Notes.id).toLowerCase().includes(normalizedQuery)
      return nameMatch || codeMatch || assigneeMatch
    })
  }, [archivedi_Notes, normalizedQuery, childIdsSet])

  // ── Dynamic Statistics Calculation ─────────────────────────────────────────
  const stats = useMemo(() => {
    // Only count top-level i_Notes (exclude sub-folders) in stats
    const active = (i_Notes || []).filter((nb) => !childIdsSet.has(nb.id))
    const archived = (archivedi_Notes || []).filter((nb) => !childIdsSet.has(nb.id))
    const allCases = [...active, ...archived]
    const activeCount = active.length
    const totalCount = allCases.length
    
    let completedCount = 0
    allCases.forEach(n => {
      if ((n as any).progress === 100 || (n as any).status === 'completed') {
        completedCount++
      }
    })
    if (completedCount === 0 && archived.length > 0) {
      completedCount = archived.length
    }

    const getPriorityLocal = (id: string) => {
      const priorities = ['High', 'Critical', 'Medium', 'Low']
      let hash = 0
      for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash)
      }
      return priorities[Math.abs(hash) % priorities.length]
    }

    const getDueDateLocal = (id: string) => {
      const dueDates = ['Jun 15, 2026', 'Jun 12, 2026', 'Jun 20, 2026', 'Jun 25, 2026', 'Jun 18, 2026', 'Jun 16, 2026', 'Jun 22, 2026', 'Jun 10, 2026']
      let hash = 0
      for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash)
      }
      return dueDates[Math.abs(hash) % dueDates.length]
    }

    const highPriorityCount = active.filter(c => ['High', 'Critical'].includes(getPriorityLocal(c.id))).length
    const dueThisWeekCount = active.filter(c => ['Jun 10, 2026', 'Jun 12, 2026', 'Jun 15, 2026', 'Jun 16, 2026'].includes(getDueDateLocal(c.id))).length

    const uniqueMembers = new Set()
    let hasMembersData = false
    allCases.forEach(n => {
      if (Array.isArray((n as any).members)) {
        hasMembersData = true
        ;(n as any).members.forEach((m: any) => uniqueMembers.add(typeof m === 'object' ? m.id || JSON.stringify(m) : m))
      }
    })
    const memberCount = hasMembersData 
      ? uniqueMembers.size 
      : (activeCount > 0 ? activeCount * 2 + 3 : 0)

    let totalProgress = 0
    let progressCount = 0
    active.forEach(n => {
      if (typeof (n as any).progress === 'number') {
        totalProgress += (n as any).progress
        progressCount++
      }
    })
    const avgCompletion = progressCount > 0 
      ? Math.round(totalProgress / progressCount) 
      : (activeCount > 0 ? 78 : 0)

    return { totalCount, activeCount, completedCount, memberCount, avgCompletion, highPriorityCount, dueThisWeekCount }
  }, [i_Notes, archivedi_Notes, childIdsSet])

  const hasArchived = (archivedi_Notes?.length ?? 0) > 0
  const isSearching = normalizedQuery.length > 0

  return (
    <AppShell>
      {/* ── Background: Clean slate/gray background ── */}
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-[#F8FAFC]">
        
        {/* Content Layer */}
        <div className="relative z-10 flex flex-col min-h-0">
          <PageHeader
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder={t.i_Notes.searchPlaceholder || 'Search...'}
            newLabel="i_Notes"
            onNew={() => setCreateDialogOpen(true)}
            hideNew={true}
          />

          <div className="flex-1 overflow-y-auto">
            <div className="w-full pl-4 md:pl-5 pr-4 md:pr-8 py-6 sm:py-8 space-y-6 sm:space-y-8">

              {/* ── Heading ── */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-[12px] bg-[#EAFBF3] text-[#00B074] flex items-center justify-center shrink-0">
                    <Folder className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <h2 className="text-[24px] font-bold text-slate-900 tracking-tight leading-none">
                      Cases Management
                    </h2>
                    <p className="text-[14px] text-slate-400 font-medium mt-1.5">
                      Track and manage all investigation cases
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  className="bg-[#00B074] hover:bg-[#009662] text-white rounded-md px-6 h-11 flex items-center gap-2 font-bold text-[14px] shadow-sm transition-colors border-0 self-start sm:self-auto shrink-0 select-none"
                >
                  <Plus className="w-4 h-4" />
                  Create Case
                </Button>
              </div>

              {/* ── KPI Cards — styled to match screenshot exactly ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  { label: 'Total Cases',     val: stats.totalCount,       trend: `↑ 8% from last month`, trendColor: 'text-[#10B981]' },
                  { label: 'Active Cases',    val: stats.activeCount,      trend: `${stats.totalCount > 0 ? (stats.activeCount / stats.totalCount * 100).toFixed(1) : 0}% of total`, trendColor: 'text-[#3B82F6]' },
                  { label: 'Completed',       val: stats.completedCount,   trend: `${stats.totalCount > 0 ? (stats.completedCount / stats.totalCount * 100).toFixed(1) : 0}% completion rate`, trendColor: 'text-[#10B981]' },
                  { label: 'Due This Week',   val: stats.dueThisWeekCount, trend: `${stats.highPriorityCount} high priority`, trendColor: 'text-[#F59E0B]' },
                ].map((stat, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.07 }}
                    className="bg-white rounded-[16px] p-6 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.03)] border border-slate-100/80 text-left"
                  >
                    <div>
                      <p className="text-[13px] sm:text-[14px] font-medium text-slate-400">{stat.label}</p>
                      <h3 className="text-[32px] sm:text-[36px] font-bold text-slate-900 leading-none mt-2">{stat.val.toLocaleString()}</h3>
                    </div>
                    <p className={cn("text-[13px] sm:text-[14px] font-semibold mt-4", stat.trendColor)}>
                      {stat.trend}
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* ── Search and Filter Toolbar ── */}
              <div className="flex flex-col sm:flex-row gap-3 items-center w-full">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search cases by ID, name, or assignee..."
                    className="pl-12 pr-4 h-[48px] w-full bg-white border border-slate-200 rounded-[10px] text-[15px] placeholder:text-slate-400 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#00B074]/20 focus:border-[#00B074] transition-all"
                  />
                </div>
                <Button
                  variant="outline"
                  className="bg-white border border-slate-200 text-slate-700 rounded-[10px] px-5 h-[48px] flex items-center gap-2 font-bold text-[14px] hover:bg-slate-50 transition-colors shadow-sm shrink-0 w-full sm:w-auto"
                >
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 8.293A1 1 0 013 7.586V4z" />
                  </svg>
                  Filters
                </Button>
              </div>

              {/* ── Case List ── */}
              <div className="space-y-10">
                <I_NotesList
                  i_Notes={filteredActive}
                  isLoading={isLoading}
                  title=""
                  emptyTitle={isSearching ? t.common.noMatches : "No Cases found"}
                  emptyDescription={isSearching ? t.common.tryDifferentSearch : ""}
                />

                {hasArchived && (
                  <div className="pt-6 border-t border-slate-200/40">
                    <I_NotesList
                      i_Notes={filteredArchived}
                      isLoading={false}
                      title={t.i_Notes.archivedi_Notes}
                      collapsible
                      emptyTitle={isSearching ? t.common.noMatches : undefined}
                      emptyDescription={isSearching ? t.common.tryDifferentSearch : undefined}
                    />
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

      <Createi_NotesDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </AppShell>
  )
}
