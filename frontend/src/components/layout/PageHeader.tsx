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
  let lastError: any = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await apiClient.get<{ email: string; name: string }>('/users/profile')
      return res.data?.name?.trim() || null
    } catch (error: any) {
      lastError = error
      if (error?.response?.status === 404 || error?.response?.status === 401) {
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
  return compact.length > 120 ? `${compact.slice(0, 117)}...` : compact
}

function extractFileName(path?: string): string {
  if (!path) return ''
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/')
  return parts[parts.length - 1] || path
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

  // User Profile State
  const [displayName, setDisplayName] = useState('')
  const [initials, setInitials] = useState('')

  // Global Search State
  const [globalResults, setGlobalResults] = useState<GlobalSearchResult[]>([])
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false)
  const [showGlobalResults, setShowGlobalResults] = useState(false)

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
    if (!normalizedSearch || hideSearch) {
      searchRequestIdRef.current += 1
      setGlobalResults([])
      setIsSearchingGlobal(false)
      return
    }

    searchRequestIdRef.current += 1
    const requestId = searchRequestIdRef.current
    setIsSearchingGlobal(true)

    const timeout = setTimeout(async () => {
      try {
        const [notebooksRes, sourcesRes, semanticTextRes, semanticVectorRes] = await Promise.allSettled([
          notebooksApi.list({ archived: false, order_by: 'updated' }),
          sourcesApi.list({ limit: 200, sort_by: 'updated', sort_order: 'desc' }),
          searchApi.search({
            query: normalizedSearch,
            type: 'text',
            limit: 12,
            search_sources: true,
            search_notes: true,
            minimum_score: 0.0,
          }),
          searchApi.search({
            query: normalizedSearch,
            type: 'vector',
            limit: 12,
            search_sources: true,
            search_notes: true,
            minimum_score: 0.0,
          }),
        ])

        const notebooks = notebooksRes.status === 'fulfilled' ? (notebooksRes.value as NotebookResponse[]) : []
        const sources = sourcesRes.status === 'fulfilled' ? (sourcesRes.value as SourceListResponse[]) : []
        const semanticText = semanticTextRes.status === 'fulfilled' ? semanticTextRes.value.results : []
        const semanticVector = semanticVectorRes.status === 'fulfilled' ? semanticVectorRes.value.results : []
        const semanticResults = [...semanticText, ...semanticVector]

        const notebookMatches: Array<GlobalSearchResult & { rank: number }> = notebooks
          .map(notebook => ({
            notebook,
            rank: scoreMatch(normalizedSearch, notebook.name),
          }))
          .filter(item => item.rank > 0)
          .sort((a, b) => b.rank - a.rank)
          .slice(0, 6)
          .map(notebook => ({
            id: notebook.notebook.id,
            title: notebook.notebook.name,
            subtitle: 'Case',
            type: 'notebook',
            href: `/notebooks/${notebook.notebook.id.includes(':') ? notebook.notebook.id.split(':')[1] : notebook.notebook.id}`,
            rank: notebook.rank,
          }))

        const sourceMatches: Array<GlobalSearchResult & { rank: number }> = sources
          .map(source => ({
            source,
            rank: Math.max(
              scoreMatch(normalizedSearch, source.title || ''),
              scoreMatch(normalizedSearch, extractFileName(source.asset?.file_path)),
              scoreMatch(normalizedSearch, source.asset?.file_path || '')
            ),
          }))
          .filter(item => item.rank > 0)
          .sort((a, b) => b.rank - a.rank)
          .slice(0, 6)
          .map(source => ({
            id: source.source.id,
            title: source.source.title || extractFileName(source.source.asset?.file_path) || 'Untitled file',
            subtitle: extractFileName(source.source.asset?.file_path)
              ? `File: ${extractFileName(source.source.asset?.file_path)}`
              : 'File',
            type: 'source',
            href: `/sources/${source.source.id.includes(':') ? source.source.id.split(':')[1] : source.source.id}`,
            rank: source.rank,
          }))

        const semanticMatches: Array<GlobalSearchResult & { rank: number }> = semanticResults
          .slice(0, 14)
          .map(result => {
            const rawId = result.parent_id || result.id
            const shortId = rawId.includes(':') ? rawId.split(':')[1] : rawId
            const isSource = (result.type || result.source_type || '').toLowerCase().includes('source')
            const titleScore = scoreMatch(normalizedSearch, result.title || '')
            const snippetScore = Array.isArray(result.matches)
              ? Math.max(...result.matches.map((match: string) => scoreMatch(normalizedSearch, match)), 0)
              : 0
            const relevanceScore = Math.round((result.final_score || result.relevance || result.similarity || result.score || 0) * 10)
            const snippet = Array.isArray(result.matches) && result.matches.length > 0
              ? cleanResultTitle(result.matches[0], '')
              : ''
            const displayTitle = cleanResultTitle(
              result.title || '',
              isSource ? `File match: ${normalizedSearch}` : `Content match: ${normalizedSearch}`
            )
            return {
              id: result.id,
              title: displayTitle,
              subtitle: snippet || (isSource ? 'Content match in file' : 'Content match in knowledge base'),
              type: 'content',
              href: isSource ? `/sources/${shortId}` : '/search',
              rank: Math.max(40, titleScore, snippetScore, relevanceScore),
            }
          })

        const deduped = new Map<string, GlobalSearchResult & { rank: number }>()
        ;[...notebookMatches, ...sourceMatches, ...semanticMatches].forEach(item => {
          const key = `${item.type}:${item.href}:${item.title}`
          if (!deduped.has(key)) deduped.set(key, item)
        })

        const sorted = Array.from(deduped.values())
          .sort((a, b) => b.rank - a.rank)
          .slice(0, 12)
          .map(({ rank, ...result }) => result)

        if (sorted.length === 0 && normalizedSearch.length >= 2 && sources.length > 0) {
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
            return
          }
        }

        if (requestId !== searchRequestIdRef.current) return
        setGlobalResults(sorted)
      } catch {
        if (requestId !== searchRequestIdRef.current) return
        setGlobalResults([])
      } finally {
        if (requestId !== searchRequestIdRef.current) return
        setIsSearchingGlobal(false)
      }
    }, 300)

    return () => clearTimeout(timeout)
  }, [normalizedSearch, hideSearch])

  const handleGlobalResultClick = (result: GlobalSearchResult) => {
    setShowGlobalResults(false)
    if (result.href === '/search') {
      router.push(`/search?q=${encodeURIComponent(normalizedSearch)}&mode=search`)
      return
    }
    router.push(result.href)
  }

  const handleCreateNew = () => {
    if (onNew) {
      // Delegate to the parent page's handler
      onNew()
      return
    }
    // Internal modal fallback (used when no onNew prop is provided)
    console.log("Creating:", { notebookName, notebookDesc, storageLimit })
    setIsModalOpen(false)
    setNotebookName('')
    setNotebookDesc('')
    setStorageLimit(5)
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
          <div ref={searchWrapperRef} className="relative w-full max-w-[480px] hidden sm:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
            <Input
              value={searchValue}
              onChange={e => {
                onSearchChange(e.target.value)
                setShowGlobalResults(true)
              }}
              onFocus={() => {
                if (normalizedSearch) setShowGlobalResults(true)
              }}
              placeholder={searchPlaceholder}
              autoComplete="off"
              className="pl-12 h-[46px] bg-[#F8FAFC] border-[#E2E8F0] rounded-[13px] text-[15px] placeholder:text-slate-400 text-slate-700 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-0 focus-visible:border-[#8B5CF6] transition-all hover:border-slate-300"
            />

            {showGlobalResults && normalizedSearch && (
              <div className="absolute left-0 right-0 top-[52px] rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden">
                {isSearchingGlobal ? (
                  <div className="px-4 py-3 text-sm text-slate-500">Searching across cases, files, and content...</div>
                ) : globalResults.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500">No results found</div>
                ) : (
                  <div className="max-h-[360px] overflow-y-auto">
                    {globalResults.map(result => (
                      <button
                        key={`${result.type}-${result.id}-${result.href}`}
                        onClick={() => handleGlobalResultClick(result)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors"
                      >
                        <div className="text-sm font-semibold text-slate-800 truncate">{result.title}</div>
                        <div className="text-xs text-slate-500">{result.subtitle}</div>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 transition-all">
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