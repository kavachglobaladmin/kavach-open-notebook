'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { SettingsForm } from './components/SettingsForm'
import { useTranslation } from '@/lib/hooks/use-translation'

export default function SettingsPage() {
  const { t } = useTranslation()
  const [searchTerm, setSearchTerm] = useState('')

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 bg-white">
        {/* Shared page header */}
        <PageHeader
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search..."
          hideNew
        />

        <div className="flex-1 overflow-y-auto">
          <div className="p-8 space-y-6">
            {/* Page title */}
            <h1 className="text-3xl font-bold text-slate-900">{t.navigation.settings}</h1>

            {/* Settings form — collapsible section rows */}
            <SettingsForm />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
