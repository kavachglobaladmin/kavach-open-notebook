'use client'

import React, { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { 
  Settings2, 
  FileText, 
  Search, 
  ShieldCheck, 
  Globe,
  Loader2
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { useSettings, useUpdateSettings } from '@/lib/hooks/use-settings'
import { useTranslation } from '@/lib/hooks/use-translation'

const settingsSchema = z.object({
  default_content_processing_engine_doc: z.enum(['auto', 'docling', 'simple']).optional(),
  default_content_processing_engine_url: z.enum(['auto', 'firecrawl', 'jina', 'simple']).optional(),
  default_embedding_option: z.enum(['ask', 'always', 'never']).optional(),
  auto_delete_files: z.enum(['yes', 'no']).optional(),
  enable_notifications: z.boolean().optional(),
})

type SettingsFormData = z.infer<typeof settingsSchema>

const CustomSwitch = ({ checked, onCheckedChange }: { checked: boolean, onCheckedChange: (val: boolean) => void }) => (
  <button
    type="button"
    onClick={() => onCheckedChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
      checked ? 'bg-[#5D3FD3]' : 'bg-slate-200'
    }`}
  >
    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
  </button>
)

export function SettingsForm() {
  const { t } = useTranslation()
  const { data: settings, isLoading, error } = useSettings()
  const updateSettings = useUpdateSettings()
  const [hasResetForm, setHasResetForm] = useState(false)

  const { control, handleSubmit, reset, formState: { isDirty } } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      default_content_processing_engine_doc: undefined,
      default_content_processing_engine_url: undefined,
      default_embedding_option: undefined,
      auto_delete_files: undefined,
      enable_notifications: true
    }
  })

  useEffect(() => {
    if (settings && !hasResetForm) {
      reset({
        default_content_processing_engine_doc: settings.default_content_processing_engine_doc as any,
        default_content_processing_engine_url: settings.default_content_processing_engine_url as any,
        default_embedding_option: settings.default_embedding_option as any,
        auto_delete_files: settings.auto_delete_files as any,
        enable_notifications: true
      })
      setHasResetForm(true)
    }
  }, [hasResetForm, reset, settings])

  const onSubmit = async (data: SettingsFormData) => {
    await updateSettings.mutateAsync(data)
  }

  if (isLoading) return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
  if (error) return (
    <Alert variant="destructive">
      <AlertTitle>{t.settings.loadFailed}</AlertTitle>
      <AlertDescription>{error instanceof Error ? error.message : t.common.error}</AlertDescription>
    </Alert>
  )

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Document Engine Field */}
        <ConfigCard 
          icon={<Settings2 className="w-6 h-6 text-white" />} 
          iconBg="bg-blue-600" 
          title={t.settings.docEngine} 
          description={t.settings.docHelp}
        >
          <Controller
            name="default_content_processing_engine_doc"
            control={control}
            render={({ field }) => (
              <Select key={field.value} value={field.value || ''} onValueChange={field.onChange}>
                <SelectTrigger className="border-slate-100 bg-slate-50/50">
                  <SelectValue placeholder={t.settings.docEnginePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{t.settings.autoRecommended}</SelectItem>
                  <SelectItem value="docling">{t.settings.docling}</SelectItem>
                  <SelectItem value="simple">{t.settings.simple}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </ConfigCard>

        {/* URL Engine Field */}
        <ConfigCard 
          icon={<Globe className="w-6 h-6 text-white" />} 
          iconBg="bg-fuchsia-600" 
          title={t.settings.urlEngine} 
          description={t.settings.urlHelp}
        >
          <Controller
            name="default_content_processing_engine_url"
            control={control}
            render={({ field }) => (
              <Select key={field.value} value={field.value || ''} onValueChange={field.onChange}>
                <SelectTrigger className="border-slate-100 bg-slate-50/50">
                  <SelectValue placeholder={t.settings.urlEnginePlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">{t.settings.autoRecommended}</SelectItem>
                  <SelectItem value="firecrawl">{t.settings.firecrawl}</SelectItem>
                  <SelectItem value="jina">{t.settings.jina}</SelectItem>
                  <SelectItem value="simple">{t.settings.simple}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </ConfigCard>

        {/* Embedding Option Field */}
        <ConfigCard 
          icon={<Search className="w-6 h-6 text-white" />} 
          iconBg="bg-emerald-500" 
          title={t.settings.defaultEmbeddingOption} 
          description={t.settings.embeddingHelp}
        >
          <Controller
            name="default_embedding_option"
            control={control}
            render={({ field }) => (
              <Select key={field.value} value={field.value || ''} onValueChange={field.onChange}>
                <SelectTrigger className="border-slate-100 bg-slate-50/50">
                  <SelectValue placeholder={t.settings.embeddingOptionPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ask">{t.settings.ask}</SelectItem>
                  <SelectItem value="always">{t.settings.always}</SelectItem>
                  <SelectItem value="never">{t.settings.never}</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </ConfigCard>

        {/* Security / Privacy Placeholder to match 2-column layout */}
        <ConfigCard 
          icon={<ShieldCheck className="w-6 h-6 text-white" />} 
          iconBg="bg-purple-500" 
          title="Privacy Settings" 
          description="Manage your data encryption and privacy preferences"
        >
          <div className="text-xs text-slate-400 font-medium py-2 italic">Standard encryption enabled</div>
        </ConfigCard>
      </div>

      {/* Quick Settings Section for Boolean Toggles */}
      <div className="bg-white/60 backdrop-blur-xl border border-white rounded-[32px] p-8 shadow-sm">
        <div className="flex items-center space-x-4 mb-8">
          <div className="bg-[#5D3FD3] p-3 rounded-2xl shadow-lg shadow-indigo-100">
            <Globe className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-xl">Quick Settings</h3>
            <p className="text-slate-500 text-sm font-medium">Frequently used settings for quick access</p>
          </div>
        </div>
        <div className="space-y-4">
          <QuickToggle label={t.settings.autoDeleteFiles} sublabel="Automatically save changes" name="auto_delete_files" control={control} />
          <QuickToggle label="Enable notifications" sublabel="Get updates on important events" name="enable_notifications" control={control} />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={!isDirty || updateSettings.isPending} className="bg-[#5D3FD3] hover:bg-[#4b32ac] text-white px-8 h-12 rounded-xl text-lg transition-all">
          {updateSettings.isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
          {updateSettings.isPending ? t.common.saving : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}

function ConfigCard({ icon, iconBg, title, description, children }: { icon: React.ReactNode, iconBg: string, title: string, description: string, children: React.ReactNode }) {
  return (
    <motion.div whileHover={{ y: -4 }} className="flex flex-col p-6 bg-white/80 backdrop-blur-md border border-white rounded-[24px] shadow-sm transition-all">
      <div className="flex items-start space-x-5 mb-4">
        <div className={`${iconBg} p-3 rounded-2xl shadow-lg shadow-gray-100 shrink-0`}>{icon}</div>
        <div className="space-y-1">
          <h3 className="font-bold text-slate-800 text-lg leading-tight">{title}</h3>
          <p className="text-slate-400 text-xs leading-relaxed">{description}</p>
        </div>
      </div>
      <div className="mt-auto">{children}</div>
    </motion.div>
  )
}

function QuickToggle({ label, sublabel, name, control }: { label: string, sublabel: string, name: any, control: any }) {
  return (
    <div className="flex items-center justify-between p-5 bg-white/50 rounded-2xl border border-slate-100/50">
      <div className="space-y-0.5">
        <p className="font-bold text-slate-700">{label}</p>
        <p className="text-xs text-slate-400 font-medium">{sublabel}</p>
      </div>
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <CustomSwitch 
            checked={name === 'auto_delete_files' ? field.value === 'yes' : !!field.value}
            onCheckedChange={(checked) => field.onChange(name === 'auto_delete_files' ? (checked ? 'yes' : 'no') : checked)}
          />
        )}
      />
    </div>
  )
}