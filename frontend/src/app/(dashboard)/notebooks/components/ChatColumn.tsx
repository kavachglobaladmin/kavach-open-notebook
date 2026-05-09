'use client'

import { useState } from 'react'
import { ChatPanel } from '@/components/source/ChatPanel'
import { ConfigureChatModal } from '@/components/source/ConfigureChatModal'
import { useNotebookChat } from '@/lib/hooks/useNotebookChat'
import { SourceListResponse, NoteResponse } from '@/lib/types/api'
import { ContextSelections } from '@/app/(dashboard)/notebooks/[id]/page'

interface ChatColumnProps {
  notebookId: string
  contextSelections: ContextSelections
  sources: SourceListResponse[]
  sourcesLoading?: boolean
  notes: NoteResponse[]
}

export function ChatColumn({
  notebookId,
  contextSelections,
  sources,
  notes,
}: ChatColumnProps) {
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [chatConfig, setChatConfig] = useState({ goal: 'Default', length: 'Default' })

  const chat = useNotebookChat({
    notebookId,
    sources: sources ?? [],
    notes: notes ?? [],
    contextSelections,
  })

  // Build context indicators for ChatPanel
  const contextIndicators = {
    sourcesCount: Object.values(contextSelections.sources).filter(m => m !== 'off').length,
    notesCount: Object.values(contextSelections.notes).filter(m => m !== 'off').length,
    tokenCount: chat.tokenCount,
    charCount: chat.charCount,
  }

  return (
    <>
      {/* ChatPanel is now self-contained with its own white card + header */}
      <div className="h-full flex flex-col">
        <ChatPanel
          messages={chat.messages as any}
          isStreaming={chat.isSending}
          contextIndicators={contextIndicators as any}
          onSendMessage={(message, model) => {
            const configContext = `[Style: ${chatConfig.goal}, Length: ${chatConfig.length}] `
            const cleanMessage = message.replace(configContext, '')
            chat.sendMessage(cleanMessage, model)
          }}
          modelOverride={chat.currentSession?.model_override ?? undefined}
          onModelChange={(model) => {
            if (model !== undefined) chat.setModelOverride(model)
          }}
          sessions={chat.sessions as any}
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
          notebookContextStats={{
            tokenCount: chat.tokenCount,
            charCount: chat.charCount,
            sourcesInsights: 0,
            sourcesFull: 0,
            notesCount: 0,
          }}
          suggestedQuestions={chat.suggestedQuestions}
        />
      </div>

      {/* ── Configure Chat Modal ── */}
      {isConfigOpen && (
        <ConfigureChatModal
          currentConfig={chatConfig}
          onSave={(newConfig: any) => {
            setChatConfig(newConfig)
            setIsConfigOpen(false)
          }}
          onClose={() => setIsConfigOpen(false)}
        />
      )}
    </>
  )
}
