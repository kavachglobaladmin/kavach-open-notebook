'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { useNotebooks } from '@/lib/hooks/use-notebooks'
import { useAuthStore } from '@/lib/stores/auth-store'
import { sourcesApi } from '@/lib/api/sources'
import { useQuery } from '@tanstack/react-query'
import { motion, Variants } from 'framer-motion'
import {
  FileText,
  FolderOpen,
  Sparkles,
  Zap,
  Upload,
  Search,
  ArrowUpRight,
  Clock,
  TrendingUp,
  Briefcase,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

// ── Bar chart for AI Performance ─────────────────────────────────────────────
const BAR_GRADIENT = 'linear-gradient(180deg, #8B5CF6 0%, #C084FC 100%)'

function AiPerformanceChart({ heights }: { heights: number[] }) {
  return (
    <div className="flex items-end gap-[8px] h-[80px] w-full px-2">
      {heights.map((h, i) => (
        <motion.div
          key={i}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: `${h}%`, opacity: 1 }}
          transition={{ delay: 0.1 * i, duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
          className="flex-1 rounded-t-[6px]"
          style={{ background: BAR_GRADIENT }}
        />
      ))}
    </div>
  )
}

// ── Resolve display name from localStorage ────────────────────────────────────
function resolveDisplayName(email: string | null): string {
  if (!email) return 'there'
  try {
    const users: { email: string; name: string }[] = JSON.parse(
      localStorage.getItem('kavach_users') ?? '[]'
    )
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase())
    if (user?.name?.trim()) {
      return user.name.trim().split(/\s+/)[0]
    }
  } catch { /* ignore */ }
  return email.includes('@') ? email.split('@')[0] : email
}

function getGreeting(): string {
  return 'Welcome Back'
}

interface ActivityItem {
  id: string
  icon: React.ReactNode
  iconBg: string
  title: string
  subtitle: string
  time: string
  status: 'done' | 'processing' | 'pending'
}

// ── Motion Variants with Explicit Types ─────────────────────────────────────
const iconVariants: Variants = {
  initial: { scale: 1, rotate: 0 },
  hover: { scale: 1.15, rotate: [0, -10, 10, 0], transition: { duration: 0.4 } },
}

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' },
  }),
}

const listItemVariants: Variants = {
  initial: { x: -20, opacity: 0 },
  animate: (i: number) => ({
    x: 0,
    opacity: 1,
    transition: { delay: 0.3 + i * 0.08, duration: 0.4 },
  }),
  hover: { x: 10, backgroundColor: 'rgba(248, 250, 255, 0.8)', transition: { duration: 0.2 } },
}

export default function DashboardPage() {
  const router = useRouter()
  const currentUserEmail = useAuthStore(s => s.currentUserEmail)
  const [searchTerm, setSearchTerm] = useState('')
  const [displayName, setDisplayName] = useState('there')
  const [aiPerformanceHeights, setAiPerformanceHeights] = useState([0, 0, 0, 0, 0, 0, 0])

  useEffect(() => {
    setDisplayName(resolveDisplayName(currentUserEmail))
  }, [currentUserEmail])

  useEffect(() => {
    const timer = setTimeout(() => {
      setAiPerformanceHeights([40, 60, 35, 85, 55, 75, 95])
    }, 500)
    return () => clearTimeout(timer)
  }, [])

  const { data: notebooks } = useNotebooks(false)
  const { data: sources } = useQuery({
    queryKey: ['sources', 'dashboard'],
    queryFn: () => sourcesApi.list({ limit: 50, sort_by: 'updated', sort_order: 'desc' }),
    staleTime: 30_000,
  })

  const stats = useMemo(() => {
    const totalSources = sources?.length ?? 248
    const activeCases = notebooks?.length ?? 18
    const rawAiQueries = (sources?.reduce((acc, s) => acc + (s.insights_count ?? 0), 0) ?? 0) || 1247
    const insightsGenerated = (sources?.reduce((acc, s) => acc + (s.insights_count ?? 0), 0) ?? 0) || 342
    return { totalSources, activeCases, aiQueries: rawAiQueries.toLocaleString('en-US'), insightsGenerated }
  }, [sources, notebooks])

  const recentActivity = useMemo((): ActivityItem[] => {
    const items: ActivityItem[] = []
    const recentSources = (sources ?? []).slice(0, 4)
    recentSources.forEach(s => {
      items.push({
        id: s.id,
        icon: <FileText className="h-4 w-4 text-[#4F46E5]" />,
        iconBg: 'bg-[#EEF2FF]',
        title: s.title || 'Untitled Document',
        subtitle: s.embedded ? 'Embedded successfully' : 'Processing...',
        time: formatDistanceToNow(new Date(s.updated ?? s.created), { addSuffix: true }),
        status: s.embedded ? 'done' : 'processing',
      })
    })
    return items.length > 0 ? items : [
      { id: '1', icon: <FileText className="h-4 w-4 text-[#4F46E5]" />, iconBg: 'bg-[#EEF2FF]', title: 'IR - SANDEEP @ KALA JATHEDI.Docx', subtitle: 'Embedded successfully', time: '2 hours ago', status: 'done' },
      { id: '2', icon: <Sparkles className="h-4 w-4 text-[#DB2777]" />, iconBg: 'bg-[#FDF2F8]', title: 'Neural Network Model Analysis', subtitle: 'Transformation completed', time: '4 hours ago', status: 'done' },
      { id: '3', icon: <Search className="h-4 w-4 text-[#7C3AED]" />, iconBg: 'bg-[#F5F3FF]', title: 'Market Research Query', subtitle: 'Generated insights', time: '5 hours ago', status: 'done' },
      { id: '4', icon: <FolderOpen className="h-4 w-4 text-[#0891B2]" />, iconBg: 'bg-[#ECFEFF]', title: 'Data Validation Report', subtitle: 'Processing...', time: '1 hour ago', status: 'processing' }
    ]
  }, [sources])

  const statCards = [
    { label: 'Total Sources', value: stats.totalSources, icon: <FileText className="h-5 w-5 text-white" />, iconGradient: 'linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%)', trend: '+12.5%', trendUp: true },
    { label: 'Active Cases', value: stats.activeCases, icon: <Briefcase className="h-5 w-5 text-white" />, iconGradient: 'linear-gradient(135deg, #DB2777 0%, #F43F5E 100%)', trend: '+8.3%', trendUp: true },
    { label: 'AI Queries', value: stats.aiQueries, icon: <Search className="h-5 w-5 text-white" />, iconGradient: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)', trend: '+23.1%', trendUp: true },
    { label: 'Insights Generated', value: stats.insightsGenerated, icon: <Zap className="h-5 w-5 text-white" />, iconGradient: 'linear-gradient(135deg, #0891B2 0%, #10B981 100%)', trend: '-2.4%', trendUp: false },
  ]

  const quickActions = [
    { label: 'Upload Document', icon: <Upload className="h-4 w-4" />, gradient: 'linear-gradient(90deg, #4F46E5 0%, #3B82F6 100%)', route: '/sources' },
    { label: 'Create Case', icon: <Briefcase className="h-4 w-4" />, gradient: 'linear-gradient(90deg, #DB2777 0%, #F43F5E 100%)', route: '/notebooks' },
    { label: 'Ask AI', icon: <Search className="h-4 w-4" />, gradient: 'linear-gradient(90deg, #9333EA 0%, #C084FC 100%)', route: '/search' },
    { label: 'New Transformation', icon: <Zap className="h-4 w-4" />, gradient: 'linear-gradient(90deg, #0891B2 0%, #10B981 100%)', route: '/transformations' },
  ]

  return (
    <AppShell>
      {/* ── BACKGROUND LAYER: Exact Gradient Colors from Image ────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-[#F9FAFF]">
        {/* Top Right Indigo Glow */}
        <div 
          className="absolute top-[-10%] right-[-5%] w-[65%] h-[75%] rounded-full pointer-events-none z-0 opacity-40"
          style={{ background: 'radial-gradient(circle, rgba(167,139,250,0.5) 0%, transparent 70%)', filter: 'blur(100px)' }} 
        />
        
        {/* Center-Left Soft Cyan Glow */}
        <div 
          className="absolute top-[15%] left-[-10%] w-[45%] h-[55%] rounded-full pointer-events-none z-0 opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(129,140,248,0.4) 0%, transparent 70%)', filter: 'blur(110px)' }} 
        />

        {/* Bottom Right Soft Lavender Glow */}
        <div 
          className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full pointer-events-none z-0 opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(216,180,254,0.4) 0%, transparent 75%)', filter: 'blur(90px)' }} 
        />

        <PageHeader searchValue={searchTerm} onSearchChange={setSearchTerm} newLabel="NOTEBOOK" />

        <div className="flex-1 overflow-y-auto relative z-10 custom-scrollbar">
          <div className="w-full pl-10 pr-[60px] py-10 space-y-10">

            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <h1 className="text-[36px] font-bold text-[#4338CA] tracking-tight">
                {getGreeting()}, <span className="text-[#6366F1]">{displayName}!</span>
              </h1>
              <p className="text-[15px] text-slate-500 font-medium mt-1">
                Here's what's happening with your knowledge base today.
              </p>
            </motion.div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {statCards.map((card, idx) => (
                <motion.div
                  key={card.label}
                  custom={idx}
                  initial="hidden"
                  animate="visible"
                  variants={cardVariants}
                  whileHover="hover"
                  className="bg-white/70 backdrop-blur-xl rounded-[24px] p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/60 flex flex-col gap-4 group hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex justify-between items-start">
                    {/* Gradient Icon Background */}
                    <motion.div 
                      variants={iconVariants} 
                      className="w-12 h-12 rounded-[16px] flex items-center justify-center shadow-lg"
                      style={{ background: card.iconGradient }}
                    >
                      {card.icon}
                    </motion.div>
                    <span className={`text-[13px] font-bold flex items-center gap-1 ${card.trendUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                      <TrendingUp className={`h-3.5 w-3.5 ${!card.trendUp && 'rotate-180'}`} />
                      {card.trend}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-[32px] font-bold text-slate-900 tracking-tight">{card.value}</h3>
                    <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest">{card.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8">
              {/* Recent Activity Card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="bg-white/80 backdrop-blur-2xl rounded-[32px] p-8 shadow-[0_8px_40px_rgba(0,0,0,0.03)] border border-white"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-[20px] font-bold text-slate-900">Recent Activity</h2>
                    <p className="text-[14px] text-slate-400 font-medium">Latest updates from your knowledge base</p>
                  </div>
                  <button className="text-slate-300 hover:text-slate-500 transition-colors text-2xl">···</button>
                </div>

                <div className="space-y-2">
                  {recentActivity.map((item, idx) => (
                    <motion.div
                      key={item.id}
                      custom={idx}
                      initial="initial"
                      animate="animate"
                      whileHover="hover"
                      variants={listItemVariants}
                      className="flex items-center gap-5 p-4 rounded-[20px] cursor-pointer group transition-all"
                    >
                      <motion.div variants={iconVariants} className={`w-11 h-11 rounded-[14px] flex items-center justify-center shadow-sm ${item.iconBg}`}>
                        {item.icon}
                      </motion.div>
                      <div className="flex-1">
                        <p className="text-[15px] font-bold text-slate-800">{item.title}</p>
                        <p className="text-[13px] text-slate-400 font-medium">{item.subtitle}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[12px] text-slate-400 font-medium flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" /> {item.time}
                        </span>
                        <div className={`h-2.5 w-2.5 rounded-full ${item.status === 'done' ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400 animate-pulse'}`} />
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <div className="flex flex-col gap-6">
                {/* Quick Actions */}
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.4 }}
                  className="bg-white/80 backdrop-blur-2xl rounded-[32px] p-8 shadow-[0_8px_40px_rgba(0,0,0,0.03)] border border-white"
                >
                  <h2 className="text-[20px] font-bold text-slate-900 mb-1">Quick Actions</h2>
                  <p className="text-[14px] text-slate-400 font-medium mb-6">Jump right into your workflow</p>
                  <div className="space-y-4">
                    {quickActions.map((action) => (
                      <motion.button
                        key={action.label}
                        whileHover={{ scale: 1.02, filter: 'brightness(1.1)' }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => router.push(action.route)}
                        className="w-full flex items-center justify-between px-6 py-4 rounded-[20px] text-white font-bold text-[14px] shadow-lg shadow-indigo-200/20 transition-all"
                        style={{ background: action.gradient }}
                      >
                        <span className="flex items-center gap-3">{action.icon}{action.label}</span>
                        <ArrowUpRight className="h-5 w-5 opacity-80" />
                      </motion.button>
                    ))}
                  </div>
                </motion.div>

                {/* AI Performance */}
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                  className="bg-white/80 backdrop-blur-2xl rounded-[32px] p-8 shadow-[0_8px_40px_rgba(0,0,0,0.03)] border border-white flex-1"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <motion.div variants={iconVariants} whileHover="hover" className="p-2 bg-violet-100 rounded-lg">
                        <Sparkles className="h-5 w-5 text-[#8B5CF6]" />
                    </motion.div>
                    <h2 className="text-[18px] font-bold text-slate-900">AI Performance</h2>
                  </div>
                  <AiPerformanceChart heights={aiPerformanceHeights} />
                  <div className="mt-6 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <p className="text-[12px] text-slate-500 font-bold text-center leading-relaxed">
                        Query response times trending <span className="text-violet-600">23% faster</span>
                    </p>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}