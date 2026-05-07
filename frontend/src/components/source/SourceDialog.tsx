'use client'

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { SourceDetailContent } from './SourceDetailContent'
import { ChatPanel } from './ChatPanel'
import { useSourceChat } from '@/lib/hooks/useSourceChat'
import { useTranslation } from '@/lib/hooks/use-translation'
import { MessageSquare, Settings2 } from 'lucide-react'
import { useState } from 'react'

interface SourceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceId: string | null
}

/**
 * Source Dialog Component
 *
 * Displays source details in a modal dialog with an equal two-column layout:
 * left = source detail content, right = chat panel.
 * Matches the layout of the full /sources/[id] page.
 */
export function SourceDialog({ open, onOpenChange, sourceId }: SourceDialogProps) {
  const { t } = useTranslation()

  // Ensure source ID has 'source:' prefix for API calls and routing
  const sourceIdWithPrefix = sourceId
    ? (sourceId.includes(':') ? sourceId : `source:${sourceId}`)
    : null

  const handleClose = () => {
    onOpenChange(false)
  }

  if (!sourceIdWithPrefix) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[92vw] w-[92vw] h-[90vh] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-[20px] border-0 shadow-2xl">
        <DialogTitle className="sr-only">{t.sources.detailsTitle}</DialogTitle>

        {/* Two-column layout — equal halves, same as /sources/[id] page */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">

          {/* ── LEFT: Source detail ── */}
          <div
            className="min-h-0 overflow-y-auto overflow-x-hidden border-r border-slate-100"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#c4b5fd transparent' }}
          >
            <SourceDetailContent
              sourceId={sourceIdWithPrefix}
              showChatButton={false}
              onClose={handleClose}
            />
          </div>

          {/* ── RIGHT: Chat panel ── */}
          <ChatPanelColumn sourceId={sourceIdWithPrefix} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Isolated so useSourceChat only runs when the dialog is open and sourceId is valid
function ChatPanelColumn({ sourceId }: { sourceId: string }) {
  const chat = useSourceChat(sourceId)
  const [isConfigOpen, setIsConfigOpen] = useState(false)

  return (
    <div className="min-h-0 flex flex-col overflow-hidden bg-white">
      {/* Chat header — same style as /sources/[id] page */}
      <div
        className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 flex-shrink-0"
        style={{ background: 'linear-gradient(90deg, #F5F3FF 0%, #EEF2FF 100%)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#6334E3] flex items-center justify-center shadow-sm">
            <MessageSquare className="h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 leading-none">Chat with Source</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 font-medium">Ask questions about this document</p>
          </div>
        </div>
        <button
          onClick={() => setIsConfigOpen(true)}
          className="p-2 hover:bg-white/70 rounded-xl transition-colors text-slate-400 hover:text-[#6334E3]"
          title="Configure chat"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      {/* Chat panel fills remaining height */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatPanel
          messages={chat.messages}
          isStreaming={chat.isStreaming}
          contextIndicators={chat.contextIndicators}
          onSendMessage={(message, model) => chat.sendMessage(message, model)}
          modelOverride={chat.currentSession?.model_override}
          onModelChange={(model) => {
            if (chat.currentSessionId) {
              chat.updateSession(chat.currentSessionId, { model_override: model })
            }
          }}
          sessions={chat.sessions}
          currentSessionId={chat.currentSessionId}
          onCreateSession={(title) => chat.createSession({ title })}
          onSelectSession={chat.switchSession}
          onUpdateSession={(sessionId, title) => chat.updateSession(sessionId, { title })}
          onDeleteSession={chat.deleteSession}
          loadingSessions={chat.loadingSessions}
          suggestedQuestions={chat.suggestedQuestions}
        />
      </div>
    </div>
  )
}
