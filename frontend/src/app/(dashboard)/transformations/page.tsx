'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { DefaultPromptEditor } from './components/DefaultPromptEditor'
import { TransformationsList } from './components/TransformationsList'
import { TransformationPlayground } from './components/TransformationPlayground'
import { useTransformations } from '@/lib/hooks/use-transformations'
import { Transformation } from '@/lib/types/transformations'
import { useTranslation } from '@/lib/hooks/use-translation'

export default function TransformationsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'transformations' | 'playground'>('transformations')
  const [selectedTransformation, setSelectedTransformation] = useState<Transformation | undefined>()
  const [searchTerm, setSearchTerm] = useState('')
  const { data: transformations, isLoading } = useTransformations()

  const handlePlayground = (transformation: Transformation) => {
    setSelectedTransformation(transformation)
    setActiveTab('playground')
  }

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
            {/* Page title + subtitle */}
            <div>
              <h1 className="text-3xl font-bold text-slate-900 leading-tight">
                {t.transformations.title}
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                {t.transformations.desc}
              </p>
            </div>

            {/* Tab pills */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('transformations')}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                  activeTab === 'transformations'
                    ? 'bg-[#FF7043] text-white shadow-sm'
                    : 'bg-[#FFF0EB] text-[#FF7043] hover:bg-orange-100'
                }`}
              >
                {t.transformations.title}
              </button>
              <button
                onClick={() => setActiveTab('playground')}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
                  activeTab === 'playground'
                    ? 'bg-[#FF7043] text-white shadow-sm'
                    : 'bg-[#FFF0EB] text-[#FF7043] hover:bg-orange-100'
                }`}
              >
                {t.transformations.playground}
              </button>
            </div>

            {/* Tab content */}
            {activeTab === 'transformations' && (
              <div className="space-y-6">
                <DefaultPromptEditor />
                <TransformationsList
                  transformations={transformations}
                  isLoading={isLoading}
                  onPlayground={handlePlayground}
                />
              </div>
            )}

            {activeTab === 'playground' && (
              <TransformationPlayground
                transformations={transformations}
                selectedTransformation={selectedTransformation}
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
