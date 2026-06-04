'use client'

import React, { useState, useRef, useEffect, useId, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Bot, User, Send, FileText, Lightbulb, StickyNote, Clock } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  SourceChatMessage,
  SourceChatContextIndicator,
  BaseChatSession
} from '@/lib/types/api'
import { ModelSelector } from './ModelSelector'
import { ContextIndicator } from '@/components/common/ContextIndicator'
import { SessionManager } from '@/components/source/SessionManager'
import { MessageActions } from '@/components/source/MessageActions'
import { convertReferencesToCompactMarkdown, createCompactReferenceLinkComponent } from '@/lib/utils/source-references'
import { useModalManager } from '@/lib/hooks/use-modal-manager'
import { toast } from '@/lib/notifications/toast'
import { useTranslation } from '@/lib/hooks/use-translation'

interface NotebookContextStats {
  sourcesInsights: number
  sourcesFull: number
  notesCount: number
  tokenCount?: number
  charCount?: number
}

interface ChatPanelProps {
  className?: string
  messages: SourceChatMessage[]
  isStreaming: boolean
  contextIndicators: SourceChatContextIndicator | null
  onSendMessage: (message: string, modelOverride?: string) => void
  modelOverride?: string
  onModelChange?: (model?: string) => void
  // Session management props
  sessions?: BaseChatSession[]
  currentSessionId?: string | null
  onCreateSession?: (title: string) => void
  onSelectSession?: (sessionId: string) => void
  onDeleteSession?: (sessionId: string) => void
  onUpdateSession?: (sessionId: string, title: string) => void
  loadingSessions?: boolean
  // Generic props for reusability
  title?: string
  subtitle?: string
  headerActions?: React.ReactNode
  contextType?: 'source' | 'notebook'
  // Notebook context stats (for notebook chat)
  notebookContextStats?: NotebookContextStats
  // Notebook ID for saving notes
  notebookId?: string
  // Suggested follow-up questions
  suggestedQuestions?: string[]
  // Source title for source chat context display
  sourceTitle?: string
  // Source insights count for source chat context display
  sourceInsightsCount?: number
  // When true the model-selector row in the input area is hidden
  hideModelSelector?: boolean
  // When provided, overrides the auto-generated "N sources" line in the header
  subtitleLine?: string
}

export function ChatPanel({
  className,
  messages,
  isStreaming,
  contextIndicators,
  onSendMessage,
  modelOverride,
  onModelChange,
  sessions = [],
  currentSessionId,
  onCreateSession,
  onSelectSession,
  onDeleteSession,
  onUpdateSession,
  loadingSessions = false,
  title,
  subtitle,
  headerActions,
  contextType = 'source',
  notebookContextStats,
  notebookId,
  suggestedQuestions = [],
  sourceTitle,
  sourceInsightsCount,
  hideModelSelector = false,
  subtitleLine,
}: ChatPanelProps) {
  const { t } = useTranslation()
  const chatInputId = useId()
  const [sessionManagerOpen, setSessionManagerOpen] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const prevMessageCountRef = useRef(0)
  const { openModal } = useModalManager()

  const handleReferenceClick = (type: string, id: string) => {
    const modalType = type === 'source_insight' ? 'insight' : type as 'source' | 'note' | 'insight'
    try {
      openModal(modalType, id)
    } catch {
      toast.error(t.common.noResults)
    }
  }

  // Memoize the send message callback to prevent unnecessary re-renders
  const memoizedOnSendMessage = useCallback(onSendMessage, [onSendMessage])

  // Track if user is scrolled to bottom
  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current
    if (!el) return
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }, [])

  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollAreaRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  // Memoize the reference click handler
  const memoizedHandleReferenceClick = useCallback(handleReferenceClick, [openModal, t.common.noResults])

  // Scroll to bottom on new messages when appropriate
  useEffect(() => {
    const newCount = messages.length
    const lastMsg = messages[messages.length - 1]
    if (newCount > prevMessageCountRef.current) {
      const shouldScroll = lastMsg?.type === 'human' || isAtBottomRef.current
      if (shouldScroll) {
        const behavior: ScrollBehavior = prevMessageCountRef.current === 0 ? 'auto' : 'smooth'
        requestAnimationFrame(() => scrollMessagesToBottom(behavior))
        isAtBottomRef.current = true
      }
    }
    prevMessageCountRef.current = newCount
  }, [messages, scrollMessagesToBottom])

  const handleSend = useCallback((messageText: string) => {
    if (messageText.trim() && !isStreaming) {
      onSendMessage(messageText.trim(), modelOverride)
    }
  }, [isStreaming, onSendMessage, modelOverride])

  const keyHint = 'Enter'

  const connectedSourcesCount = useMemo(() => {
    if (contextType === 'notebook') {
      const statsCount = notebookContextStats
        ? (notebookContextStats.sourcesInsights + notebookContextStats.sourcesFull)
        : 0
      return statsCount || (contextIndicators?.sources?.length ?? 0)
    }
    // For source chat, the "connected sources" is at least the current source.
    return contextIndicators?.sources?.length ?? 1
  }, [contextType, notebookContextStats, contextIndicators?.sources?.length])

  const lastMessage = messages[messages.length - 1]
  const hasPendingAiMessage = Boolean(
    isStreaming &&
    lastMessage?.type === 'ai' &&
    !lastMessage.content?.trim()
  )

  // Show dots immediately after the user sends a message.
  // If the backend inserts an empty AI message while generating, render dots inside that AI bubble.
  const showThinkingDots = Boolean(
    isStreaming &&
    !hasPendingAiMessage &&
    (messages.length === 0 || lastMessage?.type === 'human')
  )

  useEffect(() => {
    if (!showThinkingDots) return
    requestAnimationFrame(() => scrollMessagesToBottom('smooth'))
  }, [showThinkingDots, scrollMessagesToBottom])

  return (
    <div className={`flex flex-col h-full min-h-0 bg-white rounded-[20px] shadow-[0_2px_16px_rgba(0,0,0,0.06)] overflow-hidden border border-slate-100/80 ${className || ''}`}>

      {/* ── Inner header — matches image: bot icon + title + Sessions button ── */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center">
            <Bot className="h-4 w-4 text-slate-600" />
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-bold text-slate-900 leading-none">
              {title || (contextType === 'source'
                ? t.chat.chatWith.replace('{name}', t.navigation.sources)
                : t.chat.chatWith.replace('{name}', t.common.notebook))}
            </span>
            {subtitle && (
              <span className="text-[11px] font-medium text-slate-400 mt-0.5">
                {subtitle}
              </span>
            )}
            <span className="text-[11px] font-semibold text-slate-500 mt-0.5">
              {subtitleLine ?? `${connectedSourcesCount} ${connectedSourcesCount === 1 ? t.common.source : t.navigation.sources}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {headerActions}
          {onSelectSession && onCreateSession && onDeleteSession && (
            <Dialog open={sessionManagerOpen} onOpenChange={setSessionManagerOpen}>
              <button
                onClick={() => setSessionManagerOpen(true)}
                disabled={loadingSessions}
                className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-slate-800 transition-colors px-2 py-1 rounded-lg hover:bg-slate-50"
              >
                <Clock className="h-3.5 w-3.5" />
                <span>{t.chat.sessions}</span>
              </button>
              <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden">
                <DialogTitle className="sr-only">{t.chat.sessionsTitle}</DialogTitle>
                <SessionManager
                  sessions={sessions}
                  currentSessionId={currentSessionId ?? null}
                  onCreateSession={(title) => onCreateSession?.(title)}
                  onSelectSession={(sessionId) => {
                    onSelectSession(sessionId)
                    setSessionManagerOpen(false)
                  }}
                  onUpdateSession={(sessionId, title) => onUpdateSession?.(sessionId, title)}
                  onDeleteSession={(sessionId) => onDeleteSession?.(sessionId)}
                  loadingSessions={loadingSessions}
                />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* ── Messages area ── */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 py-4"
        ref={scrollAreaRef}
        onScroll={handleScroll}
        style={{ overflowAnchor: 'auto' }}
      >
        <div className="space-y-4">
          {messages.length === 0 && !isStreaming ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <Bot className="h-7 w-7 text-slate-400" />
              </div>
              <p className="text-[13px] font-medium text-slate-500">
                {t.chat.startConversation.replace('{type}', contextType === 'source' ? t.navigation.sources : t.common.notebook)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">{t.chat.askQuestions}</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isPendingAiMessage = isStreaming && message.type === 'ai' && !message.content?.trim() && index === messages.length - 1

              return (
              <div
                key={message.id}
                className={`flex items-end gap-2.5 ${message.type === 'human' ? 'justify-end' : 'justify-start'}`}
              >
                {/* AI avatar — left side */}
                {message.type === 'ai' && (
                  <div className="flex-shrink-0 mb-0.5">
                    <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-slate-500" />
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-1.5 max-w-[78%]">
                  {/* Bubble */}
                  <div
                    className={
                      message.type === 'human'
                        ? 'bg-[#2563EB] text-white rounded-[18px] rounded-br-[6px] px-4 py-2.5 text-[13.5px] leading-relaxed'
                        : 'bg-[#F3F4F6] text-slate-800 rounded-[18px] rounded-bl-[6px] px-4 py-2.5 text-[13.5px] leading-relaxed'
                    }
                  >
                    {message.type === 'ai' ? (
                      isPendingAiMessage ? (
                        <TypingDots />
                      ) : (
                        <AIMessageContent
                          content={message.content}
                          onReferenceClick={memoizedHandleReferenceClick}
                        />
                      )
                    ) : (
                      <p className="break-words">{message.content}</p>
                    )}
                  </div>
                  {message.type === 'ai' && message.content?.trim() && (
                    <MessageActions
                      content={message.content}
                      notebookId={notebookId}
                    />
                  )}
                </div>

                {/* Human avatar — right side */}
                {message.type === 'human' && (
                  <div className="flex-shrink-0 mb-0.5">
                    <div className="h-8 w-8 rounded-xl bg-[#2563EB] flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  </div>
                )}
              </div>
              )
            })
          )}

          {/* Suggested questions — after all messages, only when not streaming */}
          {suggestedQuestions.length > 0 && messages.length > 0 && !isStreaming && (
            <SuggestedQuestionsCard
              key="suggested-questions"
              suggestedQuestions={suggestedQuestions}
              onSelectQuestion={(question) => memoizedOnSendMessage(question, modelOverride)}
              isStreaming={isStreaming}
            />
          )}

          {showThinkingDots && (
            <div className="flex items-end gap-2.5 justify-start animate-in fade-in-0">
              <div className="flex-shrink-0 mb-0.5">
                <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-slate-500" />
                </div>
              </div>

              <div className="bg-[#F3F4F6] text-slate-800 rounded-[18px] rounded-bl-[6px] px-4 py-3">
                <TypingDots />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Context bar — source chat uses ContextIndicator same as notebook ── */}
      {contextType === 'source' && (contextIndicators || sourceInsightsCount !== undefined) && (
        <ContextIndicator
          sourcesInsights={
            // If contextIndicators has insights, use that count; otherwise use sourceInsightsCount
            contextIndicators?.insights?.length
              ? contextIndicators.insights.length
              : (sourceInsightsCount ?? 0)
          }
          sourcesFull={
            // Source chat always has 1 full source
            contextIndicators?.sources?.length
              ? contextIndicators.sources.length
              : 1
          }
          notesCount={contextIndicators?.notes?.length ?? 0}
        />
      )}

      {/* ── Source context bar fallback — shown before first message when no contextIndicators ── */}
      {contextType === 'source' && !contextIndicators && sourceInsightsCount === undefined && (
        <ContextIndicator
          sourcesInsights={0}
          sourcesFull={1}
          notesCount={0}
        />
      )}

      {/* Notebook context indicator — single row with source+insight counts + token/char stats */}
      {notebookContextStats && (
        <ContextIndicator
          sourcesInsights={notebookContextStats.sourcesInsights}
          sourcesFull={notebookContextStats.sourcesFull}
          notesCount={notebookContextStats.notesCount}
          tokenCount={notebookContextStats.tokenCount}
          charCount={notebookContextStats.charCount}
        />
      )}

      {/* ── Input area ── */}
      <ChatInputArea
        onSendMessage={handleSend}
        isStreaming={isStreaming}
        modelOverride={modelOverride}
        onModelChange={hideModelSelector ? undefined : onModelChange}
        chatInputId={chatInputId}
        keyHint={keyHint}
        t={t}
      />
    </div>
  )
}


function TypingDots() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-slate-400 animate-bounce" />
      <span
        className="h-2 w-2 rounded-full bg-slate-400 animate-bounce"
        style={{ animationDelay: '120ms' }}
      />
      <span
        className="h-2 w-2 rounded-full bg-slate-400 animate-bounce"
        style={{ animationDelay: '240ms' }}
      />
    </div>
  )
}

// Helper component to render AI messages with clickable references - memoized for performance
const AIMessageContent = React.memo(function AIMessageContentComponent({
  content,
  onReferenceClick
}: {
  content: string
  onReferenceClick: (type: string, id: string) => void
}) {
  const { t } = useTranslation()
  const markdownWithCompactRefs = convertReferencesToCompactMarkdown(content, t.common.references)
  const LinkComponent = createCompactReferenceLinkComponent(onReferenceClick)

  return (
    <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none break-words prose-headings:font-semibold prose-a:text-blue-600 prose-a:break-all prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-p:mb-4 prose-p:leading-7 prose-li:mb-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: LinkComponent,
          p: ({ children }) => <p className="mb-4">{children}</p>,
          h1: ({ children }) => <h1 className="mb-4 mt-6">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-3 mt-5">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-3 mt-4">{children}</h3>,
          h4: ({ children }) => <h4 className="mb-2 mt-4">{children}</h4>,
          h5: ({ children }) => <h5 className="mb-2 mt-3">{children}</h5>,
          h6: ({ children }) => <h6 className="mb-2 mt-3">{children}</h6>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          ul: ({ children }) => <ul className="mb-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="mb-4 space-y-1">{children}</ol>,
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto">
              <table className="min-w-full border-collapse border border-border">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
          th: ({ children }) => <th className="border border-border px-3 py-2 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-border px-3 py-2">{children}</td>,
        }}
      >
        {markdownWithCompactRefs}
      </ReactMarkdown>
    </div>
  )
})

// ✅ FIX: Suggested questions card - shows FULL question text, no truncation
const SuggestedQuestionsCard = React.memo(function SuggestedQuestionsCardComponent({
  suggestedQuestions,
  onSelectQuestion,
  isStreaming
}: {
  suggestedQuestions: string[]
  onSelectQuestion: (question: string) => void
  isStreaming: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5 mt-3 ml-8">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Suggested questions
      </p>
      <div className="flex flex-col gap-1.5">
        {suggestedQuestions.map((question, idx) => (
          <Button
            key={idx}
            variant="outline"
            size="sm"
            className="justify-start text-left h-auto py-1.5 px-3 text-xs w-fit max-w-sm"
            onClick={() => onSelectQuestion(question)}
            disabled={isStreaming}
            title={question}
          >
            <Lightbulb className="h-3 w-3 mr-2 shrink-0 mt-0.5 flex-shrink-0" />
            <span className="truncate">{question}</span>
          </Button>
        ))}
      </div>
    </div>
  )
})

// Input area component - completely isolated with its own state to prevent parent re-renders
const ChatInputArea = React.memo(function ChatInputAreaComponent({
  onSendMessage,
  isStreaming,
  modelOverride,
  onModelChange,
  chatInputId,
  keyHint,
  t,
}: {
  onSendMessage: (message: string) => void
  isStreaming: boolean
  modelOverride?: string
  onModelChange?: (model?: string) => void
  chatInputId: string
  keyHint: string
  t: ReturnType<typeof useTranslation>['t']
}) {
  const [input, setInput] = useState('')

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }, [])

  const handleSend = useCallback(() => {
    if (input.trim() && !isStreaming) {
      onSendMessage(input.trim())
      setInput('')
    }
  }, [input, isStreaming, onSendMessage])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div className="flex-shrink-0 border-t border-slate-100 bg-white">
      {/* Model row — model selector only */}
      {/* {onModelChange && (
        <div className="flex items-center justify-end px-4 sm:px-5 pt-2.5 pb-1">
          <ModelSelector
            currentModel={modelOverride}
            onModelChange={onModelChange}
            disabled={isStreaming}
          />
        </div>
      )} */}
      {/* Input row */}
      <div className="flex gap-2 sm:gap-2.5 items-end px-4 sm:px-5 py-3">
        <Textarea
          id={chatInputId}
          name="chat-message"
          autoComplete="off"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={`${t.chat.sendPlaceholder} (${t.chat.pressToSend.replace('{key}', keyHint)})`}
          disabled={isStreaming}
          className="flex-1 min-h-[42px] max-h-[120px] resize-none rounded-[14px] border border-slate-200 bg-slate-50 focus:bg-white py-2.5 px-4 text-[13px] text-slate-800 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-blue-400 focus-visible:border-blue-300 transition-colors"
          rows={1}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          aria-label="Send message"
          className="h-[42px] w-[42px] flex-shrink-0 rounded-[12px] bg-[#2563EB] hover:bg-[#1d4ed8] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
        >
          <Send className="h-4 w-4 text-white" />
        </button>
      </div>
    </div>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.isStreaming === nextProps.isStreaming &&
    prevProps.modelOverride === nextProps.modelOverride &&
    prevProps.onModelChange === nextProps.onModelChange &&
    prevProps.onSendMessage === nextProps.onSendMessage
  )
})


