'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  UserCog,
  Shield,
  Building2,
  Key,
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
  MapPin,
  X,
  Info
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface AdminRecord {
  id: string
  name: string
  firstName: string
  lastName: string
  email: string
  phone: string
  org: string
  department: string
  designation: string
  location: string
  role: string
  status: 'Active' | 'Pending' | 'Suspended'
  usersManaged: number
  lastLogin: string
  permissions: {
    userManagement: boolean
    caseManagement: boolean
    reportsAnalytics: boolean
    systemSettings: boolean
  }
}

const initialAdmins: AdminRecord[] = [
  {
    id: '1',
    name: 'John Doe',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@deltapolice.gov.in',
    phone: '+91 98765 43210',
    org: 'Delta Police',
    department: 'Investigation',
    designation: 'Senior Investigator',
    location: 'New Delhi',
    role: 'Admin',
    status: 'Active',
    usersManaged: 45,
    lastLogin: '2 hours ago',
    permissions: {
      userManagement: true,
      caseManagement: true,
      reportsAnalytics: true,
      systemSettings: false,
    }
  },
  {
    id: '2',
    name: 'Priya Sharma',
    firstName: 'Priya',
    lastName: 'Sharma',
    email: 'priya.sharma@finance.gov.in',
    phone: '+91 87654 32109',
    org: 'Finance Dept',
    department: 'Audit',
    designation: 'Lead Auditor',
    location: 'Mumbai',
    role: 'Super Admin',
    status: 'Active',
    usersManaged: 28,
    lastLogin: '5 hours ago',
    permissions: {
      userManagement: true,
      caseManagement: true,
      reportsAnalytics: true,
      systemSettings: true,
    }
  },
  {
    id: '3',
    name: 'Rahit Verma',
    firstName: 'Rahit',
    lastName: 'Verma',
    email: 'rahit.verma@cybercell.gov.in',
    phone: '+91 76543 21098',
    org: 'Cyber Crime Cell',
    department: 'Cyber Forensics',
    designation: 'Technical Head',
    location: 'Bangalore',
    role: 'Admin',
    status: 'Active',
    usersManaged: 19,
    lastLogin: '1 day ago',
    permissions: {
      userManagement: true,
      caseManagement: true,
      reportsAnalytics: true,
      systemSettings: false,
    }
  },
  {
    id: '4',
    name: 'Anita Patel',
    firstName: 'Anita',
    lastName: 'Patel',
    email: 'anita.patel@transport.gov.in',
    phone: '+91 65432 10987',
    org: 'Transport Dept',
    department: 'Licensing',
    designation: 'Director',
    location: 'Gandhinagar',
    role: 'Admin',
    status: 'Active',
    usersManaged: 12,
    lastLogin: '2 days ago',
    permissions: {
      userManagement: true,
      caseManagement: false,
      reportsAnalytics: true,
      systemSettings: false,
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
    department: 'Taxation',
    designation: 'Commissioner',
    location: 'Chennai',
    role: 'Super Admin',
    status: 'Active',
    usersManaged: 34,
    lastLogin: '3 hours ago',
    permissions: {
      userManagement: true,
      caseManagement: true,
      reportsAnalytics: true,
      systemSettings: true,
    }
  },
  {
    id: '6',
    name: 'Meera Iyer',
    firstName: 'Meera',
    lastName: 'Iyer',
    email: 'meera.iyer@stateintelligence.gov.in',
    phone: '+91 43210 98765',
    org: 'State Intelligence',
    department: 'Operations',
    designation: 'Intelligence Officer',
    location: 'Kolkata',
    role: 'Admin',
    status: 'Active',
    usersManaged: 22,
    lastLogin: '1 hour ago',
    permissions: {
      userManagement: false,
      caseManagement: true,
      reportsAnalytics: true,
      systemSettings: false,
    }
  },
  {
    id: '7',
    name: 'Arjun Mehta',
    firstName: 'Arjun',
    lastName: 'Mehta',
    email: 'arjun.mehta@medical.gov.in',
    phone: '+91 32109 87654',
    org: 'Medical Council',
    department: 'Registration',
    designation: 'Registrar',
    location: 'Hyderabad',
    role: 'Admin',
    status: 'Pending',
    usersManaged: 8,
    lastLogin: '5 hours ago',
    permissions: {
      userManagement: true,
      caseManagement: false,
      reportsAnalytics: false,
      systemSettings: false,
    }
  },
  {
    id: '8',
    name: 'Karan Malhotra',
    firstName: 'Karan',
    lastName: 'Malhotra',
    email: 'karan.malhotra@delhipolice.gov.in',
    phone: '+91 21098 76543',
    org: 'Delhi Police',
    department: 'Special Cell',
    designation: 'ACP',
    location: 'New Delhi',
    role: 'Admin',
    status: 'Active',
    usersManaged: 36,
    lastLogin: '30 mins ago',
    permissions: {
      userManagement: true,
      caseManagement: true,
      reportsAnalytics: true,
      systemSettings: false,
    }
  }
]

// Generate exactly 40 more admins so the pagination has 5 pages and total is exactly 48
const generateMockAdmins = (): AdminRecord[] => {
  const list = [...initialAdmins]
  const names = [
    'Rajesh Kumar', 'Sanjay Dutt', 'Amit Shah', 'Neha Gupta', 'Rahul Sharma',
    'Sunita Rao', 'Vijay Kumar', 'Deepak Hooda', 'Komal Preet', 'Harpreet Singh',
    'Siddharth Kapoor', 'Varun Joshi', 'Alia Sen', 'Kriti Reddy', 'Ranbir Roy',
    'Aditya Bose', 'Shraddha Pal', 'Kartik Gill', 'Sara Nair', 'Janhvi Hegde'
  ]
  const orgs = ['Delta Police', 'Finance Dept', 'Cyber Crime Cell', 'Transport Dept', 'Revenue', 'State Intelligence', 'Medical Council', 'Delhi Police']
  const domains = ['deltapolice.gov.in', 'finance.gov.in', 'cybercell.gov.in', 'transport.gov.in', 'revenue.gov.in', 'stateintelligence.gov.in', 'medical.gov.in', 'delhipolice.gov.in']
  
  // Total target: 48. Currently list has 8. We need 40 more.
  // Target counts:
  // Active: 44. (Currently 7) -> We need 37 more active.
  // Suspended: 2. (Currently 0) -> We need 2 suspended.
  // Pending: 2. (Currently 1) -> We need 1 more pending.
  let suspendedCount = 0
  let pendingCount = 0

  for (let i = 9; i <= 48; i++) {
    const name = names[i % names.length] + ' ' + (i % 2 === 0 ? 'Sharma' : 'Verma')
    const orgIndex = i % orgs.length
    const email = `${name.toLowerCase().replace(/\s+/g, '.')}@${domains[orgIndex]}`
    
    let status: 'Active' | 'Pending' | 'Suspended' = 'Active'
    if (suspendedCount < 2 && (i === 15 || i === 25)) {
      status = 'Suspended'
      suspendedCount++
    } else if (pendingCount < 1 && i === 20) {
      status = 'Pending'
      pendingCount++
    }

    list.push({
      id: String(i),
      name,
      firstName: name.split(' ')[0],
      lastName: name.split(' ')[1] || '',
      email,
      phone: `+91 98765 ${10000 + i}`,
      org: orgs[orgIndex],
      department: 'Operations',
      designation: i % 2 === 0 ? 'Investigator' : 'Officer',
      location: i % 3 === 0 ? 'New Delhi' : i % 3 === 1 ? 'Mumbai' : 'Bangalore',
      role: 'Admin',
      status,
      usersManaged: 5 + (i * 3) % 40,
      lastLogin: `${i % 12 + 1} hours ago`,
      permissions: {
        userManagement: true,
        caseManagement: i % 2 === 0,
        reportsAnalytics: true,
        systemSettings: false,
      }
    })
  }
  return list
}

export default function AdminsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('Status')
  const [filterOrg, setFilterOrg] = useState<string>('Organization')
  const [filterRole, setFilterRole] = useState<string>('Role')
  const [admins, setAdmins] = useState<AdminRecord[]>(() => generateMockAdmins())
  
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    org: '',
    department: '',
    designation: '',
    location: '',
    role: 'Admin',
    userManagement: true,
    caseManagement: false,
    reportsAnalytics: false,
    systemSettings: false,
  })

  // Dropdown helper handlers that reset pagination page
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

  const handleRoleChange = (val: string) => {
    setFilterRole(val)
    setCurrentPage(1)
  }

  const handleEditAdmin = (admin: AdminRecord) => {
    setEditingAdminId(admin.id)
    setFormData({
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      phone: admin.phone,
      org: admin.org,
      department: admin.department,
      designation: admin.designation,
      location: admin.location,
      role: admin.role,
      userManagement: admin.permissions.userManagement,
      caseManagement: admin.permissions.caseManagement,
      reportsAnalytics: admin.permissions.reportsAnalytics,
      systemSettings: admin.permissions.systemSettings,
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingAdminId(null)
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      org: '',
      department: '',
      designation: '',
      location: '',
      role: 'Admin',
      userManagement: true,
      caseManagement: false,
      reportsAnalytics: false,
      systemSettings: false,
    })
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const name = `${formData.firstName} ${formData.lastName}`

    if (editingAdminId) {
      const updated = admins.map(a => {
        if (a.id === editingAdminId) {
          return {
            ...a,
            name,
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            org: formData.org || 'Delta Police',
            department: formData.department,
            designation: formData.designation,
            location: formData.location,
            role: formData.role,
            permissions: {
              userManagement: formData.userManagement,
              caseManagement: formData.caseManagement,
              reportsAnalytics: formData.reportsAnalytics,
              systemSettings: formData.systemSettings,
            }
          }
        }
        return a
      })
      setAdmins(updated)
      handleCloseModal()
    } else {
      const newAdmin: AdminRecord = {
        id: String(admins.length + 1),
        name,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        org: formData.org || 'Delta Police',
        department: formData.department,
        designation: formData.designation,
        location: formData.location,
        role: formData.role,
        status: 'Active',
        usersManaged: 0,
        lastLogin: 'Just now',
        permissions: {
          userManagement: formData.userManagement,
          caseManagement: formData.caseManagement,
          reportsAnalytics: formData.reportsAnalytics,
          systemSettings: formData.systemSettings,
        }
      }
      setAdmins([newAdmin, ...admins])
      handleCloseModal()
    }
  }

  // Filter calculation
  const filteredAdmins = admins.filter(admin => {
    const matchesSearch = 
      admin.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.org.toLowerCase().includes(searchTerm.toLowerCase()) ||
      admin.designation.toLowerCase().includes(searchTerm.toLowerCase())
      
    const matchesStatus = filterStatus === 'Status' || admin.status === filterStatus
    const matchesOrg = filterOrg === 'Organization' || admin.org === filterOrg
    const matchesRole = filterRole === 'Role' || admin.role === filterRole
    
    return matchesSearch && matchesStatus && matchesOrg && matchesRole
  })

  const totalPages = Math.ceil(filteredAdmins.length / pageSize)
  const paginatedAdmins = filteredAdmins.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Calculate dynamic stats matching the mock requirements precisely
  const activeCount = admins.filter(a => a.status === 'Active').length
  const suspendedCount = admins.filter(a => a.status === 'Suspended').length
  const pendingCount = admins.filter(a => a.status === 'Pending').length

  const stats = [
    { label: 'Total Admins', value: String(admins.length), trend: '↑ +6%', isPositive: true },
    { label: 'Active Admins', value: String(activeCount), trend: '↓ -6.42%', isPositive: false },
    { label: 'Suspended', value: String(suspendedCount), trend: '', isPositive: true },
    { label: 'Pending Invitation', value: String(pendingCount), trend: '↑ +6.42%', isPositive: true },
  ]

  // Deterministic color assignment for profile circles
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
            
            {/* Title Block */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#EEF2FF] text-indigo-600">
                  <UserCog className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h1 className="text-[20px] font-bold text-slate-800 leading-tight">Admins</h1>
                  <p className="text-[12px] text-slate-400 font-semibold mt-0.5">Manage all organization admins</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingAdminId(null)
                  setFormData({
                    firstName: '',
                    lastName: '',
                    email: '',
                    phone: '',
                    org: '',
                    department: '',
                    designation: '',
                    location: '',
                    role: 'Admin',
                    userManagement: true,
                    caseManagement: false,
                    reportsAnalytics: false,
                    systemSettings: false,
                  })
                  setIsModalOpen(true)
                }}
                style={{ backgroundColor: '#4f46e5' }}
                className="hover:bg-indigo-700 text-white font-bold text-[12px] px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                <span>Add Admin</span>
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
                    placeholder="Search admins..."
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
                    <option value="Pending">Pending</option>
                    <option value="Suspended">Suspended</option>
                  </select>

                  <select
                    value={filterOrg}
                    onChange={(e) => handleOrgChange(e.target.value)}
                    className="h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  >
                    <option value="Organization">Organization</option>
                    {Array.from(new Set(admins.map(a => a.org))).map(org => (
                      <option key={org} value={org}>{org}</option>
                    ))}
                  </select>

                  <select
                    value={filterRole}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  >
                    <option value="Role">Role</option>
                    <option value="Super Admin">Super Admin</option>
                    <option value="Admin">Admin</option>
                  </select>

                  <button
                    onClick={() => {
                      setSearchTerm('')
                      setFilterStatus('Status')
                      setFilterOrg('Organization')
                      setFilterRole('Role')
                      setCurrentPage(1)
                    }}
                    className="text-sm font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors px-2 py-1 cursor-pointer"
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Admins Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 font-semibold">Admin</th>
                      <th className="pb-3 font-semibold">Organization</th>
                      <th className="pb-3 font-semibold">Email</th>
                      <th className="pb-3 font-semibold">Users Managed</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold">Last Login</th>
                      <th className="pb-3 font-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAdmins.map((admin) => (
                      <tr key={admin.id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/30 transition-colors">
                        <td className="py-3.5">
                          <div className="flex items-center gap-3 text-left">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] ${getAvatarBg(admin.name)}`}>
                              {admin.name.split(' ').map(n=>n[0]).join('')}
                            </div>
                            <span className="text-[14px] font-bold text-slate-800">{admin.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 text-[13px] font-semibold text-slate-500 text-left">
                          {admin.org}
                        </td>
                        <td className="py-3.5 text-[13px] font-medium text-slate-500 text-left">
                          {admin.email}
                        </td>
                        <td className="py-3.5 text-[13px] font-bold text-slate-700 text-left pl-6">
                          {admin.usersManaged}
                        </td>
                        <td className="py-3.5 text-left">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${
                            admin.status === 'Active' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            admin.status === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            'bg-rose-50 text-rose-600 border-rose-100'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              admin.status === 'Active' ? 'bg-emerald-500' :
                              admin.status === 'Pending' ? 'bg-amber-500' :
                              'bg-rose-500'
                            }`} />
                            {admin.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-[13px] font-semibold text-slate-500 text-left">{admin.lastLogin}</td>
                        <td className="py-3.5 text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="text-slate-400 hover:text-slate-650 hover:bg-slate-50 transition-colors p-1.5 rounded-full cursor-pointer inline-flex items-center justify-center">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl shadow-lg border border-slate-100 bg-white p-1 min-w-[140px] z-[100]">
                              <DropdownMenuItem
                                onClick={() => handleEditAdmin(admin)}
                                className="rounded-lg cursor-pointer flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:text-slate-800 outline-none"
                              >
                                <Edit className="h-3.5 w-3.5 text-slate-400" />
                                <span>Edit Admin</span>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  const updated = admins.map(a => {
                                    if (a.id === admin.id) {
                                      const isSuspended = a.status === 'Suspended'
                                      return {
                                        ...a,
                                        status: (isSuspended ? 'Active' : 'Suspended') as 'Active' | 'Suspended',
                                      }
                                    }
                                    return a
                                  })
                                  setAdmins(updated)
                                }}
                                className="rounded-lg cursor-pointer flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:text-slate-800 outline-none"
                              >
                                {admin.status === 'Suspended' ? (
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
                                  setAdmins(admins.filter(a => a.id !== admin.id))
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
                  Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredAdmins.length)} of {filteredAdmins.length} admins
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

      {/* Add/Edit Admin Popup Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4 py-8 overflow-y-auto">
          <div className="bg-white w-full max-w-[680px] rounded-2xl shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-100 shrink-0 text-left">
              <div>
                <h2 className="text-[20px] font-bold text-slate-800">
                  {editingAdminId ? 'Edit Admin Account' : 'Add New Admin'}
                </h2>
                <p className="text-[12px] text-slate-400 font-semibold mt-0.5">
                  {editingAdminId ? 'Modify admin configuration and access levels' : 'Create a new admin account with specific permissions'}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-50 p-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Scrollable Form */}
            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-left">
              
              {/* SECTION 1: Personal Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                  <UserCog className="h-4.5 w-4.5 text-indigo-500" />
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
                        placeholder="admin@example.com"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full h-10 pl-10 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Phone Number *</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                      <input
                        required
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

              {/* SECTION 2: Organization Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                  <Building2 className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">Organization Details</h3>
                </div>

                {/* Organization & Department */}
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
                      <option value="Finance Dept">Finance Dept</option>
                      <option value="Cyber Crime Cell">Cyber Crime Cell</option>
                      <option value="Transport Dept">Transport Dept</option>
                      <option value="Revenue">Revenue</option>
                      <option value="State Intelligence">State Intelligence</option>
                      <option value="Medical Council">Medical Council</option>
                      <option value="Delhi Police">Delhi Police</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Department *</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g., Investigation"
                      value={formData.department}
                      onChange={(e) => setFormData({...formData, department: e.target.value})}
                      className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* Designation & Location */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Designation *</label>
                    <div className="relative">
                      <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                      <input
                        required
                        type="text"
                        placeholder="e.g., Senior Investigator"
                        value={formData.designation}
                        onChange={(e) => setFormData({...formData, designation: e.target.value})}
                        className="w-full h-10 pl-10 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Location *</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                      <input
                        required
                        type="text"
                        placeholder="e.g., New Delhi"
                        value={formData.location}
                        onChange={(e) => setFormData({...formData, location: e.target.value})}
                        className="w-full h-10 pl-10 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Admin Type & Permissions */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                  <Shield className="h-4.5 w-4.5 text-indigo-500" />
                  <h3 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">Admin Type & Permissions</h3>
                </div>

                {/* Admin Type */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Admin Type *</label>
                  <select
                    required
                    value={formData.role}
                    onChange={(e) => {
                      const newRole = e.target.value
                      setFormData({
                        ...formData,
                        role: newRole,
                        userManagement: newRole === 'Super Admin' ? true : formData.userManagement,
                        caseManagement: newRole === 'Super Admin' ? true : formData.caseManagement,
                        reportsAnalytics: newRole === 'Super Admin' ? true : formData.reportsAnalytics,
                        systemSettings: newRole === 'Super Admin' ? true : formData.systemSettings,
                      })
                    }}
                    className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Super Admin">Super Admin</option>
                  </select>
                </div>

                {/* Permissions checkboxes */}
                <div className="space-y-3">
                  <label className="block text-[11px] font-bold text-slate-600">Permissions</label>
                  
                  {/* User Management */}
                  <label className="flex items-start gap-3 p-3 border border-slate-150 rounded-xl hover:bg-slate-50/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.userManagement}
                      disabled={formData.role === 'Super Admin'}
                      onChange={(e) => setFormData({...formData, userManagement: e.target.checked})}
                      className="mt-1 h-4 w-4 rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div>
                      <span className="block text-sm font-bold text-slate-700">User Management</span>
                      <span className="text-[11px] text-slate-400 font-semibold mt-0.5 block">Create, edit, and delete users</span>
                    </div>
                  </label>

                  {/* Case Management */}
                  <label className="flex items-start gap-3 p-3 border border-slate-150 rounded-xl hover:bg-slate-50/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.caseManagement}
                      disabled={formData.role === 'Super Admin'}
                      onChange={(e) => setFormData({...formData, caseManagement: e.target.checked})}
                      className="mt-1 h-4 w-4 rounded border-slate-355 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div>
                      <span className="block text-sm font-bold text-slate-700">Case Management</span>
                      <span className="text-[11px] text-slate-400 font-semibold mt-0.5 block">Manage cases and investigations</span>
                    </div>
                  </label>

                  {/* Reports & Analytics */}
                  <label className="flex items-start gap-3 p-3 border border-slate-150 rounded-xl hover:bg-slate-50/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.reportsAnalytics}
                      disabled={formData.role === 'Super Admin'}
                      onChange={(e) => setFormData({...formData, reportsAnalytics: e.target.checked})}
                      className="mt-1 h-4 w-4 rounded border-slate-355 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div>
                      <span className="block text-sm font-bold text-slate-700">Reports & Analytics</span>
                      <span className="text-[11px] text-slate-400 font-semibold mt-0.5 block">Access reports and analytics</span>
                    </div>
                  </label>

                  {/* System Settings */}
                  <label className="flex items-start gap-3 p-3 border border-slate-150 rounded-xl hover:bg-slate-50/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.systemSettings}
                      disabled={formData.role === 'Super Admin'}
                      onChange={(e) => setFormData({...formData, systemSettings: e.target.checked})}
                      className="mt-1 h-4 w-4 rounded border-slate-355 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <div>
                      <span className="block text-sm font-bold text-slate-700">System Settings</span>
                      <span className="text-[11px] text-slate-400 font-semibold mt-0.5 block">Configure system settings</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Info banner */}
              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 flex gap-3 text-left">
                <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[12px] font-bold text-blue-800">Account Activation</h4>
                  <p className="text-[11px] text-blue-600 font-semibold mt-0.5 leading-normal">
                    An invitation email will be sent to the admin's email address with account activation instructions.
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
                  {editingAdminId ? 'Save Changes' : 'Add Admin'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
