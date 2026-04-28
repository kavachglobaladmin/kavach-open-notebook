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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Search, ChevronDown, AlertCircle, Settings, Save, MessageCircleQuestion } from 'lucide-react'
import { useSearch } from '@/lib/hooks/use-search'
import { useAsk } from '@/lib/hooks/use-ask'
import { useModelDefaults, useModels } from '@/lib/hooks/use-models'
import { useModalManager } from '@/lib/hooks/use-modal-manager'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { StreamingResponse } from '@/components/search/StreamingResponse'
import { AdvancedModelsDialog } from '@/components/search/AdvancedModelsDialog'
import { SaveToNotebooksDialog } from '@/components/search/SaveToNotebooksDialog'

export default function SearchPage() {
  const { t } = useTranslation()
  // URL params
  const searchParams = useSearchParams()
  const urlQuery = searchParams?.get('q') || ''
  const rawMode = searchParams?.get('mode')
  const urlMode = rawMode === 'search' ? 'search' : 'ask'

  // Tab state (controlled)
  const [activeTab, setActiveTab] = useState<'ask' | 'search'>(
    urlMode === 'search' ? 'search' : 'ask'
  )

  // Search state
  const [searchQuery, setSearchQuery] = useState(urlMode === 'search' ? urlQuery : '')
  const [searchType, setSearchType] = useState<'text' | 'vector'>('text')
  const [searchSources, setSearchSources] = useState(true)
  const [searchNotes, setSearchNotes] = useState(true)

  // Ask state
  const [askQuestion, setAskQuestion] = useState(urlMode === 'ask' ? urlQuery : '')

  // Advanced models dialog
  const [showAdvancedModels, setShowAdvancedModels] = useState(false)
  const [customModels, setCustomModels] = useState<{
    strategy: string
    answer: string
    finalAnswer: string
  } | null>(null)

  // Save to notebooks dialog
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  // Hooks
  const searchMutation = useSearch()
  const ask = useAsk()
  const { data: modelDefaults, isLoading: modelsLoading } = useModelDefaults()
  const { data: availableModels } = useModels()
  const { openModal } = useModalManager()

  const modelNameById = useMemo(() => {
    if (!availableModels) {
      return new Map<string, string>()
    }
    return new Map(availableModels.map((model) => [model.id, model.name]))
  }, [availableModels])

  const resolveModelName = (id?: string | null) => {
    if (!id) return t.searchPage.notSet
    return modelNameById.get(id) ?? id
  }

  const hasEmbeddingModel = !!modelDefaults?.default_embedding_model

  // Track if we've already auto-triggered from URL params
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

  // Auto-trigger search/ask when arriving with URL params
  useEffect(() => {
    // Skip if already triggered or no query
    if (hasAutoTriggeredRef.current || !urlQuery) return

    // Wait for models to load before triggering ask
    if (urlMode === 'ask' && modelsLoading) return

    if (urlMode === 'search') {
      handleSearch()
      hasAutoTriggeredRef.current = true
    } else if (urlMode === 'ask' && modelDefaults?.default_chat_model) {
      handleAsk()
      hasAutoTriggeredRef.current = true
    }
  }, [urlQuery, urlMode, modelsLoading, modelDefaults, handleSearch, handleAsk])

  // Handle URL param changes while on page
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
          hasAutoTriggeredRef.current = false
        } else {
          setAskQuestion(currentQ)
          setActiveTab('ask')
          hasAutoTriggeredRef.current = false
        }
      }
    }
  }, [searchParams])

  return (
    <AppShell>
      <PageHeader 
        searchValue={searchQuery} 
        onSearchChange={(val) => setSearchQuery(val)} 
      />
      <div className="p-4 md:p-8 max-w-[1600px] mx-auto w-full">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-6">{t.searchPage.askAndSearch}</h1>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[calc(100vh-220px)] p-6 md:p-12">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'ask' | 'search')} className="w-full">
            
            {/* Centered Pill Tabs matching the exact UI with text un-wrapped */}
            <div className="flex justify-center mb-12">
              <TabsList className="bg-transparent border-0 gap-4 h-auto p-0 flex flex-wrap justify-center">
                <TabsTrigger 
                  value="ask"
                  className="rounded-full px-8 py-2.5 text-sm font-medium transition-colors whitespace-nowrap inline-flex items-center justify-center data-[state=active]:bg-[#F05A28] data-[state=active]:text-white data-[state=active]:border-[#F05A28] data-[state=inactive]:bg-[#FFF4F0] data-[state=inactive]:text-[#F05A28] border data-[state=inactive]:border-[#F05A28]"
                >
                  <MessageCircleQuestion className="h-4 w-4 mr-2" />
                  {t.searchPage.askBeta || 'Ask (Beta)'}
                </TabsTrigger>
                <TabsTrigger 
                  value="search"
                  className="rounded-full px-8 py-2.5 text-sm font-medium transition-colors whitespace-nowrap inline-flex items-center justify-center data-[state=active]:bg-[#F05A28] data-[state=active]:text-white data-[state=active]:border-[#F05A28] data-[state=inactive]:bg-[#FFF4F0] data-[state=inactive]:text-[#F05A28] border data-[state=inactive]:border-[#F05A28]"
                >
                  <Search className="h-4 w-4 mr-2" />
                  {t.searchPage.search}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ASK CONTENT */}
            <TabsContent value="ask" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-gray-900 mb-3">{t.searchPage.askYourKb || 'Ask'}</h2>
                <p className="text-gray-500 text-sm">{t.searchPage.askYourKbDesc || 'Ask Questions About Your Knowledge Base'}</p>
              </div>

              <div className="max-w-4xl mx-auto space-y-8">
                {/* Ask Input Container (Exact match styled) */}
                <div className="border border-gray-200 rounded-2xl shadow-sm bg-white overflow-hidden transition-all focus-within:border-[#F05A28] focus-within:ring-1 focus-within:ring-[#F05A28]">
                  <div className="p-2">
                    <Textarea
                      placeholder={t.searchPage.enterQuestionPlaceholder || 'Enter Your Question...'}
                      value={askQuestion}
                      onChange={(e) => setAskQuestion(e.target.value)}
                      onKeyDown={(e) => {
                        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !ask.isStreaming && askQuestion.trim()) {
                          e.preventDefault()
                          handleAsk()
                        }
                      }}
                      disabled={ask.isStreaming}
                      className="border-0 shadow-none focus-visible:ring-0 resize-none text-base md:text-lg min-h-[120px] p-4 bg-transparent"
                      aria-label={t.common.accessibility.enterQuestion}
                    />
                  </div>
                  
                  <div className="border-t border-gray-100 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
                    {!hasEmbeddingModel ? (
                      <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-md w-full sm:w-auto">
                        <AlertCircle className="h-4 w-4" />
                        <span>{t.searchPage.noEmbeddingModel}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 flex-wrap flex-1 w-full sm:w-auto">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAdvancedModels(true)}
                            disabled={ask.isStreaming}
                            className="bg-[#FFF4F0] hover:bg-[#FFE8E0] text-[#F05A28] hover:text-[#D94E20] h-9 px-4 rounded-md"
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            {t.searchPage.advanced || 'Advanced Models'}
                          </Button>
                          <div className="hidden lg:flex gap-2 text-xs">
                            <Badge variant="outline" className="bg-gray-50 font-normal text-gray-500 border-gray-200">
                              Strategy: {resolveModelName(customModels?.strategy || modelDefaults?.default_chat_model)}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                          {ask.finalAnswer && (
                            <Button
                              variant="outline"
                              onClick={() => setShowSaveDialog(true)}
                              className="border-[#F05A28] text-[#F05A28] hover:bg-[#FFF4F0] h-10 px-6"
                            >
                              <Save className="h-4 w-4 mr-2" />
                              {t.searchPage.saveToNotebooks}
                            </Button>
                          )}
                          <Button
                            onClick={handleAsk}
                            disabled={ask.isStreaming || !askQuestion.trim()}
                            className="bg-[#F05A28] hover:bg-[#D94E20] text-white px-8 h-10 rounded-md text-sm font-medium tracking-wide uppercase w-full sm:w-auto"
                          >
                            {ask.isStreaming ? (
                              <>
                                <LoadingSpinner size="sm" className="mr-2" />
                                {t.searchPage.processing || 'PROCESSING'}
                              </>
                            ) : (
                              <>
                                <MessageCircleQuestion className="h-4 w-4 mr-2" />
                                {t.searchPage.ask || 'ASK'}
                              </>
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Ask Streaming Response */}
                <StreamingResponse
                  isStreaming={ask.isStreaming}
                  strategy={ask.strategy}
                  answers={ask.answers}
                  finalAnswer={ask.finalAnswer}
                />
              </div>
            </TabsContent>

            {/* SEARCH CONTENT */}
            <TabsContent value="search" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <div className="text-center mb-12">
                <h2 className="text-3xl font-bold text-gray-900 mb-3">{t.searchPage.search || 'Search'}</h2>
                <p className="text-gray-500 text-sm">
                  Search Your Knowledge Base For Specific Keywords Or Concepts
                </p>
              </div>

              <div className="max-w-4xl mx-auto space-y-8">
                {/* Search Input Container (Exact match styled) */}
                <div className="border border-gray-200 rounded-2xl shadow-sm bg-white overflow-hidden transition-all focus-within:border-[#F05A28] focus-within:ring-1 focus-within:ring-[#F05A28]">
                  <div className="p-2">
                    <Textarea
                      placeholder={t.searchPage.enterSearchPlaceholder || 'Enter Search Query...'}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={searchMutation.isPending}
                      className="border-0 shadow-none focus-visible:ring-0 resize-none text-base md:text-lg min-h-[120px] p-4 bg-transparent"
                      aria-label={t.common.accessibility.enterSearch}
                    />
                  </div>
                  
                  <div className="border-t border-gray-100 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white">
                    <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
                      {/* Search Type Dropdown Mimicking UI */}
                      <div className="relative inline-flex items-center">
                        <select
                          value={searchType}
                          onChange={(e) => setSearchType(e.target.value as 'text' | 'vector')}
                          disabled={!hasEmbeddingModel || modelsLoading || searchMutation.isPending}
                          className="appearance-none bg-[#FFF4F0] hover:bg-[#FFE8E0] text-[#F05A28] text-sm font-medium pl-4 pr-10 py-2.5 rounded-md outline-none cursor-pointer transition-colors border-none disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="text">Search Type: Text</option>
                          <option value="vector" disabled={!hasEmbeddingModel}>Search Type: Vector</option>
                        </select>
                        <ChevronDown className="absolute right-3 h-4 w-4 text-[#F05A28] pointer-events-none" />
                      </div>
                      
                      {/* Preserved underlying functionality for Search Locations */}
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <label className="flex items-center gap-2 cursor-pointer hover:text-gray-700 transition-colors">
                          <Checkbox 
                            checked={searchSources} 
                            onCheckedChange={(c) => setSearchSources(c as boolean)} 
                            disabled={searchMutation.isPending}
                            className="data-[state=checked]:bg-[#F05A28] data-[state=checked]:border-[#F05A28]" 
                          /> 
                          {t.searchPage.searchSources || 'Sources'}
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-gray-700 transition-colors">
                          <Checkbox 
                            checked={searchNotes} 
                            onCheckedChange={(c) => setSearchNotes(c as boolean)} 
                            disabled={searchMutation.isPending}
                            className="data-[state=checked]:bg-[#F05A28] data-[state=checked]:border-[#F05A28]" 
                          /> 
                          {t.searchPage.searchNotes || 'Notes'}
                        </label>
                      </div>
                    </div>

                    <Button
                      onClick={handleSearch}
                      disabled={searchMutation.isPending || !searchQuery.trim()}
                      className="bg-[#F05A28] hover:bg-[#D94E20] text-white px-8 h-10 rounded-md text-sm font-medium tracking-wide uppercase w-full sm:w-auto"
                    >
                      {searchMutation.isPending ? (
                        <LoadingSpinner size="sm" className="mr-2" />
                      ) : (
                        <Search className="h-4 w-4 mr-2" />
                      )}
                      {t.searchPage.search || 'SEARCH'}
                    </Button>
                  </div>
                </div>

                {!hasEmbeddingModel && (
                  <div className="flex items-center justify-center gap-2 text-sm text-amber-600">
                    <AlertCircle className="h-4 w-4" />
                    <span>{t.searchPage.vectorSearchWarning}</span>
                  </div>
                )}

                {/* Search Results Block (Preserved Logic) */}
                {searchMutation.data && (
                  <div className="mt-8 space-y-4 text-left">
                    <div className="flex items-center justify-between px-2">
                      <h3 className="text-sm font-medium text-gray-700">
                        {t.searchPage.resultsFound.replace('{count}', searchMutation.data.total_count.toString())}
                      </h3>
                      <Badge variant="outline" className="bg-gray-50 text-gray-600 font-normal">
                        {searchMutation.data.search_type === 'text' ? t.searchPage.textSearch : t.searchPage.vectorSearch}
                      </Badge>
                    </div>

                    {searchMutation.data.results.length === 0 ? (
                      <Card className="border-gray-100 shadow-sm">
                        <CardContent className="pt-8 pb-8 text-center text-muted-foreground">
                          {t.searchPage.noResultsFor.replace('{query}', searchQuery)}
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 pb-4">
                        {searchMutation.data.results.map((result, index) => {
                          if (!result.parent_id) {
                            console.warn('Search result with null parent_id:', result)
                            return null
                          }
                          const [type, id] = result.parent_id.split(':')
                          const modalType = type === 'source_insight' ? 'insight' : type as 'source' | 'note' | 'insight'

                          return (
                            <Card key={index} className="border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                              <CardContent className="p-5">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <button
                                      onClick={() => openModal(modalType, id)}
                                      className="text-[#F05A28] hover:text-[#D94E20] hover:underline font-medium text-left"
                                    >
                                      {result.title}
                                    </button>
                                    <Badge variant="secondary" className="ml-3 bg-[#FFF4F0] text-[#F05A28] hover:bg-[#FFE8E0] font-medium">
                                      {result.final_score.toFixed(2)}
                                    </Badge>
                                  </div>
                                </div>

                                {result.matches && result.matches.length > 0 && (
                                  <Collapsible className="mt-4">
                                    <CollapsibleTrigger className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors">
                                      <ChevronDown className="h-4 w-4" />
                                      {t.searchPage.matches.replace('{count}', result.matches.length.toString())}
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="mt-3 space-y-2">
                                      {result.matches.map((match, i) => (
                                        <div key={i} className="text-sm text-gray-600 pl-4 py-1.5 border-l-2 border-[#F05A28]/30 bg-gray-50/50 rounded-r-md">
                                          {match}
                                        </div>
                                      ))}
                                    </CollapsibleContent>
                                  </Collapsible>
                                )}
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Global Modals for Advanced Options and Notebooks */}
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

      {ask.finalAnswer && (
        <SaveToNotebooksDialog
          open={showSaveDialog}
          onOpenChange={setShowSaveDialog}
          question={askQuestion}
          answer={ask.finalAnswer}
        />
      )}
    </AppShell>
  )
}