'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useCreateNotebook } from '@/lib/hooks/use-i_Notes'
import { HardDrive, FolderPlus } from 'lucide-react'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const STORAGE_OPTIONS = [5, 10, 50] as const

interface CreateSubFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the newly-created i_Notes ID so the parent can wire it up */
  onCreated: (i_NotesId: string) => void
}

export function CreateSubFolderDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateSubFolderDialogProps) {
  const createNotebook = useCreateNotebook()
  const [storageLimitMb, setStorageLimitMb] = useState<number>(5)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { name: '', description: '' },
  })

  useEffect(() => {
    if (!open) {
      reset()
      setStorageLimitMb(5)
    }
  }, [open, reset])

  const onSubmit = async (data: FormData) => {
    const result = await createNotebook.mutateAsync({
      name: data.name,
      description: data.description,
      storage_limit_mb: storageLimitMb,
    })
    onCreated(result.id)
    onOpenChange(false)
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-[32px] p-8 border-none shadow-2xl">
        <DialogHeader className="flex flex-row items-start gap-4 space-y-0 text-left">
          <div className="w-14 h-14 rounded-[18px] bg-gradient-to-br from-[#6149f6] to-[#8b5cf6] flex items-center justify-center shadow-lg shrink-0">
            <FolderPlus className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-2xl font-bold text-slate-900 leading-tight">
              Create Sub-folder
            </DialogTitle>
            <DialogDescription className="text-slate-500 text-[15px] mt-1">
              Add a new sub-folder inside this case
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 mt-4">
          <div className="space-y-2">
            <Label htmlFor="sf-name" className="text-[14px] font-bold text-slate-700">
              Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="sf-name"
              {...register('name')}
              placeholder="e.g. IR, ICJS Dossier…"
              className="h-12 rounded-[14px] border-slate-200 bg-white px-4 focus-visible:ring-[#6149f6]"
              autoComplete="off"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sf-desc" className="text-[14px] font-bold text-slate-700">
              Description
            </Label>
            <Textarea
              id="sf-desc"
              {...register('description')}
              placeholder="Optional description…"
              rows={3}
              className="rounded-[14px] border-slate-200 bg-white p-4 focus-visible:ring-[#6149f6] resize-none"
            />
          </div>

          {/* Storage limit */}
          <div className="space-y-2">
            <Label className="text-[14px] font-bold text-slate-700 flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5 text-[#6149f6]" />
              Storage Limit <span className="text-red-500">*</span>
            </Label>
            <div className="grid grid-cols-3 gap-3">
              {STORAGE_OPTIONS.map((mb) => {
                const selected = storageLimitMb === mb
                return (
                  <button
                    key={mb}
                    type="button"
                    onClick={() => setStorageLimitMb(mb)}
                    className={cn(
                      'flex flex-col items-center justify-center rounded-[18px] border-2 h-20 transition-all duration-200',
                      selected
                        ? 'border-[#6149f6] bg-[#F5F3FF] text-[#6149f6]'
                        : 'border-slate-100 bg-white text-slate-400 hover:border-slate-200 hover:bg-slate-50',
                    )}
                  >
                    <span className="text-2xl font-bold">{mb}</span>
                    <span className="text-[12px] font-medium opacity-80 uppercase">MB</span>
                  </button>
                )
              })}
            </div>
          </div>

          <DialogFooter className="flex-row gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-12 rounded-[16px] bg-[#F8FAFC] text-slate-600 hover:bg-slate-100 font-bold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValid || createNotebook.isPending}
              className="flex-1 h-12 rounded-[16px] text-white font-bold shadow-md transition-all border-none"
              style={{
                background: 'linear-gradient(135deg, #6149f6 0%, #8b5cf6 100%)',
              }}
            >
              {createNotebook.isPending ? 'Creating…' : 'Create Sub-folder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

