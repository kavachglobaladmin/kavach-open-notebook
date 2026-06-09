'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react'
import { motion } from 'framer-motion'

interface AuditLogRecord {
  id: string
  timestamp: string
  user: string
  org: string
  module: string
  action: string
  status: 'Success' | 'Failure'
  ip: string
}

const mockLogs: AuditLogRecord[] = [
  {
    id: '1',
    timestamp: 'May 23, 2024 10:28 AM',
    user: 'John Doe',
    org: 'Delta Police',
    module: 'Cases',
    action: 'Created Case',
    status: 'Success',
    ip: '192.168.1.10',
  },
  {
    id: '2',
    timestamp: 'Jun 15, 2024 10:20 AM',
    user: 'Priya Sharma',
    org: 'Delhi Police',
    module: 'Sources',
    action: 'Uploaded File',
    status: 'Success',
    ip: '192.168.1.52',
  },
  {
    id: '3',
    timestamp: 'Jun 15, 2024 10:18 AM',
    user: 'Ankit Verma',
    org: 'Finance Dept',
    module: 'Users',
    action: 'Updated User',
    status: 'Success',
    ip: '192.168.1.89',
  },
  {
    id: '4',
    timestamp: 'Jun 15, 2024 10:16 AM',
    user: 'Sarah Mehta',
    org: 'Cyber Crime Cell',
    module: 'AI Query',
    action: 'AI Query',
    status: 'Failure',
    ip: '192.168.1.45',
  },
  {
    id: '5',
    timestamp: 'Jun 15, 2024 10:10 AM',
    user: 'System',
    org: 'Delhi Police',
    module: 'Auth',
    action: 'Login Failed',
    status: 'Failure',
    ip: '192.168.1.22',
  },
  {
    id: '6',
    timestamp: 'Jun 15, 2024 10:08 AM',
    user: 'Neha Gupta',
    org: 'State Intelligence',
    module: 'Settings',
    action: 'Changed Setting',
    status: 'Success',
    ip: '192.168.1.76',
  },
  {
    id: '7',
    timestamp: 'Jun 15, 2024 10:18 AM',
    user: 'Sarah Mehta',
    org: 'Cyber Crime Cell',
    module: 'Cases',
    action: 'Deleted Case',
    status: 'Success',
    ip: '192.168.1.45',
  },
]

export default function AuditLogsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('All')
  const [filterOrg, setFilterOrg] = useState<string>('All')
  const [filterModule, setFilterModule] = useState<string>('All')
  const [showFilters, setShowFilters] = useState(false)

  const filteredLogs = mockLogs.filter((log) => {
    const matchesSearch =
      log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ip.includes(searchTerm)

    const matchesStatus = filterStatus === 'All' || log.status === filterStatus
    const matchesOrg = filterOrg === 'All' || log.org === filterOrg
    const matchesModule = filterModule === 'All' || log.module === filterModule

    return matchesSearch && matchesStatus && matchesOrg && matchesModule
  })

  const stats = [
    {
      label: 'Total Logs',
      value: '25,430',
      trend: '+16.4%',
      isPositive: true,
    },
    {
      label: 'Failed Actions',
      value: '320',
      trend: '-8.4%',
      isPositive: false,
    },
    {
      label: 'Security Alerts',
      value: '24',
      trend: '+11.1%',
      isPositive: false,
    },
    {
      label: 'API Calls',
      value: '12,845',
      trend: '+9.3%',
      isPositive: true,
    },
  ]

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 bg-[#F8FAFC] relative overflow-hidden">
        {/* Background Glows */}
        <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-slate-100 rounded-full blur-[100px] opacity-40 pointer-events-none" />
        <div className="absolute bottom-[10%] left-[-5%] w-[300px] h-[300px] bg-slate-100 rounded-full blur-[80px] opacity-30 pointer-events-none" />

        <PageHeader searchValue={searchTerm} onSearchChange={setSearchTerm} newLabel="LOG ENTRY" />

        <div className="flex-1 overflow-y-auto relative z-10 custom-scrollbar">
          <div className="w-full px-6 lg:px-8 py-8 lg:py-10 pb-24 space-y-8 text-left">
            
            {/* Title & Action Button Block */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-3xl font-bold text-slate-800 leading-tight">
                  Audit Logs
                </h1>
                <p className="text-sm text-slate-500 font-semibold">
                  Track and monitor all system activities
                </p>
              </div>
              <button className="h-11 px-5 bg-[#5D3FD3] hover:bg-[#4b32ac] text-white font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all text-sm shrink-0 self-start sm:self-center cursor-pointer">
                <Download className="h-4 w-4" />
                Export Logs
              </button>
            </div>

            {/* Stats Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08, duration: 0.4 }}
                  className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.005)] flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                    <h3 className="text-2xl lg:text-3xl font-extrabold text-slate-800 tracking-tight mt-1">{stat.value}</h3>
                  </div>
                  <div className="mt-3 flex items-center gap-1">
                    {stat.label === 'Failed Actions' ? (
                      <ArrowDownRight className="h-4 w-4 text-rose-600 shrink-0" />
                    ) : stat.label === 'Security Alerts' ? (
                      <ArrowUpRight className="h-4 w-4 text-rose-600 shrink-0" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4 text-emerald-600 shrink-0" />
                    )}
                    <span className={`text-[12px] font-bold ${
                      stat.label === 'Failed Actions' || stat.label === 'Security Alerts'
                        ? 'text-rose-600'
                        : 'text-emerald-600'
                    }`}>
                      {stat.trend}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Filter controls row */}
            <div className="space-y-4">
              
              {/* Search and Filters Toggle row */}
              <div className="flex gap-3 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-11 pl-12 pr-4 bg-white border border-slate-200 rounded-xl text-sm text-slate-750 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#5D3FD3]/20 focus:border-[#5D3FD3] transition-all font-medium text-left"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`h-11 px-4 border rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    showFilters
                      ? 'border-[#5D3FD3] bg-[#5D3FD3]/5 text-[#5D3FD3]'
                      : 'border-slate-200 bg-white text-slate-655 hover:bg-slate-50'
                  }`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                </button>
              </div>

              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 pt-2"
                >
                  {/* Row 1 Filter Dropdowns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 flex items-center select-none">
                      May 12, 2024 - Jun 15, 2024
                    </div>
                    <div className="relative">
                      <select
                        value={filterOrg}
                        onChange={(e) => setFilterOrg(e.target.value)}
                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-[#5D3FD3]/20 focus:border-[#5D3FD3]"
                      >
                        <option value="All">Organization</option>
                        <option value="Delta Police">Delta Police</option>
                        <option value="Delhi Police">Delhi Police</option>
                        <option value="Finance Dept">Finance Dept</option>
                        <option value="Cyber Crime Cell">Cyber Crime Cell</option>
                        <option value="State Intelligence">State Intelligence</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select
                        value={filterModule}
                        onChange={(e) => setFilterModule(e.target.value)}
                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-[#5D3FD3]/20 focus:border-[#5D3FD3]"
                      >
                        <option value="All">All Modules</option>
                        <option value="Cases">Cases</option>
                        <option value="Sources">Sources</option>
                        <option value="Users">Users</option>
                        <option value="AI Query">AI Query</option>
                        <option value="Auth">Auth</option>
                        <option value="Settings">Settings</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Row 2 Filter Dropdowns */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="relative">
                      <select className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-[#5D3FD3]/20 focus:border-[#5D3FD3]">
                        <option>All Users</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-[#5D3FD3]/20 focus:border-[#5D3FD3]">
                        <option>All Actions</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                    <div className="relative">
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-[#5D3FD3]/20 focus:border-[#5D3FD3]"
                      >
                        <option value="All">All Statuses</option>
                        <option value="Success">Success</option>
                        <option value="Failure">Failure</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* List Table Container */}
            <div className="w-full bg-white rounded-3xl border border-slate-100 p-6 shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                      <th className="pb-4 pl-2 font-extrabold">Timestamp</th>
                      <th className="pb-4 font-extrabold">User</th>
                      <th className="pb-4 font-extrabold">Organization</th>
                      <th className="pb-4 font-extrabold">Module</th>
                      <th className="pb-4 font-extrabold">Action</th>
                      <th className="pb-4 font-extrabold">Status</th>
                      <th className="pb-4 pr-2 font-extrabold">IP Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors last:border-b-0">
                        <td className="py-4 pl-2 text-sm font-semibold text-slate-400">{log.timestamp}</td>
                        <td className="py-4 text-sm font-bold text-slate-800">{log.user}</td>
                        <td className="py-4 text-sm font-semibold text-slate-500">{log.org}</td>
                        <td className="py-4 text-sm font-semibold text-slate-500">{log.module}</td>
                        <td className="py-4 text-sm font-bold text-slate-700">{log.action}</td>
                        <td className="py-4">
                          <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-[11px] font-bold border ${
                            log.status === 'Success'
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                              : 'bg-rose-50 text-rose-600 border-rose-100'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-4 pr-2 text-sm font-bold text-slate-500 font-mono">{log.ip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination footer block */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-6">
                <span className="text-xs text-slate-400 font-semibold">
                  Showing {filteredLogs.length > 0 ? 1 : 0} to {filteredLogs.length} of {filteredLogs.length === mockLogs.length ? '25,430' : filteredLogs.length} logs
                </span>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <button className="px-3 py-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 font-bold transition-all cursor-pointer">
                    Previous
                  </button>
                  <button className="w-8 h-8 rounded-lg bg-[#5D3FD3] text-white flex items-center justify-center font-bold">
                    1
                  </button>
                  <button className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 flex items-center justify-center font-bold cursor-pointer">
                    2
                  </button>
                  <button className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 flex items-center justify-center font-bold cursor-pointer">
                    3
                  </button>
                  <button className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 flex items-center justify-center font-bold cursor-pointer">
                    4
                  </button>
                  <span className="text-slate-400 px-1 font-bold">...</span>
                  <button className="px-3 py-1.5 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 font-bold transition-all cursor-pointer">
                    Next
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>
    </AppShell>
  )
}
