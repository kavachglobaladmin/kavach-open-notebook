'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { ClipboardList, ShieldAlert, Terminal, Search, Info, CheckCircle, XCircle } from 'lucide-react'
import { motion } from 'framer-motion'

interface AuditLogRecord {
  id: string
  timestamp: string
  user: string
  org: string
  action: string
  status: 'Success' | 'Failed'
  ip: string
}

const mockLogs: AuditLogRecord[] = [
  { id: '1', timestamp: '2026-06-08 17:40:12', user: 'priya@kavach.io', org: 'Kavach Security', action: 'Exported Case Report', status: 'Success', ip: '103.45.21.90' },
  { id: '2', timestamp: '2026-06-08 17:35:45', user: 'john@globaltech.com', org: 'Global Tech Corp', action: 'Rebuilt Embeddings', status: 'Success', ip: '192.168.1.42' },
  { id: '3', timestamp: '2026-06-08 17:30:21', user: 'unknown@external.net', org: 'N/A', action: 'API Authentication Request', status: 'Failed', ip: '45.89.230.12' },
  { id: '4', timestamp: '2026-06-08 16:15:00', user: 'sarah@apexfin.com', org: 'Apex Finance', action: 'Updated System Keys', status: 'Success', ip: '157.40.122.5' },
  { id: '5', timestamp: '2026-06-08 15:45:12', user: 'jane@pioneer.edu', org: 'Pioneer Edu', action: 'Unauthorized Path Access (/advanced)', status: 'Failed', ip: '203.0.113.195' },
]

export default function AuditLogsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('All')

  const filteredLogs = mockLogs.filter(log => {
    const matchesSearch = log.user.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          log.ip.includes(searchTerm)
    const matchesStatus = filterStatus === 'All' || log.status === filterStatus
    return matchesSearch && matchesStatus
  })

  const stats = [
    { label: 'Total Log Entries', value: '42,912', icon: <ClipboardList className="w-5 h-5 text-white" />, gradient: 'linear-gradient(135deg, #4F46E5 0%, #3B82F6 100%)' },
    { label: 'Security Indicators', value: '2 Warnings', icon: <ShieldAlert className="w-5 h-5 text-white" />, gradient: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)' },
    { label: 'API Queries (24h)', value: '3,842', icon: <Terminal className="w-5 h-5 text-white" />, gradient: 'linear-gradient(135deg, #7C3AED 0%, #9333EA 100%)' },
  ]

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 bg-[linear-gradient(110deg,#dbeafe_0%,#f0f7fa_45%,#e5d5f2_100%)] relative overflow-hidden">
        {/* Background Decorative Glows */}
        <div className="absolute top-[-10%] right-[-5%] w-[60%] h-[70%] rounded-full pointer-events-none z-0 opacity-40 bg-radial-[circle,rgba(167,139,250,0.4)_0%,transparent_70%] blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[50%] h-[60%] rounded-full pointer-events-none z-0 opacity-35 bg-radial-[circle,rgba(129,140,248,0.3)_0%,transparent_75%] blur-[110px]" />

        <PageHeader searchValue={searchTerm} onSearchChange={setSearchTerm} newLabel="LOG ENTRY" />

        <div className="flex-1 overflow-y-auto relative z-10 custom-scrollbar">
          <div className="w-full px-4 sm:px-8 lg:px-12 py-8 lg:py-10 pb-24 space-y-8 text-left">
            
            {/* Title Block */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-3xl lg:text-4xl font-bold text-[#4338CA] tracking-tight">
                  Audit Logs
                </h1>
                <p className="text-sm sm:text-base text-slate-500 font-medium">
                  Trace security events, API access footprints, data exports, and configuration updates.
                </p>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {stats.map((stat, idx) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08, duration: 0.4 }}
                  className="bg-white/80 backdrop-blur-xl rounded-[24px] p-6 shadow-sm border border-white flex flex-col gap-4"
                >
                  <div className="w-10 h-10 rounded-[14px] flex items-center justify-center shadow-md" style={{ background: stat.gradient }}>
                    {stat.icon}
                  </div>
                  <div>
                    <h3 className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight">{stat.value}</h3>
                    <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{stat.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* List & Filters Container */}
            <div className="w-full bg-white/90 backdrop-blur-xl rounded-3xl shadow-sm border border-slate-200/60 p-6 sm:p-8">
              
              {/* Filter Row */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between mb-6">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search user, action, or IP address..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#7B3AED]/30 focus:bg-white transition-all"
                  />
                </div>
                <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
                  <span className="text-sm font-semibold text-slate-500">Transaction Status:</span>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="h-11 px-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold text-slate-700 cursor-pointer focus:outline-none"
                  >
                    <option>All</option>
                    <option>Success</option>
                    <option>Failed</option>
                  </select>
                </div>
              </div>

              {/* Table Grid */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <th className="pb-4 pl-2">Timestamp</th>
                      <th className="pb-4">Authorized User</th>
                      <th className="pb-4">Organization</th>
                      <th className="pb-4">Action Event</th>
                      <th className="pb-4">Status</th>
                      <th className="pb-4">IP Address</th>
                      <th className="pb-4 pr-2 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                        <td className="py-4 pl-2 text-sm font-semibold text-slate-400">{log.timestamp}</td>
                        <td className="py-4 text-sm font-bold text-slate-800">{log.user}</td>
                        <td className="py-4 text-sm font-semibold text-slate-500">{log.org}</td>
                        <td className="py-4 text-sm font-bold text-slate-700">{log.action}</td>
                        <td className="py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                            log.status === 'Success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                          }`}>
                            {log.status === 'Success' ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                            {log.status}
                          </span>
                        </td>
                        <td className="py-4 text-sm font-bold text-slate-600 font-mono">{log.ip}</td>
                        <td className="py-4 pr-2 text-right">
                          <button className="p-2 text-slate-400 hover:text-[#7B3AED] hover:bg-indigo-50 rounded-xl transition-all" title="View details">
                            <Info className="w-4.5 h-4.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>

          </div>
        </div>
      </div>
    </AppShell>
  )
}
