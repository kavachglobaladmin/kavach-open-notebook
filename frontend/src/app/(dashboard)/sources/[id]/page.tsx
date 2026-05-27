// 'use client'
// [original commented-out code preserved as-is]

'use client'

import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Settings2 } from 'lucide-react'
import { useSourceChat } from '@/lib/hooks/useSourceChat'
import { useSource } from '@/lib/hooks/use-sources'
import { ChatPanel } from '@/components/source/ChatPanel'
import { useNavigation } from '@/lib/hooks/use-navigation'
import { SourceDetailContent } from '@/components/source/SourceDetailContent'
import { ConfigureChatModal } from '@/components/source/ConfigureChatModal'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'

export default function SourceDetailPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  // Reconstruct the full SurrealDB record ID from the short URL param.
  // The URL contains only the short ID (e.g. "abc123") to avoid colons in the
  // path which Next.js rejects. We prepend "source:" here so the API gets the
  // full record ID it expects.
  const rawParam = params?.id ? decodeURIComponent(params.id as string) : ''
  const sourceId = rawParam.includes(':') ? rawParam : (rawParam ? `source:${rawParam}` : '')
  const highlightQuery = searchParams?.get('q') || ''
  const navigation = useNavigation()

  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [chatConfig, setChatConfig] = useState({ goal: 'Default', length: 'Default' })
  const [searchTerm, setSearchTerm] = useState('')

  const chat = useSourceChat(sourceId)
  const { data: sourceData } = useSource(sourceId)

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
    //   <AppShell>
    //     {/* ── Full-page wrapper with app background ── */}
    //     <div className="flex-1 flex flex-col min-h-0 bg-[#F4F5FF] relative overflow-hidden">

    //       {/* Background ambient glows — same palette as Cases/Sources pages */}
    //       <div className="absolute top-[-15%] right-[-8%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#D9D7F1]/70 to-[#F1E9FF]/30 blur-[120px] pointer-events-none" />
    //       <div className="absolute bottom-[-10%] left-[-5%] w-[450px] h-[450px] rounded-full bg-[#E8EDFF]/50 blur-[100px] pointer-events-none" />

    //       {/* PageHeader */}
    //       <PageHeader
    //         searchValue={searchTerm}
    //         onSearchChange={(val) => setSearchTerm(val)}
    //         newLabel="NOTEBOOK"
    //       />


    //  {/* Back button row */}
    //       <div className="relative z-10 flex-shrink-0 px-6 pt-4 pb-2">
    //         <Button
    //           variant="ghost"
    //           size="sm"
    //           onClick={handleBack}
    //           className="rounded-xl font-semibold gap-1.5 text-[#6334E3] transition-all hover:bg-[#EDE9FE] hover:text-[#4f27b3]"
    //         >
    //           <ArrowLeft className="h-4 w-4" />
    //           {navigation.getReturnLabel()}
    //         </Button>
    //       </div>

    //       {/* ── Two-column content area — equal halves ── */}
    //       <div className="relative z-10 grid min-h-0 mt-30 flex-1 grid-cols-1 gap-5  px-6 pb-0 lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">


    //         {/* ── LEFT: Source detail card ── */}
    //         <div
    //           className="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden rounded-[20px] border border-white/80 bg-white shadow-[0_4px_32px_rgba(99,52,227,0.08)]"
    //           style={{ scrollbarWidth: 'thin', scrollbarColor: '#c4b5fd transparent' }}
    //         >
    //           <SourceDetailContent
    //             sourceId={sourceId}
    //             showChatButton={false}
    //             onClose={handleBack}
    //           />
    //         </div>

    //         {/* ── RIGHT: Chat panel card ── */}
    // <ChatPanel
    //   className="min-h-0 min-w-0 border-white/80 shadow-[0_4px_32px_rgba(99,52,227,0.08)]"
    //   title="Chat with Source"
    //   subtitle="Ask questions about this document"
    //   headerActions={
    //     <button
    //       onClick={() => setIsConfigOpen(true)}
    //       className="p-2 rounded-xl transition-colors text-slate-400 hover:text-[#6334E3] hover:bg-slate-50"
    //       title="Configure chat"
    //     >
    //       <Settings2 className="h-4 w-4" />
    //     </button>
    //   }
    //   messages={chat.messages}
    //   isStreaming={chat.isStreaming}
    //   contextIndicators={chat.contextIndicators}
    //   onSendMessage={handleSendMessageWithConfig}
    //   modelOverride={chat.currentSession?.model_override}
    //   onModelChange={(model) => {
    //     if (chat.currentSessionId) {
    //       chat.updateSession(chat.currentSessionId, { model_override: model })
    //     }
    //   }}
    //   sessions={chat.sessions}
    //   currentSessionId={chat.currentSessionId}
    //   onCreateSession={(title) => chat.createSession({ title })}
    //   onSelectSession={chat.switchSession}
    //   onUpdateSession={(sessionId, title) => chat.updateSession(sessionId, { title })}
    //   onDeleteSession={chat.deleteSession}
    //   loadingSessions={chat.loadingSessions}
    //   suggestedQuestions={chat.suggestedQuestions}
    // />
    //       </div>

    //       {/* Configuration Modal */}
    //       {isConfigOpen && (
    //         <ConfigureChatModal
    //           currentConfig={chatConfig}
    //           onSave={(newConfig: any) => {
    //             setChatConfig(newConfig)
    //             setIsConfigOpen(false)
    //           }}
    //           onClose={() => setIsConfigOpen(false)}
    //         />
    //       )}
    //     </div>
    //   </AppShell>
    <AppShell>
      {/* 1. Main container: stable top header + card-only scrolling */}
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#F4F5FF]">

        {/* Background ambient glows */}
        <div className="absolute top-[-15%] right-[-8%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-[#D9D7F1]/70 to-[#F1E9FF]/30 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[450px] h-[450px] rounded-full bg-[#E8EDFF]/50 blur-[100px] pointer-events-none" />

        {/* 2. Fixed Header (Non-scrollable) */}
        <div className="relative z-20 shrink-0 border-b border-white/20 bg-[#F4F5FF]/80 backdrop-blur-md">
          <PageHeader
            searchValue={searchTerm}
            onSearchChange={(val) => setSearchTerm(val)}
            newLabel="NOTEBOOK"
          />
        </div>

        {/* 3. CONTENT AREA (no page-level scroll; cards manage their own scroll) */}
        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-6 pt-4 pb-6">

          {/* Back button row */}
          <div className="shrink-0 pb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="rounded-xl font-semibold gap-1.5 text-[#6334E3] transition-all hover:bg-[#EDE9FE] hover:text-[#4f27b3]"
            >
              <ArrowLeft className="h-4 w-4" />
              {navigation.getReturnLabel()}
            </Button>
          </div>

          {/* Two-column content area */}
          <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-5 overflow-hidden lg:grid-rows-1 lg:grid-cols-[minmax(0,1.08fr)_minmax(420px,0.92fr)]">

            {/* LEFT: Source detail card */}
            <div
              className="h-full min-h-0 overflow-y-auto rounded-[20px] border border-white/80 bg-white shadow-[0_4px_32px_rgba(99,52,227,0.08)]"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#c4b5fd transparent' }}
            >
              <SourceDetailContent
                sourceId={sourceId}
                showChatButton={false}
                onClose={handleBack}
                highlightQuery={highlightQuery}
              />
            </div>

            {/* RIGHT: Chat panel */}
            <ChatPanel
              className="h-full min-h-0 min-w-0 border-white/80 shadow-[0_4px_32px_rgba(99,52,227,0.08)]"
              title="Chat with Source"
              subtitle="Ask questions about this document"
              headerActions={
                <button
                  onClick={() => setIsConfigOpen(true)}
                  className="p-2 rounded-xl transition-colors text-slate-400 hover:text-[#6334E3] hover:bg-slate-50"
                  title="Configure chat"
                >
                  <Settings2 className="h-4 w-4" />
                </button>
              }
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
              sourceTitle={sourceData?.title ?? undefined}
            />
          </div>
        </div>

        {/* Configuration Modal */}
        {isConfigOpen && (
          <ConfigureChatModal
            currentConfig={chatConfig}
            onSave={(newConfig: typeof chatConfig) => {
              setChatConfig(newConfig);
              setIsConfigOpen(false);
            }}
            onClose={() => setIsConfigOpen(false)}
          />
        )}
      </div>
    </AppShell>
  )
}
