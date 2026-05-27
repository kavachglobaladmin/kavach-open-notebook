'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'
import { Transformation } from '@/lib/types/transformations'
import { useExecuteTransformation } from '@/lib/hooks/use-transformations'
import { useTranslation } from '@/lib/hooks/use-translation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface TransformationPlaygroundProps {
  transformations: Transformation[] | undefined
  selectedTransformation?: Transformation
}

export function TransformationPlayground({ transformations, selectedTransformation }: TransformationPlaygroundProps) {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState(selectedTransformation?.id || '')
  const [inputText, setInputText] = useState('')
  const [output, setOutput] = useState('')

  const executeTransformation = useExecuteTransformation()

  const handleExecute = async () => {
    if (!selectedId || !inputText.trim()) return

    const result = await executeTransformation.mutateAsync({
      transformation_id: selectedId,
      input_text: inputText,
      model_id: '',
    })

    setOutput(result.output)
  }

  const canExecute = selectedId && inputText.trim() && !executeTransformation.isPending

  return (
    <div className="space-y-6">
      {/* Page-level heading — centered, matches reference */}
      <div className="text-center py-6">
        <h2 className="text-3xl font-bold text-slate-900">{t.transformations.playground}</h2>
        <p className="text-slate-500 mt-2 text-sm max-w-xl mx-auto">{t.transformations.desc}</p>
      </div>

      {/* Main playground card */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
        {/* Input area — large textarea at top */}
        <div className="p-6 border-b border-slate-100">
          <textarea
            id="input"
            name="input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t.transformations.inputPlaceholder}
            rows={5}
            className="w-full resize-none text-slate-800 text-[15px] placeholder:text-slate-400 focus:outline-none bg-transparent font-medium leading-relaxed"
          />
        </div>

        {/* Controls row — Transformation dropdown + RUN button */}
        <div className="px-6 py-4 flex items-center gap-4 flex-wrap">
          {/* Transformation selector */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              {t.navigation.transformation}
            </label>
            <Select name="transformation" value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger
                id="transformation"
                className="h-9 text-sm rounded-lg border-slate-200 focus:ring-[#FF7043] focus:border-[#FF7043] min-w-[160px]"
              >
                <SelectValue placeholder={t.transformations.selectToStart} />
              </SelectTrigger>
              <SelectContent>
                {transformations?.map((transformation) => (
                  <SelectItem key={transformation.id} value={transformation.id}>
                    {transformation.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* RUN TRANSFORMATION button */}
          <button
            type="button"
            onClick={handleExecute}
            disabled={!canExecute}
            className="px-6 py-2.5 rounded-lg bg-[#FF7043] hover:bg-[#f4622e] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold uppercase tracking-wide transition-colors flex items-center gap-2 shadow-sm"
          >
            {executeTransformation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t.transformations.running}
              </>
            ) : (
              t.transformations.runTest
            )}
          </button>
        </div>
      </div>

      {/* Output area — shown when result is available */}
      {output && (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-700">{t.transformations.outputLabel}</p>
          </div>
          <ScrollArea className="h-[400px]">
            <div className="p-6">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
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
                  {output}
                </ReactMarkdown>
              </div>
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
