'use client'

import { useState, useEffect, useRef } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Folder,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  Ban,
  CheckCircle,
  X,
  Info,
  Calendar,
  Filter,
  User,
  Users,
  Target,
  TrendingUp,
  Tag
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useNotebooks } from '@/lib/hooks/use-notebooks'
import { useAuthStore } from '@/lib/stores/auth-store'
import { notebooksApi } from '@/lib/api/notebooks'
import { useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/api/query-client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface CaseRecord {
  id: string
  caseId: string
  name: string
  assignee: string
  team: string
  priority: 'Low' | 'Medium' | 'High' | 'Critical'
  status: 'Active' | 'Pending' | 'Review'
  progress: number
  dueDate: string
  description: string
  tags: string[]
}

const initialCases: CaseRecord[] = [
  {
    id: '1',
    caseId: 'INV-2847',
    name: 'Financial Fraud Investigation',
    assignee: 'Sarah Johnson',
    team: 'Finance Team',
    priority: 'High',
    status: 'Active',
    progress: 65,
    dueDate: 'Jun 15, 2026',
    description: 'Investigation into unauthorized transaction logs and wire transfers.',
    tags: ['Fraud', 'Audit']
  },
  {
    id: '2',
    caseId: 'INV-2846',
    name: 'Data Breach Analysis',
    assignee: 'Mike Chen',
    team: 'Cyber Crime',
    priority: 'Critical',
    status: 'Active',
    progress: 82,
    dueDate: 'Jun 12, 2026',
    description: 'Analyzing firewall breaches and customer credential leakage logs.',
    tags: ['Security', 'Breach']
  },
  {
    id: '3',
    caseId: 'INV-2845',
    name: 'Compliance Audit',
    assignee: 'Emily Rodriguez',
    team: 'Operations',
    priority: 'Medium',
    status: 'Pending',
    progress: 45,
    dueDate: 'Jun 20, 2026',
    description: 'Standard quarterly compliance and data access privilege reviews.',
    tags: ['Compliance', 'Internal']
  },
  {
    id: '4',
    caseId: 'INV-2844',
    name: 'Internal Investigation',
    assignee: 'David Kim',
    team: 'Investigation',
    priority: 'Low',
    status: 'Active',
    progress: 30,
    dueDate: 'Jun 25, 2026',
    description: 'Investigating potential data exfiltration by internal endpoints.',
    tags: ['Internal', 'Exfiltration']
  },
  {
    id: '5',
    caseId: 'INV-2843',
    name: 'Employee Background Check',
    assignee: 'Lisa Thompson',
    team: 'HR Team',
    priority: 'Medium',
    status: 'Active',
    progress: 58,
    dueDate: 'Jun 18, 2026',
    description: 'Verification check for incoming C-level executive records.',
    tags: ['HR', 'Verification']
  },
  {
    id: '6',
    caseId: 'INV-2842',
    name: 'Asset Recovery Case',
    assignee: 'James Wilson',
    team: 'Legal',
    priority: 'High',
    status: 'Review',
    progress: 90,
    dueDate: 'Jun 16, 2026',
    description: 'Legal processes to track and freeze cryptocurrency assets.',
    tags: ['Asset', 'Crypto']
  },
  {
    id: '7',
    caseId: 'INV-2841',
    name: 'Vendor Due Diligence',
    assignee: 'Maria Garcia',
    team: 'Finance Team',
    priority: 'Medium',
    status: 'Active',
    progress: 40,
    dueDate: 'Jun 22, 2026',
    description: 'Reviewing vendor supply chain certifications and system risk.',
    tags: ['Vendor', 'Risk']
  },
  {
    id: '8',
    caseId: 'INV-2840',
    name: 'Security Incident Response',
    assignee: 'Robert Brown',
    team: 'Cyber Crime',
    priority: 'Critical',
    status: 'Active',
    progress: 75,
    dueDate: 'Jun 10, 2026',
    description: 'Response handling for ransomware threat payload deployment.',
    tags: ['Ransomware', 'Incident']
  }
]

// Generate exactly 1,879 mock cases to make the list total exactly 1,887 cases
const generateMockCases = (): CaseRecord[] => {
  const list = [...initialCases]
  const names = [
    'Phishing Attack Mitigation', 'IP Theft Recovery', 'Cloud API Risk Review', 'Insider Threat Monitoring', 'Log Hijack Detection',
    'Phish Log Investigation', 'Ransomware Recovery', 'DB Privilege Audit', 'Suspicious Login Forensic', 'Identity Theft Case'
  ]
  const assignees = ['Sarah Johnson', 'Mike Chen', 'Emily Rodriguez', 'David Kim', 'Lisa Thompson', 'James Wilson', 'Maria Garcia', 'Robert Brown']
  const teams = ['Finance Team', 'Cyber Crime', 'Operations', 'Investigation', 'HR Team', 'Legal']
  const priorities: CaseRecord['priority'][] = ['Low', 'Medium', 'High', 'Critical']
  const statuses: CaseRecord['status'][] = ['Active', 'Pending', 'Review']

  // Target counts:
  // Total: 1887
  // Active: 324 (Currently 6 in initial list) -> We need 318 more active.
  // Completed: 1563 (Currently 0) -> We need 1563 completed.
  // Due this week: 23 (e.g. index % 80 === 0)
  let activeNeeded = 318
  let completedNeeded = 1563

  for (let i = 9; i <= 1887; i++) {
    const isCompleted = completedNeeded > 0 && (i % 2 === 0 || activeNeeded <= 0)
    let progress = 50
    let status: CaseRecord['status'] = 'Active'

    if (isCompleted) {
      progress = 100
      status = 'Review'
      completedNeeded--
    } else if (activeNeeded > 0) {
      progress = 25 + (i % 60)
      status = 'Active'
      activeNeeded--
    } else {
      status = statuses[i % statuses.length]
      progress = 10 + (i % 80)
    }

    const priority = priorities[i % priorities.length]

    list.push({
      id: String(i),
      caseId: `INV-${2847 + i}`,
      name: names[i % names.length] + ` - Row ${i}`,
      assignee: assignees[i % assignees.length],
      team: teams[i % teams.length],
      priority,
      status,
      progress,
      dueDate: `Jun ${10 + (i % 20)}, 2026`,
      description: 'System generated monitoring record.',
      tags: ['Auto', 'System']
    })
  }
  return list
}

export default function CasesPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: dbNotebooks } = useNotebooks(false)
  const { data: dbArchivedNotebooks } = useNotebooks(true)
  const currentUserEmail = useAuthStore(s => s.currentUserEmail)

  const [searchTerm, setSearchTerm] = useState('')
  const [cases, setCases] = useState<CaseRecord[]>(() => generateMockCases())
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  // Filters State
  const [showFiltersPanel, setShowFiltersPanel] = useState(false)
  const [filterPriority, setFilterPriority] = useState<string>('Priority')
  const [filterStatus, setFilterStatus] = useState<string>('Status')
  const [filterTeam, setFilterTeam] = useState<string>('Team')

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCaseId, setEditingCaseId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    caseType: 'Fraud',
    priority: 'Medium' as CaseRecord['priority'],
    description: '',
    assignee: 'Sarah Johnson',
    team: 'Finance Team',
    dueDate: '2026-06-30',
    tags: ''
  })

  // ── Claim unowned notebooks session logic ────────────────────────────────
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

  // Sync database items with the local mock data
  useEffect(() => {
    const list = generateMockCases()
    const activeDb = dbNotebooks || []
    const archivedDb = dbArchivedNotebooks || []
    const allDb = [...activeDb, ...archivedDb]

    if (allDb.length > 0) {
      const dbCases: CaseRecord[] = allDb.map((nb, idx) => ({
        id: nb.id,
        caseId: `INV-${3000 + idx}`,
        name: nb.name,
        assignee: 'Sarah Johnson',
        team: 'Finance Team',
        priority: 'Medium',
        status: nb.archived ? 'Review' : 'Active',
        progress: 50,
        dueDate: 'Jun 30, 2026',
        description: nb.description || '',
        tags: []
      }))
      setCases([...dbCases, ...list])
    } else {
      setCases(list)
    }
  }, [dbNotebooks, dbArchivedNotebooks])

  const handleSearchChange = (val: string) => {
    setSearchTerm(val)
    setCurrentPage(1)
  }

  const handlePriorityChange = (val: string) => {
    setFilterPriority(val)
    setCurrentPage(1)
  }

  const handleStatusChange = (val: string) => {
    setFilterStatus(val)
    setCurrentPage(1)
  }

  const handleTeamChange = (val: string) => {
    setFilterTeam(val)
    setCurrentPage(1)
  }

  const handleEditCase = (c: CaseRecord) => {
    setEditingCaseId(c.id)
    setFormData({
      name: c.name,
      caseType: c.tags[0] || 'Fraud',
      priority: c.priority,
      description: c.description,
      assignee: c.assignee,
      team: c.team,
      dueDate: c.dueDate.includes(',') ? '2026-06-30' : c.dueDate,
      tags: c.tags.join(', ')
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingCaseId(null)
    setFormData({
      name: '',
      caseType: 'Fraud',
      priority: 'Medium',
      description: '',
      assignee: 'Sarah Johnson',
      team: 'Finance Team',
      dueDate: '2026-06-30',
      tags: ''
    })
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const parsedTags = formData.tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)

    if (editingCaseId) {
      const updated = cases.map(c => {
        if (c.id === editingCaseId) {
          return {
            ...c,
            name: formData.name,
            priority: formData.priority,
            description: formData.description,
            assignee: formData.assignee,
            team: formData.team,
            dueDate: formData.dueDate,
            tags: parsedTags.length > 0 ? parsedTags : [formData.caseType]
          }
        }
        return c
      })
      setCases(updated)
      handleCloseModal()
    } else {
      const newCase: CaseRecord = {
        id: String(cases.length + 1),
        caseId: `INV-${2847 + cases.length}`,
        name: formData.name,
        assignee: formData.assignee,
        team: formData.team,
        priority: formData.priority,
        status: 'Active',
        progress: 0,
        dueDate: formData.dueDate,
        description: formData.description,
        tags: parsedTags.length > 0 ? parsedTags : [formData.caseType]
      }
      setCases([newCase, ...cases])
      handleCloseModal()
    }
  }

  // Row navigation click (simulates original cases redirect)
  const handleRowClick = (id: string) => {
    const shortId = id.includes(':') ? id.split(':')[1] : id
    router.push(`/notebooks/${shortId}`)
  }

  // Filter computation
  const filteredCases = cases.filter(c => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.caseId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.assignee.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesPriority = filterPriority === 'Priority' || c.priority === filterPriority
    const matchesStatus = filterStatus === 'Status' || c.status === filterStatus
    const matchesTeam = filterTeam === 'Team' || c.team === filterTeam

    return matchesSearch && matchesPriority && matchesStatus && matchesTeam
  })

  const totalPages = Math.ceil(filteredCases.length / pageSize)
  const paginatedCases = filteredCases.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Calculations for mock KPI layout matching screenshot exactly
  const completedCount = cases.filter(c => c.progress === 100).length
  const activeCount = cases.filter(c => c.status === 'Active' && c.progress < 100).length

  const stats = [
    { label: 'Total Cases', value: String(cases.length), trend: '↑ 8% from last month', isPositive: true },
    { label: 'Active Cases', value: String(activeCount), trend: '17.2% of total', isPositive: true, isBlue: true },
    { label: 'Completed', value: String(completedCount), trend: '82.8% completion rate', isPositive: true },
    { label: 'Due This Week', value: '23', trend: '5 high priority', isPositive: false }
  ]

  const getAvatarBg = (name: string) => {
    const code = name.charCodeAt(0) % 5
    if (code === 0) return 'bg-indigo-100 text-indigo-600'
    if (code === 1) return 'bg-purple-100 text-purple-600'
    if (code === 2) return 'bg-blue-100 text-blue-600'
    if (code === 3) return 'bg-emerald-100 text-emerald-600'
    return 'bg-amber-100 text-amber-600'
  }

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 bg-[#F8F9FD] overflow-hidden">
        <PageHeader searchValue={searchTerm} onSearchChange={handleSearchChange} />

        <div className="flex-1 overflow-y-auto z-10 custom-scrollbar">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            
            {/* Title Section */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-50 text-emerald-600">
                  <Folder className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h1 className="text-[20px] font-bold text-slate-800 leading-tight">Cases Management</h1>
                  <p className="text-[12px] text-slate-400 font-semibold mt-0.5">Track and manage all investigation cases</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingCaseId(null)
                  setFormData({
                    name: '',
                    caseType: 'Fraud',
                    priority: 'Medium',
                    description: '',
                    assignee: 'Sarah Johnson',
                    team: 'Finance Team',
                    dueDate: '2026-06-30',
                    tags: ''
                  })
                  setIsModalOpen(true)
                }}
                style={{ backgroundColor: '#10b981' }}
                className="hover:bg-emerald-700 text-white font-bold text-[12px] px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                <span>Create Case</span>
              </button>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {stats.map((card, idx) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08, duration: 0.4 }}
                  className="bg-white rounded-[16px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100 flex flex-col gap-3 text-left group hover:shadow-md transition-all duration-300"
                >
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{card.label}</span>
                  <h3 className="text-[28px] font-extrabold text-slate-800 leading-none">{card.value}</h3>
                  <span className={`text-[12px] font-bold ${
                    card.isBlue ? 'text-blue-500' : card.isPositive ? 'text-emerald-500' : 'text-amber-500'
                  }`}>
                    {card.trend}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Table & Filters Card */}
            <div className="bg-white rounded-[20px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100 space-y-6">
              
              {/* Search & Filter Row */}
              <div className="flex gap-4 items-center justify-between">
                <div className="relative w-full sm:max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search cases by ID, name, or assignee..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full h-11 pl-12 pr-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all font-medium"
                  />
                </div>
                <button
                  onClick={() => setShowFiltersPanel(!showFiltersPanel)}
                  className={`h-11 px-4 border rounded-lg text-sm font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    showFiltersPanel
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-605'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                </button>
              </div>

              {/* Collapsible Filters Panel */}
              {showFiltersPanel && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap items-center gap-4 p-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-left"
                >
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Priority</span>
                    <select
                      value={filterPriority}
                      onChange={(e) => handlePriorityChange(e.target.value)}
                      className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-w-[120px]"
                    >
                      <option value="Priority">All Priorities</option>
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Status</span>
                    <select
                      value={filterStatus}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-w-[120px]"
                    >
                      <option value="Status">All Statuses</option>
                      <option value="Active">Active</option>
                      <option value="Pending">Pending</option>
                      <option value="Review">Review</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Team</span>
                    <select
                      value={filterTeam}
                      onChange={(e) => handleTeamChange(e.target.value)}
                      className="h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all min-w-[140px]"
                    >
                      <option value="Team">All Teams</option>
                      {Array.from(new Set(cases.map(c => c.team))).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-end h-[50px] pl-2">
                    <button
                      onClick={() => {
                        setSearchTerm('')
                        setFilterPriority('Priority')
                        setFilterStatus('Status')
                        setFilterTeam('Team')
                        setCurrentPage(1)
                      }}
                      className="text-xs font-bold text-emerald-600 hover:text-emerald-800 hover:underline transition-colors px-2 py-1.5 cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Cases Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 font-semibold">Case ID</th>
                      <th className="pb-3 font-semibold">Case Name</th>
                      <th className="pb-3 font-semibold">Assignee</th>
                      <th className="pb-3 font-semibold">Team</th>
                      <th className="pb-3 font-semibold">Priority</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Progress</th>
                      <th className="pb-3 font-semibold">Due Date</th>
                      <th className="pb-3 font-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCases.map((c) => (
                      <tr key={c.id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/30 transition-colors">
                        <td className="py-3.5">
                          <span
                            onClick={() => handleRowClick(c.id)}
                            className="text-emerald-600 font-bold text-[13px] hover:underline cursor-pointer"
                          >
                            {c.caseId}
                          </span>
                        </td>
                        <td className="py-3.5">
                          <span
                            onClick={() => handleRowClick(c.id)}
                            className="text-[14px] font-bold text-slate-800 hover:text-indigo-650 cursor-pointer"
                          >
                            {c.name}
                          </span>
                        </td>
                        <td className="py-3.5 text-[13px] font-semibold text-slate-500 text-left">
                          <div className="flex items-center gap-2">
                            <div className={`w-6.5 h-6.5 rounded-full flex items-center justify-center font-bold text-[9px] ${getAvatarBg(c.assignee)}`}>
                              {c.assignee.split(' ').map(n=>n[0]).join('')}
                            </div>
                            <span>{c.assignee}</span>
                          </div>
                        </td>
                        <td className="py-3.5 text-[13px] font-semibold text-slate-500 text-left">
                          {c.team}
                        </td>
                        <td className="py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${
                            c.priority === 'Critical' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                            c.priority === 'High' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            c.priority === 'Medium' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                            'bg-slate-50 text-slate-500 border-slate-200'
                          }`}>
                            {c.priority}
                          </span>
                        </td>
                        <td className="py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${
                            c.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                            c.status === 'Pending' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                            'bg-purple-50 text-purple-650 border border-purple-100'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-600 w-8">{c.progress}%</span>
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${c.progress}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 text-[13px] font-semibold text-slate-500 text-left">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{c.dueDate}</span>
                          </div>
                        </td>
                        <td className="py-3.5 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="text-slate-400 hover:text-slate-650 hover:bg-slate-50 transition-colors p-1.5 rounded-full cursor-pointer inline-flex items-center justify-center">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl shadow-lg border border-slate-100 bg-white p-1 min-w-[140px] z-[100]">
                              <DropdownMenuItem
                                onClick={() => handleEditCase(c)}
                                className="rounded-lg cursor-pointer flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:text-slate-800 outline-none"
                              >
                                <Edit className="h-3.5 w-3.5 text-slate-400" />
                                <span>Edit Case</span>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  const updated = cases.map(item => {
                                    if (item.id === c.id) {
                                      const isPending = item.status === 'Pending'
                                      return {
                                        ...item,
                                        status: (isPending ? 'Active' : 'Pending') as 'Active' | 'Pending',
                                      }
                                    }
                                    return item
                                  })
                                  setCases(updated)
                                }}
                                className="rounded-lg cursor-pointer flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:text-slate-800 outline-none"
                              >
                                {c.status === 'Pending' ? (
                                  <>
                                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                    <span>Activate</span>
                                  </>
                                ) : (
                                  <>
                                    <Ban className="h-3.5 w-3.5 text-amber-500" />
                                    <span>Hold/Pending</span>
                                  </>
                                )}
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  setCases(cases.filter(item => item.id !== c.id))
                                }}
                                className="rounded-lg cursor-pointer flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-rose-600 hover:bg-rose-50 focus:bg-rose-50 focus:text-rose-700 border-t border-slate-50 outline-none"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Table Pagination */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="text-[12px] text-slate-400 font-bold">
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredCases.length)} of {filteredCases.length} cases
                </span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-[12px] font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                      const isActive = page === currentPage
                      if (totalPages > 6 && page > 3 && page < totalPages) {
                        if (page === 4) {
                          return <span key="ellipsis" className="text-slate-400 px-1 font-bold text-[12px]">...</span>
                        }
                        return null
                      }
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          style={isActive ? { backgroundColor: '#10b981', borderColor: '#10b981', color: '#ffffff' } : {}}
                          className={`w-8 h-8 rounded-lg text-[12px] font-bold border flex items-center justify-center cursor-pointer transition-colors ${
                            isActive ? 'shadow-xs animate-pulse-once' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    })}
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-[12px] font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none cursor-pointer transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>

            </div>

          </div>
        </div>
      </div>

      {/* Create/Edit Case Popup Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4 py-8 overflow-y-auto">
          <div className="bg-white w-full max-w-[680px] rounded-2xl shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-100 shrink-0 text-left">
              <div>
                <h2 className="text-[20px] font-bold text-slate-800">
                  {editingCaseId ? 'Edit Case Information' : 'Create New Case'}
                </h2>
                <p className="text-[12px] text-slate-400 font-semibold mt-0.5">
                  {editingCaseId ? 'Modify case scope, assignment, and timeline parameters' : 'Fill in the details to create a new investigation case'}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-650 hover:bg-slate-50 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Scrollable Form */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-left">
              
              {/* SECTION 1: Case Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                  <Folder className="h-4.5 w-4.5 text-emerald-500" />
                  <h3 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">Case Information</h3>
                </div>

                {/* Case Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Case Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="Enter case name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all"
                  />
                </div>

                {/* Case Type & Priority */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Case Type *</label>
                    <select
                      required
                      value={formData.caseType}
                      onChange={(e) => setFormData({...formData, caseType: e.target.value})}
                      className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="Fraud">Fraud</option>
                      <option value="Data Breach">Data Breach</option>
                      <option value="Compliance">Compliance</option>
                      <option value="Internal">Internal</option>
                      <option value="Background Check">Background Check</option>
                      <option value="Asset Recovery">Asset Recovery</option>
                      <option value="Due Diligence">Due Diligence</option>
                      <option value="Security Incident">Security Incident</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Priority Level *</label>
                    <select
                      required
                      value={formData.priority}
                      onChange={(e) => setFormData({...formData, priority: e.target.value as CaseRecord['priority']})}
                      className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Description *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Enter detailed case description"
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all resize-none"
                  />
                </div>
              </div>

              {/* SECTION 2: Assignment & Timeline */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                  <User className="h-4.5 w-4.5 text-emerald-500" />
                  <h3 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">Assignment & Timeline</h3>
                </div>

                {/* Assignee & Team */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Assignee *</label>
                    <select
                      required
                      value={formData.assignee}
                      onChange={(e) => setFormData({...formData, assignee: e.target.value})}
                      className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="Sarah Johnson">Sarah Johnson</option>
                      <option value="Mike Chen">Mike Chen</option>
                      <option value="Emily Rodriguez">Emily Rodriguez</option>
                      <option value="David Kim">David Kim</option>
                      <option value="Lisa Thompson">Lisa Thompson</option>
                      <option value="James Wilson">James Wilson</option>
                      <option value="Maria Garcia">Maria Garcia</option>
                      <option value="Robert Brown">Robert Brown</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Team *</label>
                    <select
                      required
                      value={formData.team}
                      onChange={(e) => setFormData({...formData, team: e.target.value})}
                      className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="Finance Team">Finance Team</option>
                      <option value="Cyber Crime">Cyber Crime</option>
                      <option value="Operations">Operations</option>
                      <option value="Investigation">Investigation</option>
                      <option value="HR Team">HR Team</option>
                      <option value="Legal">Legal</option>
                    </select>
                  </div>
                </div>

                {/* Due Date & Tags */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Due Date *</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                      <input
                        required
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({...formData, dueDate: e.target.value})}
                        className="w-full h-10 pl-10 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Tags</label>
                    <div className="relative">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Add tags (comma separated)"
                        value={formData.tags}
                        onChange={(e) => setFormData({...formData, tags: e.target.value})}
                        className="w-full h-10 pl-10 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Info banner */}
              <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex gap-3 text-left">
                <Info className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[12px] font-bold text-emerald-800">Case Creation</h4>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-0.5 leading-normal">
                    The assigned user will be notified via email and the case will appear in their dashboard immediately.
                  </p>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-5 h-10 rounded-lg border border-slate-200 text-slate-600 text-[13px] font-bold hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ backgroundColor: '#10b981' }}
                  className="px-5 h-10 rounded-lg text-white text-[13px] font-bold shadow-sm cursor-pointer hover:bg-emerald-700 transition-colors"
                >
                  {editingCaseId ? 'Save Changes' : 'Create Case'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
