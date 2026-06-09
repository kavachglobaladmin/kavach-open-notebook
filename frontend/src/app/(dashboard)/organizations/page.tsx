'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import {
  Building2,
  Users,
  HardDrive,
  Plus,
  Search,
  X,
  Info,
  Mail,
  Phone,
  Globe,
  MapPin,
  CreditCard,
  Filter,
  MoreHorizontal,
  Edit,
  Trash2,
  Ban,
  CheckCircle
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface OrgRecord {
  id: string
  name: string
  icon: string
  iconColor: string
  industry: string
  plan: string
  planColor: string
  users: number
  storage: string
  revenue: string
  status: 'Active' | 'Trial' | 'Suspended'
  statusColor: string
}

const mockOrgs: OrgRecord[] = [
  { id: '1', name: 'TechCorp Industries', icon: 'T', iconColor: 'bg-indigo-100 text-indigo-600', industry: 'Technology', plan: 'Enterprise', planColor: 'bg-indigo-50 text-indigo-600 border border-indigo-100', users: 245, storage: '1.2 TB', revenue: '$450K', status: 'Active', statusColor: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
  { id: '2', name: 'Global Finance Group', icon: 'G', iconColor: 'bg-blue-100 text-blue-600', industry: 'Finance', plan: 'Business', planColor: 'bg-blue-50 text-blue-600 border border-blue-100', users: 156, storage: '850 GB', revenue: '$320K', status: 'Active', statusColor: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
  { id: '3', name: 'Healthcare Solutions', icon: 'H', iconColor: 'bg-purple-100 text-purple-600', industry: 'Healthcare', plan: 'Enterprise', planColor: 'bg-purple-50 text-purple-600 border border-purple-100', users: 312, storage: '2.1 TB', revenue: '$580K', status: 'Active', statusColor: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
  { id: '4', name: 'Legal Partners LLC', icon: 'L', iconColor: 'bg-emerald-100 text-emerald-600', industry: 'Legal', plan: 'Professional', planColor: 'bg-emerald-50 text-emerald-600 border border-emerald-100', users: 89, storage: '420 GB', revenue: '$180K', status: 'Active', statusColor: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
  { id: '5', name: 'Manufacturing Co', icon: 'M', iconColor: 'bg-amber-100 text-amber-600', industry: 'Manufacturing', plan: 'Business', planColor: 'bg-blue-50 text-blue-600 border border-blue-100', users: 178, storage: '950 GB', revenue: '$0', status: 'Trial', statusColor: 'bg-amber-50 text-amber-650 border border-amber-100' },
  { id: '6', name: 'Retail Dynamics', icon: 'R', iconColor: 'bg-indigo-100 text-indigo-600', industry: 'Retail', plan: 'Enterprise', planColor: 'bg-indigo-50 text-indigo-600 border border-indigo-100', users: 423, storage: '3.2 TB', revenue: '$720K', status: 'Active', statusColor: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
  { id: '7', name: 'Education First', icon: 'E', iconColor: 'bg-emerald-100 text-emerald-600', industry: 'Education', plan: 'Professional', planColor: 'bg-emerald-50 text-emerald-600 border border-emerald-100', users: 134, storage: '680 GB', revenue: '$210K', status: 'Active', statusColor: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
  { id: '8', name: 'Consulting Group', icon: 'C', iconColor: 'bg-blue-100 text-blue-600', industry: 'Consulting', plan: 'Business', planColor: 'bg-blue-50 text-blue-600 border border-blue-100', users: 92, storage: '540 GB', revenue: '$190K', status: 'Active', statusColor: 'bg-emerald-50 text-emerald-600 border border-emerald-100' },
]

export default function OrganizationsPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [orgs, setOrgs] = useState<OrgRecord[]>(mockOrgs)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null)

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    email: '',
    phone: '',
    website: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    country: '',
    plan: '',
    billingCycle: '',
    maxUsers: '',
    storageLimit: '',
  })

  const handleEditOrg = (org: OrgRecord) => {
    setEditingOrgId(org.id)
    setFormData({
      name: org.name,
      industry: org.industry,
      email: `${org.name.toLowerCase().replace(/\s+/g, '')}@example.com`,
      phone: '+1 (555) 019-2834',
      website: `https://${org.name.toLowerCase().replace(/\s+/g, '')}.com`,
      street: '123 Business Rd',
      city: 'Metro City',
      state: 'NY',
      zip: '10001',
      country: 'United States',
      plan: org.plan,
      billingCycle: 'Annual',
      maxUsers: String(org.users),
      storageLimit: org.storage.replace(/[^0-9]/g, ''),
    })
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingOrgId(null)
    setFormData({
      name: '',
      industry: '',
      email: '',
      phone: '',
      website: '',
      street: '',
      city: '',
      state: '',
      zip: '',
      country: '',
      plan: '',
      billingCycle: '',
      maxUsers: '',
      storageLimit: '',
    })
  }

  const filteredOrgs = orgs.filter(org => 
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    org.industry.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const planColorMap: Record<string, string> = {
      Enterprise: 'bg-purple-50 text-purple-650 border border-purple-100',
      Business: 'bg-blue-50 text-blue-650 border border-blue-100',
      Professional: 'bg-emerald-50 text-emerald-650 border border-emerald-100',
      Trial: 'bg-amber-50 text-amber-650 border border-amber-100',
    }
    
    const statusColorMap: Record<string, string> = {
      Active: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
      Pending: 'bg-amber-50 text-amber-600 border border-amber-100',
      Suspended: 'bg-red-50 text-red-600 border border-red-100',
      Trial: 'bg-amber-50 text-amber-650 border border-amber-100',
    }

    if (editingOrgId) {
      const updated = orgs.map(o => {
        if (o.id === editingOrgId) {
          const plan = formData.plan || o.plan
          return {
            ...o,
            name: formData.name,
            industry: formData.industry || o.industry,
            plan,
            planColor: planColorMap[plan] || planColorMap['Enterprise'],
            users: Number(formData.maxUsers) || 0,
            storage: formData.storageLimit ? `${formData.storageLimit} GB` : '0 GB',
            revenue: plan === 'Enterprise' ? '$450K' : plan === 'Business' ? '$320K' : plan === 'Professional' ? '$180K' : '$0',
            status: (plan === 'Trial' ? 'Trial' : o.status === 'Trial' ? 'Active' : o.status) as OrgRecord['status'],
            statusColor: plan === 'Trial' ? statusColorMap['Pending'] : o.status === 'Trial' ? statusColorMap['Active'] : o.statusColor,
          }
        }
        return o
      })
      setOrgs(updated)
      handleCloseModal()
    } else {
      const newOrg: OrgRecord = {
        id: String(orgs.length + 1),
        name: formData.name,
        icon: formData.name.charAt(0).toUpperCase() || 'O',
        iconColor: 'bg-indigo-100 text-indigo-600',
        industry: formData.industry || 'Technology',
        plan: formData.plan || 'Enterprise',
        planColor: planColorMap[formData.plan] || planColorMap['Enterprise'],
        users: Number(formData.maxUsers) || 0,
        storage: formData.storageLimit ? `${formData.storageLimit} GB` : '0 GB',
        revenue: formData.plan === 'Enterprise' ? '$450K' : formData.plan === 'Business' ? '$320K' : formData.plan === 'Professional' ? '$180K' : '$0',
        status: formData.plan === 'Trial' ? 'Trial' : 'Active',
        statusColor: formData.plan === 'Trial' ? statusColorMap['Pending'] : statusColorMap['Active'],
      }

      setOrgs([newOrg, ...orgs])
      handleCloseModal()
    }
  }

  const kpiCards = [
    { label: 'Total Organizations', value: '248', trend: '↑ 12% from last month', isPositive: true },
    { label: 'Active Subscriptions', value: '231', trend: '↑ 8% from last month', isPositive: true },
    { label: 'Total Revenue', value: '$2.6M', trend: '↑ 15% from last month', isPositive: true },
    { label: 'Trial Accounts', value: '17', trend: '5 expiring soon', isPositive: false }
  ]

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 bg-[#F8F9FD] overflow-hidden">
        <PageHeader searchValue={searchTerm} onSearchChange={setSearchTerm} />

        <div className="flex-1 overflow-y-auto z-10 custom-scrollbar">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            
            {/* Title Section */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-indigo-50 text-indigo-600">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h1 className="text-[20px] font-bold text-slate-800 leading-tight">Organizations</h1>
                  <p className="text-[12px] text-slate-400 font-semibold mt-0.5">Manage all organizations and their subscriptions</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingOrgId(null)
                  setFormData({
                    name: '',
                    industry: '',
                    email: '',
                    phone: '',
                    website: '',
                    street: '',
                    city: '',
                    state: '',
                    zip: '',
                    country: '',
                    plan: '',
                    billingCycle: '',
                    maxUsers: '',
                    storageLimit: '',
                  })
                  setIsModalOpen(true)
                }}
                style={{ backgroundColor: '#4f46e5' }}
                className="hover:bg-indigo-700 text-white font-bold text-[12px] px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer transition-all active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" />
                <span>Add Organization</span>
              </button>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {kpiCards.map((card, idx) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08, duration: 0.4 }}
                  className="bg-white rounded-[16px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100 flex flex-col gap-3 text-left group hover:shadow-md transition-all duration-300"
                >
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{card.label}</span>
                  <h3 className="text-[28px] font-extrabold text-slate-800 leading-none">{card.value}</h3>
                  <span className={`text-[12px] font-bold ${card.isPositive ? 'text-emerald-500' : 'text-amber-500'}`}>
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
                    placeholder="Search organizations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-11 pl-12 pr-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>
                <button className="h-11 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-lg text-sm font-bold flex items-center gap-2 transition-all cursor-pointer">
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                </button>
              </div>

              {/* Organizations Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="pb-3 font-semibold">Organization</th>
                      <th className="pb-3 font-semibold">Industry</th>
                      <th className="pb-3 font-semibold">Plan</th>
                      <th className="pb-3 font-semibold">Users</th>
                      <th className="pb-3 font-semibold">Storage</th>
                      <th className="pb-3 font-semibold">Revenue</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrgs.map((org) => (
                      <tr key={org.id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/30 transition-colors">
                        <td className="py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-[13px] ${org.iconColor}`}>
                              {org.icon}
                            </div>
                            <span className="text-[14px] font-bold text-slate-800">{org.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 text-[13px] font-medium text-slate-500">{org.industry}</td>
                        <td className="py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${org.planColor}`}>
                            {org.plan}
                          </span>
                        </td>
                        <td className="py-3.5 text-[13px] font-bold text-slate-700">{org.users}</td>
                        <td className="py-3.5 text-[13px] font-bold text-slate-600">{org.storage}</td>
                        <td className="py-3.5 text-[13px] font-bold text-slate-600">{org.revenue}</td>
                        <td className="py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${org.statusColor}`}>
                            {org.status}
                          </span>
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
                                onClick={() => handleEditOrg(org)}
                                className="rounded-lg cursor-pointer flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:text-slate-800 outline-none"
                              >
                                <Edit className="h-3.5 w-3.5 text-slate-400" />
                                <span>Edit Org</span>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  const updated = orgs.map(o => {
                                    if (o.id === org.id) {
                                      const isSuspended = o.status === 'Suspended'
                                      return {
                                        ...o,
                                        status: (isSuspended ? 'Active' : 'Suspended') as 'Active' | 'Suspended',
                                        statusColor: isSuspended 
                                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                          : 'bg-red-50 text-red-600 border border-red-100'
                                      }
                                    }
                                    return o
                                  })
                                  setOrgs(updated)
                                }}
                                className="rounded-lg cursor-pointer flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:text-slate-800 outline-none"
                              >
                                {org.status === 'Suspended' ? (
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
                                  setOrgs(orgs.filter(o => o.id !== org.id))
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
                <span className="text-[12px] text-slate-400 font-bold">Showing 1 to {filteredOrgs.length} of {orgs.length} organizations</span>
                <div className="flex items-center gap-1.5">
                  <button className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-[12px] font-bold text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors">Previous</button>
                  <button style={{ backgroundColor: '#4f46e5', borderColor: '#4f46e5', color: '#ffffff' }} className="w-8 h-8 rounded-lg text-[12px] font-bold border flex items-center justify-center cursor-pointer shadow-xs">1</button>
                  <button className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 text-[12px] font-bold hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors">2</button>
                  <button className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 text-[12px] font-bold hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors">3</button>
                  <button className="px-3.5 py-1.5 border border-slate-200 rounded-lg text-[12px] font-bold text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors">Next</button>
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>

      {/* Add Organization Popup Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4 py-8 overflow-y-auto">
          <div className="bg-white w-full max-w-[720px] rounded-2xl shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between p-6 border-b border-slate-100 shrink-0 text-left">
              <div>
                <h2 className="text-[20px] font-bold text-slate-800">
                  {editingOrgId ? 'Edit Organization' : 'Add New Organization'}
                </h2>
                <p className="text-[12px] text-slate-400 font-semibold mt-0.5">
                  {editingOrgId ? 'Modify organization and subscription parameters' : 'Create a new organization with subscription details'}
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
              
              {/* SECTION 1: Organization Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                  <Building2 className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">Organization Information</h3>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Organization Name *</label>
                  <input
                    required
                    type="text"
                    placeholder="Enter organization name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                {/* Industry & Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Industry *</label>
                    <select
                      required
                      value={formData.industry}
                      onChange={(e) => setFormData({...formData, industry: e.target.value})}
                      className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                    >
                      <option value="">Select industry</option>
                      <option value="Technology">Technology</option>
                      <option value="Finance">Finance</option>
                      <option value="Healthcare">Healthcare</option>
                      <option value="Legal">Legal</option>
                      <option value="Manufacturing">Manufacturing</option>
                      <option value="Retail">Retail</option>
                      <option value="Education">Education</option>
                      <option value="Consulting">Consulting</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Email *</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                      <input
                        required
                        type="email"
                        placeholder="contact@organization.com"
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full h-10 pl-10 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Phone & Website */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Phone *</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                      <input
                        required
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full h-10 pl-10 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Website</label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                      <input
                        type="url"
                        placeholder="https://example.com"
                        value={formData.website}
                        onChange={(e) => setFormData({...formData, website: e.target.value})}
                        className="w-full h-10 pl-10 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Address Information */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                  <MapPin className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">Address Information</h3>
                </div>

                {/* Street */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Street Address</label>
                  <input
                    type="text"
                    placeholder="Enter street address"
                    value={formData.street}
                    onChange={(e) => setFormData({...formData, street: e.target.value})}
                    className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                  />
                </div>

                {/* City & State */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">City</label>
                    <input
                      type="text"
                      placeholder="Enter city"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                      className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">State/Province</label>
                    <input
                      type="text"
                      placeholder="Enter state"
                      value={formData.state}
                      onChange={(e) => setFormData({...formData, state: e.target.value})}
                      className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                {/* ZIP & Country */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">ZIP/Postal Code</label>
                    <input
                      type="text"
                      placeholder="Enter ZIP code"
                      value={formData.zip}
                      onChange={(e) => setFormData({...formData, zip: e.target.value})}
                      className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Country</label>
                    <select
                      value={formData.country}
                      onChange={(e) => setFormData({...formData, country: e.target.value})}
                      className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                    >
                      <option value="">Select country</option>
                      <option value="United States">United States</option>
                      <option value="Canada">Canada</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="India">India</option>
                      <option value="Germany">Germany</option>
                      <option value="Australia">Australia</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Subscription Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-slate-100">
                  <CreditCard className="h-4 w-4 text-indigo-500" />
                  <h3 className="text-[12px] font-bold text-slate-700 uppercase tracking-wider">Subscription Details</h3>
                </div>

                {/* Plan & Cycle */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Plan *</label>
                    <select
                      required
                      value={formData.plan}
                      onChange={(e) => setFormData({...formData, plan: e.target.value})}
                      className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                    >
                      <option value="">Select plan</option>
                      <option value="Enterprise">Enterprise</option>
                      <option value="Business">Business</option>
                      <option value="Professional">Professional</option>
                      <option value="Trial">Trial</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Billing Cycle</label>
                    <select
                      value={formData.billingCycle}
                      onChange={(e) => setFormData({...formData, billingCycle: e.target.value})}
                      className="w-full h-10 px-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                    >
                      <option value="">Select billing cycle</option>
                      <option value="Monthly">Monthly</option>
                      <option value="Annual">Annual</option>
                    </select>
                  </div>
                </div>

                {/* Users & Storage */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Max Users</label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                      <input
                        type="number"
                        placeholder="e.g., 100"
                        value={formData.maxUsers}
                        onChange={(e) => setFormData({...formData, maxUsers: e.target.value})}
                        className="w-full h-10 pl-10 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Storage Limit (GB)</label>
                    <div className="relative">
                      <HardDrive className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
                      <input
                        type="number"
                        placeholder="e.g., 500"
                        value={formData.storageLimit}
                        onChange={(e) => setFormData({...formData, storageLimit: e.target.value})}
                        className="w-full h-10 pl-10 pr-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Info banner */}
              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 flex gap-3 text-left">
                <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-[12px] font-bold text-blue-800">Organization Setup</h4>
                  <p className="text-[11px] text-blue-600 font-semibold mt-0.5 leading-normal">
                    An invitation email will be sent to the organization's admin with account setup instructions.
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
                  {editingOrgId ? 'Save Changes' : 'Add Organization'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
