'use client'

import { useState, useMemo } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { useNotebooks } from '@/lib/hooks/use-notebooks'
import { sourcesApi } from '@/lib/api/sources'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Building2,
  UserCog,
  Users,
  Briefcase,
  CheckCircle,
  HardDrive,
  Sparkles,
  Search,
  Database,
  Cloud,
  FileText,
  Upload,
  Shield,
  MoreHorizontal
} from 'lucide-react'

// ── SVG Donut Chart for Storage Breakdown ─────────────────────────────────────
function StorageDonutChart() {
  // SVG size is 120x120. Radius = 40. Circumference = 2 * PI * r = 251.3
  // Values: Documents (45% -> 113.1), Media Files (30% -> 75.4), Archives (15% -> 37.7), Other (10% -> 25.1)
  return (
    <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
        {/* Track */}
        <circle cx="60" cy="60" r="40" fill="transparent" stroke="#F1F5F9" strokeWidth="14" />
        
        {/* Documents Segment (purple) - Offset: 0 */}
        <circle
          cx="60"
          cy="60"
          r="40"
          fill="transparent"
          stroke="#8B5CF6"
          strokeWidth="14"
          strokeDasharray="251.3"
          strokeDashoffset="138.2" // 251.3 - 45% = 251.3 - 113.1
        />

        {/* Media Segment (blue) - Offset: 45% of 251.3 = 113.1 */}
        <circle
          cx="60"
          cy="60"
          r="40"
          fill="transparent"
          stroke="#3B82F6"
          strokeWidth="14"
          strokeDasharray="251.3"
          strokeDashoffset="175.9" // 251.3 - 30% = 175.9. (offset start from 113.1 + 75.4 = 188.5? No, offset is strokeDashoffset = Circumference - segmentLength, and offsetStart is strokeDashoffset = strokeDashoffset - offsetLength)
          style={{ strokeDashoffset: 138.2 - 75.4 }}
        />

        {/* Archives Segment (green) - Offset: 75% of 251.3 = 188.5 */}
        <circle
          cx="60"
          cy="60"
          r="40"
          fill="transparent"
          stroke="#10B981"
          strokeWidth="14"
          strokeDasharray="251.3"
          style={{ strokeDashoffset: 138.2 - 75.4 - 37.7 }}
        />

        {/* Other Segment (orange) - Offset: 90% of 251.3 = 226.2 */}
        <circle
          cx="60"
          cy="60"
          r="40"
          fill="transparent"
          stroke="#F59E0B"
          strokeWidth="14"
          strokeDasharray="251.3"
          style={{ strokeDashoffset: 138.2 - 75.4 - 37.7 - 25.1 }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute flex flex-col items-center">
        <span className="text-sm font-bold text-slate-400">Used</span>
        <span className="text-lg font-extrabold text-slate-800">48%</span>
      </div>
    </div>
  )
}

// ── SVG Double Area Chart for Cases Overview ──────────────────────────────────
function CasesAreaChart() {
  return (
    <div className="w-full h-[180px] relative mt-2 select-none">
      <svg className="w-full h-full" viewBox="0 0 500 150" preserveAspectRatio="none">
        <defs>
          <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        <line x1="0" y1="30" x2="500" y2="30" stroke="#F1F5F9" strokeWidth="1" />
        <line x1="0" y1="70" x2="500" y2="70" stroke="#F1F5F9" strokeWidth="1" />
        <line x1="0" y1="110" x2="500" y2="110" stroke="#F1F5F9" strokeWidth="1" />

        {/* Completed Cases (Blue) */}
        <path
          d="M0,130 C80,110 160,95 250,115 C330,130 410,95 500,85 L500,150 L0,150 Z"
          fill="url(#blueGrad)"
        />
        <path
          d="M0,130 C80,110 160,95 250,115 C330,130 410,95 500,85"
          fill="none"
          stroke="#3B82F6"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Active Cases (Purple) */}
        <path
          d="M0,90 C80,82 160,50 250,75 C330,95 410,65 500,50 L500,150 L0,150 Z"
          fill="url(#purpleGrad)"
        />
        <path
          d="M0,90 C80,82 160,50 250,75 C330,95 410,65 500,50"
          fill="none"
          stroke="#8B5CF6"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      {/* Month Labels */}
      <div className="flex justify-between text-[11px] text-slate-400 font-bold px-1 mt-2">
        <span>Jan</span>
        <span>Feb</span>
        <span>Mar</span>
        <span>Apr</span>
        <span>May</span>
        <span>Jun</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [searchTerm, setSearchTerm] = useState('')

  const { data: notebooks } = useNotebooks(false)
  const { data: sources } = useQuery({
    queryKey: ['sources', 'dashboard'],
    queryFn: () => sourcesApi.list({ limit: 50, sort_by: 'updated', sort_order: 'desc' }),
    staleTime: 30_000,
  })

  const stats = useMemo(() => {
    const totalSources = sources?.length ?? 0
    const activeCases = notebooks?.length ?? 0
    return { totalSources, activeCases }
  }, [sources, notebooks])

  const statCards = [
    {
      label: 'Total Organizations',
      value: '248',
      trend: '↑ 12%',
      isPositive: true,
      icon: Building2,
      iconColor: 'text-[#8B5CF6]',
      iconBg: 'bg-[#F5F3FF]'
    },
    {
      label: 'Total Admins',
      value: '156',
      trend: '↑ 8%',
      isPositive: true,
      icon: UserCog,
      iconColor: 'text-[#3B82F6]',
      iconBg: 'bg-[#EFF6FF]'
    },
    {
      label: 'Total Users',
      value: '2,847',
      trend: '↑ 15%',
      isPositive: true,
      icon: Users,
      iconColor: 'text-[#10B981]',
      iconBg: 'bg-[#ECFDF5]'
    },
    {
      label: 'Active Cases',
      value: stats.activeCases || '324',
      trend: '↑ 5%',
      isPositive: true,
      icon: Briefcase,
      iconColor: 'text-[#F59E0B]',
      iconBg: 'bg-[#FFFBEB]'
    },
    {
      label: 'Completed Cases',
      value: '1,563',
      trend: '↑ 18%',
      isPositive: true,
      icon: CheckCircle,
      iconColor: 'text-[#D946EF]',
      iconBg: 'bg-[#FDF4FF]'
    },
    {
      label: 'Storage Used',
      value: '2.4 TB',
      trend: '↓ 3%',
      isPositive: false,
      icon: HardDrive,
      iconColor: 'text-[#EF4444]',
      iconBg: 'bg-[#FEF2F2]'
    }
  ]

  const healthServices = [
    {
      name: 'AI Service',
      status: 'Operational',
      uptime: '99.9%',
      icon: Sparkles,
      iconBg: 'bg-emerald-50 text-emerald-600'
    },
    {
      name: 'Search Engine',
      status: 'Operational',
      uptime: '99.9%',
      icon: Search,
      iconBg: 'bg-emerald-50 text-emerald-600'
    },
    {
      name: 'Database',
      status: 'Operational',
      uptime: '99.9%',
      icon: Database,
      iconBg: 'bg-emerald-50 text-emerald-600'
    },
    {
      name: 'Storage',
      status: 'Degraded',
      uptime: '95.2%',
      icon: Cloud,
      iconBg: 'bg-amber-50 text-amber-600'
    }
  ]

  const orgs = [
    {
      name: 'TechCorp Industries',
      industry: 'Technology',
      plan: 'Enterprise',
      users: 245,
      storage: '1.2 TB',
      status: 'Active',
      initial: 'T',
      color: 'bg-indigo-500 text-white'
    },
    {
      name: 'Global Finance Group',
      industry: 'Finance',
      plan: 'Business',
      users: 156,
      storage: '850 GB',
      status: 'Active',
      initial: 'G',
      color: 'bg-blue-500 text-white'
    },
    {
      name: 'Healthcare Solutions',
      industry: 'Healthcare',
      plan: 'Enterprise',
      users: 312,
      storage: '2.1 TB',
      status: 'Active',
      initial: 'H',
      color: 'bg-fuchsia-500 text-white'
    },
    {
      name: 'Legal Partners LLC',
      industry: 'Legal',
      plan: 'Professional',
      users: 89,
      storage: '420 GB',
      status: 'Active',
      initial: 'L',
      color: 'bg-emerald-500 text-white'
    },
    {
      name: 'Manufacturing Co',
      industry: 'Manufacturing',
      plan: 'Business',
      users: 178,
      storage: '950 GB',
      status: 'Trial',
      initial: 'M',
      color: 'bg-amber-500 text-white'
    }
  ]

  const recentActivities = [
    {
      id: 'act-1',
      title: 'New user registered',
      desc: 'Sarah Johnson joined Finance Team',
      time: '5 minutes ago',
      icon: Users,
      iconBg: 'bg-blue-50 text-blue-600'
    },
    {
      id: 'act-2',
      title: 'Organization added',
      desc: 'TechCorp Industries was added to the platform',
      time: '1 hour ago',
      icon: Building2,
      iconBg: 'bg-purple-50 text-purple-600'
    },
    {
      id: 'act-3',
      title: 'Case created',
      desc: 'Investigation #2847 was initiated',
      time: '2 hours ago',
      icon: FileText,
      iconBg: 'bg-emerald-50 text-emerald-600'
    },
    {
      id: 'act-4',
      title: 'File uploaded',
      desc: 'Document evidence_report.pdf was uploaded',
      time: '3 hours ago',
      icon: Upload,
      iconBg: 'bg-amber-50 text-amber-600'
    },
    {
      id: 'act-5',
      title: 'Security audit completed',
      desc: 'Quarterly security review finished successfully',
      time: '5 hours ago',
      icon: Shield,
      iconBg: 'bg-violet-50 text-violet-600'
    }
  ]

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 bg-[#F8FAFC] relative overflow-hidden">
        {/* Background Glows */}
        <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-slate-100 rounded-full blur-[100px] opacity-40 pointer-events-none" />
        <div className="absolute bottom-[10%] left-[-5%] w-[300px] h-[300px] bg-slate-100 rounded-full blur-[80px] opacity-30 pointer-events-none" />

        <PageHeader searchValue={searchTerm} onSearchChange={setSearchTerm} newLabel="NOTEBOOK" />

        <div className="flex-1 overflow-y-auto relative z-10 custom-scrollbar">
          <div className="w-full px-6 lg:px-8 py-8 lg:py-10 pb-24 space-y-8 text-left">
            

            {/* Row 1: KPI Stats Cards (6 columns) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {statCards.map((card, idx) => {
                const CardIcon = card.icon
                return (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05, duration: 0.4 }}
                    className="bg-white border border-slate-100/90 rounded-3xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.003)] flex flex-col justify-between min-h-[140px] hover:shadow-[0_4px_16px_rgba(0,0,0,0.01)] hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="flex justify-between items-start">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${card.iconBg}`}>
                        <CardIcon className={`h-5 w-5 ${card.iconColor}`} />
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        card.isPositive 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                          : 'bg-rose-50 text-rose-600 border border-rose-100'
                      }`}>
                        {card.trend}
                      </span>
                    </div>
                    <div>
                      <p className="text-[24px] font-extrabold text-slate-800 tracking-tight leading-none mb-1 mt-4">{card.value}</p>
                      <p className="text-[10.5px] font-bold text-slate-400 leading-tight truncate">{card.label}</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Row 2: Charts (Cases Overview & User Growth) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Cases Overview Chart (8 columns) */}
              <div className="lg:col-span-7 xl:col-span-8 bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.003)]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-[15px]">Cases Overview</h3>
                    <p className="text-[12px] text-slate-400 font-semibold mt-0.5">Active vs Completed cases</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
                      Active
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
                      Completed
                    </span>
                  </div>
                </div>
                <CasesAreaChart />
              </div>

              {/* User Growth Chart (4 columns) */}
              <div className="lg:col-span-5 xl:col-span-4 bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.003)] flex flex-col justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-[15px]">User Growth</h3>
                  <p className="text-[12px] text-slate-400 font-semibold mt-0.5">Total users over time</p>
                </div>
                <div className="flex items-end gap-3 h-[120px] px-2 mt-6">
                  {/* Columns for Jan - Jun */}
                  {[
                    { month: 'Jan', val: '20%' },
                    { month: 'Feb', val: '35%' },
                    { month: 'Mar', val: '45%' },
                    { month: 'Apr', val: '58%' },
                    { month: 'May', val: '75%' },
                    { month: 'Jun', val: '90%' }
                  ].map((item) => (
                    <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full bg-[#F1F5F9] rounded-t-lg h-[100px] relative overflow-hidden">
                        <div 
                          className="absolute bottom-0 left-0 right-0 bg-[#8B5CF6] rounded-t-lg transition-all duration-500" 
                          style={{ height: item.val }} 
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-400">{item.month}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Row 3: System Health & Storage Usage */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* System Health */}
              <div className="lg:col-span-7 xl:col-span-8 bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.003)]">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-[15px]">System Health</h3>
                    <p className="text-[12px] text-slate-400 font-semibold mt-0.5">Service status overview</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                    All Systems Operational
                  </span>
                </div>
                <div className="space-y-4">
                  {healthServices.map((service) => {
                    const ServiceIcon = service.icon
                    return (
                      <div key={service.name} className="flex items-center justify-between p-3.5 bg-slate-50/50 border border-slate-100 rounded-2xl">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${service.iconBg}`}>
                            <ServiceIcon className="h-4.5 w-4.5" />
                          </div>
                          <span className="text-xs font-bold text-slate-800">{service.name}</span>
                        </div>
                        <div className="flex items-center gap-6">
                          <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${service.status === 'Operational' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            {service.status}
                          </span>
                          <span className={`text-xs font-extrabold ${service.status === 'Operational' ? 'text-[#10B981]' : 'text-amber-600'}`}>
                            {service.uptime}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Storage Usage (Donut breakdown) */}
              <div className="lg:col-span-5 xl:col-span-4 bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.003)] flex flex-col justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-[15px]">Storage Usage</h3>
                  <p className="text-[12px] text-slate-400 font-semibold mt-0.5">Breakdown by file type</p>
                </div>
                
                <div className="my-4">
                  <StorageDonutChart />
                </div>

                {/* Donut Legend */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-bold text-slate-500 border-t border-slate-50 pt-4">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
                    Documents
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                    Media Files
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                    Archives
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                    Other
                  </span>
                </div>

                {/* Progress bar */}
                <div className="border-t border-slate-50 pt-4 mt-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1.5">
                    <span>Total Storage</span>
                    <span className="text-slate-700">2.4 TB / 5 TB</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-[#8B5CF6] rounded-full" style={{ width: '48%' }} />
                  </div>
                </div>

              </div>

            </div>

            {/* Row 4: Organizations Table & Recent Activities */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Organizations Table List */}
              <div className="lg:col-span-7 xl:col-span-8 bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.003)]">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-[15px]">Organizations</h3>
                    <p className="text-[12px] text-slate-400 font-semibold mt-0.5">Manage all organizations</p>
                  </div>
                  <button className="h-9 px-4 bg-[#5D3FD3] hover:bg-[#4b32ac] text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-sm">
                    Add Organization
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[550px]">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                        <th className="pb-4 pl-2 font-extrabold">Organization</th>
                        <th className="pb-4 font-extrabold">Industry</th>
                        <th className="pb-4 font-extrabold">Plan</th>
                        <th className="pb-4 font-extrabold">Users</th>
                        <th className="pb-4 font-extrabold">Storage</th>
                        <th className="pb-4 font-extrabold">Status</th>
                        <th className="pb-4 pr-2 font-extrabold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orgs.map((org) => (
                        <tr key={org.name} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors last:border-b-0">
                          <td className="py-4 pl-2">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${org.color}`}>
                                {org.initial}
                              </div>
                              <span className="text-xs font-bold text-slate-800 truncate max-w-[140px]">{org.name}</span>
                            </div>
                          </td>
                          <td className="py-4 text-xs font-semibold text-slate-500">{org.industry}</td>
                          <td className="py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                              org.plan === 'Enterprise' 
                                ? 'bg-purple-50 text-purple-600 border-purple-100' 
                                : org.plan === 'Business'
                                ? 'bg-blue-50 text-blue-600 border-blue-100'
                                : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            }`}>
                              {org.plan}
                            </span>
                          </td>
                          <td className="py-4 text-xs font-bold text-slate-800">{org.users}</td>
                          <td className="py-4 text-xs font-semibold text-slate-500 font-mono">{org.storage}</td>
                          <td className="py-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              org.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                : 'bg-amber-50 text-amber-600 border-amber-100'
                            }`}>
                              {org.status}
                            </span>
                          </td>
                          <td className="py-4 pr-2 text-right">
                            <button className="p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-700 rounded-lg transition-colors cursor-pointer">
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Activities List (4 columns) */}
              <div className="lg:col-span-5 xl:col-span-4 bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.003)] flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-[15px]">Recent Activities</h3>
                      <p className="text-[12px] text-slate-400 font-semibold mt-0.5">Latest platform events</p>
                    </div>
                    <button className="text-[11px] font-bold text-[#5D3FD3] hover:underline cursor-pointer">
                      View All
                    </button>
                  </div>
                  <div className="space-y-4">
                    {recentActivities.map((act) => {
                      const ActIcon = act.icon
                      return (
                        <div key={act.id} className="flex gap-3 text-left">
                          <div className={`w-8 h-8 rounded-full ${act.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                            <ActIcon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{act.title}</p>
                            <p className="text-[10.5px] font-semibold text-slate-400 mt-0.5 leading-snug line-clamp-1">{act.desc}</p>
                            <span className="text-[10px] text-slate-450 font-semibold mt-1 block">{act.time}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

            </div>



          </div>
        </div>
      </div>
    </AppShell>
  )
}
