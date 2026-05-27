'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useCreateNotebook } from '@/lib/hooks/use-notebooks'
import { useTranslation } from '@/lib/hooks/use-translation'
import { HardDrive, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

const createNotebookSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
})

type CreateNotebookFormData = z.infer<typeof createNotebookSchema>

const STORAGE_OPTIONS = [5, 10, 50] as const

interface CreateNotebookDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateNotebookDialog({ open, onOpenChange }: CreateNotebookDialogProps) {
  const { t } = useTranslation()
  const createNotebook = useCreateNotebook()
  const [storageLimitMb, setStorageLimitMb] = useState<number | null>(5) // Defaulted to first option
  const [storageLimitError, setStorageLimitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
  } = useForm<CreateNotebookFormData>({
    resolver: zodResolver(createNotebookSchema),
    mode: 'onChange',
    defaultValues: { name: '', description: '' },
  })

  const closeDialog = () => onOpenChange(false)

  const onSubmit = async (data: CreateNotebookFormData) => {
    if (storageLimitMb == null) {
      setStorageLimitError(t.notebooks.storageLimitRequired)
      return
    }
    await createNotebook.mutateAsync({
      name: data.name,
      description: data.description,
      storage_limit_mb: storageLimitMb,
    })
    closeDialog()
    reset()
    setStorageLimitMb(5)
    setStorageLimitError(null)
  }

  useEffect(() => {
    if (!open) {
      reset()
      setStorageLimitMb(5)
      setStorageLimitError(null)
    }
  }, [open, reset])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] rounded-[32px] p-8 border-none shadow-2xl">
        <DialogHeader className="flex flex-row items-start gap-4 space-y-0 text-left">
          {/* Icon with Gradient Background matching reference */}
          <div className="w-14 h-14 rounded-[18px] bg-gradient-to-br from-[#7B3AED] to-[#9333EA] flex items-center justify-center shadow-lg shrink-0">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-2xl font-bold text-slate-900 leading-tight">
              {t.notebooks.createNew}
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-[15px] mt-1">
              {t.notebooks.createNewDesc}
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-4">
          <div className="space-y-2">
            <Label htmlFor="notebook-name" className="text-[14px] font-bold text-slate-700">
              {t.common.name} <span className="text-red-500">*</span>
            </Label>
            <Input
              id="notebook-name"
              {...register('name')}
              placeholder={t.notebooks.namePlaceholder}
              className="h-12 rounded-[14px] border-slate-200 bg-white px-4 focus-visible:ring-[#7B3AED]"
              autoComplete="off"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notebook-description" className="text-[14px] font-bold text-slate-700">
              {t.common.description}
            </Label>
            <Textarea
              id="notebook-description"
              {...register('description')}
              placeholder={t.notebooks.descPlaceholder}
              rows={4}
              className="rounded-[14px] border-slate-200 bg-white p-4 focus-visible:ring-[#7B3AED] resize-none"
            />
          </div>

          {/* Storage Selection Grid matching the Image UI */}
          <div className="space-y-2">
            <Label className="text-[14px] font-bold text-slate-700 flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-[#7B3AED]" />
              {t.notebooks.storageLimitLabel} <span className="text-red-500">*</span>
            </Label>
            
            <div className="grid grid-cols-3 gap-3">
              {STORAGE_OPTIONS.map((mb) => {
                const selected = storageLimitMb === mb
                return (
                  <button
                    key={mb}
                    type="button"
                    onClick={() => {
                      setStorageLimitMb(selected ? null : mb)
                      setStorageLimitError(null)
                    }}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-[18px] border-2 h-24 transition-all duration-200',
                      selected
                        ? 'border-[#7B3AED] bg-[#F5F3FF] text-[#7B3AED]'
                        : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    <span className="text-2xl font-bold">{mb}</span>
                    <span className="text-[13px] font-medium opacity-80 uppercase">MB</span>
                  </button>
                )
              })}
            </div>
            
            {storageLimitError ? (
              <p className="text-xs text-destructive mt-2">{storageLimitError}</p>
            ) : (
              <p className="text-[12px] text-slate-400 mt-2">
                {storageLimitMb != null
                  ? t.notebooks.storageLimitHelperSelected.replace('{mb}', String(storageLimitMb))
                  : t.notebooks.storageLimitHelper}
              </p>
            )}
          </div>

          <DialogFooter className="flex-row gap-3 pt-4">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={closeDialog}
              className="flex-1 h-12 rounded-[16px] bg-[#F8FAFC] text-slate-600 hover:bg-slate-100 font-bold"
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              disabled={!isValid || storageLimitMb == null || createNotebook.isPending}
              className="flex-1 h-12 rounded-[16px] bg-gradient-to-r from-[#A78BFA] to-[#C084FC] hover:opacity-90 text-white font-bold shadow-md transition-all border-none"
            >
              {createNotebook.isPending ? t.common.creating : t.notebooks.createNew}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}