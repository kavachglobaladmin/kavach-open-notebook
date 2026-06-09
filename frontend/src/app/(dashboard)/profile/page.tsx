'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { motion } from 'framer-motion'
import {
  User,
  Bell,
  Palette,
  Key,
  ChevronRight,
  ShieldCheck,
  Clock,
  Mail,
  FileText,
  Sparkles,
  LogOut,
  Bot,
  Search,
  ChevronDown,
  CircleUser
} from 'lucide-react'

// Custom switch component for premium interactive styling
const InteractiveSwitch = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
      checked ? 'bg-[#10B981]' : 'bg-slate-200'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
)

export default function ProfilePage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'preferences' | 'activity'>('profile')

  // Switch states for Notifications tab
  const [notifPreferences, setNotifPreferences] = useState({
    caseUpdates: true,
    newCases: true,
    mentions: true,
    aiAlerts: true,
    emailNotif: true
  })

  // Switch states for Preferences tab
  const [aiPreferences, setAiPreferences] = useState({
    saveSearch: true,
    recommendedQueries: true,
    aiSuggestions: false
  })

  const [darkMode, setDarkMode] = useState(false)
  const [language, setLanguage] = useState('English (US)')

  // Navigation tab bar details
  const tabs = [
    { id: 'profile', label: 'Profile' },
    { id: 'security', label: 'Security' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'preferences', label: 'Preferences' },
    { id: 'activity', label: 'Activity' }
  ] as const

  // Activity list data helper
  const recentActivities = [
    {
      id: 'act-1',
      day: 'Today',
      time: '10:45 AM',
      type: 'Viewed Case',
      details: 'DELHI Police Case',
      icon: Clock,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-500'
    },
    {
      id: 'act-2',
      day: 'Today',
      time: '10:20 AM',
      type: 'Uploaded Evidence',
      details: 'File: StoryCard.pdf',
      icon: FileText,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-500'
    },
    {
      id: 'act-3',
      day: 'Today',
      time: '10:15 AM',
      type: 'Performed AI Search',
      details: 'Evidence security search',
      icon: Search,
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-500'
    },
    {
      id: 'act-4',
      day: 'Yesterday',
      time: '05:30 PM',
      type: 'Downloaded Report',
      details: 'Case Summary Report',
      icon: DownloadIcon, // custom simple icon helper
      iconBg: 'bg-slate-100',
      iconColor: 'text-slate-500'
    }
  ]

  function DownloadIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={props.className}
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
      </svg>
    )
  }

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 bg-[#F8FAFC] relative overflow-hidden">
        {/* Background Glows */}
        <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-slate-100 rounded-full blur-[100px] opacity-40 pointer-events-none" />
        <div className="absolute bottom-[10%] left-[-5%] w-[300px] h-[300px] bg-slate-100 rounded-full blur-[80px] opacity-30 pointer-events-none" />

        <PageHeader searchValue={searchTerm} onSearchChange={setSearchTerm} newLabel="PROFILE" />

        <div className="flex-1 overflow-y-auto relative z-10 custom-scrollbar">
          <div className="w-full px-6 lg:px-8 py-8 lg:py-10 pb-24 space-y-6 text-left">
            
            {/* Header Section */}
            <div className="space-y-1">
              <h1 className="text-3xl font-bold text-slate-800 leading-tight">
                Profile Overview
              </h1>
            </div>

            {/* Sub Navigation Tabs */}
            <div className="flex border-b border-slate-100 gap-6 overflow-x-auto whitespace-nowrap scrollbar-none pb-1">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`pb-3 text-sm font-bold transition-all relative cursor-pointer shrink-0 ${
                      isActive ? 'text-[#5D3FD3]' : 'text-slate-400 hover:text-slate-655'
                    }`}
                  >
                    {tab.label}
                    {isActive && (
                      <motion.div
                        layoutId="activeTabIndicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5D3FD3]"
                      />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Content Switcher */}
            <div className="pt-2">
              
              {/* TAB 1: Profile */}
              {activeTab === 'profile' && (
                <div className="space-y-6">
                  {/* Top Profile Summary Card */}
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.005)] flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6">
                    <div className="w-24 h-24 rounded-2xl flex items-center justify-center shrink-0 border border-slate-100 bg-slate-50 text-slate-400">
                      <CircleUser className="w-14 h-14 stroke-[1.2]" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="text-xl font-bold text-slate-800">Priya Sharma</h2>
                      <p className="text-sm text-slate-500 font-semibold">Investigator</p>
                      <p className="text-xs text-slate-400 font-semibold">Investigation Team</p>
                      <button className="h-9 px-4 mt-3 border border-slate-200 bg-white hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-all cursor-pointer">
                        Edit Profile
                      </button>
                    </div>
                  </div>

                  {/* Split Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Personal Information */}
                    <div className="lg:col-span-8 bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
                      <h3 className="text-[15px] font-bold text-slate-800 mb-6">Personal Information</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                        <div>
                          <p className="text-[11.5px] font-bold text-slate-400 uppercase tracking-wider">Full Name</p>
                          <p className="text-sm font-bold text-slate-800 mt-1">Priya Sharma</p>
                        </div>
                        <div>
                          <p className="text-[11.5px] font-bold text-slate-400 uppercase tracking-wider">Email</p>
                          <p className="text-sm font-bold text-slate-800 mt-1">priya.sharma@investigation.in</p>
                        </div>
                        <div>
                          <p className="text-[11.5px] font-bold text-slate-400 uppercase tracking-wider">Phone</p>
                          <p className="text-sm font-bold text-slate-800 mt-1">+91 98765 43210</p>
                        </div>
                        <div>
                          <p className="text-[11.5px] font-bold text-slate-400 uppercase tracking-wider">Employee ID</p>
                          <p className="text-sm font-bold text-slate-800 mt-1">CIP-INV-1024</p>
                        </div>
                        <div>
                          <p className="text-[11.5px] font-bold text-slate-400 uppercase tracking-wider">Designation</p>
                          <p className="text-sm font-bold text-slate-800 mt-1">Investigator</p>
                        </div>
                        <div>
                          <p className="text-[11.5px] font-bold text-slate-400 uppercase tracking-wider">Department</p>
                          <p className="text-sm font-bold text-slate-800 mt-1">Investigation</p>
                        </div>
                      </div>
                    </div>

                    {/* Performance Summary */}
                    <div className="lg:col-span-4 bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
                      <h3 className="text-[15px] font-bold text-slate-800 mb-6">Performance Summary</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 text-left">
                          <p className="text-2xl font-extrabold text-slate-800">28</p>
                          <p className="text-[11px] font-bold text-slate-400 mt-1">Active Cases</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 text-left">
                          <p className="text-2xl font-extrabold text-slate-800">16</p>
                          <p className="text-[11px] font-bold text-slate-400 mt-1">Completed Cases</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 text-left">
                          <p className="text-2xl font-extrabold text-slate-800">142</p>
                          <p className="text-[11px] font-bold text-slate-400 mt-1">AI Searches</p>
                        </div>
                        <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 text-left">
                          <p className="text-2xl font-extrabold text-slate-800">87</p>
                          <p className="text-[11px] font-bold text-slate-400 mt-1">Cases Resolved</p>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* My Activity Section */}
                  <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
                    <h3 className="text-[15px] font-bold text-slate-800 mb-6">My Activity</h3>
                    <div className="space-y-6">
                      {/* Group Today */}
                      <div className="space-y-4">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today</h4>
                        <div className="space-y-4 pl-1">
                          {recentActivities.filter(a => a.day === 'Today').map((activity) => {
                            return (
                              <div key={activity.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 py-2 sm:py-1">
                                <span className="w-auto sm:w-16 text-xs text-slate-400 font-semibold">{activity.time}</span>
                                <span className="w-auto sm:w-40 text-xs font-bold text-slate-700">{activity.type}</span>
                                <span className="text-xs font-semibold text-slate-400">{activity.details}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
 
                      {/* Group Yesterday */}
                      <div className="space-y-4 pt-2 border-t border-slate-50">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Yesterday</h4>
                        <div className="space-y-4 pl-1">
                          {recentActivities.filter(a => a.day === 'Yesterday').map((activity) => {
                            return (
                              <div key={activity.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 py-2 sm:py-1">
                                <span className="w-auto sm:w-16 text-xs text-slate-400 font-semibold">{activity.time}</span>
                                <span className="w-auto sm:w-40 text-xs font-bold text-slate-700">{activity.type}</span>
                                <span className="text-xs font-semibold text-slate-400">{activity.details}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Security */}
              {activeTab === 'security' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  
                  {/* Login Sessions */}
                  <div className="lg:col-span-8 bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
                    <h3 className="text-[15px] font-bold text-slate-800 mb-6">Login Sessions</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[500px]">
                        <thead>
                          <tr className="border-b border-slate-100 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                            <th className="pb-4 font-extrabold">Device</th>
                            <th className="pb-4 font-extrabold">Browser</th>
                            <th className="pb-4 font-extrabold">Location</th>
                            <th className="pb-4 font-extrabold">Last Active</th>
                            <th className="pb-4 font-extrabold">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-slate-50 hover:bg-slate-55/20">
                            <td className="py-4 text-xs font-bold text-slate-700">Windows PC</td>
                            <td className="py-4 text-xs font-semibold text-slate-500">Chrome 125</td>
                            <td className="py-4 text-xs font-semibold text-slate-500">New Delhi, India</td>
                            <td className="py-4 text-xs font-semibold text-slate-400">Active now</td>
                            <td className="py-4">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                                Current
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-50 hover:bg-slate-55/20">
                            <td className="py-4 text-xs font-bold text-slate-700">MacBook Pro</td>
                            <td className="py-4 text-xs font-semibold text-slate-500">Safari 17</td>
                            <td className="py-4 text-xs font-semibold text-slate-500">New Delhi, India</td>
                            <td className="py-4 text-xs font-semibold text-slate-400">3 hours ago</td>
                            <td className="py-4">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                                Active
                              </span>
                            </td>
                          </tr>
                          <tr className="border-b border-slate-50 hover:bg-slate-55/20">
                            <td className="py-4 text-xs font-bold text-slate-700">Android Phone</td>
                            <td className="py-4 text-xs font-semibold text-slate-500">Chrome Mobile</td>
                            <td className="py-4 text-xs font-semibold text-slate-500">Mumbai, India</td>
                            <td className="py-4 text-xs font-semibold text-slate-400">1 day ago</td>
                            <td className="py-4">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100">
                                Active
                              </span>
                            </td>
                          </tr>
                          <tr className="hover:bg-slate-55/20">
                            <td className="py-4 text-xs font-bold text-slate-700">iPhone 14</td>
                            <td className="py-4 text-xs font-semibold text-slate-500">Safari Mobile</td>
                            <td className="py-4 text-xs font-semibold text-slate-500">Bangalore, India</td>
                            <td className="py-4 text-xs font-semibold text-slate-400">3 days ago</td>
                            <td className="py-4">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100">
                                Inactive
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Security Controls */}
                  <div className="lg:col-span-4 space-y-4">
                    <h3 className="text-[15px] font-bold text-slate-800 px-1">Security Controls</h3>
                    
                    {/* Change Password */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.002)] hover:border-slate-250 transition-colors cursor-pointer select-none">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <Key className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-slate-800">Change Password</p>
                          <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Update your account password</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-350 shrink-0" />
                    </div>

                    {/* Enable 2FA */}
                    <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.002)] hover:border-slate-250 transition-colors cursor-pointer select-none">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-slate-800">Enable Two-Factor Authentication</p>
                          <p className="text-[11px] text-slate-400 font-semibold mt-0.5">Add extra security to your account</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                          Enabled
                        </span>
                        <ChevronRight className="h-4 w-4 text-slate-350" />
                      </div>
                    </div>

                    {/* Logout All Devices */}
                    <div className="bg-rose-50/30 border border-rose-100 hover:bg-rose-50/50 rounded-2xl p-4 flex items-center justify-between transition-colors cursor-pointer select-none">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <LogOut className="h-5 w-5" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-rose-700">Logout All Devices</p>
                          <p className="text-[11px] text-rose-500/80 font-semibold mt-0.5">Sign out of all active sessions</p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-rose-550 shrink-0" />
                    </div>

                  </div>

                </div>
              )}

              {/* TAB 3: Notifications */}
              {activeTab === 'notifications' && (
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.005)] max-w-3xl">
                  <h3 className="text-[15px] font-bold text-slate-800 mb-6">Notification Preferences</h3>
                  
                  <div className="space-y-6">
                    {/* Item 1 */}
                    <div className="flex items-center justify-between pb-6 border-b border-slate-50 last:border-b-0 last:pb-0">
                      <div className="flex items-center gap-4 text-left">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">Case Updates</p>
                          <p className="text-xs text-slate-400 font-semibold mt-0.5">Get notified about case updates and changes</p>
                        </div>
                      </div>
                      <InteractiveSwitch
                        checked={notifPreferences.caseUpdates}
                        onChange={() => setNotifPreferences(prev => ({ ...prev, caseUpdates: !prev.caseUpdates }))}
                      />
                    </div>

                    {/* Item 2 */}
                    <div className="flex items-center justify-between pb-6 border-b border-slate-50 last:border-b-0 last:pb-0">
                      <div className="flex items-center gap-4 text-left">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <Bell className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">New Cases</p>
                          <p className="text-xs text-slate-400 font-semibold mt-0.5">Get notified when you are assigned to new cases</p>
                        </div>
                      </div>
                      <InteractiveSwitch
                        checked={notifPreferences.newCases}
                        onChange={() => setNotifPreferences(prev => ({ ...prev, newCases: !prev.newCases }))}
                      />
                    </div>

                    {/* Item 3 */}
                    <div className="flex items-center justify-between pb-6 border-b border-slate-50 last:border-b-0 last:pb-0">
                      <div className="flex items-center gap-4 text-left">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                          <User className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">Mentions</p>
                          <p className="text-xs text-slate-400 font-semibold mt-0.5">Get notified when you are mentioned in comments</p>
                        </div>
                      </div>
                      <InteractiveSwitch
                        checked={notifPreferences.mentions}
                        onChange={() => setNotifPreferences(prev => ({ ...prev, mentions: !prev.mentions }))}
                      />
                    </div>

                    {/* Item 4 */}
                    <div className="flex items-center justify-between pb-6 border-b border-slate-50 last:border-b-0 last:pb-0">
                      <div className="flex items-center gap-4 text-left">
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">AI Alerts</p>
                          <p className="text-xs text-slate-400 font-semibold mt-0.5">Get notified of AI insights and alerts</p>
                        </div>
                      </div>
                      <InteractiveSwitch
                        checked={notifPreferences.aiAlerts}
                        onChange={() => setNotifPreferences(prev => ({ ...prev, aiAlerts: !prev.aiAlerts }))}
                      />
                    </div>

                    {/* Item 5 */}
                    <div className="flex items-center justify-between pb-6 border-b border-slate-50 last:border-b-0 last:pb-0">
                      <div className="flex items-center gap-4 text-left">
                        <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
                          <Mail className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">Email Notifications</p>
                          <p className="text-xs text-slate-400 font-semibold mt-0.5">Receive email notifications for important updates</p>
                        </div>
                      </div>
                      <InteractiveSwitch
                        checked={notifPreferences.emailNotif}
                        onChange={() => setNotifPreferences(prev => ({ ...prev, emailNotif: !prev.emailNotif }))}
                      />
                    </div>

                  </div>
                </div>
              )}

              {/* TAB 4: Preferences */}
              {activeTab === 'preferences' && (
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.005)] max-w-3xl space-y-8">
                  
                  {/* Appearance section */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-800">Appearance</h4>
                    <div className="flex gap-4">
                      <button
                        onClick={() => setDarkMode(false)}
                        className={`flex-1 max-w-[200px] h-[52px] rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          !darkMode
                            ? 'border-[#5D3FD3] bg-[#5D3FD3]/5 text-[#5D3FD3]'
                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <Palette className="h-4 w-4" />
                        Light Mode
                      </button>
                      <button
                        onClick={() => setDarkMode(true)}
                        className={`flex-1 max-w-[200px] h-[52px] rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          darkMode
                            ? 'border-[#5D3FD3] bg-[#5D3FD3]/5 text-[#5D3FD3]'
                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        <Bot className="h-4 w-4" />
                        Dark Mode
                      </button>
                    </div>
                  </div>

                  {/* Language section */}
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-slate-800">Language</h4>
                    <div className="relative max-w-md">
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 cursor-pointer appearance-none focus:outline-none focus:ring-2 focus:ring-[#5D3FD3]/20 focus:border-[#5D3FD3]"
                      >
                        <option value="English (US)">English (US)</option>
                        <option value="Español">Español</option>
                        <option value="Français">Français</option>
                        <option value="Deutsch">Deutsch</option>
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* AI Preferences */}
                  <div className="space-y-6 pt-4 border-t border-slate-100">
                    <h4 className="text-sm font-bold text-slate-800">AI Preferences</h4>
                    
                    {/* Item 1 */}
                    <div className="flex items-center justify-between pb-6 border-b border-slate-50 last:border-b-0 last:pb-0">
                      <div className="flex items-center gap-4 text-left">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-650 flex items-center justify-center shrink-0">
                          <Search className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">Save Search History</p>
                          <p className="text-xs text-slate-400 font-semibold mt-0.5">Save my search history for better results</p>
                        </div>
                      </div>
                      <InteractiveSwitch
                        checked={aiPreferences.saveSearch}
                        onChange={() => setAiPreferences(prev => ({ ...prev, saveSearch: !prev.saveSearch }))}
                      />
                    </div>

                    {/* Item 2 */}
                    <div className="flex items-center justify-between pb-6 border-b border-slate-50 last:border-b-0 last:pb-0">
                      <div className="flex items-center gap-4 text-left">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">Recommended Queries</p>
                          <p className="text-xs text-slate-400 font-semibold mt-0.5">Show me recommended search queries</p>
                        </div>
                      </div>
                      <InteractiveSwitch
                        checked={aiPreferences.recommendedQueries}
                        onChange={() => setAiPreferences(prev => ({ ...prev, recommendedQueries: !prev.recommendedQueries }))}
                      />
                    </div>

                    {/* Item 3 */}
                    <div className="flex items-center justify-between pb-6 border-b border-slate-50 last:border-b-0 last:pb-0">
                      <div className="flex items-center gap-4 text-left">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-650 flex items-center justify-center shrink-0">
                          <Bot className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">AI Suggestions</p>
                          <p className="text-xs text-slate-400 font-semibold mt-0.5">Receive AI suggestions and tips</p>
                        </div>
                      </div>
                      <InteractiveSwitch
                        checked={aiPreferences.aiSuggestions}
                        onChange={() => setAiPreferences(prev => ({ ...prev, aiSuggestions: !prev.aiSuggestions }))}
                      />
                    </div>

                  </div>

                </div>
              )}

              {/* TAB 5: Activity */}
              {activeTab === 'activity' && (
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
                  <h3 className="text-[15px] font-bold text-slate-800 mb-6">Recent Activity</h3>
                  <div className="space-y-6">
                    {/* Group Today */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today</h4>
                      <div className="space-y-5">
                        {recentActivities.filter(a => a.day === 'Today').map((activity) => {
                          const ActIcon = activity.icon
                          return (
                            <div key={activity.id} className="flex items-start gap-4 text-left">
                              <div className={`w-8 h-8 rounded-full ${activity.iconBg} ${activity.iconColor} flex items-center justify-center shrink-0 mt-0.5`}>
                                <ActIcon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800">
                                  {activity.type} <span className="font-semibold text-slate-400 ml-2">{activity.time}</span>
                                </p>
                                <p className="text-xs font-semibold text-slate-500 mt-1">{activity.details}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Group Yesterday */}
                    <div className="space-y-4 pt-6 border-t border-slate-100">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Yesterday</h4>
                      <div className="space-y-5">
                        {recentActivities.filter(a => a.day === 'Yesterday').map((activity) => {
                          const ActIcon = activity.icon
                          return (
                            <div key={activity.id} className="flex items-start gap-4 text-left">
                              <div className={`w-8 h-8 rounded-full ${activity.iconBg} ${activity.iconColor} flex items-center justify-center shrink-0 mt-0.5`}>
                                <ActIcon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-800">
                                  {activity.type} <span className="font-semibold text-slate-400 ml-2">{activity.time}</span>
                                </p>
                                <p className="text-xs font-semibold text-slate-500 mt-1">{activity.details}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      </div>
    </AppShell>
  )
}
