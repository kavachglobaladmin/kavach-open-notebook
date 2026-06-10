'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from '@/lib/hooks/use-translation'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { 
  ChevronDown, 
  AlertCircle, 
  Save, 
  Sparkles, 
  Search, 
  SendHorizontal, 
  ArrowRight, 
  Lightbulb, 
  Link2, 
  Brain, 
  Zap,
  Filter
} from 'lucide-react'
import { useSearch } from '@/lib/hooks/use-search'
import { useAsk } from '@/lib/hooks/use-ask'
import { useModelDefaults, useModels } from '@/lib/hooks/use-models'
import { useModalManager } from '@/lib/hooks/use-modal-manager'
import { useAuthStore } from '@/lib/stores/auth-store'
import { hasRoleAccess } from '@/lib/auth/roles'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { StreamingResponse } from '@/components/search/StreamingResponse'
import { AdvancedModelsDialog } from '@/components/search/AdvancedModelsDialog'
import { SaveToi_NotesDialog } from '@/components/search/SaveToi_NotesDialog'
import { cn } from '@/lib/utils'

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
  return text.split(splitRe).map((chunk, idx) => (
    testRe.test(chunk)
      ? <mark key={idx} className="bg-violet-100 text-violet-900 rounded px-1 py-0.5">{chunk}</mark>
      : <span key={idx}>{chunk}</span>
  ))
}

export default function SearchPage() {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const urlQuery = searchParams?.get('q') || ''
  const rawMode = searchParams?.get('mode')
  const urlMode = rawMode === 'search' ? 'search' : 'ask'

  // We maintain the activeTab internally for compatibility, defaulting to 'ask'
  const [activeTab, setActiveTab] = useState<'ask' | 'search'>('ask')

  const [query, setQuery] = useState(urlQuery)
  const [searchType, setSearchType] = useState<'text' | 'vector'>('text')
  const [searchSources, setSearchSources] = useState(true)
  const [searchNotes, setSearchNotes] = useState(true)
  const [showAdvancedModels, setShowAdvancedModels] = useState(false)
  const [customModels, setCustomModels] = useState<{
    strategy: string
    answer: string
    finalAnswer: string
  } | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  // Compat getters/setters for legacy triggers in useEffect
  const searchQuery = query
  const askQuestion = query
  const setSearchQuery = (val: string) => setQuery(val)
  const setAskQuestion = (val: string) => setQuery(val)

  // Local state for recent searches based on mockup
  const [recentSearches, setRecentSearches] = useState([
    { id: '1', query: 'Financial fraud cases in Q2 2026', time: '2 hours ago', results: '24 results' },
    { id: '2', query: 'Employee ID: EMP-4521 background check', time: '5 hours ago', results: '8 results' },
    { id: '3', query: 'Cyber crime incidents Delhi region', time: '1 day ago', results: '156 results' },
    { id: '4', query: 'Compliance audit documents 2025-2026', time: '2 days ago', results: '42 results' },
    { id: '5', query: 'Witness statements Case INV-2847', time: '3 days ago', results: '6 results' },
  ])

  const searchMutation = useSearch()
  const ask = useAsk()
  const { data: modelDefaults, isLoading: modelsLoading } = useModelDefaults()
  const { data: availableModels } = useModels()
  const { openModal } = useModalManager()
  const currentUserRole = useAuthStore(s => s.currentUserRole)
  const isSuperAdmin = hasRoleAccess(currentUserRole, 'super_admin')

  const modelNameById = useMemo(() => {
    if (!availableModels) return new Map<string, string>()
    return new Map(availableModels.map((model) => [model.id, model.name]))
  }, [availableModels])

  const hasEmbeddingModel = !!modelDefaults?.default_embedding_model
  const hasAutoTriggeredRef = useRef(false)
  const lastUrlParamsRef = useRef({ q: '', mode: '' })

  const handleSearch = useCallback((queryToUse?: string) => {
    const q = queryToUse !== undefined ? queryToUse : query
    if (!q.trim()) return
    searchMutation.mutate({
      query: q,
      type: searchType,
      limit: 100,
      search_sources: searchSources,
      search_notes: searchNotes,
      minimum_score: 0.2
    })
  }, [query, searchType, searchSources, searchNotes, searchMutation])

  const handleAsk = useCallback((questionToUse?: string) => {
    const q = questionToUse !== undefined ? questionToUse : query
    if (!q.trim() || !modelDefaults?.default_chat_model) return
    const models = customModels || {
      strategy: modelDefaults.default_chat_model,
      answer: modelDefaults.default_chat_model,
      finalAnswer: modelDefaults.default_chat_model
    }
    ask.sendAsk(q, models)
  }, [query, modelDefaults, customModels, ask])

  // Triggers both search queries (LLM synthesis and document list) concurrently
  const handleExecute = (queryToUse?: string) => {
    const targetQuery = queryToUse !== undefined ? queryToUse : query
    if (!targetQuery.trim()) return
    handleSearch(targetQuery)
    handleAsk(targetQuery)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleExecute()
    }
  }

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleExecute()
    }
  }

  const handleSuggestedQuery = (q: string) => {
    setQuery(q)
    handleExecute(q)
  }

  useEffect(() => {
    if (hasAutoTriggeredRef.current || !urlQuery) return
    if (urlMode === 'ask' && modelsLoading) return
    if (urlMode === 'search') {
      handleSearch()
      hasAutoTriggeredRef.current = true
    } else if (urlMode === 'ask' && modelDefaults?.default_chat_model) {
      handleAsk()
      hasAutoTriggeredRef.current = true
    }
  }, [urlQuery, urlMode, modelsLoading, modelDefaults, handleSearch, handleAsk])

  useEffect(() => {
    const currentQ = searchParams?.get('q') || ''
    const rawCurrentMode = searchParams?.get('mode')
    const currentMode = rawCurrentMode === 'search' ? 'search' : 'ask'

    if (currentQ !== lastUrlParamsRef.current.q || currentMode !== lastUrlParamsRef.current.mode) {
      lastUrlParamsRef.current = { q: currentQ, mode: currentMode }
      if (currentQ) {
        setQuery(currentQ)
        hasAutoTriggeredRef.current = false
      }
    }
  }, [searchParams])

  return (
    <AppShell>
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-[#FAFBFF]">
        <PageHeader 
          searchValue={query} 
          onSearchChange={(val) => setQuery(val)}
          newLabel="i_Notes"
        />
        
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-8 pb-20 w-full relative z-10 min-h-full">
            
            {/* Top Heading Block */}
            <div className="flex items-center gap-3.5 mb-6">
              <div className="w-12 h-12 rounded-xl bg-violet-600 flex items-center justify-center text-white shadow-[0_8px_20px_-6px_rgba(124,58,237,0.5)]">
                <Search className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight leading-tight">AI-Powered Search</h1>
                <p className="text-[13px] text-slate-400 font-semibold mt-0.5">Intelligent search across all cases, documents, and data</p>
              </div>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KpiCard title="Total Searches" value="12,845" trend="+24.5%" trendType="success" />
              <KpiCard title="Avg Response Time" value="0.8s" trend="0.2s faster" trendType="success" />
              <KpiCard title="Success Rate" value="94.2%" trend="Above target" trendType="success" />
              <KpiCard title="Today's Searches" value="156" trend="32 active users" trendType="info" />
            </div>

            {/* Main Interactive Transparent White Container */}
            <div className="bg-white/80 border border-slate-200/80 backdrop-blur-md text-slate-800 rounded-[24px] p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] mb-6">
              
              {/* Header inside search card */}
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-[#7C3AED]" />
                <h2 className="text-[17px] font-bold text-slate-800">Ask anything about your cases and data</h2>
              </div>

              {/* Transparent white search input bar container */}
              <div className="relative flex items-center bg-white/70 border border-slate-200/80 backdrop-blur-sm rounded-2xl p-1.5 focus-within:border-[#7C3AED]/40 focus-within:ring-2 focus-within:ring-[#7C3AED]/10 transition-all">
                <div className="pl-3.5 pr-1 text-[#7C3AED]/75 flex items-center justify-center shrink-0">
                  <Search className="h-[18px] w-[18px]" />
                </div>

                <textarea
                  placeholder="Search for cases, documents, people, or ask a question..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={ask.isStreaming}
                  onKeyDown={handleTextareaKeyDown}
                  rows={1}
                  className="flex-1 bg-transparent border-0 text-slate-850 placeholder:text-slate-400 focus:ring-0 focus:outline-none text-[14.5px] min-h-[44px] py-3 px-2 resize-none outline-none shadow-none field-sizing-content"
                />
                
                {/* Search Button styled in medium dark purple for high legibility */}
                <Button
                  onClick={() => handleExecute()}
                  disabled={ask.isStreaming || searchMutation.isPending || !query.trim()}
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white h-[40px] rounded-xl px-6 font-bold shadow-md transition-all shrink-0 border border-violet-700"
                >
                  {ask.isStreaming || searchMutation.isPending ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    "Search"
                  )}
                </Button>
              </div>

              {/* Bottom bar of search card: Actions, Configs & Suggestions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mt-4">
                
                {/* Left side actions and configurations */}
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  {!hasEmbeddingModel ? (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg font-medium">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{t.searchPage.noEmbeddingModel}</span>
                    </div>
                  ) : (
                    <>
                      {isSuperAdmin && (
                        <Button
                          variant="ghost"
                          onClick={() => setShowAdvancedModels(true)}
                          disabled={ask.isStreaming}
                          className="bg-[#F5F3FF] hover:bg-[#EDE9FE] border border-violet-100 text-[#7C3AED] font-bold h-9 px-4 rounded-xl text-xs transition-colors gap-1.5"
                        >
                          Advanced Mode <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {ask.finalAnswer && (
                        <Button
                          onClick={() => setShowSaveDialog(true)}
                          className="bg-[#F5F3FF] hover:bg-[#EDE9FE] border border-violet-100 text-[#7C3AED] h-9 px-4 rounded-xl font-bold text-xs transition-all gap-1.5"
                        >
                          <Save className="h-3.5 w-3.5" /> Save
                        </Button>
                      )}
                    </>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] text-slate-500 font-bold">Search Type:</span>
                    <select
                      value={searchType}
                      onChange={(e) => setSearchType(e.target.value as 'text' | 'vector')}
                      className="bg-[#F5F3FF] border border-violet-100 text-[#7C3AED] text-[12px] font-bold px-3 py-1.5 rounded-xl outline-none cursor-pointer hover:bg-[#EDE9FE] transition-all"
                    >
                      <option value="text" className="text-slate-800">All Documents</option>
                      <option value="vector" className="text-slate-800">Vector Only</option>
                    </select>
                  </div>
                </div>

                {/* Right side try text */}
                <div className="flex items-center gap-1.5 text-[11.5px] text-slate-400 w-full sm:w-auto justify-start sm:justify-end">
                  <Lightbulb className="h-4 w-4 text-amber-500 shrink-0" />
                  <span className="truncate">Try: "Show me all high priority cases..." or "Find documents related..."</span>
                </div>
              </div>

            </div>

            {/* Results Area */}
            {(ask.isStreaming || ask.finalAnswer || searchMutation.data) && (
              <div className="mb-6 bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100 p-6 md:p-8">
                
                {/* AI Answer Section */}
                {(ask.isStreaming || ask.finalAnswer) && (
                  <div className="mb-6">
                    <StreamingResponse
                      isStreaming={ask.isStreaming}
                      strategy={ask.strategy}
                      answers={ask.answers}
                      finalAnswer={ask.finalAnswer}
                    />
                  </div>
                )}

                {/* Divider between AI overview and standard list */}
                {(ask.finalAnswer || ask.isStreaming) && searchMutation.data && (
                  <hr className="my-6 border-slate-100" />
                )}

                {/* Document search results */}
                {searchMutation.data && (
                  <div className="space-y-4 text-left">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-[14px] font-bold text-slate-600">Results ({searchMutation.data.total_count})</span>
                    </div>
                    {searchMutation.data.results.length === 0 ? (
                      <p className="text-sm text-slate-400 py-4 text-center font-medium">No results found for your query.</p>
                    ) : (
                      <div className="space-y-3">
                        {searchMutation.data.results.map((result, index) => (
                          <Card key={index} className="border border-slate-100 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:shadow-md transition-shadow rounded-[16px]">
                            <CardContent className="p-5">
                              <button 
                                onClick={() => {
                                  const [type, id] = result.parent_id.split(':')
                                  const modalType = (type === 'source_insight' ? 'insight' : type) as 'source' | 'note' | 'insight'
                                  openModal(modalType, id)
                                }}
                                className="text-[#7C3AED] font-bold text-[16px] hover:underline text-left block w-full"
                              >
                                {renderHighlighted(result.title, query)}
                              </button>
                              {Array.isArray(result.matches) && result.matches.length > 0 && (
                                <p className="mt-2 text-[13px] text-slate-600 leading-relaxed">
                                  {renderHighlighted(result.matches[0], query)}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Suggested Queries Card Section */}
            <div className="mb-6 bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="h-[20px] w-[20px] text-[#FF8A00]" />
                <h3 className="text-slate-800 font-bold text-[15.5px]">Suggested Queries</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  "Recent security incidents",
                  "High priority open cases",
                  "Unassigned investigations",
                  "Documents pending review",
                  "Cases due this week",
                  "Failed login attempts today"
                ].map((queryText, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestedQuery(queryText)}
                    className="bg-white border border-slate-200/80 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-[12.5px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex items-center"
                  >
                    {queryText}
                  </button>
                ))}
              </div>
            </div>

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.01)] mb-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                  <span className="text-slate-800 font-bold text-[15.5px]">Recent Searches</span>
                  <button 
                    onClick={() => setRecentSearches([])}
                    className="text-[13px] font-bold text-[#7C3AED] hover:underline"
                  >
                    Clear History
                  </button>
                </div>
                <div className="divide-y divide-slate-100">
                  {recentSearches.map((item) => (
                    <div key={item.id} className="py-3.5 flex items-center justify-between group first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                          <Search className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <p className="text-slate-800 font-bold text-[14.5px]">{item.query}</p>
                          <p className="text-[12px] text-slate-400 font-medium mt-0.5">{item.time} &nbsp;•&nbsp; {item.results}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSuggestedQuery(item.query)}
                        className="text-[13px] font-bold text-[#7C3AED] hover:underline"
                      >
                        Search Again
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Benefits Cards Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
              <BenefitCard 
                title="Natural Language"
                desc="Ask questions in plain English. Our AI understands context and intent."
                icon={<Sparkles className="h-5 w-5 text-[#7C3AED]" />}
                iconBg="bg-violet-50"
              />
              <BenefitCard 
                title="Smart Filtering"
                desc="Automatically filters and ranks results by relevance and importance."
                icon={<Filter className="h-5 w-5 text-[#3B82F6]" />}
                iconBg="bg-blue-50"
              />
              <BenefitCard 
                title="Lightning Fast"
                desc="Search across millions of records in under a second with AI optimization."
                icon={<Zap className="h-5 w-5 text-[#10B981]" />}
                iconBg="bg-emerald-50"
              />
            </div>

          </div>
        </div>
      </div>

      {isSuperAdmin && (
        <AdvancedModelsDialog
          open={showAdvancedModels}
          onOpenChange={setShowAdvancedModels}
          defaultModels={{
            strategy: customModels?.strategy || modelDefaults?.default_chat_model || '',
            answer: customModels?.answer || modelDefaults?.default_chat_model || '',
            finalAnswer: customModels?.finalAnswer || modelDefaults?.default_chat_model || ''
          }}
          onSave={setCustomModels}
        />
      )}

      {ask.finalAnswer && (
        <SaveToi_NotessDialog
          open={showSaveDialog}
          onOpenChange={setShowSaveDialog}
          question={askQuestion}
          answer={ask.finalAnswer}
        />
      )}
    </AppShell>
  )
}

function KpiCard({
  title,
  value,
  trend,
  trendType
}: {
  title: string
  value: string
  trend: string
  trendType: 'success' | 'info'
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.01)] flex flex-col justify-between h-[115px]">
      <div>
        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{title}</p>
        <p className="text-[26px] font-extrabold text-slate-800 leading-tight">{value}</p>
      </div>
      <div className="mt-2 flex items-center">
        {trendType === 'success' ? (
          <span className="text-[11px] font-bold text-[#10B981] bg-[#E6FBF3] px-2 py-0.5 rounded-full flex items-center gap-0.5">
            <span className="inline-block translate-y-[-0.5px]">↑</span> {trend}
          </span>
        ) : (
          <span className="text-[11px] font-bold text-[#3B82F6] bg-[#EFF6FF] px-2 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
    </div>
  )
}

function BenefitCard({
  title,
  desc,
  icon,
  iconBg
}: {
  title: string
  desc: string
  icon: React.ReactNode
  iconBg: string
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-[20px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.01)] flex flex-col items-start gap-4">
      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm", iconBg)}>
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-slate-800 text-[15px] mb-1.5">{title}</h4>
        <p className="text-slate-400 text-[13px] font-medium leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}
