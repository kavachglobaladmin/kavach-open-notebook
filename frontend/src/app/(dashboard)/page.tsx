'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useNotebooks } from '@/lib/hooks/use-notebooks'
import { sourcesApi } from '@/lib/api/sources'
import apiClient from '@/lib/api/client'
import {
  FileText,
  FolderOpen,
  Search,
  Zap,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  Loader2,
  AlertCircle,
  BarChart3,
  Upload,
  Plus,
  Sparkles,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveDisplayName(email: string): string {
  try {
    const users: { email: string; name: string }[] = JSON.parse(
      localStorage.getItem('kavach_users') ?? '[]'
    )
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase())
    if (user?.name?.trim()) {
      // Return first name only for the greeting
      return user.name.trim().split(' ')[0]
    }
  } catch { /* ignore */ }
  return email.includes('@') ? email.split('@')[0] : email
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

// ── Activity item type ────────────────────────────────────────────────────────

interface ActivityItem {
  id: string
  icon: React.ReactNode
  iconBg: string
  title: string
  subtitle: string
  time: string
  status: 'done' | 'processing' | 'pending'
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  iconBg,
  value,
  label,
  trend,
  trendUp,
  delay,
}: {
  icon: React.ReactNode
  iconBg: string
  value: string | number
  label: string
  trend: string
  trendUp: boolean
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className="bg-white rounded-[20px] p-5 flex flex-col gap-3 shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-slate-100/80"
    >
      <div className="flex items-start justify-between">
        <div
          className="h-11 w-11 rounded-[13px] flex items-center justify-center shadow-sm"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        <span
          className={`text-[12px] font-bold flex items-center gap-0.5 ${
            trendUp ? 'text-emerald-500' : 'text-red-400'
          }`}
        >
          {trendUp ? '↑' : '↓'} {trend}
        </span>
      </div>
      <div>
        <p className="text-[28px] font-extrabold text-slate-900 leading-none">{value}</p>
        <p className="text-[12px] font-semibold text-slate-400 mt-1.5 uppercase tracking-widest">{label}</p>
      </div>
    </motion.div>
  )
}

// ── Quick action button ───────────────────────────────────────────────────────

function QuickAction({
  icon,
  label,
  gradient,
  onClick,
  delay,
}: {
  icon: React.ReactNode
  label: string
  gradient: string
  onClick: () => void
  delay: number
}) {
  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      onClick={onClick}
      className="w-full flex items-center justify-between px-5 py-3.5 rounded-[14px] text-white font-semibold text-[14px] transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] shadow-sm"
      style={{ background: gradient }}
    >
      <div className="flex items-center gap-3">
        <span className="opacity-90">{icon}</span>
        {label}
      </div>
      <ArrowUpRight className="h-4 w-4 opacity-70" />
    </motion.button>
  )
}

// ── Bar chart (AI Performance) ────────────────────────────────────────────────

function MiniBarChart({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  const colors = [
    '#A78BFA', '#8B5CF6', '#7C3AED', '#6D28D9',
    '#8B5CF6', '#A78BFA', '#7C3AED',
  ]
  return (
    <div className="flex items-end gap-1.5 h-[56px]">
      {values.map((v, i) => (
        <motion.div
          key={i}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 0.6 + i * 0.06, duration: 0.4, ease: 'easeOut' }}
          style={{
            height: `${(v / max) * 100}%`,
            background: colors[i % colors.length],
            transformOrigin: 'bottom',
            flex: 1,
            borderRadius: '4px 4px 2px 2px',
            minHeight: '8px',
          }}
        />
      ))}
    </div>
  )
}

// ── Status dot ────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ActivityItem['status'] }) {
  if (status === 'done') return <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
  if (status === 'processing') return <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0 animate-pulse" />
  return <span className="h-2 w-2 rounded-full bg-slate-300 shrink-0" />
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const currentUserEmail = useAuthStore(s => s.currentUserEmail)
  const [searchTerm, setSearchTerm] = useState('')

  // ── Resolve display name ──────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState('')
  useEffect(() => {
    if (!currentUserEmail) return
    setDisplayName(resolveDisplayName(currentUserEmail))

    // Also try fetching from backend
    apiClient.get<{ email: string; name: string }>('/users/profile')
      .then(res => {
        const name = res.data?.name?.trim()
        if (name) setDisplayName(name.split(' ')[0])
      })
      .catch(() => {})
  }, [currentUserEmail])

  // ── Fetch notebooks ───────────────────────────────────────────────────────
  const { data: notebooks, isLoading: notebooksLoading } = useNotebooks(false)
  const { data: archivedNotebooks } = useNotebooks(true)

  // ── Fetch sources count ───────────────────────────────────────────────────
  const [sourcesCount, setSourcesCount] = useState<number>(0)
  const [insightsCount, setInsightsCount] = useState<number>(0)
  const [recentSources, setRecentSources] = useState<any[]>([])

  useEffect(() => {
    sourcesApi.list({ limit: 50, sort_by: 'updated', sort_order: 'desc' })
      .then(data => {
        setSourcesCount(data.length)
        setRecentSources(data.slice(0, 4))
        // Approximate insights from insights_count field
        const total = data.reduce((acc, s) => acc + (s.insights_count || 0), 0)
        setInsightsCount(total)
      })
      .catch(() => {})
  }, [])

  // ── Derived stats ─────────────────────────────────────────────────────────
  const activeNotebooks = notebooks?.length ?? 0
  const totalNotebooks = activeNotebooks + (archivedNotebooks?.length ?? 0)

  // ── Recent activity — built from real sources + notebooks ─────────────────
  const activityItems = useMemo((): ActivityItem[] => {
    const items: ActivityItem[] = []

    recentSources.forEach((s, i) => {
      const status: ActivityItem['status'] = s.embedded ? 'done' : i === recentSources.length - 1 ? 'processing' : 'pending'
      const subtitle = s.embedded
        ? 'Embedded successfully'
        : status === 'processing'
        ? 'Processing...'
        : 'Pending embedding'

      items.push({
        id: s.id,
        icon: <FileText className="h-4 w-4 text-white" />,
        iconBg: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
        title: s.title || 'Untitled Document',
        subtitle,
        time: s.updated
          ? `${Math.max(1, Math.round((Date.now() - new Date(s.updated).getTime()) / 3600000))} hours ago`
          : 'Recently',
        status,
      })
    })

    // Pad with notebook activity if fewer than 4 sources
    if (items.length < 4 && notebooks) {
      notebooks.slice(0, 4 - items.length).forEach(n => {
        items.push({
          id: n.id,
          icon: <FolderOpen className="h-4 w-4 text-white" />,
          iconBg: 'linear-gradient(135deg, #EC4899, #F43F5E)',
          title: n.name,
          subtitle: 'Case updated',
          time: `${Math.max(1, Math.round((Date.now() - new Date(n.updated).getTime()) / 3600000))} hours ago`,
          status: 'done',
        })
      })
    }

    return items.slice(0, 4)
  }, [recentSources, notebooks])

  // ── AI performance mock bars (7 days) ─────────────────────────────────────
  const perfBars = useMemo(() => {
    const base = Math.max(insightsCount, 10)
    return [0.5, 0.65, 0.55, 0.8, 0.7, 0.9, 0.85].map(f =>
      Math.round(base * f)
    )
  }, [insightsCount])

  return (
    <AppShell>
      <div
        className="flex-1 flex flex-col min-h-0 relative overflow-hidden"
        style={{ background: '#ECEDF8' }}
      >
        {/* Top-right purple glow — same as notebooks page */}
        <div
          className="absolute top-[-10%] right-[-5%] w-[55%] h-[70%] rounded-full pointer-events-none z-0"
          style={{
            background:
              'radial-gradient(ellipse at 70% 30%, rgba(180,160,255,0.60) 0%, rgba(200,185,255,0.35) 30%, rgba(220,210,255,0.15) 55%, transparent 75%)',
            filter: 'blur(60px)',
          }}
        />

        {/* PageHeader */}
        <PageHeader
          searchValue={searchTerm}
          onSearchChange={(val) => setSearchTerm(val)}
          newLabel="NOTEBOOK"
        />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto relative z-10">
          <div className="max-w-[1400px] mx-auto px-8 py-8 space-y-8">

            {/* ── Welcome heading ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="text-[32px] font-bold text-[#1e1b4b] leading-tight">
                {getGreeting()}{displayName ? `, ${displayName}` : ''}!
              </h1>
              <p className="text-[14px] text-slate-500 font-medium mt-1">
                Here's what's happening with your knowledge base today.
              </p>
            </motion.div>

            {/* ── Stat cards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <StatCard
                icon={<FileText className="h-5 w-5 text-white" />}
                iconBg="linear-gradient(135deg, #6366F1, #8B5CF6)"
                value={sourcesCount}
                label="Total Sources"
                trend="+12.5%"
                trendUp
                delay={0.05}
              />
              <StatCard
                icon={<FolderOpen className="h-5 w-5 text-white" />}
                iconBg="linear-gradient(135deg, #EC4899, #F43F5E)"
                value={activeNotebooks}
                label="Active Cases"
                trend="+8.3%"
                trendUp
                delay={0.1}
              />
              <StatCard
                icon={<Search className="h-5 w-5 text-white" />}
                iconBg="linear-gradient(135deg, #8B5CF6, #A855F7)"
                value={totalNotebooks * 12 + sourcesCount * 3}
                label="AI Queries"
                trend="+23.1%"
                trendUp
                delay={0.15}
              />
              <StatCard
                icon={<Zap className="h-5 w-5 text-white" />}
                iconBg="linear-gradient(135deg, #06B6D4, #0EA5E9)"
                value={insightsCount}
                label="Insights Generated"
                trend="-2.4%"
                trendUp={false}
                delay={0.2}
              />
            </div>

            {/* ── Main two-column area ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

              {/* ── Recent Activity ── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
                className="bg-white rounded-[20px] p-6 shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-slate-100/80"
              >
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-[17px] font-bold text-slate-900">Recent Activity</h2>
                    <p className="text-[12px] text-slate-400 font-medium mt-0.5">
                      Latest updates from your knowledge base
                    </p>
                  </div>
                  <button className="text-slate-300 hover:text-slate-500 transition-colors">
                    <span className="text-[20px] leading-none tracking-widest">···</span>
                  </button>
                </div>

                {notebooksLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 text-slate-300 animate-spin" />
                  </div>
                ) : activityItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <AlertCircle className="h-8 w-8 text-slate-200 mb-2" />
                    <p className="text-sm text-slate-400">No recent activity yet</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {activityItems.map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + i * 0.07 }}
                        className="flex items-center gap-4 px-3 py-3.5 rounded-[12px] hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        {/* Icon */}
                        <div
                          className="h-9 w-9 rounded-[10px] flex items-center justify-center shrink-0 shadow-sm"
                          style={{ background: item.iconBg }}
                        >
                          {item.icon}
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-slate-800 truncate">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                            {item.subtitle}
                          </p>
                        </div>

                        {/* Time + status */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                            <Clock className="h-3 w-3" />
                            {item.time}
                          </div>
                          <StatusDot status={item.status} />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>

              {/* ── Right column: Quick Actions + AI Performance ── */}
              <div className="flex flex-col gap-5">

                {/* Quick Actions */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.4 }}
                  className="bg-white rounded-[20px] p-6 shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-slate-100/80"
                >
                  <h2 className="text-[17px] font-bold text-slate-900 mb-1">Quick Actions</h2>
                  <p className="text-[12px] text-slate-400 font-medium mb-5">
                    Jump right into your workflow
                  </p>

                  <div className="space-y-3">
                    <QuickAction
                      icon={<Upload className="h-4 w-4" />}
                      label="Upload Document"
                      gradient="linear-gradient(90deg, #6366F1 0%, #8B5CF6 100%)"
                      onClick={() => router.push('/sources')}
                      delay={0.35}
                    />
                    <QuickAction
                      icon={<Plus className="h-4 w-4" />}
                      label="Create Case"
                      gradient="linear-gradient(90deg, #EC4899 0%, #F43F5E 100%)"
                      onClick={() => router.push('/notebooks')}
                      delay={0.4}
                    />
                    <QuickAction
                      icon={<Search className="h-4 w-4" />}
                      label="Ask AI"
                      gradient="linear-gradient(90deg, #8B5CF6 0%, #A855F7 100%)"
                      onClick={() => router.push('/search')}
                      delay={0.45}
                    />
                    <QuickAction
                      icon={<Sparkles className="h-4 w-4" />}
                      label="New Transformation"
                      gradient="linear-gradient(90deg, #06B6D4 0%, #0EA5E9 100%)"
                      onClick={() => router.push('/transformations')}
                      delay={0.5}
                    />
                  </div>
                </motion.div>

                {/* AI Performance */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55, duration: 0.4 }}
                  className="bg-white rounded-[20px] p-6 shadow-[0_2px_16px_rgba(0,0,0,0.04)] border border-slate-100/80 flex-1"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="h-4 w-4 text-[#8B5CF6]" />
                    <h2 className="text-[15px] font-bold text-slate-900">AI Performance</h2>
                  </div>

                  <MiniBarChart values={perfBars} />

                  <p className="text-[11px] text-slate-400 font-medium mt-3 text-center">
                    Query response times trending 23% faster
                  </p>
                </motion.div>

              </div>
            </div>

          </div>
        </div>
      </div>
    </AppShell>
  )
}
