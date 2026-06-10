'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { SettingsForm } from './components/SettingsForm'
import { useTranslation } from '@/lib/hooks/use-translation'
import { motion } from 'framer-motion'
import {
  User,
  Shield,
  Bell,
  Palette,
  Globe,
  Users,
  Key,
  Plug,
  CreditCard,
  Code,
  Activity,
  Database,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Check,
  HardDrive,
  Clock,
  Settings2
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export default function SettingsPage() {
  const { t } = useTranslation()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeDialog, setActiveDialog] = useState<string | null>(null)

  const SETTING_CARDS = [
    {
      id: 'account',
      title: 'Account Settings',
      description: 'Manage your profile, personal information, and preferences',
      icon: User,
      iconColor: 'text-blue-650',
      iconBg: 'bg-blue-50',
    },
    {
      id: 'security',
      title: 'Security & Privacy',
      description: 'Password, 2FA, sessions, and privacy controls',
      icon: Shield,
      iconColor: 'text-purple-600',
      iconBg: 'bg-purple-50',
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Configure alerts, emails, and notification preferences',
      icon: Bell,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
    },
    {
      id: 'appearance',
      title: 'Appearance & Theme',
      description: 'Customize UI, themes, layouts, and display options',
      icon: Palette,
      iconColor: 'text-pink-600',
      iconBg: 'bg-pink-50',
    },
    {
      id: 'language',
      title: 'Language & Region',
      description: 'Set language, timezone, date format, and locale',
      icon: Globe,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
    },
    {
      id: 'users',
      title: 'User Management',
      description: 'Add, edit, and manage users across the organization',
      icon: Users,
      iconColor: 'text-sky-650',
      iconBg: 'bg-sky-50',
    },
    {
      id: 'roles',
      title: 'Roles & Permissions',
      description: 'Configure access control and permission settings',
      icon: Key,
      iconColor: 'text-indigo-600',
      iconBg: 'bg-indigo-50',
    },
    {
      id: 'integrations',
      title: 'Integrations',
      description: 'Connect third-party apps and services',
      icon: Plug,
      iconColor: 'text-violet-600',
      iconBg: 'bg-violet-50',
    },
    {
      id: 'billing',
      title: 'Billing & Subscription',
      description: 'Manage plans, payments, and invoices',
      icon: CreditCard,
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-50',
    },
    {
      id: 'api',
      title: 'API & Developer',
      description: 'API keys, webhooks, and developer resources',
      icon: Code,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
      href: '/settings/api-keys',
    },
    {
      id: 'activity',
      title: 'Activity Logs',
      description: 'View audit trails and system activity',
      icon: Activity,
      iconColor: 'text-rose-600',
      iconBg: 'bg-rose-50',
    },
    {
      id: 'backup',
      title: 'Data Backup & Recovery',
      description: 'Backup settings and data recovery options',
      icon: Database,
      iconColor: 'text-indigo-650',
      iconBg: 'bg-indigo-50',
    },
    {
      id: 'support',
      title: 'Help & Support',
      description: 'Documentation, tutorials, and support resources',
      icon: HelpCircle,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-50',
    },
  ]

  // Filter cards based on search term
  const filteredCards = SETTING_CARDS.filter(
    (card) =>
      card.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      card.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCardClick = (id: string) => {
    setActiveDialog(id)
  }

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 bg-[#F8FAFC] relative overflow-hidden">
        {/* Decorative subtle background elements */}
        <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-slate-100 rounded-full blur-[100px] opacity-40 pointer-events-none" />
        <div className="absolute bottom-[10%] left-[-5%] w-[300px] h-[300px] bg-slate-100 rounded-full blur-[80px] opacity-30 pointer-events-none" />

        <PageHeader
          searchValue={searchTerm}
          onSearchChange={(val) => setSearchTerm(val)}
          newLabel="i_Notes"
        />

        <div className="flex-1 overflow-y-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full p-6 lg:p-8 space-y-6"
          >
            {/* Header Section */}
            <div className="space-y-1 text-left">
              <h1 className="text-3xl font-bold text-slate-800 leading-tight">
                {t.navigation.settings || 'Settings'}
              </h1>
              <p className="text-slate-500 text-sm font-semibold">
                Manage your account, preferences, and system configurations
              </p>
            </div>

            {/* Split layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start pt-2">
              
              {/* Left Column: Grid of setting cards */}
              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredCards.map((card) => {
                  const Icon = card.icon
                  const cardContent = (
                    <div className="flex items-center gap-4 text-left w-full">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${card.iconBg}`}>
                        <Icon className={`h-5 w-5 ${card.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 text-[15px] truncate">{card.title}</div>
                        <div className="text-slate-400 text-[11.5px] font-semibold mt-0.5 leading-snug line-clamp-2">
                          {card.description}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 ml-auto" />
                    </div>
                  )

                  const wrapperClass =
                    "bg-white p-5 rounded-2xl border border-slate-100/90 shadow-[0_2px_8px_rgba(0,0,0,0.005)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.015)] hover:border-slate-200/50 hover:-translate-y-0.5 transition-all duration-200 cursor-pointer select-none text-left min-h-[110px] flex items-center"

                  if (card.href) {
                    return (
                      <Link key={card.id} href={card.href} className={wrapperClass}>
                        {cardContent}
                      </Link>
                    )
                  }

                  return (
                    <div key={card.id} onClick={() => handleCardClick(card.id)} className={wrapperClass}>
                      {cardContent}
                    </div>
                  )
                })}
              </div>

              {/* Right Column: Sidebar summaries */}
              <div className="lg:col-span-4 space-y-6">
                
                {/* Account Summary */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.005)] text-left">
                  <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                    <User className="h-5 w-5 text-indigo-600" />
                    <h3 className="font-bold text-slate-800 text-[15px]">Account Summary</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-400">Account Type</span>
                      <span className="text-slate-800 font-bold">Superadmin</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-400">Member Since</span>
                      <span className="text-slate-800 font-bold">Jan 2024</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-400">Status</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">Active</span>
                    </div>
                  </div>
                </div>

                {/* Security Status */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.005)] text-left">
                  <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-bold text-slate-800 text-[15px]">Security Status</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="h-3 w-3 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Password Strong</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Last changed 30 days ago</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-amber-50 flex items-center justify-center shrink-0 mt-0.5">
                        <AlertTriangle className="h-3 w-3 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">2FA Not Enabled</p>
                        <button className="text-[10px] text-amber-600 font-bold hover:underline mt-0.5 cursor-pointer">
                          Enable now
                        </button>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="h-3 w-3 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">4 Active Sessions</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Across devices</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Storage Usage */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.005)] text-left">
                  <div className="flex items-center gap-3 mb-4">
                    <HardDrive className="h-5 w-5 text-blue-600" />
                    <h3 className="font-bold text-slate-800 text-[15px]">Storage Usage</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                        <span className="text-slate-400">2.4 TB of 5 TB used</span>
                        <span className="text-slate-800 font-bold">48%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-600 rounded-full" style={{ width: '48%' }} />
                      </div>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-slate-400">Documents</span>
                        <span className="text-slate-700 font-bold">1.2 TB</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-slate-400">Media</span>
                        <span className="text-slate-700 font-bold">0.8 TB</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-semibold">
                        <span className="text-slate-400">Other</span>
                        <span className="text-slate-700 font-bold">0.4 TB</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* System Health */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.005)] text-left">
                  <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                    <Activity className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-bold text-slate-800 text-[15px]">System Health</h3>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-400">API Status</span>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-slate-850 font-bold">Operational</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-400">Database</span>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-slate-850 font-bold">Healthy</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-400">Uptime</span>
                      <span className="text-slate-800 font-bold">99.9%</span>
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-[0_2px_8px_rgba(0,0,0,0.005)] text-left">
                  <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                    <Clock className="h-5 w-5 text-slate-500" />
                    <h3 className="font-bold text-slate-800 text-[15px]">Recent Activity</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center shrink-0 mt-0.5">
                        <HardDrive className="h-3 w-3 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Password changed</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">2 hours ago</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center shrink-0 mt-0.5">
                        <User className="h-3 w-3 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">Profile updated</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">1 day ago</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-slate-50 flex items-center justify-center shrink-0 mt-0.5">
                        <Globe className="h-3 w-3 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">New device login</p>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">3 days ago</p>
                      </div>
                    </div>
                    <button className="text-[11px] text-[#F97316] font-bold hover:underline mt-2 inline-flex items-center gap-1 cursor-pointer">
                      View all activity &rarr;
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Account Settings Form Modal */}
      <Dialog open={activeDialog === 'account'} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 border-slate-100">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl font-bold text-slate-800">Account Settings</DialogTitle>
            <DialogDescription className="text-slate-500 font-semibold">
              Manage your i_Notes preferences, processing engines, and notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2">
            <SettingsForm />
          </div>
        </DialogContent>
      </Dialog>

      {/* Other Settings Placeholder Modal */}
      <Dialog open={!!activeDialog && activeDialog !== 'account'} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6 border-slate-100">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800">
              {SETTING_CARDS.find((c) => c.id === activeDialog)?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-[#F59E0B]">
              <Settings2 className="h-8 w-8 animate-pulse" />
            </div>
            <p className="text-sm text-slate-500 font-semibold">
              This settings category is currently active with default system values.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  )
}
