'use client'

import { useMemo, useState } from 'react'

import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { NotebookList } from './components/NotebookList'
import { Button } from '@/components/ui/button'
import { Plus, RefreshCw } from 'lucide-react'
import { useNotebooks } from '@/lib/hooks/use-notebooks'
import { CreateNotebookDialog } from '@/components/notebooks/CreateNotebookDialog'
import { useTranslation } from '@/lib/hooks/use-translation'

export default function NotebooksPage() {
  const { t } = useTranslation()
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const { data: notebooks, isLoading, refetch } = useNotebooks(false)
  const { data: archivedNotebooks } = useNotebooks(true)

  const normalizedQuery = searchTerm.trim().toLowerCase()

  const filteredActive = useMemo(() => {
    if (!notebooks) {
      return undefined
    }
    if (!normalizedQuery) {
      return notebooks
    }
    return notebooks.filter((notebook) =>
      notebook.name.toLowerCase().includes(normalizedQuery)
    )
  }, [notebooks, normalizedQuery])

  const filteredArchived = useMemo(() => {
    if (!archivedNotebooks) {
      return undefined
    }
    if (!normalizedQuery) {
      return archivedNotebooks
    }
    return archivedNotebooks.filter((notebook) =>
      notebook.name.toLowerCase().includes(normalizedQuery)
    )
  }, [archivedNotebooks, normalizedQuery])

  const hasArchived = (archivedNotebooks?.length ?? 0) > 0
  const isSearching = normalizedQuery.length > 0

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 bg-white">
        {/* Shared page header — search + NEW + logged-in user */}
        <PageHeader
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder={t.notebooks.searchPlaceholder || 'Search...'}
          newLabel={t.notebooks.newNotebook?.toUpperCase() || 'NEW'}
          onNew={() => setCreateDialogOpen(true)}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1600px] mx-auto p-8 space-y-8">
            {/* Heading Section */}
            <div className="flex items-end justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                  {t.notebooks.title || "Cases"}
                </h1>
                <p className="text-slate-500 font-medium mt-1">
                  {t.notebooks.activeNotebooks} ({filteredActive?.length || 0})
                </p>
              </div>
              <div className="flex items-center gap-3">
                 <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => refetch()}
                    className="rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  {t.common.refresh || "Refresh"}
                </Button>
                <Button 
                  onClick={() => setCreateDialogOpen(true)}
                  className="bg-[#FF7043] hover:bg-[#F4511E] text-white rounded-lg h-10 font-semibold gap-2"
                >
                  <Plus className="h-4 w-4" />
                  {t.notebooks.newNotebook || "NEW CASE"}
                </Button>
              </div>
            </div>
            
            {/* Notebook Lists */}
            <div className="space-y-12">
              <NotebookList 
                notebooks={filteredActive} 
                isLoading={isLoading}
                title="" // Title is handled by the custom header above
                emptyTitle={isSearching ? t.common.noMatches : undefined}
                emptyDescription={isSearching ? t.common.tryDifferentSearch : undefined}
                onAction={!isSearching ? () => setCreateDialogOpen(true) : undefined}
                actionLabel={!isSearching ? t.notebooks.newNotebook : undefined}
              />
              
              {hasArchived && (
                <div className="pt-4 border-t border-slate-100">
                  <NotebookList 
                    notebooks={filteredArchived} 
                    isLoading={false}
                    title={t.notebooks.archivedNotebooks}
                    collapsible
                    emptyTitle={isSearching ? t.common.noMatches : undefined}
                    emptyDescription={isSearching ? t.common.tryDifferentSearch : undefined}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CreateNotebookDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
      />
    </AppShell>
  )
}