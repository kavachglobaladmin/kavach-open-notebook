'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { RebuildEmbeddings } from './components/RebuildEmbeddings'
import { SystemInfo } from './components/SystemInfo'
import { useTranslation } from '@/lib/hooks/use-translation'

export default function AdvancedPage() {
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
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{t.advanced.title}</h1>
              <p className="text-slate-500 mt-1 text-sm">{t.advanced.desc}</p>
            </div>

            <SystemInfo />
            <RebuildEmbeddings />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
