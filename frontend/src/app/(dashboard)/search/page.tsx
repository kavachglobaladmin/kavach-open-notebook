'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from '@/lib/hooks/use-translation'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ChevronDown, AlertCircle, Save, Sparkles, Search, SendHorizontal, ArrowRight, Lightbulb, Link2, Brain, Zap } from 'lucide-react'
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
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-[#FAFBFF]">
        {/* Background Gradients */}
        <div className="absolute top-[10%] -left-[10%] w-[50%] h-[60%] rounded-full bg-[#E0F2FE] mix-blend-multiply blur-[120px] opacity-60 pointer-events-none"></div>
        <div className="absolute -top-[10%] right-[-5%] w-[45%] h-[65%] rounded-full bg-[#F3E8FF] mix-blend-multiply blur-[120px] opacity-80 pointer-events-none"></div>

        <PageHeader 
          searchValue={searchQuery} 
          onSearchChange={(val) => setSearchQuery(val)}
          newLabel="NOTEBOOK"
        />
        
        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-8 pb-20 max-w-[1000px] mx-auto w-full relative z-10 min-h-full">
            <div className="text-center mb-6">
              <h1 className="text-3xl md:text-[32px] font-bold text-[#8A2BE2] mb-2 tracking-tight">Ask & Search</h1>
              <p className="text-[14px] md:text-[15px] text-slate-500 font-medium">Your AI-powered knowledge assistant</p>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'ask' | 'search')} className="w-full">
              <div className="flex justify-center mb-8 px-4 sticky top-0 z-20 pt-2 pb-4">
                <div className="bg-white p-1.5 flex items-center justify-center rounded-full shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-slate-100 w-fit mx-auto">
                  <Button 
                    variant="ghost"
                    onClick={() => setActiveTab('ask')}
                    className={cn(
                      "h-[48px] rounded-full px-6 sm:px-10 text-[14px] sm:text-[15px] font-bold transition-all duration-300 flex items-center gap-2 whitespace-nowrap",
                      activeTab === 'ask' 
                        ? "bg-gradient-to-r from-[#8A2BE2] to-[#A855F7] text-white shadow-md hover:from-[#7A26C9] hover:to-[#9333EA] hover:text-white" 
                        : "text-slate-600 bg-transparent hover:bg-slate-50 hover:text-slate-800"
                    )}
                  >
                    <Sparkles className="h-[18px] w-[18px]" />
                    Ask AI (Beta)
                  </Button>
                  <Button 
                    variant="ghost"
                    onClick={() => setActiveTab('search')}
                    className={cn(
                      "h-[48px] rounded-full px-6 sm:px-10 text-[14px] sm:text-[15px] font-bold transition-all duration-300 flex items-center gap-2 whitespace-nowrap",
                      activeTab === 'search' 
                        ? "bg-gradient-to-r from-[#8A2BE2] to-[#A855F7] text-white shadow-md hover:from-[#7A26C9] hover:to-[#9333EA] hover:text-white" 
                        : "text-slate-600 bg-transparent hover:bg-slate-50 hover:text-slate-800"
                    )}
                  >
                    <Search className="h-[18px] w-[18px]" />
                    Search
                  </Button>
                </div>
              </div>

              <div className="bg-white rounded-[24px] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 p-6 md:p-10 w-full mb-10">
                
                <TabsContent value="ask" className="mt-0 focus-visible:outline-none">
                  <div className="text-center mb-8">
                    <h2 className="text-[20px] md:text-[24px] font-bold text-slate-900 mb-1.5">Ask Your Knowledge Base</h2>
                    <p className="text-slate-500 text-[14px]">Get AI-powered answers from your documents</p>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <div className="relative mb-5">
                        <Textarea
                          placeholder="What are the connections between Project Alpha and the latest market trends?"
                          value={askQuestion}
                          onChange={(e) => setAskQuestion(e.target.value)}
                          disabled={ask.isStreaming}
                          className="border border-slate-100 shadow-sm transition-all duration-200 focus-visible:ring-1 focus-visible:ring-[#8A2BE2] resize-none text-[15px] min-h-[140px] p-5 pb-12 bg-[#F8F9FE] rounded-[16px] w-full placeholder:text-slate-400"
                        />
                        <div className="absolute right-5 bottom-5 w-6 h-6 rounded-full bg-purple-100/50"></div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                        {!hasEmbeddingModel ? (
                          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-4 py-3 rounded-[12px] w-full font-medium">
                            <AlertCircle className="h-5 w-5" />
                            <span>{t.searchPage.noEmbeddingModel}</span>
                          </div>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              onClick={() => setShowAdvancedModels(true)}
                              disabled={ask.isStreaming}
                              className="bg-[#F5F3FF] hover:bg-[#EDE9FE] border-none text-[#8A2BE2] font-bold h-[52px] px-6 rounded-[12px] w-full sm:w-auto shrink-0 transition-colors"
                            >
                              Advanced Mode <ChevronDown className="h-4 w-4 ml-2" />
                            </Button>

                            {ask.finalAnswer && (
                              <Button
                                onClick={() => setShowSaveDialog(true)}
                                className="border-[#8A2BE2] text-[#8A2BE2] bg-transparent border-2 hover:bg-[#8A2BE2] hover:text-white h-[52px] px-6 rounded-[12px] font-bold w-full sm:w-auto transition-all"
                              >
                                <Save className="h-4 w-4 mr-2" /> Save
                              </Button>
                            )}
                            
                            <Button
                              onClick={handleAsk}
                              disabled={ask.isStreaming || !askQuestion.trim()}
                              className="bg-[#8A2BE2] hover:bg-[#7A26C9] text-white h-[52px] rounded-[12px] px-8 font-bold flex-1 shadow-md shadow-purple-500/20 w-full sm:w-auto flex items-center justify-center gap-2.5 transition-all"
                            >
                              <Sparkles className="h-5 w-5" />
                              {ask.isStreaming ? <LoadingSpinner size="sm" /> : "Ask AI"}
                              {!ask.isStreaming && <SendHorizontal className="h-5 w-5" /> }
                            </Button>
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
                    <div className="mx-auto w-[60px] h-[60px] rounded-2xl bg-[#8A2BE2] flex items-center justify-center shadow-lg shadow-purple-500/30 mb-5">
                      <Search className="h-7 w-7 text-white" />
                    </div>
                    <h2 className="text-[20px] md:text-[24px] font-bold text-slate-900 mb-1.5">Search Your Knowledge Base</h2>
                    <p className="text-slate-500 text-[14px]">Find documents or concepts instantly</p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-5">
                      <Input
                        placeholder="Enter search query..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={handleKeyPress}
                        className="h-[56px] border border-slate-100 bg-[#F8F9FE] rounded-[16px] px-6 text-[15px] focus-visible:ring-1 focus-visible:ring-[#8A2BE2] shadow-sm"
                      />
                      
                      <div className="flex flex-col sm:flex-row gap-3">
                        <select
                          value={searchType}
                          onChange={(e) => setSearchType(e.target.value as 'text' | 'vector')}
                          className="bg-[#F5F3FF] text-[#8A2BE2] text-[14px] font-bold px-6 py-3 rounded-[12px] outline-none border-none h-[52px] w-full sm:w-48 cursor-pointer"
                        >
                          <option value="text">All Documents</option>
                          <option value="vector">Vector Only</option>
                        </select>

                        <Button
                          onClick={handleSearch}
                          disabled={searchMutation.isPending || !searchQuery.trim()}
                          className="bg-[#8A2BE2] hover:bg-[#7A26C9] text-white h-[52px] rounded-[12px] px-10 font-bold shadow-md shadow-purple-500/20 flex-1 transition-all"
                        >
                          {searchMutation.isPending ? <LoadingSpinner size="sm" /> : "Search"}
                        </Button>
                      </div>
                    </div>

                    {searchMutation.data && (
                      <div className="mt-8 space-y-4 text-left">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                          <span className="text-[14px] font-bold text-slate-600">Results ({searchMutation.data.total_count})</span>
                        </div>
                        {searchMutation.data.results.map((result, index) => (
                          <Card key={index} className="border border-slate-100 bg-white shadow-sm hover:shadow-md transition-shadow rounded-[16px]">
                            <CardContent className="p-5">
                              <button 
                                onClick={() => {
                                  const [type, id] = result.parent_id.split(':')
                                  openModal(type as any, id)
                                }}
                                className="text-[#8A2BE2] font-bold text-[16px] hover:underline text-left block w-full"
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

              <div className="w-full">
                <h3 className="text-slate-800 font-bold text-[16px] mb-4 px-1">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <QuickActionCard 
                    title="Summarize Sources" 
                    desc="Get key insights from your entire knowledge base" 
                    icon={<Lightbulb className="text-white h-[22px] w-[22px]" />} 
                    iconBg="bg-[#FF8A00]" 
                  />
                  <QuickActionCard 
                    title="Find Connections" 
                    desc="Discover hidden relationships between documents" 
                    icon={<Link2 className="text-white h-[22px] w-[22px]" />} 
                    iconBg="bg-[#3B82F6]" 
                  />
                  <QuickActionCard 
                    title="Deep Analysis" 
                    desc="Comprehensive analysis across multiple sources" 
                    icon={<Brain className="text-white h-[22px] w-[22px]" />} 
                    iconBg="bg-[#E83E8C]" 
                  />
                  <QuickActionCard 
                    title="Quick Insights" 
                    desc="Fast answers from your knowledge base" 
                    icon={<Zap className="text-white h-[22px] w-[22px]" />} 
                    iconBg="bg-[#10B981]" 
                  />
                </div>
              </div>
            </Tabs>
          </div>
        </div>
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
    <button className="flex items-center gap-4 p-5 bg-white rounded-[16px] border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] transition-all text-left w-full group">
      <div className={cn("w-[48px] h-[48px] rounded-[14px] flex items-center justify-center shrink-0 shadow-sm", iconBg)}>
        {icon}
      </div>
      <div className="flex-1">
        <h4 className="font-bold text-slate-800 text-[15px] mb-1">{title}</h4>
        <p className="text-slate-500 text-[13px] leading-snug">{desc}</p>
      </div>
      <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
    </button>
  )
}