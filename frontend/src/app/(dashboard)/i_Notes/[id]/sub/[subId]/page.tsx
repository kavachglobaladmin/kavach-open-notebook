'use client'

/**
 * Sub-folder i_Notes page — /i_Notes/[id]/sub/[subId]
 *
 * Renders the full original i_Notes view (Sources | Notes | Chat) for a
 * sub-folder i_Notes, identical to what the top-level i_Notes page used to
 * show before the folder hierarchy was introduced.
 *
 * The only difference from the original is the back-navigation link, which
 * goes to the parent folder (/i_Notes/[id]) instead of /i_Notes.
 */

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { I_NotesHeader } from '../../../components/i_NotesHeader'
import { SourcesColumn } from '../../../components/SourcesColumn'
import { NotesColumn } from '../../../components/i_NotesColumn'
import { ChatColumn } from '../../../components/ChatColumn'
import { usei_Notes } from '@/lib/hooks/use-i_Notes'
import { usei_Notesources } from '@/lib/hooks/use-sources'
import { useNotes } from '@/lib/hooks/use-notes'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { usei_NotesColumnsStore } from '@/lib/stores/i_Notes-columns-store'
import { useIsDesktop } from '@/lib/hooks/use-media-query'
import { useTranslation } from '@/lib/hooks/use-translation'
import { cn } from '@/lib/utils'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileText, StickyNote, MessageSquare } from 'lucide-react'
import { StudioActionsCard } from '@/components/source/StudioSection'
import type { ContextMode, ContextSelections } from '../../page'

export default function SubFolderi_NotesPage() {
  const { t } = useTranslation()
  const params = useParams()
  const searchParams = useSearchParams()

  // Parent i_Notes short ID (used for back navigation)
  const rawParentParam = params?.id ? decodeURIComponent(params.id as string) : ''
  const parentShortId = rawParentParam.includes(':')
    ? rawParentParam.split(':')[1]
    : rawParentParam

  // Sub-folder (child) i_Notes full SurrealDB ID
  const rawSubParam = params?.subId ? decodeURIComponent(params.subId as string) : ''
  const i_NotesId = rawSubParam.includes(':')
    ? rawSubParam
    : rawSubParam
    ? `i_Notes:${rawSubParam}`
    : ''

  const queryFromUrl = searchParams?.get('q')?.trim() || ''

  const { data: i_Notes, isLoading: i_NotesLoading } = usei_Notes(i_NotesId)
  const {
    sources,
    isLoading: sourcesLoading,
    refetch: refetchSources,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = usei_Notesources(i_NotesId)
  const { data: notes, isLoading: notesLoading } = useNotes(i_NotesId)

  // Get collapse states for dynamic layout
  const { sourcesCollapsed, notesCollapsed } = usei_NotesColumnsStore()

  // Detect desktop to avoid double-mounting ChatColumn
  const isDesktop = useIsDesktop()

  // Mobile tab state (Sources, Notes, or Chat)
  const [mobileActiveTab, setMobileActiveTab] = useState<'sources' | 'notes' | 'chat'>('chat')

  // Search term for PageHeader
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (queryFromUrl) {
      setSearchTerm(queryFromUrl)
    }
  }, [queryFromUrl])

  // Context selection state
  const [contextSelections, setContextSelections] = useState<ContextSelections>({
    sources: {},
    notes: {},
  })

  // Initialize and update selections when sources load or change
  useEffect(() => {
    if (sources && sources.length > 0) {
      setContextSelections((prev) => {
        const newSourceSelections = { ...prev.sources }
        sources.forEach((source) => {
          const currentMode = newSourceSelections[source.id]
          const hasInsights = source.insights_count > 0

          if (currentMode === undefined) {
            // Initial setup - default based on insights availability
            newSourceSelections[source.id] = hasInsights ? 'insights' : 'full'
          } else if (currentMode === 'full' && hasInsights) {
            // Source gained insights while in 'full' mode - auto-switch to 'insights'
            newSourceSelections[source.id] = 'insights'
          }
        })
        return { ...prev, sources: newSourceSelections }
      })
    }
  }, [sources])

  useEffect(() => {
    if (notes && notes.length > 0) {
      setContextSelections((prev) => {
        const newNoteSelections = { ...prev.notes }
        notes.forEach((note) => {
          // Only set default if not already set
          if (!(note.id in newNoteSelections)) {
            // Notes default to 'full'
            newNoteSelections[note.id] = 'full'
          }
        })
        return { ...prev, notes: newNoteSelections }
      })
    }
  }, [notes])

  // Handler to update context selection
  const handleContextModeChange = (
    itemId: string,
    mode: ContextMode,
    type: 'source' | 'note',
  ) => {
    setContextSelections((prev) => ({
      ...prev,
      [type === 'source' ? 'sources' : 'notes']: {
        ...(type === 'source' ? prev.sources : prev.notes),
        [itemId]: mode,
      },
    }))
  }

  if (i_NotesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!i_Notes) {
    return (
      <AppShell>
        <div className="p-4 sm:p-6">
          <h1 className="text-2xl font-bold mb-4">{t.i_Notes.notFound}</h1>
          <p className="text-muted-foreground">{t.i_Notes.notFoundDesc}</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div
        className="flex flex-col flex-1 min-h-0 relative overflow-hidden"
        style={{ background: '#ECEDF8' }}
      >
        {/* Top-right purple glow — exact match to Cases page */}
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
            searchPlaceholder="Search i_Notes..."
            newLabel="i_Notes"
          />

          {/* i_NotesHeader — identical to original, back link goes to parent folder */}
          <div className="flex-shrink-0 px-3 sm:px-4 pt-3 pb-0">
            <I_NotesHeader
              i_Notes={i_Notes}
              backHref={`/i_Notes/${parentShortId}`}
              backLabel="Back to case"
            />
          </div>

          <div className="flex-1 p-3 sm:p-4 pt-3 sm:pt-4 overflow-x-hidden lg:overflow-x-auto flex flex-col min-h-0">
            {/* Mobile: Tabbed interface - only render on mobile to avoid double-mounting */}
            {!isDesktop && (
              <>
                <div className="lg:hidden mb-4">
                  <Tabs
                    value={mobileActiveTab}
                    onValueChange={(value) =>
                      setMobileActiveTab(value as 'sources' | 'notes' | 'chat')
                    }
                  >
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="sources" className="gap-2">
                        <FileText className="h-4 w-4" />
                        {t.navigation.sources}
                      </TabsTrigger>
                      <TabsTrigger value="notes" className="gap-2">
                        <StickyNote className="h-4 w-4" />
                        {t.common.notes}
                      </TabsTrigger>
                      <TabsTrigger value="chat" className="gap-2">
                        <MessageSquare className="h-4 w-4" />
                        {t.common.chat}
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* Mobile: Show only active tab */}
                <div className="flex-1 overflow-hidden lg:hidden">
                  {mobileActiveTab === 'sources' && (
                    <SourcesColumn
                      sources={sources}
                      isLoading={sourcesLoading}
                      i_NotesId={i_NotesId}
                      i_NotesName={i_Notes?.name}
                      searchTerm={searchTerm}
                      onRefresh={refetchSources}
                      contextSelections={contextSelections.sources}
                      onContextModeChange={(sourceId, mode) =>
                        handleContextModeChange(sourceId, mode, 'source')
                      }
                      hasNextPage={hasNextPage}
                      isFetchingNextPage={isFetchingNextPage}
                      fetchNextPage={fetchNextPage}
                    />
                  )}
                  {mobileActiveTab === 'notes' && (
                    <NotesColumn
                      notes={notes}
                      isLoading={notesLoading}
                      i_NotesId={i_NotesId}
                      searchTerm={searchTerm}
                      contextSelections={contextSelections.notes}
                      onContextModeChange={(noteId, mode) =>
                        handleContextModeChange(noteId, mode, 'note')
                      }
                    />
                  )}
                  {mobileActiveTab === 'chat' && (
                    <ChatColumn
                      i_NotesId={i_NotesId}
                      contextSelections={contextSelections}
                      sources={sources ?? []}
                      sourcesLoading={sourcesLoading}
                      notes={notes ?? []}
                    />
                  )}
                </div>
              </>
            )}

            {/* Desktop: Collapsible columns layout — identical to original i_Notes page */}
            <div
              className={cn(
                'hidden lg:flex h-full min-h-0 gap-4 transition-all duration-150',
                'flex-row',
              )}
            >
              {/* Sources Column — equal 1/3 */}
              <div
                className={cn(
                  'transition-all duration-150 flex-shrink-0',
                  sourcesCollapsed ? 'w-12' : 'flex-1 min-w-0',
                )}
              >
                <SourcesColumn
                  sources={sources}
                  isLoading={sourcesLoading}
                  i_NotesId={i_NotesId}
                  i_NotesName={i_Notes?.name}
                  searchTerm={searchTerm}
                  onRefresh={refetchSources}
                  contextSelections={contextSelections.sources}
                  onContextModeChange={(sourceId, mode) =>
                    handleContextModeChange(sourceId, mode, 'source')
                  }
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  fetchNextPage={fetchNextPage}
                />
              </div>

              {/* Notes Column — equal 1/3 */}
              <div
                className={cn(
                  'transition-all duration-150 flex flex-col h-full flex-shrink-0',
                  notesCollapsed ? 'w-12' : 'flex-1 min-w-0',
                )}
              >
                <NotesColumn
                  notes={notes}
                  isLoading={notesLoading}
                  i_NotesId={i_NotesId}
                  searchTerm={searchTerm}
                  contextSelections={contextSelections.notes}
                  onContextModeChange={(noteId, mode) =>
                    handleContextModeChange(noteId, mode, 'note')
                  }
                />
              </div>

              {/* Chat Column — equal 1/3 */}
              <div className="flex-1 min-w-0 h-full">
                <ChatColumn
                  i_NotesId={i_NotesId}
                  contextSelections={contextSelections}
                  sources={sources ?? []}
                  sourcesLoading={sourcesLoading}
                  notes={notes ?? []}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
