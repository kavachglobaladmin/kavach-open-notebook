// 'use client'
// [original commented-out code preserved as-is]

'use client'

import { useRouter, useParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Settings2, MessageSquare } from 'lucide-react'
import { useSourceChat } from '@/lib/hooks/useSourceChat'
import { ChatPanel } from '@/components/source/ChatPanel'
import { useNavigation } from '@/lib/hooks/use-navigation'
import { SourceDetailContent } from '@/components/source/SourceDetailContent'
import { ConfigureChatModal } from '@/components/source/ConfigureChatModal'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'

export default function SourceDetailPage() {
  const router = useRouter()
  const params = useParams()
  // Reconstruct the full SurrealDB record ID from the short URL param.
  // The URL contains only the short ID (e.g. "abc123") to avoid colons in the
  // path which Next.js rejects. We prepend "source:" here so the API gets the
  // full record ID it expects.
  const rawParam = params?.id ? decodeURIComponent(params.id as string) : ''
  const sourceId = rawParam.includes(':') ? rawParam : (rawParam ? `source:${rawParam}` : '')
  const navigation = useNavigation()

  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [chatConfig, setChatConfig] = useState({ goal: 'Default', length: 'Default' })
  const [searchTerm, setSearchTerm] = useState('')

  const chat = useSourceChat(sourceId)

  const handleBack = useCallback(() => {
    const returnPath = navigation.getReturnPath()
    router.push(returnPath)
    navigation.clearReturnTo()
  }, [navigation, router])

  const handleSendMessageWithConfig = (message: string, model?: string) => {
    const configContext = `[Style: ${chatConfig.goal}, Length: ${chatConfig.length}] `
    const cleanMessage = message.replace(configContext, '')
    chat.sendMessage(cleanMessage, model)
  }

  return (
    <AppShell>
      {/* ── Full-page wrapper with app background ── */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#F4F5FF] relative overflow-hidden">

        {/* Background ambient glows — same palette as Cases/Sources pages */}
        <div className="absolute top-[-15%] right-[-8%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#D9D7F1]/70 to-[#F1E9FF]/30 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[450px] h-[450px] rounded-full bg-[#E8EDFF]/50 blur-[100px] pointer-events-none" />

        {/* PageHeader */}
        <PageHeader
          searchValue={searchTerm}
          onSearchChange={(val) => setSearchTerm(val)}
          newLabel="NOTEBOOK"
        />

        {/* Back button row */}
        <div className="flex-shrink-0 px-6 pt-4 pb-2 relative z-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="text-[#6334E3] hover:text-[#4f27b3] hover:bg-[#EDE9FE] rounded-xl font-semibold gap-1.5 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            {navigation.getReturnLabel()}
          </Button>
        </div>

        {/* ── Two-column content area — equal halves ── */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-5 px-6 pb-6 relative z-10 overflow-hidden">

          {/* ── LEFT: Source detail card ── */}
          <div
            className="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden rounded-[20px] bg-white border border-white/80 shadow-[0_4px_32px_rgba(99,52,227,0.08)]"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#c4b5fd transparent' }}
          >
            <SourceDetailContent
              sourceId={sourceId}
              showChatButton={false}
              onClose={handleBack}
            />
          </div>

          {/* ── RIGHT: Chat panel card ── */}
          <div className="min-h-0 min-w-0 flex flex-col rounded-[20px] bg-white border border-white/80 shadow-[0_4px_32px_rgba(99,52,227,0.08)] overflow-hidden">

            {/* Chat card header */}
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
                onSendMessage={handleSendMessageWithConfig}
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
        </div>

        {/* Configuration Modal */}
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
      </div>
    </AppShell>
  )
}
