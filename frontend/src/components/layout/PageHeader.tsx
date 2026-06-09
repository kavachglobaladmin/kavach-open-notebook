'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Plus, Search, Sparkles, Menu, HardDrive, X, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useSidebarStore } from '@/lib/stores/sidebar-store'
import apiClient from '@/lib/api/client'
import { notebooksApi } from '@/lib/api/notebooks'
import { sourcesApi } from '@/lib/api/sources'
import { searchApi } from '@/lib/api/search'
import type { NotebookResponse, SourceListResponse } from '@/lib/types/api'
import { NotificationCenter } from './NotificationCenter'
import { cn } from '@/lib/utils'

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€ Props â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  type: 'page' | 'notebook' | 'source' | 'content'
  href: string
  matchKind?: string
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


function isMeaningfulId(value: string): boolean {
  const trimmed = value.trim()
  return Boolean(trimmed && trimmed !== 'undefined' && trimmed !== 'null' && trimmed !== '[object Object]')
}

function appendSearchParamsToHref(
  href: string,
  query: string,
  result?: GlobalSearchResult
): string {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) return href

  const [beforeHash, hash = ''] = href.split('#')
  const separator = beforeHash.includes('?') ? '&' : '?'
  const params = new URLSearchParams()
  params.set('q', trimmedQuery)
  params.set('highlight', trimmedQuery)
  params.set('from', 'global-search')
  if (result?.id) params.set('focus', result.id)
  if (result?.type) params.set('type', result.type)

  return `${beforeHash}${separator}${params.toString()}${hash ? `#${hash}` : ''}`
}

function saveGlobalSearchContext(result: GlobalSearchResult, query: string) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(
      'kavach_global_search_context',
      JSON.stringify({
        id: result.id,
        type: result.type,
        href: result.href,
        query,
        createdAt: Date.now(),
      })
    )
  } catch { /* ignore */ }
}

function normalizeListResponse<T>(value: unknown, keys: string[]): T[] {
  if (Array.isArray(value)) return value as T[]
  if (!value || typeof value !== 'object') return []

  const obj = value as Record<string, unknown>
  for (const key of keys) {
    const direct = obj[key]
    if (Array.isArray(direct)) return direct as T[]
    if (direct && typeof direct === 'object') {
      const nested = direct as Record<string, unknown>
      if (Array.isArray(nested.results)) return nested.results as T[]
      if (Array.isArray(nested.items)) return nested.items as T[]
      if (Array.isArray(nested.data)) return nested.data as T[]
    }
  }

  if (Array.isArray(obj.results)) return obj.results as T[]
  if (Array.isArray(obj.items)) return obj.items as T[]
  if (Array.isArray(obj.data)) return obj.data as T[]
  return []
}

function normalizeSearchResults(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (!value || typeof value !== 'object') return []

  const obj = value as Record<string, unknown>
  if (Array.isArray(obj.results)) return obj.results
  if (Array.isArray(obj.items)) return obj.items
  if (Array.isArray(obj.data)) return obj.data
  if (obj.data && typeof obj.data === 'object') {
    const nested = obj.data as Record<string, unknown>
    if (Array.isArray(nested.results)) return nested.results
    if (Array.isArray(nested.items)) return nested.items
  }
  return []
}

const GLOBAL_SEARCH_HIGHLIGHT_NAME = 'kavach-global-search'
const GLOBAL_SEARCH_FALLBACK_ATTR = 'data-kavach-global-search-highlight'
const GLOBAL_SEARCH_IGNORE_SELECTOR = [
  'header',
  'nav',
  'aside',
  'script',
  'style',
  'noscript',
  'textarea',
  'input',
  'select',
  'button',
  '[contenteditable="true"]',
  '[data-kavach-global-search-ignore="true"]',
  `[${GLOBAL_SEARCH_FALLBACK_ATTR}="true"]`,
].join(',')

type CurrentPageHighlightResult = {
  count: number
  firstElement: HTMLElement | null
}

function createSearchRegex(query: string): RegExp | null {
  const trimmed = query.trim()
  if (trimmed.length < 2) return null

  const parts = trimmed
    .split(/\s+/)
    .map(part => part.trim())
    .filter(part => part.length >= 2)
    .slice(0, 8)

  if (parts.length === 0) return null

  const source = parts
    .map(part => {
      const escaped = escapeRegExp(part)
      // Small keywords like "He" should match the word, not every "the/her/she".
      return part.length <= 3 ? `\\b${escaped}\\b` : escaped
    })
    .join('|')

  return new RegExp(source, 'gi')
}

function ensureSearchHighlightStyle() {
  if (typeof document === 'undefined') return
  if (document.getElementById('kavach-global-search-highlight-style')) return

  const style = document.createElement('style')
  style.id = 'kavach-global-search-highlight-style'
  style.textContent = `
    ::highlight(${GLOBAL_SEARCH_HIGHLIGHT_NAME}) {
      background-color: rgb(253 224 71);
      color: inherit;
    }
    mark[${GLOBAL_SEARCH_FALLBACK_ATTR}="true"] {
      background: rgb(253 224 71);
      color: inherit;
      border-radius: 4px;
      padding: 0 2px;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    }
  `
  document.head.appendChild(style)
}

function clearCurrentPageHighlights() {
  if (typeof document === 'undefined') return

  try {
    if (typeof CSS !== 'undefined') {
      const cssHighlights = (CSS as unknown as {
        highlights?: { delete?: (name: string) => void }
      }).highlights
      cssHighlights?.delete?.(GLOBAL_SEARCH_HIGHLIGHT_NAME)
    }
  } catch { /* ignore */ }

  document.querySelectorAll(`mark[${GLOBAL_SEARCH_FALLBACK_ATTR}="true"]`).forEach(mark => {
    const parent = mark.parentNode
    if (!parent) return
    parent.replaceChild(document.createTextNode(mark.textContent || ''), mark)
    parent.normalize()
  })
}

function getSearchRoot(): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return (
    document.querySelector('main') ||
    document.querySelector('[data-search-root="true"]') ||
    document.querySelector('#__next') ||
    document.body
  ) as HTMLElement
}

function canSearchTextNode(node: Node): boolean {
  const parent = node.parentElement
  if (!parent) return false
  if (!node.textContent?.trim()) return false
  return !parent.closest(GLOBAL_SEARCH_IGNORE_SELECTOR)
}

function collectCurrentPageRanges(query: string, limit = 350): { ranges: Range[]; firstElement: HTMLElement | null } {
  const regex = createSearchRegex(query)
  const root = getSearchRoot()
  if (!regex || !root || typeof document === 'undefined') return { ranges: [], firstElement: null }

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: node => canSearchTextNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    }
  )

  const ranges: Range[] = []
  let firstElement: HTMLElement | null = null
  let current: Node | null = walker.nextNode()

  while (current && ranges.length < limit) {
    const text = current.textContent || ''
    regex.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = regex.exec(text)) && ranges.length < limit) {
      const matchText = match[0]
      if (!matchText) break
      const range = document.createRange()
      range.setStart(current, match.index)
      range.setEnd(current, match.index + matchText.length)
      ranges.push(range)
      if (!firstElement) firstElement = current.parentElement
    }
    current = walker.nextNode()
  }

  return { ranges, firstElement }
}

function applyCssHighlights(query: string, shouldScroll = true): CurrentPageHighlightResult | null {
  if (typeof window === 'undefined' || typeof CSS === 'undefined') return null

  const cssHighlights = (CSS as unknown as {
    highlights?: { set?: (name: string, highlight: unknown) => void }
  }).highlights
  const HighlightConstructor = (window as unknown as { Highlight?: new (...ranges: Range[]) => unknown }).Highlight

  if (!cssHighlights?.set || !HighlightConstructor) return null

  const { ranges, firstElement } = collectCurrentPageRanges(query)
  if (ranges.length === 0) return { count: 0, firstElement: null }

  cssHighlights.set(GLOBAL_SEARCH_HIGHLIGHT_NAME, new HighlightConstructor(...ranges))
  if (shouldScroll) {
    firstElement?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }

  return { count: ranges.length, firstElement }
}

function applyFallbackHighlights(query: string, shouldScroll = true): CurrentPageHighlightResult {
  const regex = createSearchRegex(query)
  const root = getSearchRoot()
  if (!regex || !root || typeof document === 'undefined') return { count: 0, firstElement: null }

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: node => canSearchTextNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    }
  )

  const nodes: Text[] = []
  let current = walker.nextNode()
  while (current) {
    nodes.push(current as Text)
    current = walker.nextNode()
  }

  let count = 0
  let firstElement: HTMLElement | null = null

  for (const node of nodes) {
    if (count >= 350) break
    const text = node.nodeValue || ''
    regex.lastIndex = 0
    const matches = Array.from(text.matchAll(regex))
    if (matches.length === 0) continue

    const fragment = document.createDocumentFragment()
    let lastIndex = 0

    for (const match of matches) {
      if (count >= 350) break
      const matchText = match[0]
      const index = match.index ?? -1
      if (!matchText || index < 0) continue

      if (index > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, index)))
      }

      const mark = document.createElement('mark')
      mark.setAttribute(GLOBAL_SEARCH_FALLBACK_ATTR, 'true')
      mark.textContent = matchText
      fragment.appendChild(mark)
      if (!firstElement) firstElement = mark
      count += 1
      lastIndex = index + matchText.length
    }

    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)))
    }

    node.parentNode?.replaceChild(fragment, node)
  }

  if (shouldScroll) {
    firstElement?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
  }

  return { count, firstElement }
}

function highlightKeywordOnCurrentPage(query: string, shouldScroll = true): CurrentPageHighlightResult {
  clearCurrentPageHighlights()
  ensureSearchHighlightStyle()

  const trimmed = query.trim()
  if (trimmed.length < 2) return { count: 0, firstElement: null }

  const cssResult = applyCssHighlights(trimmed, shouldScroll)
  if (cssResult) return cssResult

  return applyFallbackHighlights(trimmed, shouldScroll)
}

function getResultLabel(type: GlobalSearchResult['type'], matchKind?: string): string {
  if (matchKind) return matchKind
  if (type === 'page') return 'Current page'
  if (type === 'notebook') return 'Notebook / Case'
  if (type === 'source') return 'File / Document'
  return 'Content match'
}

function inferSemanticHref(
  result: Record<string, unknown>,
  normalizedSearch: string
): string {
  const type = String(result.type ?? result.source_type ?? result.kind ?? '').toLowerCase()
  const idCandidates = [
    String(result.parent_id ?? ''),
    String(result.parentId ?? ''),
    String(result.source_id ?? ''),
    String(result.sourceId ?? ''),
    String(result.document_id ?? ''),
    String(result.documentId ?? ''),
    String(result.file_id ?? ''),
    String(result.fileId ?? ''),
    String(result.notebook_id ?? ''),
    String(result.notebookId ?? ''),
    String(result.case_id ?? ''),
    String(result.caseId ?? ''),
    String(result.id ?? ''),
  ].filter(isMeaningfulId)

  const explicitHref = String(result.href ?? result.url ?? result.path ?? '')
  if (explicitHref.startsWith('/sources/') || explicitHref.startsWith('/notebooks/')) {
    return explicitHref
  }

  const sourceCandidate = idCandidates.find(id => id.toLowerCase().startsWith('source:'))
  if (sourceCandidate) return `/sources/${toShortId(sourceCandidate)}`

  const notebookCandidate = idCandidates.find(id => id.toLowerCase().startsWith('notebook:'))
  if (notebookCandidate) return `/notebooks/${toShortId(notebookCandidate)}`

  if (type.includes('source') || type.includes('document') || type.includes('file')) {
    const fallback = idCandidates[0]
    if (fallback) return `/sources/${toShortId(fallback)}`
  }

  if (type.includes('notebook') || type.includes('case') || type.includes('note')) {
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
      rank: Math.max(
        scoreMatch(query, notebook.name),
        scoreMatch(query, notebook.description || '')
      ),
    }))
    .filter(item => item.rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 6)
    .map(item => ({
      id: item.notebook.id,
      title: item.notebook.name,
      subtitle: item.notebook.description || 'Notebook / Case',
      type: 'notebook' as const,
      matchKind: 'Notebook / Case',
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
        : 'File / Document',
      type: 'source' as const,
      matchKind: 'File / Document',
      href: `/sources/${toShortId(item.source.id)}`,
      rank: item.rank,
    }))
}

function buildSemanticMatches(
  semanticResults: unknown[],
  query: string
): RankedGlobalSearchResult[] {
  return semanticResults
    .slice(0, 24)
    .map(rawResult => {
      const result = (rawResult && typeof rawResult === 'object'
        ? rawResult
        : {}) as Record<string, unknown>

      const rawType = String(result.type ?? result.source_type ?? result.kind ?? '')
      const lowerType = rawType.toLowerCase()
      const isSource = lowerType.includes('source') || lowerType.includes('document') || lowerType.includes('file')
      const isNotebook = lowerType.includes('notebook') || lowerType.includes('case')
      const isNote = lowerType.includes('note')
      const rawTitle = String(
        result.title ??
        result.name ??
        result.source_title ??
        result.notebook_title ??
        result.filename ??
        ''
      )
      const titleScore = scoreMatch(query, rawTitle)
      const matchesArray = Array.isArray(result.matches)
        ? result.matches.map(match => String(match ?? '')).filter(Boolean)
        : []
      const extraSnippets = [
        String(result.snippet ?? ''),
        String(result.excerpt ?? ''),
        String(result.content ?? ''),
        String(result.text ?? ''),
        String(result.chunk ?? ''),
      ].filter(Boolean)
      const allSnippets = [...matchesArray, ...extraSnippets]
      const snippetScore = allSnippets.length > 0
        ? Math.max(...allSnippets.map(match => scoreMatch(query, match)), 0)
        : 0
      const relevanceScore = Math.round(
        Number(result.final_score ?? result.relevance ?? result.similarity ?? result.score ?? 0) * 100
      )
      const snippet = allSnippets.length > 0
        ? cleanResultTitle(allSnippets[0], '')
        : ''
      const displayTitle = cleanResultTitle(
        rawTitle,
        isSource
          ? `File match: ${query}`
          : isNotebook
            ? `Notebook match: ${query}`
            : `Content match: ${query}`
      )
      const type: GlobalSearchResult['type'] = isNotebook ? 'notebook' : isSource ? 'source' : 'content'
      const matchKind = isSource
        ? 'File content'
        : isNotebook
          ? 'Notebook / Case'
          : isNote
            ? 'Note content'
            : 'Content match'

      return {
        id: String(result.id ?? result.parent_id ?? result.source_id ?? result.notebook_id ?? `${displayTitle}-${snippet}`),
        title: displayTitle,
        subtitle: snippet || matchKind,
        type,
        href: inferSemanticHref(result, query),
        matchKind,
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

// â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function PageHeader({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search cases, users, organizations...',
  newLabel = 'NOTEBOOK',
  onNew,
  hideNew = false,
  hideSearch = false,
}: PageHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const routeSearchParams = useSearchParams()
  const currentUserEmail = useAuthStore(s => s.currentUserEmail)
  const { toggleCollapse, isCollapsed } = useSidebarStore()
  const searchWrapperRef = useRef<HTMLDivElement | null>(null)
  const searchRequestIdRef = useRef(0)
  const notebooksCacheRef = useRef<NotebookResponse[]>([])
  const sourcesCacheRef = useRef<SourceListResponse[]>([])

  // User Profile State
  const [displayName, setDisplayName] = useState('')
  const [initials, setInitials] = useState('')
  const [formattedDate, setFormattedDate] = useState('')

  useEffect(() => {
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    }
    setFormattedDate(new Date().toLocaleDateString('en-US', options))
  }, [])

  // Global Search State
  const [globalResults, setGlobalResults] = useState<GlobalSearchResult[]>([])
  const [isSearchingGlobal, setIsSearchingGlobal] = useState(false)
  const [showGlobalResults, setShowGlobalResults] = useState(false)
  const [activeGlobalIndex, setActiveGlobalIndex] = useState(-1)
  const [currentPageMatchCount, setCurrentPageMatchCount] = useState(0)

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

  const routeHighlightQuery = routeSearchParams.get('highlight') || routeSearchParams.get('q') || ''

  const displayGlobalResults = useMemo<GlobalSearchResult[]>(() => {
    if (!normalizedSearch || currentPageMatchCount <= 0) return globalResults

    const currentPageResult: GlobalSearchResult = {
      id: `current-page:${pathname}:${normalizedSearch}`,
      title: `Locate "${normalizedSearch}" on this page`,
      subtitle: `${currentPageMatchCount} ${currentPageMatchCount === 1 ? 'match' : 'matches'} found in the visible notebook/page`,
      type: 'page',
      href: '#current-page-match',
      matchKind: 'Current page',
    }

    return [currentPageResult, ...globalResults]
  }, [currentPageMatchCount, globalResults, normalizedSearch, pathname])

  useEffect(() => {
    setActiveGlobalIndex(prev => {
      if (displayGlobalResults.length === 0) return -1
      if (prev < 0) return 0
      return Math.min(prev, displayGlobalResults.length - 1)
    })
  }, [displayGlobalResults.length])

  useEffect(() => {
    const queryFromUrl = routeHighlightQuery.trim()
    if (!queryFromUrl || hideSearch) return

    if (!searchValue.trim()) {
      onSearchChange(queryFromUrl)
    }

    let cancelled = false
    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const tryLocate = () => {
      if (cancelled) return
      attempts += 1
      const result = highlightKeywordOnCurrentPage(queryFromUrl, true)
      setCurrentPageMatchCount(result.count)
      if (result.count === 0 && attempts < 12) {
        timer = setTimeout(tryLocate, 350)
      }
    }

    timer = setTimeout(tryLocate, 450)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [pathname, routeHighlightQuery, hideSearch, onSearchChange, searchValue])

  useEffect(() => {
    if (hideSearch || !normalizedSearch) {
      clearCurrentPageHighlights()
      setCurrentPageMatchCount(0)
      return
    }

    const timer = setTimeout(() => {
      const result = highlightKeywordOnCurrentPage(normalizedSearch, true)
      setCurrentPageMatchCount(result.count)
    }, 220)

    return () => clearTimeout(timer)
  }, [normalizedSearch, hideSearch, pathname])

  useEffect(() => {
    return () => clearCurrentPageHighlights()
  }, [])

  useEffect(() => {
    // Warm caches once so first keystroke can show fast local matches.
    void Promise.allSettled([
      notebooksApi.list({ archived: false, order_by: 'updated' }),
      sourcesApi.list({ limit: 100, sort_by: 'updated', sort_order: 'desc' }),
    ]).then(([notebooksRes, sourcesRes]) => {
      if (notebooksRes.status === 'fulfilled') {
        notebooksCacheRef.current = normalizeListResponse<NotebookResponse>(notebooksRes.value, ['notebooks', 'items', 'results', 'data'])
      }
      if (sourcesRes.status === 'fulfilled') {
        sourcesCacheRef.current = normalizeListResponse<SourceListResponse>(sourcesRes.value, ['sources', 'items', 'results', 'data'])
      }
    })
  }, [])

  useEffect(() => {
    if (!normalizedSearch || hideSearch) {
      searchRequestIdRef.current += 1
      setGlobalResults([])
      setIsSearchingGlobal(false)
      setActiveGlobalIndex(-1)
      setShowGlobalResults(false)
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
        const sourcesPromise = sourcesApi.list({ limit: 100, sort_by: 'updated', sort_order: 'desc' })
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

        const notebooks = notebooksRes.status === 'fulfilled'
          ? normalizeListResponse<NotebookResponse>(notebooksRes.value, ['notebooks', 'items', 'results', 'data'])
          : notebooksCacheRef.current
        const sources = sourcesRes.status === 'fulfilled'
          ? normalizeListResponse<SourceListResponse>(sourcesRes.value, ['sources', 'items', 'results', 'data'])
          : sourcesCacheRef.current
        if (notebooksRes.status === 'fulfilled') {
          notebooksCacheRef.current = normalizeListResponse<NotebookResponse>(notebooksRes.value, ['notebooks', 'items', 'results', 'data'])
        }
        if (sourcesRes.status === 'fulfilled') {
          sourcesCacheRef.current = normalizeListResponse<SourceListResponse>(sourcesRes.value, ['sources', 'items', 'results', 'data'])
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

        const semanticText = textRes.status === 'fulfilled' ? normalizeSearchResults(textRes.value) : []
        const semanticVector = vectorRes.status === 'fulfilled' ? normalizeSearchResults(vectorRes.value) : []
        const semanticMerged = mergeRankedResults([
          ...buildNotebookMatches(notebooks, normalizedSearch),
          ...buildSourceMatches(sources, normalizedSearch),
          ...buildSemanticMatches([...semanticText, ...semanticVector], normalizedSearch),
        ])

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

    const query = normalizedSearch.trim()

    if (result.type === 'page') {
      const located = highlightKeywordOnCurrentPage(query, true)
      setCurrentPageMatchCount(located.count)
      return
    }

    saveGlobalSearchContext(result, query)

    if (result.href.startsWith('/search')) {
      router.push(`/search?q=${encodeURIComponent(query)}&mode=search&highlight=${encodeURIComponent(query)}`)
      return
    }

    if (result.href.startsWith('/sources/') || result.href.startsWith('/notebooks/')) {
      router.push(appendSearchParamsToHref(result.href, query, result))
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
    <header data-kavach-global-search-ignore="true" className="h-[88px] min-h-[88px] flex flex-nowrap items-center justify-between gap-4 pl-4 md:pl-5 pr-4 md:pr-8 bg-white/75 backdrop-blur-md shrink-0 border-b border-slate-100/80 shadow-[0_4px_30px_rgba(0,0,0,0.01)] relative z-40 overflow-visible">

      {/* ── Left: Welcome message & Current date ── */}
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        {/* Hamburger Menu Toggle */}
        {isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-xl transition-colors flex shrink-0 mr-1"
          >
            <Menu className="h-6 w-6" strokeWidth={2} />
          </Button>
        )}

        <div className="flex flex-col text-left justify-center py-1">
          <h1 className="text-[17px] sm:text-[19px] font-bold text-[#1E293B] leading-tight tracking-tight whitespace-nowrap">
            Welcome back, <span className="bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent font-extrabold">{displayName || 'Super Admin'}</span>
          </h1>
          {formattedDate && (
            <span className="text-[12px] md:text-[13px] text-slate-400 font-medium mt-1 whitespace-nowrap">
              {formattedDate}
            </span>
          )}
        </div>
      </div>

      {/* ── Right: Search pill and icons ── */}
      <div className="flex flex-nowrap items-center gap-4 md:gap-6 lg:gap-8 shrink ml-auto min-w-0">
        {!hideSearch && (
          <div ref={searchWrapperRef} data-kavach-global-search-ignore="true" className="relative hidden w-full min-w-[140px] max-w-[240px] md:max-w-[400px] lg:max-w-[480px] sm:block shrink">
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
                  setActiveGlobalIndex(prev => Math.min(prev + 1, displayGlobalResults.length - 1))
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
                  const selected = displayGlobalResults[activeGlobalIndex] ?? displayGlobalResults[0]
                  if (selected) {
                    handleGlobalResultClick(selected)
                  } else {
                    setShowGlobalResults(false)
                    router.push(`/search?q=${encodeURIComponent(normalizedSearch)}&mode=search&highlight=${encodeURIComponent(normalizedSearch)}`)
                  }
                }
              }}
              placeholder="Search cases, users, organizations..."
              autoComplete="off"
              className="pl-12 pr-4 h-[48px] w-full bg-[#F8FAFC] border-[#E2E8F0] rounded-md text-[15px] placeholder:text-slate-400/80 text-slate-700 focus-visible:ring-[#8B5CF6]/30 focus-visible:ring-offset-0 focus-visible:border-[#8B5CF6] transition-all hover:border-slate-300 hover:bg-white hover:shadow-[0_2px_8px_rgba(0,0,0,0.03)] focus:bg-white focus:shadow-[0_2px_8px_rgba(0,0,0,0.03)]"
            />

            {showGlobalResults && normalizedSearch && (
              <div className="absolute left-0 right-0 top-[54px] rounded-xl border border-slate-200 bg-white shadow-xl z-50 overflow-hidden">
                {isSearchingGlobal && displayGlobalResults.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500">Searching across notebooks, cases, files, notes, and content...</div>
                ) : displayGlobalResults.length === 0 ? (
                  <div>
                    <div className="px-4 py-3 text-sm text-slate-500">No direct matches found</div>
                    {isSearchingGlobal && (
                      <div className="px-4 py-2 text-xs text-slate-400 border-t border-slate-100">
                        Searching deeper content...
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setShowGlobalResults(false)
                        router.push(`/search?q=${encodeURIComponent(normalizedSearch)}&mode=search&highlight=${encodeURIComponent(normalizedSearch)}`)
                      }}
                      className="w-full text-left px-4 py-3 text-sm font-semibold text-[#7C3AED] hover:bg-violet-50 border-t border-slate-100"
                    >
                      {`Search everywhere for "${normalizedSearch}"`}
                    </button>
                  </div>
                ) : (
                  <div className="max-h-[360px] overflow-y-auto">
                    {displayGlobalResults.map((result, idx) => (
                      <button
                        key={`${result.type}-${result.id}-${result.href}`}
                        onClick={() => handleGlobalResultClick(result)}
                        className={cn(
                          "w-full text-left px-4 py-3 border-b border-slate-100 last:border-b-0 transition-colors",
                          idx === activeGlobalIndex ? "bg-violet-50" : "hover:bg-slate-50"
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-slate-800 truncate">
                            {renderHighlighted(result.title, normalizedSearch)}
                          </span>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                            {getResultLabel(result.type, result.matchKind)}
                          </span>
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
                        router.push(`/search?q=${encodeURIComponent(normalizedSearch)}&mode=search&highlight=${encodeURIComponent(normalizedSearch)}`)
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
        {/* Icons container */}
        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          <NotificationCenter />

          {/* Chat Bubble Icon */}
          <button className="p-2 text-slate-500 hover:text-violet-600 hover:bg-violet-50/50 rounded-xl transition-all duration-300 hover:scale-[1.08] relative group">
            <MessageSquare className="h-5 w-5 transition-transform group-hover:rotate-3" />
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white" />
          </button>
        </div>
      </div>

      {/* â”€â”€ Create New Notebook Modal Overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
