'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from '@/lib/hooks/use-translation'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Search, ChevronDown, AlertCircle, Save, Sparkles, SendHorizontal, ArrowRight, Lightbulb, Link2, Brain, Zap } from 'lucide-react'
import { useSearch } from '@/lib/hooks/use-search'
import { useAsk } from '@/lib/hooks/use-ask'
import { useModelDefaults, useModels } from '@/lib/hooks/use-models'
import { useModalManager } from '@/lib/hooks/use-modal-manager'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { StreamingResponse } from '@/components/search/StreamingResponse'
import { AdvancedModelsDialog } from '@/components/search/AdvancedModelsDialog'
import { SaveToNotebooksDialog } from '@/components/search/SaveToNotebooksDialog'
import { cn } from '@/lib/utils'

export default function SearchPage() {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const urlQuery = searchParams?.get('q') || ''
  const rawMode = searchParams?.get('mode')
  const urlMode = rawMode === 'search' ? 'search' : 'ask'

  const [activeTab, setActiveTab] = useState<'ask' | 'search'>(
    urlMode === 'search' ? 'search' : 'ask'
  )

  const [searchQuery, setSearchQuery] = useState(urlMode === 'search' ? urlQuery : '')
  const [searchType, setSearchType] = useState<'text' | 'vector'>('text')
  const [searchSources, setSearchSources] = useState(true)
  const [searchNotes, setSearchNotes] = useState(true)
  const [askQuestion, setAskQuestion] = useState(urlMode === 'ask' ? urlQuery : '')
  const [showAdvancedModels, setShowAdvancedModels] = useState(false)
  const [customModels, setCustomModels] = useState<{
    strategy: string
    answer: string
    finalAnswer: string
  } | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  const searchMutation = useSearch()
  const ask = useAsk()
  const { data: modelDefaults, isLoading: modelsLoading } = useModelDefaults()
  const { data: availableModels } = useModels()
  const { openModal } = useModalManager()

  const modelNameById = useMemo(() => {
    if (!availableModels) return new Map<string, string>()
    return new Map(availableModels.map((model) => [model.id, model.name]))
  }, [availableModels])

  const hasEmbeddingModel = !!modelDefaults?.default_embedding_model
  const hasAutoTriggeredRef = useRef(false)
  const lastUrlParamsRef = useRef({ q: '', mode: '' })

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) return
    searchMutation.mutate({
      query: searchQuery,
      type: searchType,
      limit: 100,
      search_sources: searchSources,
      search_notes: searchNotes,
      minimum_score: 0.2
    })
  }, [searchQuery, searchType, searchSources, searchNotes, searchMutation])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  const handleAsk = useCallback(() => {
    if (!askQuestion.trim() || !modelDefaults?.default_chat_model) return
    const models = customModels || {
      strategy: modelDefaults.default_chat_model,
      answer: modelDefaults.default_chat_model,
      finalAnswer: modelDefaults.default_chat_model
    }
    ask.sendAsk(askQuestion, models)
  }, [askQuestion, modelDefaults, customModels, ask])

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
        if (currentMode === 'search') {
          setSearchQuery(currentQ)
          setActiveTab('search')
        } else {
          setAskQuestion(currentQ)
          setActiveTab('ask')
        }
        hasAutoTriggeredRef.current = false
      }
    }
  }, [searchParams])

  return (
    <AppShell>
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden bg-[#FAFBFF]">
        <div className="absolute top-[20%] -left-[10%] w-[50%] h-[60%] rounded-full bg-[#E0F2FE] mix-blend-multiply blur-[140px] opacity-70"></div>
        <div className="absolute -top-[10%] right-[-5%] w-[55%] h-[65%] rounded-full bg-[#F3E8FF] mix-blend-multiply blur-[140px] opacity-90"></div>
      </div>

      <PageHeader 
        searchValue={searchQuery} 
        onSearchChange={(val) => setSearchQuery(val)}
        newLabel="NOTEBOOK"
      />
      
      <div className="p-4 md:p-8 max-w-[1200px] mx-auto w-full relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-[2.5rem] font-bold text-[#A855F7] mb-2 tracking-tight">Ask & Search</h1>
          <p className="text-[14px] md:text-[15px] text-gray-500 font-medium">Your AI-powered knowledge assistant</p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'ask' | 'search')} className="w-full">
          {/* Updated Tabs List to match Button-style format */}
          <div className="flex justify-center mb-10 px-4">
            <TabsList className="bg-white/70 backdrop-blur-md border border-white/50 h-auto p-1.5 flex items-center justify-center rounded-[2rem] shadow-sm">
              <TabsTrigger 
                value="ask"
                className="rounded-full px-6 md:px-10 py-2.5 text-sm font-bold transition-all duration-300 flex items-center gap-2
                           data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#7C3AED] data-[state=active]:to-[#A855F7]
                           data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/40
                           data-[state=inactive]:text-gray-500 hover:data-[state=inactive]:bg-gray-50"
              >
                <Sparkles className="h-4 w-4" />
                Ask AI (Beta)
              </TabsTrigger>
              <TabsTrigger 
                value="search"
                className="rounded-full px-6 md:px-10 py-2.5 text-sm font-bold transition-all duration-300 flex items-center gap-2
                           data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#7C3AED] data-[state=active]:to-[#A855F7]
                           data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/40
                           data-[state=inactive]:text-gray-500 hover:data-[state=inactive]:bg-gray-50"
              >
                <Search className="h-4 w-4" />
                Search
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="bg-white/95 backdrop-blur-xl rounded-[1.5rem] md:rounded-[2.5rem] shadow-[0_8px_40px_rgb(0,0,0,0.03)] border border-white p-5 md:p-14">
            
            <TabsContent value="ask" className="mt-0 focus-visible:outline-none">
              <div className="text-center mb-8">
                <h2 className="text-xl md:text-[1.75rem] font-bold text-gray-900 mb-2">Ask Your Knowledge Base</h2>
                <p className="text-gray-500 text-sm md:text-[15px] font-medium">Get AI-powered answers from your documents</p>
              </div>

              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <div className="relative mb-5">
                    <Textarea
                      placeholder="What are the connections between Project Alpha and the latest market trends?"
                      value={askQuestion}
                      onChange={(e) => setAskQuestion(e.target.value)}
                      disabled={ask.isStreaming}
                      className="border-none shadow-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-purple-100 resize-none text-base min-h-[140px] p-6 bg-[#F8F9FE] rounded-[1.25rem] w-full placeholder:text-gray-400"
                    />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    {!hasEmbeddingModel ? (
                      <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-md">
                        <AlertCircle className="h-4 w-4" />
                        <span>{t.searchPage.noEmbeddingModel}</span>
                      </div>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => setShowAdvancedModels(true)}
                          disabled={ask.isStreaming}
                          className="bg-[#F4EBFF] hover:bg-[#E9D5FF] border-none text-[#7E22CE] font-bold h-12 px-6 rounded-xl w-full sm:w-auto"
                        >
                          Advanced Mode <ChevronDown className="h-4 w-4 ml-2" />
                        </Button>

                        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                          {ask.finalAnswer && (
                            <Button
                              onClick={() => setShowSaveDialog(true)}
                              className="border-[#8C1BFA] text-[#8C1BFA] bg-transparent border hover:bg-[#8C1BFA] hover:text-white h-12 px-6 rounded-xl font-bold w-full sm:w-auto"
                            >
                              <Save className="h-4 w-4 mr-2" /> Save
                            </Button>
                          )}
                          <Button
                            onClick={handleAsk}
                            disabled={ask.isStreaming || !askQuestion.trim()}
                            className="bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white h-12 rounded-xl px-8 font-bold shadow-lg shadow-purple-500/20 w-full sm:w-auto"
                          >
                            {ask.isStreaming ? <LoadingSpinner size="sm" /> : "Ask AI"}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <StreamingResponse
                  isStreaming={ask.isStreaming}
                  strategy={ask.strategy}
                  answers={ask.answers}
                  finalAnswer={ask.finalAnswer}
                />
              </div>
            </TabsContent>

            <TabsContent value="search" className="mt-0 focus-visible:outline-none">
              <div className="text-center mb-8">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7C3AED] to-[#A855F7] flex items-center justify-center shadow-lg shadow-purple-500/30 mb-5">
                  <Search className="h-7 w-7 text-white" />
                </div>
                <h2 className="text-xl md:text-[1.75rem] font-bold text-gray-900 mb-2">Search Your Knowledge Base</h2>
                <p className="text-gray-500 text-sm md:text-[15px]">Find documents or concepts instantly</p>
              </div>

              <div className="max-w-3xl mx-auto space-y-6">
                <div className="space-y-4">
                  <Input
                    placeholder="Enter search query..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="h-14 border-none bg-[#F8F9FE] rounded-[1rem] px-6 text-base focus-visible:ring-2 focus-visible:ring-purple-100"
                  />
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={searchType}
                      onChange={(e) => setSearchType(e.target.value as 'text' | 'vector')}
                      className="bg-[#F4EBFF] text-[#7E22CE] text-sm font-bold px-6 py-3 rounded-xl outline-none border-none h-12 w-full sm:w-48 cursor-pointer"
                    >
                      <option value="text">All Documents</option>
                      <option value="vector">Vector Only</option>
                    </select>

                    <Button
                      onClick={handleSearch}
                      disabled={searchMutation.isPending || !searchQuery.trim()}
                      className="bg-gradient-to-r from-[#7C3AED] to-[#A855F7] text-white h-12 rounded-xl px-10 font-bold shadow-lg shadow-purple-500/20 flex-1"
                    >
                      {searchMutation.isPending ? <LoadingSpinner size="sm" /> : "Search"}
                    </Button>
                  </div>
                </div>

                {searchMutation.data && (
                  <div className="mt-8 space-y-4 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-gray-600">Results ({searchMutation.data.total_count})</span>
                    </div>
                    {/* Search Results Mapping logic remains identical to original content */}
                    {searchMutation.data.results.map((result, index) => (
                      <Card key={index} className="border-none bg-white shadow-sm hover:shadow-md transition-shadow rounded-xl">
                        <CardContent className="p-5">
                          <button 
                            onClick={() => {
                              const [type, id] = result.parent_id.split(':')
                              openModal(type as any, id)
                            }}
                            className="text-[#7C3AED] font-bold text-lg hover:underline"
                          >
                            {result.title}
                          </button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </div>

          <div className="mt-12 space-y-6">
            <h3 className="text-slate-900 font-bold text-lg px-2">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <QuickActionCard title="Summarize Sources" desc="Get key insights quickly" icon={<Lightbulb className="text-white" />} iconBg="bg-orange-500" />
              <QuickActionCard title="Find Connections" desc="Discover hidden relationships" icon={<Link2 className="text-white" />} iconBg="bg-blue-500" />
              <QuickActionCard title="Deep Analysis" desc="Comprehensive reporting" icon={<Brain className="text-white" />} iconBg="bg-purple-500" />
              <QuickActionCard title="Quick Insights" desc="Fast AI answers" icon={<Zap className="text-white" />} iconBg="bg-emerald-500" />
            </div>
          </div>
        </Tabs>
      </div>

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
    </AppShell>
  )
}

function QuickActionCard({ title, desc, icon, iconBg }: { title: string, desc: string, icon: React.ReactNode, iconBg: string }) {
  return (
    <button className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-slate-50 shadow-sm hover:shadow-md transition-all text-left w-full group">
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm", iconBg)}>
        {icon}
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-slate-800 text-[15px]">{title}</h4>
        <p className="text-slate-400 text-xs font-medium">{desc}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
    </button>
  )
}