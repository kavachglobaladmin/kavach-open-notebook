'use client'

import { useState, useEffect, useId } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronRight } from 'lucide-react'
import { useDefaultPrompt, useUpdateDefaultPrompt } from '@/lib/hooks/use-transformations'
import { useTranslation } from '@/lib/hooks/use-translation'

export function DefaultPromptEditor() {
  const [isOpen, setIsOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const { data: defaultPrompt, isLoading } = useDefaultPrompt()
  const updateDefaultPrompt = useUpdateDefaultPrompt()
  const { t } = useTranslation()
  const textareaId = useId()

  useEffect(() => {
    if (defaultPrompt) {
      setPrompt(defaultPrompt.transformation_instructions || '')
    }
  }, [defaultPrompt])

  const handleSave = () => {
    updateDefaultPrompt.mutate({ transformation_instructions: prompt })
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      {/* Collapsible trigger row — matches reference design */}
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between w-full bg-white border border-slate-100 rounded-2xl px-6 py-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <div className="text-left">
            <p className="font-semibold text-slate-900 text-[15px]">
              {t.transformations.defaultPrompt}
            </p>
            <p className="text-slate-500 text-sm mt-0.5">
              {t.transformations.defaultPromptDesc}
            </p>
          </div>
          <ChevronRight
            className={`h-5 w-5 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
          />
        </div>
      </CollapsibleTrigger>

      {/* Expanded content */}
      <CollapsibleContent>
        <div className="bg-white border border-t-0 border-slate-100 rounded-b-2xl px-6 py-5 space-y-4 shadow-sm">
          <div className="space-y-2">
            <Label htmlFor={textareaId} className="sr-only">
              {t.transformations.defaultPrompt}
            </Label>
            <Textarea
              id={textareaId}
              name="default-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t.transformations.defaultPromptPlaceholder}
              className="min-h-[200px] font-mono text-sm border-slate-200 focus:ring-[#FF7043] focus:border-[#FF7043]"
              disabled={isLoading}
            />
          </div>
          <div className="flex justify-end">
            <Button
              onClick={handleSave}
              disabled={isLoading || updateDefaultPrompt.isPending}
              className="bg-[#FF7043] hover:bg-[#f4622e] text-white rounded-lg px-6"
            >
              {t.common.save}
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
