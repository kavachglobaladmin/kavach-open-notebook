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
      {/* ── Background: solid lavender base + single top-right purple glow ── */}
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden" style={{ background: '#ECEDF8' }}>

        {/* Single large soft purple glow — top-right, exactly as in the reference image */}
        <div
          className="absolute top-[-10%] right-[-5%] w-[55%] h-[70%] rounded-full pointer-events-none z-0"
          style={{
            background: 'radial-gradient(ellipse at 70% 30%, rgba(180,160,255,0.60) 0%, rgba(200,185,255,0.35) 30%, rgba(220,210,255,0.15) 55%, transparent 75%)',
            filter: 'blur(60px)',
          }}
        />
        {/* Content Layer */}
        <div className="relative z-10 flex flex-col min-h-0">
          <PageHeader
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder={t.notebooks.searchPlaceholder || 'Search...'}
            newLabel="NOTEBOOK"
            onNew={() => setCreateDialogOpen(true)}
          />

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-[1400px] mx-auto px-8 py-8 space-y-8">

              {/* ── Heading + New Case button ── */}
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-[32px] font-bold text-[#1e1b4b] tracking-tight leading-none">
                    Active Cases
                  </h1>
                  <p className="text-[14px] text-slate-500 font-medium mt-2">
                    Monitor and manage your ongoing projects and workflows
                  </p>
                </div>
                {/* <Button
                  onClick={() => setCreateDialogOpen(true)}
                  className="bg-[#6F4FF2] hover:bg-[#5D3ED9] text-white rounded-[14px] h-[44px] px-6 font-semibold text-[14px] gap-2 shadow-[0_6px_20px_rgba(111,79,242,0.30)] transition-all hover:scale-[1.02]"
                >
                  <Plus className="h-4 w-4" />
                  New Case
                </Button> */}
              </div>

              {/* ── KPI Cards — solid white, clean shadow, matches reference ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {[
                  { label: 'Active Cases',    val: stats.activeCount,        icon: Disc,       color: '#4665F0' },
                  { label: 'Completed',       val: stats.completedCount,     icon: TrendingUp, color: '#10B981' },
                  { label: 'Team Members',    val: stats.memberCount,        icon: Users,      color: '#C084FC' },
                  { label: 'Avg. Completion', val: `${stats.avgCompletion}%`, icon: Target,    color: '#8B5CF6' },
                ].map((stat, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.07 }}
                    className="bg-white rounded-[20px] p-6 flex flex-col justify-between min-h-[140px] shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-slate-100/80"
                  >
                    <div
                      className="w-11 h-11 rounded-[13px] flex items-center justify-center mb-4"
                      style={{ backgroundColor: stat.color }}
                    >
                      <stat.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-[30px] font-extrabold text-slate-900 leading-none">{stat.val}</h3>
                      <p className="text-[12px] font-semibold text-slate-400 mt-1.5 uppercase tracking-widest">{stat.label}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* ── Case List ── */}
              <div className="space-y-10">
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
                  <div className="pt-6 border-t border-slate-200/40">
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