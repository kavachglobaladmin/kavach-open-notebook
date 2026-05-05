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
import { HardDrive } from 'lucide-react'

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
  const [storageLimitMb, setStorageLimitMb] = useState<number | null>(null)
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
    setStorageLimitMb(null)
    setStorageLimitError(null)
  }

  useEffect(() => {
    if (!open) {
      reset()
      setStorageLimitMb(null)
      setStorageLimitError(null)
    }
  }, [open, reset])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t.notebooks.createNew}</DialogTitle>
          <DialogDescription>{t.notebooks.createNewDesc}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notebook-name">{t.common.name} *</Label>
            <Input
              id="notebook-name"
              {...register('name')}
              placeholder={t.notebooks.namePlaceholder}
              autoComplete="off"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notebook-description">{t.common.description}</Label>
            <Textarea
              id="notebook-description"
              {...register('description')}
              placeholder={t.notebooks.descPlaceholder}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5" />
              {t.notebooks.storageLimitLabel} *
            </Label>
            <div className="grid grid-cols-3 gap-2">
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
                    className={[
                      'flex flex-col items-center justify-center rounded-lg border py-2.5 text-sm font-medium transition-all',
                      selected
                        ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-500'
                        : 'border-border bg-background text-muted-foreground hover:border-blue-400 hover:text-foreground',
                    ].join(' ')}
                  >
                    <span className="font-semibold">{mb}</span>
                    <span className="text-xs">MB</span>
                  </button>
                )
              })}
            </div>
            {storageLimitError ? (
              <p className="text-xs text-destructive">{storageLimitError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {storageLimitMb != null
                  ? t.notebooks.storageLimitHelperSelected.replace(
                      '{mb}',
                      String(storageLimitMb)
                    )
                  : t.notebooks.storageLimitHelper}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={closeDialog}>
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              disabled={!isValid || storageLimitMb == null || createNotebook.isPending}
            >
              {createNotebook.isPending ? t.common.creating : t.notebooks.createNew}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
