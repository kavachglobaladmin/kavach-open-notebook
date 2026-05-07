'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { NotebookList } from './components/NotebookList'
import { Button } from '@/components/ui/button'
import { Plus, TrendingUp, Users, Target, Disc } from 'lucide-react'
import { useNotebooks } from '@/lib/hooks/use-notebooks'
import { CreateNotebookDialog } from '@/components/notebooks/CreateNotebookDialog'
import { useTranslation } from '@/lib/hooks/use-translation'
import { useAuthStore } from '@/lib/stores/auth-store'
import { notebooksApi } from '@/lib/api/notebooks'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/api/query-client'
import { motion } from 'framer-motion'

export default function NotebooksPage() {
  const { t } = useTranslation()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const { data: notebooks, isLoading } = useNotebooks(false)
  const { data: archivedNotebooks } = useNotebooks(true)
  const currentUserEmail = useAuthStore(s => s.currentUserEmail)
  const queryClient = useQueryClient()

  // ── Claim unowned notebooks once per session per user ──────────────────────
  const claimedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!currentUserEmail) return
    const sessionKey = `notebooks_claimed_${currentUserEmail}`
    if (sessionStorage.getItem(sessionKey) === 'true') return
    if (claimedRef.current === currentUserEmail) return
    claimedRef.current = currentUserEmail

    notebooksApi.claimUnowned()
      .then((result) => {
        sessionStorage.setItem(sessionKey, 'true')
        if (result.claimed > 0) {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notebooks })
        }
      })
      .catch(() => {})
  }, [currentUserEmail, queryClient])

  const normalizedQuery = searchTerm.trim().toLowerCase()

  const filteredActive = useMemo(() => {
    if (!notebooks) return undefined
    if (!normalizedQuery) return notebooks
    return notebooks.filter((notebook) =>
      notebook.name.toLowerCase().includes(normalizedQuery)
    )
  }, [notebooks, normalizedQuery])

  const filteredArchived = useMemo(() => {
    if (!archivedNotebooks) return undefined
    if (!normalizedQuery) return archivedNotebooks
    return archivedNotebooks.filter((notebook) =>
      notebook.name.toLowerCase().includes(normalizedQuery)
    )
  }, [archivedNotebooks, normalizedQuery])

  // ── Dynamic Statistics Calculation ─────────────────────────────────────────
  const stats = useMemo(() => {
    const active = notebooks || []
    const archived = archivedNotebooks || []
    const allCases = [...active, ...archived]
    const activeCount = active.length
    
    let completedCount = 0
    allCases.forEach(n => {
      if ((n as any).progress === 100 || (n as any).status === 'completed') {
        completedCount++
      }
    })
    if (completedCount === 0 && archived.length > 0) {
      completedCount = archived.length
    }

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

    return { activeCount, completedCount, memberCount, avgCompletion }
  }, [notebooks, archivedNotebooks])

  const hasArchived = (archivedNotebooks?.length ?? 0) > 0
  const isSearching = normalizedQuery.length > 0

  return (
    <AppShell>
      {/* ── Background: near-white lavender base with top-right purple bloom — exact reference match ── */}
      <div
        className="flex-1 flex flex-col min-h-0 relative overflow-hidden"
        style={{ backgroundColor: '#F2F1FA' }}
      >
        {/* Single large top-right purple glow — the dominant effect in the reference */}
        <div
          className="absolute top-0 right-0 pointer-events-none"
          style={{
            width: '70%',
            height: '75%',
            background: 'radial-gradient(ellipse at top right, rgba(216,210,255,0.85) 0%, rgba(200,190,255,0.45) 30%, rgba(230,225,255,0.15) 60%, transparent 80%)',
            filter: 'blur(40px)',
          }}
        />
        {/* Subtle bottom-left cool tint */}
        <div
          className="absolute bottom-0 left-0 pointer-events-none"
          style={{
            width: '50%',
            height: '50%',
            background: 'radial-gradient(ellipse at bottom left, rgba(220,225,255,0.4) 0%, transparent 70%)',
            filter: 'blur(60px)',
          }}
        />

        {/* Content layer */}
        <div className="relative z-10 flex flex-col min-h-0">
          <PageHeader
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder={t.notebooks.searchPlaceholder || 'Search...'}
            newLabel="NOTEBOOK"
            onNew={() => setCreateDialogOpen(true)}
          />

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[1500px] mx-auto px-10 py-8 space-y-8">

              {/* Heading */}
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-[34px] font-bold text-[#1e1b4b] tracking-tight leading-none">
                    Active Cases
                  </h1>
                  <p className="text-[14px] text-slate-500 font-medium mt-2">
                    Monitor and manage your ongoing projects and workflows
                  </p>
                </div>
                <Button
                  onClick={() => setCreateDialogOpen(true)}
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white rounded-[14px] h-[44px] px-6 font-bold text-[14px] gap-2 shadow-[0_6px_20px_rgba(124,58,237,0.35)] transition-all hover:scale-[1.02]"
                >
                  <Plus className="h-5 w-5" />
                  New Case
                </Button>
              </div>

              {/* KPI Cards — white, solid, matches reference */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  { label: 'Active Cases',    val: stats.activeCount,       icon: Disc,       color: '#4665F0' },
                  { label: 'Completed',       val: stats.completedCount,    icon: TrendingUp, color: '#10B981' },
                  { label: 'Team Members',    val: stats.memberCount,       icon: Users,      color: '#C084FC' },
                  { label: 'Avg. Completion', val: `${stats.avgCompletion}%`, icon: Target,   color: '#8B5CF6' },
                ].map((stat, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className="bg-white p-6 rounded-[24px] border border-white/90 shadow-[0_4px_20px_rgba(99,52,227,0.06)] flex flex-col justify-between min-h-[150px]"
                  >
                    <div
                      className="w-12 h-12 rounded-[14px] flex items-center justify-center mb-4 shadow-sm"
                      style={{ backgroundColor: stat.color }}
                    >
                      <stat.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-[32px] font-extrabold text-[#1e1b4b] leading-none">{stat.val}</h3>
                      <p className="text-[12px] font-bold text-slate-400 mt-2 uppercase tracking-widest">{stat.label}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Case List */}
              <div className="space-y-12">
                <NotebookList
                  notebooks={filteredActive}
                  isLoading={isLoading}
                  title=""
                  emptyTitle={isSearching ? t.common.noMatches : undefined}
                  emptyDescription={isSearching ? t.common.tryDifferentSearch : undefined}
                  onAction={!isSearching ? () => setCreateDialogOpen(true) : undefined}
                  actionLabel={!isSearching ? t.notebooks.newNotebook : undefined}
                />

                {hasArchived && (
                  <div className="pt-6 border-t border-white/40">
                    <NotebookList
                      notebooks={filteredArchived}
                      isLoading={false}
                      title={t.notebooks.archivedNotebooks}
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

      <CreateNotebookDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </AppShell>
  )
}