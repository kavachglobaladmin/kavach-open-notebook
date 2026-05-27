'use client'

import { useEffect, useId } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { MarkdownEditor } from '@/components/ui/markdown-editor'
import { useCreateTransformation, useUpdateTransformation, useTransformation } from '@/lib/hooks/use-transformations'
import { Transformation } from '@/lib/types/transformations'
import { useQueryClient } from '@tanstack/react-query'
import { TRANSFORMATION_QUERY_KEYS } from '@/lib/hooks/use-transformations'
import { useTranslation } from '@/lib/hooks/use-translation'

const transformationSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  prompt: z.string().min(1),
  apply_default: z.boolean().optional(),
})

type TransformationFormData = z.infer<typeof transformationSchema>

interface TransformationEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transformation?: Transformation
}

export function TransformationEditorDialog({ open, onOpenChange, transformation }: TransformationEditorDialogProps) {
  const { t } = useTranslation()
  const nameId = useId()
  const titleId = useId()
  const defaultId = useId()
  const descriptionId = useId()
  const promptId = useId()
  const isEditing = Boolean(transformation)
  const { data: fetchedTransformation, isLoading } = useTransformation(transformation?.id ?? '', {
    enabled: open && Boolean(transformation?.id),
  })
  const createTransformation = useCreateTransformation()
  const updateTransformation = useUpdateTransformation()
  const queryClient = useQueryClient()

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TransformationFormData>({
    resolver: zodResolver(transformationSchema),
    defaultValues: {
      name: '',
      title: '',
      description: '',
      prompt: '',
      apply_default: false,
    },
  })

  useEffect(() => {
    if (!open) {
      reset({ name: '', title: '', description: '', prompt: '', apply_default: false })
      return
    }

    const source = fetchedTransformation ?? transformation
    reset({
      name: source?.name ?? '',
      title: source?.title ?? '',
      description: source?.description ?? '',
      prompt: source?.prompt ?? '',
      apply_default: source?.apply_default ?? false,
    })
  }, [open, transformation, fetchedTransformation, reset])

  const onSubmit = async (data: TransformationFormData) => {
    if (transformation) {
      await updateTransformation.mutateAsync({
        id: transformation.id,
        data: {
          name: data.name,
          title: data.title || undefined,
          description: data.description || undefined,
          prompt: data.prompt,
          apply_default: Boolean(data.apply_default),
        },
      })
      queryClient.invalidateQueries({ queryKey: TRANSFORMATION_QUERY_KEYS.transformation(transformation.id) })
    } else {
      await createTransformation.mutateAsync({
        name: data.name,
        title: data.title || data.name,
        description: data.description || '',
        prompt: data.prompt,
        apply_default: Boolean(data.apply_default),
      })
    }

    reset()
    onOpenChange(false)
  }

  const handleClose = () => {
    reset()
    onOpenChange(false)
  }

  const isSaving = transformation ? updateTransformation.isPending : createTransformation.isPending

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl w-full max-h-[90vh] overflow-hidden p-0 rounded-[24px] border-0 shadow-2xl flex flex-col">
        <DialogTitle className="sr-only">
          {isEditing ? t.common.edit : t.transformations.createNew}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {isEditing ? t.common.editTransformation : t.transformations.createNew}
        </DialogDescription>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col min-h-0 flex-1">
          {isEditing && isLoading ? (
            <div className="flex-1 flex items-center justify-center py-10">
              <span className="text-sm text-muted-foreground">{t.common.loading}</span>
            </div>
          ) : (
            <>
              {/* ── Themed header ── */}
              <div
                className="px-7 py-5 flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, #EEF0FB 0%, #E8E4F5 50%, #EBF0FB 100%)',
                  borderBottom: '1px solid #E2E8F0',
                }}
              >
                <h2 className="text-[20px] font-extrabold text-[#5B21B6] leading-tight">
                  {isEditing ? t.common.edit : t.transformations.createNew}
                </h2>
                <p className="text-[13px] text-slate-500 font-medium mt-0.5">
                  {isEditing
                    ? 'Update the transformation details and prompt below.'
                    : 'Define a new transformation with a name, title, and system prompt.'}
                </p>
              </div>

              {/* ── Fields ── */}
              <div className="px-7 py-5 space-y-5 border-b border-slate-100 flex-shrink-0 bg-white">
                {/* Name */}
                <div className="space-y-1.5">
                  <Label htmlFor={nameId} className="text-[13px] font-bold text-slate-700">
                    {t.transformations.name}
                  </Label>
                  <Controller
                    control={control}
                    name="name"
                    render={({ field }) => (
                      <Input
                        id={nameId}
                        {...field}
                        placeholder={t.transformations.namePlaceholder}
                        autoComplete="off"
                        className="h-[42px] rounded-xl border-slate-200 focus-visible:ring-[#8B5CF6] focus-visible:border-[#8B5CF6] text-slate-900 placeholder:text-slate-400"
                      />
                    )}
                  />
                  {errors.name && (
                    <p className="text-xs text-red-500 font-medium mt-1">{errors.name.message}</p>
                  )}
                </div>

                {/* Title + Apply Default */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor={titleId} className="text-[13px] font-bold text-slate-700">
                      {t.common.title}
                    </Label>
                    <Controller
                      control={control}
                      name="title"
                      render={({ field }) => (
                        <Input
                          id={titleId}
                          {...field}
                          placeholder={t.transformations.titlePlaceholder}
                          autoComplete="off"
                          className="h-[42px] rounded-xl border-slate-200 focus-visible:ring-[#8B5CF6] focus-visible:border-[#8B5CF6] text-slate-900 placeholder:text-slate-400"
                        />
                      )}
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-6 md:pt-7">
                    <Controller
                      control={control}
                      name="apply_default"
                      render={({ field }) => (
                        <Checkbox
                          id={defaultId}
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                          className="border-[#8B5CF6] data-[state=checked]:bg-[#8B5CF6] data-[state=checked]:border-[#8B5CF6]"
                        />
                      )}
                    />
                    <Label htmlFor={defaultId} className="text-[13px] font-semibold text-slate-600 cursor-pointer">
                      {t.transformations.suggestDefault}
                    </Label>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label htmlFor={descriptionId} className="text-[13px] font-bold text-slate-700">
                    {t.notebooks.addDescription.replace('...', '')}
                  </Label>
                  <Controller
                    control={control}
                    name="description"
                    render={({ field }) => (
                      <Textarea
                        id={descriptionId}
                        {...field}
                        placeholder={t.transformations.descriptionPlaceholder}
                        rows={2}
                        autoComplete="off"
                        className="rounded-xl border-slate-200 focus-visible:ring-[#8B5CF6] focus-visible:border-[#8B5CF6] text-slate-900 placeholder:text-slate-400 resize-none"
                      />
                    )}
                  />
                </div>
              </div>

              {/* ── Prompt editor ── */}
              <div className="flex-1 overflow-y-auto px-7 py-5 bg-white">
                <Label htmlFor={promptId} className="text-[13px] font-bold text-slate-700">
                  {t.transformations.systemPrompt}
                </Label>
                <div className="mt-1.5">
                  <Controller
                    control={control}
                    name="prompt"
                    render={({ field }) => (
                      <MarkdownEditor
                        key={transformation?.id ?? 'new-transformation'}
                        value={field.value}
                        onChange={field.onChange}
                        height={260}
                        placeholder={t.transformations.promptPlaceholder}
                        className="rounded-xl border border-slate-200"
                        textareaId={promptId}
                        name={field.name}
                      />
                    )}
                  />
                </div>
                {errors.prompt && (
                  <p className="text-xs text-red-500 font-medium mt-1">{errors.prompt.message}</p>
                )}
                <p className="text-xs text-slate-400 font-medium mt-2">
                  {t.transformations.promptHint}
                </p>
              </div>
            </>
          )}

          {/* ── Footer buttons — themed ── */}
          <div
            className="flex-shrink-0 px-7 py-4 flex justify-end gap-3 bg-white"
            style={{ borderTop: '1px solid #F1F5F9' }}
          >
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 rounded-xl text-[13px] font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={isSaving || (isEditing && isLoading)}
              className="px-6 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
              style={{
                background: 'linear-gradient(90deg, #5B21B6 0%, #7C3AED 100%)',
                boxShadow: '0 4px 14px 0 rgba(109,40,217,0.28)',
              }}
            >
              {isSaving
                ? isEditing ? `${t.common.saving}...` : `${t.common.creating}...`
                : isEditing
                  ? t.common.saveChanges
                  : t.transformations.createNew}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
