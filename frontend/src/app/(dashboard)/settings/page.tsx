'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { SettingsForm } from './components/SettingsForm'
import { useTranslation } from '@/lib/hooks/use-translation'
import { motion } from 'framer-motion'

export default function SettingsPage() {
  const { t } = useTranslation()
  const [searchTerm, setSearchTerm] = useState('')

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 bg-[#F8F9FF] relative overflow-hidden">
        {/* Background glows */}
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-200 rounded-full blur-[120px] opacity-60 animate-pulse pointer-events-none" />
        <div className="absolute bottom-[10%] left-[-5%] w-[400px] h-[400px] bg-blue-100 rounded-full blur-[100px] opacity-50 pointer-events-none" />

        <PageHeader
          searchValue={searchTerm}
          onSearchChange={(val) => setSearchTerm(val)}
          newLabel="NOTEBOOK"
        />

        <div className="flex-1 overflow-y-auto relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-7xl mx-auto p-8 space-y-8"
          >
            {/* Header Section */}
            <div className="space-y-1">
              <h1 className="text-4xl font-bold text-[#5D3FD3]">
                {t.navigation.settings || 'Settings'}
              </h1>
              <p className="text-slate-500 font-medium">
                Manage your notebook preferences and configurations
              </p>
            </div>

            {/* Main Settings Grid and Form */}
            <div className="mt-8">
              <SettingsForm />
            </div>
          </motion.div>
        </div>
      </div>
    </AppShell>
  )
}