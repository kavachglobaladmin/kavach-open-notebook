'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useQueries } from '@tanstack/react-query'
import { ChevronLeft, FolderOpen, MessageSquare, Plus } from 'lucide-react'
import Link from 'next/link'

import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { notesApi } from '@/lib/api/notes'
import { QUERY_KEYS } from '@/lib/api/query-client'
import { sourcesApi } from '@/lib/api/sources'
import { useIsDesktop } from '@/lib/hooks/use-media-query'
import { useNotebook, useNotebooks } from '@/lib/hooks/use-notebooks'
import { useSubFolders } from '@/lib/hooks/use-sub-folders'
import { useTranslation } from '@/lib/hooks/use-translation'
import { cn } from '@/lib/utils'
import { CreateSubFolderDialog } from '../components/CreateSubFolderDialog'
import { SubFolderCard } from '../components/SubFolderCard'
import { SuperChatColumn } from '../components/SuperChatColumn'
import type { NoteResponse, SourceListResponse } from '@/lib/types/api'

export type ContextMode = 'off' | 'insights' | 'full'

export interface ContextSelections {
  sources: Record<string, ContextMode>
  notes: Record<string, ContextMode>
}

function mergeById<T extends { id: string }>(collections: T[][]): T[] {
  const deduped = new Map<string, T>()
  collections.forEach((collection) => {
    collection.forEach((item) => {
      deduped.set(item.id, item)
    })
  })
  return Array.from(deduped.values())
}

function getFolderDisplayName(folderId: string, fallbackName?: string | null) {
  if (fallbackName && fallbackName.trim()) return fallbackName
  const [, shortId = folderId] = folderId.split(':')
  return shortId
}

export default function NotebookFolderPage() {
  const { t } = useTranslation()
  const params = useParams()
  const searchParams = useSearchParams()

  const rawParam = params?.id ? decodeURIComponent(params.id as string) : ''
  const notebookId = rawParam.includes(':') ? rawParam : rawParam ? `notebook:${rawParam}` : ''
  const queryFromUrl = searchParams?.get('q')?.trim() || ''

  const { data: notebook, isLoading: notebookLoading } = useNotebook(notebookId)
  const chatTitle = 'Chat with ALL Notebook'

  const { childIds, addChild, removeChild } = useSubFolders(notebookId)
  // Use childIds directly so folder names and query indices always align.
  // getDescendantIds reads from localStorage which may be stale on first render.
  const contextNotebookIds = childIds
  const contextNotebookIdKey = contextNotebookIds.join('|')

  const { data: allNotebooks } = useNotebooks(false)
  const { data: allArchivedNotebooks } = useNotebooks(true)

  const allNotebooksFlat = useMemo(
    () => [...(allNotebooks ?? []), ...(allArchivedNotebooks ?? [])],
    [allNotebooks, allArchivedNotebooks],
  )
  const subFolders = allNotebooksFlat.filter((nb) => childIds.includes(nb.id))
  const sourcesQueries = useQueries({
    queries: contextNotebookIds.map((id) => ({
      queryKey: QUERY_KEYS.sources(id),
      queryFn: () =>
        sourcesApi.list({
          notebook_id: id,
          limit: 500,
          offset: 0,
          sort_by: 'updated',
          sort_order: 'desc',
        }),
      enabled: !!id,
    })),
  })

  const notesQueries = useQueries({
    queries: contextNotebookIds.map((id) => ({
      queryKey: QUERY_KEYS.notes(id),
      queryFn: () => notesApi.list({ notebook_id: id }),
      enabled: !!id,
    })),
  })

  const sourcesDataStamp = sourcesQueries.map((query) => query.dataUpdatedAt).join('|')
  const notesDataStamp = notesQueries.map((query) => query.dataUpdatedAt).join('|')

  const sourcesCacheRef = useRef<{ stamp: string; value: SourceListResponse[] }>({
    stamp: '',
    value: [],
  })
  if (sourcesCacheRef.current.stamp !== sourcesDataStamp) {
    sourcesCacheRef.current = {
      stamp: sourcesDataStamp,
      value: mergeById<SourceListResponse>(sourcesQueries.map((query) => query.data ?? [])),
    }
  }
  const sources = sourcesCacheRef.current.value

  const notesCacheRef = useRef<{ stamp: string; value: NoteResponse[] }>({
    stamp: '',
    value: [],
  })
  if (notesCacheRef.current.stamp !== notesDataStamp) {
    notesCacheRef.current = {
      stamp: notesDataStamp,
      value: mergeById<NoteResponse>(notesQueries.map((query) => query.data ?? [])),
    }
  }
  const notes = notesCacheRef.current.value

  const folderContextsCacheRef = useRef<{
    stamp: string
    value: Array<{
      id: string
      name: string
      sources: SourceListResponse[]
      notes: NoteResponse[]
    }>
  }>({
    stamp: '',
    value: [],
  })
  const folderContextsStamp = `${contextNotebookIdKey}::${sourcesDataStamp}::${notesDataStamp}`
  if (folderContextsCacheRef.current.stamp !== folderContextsStamp) {
    // subFolders already has correct names from allNotebooksFlat.
    // Build a lookup: folderId → index in contextNotebookIds (= childIds).
    const folderIdToIndex = new Map(contextNotebookIds.map((id, i) => [id, i]))
    // Also build a name lookup from the already-resolved subFolders list.
    const folderNameLookup = new Map(subFolders.map((sf) => [sf.id, sf.name]))
    // Fall back to allNotebooksFlat for any folder not yet in subFolders.
    allNotebooksFlat.forEach((nb) => {
      if (!folderNameLookup.has(nb.id)) folderNameLookup.set(nb.id, nb.name)
    })

    folderContextsCacheRef.current = {
      stamp: folderContextsStamp,
      value: contextNotebookIds.map((folderId) => {
        const index = folderIdToIndex.get(folderId) ?? 0
        const resolvedName = folderNameLookup.get(folderId) ?? getFolderDisplayName(folderId)
        return {
          id: folderId,
          name: resolvedName,
          sources: sourcesQueries[index]?.data ?? [],
          notes: notesQueries[index]?.data ?? [],
        }
      }),
    }
  }
  const folderContexts = folderContextsCacheRef.current.value
  // Show all folders: ones with data use just their name,
  // empty folders show "FolderName (Not available)" so the AI knows they exist.
  const contextFolderLabels = folderContexts.map((folder) =>
    folder.sources.length > 0 || folder.notes.length > 0
      ? folder.name
      : `${folder.name} (Not available)`,
  )

  const sourcesLoading = sourcesQueries.some((query) => query.isLoading)
  const notesLoading = notesQueries.some((query) => query.isLoading)
  const contextLoading = sourcesLoading || notesLoading

  const isDesktop = useIsDesktop()
  const [mobileActiveTab, setMobileActiveTab] = useState<'folders' | 'chat'>('folders')
  const [searchTerm, setSearchTerm] = useState('')
  const [contextSelections, setContextSelections] = useState<ContextSelections>({
    sources: {},
    notes: {},
  })
  const [createSubFolderOpen, setCreateSubFolderOpen] = useState(false)

  useEffect(() => {
    if (queryFromUrl) setSearchTerm(queryFromUrl)
  }, [queryFromUrl])

  useEffect(() => {
    if (sources.length === 0) return

    setContextSelections((prev) => {
      const next = { ...prev.sources }
      let changed = false
      sources.forEach((source) => {
        const current = next[source.id]
        const hasInsights = source.insights_count > 0
        if (current === undefined) {
          next[source.id] = hasInsights ? 'insights' : 'full'
          changed = true
        } else if (current === 'full' && hasInsights) {
          next[source.id] = 'insights'
          changed = true
        }
      })
      return changed ? { ...prev, sources: next } : prev
    })
  }, [sources])

  useEffect(() => {
    if (notes.length === 0) return

    setContextSelections((prev) => {
      const next = { ...prev.notes }
      let changed = false
      notes.forEach((note) => {
        if (!(note.id in next)) {
          next[note.id] = 'full'
          changed = true
        }
      })
      return changed ? { ...prev, notes: next } : prev
    })
  }, [notes])

  const handleSubFolderCreated = (newNotebookId: string) => {
    addChild(newNotebookId)
  }

  if (notebookLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!notebook) {
    return (
      <AppShell>
        <div className="p-4 sm:p-6">
          <h1 className="text-2xl font-bold mb-4">{t.notebooks.notFound}</h1>
          <p className="text-muted-foreground">{t.notebooks.notFoundDesc}</p>
        </div>
      </AppShell>
    )
  }

  const SubFoldersPanel = (
    <div className="flex flex-col h-full bg-white rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4 flex-shrink-0">
        <div>
          <h2 className="text-[20px] font-bold text-slate-900">Sub-folders</h2>
          <p className="text-[13px] text-slate-500 font-medium mt-0.5">
            {subFolders.length} folder{subFolders.length !== 1 ? 's' : ''} inside this case
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setCreateSubFolderOpen(true)}
          className="bg-[#6149f6] hover:bg-[#523cdb] text-white rounded-[12px] h-[40px] px-5 font-semibold shadow-[0_4px_12px_rgba(97,73,246,0.35)] transition-all shrink-0"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          New Sub-folder
        </Button>
      </div>

      <div
        className="flex-1 overflow-y-auto px-6 pb-6"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#c4b5fd transparent' }}
      >
        {subFolders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full pt-10 pb-10">
            <div className="w-16 h-16 bg-[#F5F3FF] rounded-2xl flex items-center justify-center mb-4">
              <FolderOpen className="w-8 h-8 text-[#6149f6]" />
            </div>
            <h3 className="text-[16px] font-bold text-slate-900 mb-1">No sub-folders yet</h3>
            <p className="text-[13px] text-slate-500 text-center max-w-[220px] leading-relaxed">
              Create sub-folders to organise this case (e.g. IR, ICJS Dossier)
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {subFolders.map((sf) => (
              <SubFolderCard
                key={sf.id}
                notebook={sf}
                parentId={notebookId}
                onUnlink={(childId) => removeChild(childId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const ChatPanelWrapper = (
    <div className="h-full">
      <SuperChatColumn
        notebookId={notebookId}
        contextSelections={contextSelections}
        sources={sources}
        sourcesLoading={contextLoading}
        notes={notes}
        folderContexts={folderContexts}
        chatTitle={chatTitle}
        subtitleLine={`${folderContexts.length} ${folderContexts.length === 1 ? 'folder' : 'folders'}`}
        hideModelSelector
      />
    </div>
  )

  return (
    <AppShell>
      <div className="flex flex-col flex-1 min-h-0 relative overflow-hidden" style={{ background: '#ECEDF8' }}>
        <div
          className="absolute top-[-10%] right-[-5%] w-[55%] h-[70%] rounded-full pointer-events-none z-0"
          style={{
            background:
              'radial-gradient(ellipse at 70% 30%, rgba(180,160,255,0.60) 0%, rgba(200,185,255,0.35) 30%, rgba(220,210,255,0.15) 55%, transparent 75%)',
            filter: 'blur(60px)',
          }}
        />

        <div className="relative z-10 flex flex-col flex-1 min-h-0">
          <PageHeader
            searchValue={searchTerm}
            onSearchChange={setSearchTerm}
            searchPlaceholder="Search case…"
            newLabel="NOTEBOOK"
          />

          <div className="flex-shrink-0 px-3 sm:px-4 pt-3 pb-0">
            <div className="pb-4 sm:pb-5">
              <Link
                href="/notebooks"
                className="text-[13px] font-medium text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-4 transition-colors w-fit"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Cases
              </Link>
              <h1 className="text-[26px] sm:text-[32px] font-extrabold text-slate-900 tracking-tight leading-tight">
                {notebook.name}
              </h1>
              {notebook.description && (
                <p className="text-[14px] text-slate-500 font-medium mt-1 leading-relaxed">
                  {notebook.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex-1 px-3 sm:px-4 pb-4 sm:pb-5 overflow-hidden flex flex-col min-h-0">
            {!isDesktop && (
              <>
                <div className="lg:hidden mb-4 flex-shrink-0">
                  <Tabs
                    value={mobileActiveTab}
                    onValueChange={(value) => setMobileActiveTab(value as 'folders' | 'chat')}
                  >
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="folders" className="gap-2">
                        <FolderOpen className="h-4 w-4" />
                        Sub-folders
                      </TabsTrigger>
                      <TabsTrigger value="chat" className="gap-2">
                        <MessageSquare className="h-4 w-4" />
                        {t.common.chat}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="flex-1 overflow-hidden lg:hidden">
                  {mobileActiveTab === 'folders' && SubFoldersPanel}
                  {mobileActiveTab === 'chat' && ChatPanelWrapper}
                </div>
              </>
            )}

            <div
              className={cn(
                'hidden lg:grid h-full min-h-0 gap-4',
                'grid-cols-[minmax(0,1.1fr)_minmax(380px,0.9fr)]',
              )}
            >
              <div className="h-full min-h-0 overflow-hidden">{SubFoldersPanel}</div>
              <div className="h-full min-h-0">{ChatPanelWrapper}</div>
            </div>
          </div>
        </div>
      </div>

      <CreateSubFolderDialog
        open={createSubFolderOpen}
        onOpenChange={setCreateSubFolderOpen}
        onCreated={handleSubFolderCreated}
      />
    </AppShell>
  )
}
