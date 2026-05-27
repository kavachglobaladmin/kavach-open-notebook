'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, Sparkles, Menu, HardDrive, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useSidebarStore } from '@/lib/stores/sidebar-store'
import apiClient from '@/lib/api/client'
import { notebooksApi } from '@/lib/api/notebooks'
import { sourcesApi } from '@/lib/api/sources'
import { searchApi } from '@/lib/api/search'
import type { NotebookResponse, SourceListResponse, SourceDetailResponse } from '@/lib/types/api'
import { NotificationCenter } from './NotificationCenter'
import { cn } from '@/lib/utils'

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function resolveFromLocalStorage(email: string): string {
  try {
    const users: { email: string; name: string }[] = JSON.parse(
      localStorage.getItem('kavach_users') ?? '[]'
    )
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase())
    if (user?.name?.trim()) return user.name.trim()
  } catch { /* ignore */ }
  return email.includes('@') ? email.split('@')[0] : email
}

async function fetchProfileName(): Promise<string | null> {
  const maxRetries = 3
  let lastError: unknown = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await apiClient.get<{ email: string; name: string }>('/users/profile')
      return res.data?.name?.trim() || null
    } catch (error: unknown) {
      lastError = error
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 404 || status === 401) {
        return null
      }
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)))
      }
    }
  }
  return null
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  newLabel?: string
  onNew?: () => void
  hideNew?: boolean
  hideSearch?: boolean
}

type GlobalSearchResult = {
  id: string
  title: string
  subtitle?: string
  type: 'notebook' | 'source' | 'content'
  href: string
}

type RankedGlobalSearchResult = GlobalSearchResult & { rank: number }

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderHighlighted(text: string, query: string) {
  const q = query.trim()
  if (!q) return text

  const parts = q.split(/\s+/).filter(Boolean).slice(0, 6)
  const needles = parts
    .map(p => p.trim())
    .filter(p => p.length >= 2)
    .map(escapeRegExp)

  if (needles.length === 0) return text

  const splitRe = new RegExp(`(${needles.join('|')})`, 'ig')
  const testRe = new RegExp(`^(${needles.join('|')})$`, 'i')
  const chunks = text.split(splitRe)
  return chunks.map((chunk, idx) => {
    if (testRe.test(chunk)) {
      return (
        <mark
          key={idx}
          className="bg-violet-100 text-violet-900 rounded px-1 py-0.5"
        >
          {chunk}
        </mark>
      )
    }
    return <span key={idx}>{chunk}</span>
  })
}

function normalizeText(value: string): string {
  return value.toLowerCase().trim()
}

function scoreMatch(query: string, target: string): number {
  const q = normalizeText(query)
  const t = normalizeText(target)
  if (!q || !t) return 0
  if (t === q) return 100
  if (t.startsWith(q)) return 80
  if (t.includes(q)) return 60

  const queryParts = q.split(/\s+/).filter(Boolean)
  const matchedParts = queryParts.filter(part => t.includes(part)).length
  if (matchedParts > 0) {
    return 30 + Math.round((matchedParts / queryParts.length) * 20)
  }
  return 0
}

function cleanResultTitle(rawTitle: string, fallback: string): string {
  const normalized = (rawTitle || '').replace(/\s+/g, ' ').trim()
  if (!normalized) return fallback

  // Remove repeated filename-like fragments coming from some content matches
  const compact = normalized
    .replace(/(.{4,}?\.(?:pdf|docx|doc|txt|xlsx|pptx))(?:\1)+/gi, '$1')
    .replace(/(.{8,}?)(?:\1){2,}/g, '$1')
    .trim()

  if (!compact) return fallback
  // Remove repeated comma-separated chunks: "A.pdf, A.pdf" -> "A.pdf"
  const dedupedParts: string[] = []
  for (const part of compact.split(',').map(p => p.trim()).filter(Boolean)) {
    if (!dedupedParts.some(existing => existing.toLowerCase() === part.toLowerCase())) {
      dedupedParts.push(part)
    }
  }
  const merged = dedupedParts.join(', ')
  return merged.length > 120 ? `${merged.slice(0, 117)}...` : merged
}

function extractFileName(path?: string): string {
  if (!path) return ''
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/')
  return parts[parts.length - 1] || path
}

function toShortId(rawId?: string): string {
  if (!rawId) return ''
  return rawId.includes(':') ? rawId.split(':').slice(1).join(':') : rawId
}

function inferSemanticHref(
  result: Record<string, unknown>,
  normalizedSearch: string
): string {
  const type = String(result.type ?? result.source_type ?? '').toLowerCase()
  const idCandidates = [
    String(result.parent_id ?? ''),
    String(result.id ?? ''),
    String(result.source_id ?? ''),
    String(result.notebook_id ?? ''),
  ].filter(Boolean)

  const sourceCandidate = idCandidates.find(id => id.toLowerCase().startsWith('source:'))
  if (sourceCandidate) return `/sources/${toShortId(sourceCandidate)}`

  const notebookCandidate = idCandidates.find(id => id.toLowerCase().startsWith('notebook:'))
  if (notebookCandidate) return `/notebooks/${toShortId(notebookCandidate)}`

  if (type.includes('source') || type.includes('document') || type.includes('file')) {
    const fallback = idCandidates[0]
    if (fallback) return `/sources/${toShortId(fallback)}`
  }

  if (type.includes('notebook') || type.includes('case')) {
    const fallback = idCandidates[0]
    if (fallback) return `/notebooks/${toShortId(fallback)}`
  }

  return `/search?q=${encodeURIComponent(normalizedSearch)}&mode=search`
}

function buildNotebookMatches(
  notebooks: NotebookResponse[],
  query: string
): RankedGlobalSearchResult[] {
  return notebooks
    .map(notebook => ({
      notebook,
      rank: scoreMatch(query, notebook.name),
    }))
    .filter(item => item.rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 6)
    .map(item => ({
      id: item.notebook.id,
      title: item.notebook.name,
      subtitle: 'Case',
      type: 'notebook' as const,
      href: `/notebooks/${toShortId(item.notebook.id)}`,
      rank: item.rank,
    }))
}

function buildSourceMatches(
  sources: SourceListResponse[],
  query: string
): RankedGlobalSearchResult[] {
  return sources
    .map(source => ({
      source,
      rank: Math.max(
        scoreMatch(query, source.title || ''),
        scoreMatch(query, extractFileName(source.asset?.file_path)),
        scoreMatch(query, source.asset?.file_path || '')
      ),
    }))
    .filter(item => item.rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 6)
    .map(item => ({
      id: item.source.id,
      title: item.source.title || extractFileName(item.source.asset?.file_path) || 'Untitled file',
      subtitle: extractFileName(item.source.asset?.file_path)
        ? `File: ${extractFileName(item.source.asset?.file_path)}`
        : 'File',
      type: 'source' as const,
      href: `/sources/${toShortId(item.source.id)}`,
      rank: item.rank,
    }))
}

function buildSemanticMatches(
  semanticResults: unknown[],
  query: string
): RankedGlobalSearchResult[] {
  return semanticResults
    .slice(0, 14)
    .map(rawResult => {
      const result = (rawResult && typeof rawResult === 'object'
        ? rawResult
        : {}) as Record<string, unknown>

      const rawType = String(result.type ?? result.source_type ?? '')
      const isSource = rawType.toLowerCase().includes('source')
      const rawTitle = String(result.title ?? '')
      const titleScore = scoreMatch(query, rawTitle)
      const matchesArray = Array.isArray(result.matches)
        ? result.matches.map(match => String(match ?? '')).filter(Boolean)
        : []
      const snippetScore = matchesArray.length > 0
        ? Math.max(...matchesArray.map(match => scoreMatch(query, match)), 0)
        : 0
      const relevanceScore = Math.round(
        Number(result.final_score ?? result.relevance ?? result.similarity ?? result.score ?? 0) * 10
      )
      const snippet = matchesArray.length > 0
        ? cleanResultTitle(matchesArray[0], '')
        : ''
      const displayTitle = cleanResultTitle(
        rawTitle,
        isSource ? `File match: ${query}` : `Content match: ${query}`
      )
      return {
        id: String(result.id ?? `${displayTitle}-${snippet}`),
        title: displayTitle,
        subtitle: snippet || (isSource ? 'Content match in file' : 'Content match in knowledge base'),
        type: 'content' as const,
        href: inferSemanticHref(result, query),
        rank: Math.max(40, titleScore, snippetScore, relevanceScore),
      }
    })
}

function mergeRankedResults(
  all: RankedGlobalSearchResult[],
  limit = 12
): GlobalSearchResult[] {
  const deduped = new Map<string, RankedGlobalSearchResult>()
  all.forEach(item => {
    const key = `${item.type}:${item.href}`.toLowerCase()
    const existing = deduped.get(key)
    if (!existing || item.rank > existing.rank) {
      deduped.set(key, item)
    }
  })

  return Array.from(deduped.values())
    .sort((a, b) => b.rank - a.rank)
    .slice(0, limit)
    .map(({ rank, ...result }) => result)
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PageHeader({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search notebooks, cases, or documents...',
  newLabel = 'NOTEBOOK',
  onNew,
  hideNew = false,
  hideSearch = false,
}: PageHeaderProps) {
  const router = useRouter()
  const currentUserEmail = useAuthStore(s => s.currentUserEmail)
  const { toggleCollapse, isCollapsed } = useSidebarStore()
  const searchWrapperRef = useRef<HTMLDivElement | null>(null)
  const searchRequestIdRef = useRef(0)
  const notebooksCacheRef = useRef<NotebookResponse[]>([])
  const sourcesCacheRef = useRef<SourceListResponse[]>([])

  // User Profile State
  const [displayName, setDisplayName] = useState('')
  const [initials, setInitials] = useState('')

  // Global Search State
  const [globalResults, setGlobalResults] = useState<GlobalSearchResult[]>([])
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false)
  const [showGlobalResults, setShowGlobalResults] = useState(false)
  const [activeGlobalIndex, setActiveGlobalIndex] = useState(-1)

  // New Notebook Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [notebookName, setNotebookName] = useState('')
  const [notebookDesc, setNotebookDesc] = useState('')
  const [storageLimit, setStorageLimit] = useState<number>(5)

  useEffect(() => {
    if (!currentUserEmail || !currentUserEmail.includes('@')) {
      setDisplayName('')
      setInitials('')
      return
    }

    const localName = resolveFromLocalStorage(currentUserEmail)
    setDisplayName(localName)
    setInitials(buildInitials(localName))

    fetchProfileName().then(backendName => {
      if (backendName && backendName !== localName) {
        try {
          const users: { email: string; name: string; password?: string }[] = JSON.parse(
            localStorage.getItem('kavach_users') ?? '[]'
          )
          const idx = users.findIndex(u => u.email.toLowerCase() === currentUserEmail.toLowerCase())
          if (idx >= 0) users[idx].name = backendName
          else users.push({ email: currentUserEmail, name: backendName })
          localStorage.setItem('kavach_users', JSON.stringify(users))
        } catch { /* ignore */ }

        setDisplayName(backendName)
        setInitials(buildInitials(backendName))
      }
    })
  }, [currentUserEmail])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!searchWrapperRef.current) return
      if (!searchWrapperRef.current.contains(event.target as Node)) {
        setShowGlobalResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const normalizedSearch = useMemo(() => searchValue.trim(), [searchValue])

  useEffect(() => {
    // Warm caches once so first keystroke can show fast local matches.
    void Promise.allSettled([
      notebooksApi.list({ archived: false, order_by: 'updated' }),
      sourcesApi.list({ limit: 200, sort_by: 'updated', sort_order: 'desc' }),
    ]).then(([notebooksRes, sourcesRes]) => {
      if (notebooksRes.status === 'fulfilled') {
        notebooksCacheRef.current = notebooksRes.value
      }
      if (sourcesRes.status === 'fulfilled') {
        sourcesCacheRef.current = sourcesRes.value
      }
    })
  }, [])

  useEffect(() => {
    if (!normalizedSearch || hideSearch) {
      searchRequestIdRef.current += 1
      setGlobalResults([])
      setIsSearchingGlobal(false)
      setActiveGlobalIndex(-1)
      return
    }

    searchRequestIdRef.current += 1
    const requestId = searchRequestIdRef.current
    setIsSearchingGlobal(true)

    // Instant local/cached matches for responsive typing UX.
    const instantLocal = mergeRankedResults([
      ...buildNotebookMatches(notebooksCacheRef.current, normalizedSearch),
      ...buildSourceMatches(sourcesCacheRef.current, normalizedSearch),
    ])
    if (instantLocal.length > 0) {
      setGlobalResults(instantLocal)
      setActiveGlobalIndex(0)
    }

    const timeout = setTimeout(async () => {
      try {
        const notebooksPromise = notebooksApi.list({ archived: false, order_by: 'updated' })
        const sourcesPromise = sourcesApi.list({ limit: 200, sort_by: 'updated', sort_order: 'desc' })
        const textPromise = searchApi.search({
          query: normalizedSearch,
          type: 'text',
          limit: 12,
          search_sources: true,
          search_notes: true,
          minimum_score: 0.0,
        })
        const shouldRunVector = normalizedSearch.length >= 3
        const vectorPromise = shouldRunVector
          ? searchApi.search({
            query: normalizedSearch,
            type: 'vector',
            limit: 12,
            search_sources: true,
            search_notes: true,
            minimum_score: 0.0,
          })
          : Promise.resolve({ results: [] as unknown[] })

        const [notebooksRes, sourcesRes] = await Promise.allSettled([notebooksPromise, sourcesPromise])
        if (requestId !== searchRequestIdRef.current) return

        const notebooks = notebooksRes.status === 'fulfilled' ? notebooksRes.value : notebooksCacheRef.current
        const sources = sourcesRes.status === 'fulfilled' ? sourcesRes.value : sourcesCacheRef.current
        if (notebooksRes.status === 'fulfilled') {
          notebooksCacheRef.current = notebooksRes.value
        }
        if (sourcesRes.status === 'fulfilled') {
          sourcesCacheRef.current = sourcesRes.value
        }

        const localMerged = mergeRankedResults([
          ...buildNotebookMatches(notebooks, normalizedSearch),
          ...buildSourceMatches(sources, normalizedSearch),
        ])
        if (requestId !== searchRequestIdRef.current) return
        if (localMerged.length > 0) {
          setGlobalResults(localMerged)
          setActiveGlobalIndex(0)
        }

        const [textRes, vectorRes] = await Promise.allSettled([textPromise, vectorPromise])
        if (requestId !== searchRequestIdRef.current) return

        const semanticText = textRes.status === 'fulfilled' ? textRes.value.results : []
        const semanticVector = vectorRes.status === 'fulfilled' ? vectorRes.value.results : []
        const semanticMerged = mergeRankedResults([
          ...buildNotebookMatches(notebooks, normalizedSearch),
          ...buildSourceMatches(sources, normalizedSearch),
          ...buildSemanticMatches([...semanticText, ...semanticVector], normalizedSearch),
        ])

        if (semanticMerged.length === 0 && normalizedSearch.length >= 3 && sources.length > 0) {
          const deepCandidates = sources.slice(0, 30)
          const deepResultsRaw = await Promise.allSettled(
            deepCandidates.map(source => sourcesApi.get(source.id))
          )

          const deepMatches: GlobalSearchResult[] = deepResultsRaw
            .filter((entry): entry is PromiseFulfilledResult<SourceDetailResponse> => entry.status === 'fulfilled')
            .map(entry => entry.value)
            .filter(sourceDetail => scoreMatch(normalizedSearch, sourceDetail.full_text || '') > 0)
            .slice(0, 8)
            .map(sourceDetail => {
              const sourceId = sourceDetail.id.includes(':') ? sourceDetail.id.split(':')[1] : sourceDetail.id
              const snippetStart = (sourceDetail.full_text || '').toLowerCase().indexOf(normalizedSearch.toLowerCase())
              const snippet = snippetStart >= 0
                ? cleanResultTitle((sourceDetail.full_text || '').slice(Math.max(0, snippetStart - 30), snippetStart + 90), 'Person/content match')
                : 'Person/content match'

              return {
                id: `deep-${sourceDetail.id}`,
                title: sourceDetail.title || extractFileName(sourceDetail.asset?.file_path) || 'Matched file',
                subtitle: snippet,
                type: 'content',
                href: `/sources/${sourceId}`,
              }
            })

          if (deepMatches.length > 0) {
            if (requestId !== searchRequestIdRef.current) return
            setGlobalResults(deepMatches)
            setActiveGlobalIndex(0)
            return
          }
        }

        if (requestId !== searchRequestIdRef.current) return
        setGlobalResults(semanticMerged)
        setActiveGlobalIndex(semanticMerged.length > 0 ? 0 : -1)
      } catch {
        if (requestId !== searchRequestIdRef.current) return
        setGlobalResults([])
        setActiveGlobalIndex(-1)
      } finally {
        if (requestId !== searchRequestIdRef.current) return
        setIsSearchingGlobal(false)
      }
    }, 120)

    return () => clearTimeout(timeout)
  }, [normalizedSearch, hideSearch])

  const handleGlobalResultClick = (result: GlobalSearchResult) => {
    setShowGlobalResults(false)
    setActiveGlobalIndex(-1)
    if (result.href === '/search') {
      router.push(`/search?q=${encodeURIComponent(normalizedSearch)}&mode=search`)
      return
    }
    router.push(result.href)
  }

  const handleCreateNew = async () => {
    if (onNew) {
      // Delegate to the parent page's handler
      onNew()
      return
    }
    // Internal modal: create notebook via API
    if (!notebookName.trim()) return
    try {
      const newNotebook = await notebooksApi.create({
        name: notebookName.trim(),
        description: notebookDesc.trim() || undefined,
      })
      setIsModalOpen(false)
      setNotebookName('')
      setNotebookDesc('')
      setStorageLimit(5)
      // Navigate to the new notebook
      const shortId = newNotebook.id.includes(':') ? newNotebook.id.split(':')[1] : newNotebook.id
      router.push(`/notebooks/${shortId}`)
    } catch (err) {
      console.error('Failed to create notebook:', err)
    }
  }

  return (
    <header className="h-[88px] flex items-center justify-between px-4 md:px-8 bg-[#FDFDFD] shrink-0 border-b border-[#E2E8F0] relative z-40">

      {/* ── Left: Toggle & Search ──────────────────────────────────────────── */}
      <div className="flex items-center gap-4 md:gap-6 flex-1">
        {/* Hamburger Menu Toggle */}
        {isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-xl transition-colors flex shrink-0"
          >
            <Menu className="h-6 w-6" strokeWidth={2} />
          </Button>
        )}

        {!hideSearch && (
          <div ref={searchWrapperRef} className="relative w-full max-w-[480px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
            <Input
              value={searchValue}
              onChange={e => {
                onSearchChange(e.target.value)
                setShowGlobalResults(true)
                setActiveGlobalIndex(0)
              }}
              onFocus={() => {
                if (normalizedSearch) setShowGlobalResults(true)
              }}
              onKeyDown={e => {
                if (!showGlobalResults || !normalizedSearch) return
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActiveGlobalIndex(prev => Math.min(prev + 1, globalResults.length - 1))
                  return
                }
                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActiveGlobalIndex(prev => Math.max(prev - 1, 0))
                  return
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setShowGlobalResults(false)
                  setActiveGlobalIndex(-1)
                  return
                }
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const selected = globalResults[activeGlobalIndex] ?? globalResults[0]
                  if (selected) {
                    handleGlobalResultClick(selected)
                  } else {
                    setShowGlobalResults(false)
                    router.push(`/search?q=${encodeURIComponent(normalizedSearch)}&mode=search`)
                  }
                }
              }}
              placeholder={searchPlaceholder}
              autoComplete="off"
              className="pl-12 h-[46px] bg-[#F8FAFC] border-[#E2E8F0] rounded-[13px] text-[15px] placeholder:text-slate-400 text-slate-700 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-0 focus-visible:border-[#8B5CF6] transition-all hover:border-slate-300"
            />

            {showGlobalResults && normalizedSearch && (
              <div className="absolute left-0 right-0 top-[52px] rounded-xl border border-slate-200 bg-white shadow-xl z-[200] overflow-hidden">
                {isSearchingGlobal ? (
                  <div className="px-4 py-3 text-sm text-slate-500">Searching across cases, files, and content...</div>
                ) : globalResults.length === 0 ? (
                  <div>
                    <div className="px-4 py-3 text-sm text-slate-500">No direct matches found</div>
                    <button
                      onClick={() => {
                        setShowGlobalResults(false)
                        router.push(`/search?q=${encodeURIComponent(normalizedSearch)}&mode=search`)
                      }}
                      className="w-full text-left px-4 py-3 text-sm font-semibold text-[#7C3AED] hover:bg-violet-50 border-t border-slate-100"
                    >
                      {`Search everywhere for "${normalizedSearch}"`}
                    </button>
                  </div>
                ) : (
                  <div className="max-h-[360px] overflow-y-auto">
                    {globalResults.map((result, idx) => (
                      <button
                        key={`${result.type}-${result.id}-${result.href}`}
                        onClick={() => handleGlobalResultClick(result)}
                        className={cn(
                          "w-full text-left px-4 py-3 border-b border-slate-100 last:border-b-0 transition-colors",
                          idx === activeGlobalIndex ? "bg-violet-50" : "hover:bg-slate-50"
                        )}
                      >
                        <div className="text-sm font-semibold text-slate-800 truncate">
                          {renderHighlighted(result.title, normalizedSearch)}
                        </div>
                        {result.subtitle && (
                          <div className="text-xs text-slate-500 line-clamp-2">
                            {renderHighlighted(result.subtitle, normalizedSearch)}
                          </div>
                        )}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setShowGlobalResults(false)
                        router.push(`/search?q=${encodeURIComponent(normalizedSearch)}&mode=search`)
                      }}
                      className="w-full text-left px-4 py-3 text-sm font-semibold text-[#7C3AED] hover:bg-violet-50 border-t border-slate-100"
                    >
                      View all results
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right: Bell + New ──────────────────────────────── */}
      <div className="flex items-center gap-3 md:gap-5 shrink-0 ml-4">

        {/* Original Notification Center Restored */}
        <NotificationCenter />

        {/* + NEW Button */}
        {!hideNew && (
          <Button
            onClick={() => onNew ? onNew() : setIsModalOpen(true)}
            className="bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#6D28D9] hover:to-[#7C3AED] text-white px-5 md:px-7 rounded-[14px] h-[46px] font-bold text-[14px] tracking-wide gap-2.5 shadow-[0_8px_20px_-6px_rgba(124,58,237,0.5)] transition-all"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
            <span className="hidden md:inline">{newLabel}</span>
            <Sparkles className="h-4 w-4 ml-0 md:ml-1 opacity-90" />
          </Button>
        )}
      </div>

      {/* ── Create New Notebook Modal Overlay ──────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 transition-all">
          <div className="bg-white w-full max-w-[480px] rounded-xl shadow-2xl relative p-6 md:p-7 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 hover:bg-slate-50 p-1.5 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-[20px] font-bold text-slate-900 mb-1.5">Create New Notebook</h2>
            <p className="text-[14px] text-slate-500 mb-6">Enter a name and optional description to get started.</p>

            <div className="space-y-5">
              {/* Name Field */}
              <div>
                <label className="block text-[14px] font-bold text-slate-900 mb-1.5">Name *</label>
                <Input
                  value={notebookName}
                  onChange={e => setNotebookName(e.target.value)}
                  placeholder="Notebook name"
                  className="h-[42px] text-[15px] border-slate-300 focus-visible:ring-[#82B4FF] focus-visible:border-[#82B4FF] placeholder:text-slate-400"
                  autoFocus
                />
              </div>

              {/* Description Field */}
              <div>
                <label className="block text-[14px] font-bold text-slate-900 mb-1.5">Description</label>
                <textarea
                  value={notebookDesc}
                  onChange={e => setNotebookDesc(e.target.value)}
                  placeholder="Add more info about this notebook here..."
                  className="w-full h-[100px] rounded-lg border border-slate-300 p-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#82B4FF] focus:border-[#82B4FF] resize-none placeholder:text-slate-400"
                />
              </div>

              {/* Storage Limit Selection */}
              <div>
                <label className="flex items-center gap-2 text-[14px] font-bold text-slate-900 mb-2">
                  <HardDrive className="h-[18px] w-[18px]" strokeWidth={2} /> Storage Limit *
                </label>
                <div className="grid grid-cols-3 gap-3 md:gap-4">
                  {[5, 10, 50].map(val => (
                    <button
                      key={val}
                      onClick={() => setStorageLimit(val)}
                      className={cn(
                        "flex flex-col items-center justify-center py-3.5 rounded-[10px] border transition-all duration-200",
                        storageLimit === val
                          ? "border-[#82B4FF] bg-blue-50/50 text-[#5B92FF] shadow-sm"
                          : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <span className={cn("text-[18px] font-bold leading-none mb-1", storageLimit === val ? "text-[#5B92FF]" : "text-slate-600")}>
                        {val}
                      </span>
                      <span className="text-[13px] font-semibold">MB</span>
                    </button>
                  ))}
                </div>
                <p className="text-[12px] text-slate-500 mt-2">Select a storage limit to create the notebook.</p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 mt-8">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="border-slate-200 text-slate-700 h-10 px-5 text-[14px] font-semibold hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateNew}
                className="bg-[#82B4FF] hover:bg-[#68A3FB] text-white h-10 px-5 text-[14px] font-semibold shadow-sm transition-colors"
                disabled={!notebookName.trim()}
              >
                Create New Notebook
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
