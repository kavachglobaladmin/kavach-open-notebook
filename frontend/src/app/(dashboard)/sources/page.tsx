'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { sourcesApi } from '@/lib/api/sources'
import { SourceListResponse } from '@/lib/types/api'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { 
  FileText, 
  Trash2, 
  LayoutGrid, 
  List, 
  Search, 
  Filter 
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/hooks/use-translation'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/notifications/toast'
import { getApiErrorKey } from '@/lib/utils/error-handler'

export default function SourcesPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [sources, setSources] = useState<SourceListResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; source: SourceListResponse | null }>({
    open: false,
    source: null
  })
  
  const offsetRef = useRef(0)
  const loadingMoreRef = useRef(false)
  const hasMoreRef = useRef(true)
  const PAGE_SIZE = 30

  const [sortBy] = useState<'created' | 'updated'>('updated')
  const [sortOrder] = useState<'asc' | 'desc'>('desc')

  // --- Logic Preserved ---
  const fetchSources = useCallback(async (reset = false) => {
    try {
      if (!reset && (loadingMoreRef.current || !hasMoreRef.current)) return
      if (reset) {
        setLoading(true)
        offsetRef.current = 0
        setSources([])
        hasMoreRef.current = true
      } else {
        loadingMoreRef.current = true
        setLoadingMore(true)
      }

      const data = await sourcesApi.list({
        limit: PAGE_SIZE,
        offset: offsetRef.current,
        sort_by: sortBy,
        sort_order: sortOrder,
      })

      if (reset) setSources(data)
      else setSources(prev => [...prev, ...data])

      hasMoreRef.current = data.length === PAGE_SIZE
      offsetRef.current += data.length
    } catch (err) {
      setError(t.sources.failedToLoad)
      toast.error(t.sources.failedToLoad)
    } finally {
      setLoading(false)
      setLoadingMore(false)
      loadingMoreRef.current = false
    }
  }, [sortBy, sortOrder, t.sources.failedToLoad])

  useEffect(() => { fetchSources(true) }, [fetchSources])

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.source) return
    try {
      await sourcesApi.delete(deleteDialog.source.id)
      toast.success(t.sources.deleteSuccess)
      setSources(prev => prev.filter(s => s.id !== deleteDialog.source?.id))
      setDeleteDialog({ open: false, source: null })
    } catch (err: any) {
      toast.error(t(getApiErrorKey(err.response?.data?.detail || err.message)))
    }
  }

  // Filter logic for search
  const filteredSources = sources.filter(source => 
    source.title?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Navigate to the source detail / chat page
  const handleSourceClick = (sourceId: string) => {
    router.push(`/sources/${encodeURIComponent(sourceId)}`)
  }

  if (loading) return <AppShell><div className="flex h-full items-center justify-center bg-[#F9FAFF]"><LoadingSpinner /></div></AppShell>
  if (error) return <AppShell><div className="flex h-full items-center justify-center text-red-500 bg-[#F9FAFF]">{error}</div></AppShell>

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 bg-[#F9FAFF] relative overflow-hidden">
        {/* Background Gradient Effect - Exact match to shared reference */}
        <div className="absolute top-0 right-[-10%] w-[800px] h-[800px] bg-[#E0D7FF]/50 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#D7E4FF]/40 rounded-full blur-[100px] pointer-events-none" />

        <PageHeader
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search sources..."
          newLabel="NOTEBOOK"
          onNew={() => {}} 
        />

        <main className="relative z-10 flex-1 flex flex-col p-6 md:p-10 overflow-y-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-extrabold text-[#6334E3] tracking-tight">All Sources</h1>
              <p className="text-slate-500 text-sm font-medium mt-1">
                Manage your document library and knowledge base sources
              </p>
            </div>
            
            <div className="bg-white/70 backdrop-blur-md border border-white shadow-sm rounded-xl p-1.5 flex items-center gap-2">
               <Button variant="ghost" size="sm" className="text-slate-500 gap-2 h-8 font-semibold">
                <Filter className="h-4 w-4" />
                Filter
              </Button>
              <div className="w-px h-4 bg-slate-200 mx-1" />
              <div className="flex items-center gap-1 bg-slate-100/50 rounded-lg p-0.5">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn("h-7 w-7 rounded-md transition-all", viewMode === 'list' ? "bg-white shadow-sm text-[#6334E3]" : "text-slate-400")}
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className={cn("h-7 w-7 rounded-md transition-all", viewMode === 'grid' ? "bg-white shadow-sm text-[#6334E3]" : "text-slate-400")}
                  onClick={() => setViewMode('grid')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {viewMode === 'list' ? (
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl border border-white shadow-2xl shadow-purple-100/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-50">
                      <th className="px-8 py-6 text-left text-[11px] font-bold uppercase tracking-widest">Document</th>
                      <th className="px-4 py-6 text-left text-[11px] font-bold uppercase tracking-widest">Size</th>
                      <th className="px-4 py-6 text-left text-[11px] font-bold uppercase tracking-widest">Created</th>
                      <th className="px-4 py-6 text-center text-[11px] font-bold uppercase tracking-widest">Insights</th>
                      <th className="px-4 py-6 text-left text-[11px] font-bold uppercase tracking-widest">Status</th>
                      <th className="px-8 py-6 text-right text-[11px] font-bold uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredSources.map((source) => (
                      <tr
                        key={source.id}
                        className="hover:bg-slate-50/50 transition-all cursor-pointer"
                        onClick={() => handleSourceClick(source.id)}
                      >
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="h-11 w-11 rounded-xl bg-[#4A6CF7] flex items-center justify-center shadow-lg shadow-blue-100">
                              <FileText className="h-5 w-5 text-white" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 text-sm truncate max-w-[240px]">
                                {source.title || "Untitled Document"}
                              </p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">12 pages</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-5 text-sm font-semibold text-slate-600">2.4 MB</td>
                        <td className="px-4 py-5 text-sm font-semibold text-slate-500">
                          {formatDistanceToNow(new Date(source.created), { addSuffix: true })}
                        </td>
                        <td className="px-4 py-5 text-center">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-[#4A6CF7] text-[11px] font-bold border border-blue-100">
                            {source.insights_count || 1}
                          </span>
                        </td>
                        <td className="px-4 py-5">
                          <div className="flex items-center gap-2">
                            <div className={cn("h-2 w-2 rounded-full", source.embedded ? "bg-emerald-400" : "bg-amber-400")} />
                            <span className={cn("text-[12px] font-bold", source.embedded ? "text-emerald-500" : "text-amber-500")}>
                              {source.embedded ? 'Embedded' : 'Pending'}
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); setDeleteDialog({ open: true, source }); }}
                            className="text-slate-300 hover:text-red-500 h-9 w-9 rounded-xl"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredSources.map((source) => (
                <div
                  key={source.id}
                  className="bg-white rounded-[24px] border border-white/50 shadow-xl shadow-slate-200/40 p-5 flex flex-col hover:scale-[1.01] transition-transform duration-300 cursor-pointer"
                  onClick={() => handleSourceClick(source.id)}
                >
                  {/* Card Icon Container */}
                  <div className="aspect-[16/9] bg-[#F1EEFF] rounded-[20px] flex items-center justify-center mb-5 relative group">
                    <FileText className="h-14 w-14 text-[#6334E3]" />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => { e.stopPropagation(); setDeleteDialog({ open: true, source }); }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Document Info */}
                  <div className="px-1">
                    <h3 className="font-bold text-slate-800 text-sm mb-2 truncate">
                      {source.title || "Untitled Document"}
                    </h3>
                    
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-4">
                      <span>2.4 MB</span>
                      <span>12 pages</span>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        source.embedded ? "bg-emerald-400" : "bg-amber-400"
                      )} />
                      <span className={cn(
                        "text-[11px] font-bold",
                        source.embedded ? "text-emerald-500" : "text-amber-500"
                      )}>
                        {source.embedded ? 'Embedded' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredSources.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                <Search className="h-8 w-8 text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">No sources found</h3>
            </div>
          )}
        </main>
      </div>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, source: deleteDialog.source })}
        title={t.sources.delete}
        description={t.sources.deleteConfirmWithTitle.replace('{title}', deleteDialog.source?.title || t.sources.untitledSource)}
        confirmText={t.common.delete}
        confirmVariant="destructive"
        onConfirm={handleDeleteConfirm}
      />
    </AppShell>
  )
}