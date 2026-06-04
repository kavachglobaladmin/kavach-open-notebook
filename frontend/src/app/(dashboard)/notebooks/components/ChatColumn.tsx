'use client'

import { useState } from 'react'
import { ChatPanel } from '@/components/source/ChatPanel'
import { ConfigureChatModal } from '@/components/source/ConfigureChatModal'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { useNotebookChat } from '@/lib/hooks/useNotebookChat'
import {
  SourceListResponse,
  NoteResponse,
  SourceChatContextIndicator,
  SourceChatMessage,
  BaseChatSession,
} from '@/lib/types/api'
import { ContextSelections } from '@/app/(dashboard)/notebooks/[id]/page'

interface ChatColumnProps {
  notebookId: string
  contextSelections: ContextSelections
  sources: SourceListResponse[]
  sourcesLoading?: boolean
  notes: NoteResponse[]
  folderContexts?: Array<{
    id: string
    name: string
    sources: SourceListResponse[]
    notes: NoteResponse[]
  }>
  /** Optional override for the chat panel header title */
  chatTitle?: string
  /** When provided, replaces the auto "N sources" subtitle line */
  subtitleLine?: string
  /** When true, hides the model-selector row in the input area */
  hideModelSelector?: boolean
}

export function ChatColumn({
  notebookId,
  contextSelections,
  sources = [],
  sourcesLoading = false,
  notes = [],
  folderContexts = [],
  chatTitle,
  subtitleLine,
  hideModelSelector = false,
}: ChatColumnProps) {
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [chatConfig, setChatConfig] = useState({ goal: 'Default', length: 'Default' })

  const chat = useNotebookChat({
    notebookId,
    sources: sources ?? [],
    notes: notes ?? [],
    contextSelections,
    folderContexts,
  })

  // Build context indicators for ChatPanel from current user selections.
  const selectedSourceIds = sources
    .filter((source) => (contextSelections.sources[source.id] ?? 'off') !== 'off')
    .map((source) => source.id)

  const selectedInsightSourceIds = sources
    .filter((source) => contextSelections.sources[source.id] === 'insights')
    .map((source) => source.id)

  const selectedFullSourceIds = sources
    .filter((source) => contextSelections.sources[source.id] === 'full')
    .map((source) => source.id)

  const selectedNoteIds = notes
    .filter((note) => (contextSelections.notes[note.id] ?? 'off') !== 'off')
    .map((note) => note.id)

  const contextIndicators: SourceChatContextIndicator = {
    sources: selectedSourceIds,
    insights: selectedInsightSourceIds,
    notes: selectedNoteIds,
  }

  const panelMessages: SourceChatMessage[] = chat.messages.map((message) => ({
    id: message.id,
    type: message.type,
    content: message.content,
    timestamp: message.timestamp,
  }))

  const panelSessions: BaseChatSession[] = chat.sessions.map((session) => ({
    id: session.id,
    title: session.title,
    created: session.created,
    updated: session.updated,
    message_count: session.message_count,
    model_override: session.model_override ?? null,
  }))

  if (sourcesLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <>
      {/* ChatPanel is now self-contained with its own white card + header */}
      <div className="h-full flex flex-col">
        <ChatPanel
          messages={panelMessages}
          isStreaming={chat.isSending}
          contextIndicators={contextIndicators}
          onSendMessage={(message, model) => {
            const configContext = `[Style: ${chatConfig.goal}, Length: ${chatConfig.length}] `
            const cleanMessage = message.replace(configContext, '')
            chat.sendMessage(cleanMessage, model)
          }}
          modelOverride={chat.currentSession?.model_override ?? undefined}
          onModelChange={(model) => {
            if (model !== undefined) chat.setModelOverride(model)
          }}
          sessions={panelSessions}
          currentSessionId={chat.currentSessionId}
          onCreateSession={(title) => chat.createSession(title)}
          onSelectSession={chat.switchSession}
          onUpdateSession={(sessionId, title) =>
            chat.updateSession(sessionId, { title })
          }
          onDeleteSession={chat.deleteSession}
          loadingSessions={chat.loadingSessions}
          contextType="notebook"
          notebookId={notebookId}
          title={chatTitle}
          subtitleLine={subtitleLine}
          hideModelSelector={hideModelSelector}
          notebookContextStats={{
            tokenCount: chat.tokenCount,
            charCount: chat.charCount,
            sourcesInsights: selectedInsightSourceIds.length,
            sourcesFull: selectedFullSourceIds.length,
            notesCount: selectedNoteIds.length,
          }}
          suggestedQuestions={chat.suggestedQuestions}
        />
      </div>

      {/* ── Configure Chat Modal ── */}
      {isConfigOpen && (
        <ConfigureChatModal
          currentConfig={chatConfig}
          onSave={(newConfig: { goal: string; length: string }) => {
            setChatConfig(newConfig)
            setIsConfigOpen(false)
          }}
          onClose={() => setIsConfigOpen(false)}
        />
      )}
    </>
  )
}
