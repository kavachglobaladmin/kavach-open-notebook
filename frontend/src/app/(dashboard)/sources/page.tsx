'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { sourcesApi } from '@/lib/api/sources'
import { SourceListResponse } from '@/lib/types/api'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { EmptyState } from '@/components/common/EmptyState'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { FileText, Trash2, ArrowUpDown, Upload, Link as LinkIcon, AlignLeft } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getDateLocale } from '@/lib/utils/date-locale'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/notifications/toast'
import { getApiErrorKey } from '@/lib/utils/error-handler'

export default function SourcesPage() {
  const { t, language } = useTranslation()
  const [sources, setSources] = useState<SourceListResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; source: SourceListResponse | null }>({
    open: false,
    source: null
  })
  
  const router = useRouter()
  const tableRef = useRef<HTMLTableElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  const loadingMoreRef = useRef(false)
  const hasMoreRef = useRef(true)
  const PAGE_SIZE = 30

  const [sortBy, setSortBy] = useState<'created' | 'updated'>('updated')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

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

  const getSourceType = (source: SourceListResponse) => {
    if (source.asset?.url) return 'Link'
    if (source.asset?.file_path) return 'File'
    return 'Text'
  }

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

  if (loading) return <AppShell><div className="flex h-full items-center justify-center"><LoadingSpinner /></div></AppShell>
  if (error) return <AppShell><div className="flex h-full items-center justify-center text-red-500">{error}</div></AppShell>

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 bg-white">
        {/* Shared page header — search + NEW + logged-in user */}
        <PageHeader
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search..."
          newLabel="NEW"
          onNew={() => {/* sources add dialog handled inline below */}}
        />

        <main className="flex-1 overflow-hidden flex flex-col p-8">
          <div className="mb-10">
            <h1 className="text-[26px] font-bold text-slate-900 leading-tight">All Sources</h1>
            <p className="text-slate-500 text-sm mt-1">
              View All Your Sources Here. You Can Add New Sources Or Manage Existing Ones.
            </p>
          </div>

          <div className="flex-1 overflow-auto rounded-2xl border border-slate-100 shadow-sm">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#FFF5F3] text-slate-700">
                  <th className="h-14 px-8 text-left text-[14px] font-semibold first:rounded-tl-2xl">Type</th>
                  <th className="h-14 px-4 text-left text-[14px] font-semibold">Title</th>
                  <th className="h-14 px-4 text-center text-[14px] font-semibold">
                    <button onClick={() => setSortBy('created')} className="inline-flex items-center gap-2 hover:text-slate-900">
                      Created <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
                    </button>
                  </th>
                  <th className="h-14 px-4 text-center text-[14px] font-semibold">Insights</th>
                  <th className="h-14 px-4 text-center text-[14px] font-semibold">Embedded</th>
                  <th className="h-14 px-8 text-right text-[14px] font-semibold last:rounded-tr-2xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sources.map((source, index) => (
                  <tr key={source.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="h-16 px-8">
                      <Badge className="bg-[#FFF0EB] text-[#FF7043] border-none shadow-none hover:bg-[#FFF0EB] px-3 py-1 rounded-lg gap-1.5 font-medium">
                        <Upload className="h-3 w-3" />
                        {getSourceType(source)}
                      </Badge>
                    </td>
                    <td className="h-16 px-4">
                      <span className="font-semibold text-slate-800 text-[14px] block truncate max-w-xs">
                        {source.title || "Untitled Document"}
                      </span>
                    </td>
                    <td className="h-16 px-4 text-center text-slate-500 text-[13px] font-medium">
                      {formatDistanceToNow(new Date(source.created), { addSuffix: true })}
                    </td>
                    <td className="h-16 px-4 text-center text-slate-600 font-medium text-[14px]">
                      {source.insights_count || 1}
                    </td>
                    <td className="h-16 px-4 text-center">
                      <Badge className={cn(
                        "border-none shadow-none px-5 py-1 rounded-full text-[12px] font-bold uppercase",
                        source.embedded ? "bg-[#FFF0EB] text-[#FF7043]" : "bg-slate-100 text-slate-400"
                      )}>
                        {source.embedded ? 'Yes' : 'No'}
                      </Badge>
                    </td>
                    <td className="h-16 px-8 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => { e.stopPropagation(); setDeleteDialog({ open: true, source }); }}
                        className="text-[#FF7043] hover:text-white hover:bg-red-500 h-8 w-8 rounded-lg"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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