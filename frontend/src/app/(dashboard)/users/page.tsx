'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Users,
  UserCheck,
  UserX,
  Search,
  Plus,
  Mail,
  MoreHorizontal,
  Edit,
  Trash2,
  Ban,
  CheckCircle,
  Phone,
  Briefcase,
  X,
  Info,
  Building2,
  Lock,
  ShieldAlert
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface UserRecord {
  id: string
  name: string
  firstName: string
  lastName: string
  email: string
  phone: string
  org: string
  team: string
  role: 'Analyst' | 'Investigator' | 'Specialist' | 'Reviewer'
  cases: number
  status: 'Active' | 'Locked' | 'Suspended'
  lastLogin: string
  permissions: {
    viewCases: boolean
    createCases: boolean
    editCases: boolean
    deleteCases: boolean
    viewReports: boolean
    exportData: boolean
  }
}

const initialUsers: UserRecord[] = [
  {
    id: '1',
    name: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@deltapolice.gov.in',
    phone: '+91 98765 43210',
    org: 'Delta Police',
    team: 'Investigation Team',
    role: 'Analyst',
    cases: 18,
    status: 'Active',
    lastLogin: '2 hours ago',
    permissions: {
      viewCases: true,
      createCases: false,
      editCases: false,
      deleteCases: false,
      viewReports: true,
      exportData: false
    }
  },
  {
    id: '2',
    name: 'Anita Verma',
    firstName: 'Anita',
    lastName: 'Verma',
    email: 'anita.verma@delhipolice.gov.in',
    phone: '+91 87654 32109',
    org: 'Delhi Police',
    team: 'Cyber Crime',
    role: 'Analyst',
    cases: 16,
    status: 'Active',
    lastLogin: '1 day ago',
    permissions: {
      viewCases: true,
      createCases: false,
      editCases: false,
      deleteCases: false,
      viewReports: true,
      exportData: false
    }
  },
  {
    id: '3',
    name: 'Rahul Mehta',
    firstName: 'Rahul',
    lastName: 'Mehta',
    email: 'rahul.mehta@finance.gov.in',
    phone: '+91 76543 21098',
    org: 'Finance Dept',
    team: 'Finance Team',
    role: 'Analyst',
    cases: 11,
    status: 'Active',
    lastLogin: '3 hours ago',
    permissions: {
      viewCases: true,
      createCases: false,
      editCases: false,
      deleteCases: false,
      viewReports: true,
      exportData: false
    }
  },
  {
    id: '4',
    name: 'Sneha Patil',
    firstName: 'Sneha',
    lastName: 'Patil',
    email: 'sneha.patil@cybercell.gov.in',
    phone: '+91 65432 10987',
    org: 'Cyber Crime Cell',
    team: 'Cyber Team',
    role: 'Investigator',
    cases: 23,
    status: 'Active',
    lastLogin: '2 days ago',
    permissions: {
      viewCases: true,
      createCases: true,
      editCases: true,
      deleteCases: false,
      viewReports: true,
      exportData: true
    }
  },
  {
    id: '5',
    name: 'Vikram Singh',
    firstName: 'Vikram',
    lastName: 'Singh',
    email: 'vikram.singh@revenue.gov.in',
    phone: '+91 54321 09876',
    org: 'Revenue',
    team: 'Revenue Team',
    role: 'Specialist',
    cases: 9,
    status: 'Active',
    lastLogin: '7 days ago',
    permissions: {
      viewCases: true,
      createCases: true,
      editCases: true,
      deleteCases: true,
      viewReports: true,
      exportData: true
    }
  },
  {
    id: '6',
    name: 'Neha Khanna',
    firstName: 'Neha',
    lastName: 'Khanna',
    email: 'neha.khanna@stateintelligence.gov.in',
    phone: '+91 43210 98765',
    org: 'State Intelligence',
    team: 'Intelligence',
    role: 'Analyst',
    cases: 14,
    status: 'Active',
    lastLogin: '1 hour ago',
    permissions: {
      viewCases: true,
      createCases: false,
      editCases: false,
      deleteCases: false,
      viewReports: true,
      exportData: false
    }
  },
  {
    id: '7',
    name: 'Arjun Mehta',
    firstName: 'Arjun',
    lastName: 'Mehta',
    email: 'arjun.mehta@forensiclab.gov.in',
    phone: '+91 32109 87654',
    org: 'Forensic Lab',
    team: 'Lab Team',
    role: 'Specialist',
    cases: 10,
    status: 'Locked',
    lastLogin: '15 days ago',
    permissions: {
      viewCases: true,
      createCases: false,
      editCases: false,
      deleteCases: false,
      viewReports: true,
      exportData: false
    }
  },
  {
    id: '8',
    name: 'Rohan Kapoor',
    firstName: 'Rohan',
    lastName: 'Kapoor',
    email: 'rohan.kapoor@finance.gov.in',
    phone: '+91 21098 76543',
    org: 'Finance Dept',
    team: 'Audit Team',
    role: 'Reviewer',
    cases: 8,
    status: 'Active',
    lastLogin: '4 hours ago',
    permissions: {
      viewCases: true,
      createCases: false,
      editCases: false,
      deleteCases: false,
      viewReports: true,
      exportData: false
    }
  }
]

// Generate exactly 516 more users so that the pagination footer operates dynamically over multiple pages (total 524)
const generateMockUsers = (): UserRecord[] => {
  const list = [...initialUsers]
  const firstNames = ['Amit', 'Rajesh', 'Sanjay', 'Neha', 'Rahul', 'Sunita', 'Vijay', 'Deepak', 'Komal', 'Harpreet', 'Siddharth', 'Varun', 'Alia', 'Kriti', 'Ranbir', 'Aditya', 'Shraddha', 'Kartik', 'Sara', 'Janhvi']
  const lastNames = ['Kumar', 'Dutt', 'Shah', 'Gupta', 'Sharma', 'Rao', 'Singh', 'Hooda', 'Preet', 'Kapoor', 'Joshi', 'Sen', 'Reddy', 'Roy', 'Bose', 'Pal', 'Gill', 'Nair', 'Hegde', 'Verma']
  const orgs = ['Delta Police', 'Delhi Police', 'Finance Dept', 'Cyber Crime Cell', 'Revenue', 'State Intelligence', 'Forensic Lab']
  const teams = ['Investigation Team', 'Cyber Crime', 'Finance Team', 'Cyber Team', 'Revenue Team', 'Intelligence', 'Lab Team', 'Audit Team']
  const domains = ['deltapolice.gov.in', 'delhipolice.gov.in', 'finance.gov.in', 'cybercell.gov.in', 'revenue.gov.in', 'stateintelligence.gov.in', 'forensiclab.gov.in']
  const roles: UserRecord['role'][] = ['Analyst', 'Investigator', 'Specialist', 'Reviewer']

  // Target counts:
  // Active: 480. (Currently 7) -> We need 473 more active.
  // Locked: 10. (Currently 1) -> We need 9 more locked.
  // Suspended: 34. (Currently 0) -> We need 34 suspended.
  let lockedCount = 0
  let suspendedCount = 0

  for (let i = 9; i <= 524; i++) {
    const fName = firstNames[i % firstNames.length]
    const lName = lastNames[i % lastNames.length]
    const name = `${fName} ${lName}`
    const orgIndex = i % orgs.length
    const email = `${fName.toLowerCase()}.${lName.toLowerCase()}${i}@${domains[orgIndex]}`
    
    let status: 'Active' | 'Locked' | 'Suspended' = 'Active'
    if (lockedCount < 9 && i % 55 === 0) {
      status = 'Locked'
      lockedCount++
    } else if (suspendedCount < 34 && i % 15 === 0) {
      status = 'Suspended'
      suspendedCount++
    }

    list.push({
      id: String(i),
      name,
      firstName: fName,
      lastName: lName,
      email,
      phone: `+91 98765 ${10000 + i}`,
      org: orgs[orgIndex],
      team: teams[i % teams.length],
      role: roles[i % roles.length],
      cases: 5 + (i * 7) % 35,
      status,
      lastLogin: `${i % 12 + 1} hours ago`,
      permissions: {
        viewCases: true,
        createCases: i % 2 === 0,
        editCases: i % 3 === 0,
        deleteCases: false,
        viewReports: true,
        exportData: i % 4 === 0
      }
    })
  }
  return list
}

export default function UsersPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('Status')
  const [filterOrg, setFilterOrg] = useState<string>('Organization')
  const [filterTeam, setFilterTeam] = useState<string>('Team')
  const [users, setUsers] = useState<UserRecord[]>(() => generateMockUsers())

  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    org: '',
    team: '',
    department: '',
    designation: '',
    role: 'Analyst' as UserRecord['role'],
    viewCases: true,
    createCases: false,
    editCases: false,
    deleteCases: false,
    viewReports: false,
    exportData: false
  })

  // Helper change handlers that reset pagination to page 1
  const handleSearchChange = (val: string) => {
    setSearchTerm(val)
    setCurrentPage(1)
  }

  const handleStatusChange = (val: string) => {
    setFilterStatus(val)
    setCurrentPage(1)
  }

  const handleOrgChange = (val: string) => {
    setFilterOrg(val)
    setCurrentPage(1)
  }

  const handleTeamChange = (val: string) => {
    setFilterTeam(val)
    setCurrentPage(1)
  }

  const handleEditUser = (user: UserRecord) => {
    setEditingUserId(user.id)
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      org: user.org,
      team: user.team,
      department: 'Operations',
      designation: user.role,
      role: user.role,
      viewCases: user.permissions.viewCases,
      createCases: user.permissions.createCases,
      editCases: user.permissions.editCases,
      deleteCases: user.permissions.deleteCases,
      viewReports: user.permissions.viewReports,
      exportData: user.permissions.exportData
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingUserId(null)
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      org: '',
      team: '',
      department: '',
      designation: '',
      role: 'Analyst',
      viewCases: true,
      createCases: false,
      editCases: false,
      deleteCases: false,
      viewReports: false,
      exportData: false
    })
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const name = `${formData.firstName} ${formData.lastName}`

    if (editingUserId) {
      const updated = users.map(u => {
        if (u.id === editingUserId) {
          return {
            ...u,
            name,
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            org: formData.org || 'Delta Police',
            team: formData.team || 'Investigation Team',
            role: formData.role,
            permissions: {
              viewCases: formData.viewCases,
              createCases: formData.createCases,
              editCases: formData.editCases,
              deleteCases: formData.deleteCases,
              viewReports: formData.viewReports,
              exportData: formData.exportData
            }
          }
        }
        return u
      })
      setUsers(updated)
      handleCloseModal()
    } else {
      const newUser: UserRecord = {
        id: String(users.length + 1),
        name,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        org: formData.org || 'Delta Police',
        team: formData.team || 'Investigation Team',
        role: formData.role,
        cases: 0,
        status: 'Active',
        lastLogin: 'Just now',
        permissions: {
          viewCases: formData.viewCases,
          createCases: formData.createCases,
          editCases: formData.editCases,
          deleteCases: formData.deleteCases,
          viewReports: formData.viewReports,
          exportData: formData.exportData
        }
      }
      setUsers([newUser, ...users])
      handleCloseModal()
    }
  }

  // Filter calculation
  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.org.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.team.toLowerCase().includes(searchTerm.toLowerCase())
      
    const matchesStatus = filterStatus === 'Status' || user.status === filterStatus
    const matchesOrg = filterOrg === 'Organization' || user.org === filterOrg
    const matchesTeam = filterTeam === 'Team' || user.team === filterTeam
    
    return matchesSearch && matchesStatus && matchesOrg && matchesTeam
  })

  const totalPages = Math.ceil(filteredUsers.length / pageSize)
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Dynamic stats calculation matching mockup counts exactly
  const activeCount = users.filter(u => u.status === 'Active').length
  const inactiveCount = users.filter(u => u.status === 'Suspended').length
  const lockedCount = users.filter(u => u.status === 'Locked').length

  const stats = [
    { label: 'Total Users', value: String(users.length), trend: '↑ +16.4%', isPositive: true },
    { label: 'Active Users', value: String(activeCount), trend: '↓ -8.5%', isPositive: false },
    { label: 'Inactive Users', value: String(inactiveCount), trend: '', isPositive: true },
    { label: 'Locked Users', value: String(lockedCount), trend: '↑ +5.0%', isPositive: true },
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
            
            {/* Title block */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#EEF2FF] text-indigo-600">
                  <Users className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h1 className="text-[20px] font-bold text-slate-800 leading-tight">Users</h1>
                  <p className="text-[12px] text-slate-400 font-semibold mt-0.5">View and manage all users across organizations</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingUserId(null)
                  setFormData({
                    firstName: '',
                    lastName: '',
                    email: '',
                    phone: '',
                    org: '',
                    team: '',
                    department: '',
                    designation: '',
                    role: 'Analyst',
                    viewCases: true,
                    createCases: false,
                    editCases: false,
                    deleteCases: false,
                    viewReports: false,
                    exportData: false
                  })
                  setIsModalOpen(true)
                }}
                style={{ backgroundColor: '#4f46e5' }}
                className="hover:bg-indigo-700 text-white font-bold text-[12px] px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                <span>Invite User</span>
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
                  {card.trend && (
                    <span className={`text-[12px] font-bold ${card.isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {card.trend}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Table & Filters Card */}
            <div className="bg-white rounded-[20px] p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100 space-y-6">
              
              {/* Search & Filter Row */}
              <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                <div className="relative w-full lg:max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full h-11 pl-12 pr-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>
                
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
                  <select
                    value={filterStatus}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  >
                    <option value="Status">Status</option>
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Locked">Locked</option>
                  </select>

                  <select
                    value={filterOrg}
                    onChange={(e) => handleOrgChange(e.target.value)}
                    className="h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  >
                    <option value="Organization">Organization</option>
                    {Array.from(new Set(users.map(u => u.org))).map(org => (
                      <option key={org} value={org}>{org}</option>
                    ))}
                  </select>

                  <select
                    value={filterTeam}
                    onChange={(e) => handleTeamChange(e.target.value)}
                    className="h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  >
                    <option value="Team">Team</option>
                    {Array.from(new Set(users.map(u => u.team))).map(team => (
                      <option key={team} value={team}>{team}</option>
                    ))}
                  </select>

                  <button
                    onClick={() => {
                      setSearchTerm('')
                      setFilterStatus('Status')
                      setFilterOrg('Organization')
                      setFilterTeam('Team')
                      setCurrentPage(1)
                    }}
                    className="text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors px-2 py-1 cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 font-semibold">User</th>
                      <th className="pb-3 font-semibold">Organization</th>
                      <th className="pb-3 font-semibold">Team</th>
                      <th className="pb-3 font-semibold">Role</th>
                      <th className="pb-3 font-semibold">Cases</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Last Login</th>
                      <th className="pb-3 font-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((user) => (
                      <tr key={user.id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/30 transition-colors">
                        <td className="py-3.5">
                          <div className="flex items-center gap-3 text-left">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] ${getAvatarBg(user.name)}`}>
                              {user.name.split(' ').map(n=>n[0]).join('')}
                            </div>
                            <span className="text-[14px] font-bold text-slate-800">{user.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 text-[13px] font-semibold text-slate-500 text-left">
                          {user.org}
                        </td>
                        <td className="py-3.5 text-[13px] font-medium text-slate-500 text-left">
                          {user.team}
                        </td>
                        <td className="py-3.5 text-[13px] font-semibold text-slate-500 text-left">
                          {user.role}
                        </td>
                        <td className="py-3.5 text-[13px] font-bold text-slate-700 text-left pl-4">
                          {user.cases}
                        </td>
                        <td className="py-3.5 text-left">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${
                            user.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            user.status === 'Locked' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                            'bg-amber-50 text-amber-600 border-amber-100'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              user.status === 'Active' ? 'bg-emerald-500' :
                              user.status === 'Locked' ? 'bg-rose-500' :
                              'bg-amber-500'
                            }`} />
                            {user.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-[13px] font-semibold text-slate-500 text-left">{user.lastLogin}</td>
                        <td className="py-3.5 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="text-slate-400 hover:text-slate-650 hover:bg-slate-50 transition-colors p-1.5 rounded-full cursor-pointer inline-flex items-center justify-center">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl shadow-lg border border-slate-100 bg-white p-1 min-w-[140px] z-[100]">
                              <DropdownMenuItem
                                onClick={() => handleEditUser(user)}
                                className="rounded-lg cursor-pointer flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:text-slate-800 outline-none"
                              >
                                <Edit className="h-3.5 w-3.5 text-slate-400" />
                                <span>Edit User</span>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  const updated = users.map(u => {
                                    if (u.id === user.id) {
                                      const isSuspended = u.status === 'Suspended'
                                      return {
                                        ...u,
                                        status: (isSuspended ? 'Active' : 'Suspended') as 'Active' | 'Suspended',
                                      }
                                    }
                                    return u
                                  })
                                  setUsers(updated)
                                }}
                                className="rounded-lg cursor-pointer flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:text-slate-800 outline-none"
                              >
                                {user.status === 'Suspended' ? (
                                  <>
                                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                    <span>Activate</span>
                                  </>
                                ) : (
                                  <>
                                    <Ban className="h-3.5 w-3.5 text-amber-500" />
                                    <span>Suspend</span>
                                  </>
                                )}
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  setUsers(users.filter(u => u.id !== user.id))
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
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredUsers.length)} of {filteredUsers.length} users
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
                      // Handle mockup pagination detail: showing 1 2 3 4 5 ... 66
                      if (totalPages > 6 && page > 5 && page < totalPages) {
                        if (page === 6) {
                          return <span key="ellipsis" className="text-slate-400 px-1 font-bold text-[12px]">...</span>
                        }
                        return null
                      }
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          style={isActive ? { backgroundColor: '#4f46e5', borderColor: '#4f46e5', color: '#ffffff' } : {}}
                          className={`w-8 h-8 rounded-lg text-[12px] font-bold border flex items-center justify-center cursor-pointer transition-colors ${
                            isActive ? 'shadow-xs' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
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

      {/* Invite/Edit User Popup Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4 py-8 overflow-y-auto">
          <div className="bg-white w-full max-w-[680px] rounded-2xl shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-100 shrink-0 text-left">
              <div>
                <h2 className="text-[20px] font-bold text-slate-800">
                  {editingUserId ? 'Edit User Configuration' : 'Invite New User'}
                </h2>
                <p className="text-[12px] text-slate-400 font-semibold mt-0.5">
                  {editingUserId ? 'Modify user account parameters and permissions' : 'Send an invitation to join your organization'}
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
              
              {/* SECTION 1: Personal Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                  <Users className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">Personal Information</h3>
                </div>

                {/* Name fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">First Name *</label>
                    <input
                      required
                      type="text"
                      placeholder="Enter first name"
                      value={formData.firstName}
                      onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                      className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Last Name *</label>
                    <input
                      required
                      type="text"
                      placeholder="Enter last name"
                      value={formData.lastName}
                      onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                      className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Email Address *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                      <input
                        required
                        type="email"
                        placeholder="user@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full h-10 pl-10 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                      <input
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full h-10 pl-10 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Organization & Team */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                  <Building2 className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">Organization & Team</h3>
                </div>

                {/* Organization & Team Selects */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Organization *</label>
                    <select
                      required
                      value={formData.org}
                      onChange={(e) => setFormData({...formData, org: e.target.value})}
                      className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="">Select organization</option>
                      <option value="Delta Police">Delta Police</option>
                      <option value="Delhi Police">Delhi Police</option>
                      <option value="Finance Dept">Finance Dept</option>
                      <option value="Cyber Crime Cell">Cyber Crime Cell</option>
                      <option value="Revenue">Revenue</option>
                      <option value="State Intelligence">State Intelligence</option>
                      <option value="Forensic Lab">Forensic Lab</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Team *</label>
                    <select
                      required
                      value={formData.team}
                      onChange={(e) => setFormData({...formData, team: e.target.value})}
                      className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="">Select team</option>
                      <option value="Investigation Team">Investigation Team</option>
                      <option value="Cyber Crime">Cyber Crime</option>
                      <option value="Finance Team">Finance Team</option>
                      <option value="Cyber Team">Cyber Team</option>
                      <option value="Revenue Team">Revenue Team</option>
                      <option value="Intelligence">Intelligence</option>
                      <option value="Lab Team">Lab Team</option>
                      <option value="Audit Team">Audit Team</option>
                    </select>
                  </div>
                </div>

                {/* Department & Designation */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Department</label>
                    <input
                      type="text"
                      placeholder="e.g., Investigation"
                      value={formData.department}
                      onChange={(e) => setFormData({...formData, department: e.target.value})}
                      className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Designation</label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="e.g., Senior Analyst"
                        value={formData.designation}
                        onChange={(e) => setFormData({...formData, designation: e.target.value})}
                        className="w-full h-10 pl-10 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Role & Permissions */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                  <Lock className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">Role & Permissions</h3>
                </div>

                {/* User Role */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">User Role *</label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value as UserRecord['role']})}
                    className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                  >
                    <option value="Analyst">Analyst</option>
                    <option value="Investigator">Investigator</option>
                    <option value="Specialist">Specialist</option>
                    <option value="Reviewer">Reviewer</option>
                  </select>
                </div>

                {/* Permissions checkboxes grid */}
                <div className="space-y-3">
                  <label className="block text-[11px] font-bold text-slate-600">Permissions</label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* View Cases */}
                    <label className="flex items-start gap-3 p-3 border border-slate-150 rounded-xl hover:bg-slate-50/50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.viewCases}
                        onChange={(e) => setFormData({...formData, viewCases: e.target.checked})}
                        className="mt-1 h-4 w-4 rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div>
                        <span className="block text-sm font-bold text-slate-700">View Cases</span>
                        <span className="text-[11px] text-slate-400 font-semibold mt-0.5 block">View all assigned cases</span>
                      </div>
                    </label>

                    {/* Create Cases */}
                    <label className="flex items-start gap-3 p-3 border border-slate-150 rounded-xl hover:bg-slate-50/50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.createCases}
                        onChange={(e) => setFormData({...formData, createCases: e.target.checked})}
                        className="mt-1 h-4 w-4 rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div>
                        <span className="block text-sm font-bold text-slate-700">Create Cases</span>
                        <span className="text-[11px] text-slate-400 font-semibold mt-0.5 block">Create new cases</span>
                      </div>
                    </label>

                    {/* Edit Cases */}
                    <label className="flex items-start gap-3 p-3 border border-slate-150 rounded-xl hover:bg-slate-50/50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.editCases}
                        onChange={(e) => setFormData({...formData, editCases: e.target.checked})}
                        className="mt-1 h-4 w-4 rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div>
                        <span className="block text-sm font-bold text-slate-700">Edit Cases</span>
                        <span className="text-[11px] text-slate-400 font-semibold mt-0.5 block">Edit existing cases</span>
                      </div>
                    </label>

                    {/* Delete Cases */}
                    <label className="flex items-start gap-3 p-3 border border-slate-150 rounded-xl hover:bg-slate-50/50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.deleteCases}
                        onChange={(e) => setFormData({...formData, deleteCases: e.target.checked})}
                        className="mt-1 h-4 w-4 rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div>
                        <span className="block text-sm font-bold text-slate-700">Delete Cases</span>
                        <span className="text-[11px] text-slate-400 font-semibold mt-0.5 block">Delete cases</span>
                      </div>
                    </label>

                    {/* View Reports */}
                    <label className="flex items-start gap-3 p-3 border border-slate-150 rounded-xl hover:bg-slate-50/50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.viewReports}
                        onChange={(e) => setFormData({...formData, viewReports: e.target.checked})}
                        className="mt-1 h-4 w-4 rounded border-slate-355 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div>
                        <span className="block text-sm font-bold text-slate-700">View Reports</span>
                        <span className="text-[11px] text-slate-400 font-semibold mt-0.5 block">Access reports and analytics</span>
                      </div>
                    </label>

                    {/* Export Data */}
                    <label className="flex items-start gap-3 p-3 border border-slate-150 rounded-xl hover:bg-slate-50/50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={formData.exportData}
                        onChange={(e) => setFormData({...formData, exportData: e.target.checked})}
                        className="mt-1 h-4 w-4 rounded border-slate-355 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                      <div>
                        <span className="block text-sm font-bold text-slate-700">Export Data</span>
                        <span className="text-[11px] text-slate-400 font-semibold mt-0.5 block">Export case data and reports</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Info banner */}
              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 flex gap-3 text-left">
                <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[12px] font-bold text-blue-800">User Invitation</h4>
                  <p className="text-[11px] text-blue-600 font-semibold mt-0.5 leading-normal">
                    An invitation email will be sent to the user with instructions to set up their account and access the platform.
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
                  style={{ backgroundColor: '#4f46e5' }}
                  className="px-5 h-10 rounded-lg text-white text-[13px] font-bold shadow-sm cursor-pointer hover:bg-indigo-700 transition-colors"
                >
                  {editingUserId ? 'Save Changes' : 'Send Invitation'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
