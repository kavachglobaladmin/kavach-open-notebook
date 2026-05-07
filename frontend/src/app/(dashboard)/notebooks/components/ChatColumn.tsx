'use client'

import { useMemo } from 'react'
import { ChatPanel } from '@/components/source/ChatPanel'
import { Card, CardContent } from '@/components/ui/card'
import { MessageSquare, Clock } from 'lucide-react'
import { useTranslation } from '@/lib/hooks/use-translation'

export function ChatColumn({ notebookId, contextSelections, sources, sourcesLoading }: any) {
  const { t } = useTranslation()

  return (
    <Card className="h-full flex flex-col border-none bg-white rounded-[24px] shadow-[0_4px_25px_rgba(0,0,0,0.03)] overflow-hidden">
      <div className="p-6 flex items-center justify-between border-none">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-slate-900" />
          <h2 className="text-[18px] font-bold text-slate-900">Chat with Notebook</h2>
        </div>
        <button className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-50 border border-slate-100 text-[13px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
          <Clock className="h-4 w-4" />
          Sessions
        </button>
      </div>

      <CardContent className="flex-1 flex flex-col p-6 pt-0 min-h-[500px] lg:min-h-0">
        {/* Placeholder for Empty State shown in Image */}
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center">
            <MessageSquare className="h-8 w-8 text-slate-300" />
          </div>
          <div className="text-center">
            <h3 className="text-[16px] font-bold text-slate-900">Start a conversation about this Notebook</h3>
            <p className="text-[13px] text-slate-500 mt-1">Ask questions to understand the content better</p>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-slate-50 rounded-[16px] p-4 border border-slate-100 mb-6">
          <p className="text-[12px] text-slate-500 text-center">
            No sources or notes included in context. Toggle icons on cards to include them.
          </p>
        </div>

        {/* Input Area */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-bold text-slate-900">Model</span>
            <span className="font-semibold text-slate-600">llama-3-latest</span>
          </div>
          <div className="relative">
            <input
              className="w-full h-[52px] bg-slate-50 border border-slate-100 rounded-[16px] px-5 pr-12 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#6F4FF2]/20"
              placeholder="Ask anything about your sources... (Press Enter to send)"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 w-[36px] h-[36px] bg-[#6F4FF2] rounded-[12px] flex items-center justify-center text-white shadow-[0_4px_10px_rgba(111,79,242,0.3)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}