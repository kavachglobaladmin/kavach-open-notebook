'use client'

import { useMemo, useState, useEffect, useId } from 'react'
import { useForm } from 'react-hook-form'
import { AppShell } from '@/components/layout/AppShell'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  RefreshCw,
  Key,
  ShieldAlert,
  Plus,
  Edit,
  Trash2,
  Plug,
  Loader2,
  Check,
  X,
  AlertCircle,
  Wand2,
  MessageSquare,
  Code,
  Mic,
  Volume2,
  Bot,
  MoreVertical,
  Search,
} from 'lucide-react'
import { useTranslation } from '@/lib/hooks/use-translation'
import { useModels, useDeleteModel, useModelDefaults, useUpdateModelDefaults, useAutoAssignDefaults, useTestModel } from '@/lib/hooks/use-models'
import {
  useCredentials,
  useCredential,
  useCredentialStatus,
  useEnvStatus,
  useCreateCredential,
  useUpdateCredential,
  useDeleteCredential,
  useTestCredential,
  useDiscoverModels,
  useRegisterModels,
} from '@/lib/hooks/use-credentials'
import { Credential, CreateCredentialRequest, UpdateCredentialRequest, DiscoveredModel } from '@/lib/api/credentials'
import { Model, ModelDefaults } from '@/lib/types/models'
import { MigrationBanner, ModelTestResultDialog } from '@/components/settings'
import { EmbeddingModelChangeDialog } from '@/components/settings/EmbeddingModelChangeDialog'
import { PageHeader } from '@/components/layout/PageHeader'
import { cn } from '@/lib/utils'

type ModelType = 'language' | 'embedding' | 'text_to_speech' | 'speech_to_text'

// Provider display names
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google AI',
  groq: 'Groq',
  mistral: 'Mistral AI',
  deepseek: 'DeepSeek',
  xai: 'xAI (Grok)',
  openrouter: 'OpenRouter',
  voyage: 'Voyage AI',
  elevenlabs: 'ElevenLabs',
  ollama: 'Ollama',
  azure: 'Azure OpenAI',
  vertex: 'Google Vertex AI',
  openai_compatible: 'OpenAI Compatible',
}

// All providers in display order
const ALL_PROVIDERS = [
  'openai', 'anthropic', 'google', 'groq', 'mistral', 'deepseek',
  'xai', 'openrouter', 'voyage', 'elevenlabs', 'ollama',
  'azure', 'vertex', 'openai_compatible',
]

// Default modalities per provider
const PROVIDER_MODALITIES: Record<string, ModelType[]> = {
  openai: ['language', 'embedding', 'text_to_speech', 'speech_to_text'],
  anthropic: ['language'],
  google: ['language', 'embedding', 'text_to_speech', 'speech_to_text'],
  groq: ['language', 'speech_to_text'],
  mistral: ['language', 'embedding'],
  deepseek: ['language'],
  xai: ['language'],
  openrouter: ['language', 'embedding'],
  voyage: ['embedding'],
  elevenlabs: ['text_to_speech', 'speech_to_text'],
  ollama: ['language', 'embedding'],
  azure: ['language', 'embedding', 'text_to_speech', 'speech_to_text'],
  vertex: ['language', 'embedding', 'text_to_speech'],
  openai_compatible: ['language', 'embedding', 'text_to_speech', 'speech_to_text'],
}

// Documentation links
const PROVIDER_DOCS: Record<string, string> = {
  openai: 'https://platform.openai.com/api-keys',
  anthropic: 'https://console.anthropic.com/settings/keys',
  google: 'https://aistudio.google.com/app/apikey',
  groq: 'https://console.groq.com/keys',
  mistral: 'https://console.mistral.ai/api-keys/',
  deepseek: 'https://platform.deepseek.com/api_keys',
  xai: 'https://console.x.ai/',
  openrouter: 'https://openrouter.ai/keys',
  voyage: 'https://dash.voyageai.com/api-keys',
  elevenlabs: 'https://elevenlabs.io/app/settings/api-keys',
  azure: 'https://portal.azure.com/#view/Microsoft_Azure_ProjectOxford/CognitiveServicesHub/~/OpenAI',
  vertex: 'https://cloud.google.com/vertex-ai/docs/start/cloud-environment',
  openai_compatible: 'https://github.com/lfnovo/open-notebook/blob/main/docs/5-CONFIGURATION/openai-compatible.md',
}

const TYPE_ICONS: Record<ModelType, React.ReactNode> = {
  language: <MessageSquare className="h-4 w-4" />,
  embedding: <Code className="h-4 w-4" />,
  text_to_speech: <Volume2 className="h-4 w-4" />,
  speech_to_text: <Mic className="h-4 w-4" />,
}

const TYPE_COLORS: Record<ModelType, string> = {
  language: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  embedding: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  text_to_speech: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  speech_to_text: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
}

const TYPE_COLOR_INACTIVE = 'bg-muted text-muted-foreground opacity-50'

const TYPE_LABELS: Record<ModelType, string> = {
  language: 'Language',
  embedding: 'Embedding',
  text_to_speech: 'TTS',
  speech_to_text: 'STT',
}

// Helpers for Mock metrics matching mockups
const getModelAccuracy = (modelName: string) => {
  const name = modelName.toLowerCase()
  if (name.includes('gpt-4') || name.includes('opus')) return '98.6%'
  if (name.includes('sonnet') || name.includes('pro')) return '97.2%'
  if (name.includes('flash') || name.includes('haiku') || name.includes('mini')) return '95.4%'
  if (name.includes('deepseek')) return '97.8%'
  if (name.includes('embed')) return '94.2%'
  return '93.6%'
}

const getModelVersion = (modelName: string) => {
  const name = modelName.toLowerCase()
  if (name.includes('preview')) return '1.2.0'
  if (name.includes('v3') || name.includes('3.5')) return '3.5.2'
  if (name.includes('v4') || name.includes('gpt-4')) return '4.0.0'
  return '1.0.0'
}

const getModelTypeLabel = (type: string) => {
  if (type === 'language') return 'Large Language Model'
  if (type === 'embedding') return 'Vector Embedding'
  if (type === 'text_to_speech') return 'Text-To-Speech'
  if (type === 'speech_to_text') return 'Speech-To-Text'
  return 'AI Model'
}

const getModelApiCalls = (modelName: string) => {
  let hash = 0
  for (let i = 0; i < modelName.length; i++) {
    hash = modelName.charCodeAt(i) + ((hash << 5) - hash)
  }
  const calls = Math.abs(hash % 15000) + 1200
  return calls.toLocaleString()
}

const getModelCost = (modelName: string) => {
  let hash = 0
  for (let i = 0; i < modelName.length; i++) {
    hash = modelName.charCodeAt(i) + ((hash << 5) - hash)
  }
  const cost = Math.abs(hash % 900) + 45
  return `$${cost}`
}

const getModelLastUsed = (modelName: string) => {
  const mins = (modelName.length * 3) % 55 + 2
  if (mins < 60) return `${mins} mins ago`
  return `${Math.floor(mins / 60)} hours ago`
}

// =============================================================================
// Credential Form Dialog
// =============================================================================

function CredentialFormDialog({
  open,
  onOpenChange,
  provider,
  credential,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: string
  credential?: Credential | null
}) {
  const { t } = useTranslation()
  const createCredential = useCreateCredential()
  const updateCredential = useUpdateCredential()
  const isEditing = !!credential
  const isSubmitting = createCredential.isPending || updateCredential.isPending

  const isVertex = provider === 'vertex'
  const isOllama = provider === 'ollama'
  const isOpenAICompatible = provider === 'openai_compatible'
  const requiresApiKey = !isVertex && !isOllama && !isOpenAICompatible

  const [name, setName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [project, setProject] = useState('')
  const [location, setLocation] = useState('')
  const [credentialsPath, setCredentialsPath] = useState('')
  const [modalities, setModalities] = useState<string[]>([])

  useEffect(() => {
    if (credential) {
      setName(credential.name || '')
      setBaseUrl(credential.base_url || '')
      setApiKey('')
      setProject(credential.project || '')
      setLocation(credential.location || '')
      setCredentialsPath(credential.credentials_path || '')
      setModalities(credential.modalities || [])
    } else {
      setName('')
      setBaseUrl('')
      setApiKey('')
      setProject('')
      setLocation('')
      setCredentialsPath('')
      setModalities(PROVIDER_MODALITIES[provider] || ['language'])
    }
  }, [credential, provider])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const onSuccess = () => {
      onOpenChange(false)
    }

    if (isEditing && credential) {
      const data: UpdateCredentialRequest = {}
      if (name !== credential.name) data.name = name
      if (apiKey.trim()) data.api_key = apiKey.trim()
      if (baseUrl !== (credential.base_url || '')) data.base_url = baseUrl || undefined
      if (JSON.stringify(modalities) !== JSON.stringify(credential.modalities)) data.modalities = modalities
      if (isVertex) {
        if (project !== (credential.project || '')) data.project = project.trim() || undefined
        if (location !== (credential.location || '')) data.location = location.trim() || undefined
        if (credentialsPath !== (credential.credentials_path || '')) data.credentials_path = credentialsPath.trim() || undefined
      }
      updateCredential.mutate({ credentialId: credential.id, data }, { onSuccess })
    } else {
      const data: CreateCredentialRequest = {
        name: name || `${PROVIDER_DISPLAY_NAMES[provider] || provider} Config`,
        provider,
        modalities,
        api_key: apiKey.trim() || undefined,
        base_url: baseUrl || undefined,
      }
      if (isVertex) {
        data.project = project.trim() || undefined
        data.location = location.trim() || undefined
        data.credentials_path = credentialsPath.trim() || undefined
      }
      createCredential.mutate(data, { onSuccess })
    }
  }

  const isValid = isEditing
    ? true
    : isVertex
      ? name.trim() !== '' && project.trim() !== '' && location.trim() !== ''
      : name.trim() !== '' && (!requiresApiKey || apiKey.trim() !== '')

  const docsUrl = PROVIDER_DOCS[provider]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t.apiKeys.editConfig.replace('{provider}', PROVIDER_DISPLAY_NAMES[provider] || provider)
              : t.apiKeys.addConfig.replace('{provider}', PROVIDER_DISPLAY_NAMES[provider] || provider)}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 text-left">
            <Label htmlFor="cred-name">{t.apiKeys.configName}</Label>
            <input
              id="cred-name"
              className="flex h-10 w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${PROVIDER_DISPLAY_NAMES[provider] || provider} Production`}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">{t.apiKeys.configNameHint}</p>
          </div>

          {isVertex ? (
            <>
              <div className="space-y-2 text-left">
                <Label htmlFor="vertex-project">{t.apiKeys.vertexProject}</Label>
                <input
                  id="vertex-project"
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  value={project}
                  onChange={(e) => setProject(e.target.value)}
                  placeholder="my-gcp-project"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="vertex-location">{t.apiKeys.vertexLocation}</Label>
                <input
                  id="vertex-location"
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="us-central1"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="vertex-creds">
                  {t.apiKeys.vertexCredentials}
                  <span className="text-muted-foreground font-normal ml-1">({t.common.optional})</span>
                </Label>
                <input
                  id="vertex-creds"
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  value={credentialsPath}
                  onChange={(e) => setCredentialsPath(e.target.value)}
                  placeholder="/path/to/service-account.json"
                  disabled={isSubmitting}
                />
              </div>
            </>
          ) : (
            <div className="space-y-2 text-left">
              <Label htmlFor="api-key">
                {t.models.apiKey}
                {!requiresApiKey && <span className="text-muted-foreground font-normal ml-1">({t.common.optional})</span>}
              </Label>
              <div className="relative">
                <input
                  id="api-key"
                  type={showApiKey ? 'text' : 'password'}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm pr-10 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={isEditing ? '••••••••••••' : 'sk-...'}
                  disabled={isSubmitting}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                  tabIndex={-1}
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              {isEditing && <p className="text-xs text-muted-foreground">{t.apiKeys.apiKeyEditHint}</p>}
              {docsUrl && (
                <a href={docsUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                  {t.apiKeys.getApiKey} &rarr;
                </a>
              )}
            </div>
          )}

          {!isVertex && (
            <div className="space-y-2 text-left">
              <Label htmlFor="base-url" className="text-muted-foreground">{t.apiKeys.baseUrl}</Label>
              <input
                id="base-url"
                type="url"
                className="flex h-10 w-full rounded-md border border-slate-200 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={isOllama ? 'http://localhost:11434' : 'https://api.example.com/v1'}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">{t.apiKeys.baseUrlOverrideHint}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isEditing ? t.common.save : t.apiKeys.addConfig}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// Model Discovery Dialog
// =============================================================================

function DiscoverModelsDialog({
  open,
  onOpenChange,
  credential,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  credential: Credential
}) {
  const { t } = useTranslation()
  const discoverModels = useDiscoverModels()
  const registerModels = useRegisterModels()
  const [discoveredModels, setDiscoveredModels] = useState<DiscoveredModel[]>([])
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set())
  const [hasDiscovered, setHasDiscovered] = useState(false)
  const [discoveryError, setDiscoveryError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [customModelSelected, setCustomModelSelected] = useState(false)
  const [selectedType, setSelectedType] = useState<ModelType>(
    (credential.modalities[0] as ModelType) || 'language'
  )

  useEffect(() => {
    if (open && !hasDiscovered) {
      setDiscoveryError(null)
      discoverModels.mutate(credential.id, {
        onSuccess: (result) => {
          const seen = new Set<string>()
          const unique = result.discovered.filter(m => {
            if (seen.has(m.name)) return false
            seen.add(m.name)
            return true
          })
          setDiscoveredModels(unique)
          setSelectedModels(new Set())
          setHasDiscovered(true)
        },
        onError: (error: unknown) => {
          setHasDiscovered(true)
          const msg = error instanceof Error ? error.message : String(error)
          setDiscoveryError(msg)
        },
      })
    }
    if (!open) {
      setHasDiscovered(false)
      setDiscoveredModels([])
      setSelectedModels(new Set())
      setDiscoveryError(null)
      setSearchQuery('')
      setCustomModelSelected(false)
      setSelectedType((credential.modalities[0] as ModelType) || 'language')
    }
  }, [open])

  useEffect(() => {
    setCustomModelSelected(false)
  }, [searchQuery])

  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return discoveredModels
    const q = searchQuery.toLowerCase()
    return discoveredModels.filter(m => m.name.toLowerCase().includes(q))
  }, [discoveredModels, searchQuery])

  const showCustomOption = useMemo(() => {
    if (!searchQuery.trim()) return false
    const q = searchQuery.trim().toLowerCase()
    return !discoveredModels.some(m => m.name.toLowerCase() === q)
  }, [discoveredModels, searchQuery])

  const handleRegister = () => {
    const selected = discoveredModels
      .filter(m => selectedModels.has(m.name))
      .map(m => ({
        name: m.name,
        provider: m.provider,
        model_type: selectedType,
      }))
    if (customModelSelected && showCustomOption) {
      selected.push({
        name: searchQuery.trim(),
        provider: credential.provider,
        model_type: selectedType,
      })
    }
    registerModels.mutate(
      { credentialId: credential.id, models: selected },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  const totalSelected = selectedModels.size + (customModelSelected && showCustomOption ? 1 : 0)

  const toggleModel = (name: string) => {
    setSelectedModels(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const toggleAll = () => {
    const filteredNames = filteredModels.map(m => m.name)
    const allFilteredSelected = filteredNames.every(n => selectedModels.has(n))
    if (allFilteredSelected) {
      setSelectedModels(prev => {
        const next = new Set(prev)
        filteredNames.forEach(n => next.delete(n))
        return next
      })
    } else {
      setSelectedModels(prev => {
        const next = new Set(prev)
        filteredNames.forEach(n => next.add(n))
        return next
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t.models.discoverModels} - {PROVIDER_DISPLAY_NAMES[credential.provider] || credential.provider}
          </DialogTitle>
          <DialogDescription>
            {credential.name}
          </DialogDescription>
        </DialogHeader>

        {discoverModels.isPending ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : discoveryError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{discoveryError}</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 text-left">
              <Label>{t.models.modelType}</Label>
              <Select value={selectedType} onValueChange={(v) => setSelectedType(v as ModelType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(PROVIDER_MODALITIES[credential.provider] || credential.modalities as ModelType[]).map(type => (
                    <SelectItem key={type} value={type}>
                      <div className="flex items-center gap-2">
                        {TYPE_ICONS[type]}
                        {TYPE_LABELS[type]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t.models.modelTypeHint}</p>
            </div>

            <input
              type="text"
              className="flex h-9 w-full rounded-md border border-slate-200 bg-background px-3 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
              placeholder={t.models.searchOrAddModel}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            {filteredModels.length > 0 && (
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {filteredModels.every(m => selectedModels.has(m.name)) ? t.common.remove : t.common.addSelected}
                  {' '}({selectedModels.size}/{filteredModels.length})
                </Button>
              </div>
            )}

            <div className="space-y-1 max-h-60 overflow-y-auto text-left">
              {filteredModels.map((model) => (
                <label
                  key={model.name}
                  className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedModels.has(model.name)}
                    onChange={() => toggleModel(model.name)}
                    className="rounded"
                  />
                  <span className="truncate">{model.name}</span>
                  {model.description && model.description !== model.name && (
                    <span className="text-xs text-muted-foreground truncate">({model.description})</span>
                  )}
                </label>
              ))}

              {showCustomOption && (
                <label className={`flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer text-sm${filteredModels.length > 0 ? ' border-t mt-1 pt-2' : ''}`}>
                  <input
                    type="checkbox"
                    checked={customModelSelected}
                    onChange={() => setCustomModelSelected(prev => !prev)}
                    className="rounded"
                  />
                  <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">
                    {t.models.addCustomModel.replace('{name}', searchQuery.trim())}
                  </span>
                </label>
              )}

              {filteredModels.length === 0 && !showCustomOption && (
                <p className="text-center py-4 text-muted-foreground text-sm">{t.models.noModelsFound}</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button
            onClick={handleRegister}
            disabled={totalSelected === 0 || registerModels.isPending}
          >
            {registerModels.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {t.common.add} ({totalSelected})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// Delete Credential Dialog
// =============================================================================

function DeleteCredentialDialog({
  open,
  onOpenChange,
  credential,
  allCredentials,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  credential: Credential
  allCredentials: Credential[]
}) {
  const { t } = useTranslation()
  const deleteCredential = useDeleteCredential()
  const [migrateToId, setMigrateToId] = useState<string>('')

  const otherCredentials = allCredentials.filter(
    c => c.id !== credential.id && c.provider === credential.provider
  )

  const handleDeleteWithModels = () => {
    deleteCredential.mutate(
      { credentialId: credential.id, options: { delete_models: true } },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  const handleMigrate = () => {
    if (!migrateToId) return
    deleteCredential.mutate(
      { credentialId: credential.id, options: { migrate_to: migrateToId } },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  const handleDeleteOnly = () => {
    deleteCredential.mutate(
      { credentialId: credential.id },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.apiKeys.deleteConfig}</DialogTitle>
          <DialogDescription>
            {t.apiKeys.deleteConfigConfirm.replace('{name}', credential.name)}
          </DialogDescription>
        </DialogHeader>

        {credential.model_count > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-left">
              This credential has {credential.model_count} linked model(s).
              {otherCredentials.length > 0 && (
                <div className="mt-2">
                  <Label>Migrate models to:</Label>
                  <Select value={migrateToId} onValueChange={setMigrateToId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select credential" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherCredentials.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          {credential.model_count > 0 && migrateToId && (
            <Button onClick={handleMigrate} disabled={deleteCredential.isPending}>
              {deleteCredential.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Migrate & Delete
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={credential.model_count > 0 ? handleDeleteWithModels : handleDeleteOnly}
            disabled={deleteCredential.isPending}
          >
            {deleteCredential.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {credential.model_count > 0 ? 'Delete with Models' : t.common.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// =============================================================================
// Credential Card (shows credential + its models)
// =============================================================================

function CredentialItem({
  credential,
  models,
  defaults,
  allCredentials,
}: {
  credential: Credential
  models: Model[]
  defaults: ModelDefaults | null
  allCredentials: Credential[]
}) {
  const { t } = useTranslation()
  const { testCredential, isPending: isTestPending, testResults } = useTestCredential()
  const { testModel, isPending: isModelTestPending, testingModelId, testResult: modelTestResult, testedModelName, clearResult: clearModelTestResult } = useTestModel()
  const deleteModel = useDeleteModel()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [discoverOpen, setDiscoverOpen] = useState(false)
  const { data: fullCredential } = useCredential(editOpen ? credential.id : '')

  const linkedModels = models.filter(m => m.credential === credential.id)
  const activeTypes = new Set(linkedModels.map(m => m.type))
  const testResult = testResults[credential.id]

  const testModelLabel = t.models.testModel
  const deleteModelLabel = t.models.deleteModel

  const defaultSlots: Record<string, string> = {}
  if (defaults) {
    const slotMap: Record<string, string | null | undefined> = {
      'Chat': defaults.default_chat_model,
      'Transform': defaults.default_transformation_model,
      'Tools': defaults.default_tools_model,
      'Large Ctx': defaults.large_context_model,
      'Embedding': defaults.default_embedding_model,
      'TTS': defaults.default_text_to_speech_model,
      'STT': defaults.default_speech_to_text_model,
    }
    for (const [slot, modelId] of Object.entries(slotMap)) {
      if (modelId) defaultSlots[modelId] = slot
    }
  }

  return (
    <>
      <div className="rounded-[16px] border border-slate-100 bg-white p-3 space-y-2 text-left">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="font-semibold text-sm text-slate-800 truncate">{credential.name}</span>
            <div className="flex gap-1 flex-wrap">
              {credential.modalities.map(mod => (
                <span
                  key={mod}
                  className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${activeTypes.has(mod as ModelType) ? (TYPE_COLORS[mod as ModelType] || '') : TYPE_COLOR_INACTIVE}`}
                >
                  {TYPE_ICONS[mod as ModelType]}
                  <span>{TYPE_LABELS[mod as ModelType] || mod}</span>
                </span>
              ))}
            </div>
            {credential.has_api_key && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500">
                <Key className="h-2.5 w-2.5" />
                Key
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {testResult && (
              testResult.success
                ? <Check className="h-4 w-4 text-emerald-500" />
                : <X className="h-4 w-4 text-destructive" />
            )}
            <Button
              variant="ghost" size="sm"
              onClick={() => testCredential(credential.id)}
              disabled={isTestPending}
              title={t.apiKeys.testConnection}
              className="h-7 px-2 text-slate-500 hover:text-white hover:bg-[#8B5CF6]"
            >
              {isTestPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline text-xs ml-1">Test</span>
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => setDiscoverOpen(true)}
              title={t.apiKeys.syncModels}
              className="h-7 px-2 text-slate-500 hover:text-white hover:bg-[#8B5CF6]"
            >
              <Bot className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs ml-1">Models</span>
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => setEditOpen(true)}
              title={t.common.edit}
              className="h-7 px-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="sm"
              onClick={() => setDeleteOpen(true)}
              className="h-7 px-2 text-slate-400 hover:text-destructive hover:bg-destructive/10"
              title={t.common.delete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {linkedModels.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            {(['language', 'embedding', 'text_to_speech', 'speech_to_text'] as ModelType[])
              .filter(type => linkedModels.some(m => m.type === type))
              .map(type => (
                <div key={type} className="flex items-start gap-1.5 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 mt-0.5 ${TYPE_COLORS[type]}`}
                  >
                    {TYPE_ICONS[type]}
                    {TYPE_LABELS[type]}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {linkedModels.filter(m => m.type === type).map(model => {
                      const defaultSlot = defaultSlots[model.id]
                      return (
                        <span
                          key={model.id}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium group/model ${defaultSlot ? 'bg-[#8B5CF6] text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          {model.name}
                          {defaultSlot && <span className="ml-0.5 opacity-80 text-[10px]">({defaultSlot})</span>}
                          <button
                            className="ml-0.5 opacity-0 group-hover/model:opacity-60 hover:!opacity-100 transition-opacity"
                            onClick={() => testModel(model.id, model.name)}
                            disabled={isModelTestPending && testingModelId === model.id}
                            title={testModelLabel}
                          >
                            {isModelTestPending && testingModelId === model.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <Plug className="h-3 w-3" />
                            }
                          </button>
                          <button
                            className="opacity-0 group-hover/model:opacity-60 hover:!opacity-100 hover:text-red-200 transition-opacity"
                            onClick={() => deleteModel.mutate(model.id)}
                            title={deleteModelLabel}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {editOpen && (
        <CredentialFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          provider={credential.provider}
          credential={fullCredential || credential}
        />
      )}

      {deleteOpen && (
        <DeleteCredentialDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          credential={credential}
          allCredentials={allCredentials}
        />
      )}

      {discoverOpen && (
        <DiscoverModelsDialog
          open={discoverOpen}
          onOpenChange={setDiscoverOpen}
          credential={credential}
        />
      )}

      <ModelTestResultDialog
        open={modelTestResult !== null}
        onOpenChange={(open) => { if (!open) clearModelTestResult() }}
        result={modelTestResult}
        modelName={testedModelName}
      />
    </>
  )
}

// =============================================================================
// Provider Section (shows all credentials for a provider)
// =============================================================================

function ProviderSection({
  provider,
  credentials,
  models,
  defaults,
  allCredentials,
  encryptionReady,
}: {
  provider: string
  credentials: Credential[]
  models: Model[]
  defaults: ModelDefaults | null
  allCredentials: Credential[]
  encryptionReady: boolean
}) {
  const { t } = useTranslation()
  const [addOpen, setAddOpen] = useState(false)

  const displayName = PROVIDER_DISPLAY_NAMES[provider] || provider
  const modalities = PROVIDER_MODALITIES[provider] || ['language']
  const hasCredentials = credentials.length > 0

  const providerModels = models.filter(m =>
    credentials.some(c => c.id === m.credential)
  )
  const activeTypes = new Set(providerModels.map(m => m.type))

  return (
    <div className={`rounded-[24px] bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-slate-100 flex flex-col${!hasCredentials ? ' opacity-80' : ''} hover:shadow-md transition-all duration-300`}>
      <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-2 text-left">
        <div className="flex flex-col gap-1.5 min-w-0">
          <span className="font-bold text-[17px] text-slate-900">{displayName}</span>
          <div className="flex items-center gap-1 flex-wrap">
            {modalities.map((type) => (
              <span
                key={type}
                className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${activeTypes.has(type) ? TYPE_COLORS[type] : TYPE_COLOR_INACTIVE}`}
              >
                {TYPE_ICONS[type]}
                <span>{TYPE_LABELS[type]}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="shrink-0 mt-0.5">
          {hasCredentials ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-750 px-2.5 py-1 text-xs font-semibold">
              <Check className="h-3 w-3" />
              {t.apiKeys.configured}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-200 text-slate-400 px-2.5 py-1 text-xs font-semibold">
              <X className="h-3 w-3" />
              {t.apiKeys.notConfigured}
            </span>
          )}
        </div>
      </div>

      {credentials.length > 0 && (
        <div className="px-5 space-y-3 pb-3">
          {credentials.map(cred => (
            <CredentialItem
              key={cred.id}
              credential={cred}
              models={models}
              defaults={defaults}
              allCredentials={allCredentials}
            />
          ))}
        </div>
      )}

      <div className="px-5 pb-5 mt-auto pt-3">
        <button
          onClick={() => setAddOpen(true)}
          disabled={!encryptionReady}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm border border-violet-750 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Configuration
        </button>
      </div>

      {addOpen && (
        <CredentialFormDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          provider={provider}
        />
      )}
    </div>
  )
}

// =============================================================================
// Default Models Section
// =============================================================================

function DefaultModelSelectors({
  models,
  defaults,
}: {
  models: Model[]
  defaults: ModelDefaults
}) {
  const { t } = useTranslation()
  const updateDefaults = useUpdateModelDefaults()
  const autoAssign = useAutoAssignDefaults()
  const { setValue, watch } = useForm<ModelDefaults>({ defaultValues: defaults })
  const generatedId = useId()

  const [showEmbeddingDialog, setShowEmbeddingDialog] = useState(false)
  const [pendingEmbeddingChange, setPendingEmbeddingChange] = useState<{
    key: keyof ModelDefaults; value: string; oldModelId?: string; newModelId?: string
  } | null>(null)

  useEffect(() => {
    if (defaults) {
      Object.entries(defaults).forEach(([key, value]) => {
        setValue(key as keyof ModelDefaults, value)
      })
    }
  }, [defaults, setValue])

  interface DefaultConfig {
    key: keyof ModelDefaults
    label: string
    description: string
    modelType: ModelType
    required?: boolean
    id: string
  }

  const primaryConfigs: DefaultConfig[] = [
    { key: 'default_chat_model', label: 'Chat Model', description: t.models.chatModelDesc, modelType: 'language', required: true, id: `${generatedId}-chat` },
    { key: 'default_embedding_model', label: 'Embedding Model', description: t.models.embeddingModelDesc, modelType: 'embedding', required: true, id: `${generatedId}-embed` },
    { key: 'default_text_to_speech_model', label: 'Text-To-Speech Model', description: t.models.ttsModelDesc, modelType: 'text_to_speech', id: `${generatedId}-tts` },
    { key: 'default_speech_to_text_model', label: 'Speech-To-Text Model', description: t.models.sttModelDesc, modelType: 'speech_to_text', id: `${generatedId}-stt` },
  ]

  const advancedConfigs: DefaultConfig[] = [
    { key: 'default_transformation_model', label: 'Transformation Model', description: 'Used for executing custom transformations', modelType: 'language', id: `${generatedId}-transform` },
    { key: 'default_tools_model', label: 'Tools Model', description: 'Used for tools calling / Agent for RAG recommended', modelType: 'language', id: `${generatedId}-tools` },
    { key: 'large_context_model', label: 'Large Context Model', description: 'Used for processing large content Model for RAG recommended', modelType: 'language', id: `${generatedId}-large` },
  ]

  const defaultConfigs = [...primaryConfigs, ...advancedConfigs]

  const handleChange = (key: keyof ModelDefaults, value: string) => {
    if (key === 'default_embedding_model') {
      const current = defaults[key]
      if (current && current !== value) {
        setPendingEmbeddingChange({ key, value, oldModelId: current, newModelId: value })
        setShowEmbeddingDialog(true)
        return
      }
    }
    updateDefaults.mutate({ [key]: value || null })
  }

  const handleConfirmEmbeddingChange = () => {
    if (pendingEmbeddingChange) {
      updateDefaults.mutate({ [pendingEmbeddingChange.key]: pendingEmbeddingChange.value || null })
      setPendingEmbeddingChange(null)
    }
  }

  const getModelsForType = (type: ModelType) => models.filter(m => m.type === type)

  const missingRequired = defaultConfigs
    .filter(c => {
      if (!c.required) return false
      const value = defaults[c.key]
      if (!value) return true
      return !models.filter(m => m.type === c.modelType).some(m => m.id === value)
    })
    .map(c => c.label)

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] bg-white text-left">
        <CardHeader className="pb-3 pt-6 px-7">
          <div>
            <CardTitle className="text-xl font-bold text-slate-950">Default Model Assignments</CardTitle>
            <CardDescription className="text-slate-500 mt-1 text-[13px] font-semibold">Configure which models to use for different purposes across Open Notebook</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-7 pb-7 space-y-6">
          {missingRequired.length > 0 && (
            <Alert className="rounded-2xl bg-orange-50/50 border border-orange-100">
              <AlertCircle className="h-4 w-4 text-[#FF7043]" />
              <AlertDescription className="flex items-center justify-between gap-4 text-[#FF7043] text-sm">
                <span>{t.models.missingRequiredModels.replace('{models}', missingRequired.join(', '))}</span>
                <Button
                  variant="outline" size="sm"
                  onClick={() => autoAssign.mutate()}
                  disabled={autoAssign.isPending}
                  className="shrink-0 gap-1.5 border-[#FF7043] text-[#FF7043] hover:bg-orange-50 rounded-lg h-8"
                >
                  {autoAssign.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                  {autoAssign.isPending ? t.models.autoAssigning : t.models.autoAssign}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-x-6 gap-y-4 grid-cols-1 md:grid-cols-2">
            {primaryConfigs.map(config => {
              const available = getModelsForType(config.modelType)
              const currentValue = watch(config.key) || undefined
              const isValid = currentValue && available.some(m => m.id === currentValue)

              return (
                <div key={config.key} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor={config.id} className="text-xs font-semibold text-slate-700">
                      {config.label}
                      {config.required && <span className="text-[#EF4444] ml-0.5">*</span>}
                    </Label>
                  </div>
                  <div className="flex gap-1">
                    <Select
                      value={currentValue || ""}
                      onValueChange={(v) => handleChange(config.key, v)}
                    >
                      <SelectTrigger
                        id={config.id}
                        className={`h-11 text-sm rounded-xl border-slate-200 focus:ring-1 focus:ring-[#8B5CF6] focus:border-[#8B5CF6] bg-white ${config.required && !isValid && available.length > 0 ? 'border-destructive' : ''}`}
                      >
                        <SelectValue placeholder={t.models.selectModelPlaceholder} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {available.sort((a, b) => a.name.localeCompare(b.name)).map(model => (
                          <SelectItem key={model.id} value={model.id} className="text-sm">
                            <div className="flex items-center justify-between w-full gap-2">
                              <span>{model.name}</span>
                              <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1">{model.provider}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.02)] bg-white text-left">
        <CardHeader className="pb-3 pt-6 px-7">
          <CardTitle className="text-xl font-bold text-slate-950">Advanced</CardTitle>
        </CardHeader>
        <CardContent className="px-7 pb-7">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {advancedConfigs.map(config => {
              const available = getModelsForType(config.modelType)
              const currentValue = watch(config.key) || undefined
              const isValid = currentValue && available.some(m => m.id === currentValue)

              return (
                <div key={config.key} className="space-y-1.5">
                  <Label htmlFor={config.id} className="text-xs font-semibold text-slate-700">
                    {config.label}
                  </Label>
                  <div className="flex gap-1">
                    <Select
                      value={currentValue || ""}
                      onValueChange={(v) => handleChange(config.key, v)}
                    >
                      <SelectTrigger
                        id={config.id}
                        className={`h-11 text-sm rounded-xl border-slate-200 focus:ring-1 focus:ring-[#8B5CF6] focus:border-[#8B5CF6] bg-white ${config.required && !isValid && available.length > 0 ? 'border-destructive' : ''}`}
                      >
                        <SelectValue placeholder={t.models.selectModelPlaceholder} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {available.sort((a, b) => a.name.localeCompare(b.name)).map(model => (
                          <SelectItem key={model.id} value={model.id} className="text-sm">
                            <div className="flex items-center justify-between w-full gap-2">
                              <span>{model.name}</span>
                              <span className="text-[10px] text-slate-400 bg-slate-100 rounded px-1">{model.provider}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {config.key !== 'default_transformation_model' && currentValue && (
                      <Button variant="ghost" size="icon" onClick={() => handleChange(config.key, "")} className="h-11 w-11 shrink-0 text-slate-400 hover:text-slate-700 rounded-xl">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal pt-0.5">{config.description}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <EmbeddingModelChangeDialog
        open={showEmbeddingDialog}
        onOpenChange={(open) => { if (!open) { setPendingEmbeddingChange(null); setShowEmbeddingDialog(false) } }}
        onConfirm={handleConfirmEmbeddingChange}
        oldModelName={pendingEmbeddingChange?.oldModelId ? models.find(m => m.id === pendingEmbeddingChange.oldModelId)?.name : undefined}
        newModelName={pendingEmbeddingChange?.newModelId ? models.find(m => m.id === pendingEmbeddingChange.newModelId)?.name : undefined}
      />
    </div>
  )
}

// =============================================================================
// Model Card (rendered inside Models Grid)
// =============================================================================

function ModelCard({
  model,
  parentCredential,
  onConfigure,
  onTest,
  onDelete,
  onSync,
  isTesting,
}: {
  model: Model
  parentCredential?: Credential
  onConfigure: () => void
  onTest: () => void
  onDelete: () => void
  onSync: () => void
  isTesting: boolean
}) {
  const typeLabel = getModelTypeLabel(model.type)
  const version = getModelVersion(model.name)
  const accuracy = getModelAccuracy(model.name)
  const apiCalls = getModelApiCalls(model.name)
  const cost = getModelCost(model.name)
  const lastUsed = getModelLastUsed(model.name)

  const status = parentCredential ? 'Active' : 'Testing'

  return (
    <div className="bg-white rounded-[20px] p-5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all duration-300">
      <div>
        {/* Header Row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
              {TYPE_ICONS[model.type] || <Bot className="h-5 w-5" />}
            </div>
            <div className="text-left min-w-0">
              <h3 className="font-bold text-[15px] text-slate-800 truncate leading-tight">{model.name}</h3>
              <p className="text-[12px] text-slate-400 font-semibold mt-0.5 uppercase tracking-wide">
                {PROVIDER_DISPLAY_NAMES[model.provider] || model.provider}
              </p>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-slate-450 hover:text-slate-700 hover:bg-slate-50 transition-colors p-1.5 rounded-full cursor-pointer inline-flex items-center justify-center outline-none">
                <MoreVertical className="h-4.5 w-4.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl shadow-lg border border-slate-100 bg-white p-1 min-w-[140px] z-[100]">
              <DropdownMenuItem
                onClick={onTest}
                disabled={isTesting}
                className="rounded-lg cursor-pointer flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:text-slate-800 outline-none"
              >
                {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> : <Plug className="h-3.5 w-3.5 text-slate-400" />}
                <span>Test Model</span>
              </DropdownMenuItem>

              {parentCredential && (
                <DropdownMenuItem
                  onClick={onSync}
                  className="rounded-lg cursor-pointer flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:text-slate-800 outline-none"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                  <span>Sync Models</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem
                onClick={onDelete}
                className="rounded-lg cursor-pointer flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-rose-600 hover:bg-rose-50 focus:bg-rose-50 focus:text-rose-700 border-t border-slate-50 outline-none"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                <span>Delete Model</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Details Grid (2x2) */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4 text-left">
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide">Type</span>
            <span className="text-[13px] font-bold text-slate-700 truncate block mt-0.5">{typeLabel}</span>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide">Version</span>
            <span className="text-[13px] font-bold text-slate-700 truncate block mt-0.5">{version}</span>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide">Accuracy</span>
            <span className="text-[13px] font-extrabold text-[#10B981] block mt-0.5">{accuracy}</span>
          </div>
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-wide">Status</span>
            <div className="mt-1">
              <span className={`px-2 py-0.5 rounded-[6px] text-[11px] font-bold leading-none inline-block ${
                status === 'Active' ? 'bg-[#E6FBF3] text-[#10B981]' : 'bg-[#FEF3C7] text-[#D97706]'
              }`}>
                {status}
              </span>
            </div>
          </div>
        </div>

        <hr className="border-slate-100 my-4" />

        {/* Metrics Row (3 columns) */}
        <div className="grid grid-cols-3 gap-2 text-left mb-5">
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">API Calls</span>
            <span className="text-[13px] font-extrabold text-slate-700 block mt-0.5">{apiCalls}</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cost</span>
            <span className="text-[13px] font-extrabold text-slate-700 block mt-0.5">{cost}</span>
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Last Used</span>
            <span className="text-[12px] font-semibold text-slate-500 block mt-0.5 truncate">{lastUsed}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2.5 mt-auto">
        <Button
          onClick={onConfigure}
          className="flex-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white h-[38px] rounded-xl text-xs font-bold shadow-xs transition-all border border-violet-750 cursor-pointer"
        >
          Configure
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            window.location.href = '/audit-logs'
          }}
          className="border-slate-200 hover:bg-slate-50 text-slate-600 h-[38px] rounded-xl text-xs font-bold cursor-pointer"
        >
          View Logs
        </Button>
      </div>
    </div>
  )
}

// =============================================================================
// KPI Card Renderers
// =============================================================================

function KpiCard({
  title,
  value,
  trend,
  trendType
}: {
  title: string
  value: string | number
  trend: string
  trendType: 'success' | 'info' | 'warning'
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.01)] flex flex-col justify-between h-[115px] text-left hover:shadow-md transition-all duration-300">
      <div>
        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{title}</p>
        <p className="text-[26px] font-extrabold text-slate-800 leading-tight">{value}</p>
      </div>
      <div className="mt-2 flex items-center">
        {trendType === 'success' ? (
          <span className="text-[11px] font-bold text-[#10B981] bg-[#E6FBF3] px-2 py-0.5 rounded-full flex items-center gap-0.5">
            <span className="inline-block translate-y-[-0.5px]">↑</span> {trend}
          </span>
        ) : trendType === 'warning' ? (
          <span className="text-[11px] font-bold text-[#F59E0B] bg-[#FEF3C7] px-2 py-0.5 rounded-full">
            {trend}
          </span>
        ) : (
          <span className="text-[11px] font-bold text-[#3B82F6] bg-[#EFF6FF] px-2 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
    </div>
  )
}

function BottomKpiCard({
  title,
  value,
  subtext,
  icon,
  iconBg
}: {
  title: string
  value: string
  subtext: string
  icon: React.ReactNode
  iconBg: string
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-[20px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.01)] flex flex-col justify-between h-[150px] text-left hover:shadow-md transition-all duration-300">
      <div className="flex items-center justify-between">
        <span className="text-[13.5px] font-bold text-slate-800">{title}</span>
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs", iconBg)}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-[28px] font-extrabold text-slate-800 leading-none">{value}</p>
        <p className="text-[12px] font-bold text-emerald-500 mt-2">{subtext}</p>
      </div>
    </div>
  )
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function ApiKeysPage() {
  const { t } = useTranslation()

  // Tabs management
  const [activeTab, setActiveTab] = useState<'models' | 'credentials' | 'defaults'>('models')

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterProvider, setFilterProvider] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  // Add Model Provider Dialog State
  const [addModelProviderSelectOpen, setAddModelProviderSelectOpen] = useState(false)
  const [selectedProviderForAdd, setSelectedProviderForAdd] = useState<string | null>(null)

  // Edit Credential Dialog State
  const [editCredentialOpen, setEditCredentialOpen] = useState(false)
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null)
  const [editingCredentialId, setEditingCredentialId] = useState<string>('')

  // Sync / Discover Dialog State
  const [discoverCredential, setDiscoverCredential] = useState<Credential | null>(null)

  // API Requests
  const { data: credentials, isLoading: credentialsLoading } = useCredentials()
  const { data: models, isLoading: modelsLoading } = useModels()
  const { data: defaults, isLoading: defaultsLoading } = useModelDefaults()
  const { data: credentialStatus } = useCredentialStatus()
  const { data: envStatus } = useEnvStatus()
  
  const { data: fullCredential } = useCredential(editingCredentialId)

  // Model Testing and deletion hooks (for grid card actions)
  const { 
    testModel, 
    isPending: isModelTestPending, 
    testingModelId, 
    testResult: modelTestResult, 
    testedModelName, 
    clearResult: clearModelTestResult 
  } = useTestModel()
  const deleteModel = useDeleteModel()

  const encryptionReady = credentialStatus?.encryption_configured ?? true

  const credentialsByProvider = useMemo(() => {
    const grouped: Record<string, Credential[]> = {}
    for (const provider of ALL_PROVIDERS) {
      grouped[provider] = []
    }
    if (credentials) {
      for (const cred of credentials) {
        if (!grouped[cred.provider]) grouped[cred.provider] = []
        grouped[cred.provider].push(cred)
      }
    }
    return grouped
  }, [credentials])

  const providersToMigrate = useMemo(() => {
    if (!envStatus || !credentialStatus) return []
    const providers: string[] = []
    for (const provider in envStatus) {
      if (envStatus[provider] && credentialStatus.source[provider] === 'environment') {
        providers.push(provider)
      }
    }
    return providers
  }, [envStatus, credentialStatus])

  const sortedProviders = useMemo(() => {
    return [...ALL_PROVIDERS].sort((a, b) => {
      const aHas = (credentialsByProvider[a]?.length || 0) > 0 ? 1 : 0
      const bHas = (credentialsByProvider[b]?.length || 0) > 0 ? 1 : 0
      return bHas - aHas
    })
  }, [credentialsByProvider])

  // Extract dynamic providers that have registered models for filter dropdown
  const availableProviders = useMemo(() => {
    if (!models) return []
    return Array.from(new Set(models.map(m => m.provider)))
  }, [models])

  // Filter models based on search query, provider dropdown, and status dropdown
  const filteredModels = useMemo(() => {
    if (!models) return []
    return models.filter(model => {
      const matchesSearch = !searchQuery.trim() || 
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.provider.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.type.toLowerCase().includes(searchQuery.toLowerCase())
        
      const matchesProvider = filterProvider === 'all' || model.provider === filterProvider
      const matchesStatus = filterStatus === 'all' || model.type === filterStatus
      
      return matchesSearch && matchesProvider && matchesStatus
    })
  }, [models, searchQuery, filterProvider, filterStatus])

  // Calculate active models count (models with parent credential present)
  const activeModelsCount = useMemo(() => {
    if (!models || !credentials) return 0
    return models.filter(m => credentials.some(c => c.id === m.credential)).length
  }, [models, credentials])

  const isLoading = credentialsLoading || modelsLoading || defaultsLoading

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 bg-[#FAFBFF] relative overflow-hidden">
        <PageHeader 
          searchValue={searchTerm} 
          onSearchChange={(val) => setSearchTerm(val)} 
          newLabel="NOTEBOOK"
        />

        <div className="flex-1 overflow-y-auto">
          <div className="p-8 space-y-7 pb-16">
            
            {/* Title Block & Add Model Button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-[#7C3AED] flex items-center justify-center text-white shadow-[0_8px_20px_-6px_rgba(124,58,237,0.5)]">
                  <Bot className="h-5 w-5 text-white animate-pulse-once" />
                </div>
                <div className="text-left">
                  <h1 className="text-2xl font-bold text-slate-800 tracking-tight leading-tight">AI Models</h1>
                  <p className="text-[13px] text-slate-400 font-semibold mt-0.5">Manage and monitor all AI models and integrations</p>
                </div>
              </div>

              <Button
                onClick={() => setAddModelProviderSelectOpen(true)}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-sm h-11 px-5 rounded-xl flex items-center gap-1.5 shadow-md border border-violet-750 shrink-0 cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>Add Model</span>
              </Button>
            </div>

            {/* KPI Cards Row (4 cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <KpiCard
                title="Total Models"
                value={models?.length || 0}
                trend="+3 new"
                trendType="success"
              />
              <KpiCard
                title="Active Models"
                value={activeModelsCount}
                trend={models?.length ? `${Math.round((activeModelsCount / models.length) * 100)}% operational` : '0%'}
                trendType="success"
              />
              <KpiCard
                title="Total API Calls"
                value="50,636"
                trend="This month"
                trendType="info"
              />
              <KpiCard
                title="Total Cost"
                value="$3,813"
                trend="-$450 from last month"
                trendType="success"
              />
            </div>

            {/* Navigation Tabs bar */}
            <div className="flex border-b border-slate-100 gap-2">
              <button
                onClick={() => setActiveTab('models')}
                className={cn(
                  "pb-3 text-sm font-bold border-b-2 px-4 transition-all cursor-pointer",
                  activeTab === 'models' 
                    ? "border-[#7C3AED] text-[#7C3AED]" 
                    : "border-transparent text-slate-400 hover:text-slate-650"
                )}
              >
                AI Models
              </button>
              <button
                onClick={() => setActiveTab('credentials')}
                className={cn(
                  "pb-3 text-sm font-bold border-b-2 px-4 transition-all cursor-pointer",
                  activeTab === 'credentials' 
                    ? "border-[#7C3AED] text-[#7C3AED]" 
                    : "border-transparent text-slate-400 hover:text-slate-650"
                )}
              >
                API Configurations
              </button>
              <button
                onClick={() => setActiveTab('defaults')}
                className={cn(
                  "pb-3 text-sm font-bold border-b-2 px-4 transition-all cursor-pointer",
                  activeTab === 'defaults' 
                    ? "border-[#7C3AED] text-[#7C3AED]" 
                    : "border-transparent text-slate-400 hover:text-slate-650"
                )}
              >
                Default Assignments
              </button>
            </div>

            {/* Tab Contents: AI Models (main grid and filtering) */}
            {activeTab === 'models' && (
              <div className="space-y-6">
                
                {/* Search and Filters bar */}
                <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-white rounded-2xl p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search models by name, provider, or type..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-11 pl-12 pr-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/20 focus:border-[#7C3AED] focus:bg-white transition-all font-medium text-left"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Select value={filterProvider} onValueChange={setFilterProvider}>
                      <SelectTrigger className="w-[160px] h-11 rounded-xl border-slate-200 text-xs font-bold text-slate-700 bg-white">
                        <SelectValue placeholder="All Providers" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="all" className="text-xs font-bold text-slate-750">All Providers</SelectItem>
                        {availableProviders.map(provider => (
                          <SelectItem key={provider} value={provider} className="text-xs font-bold text-slate-750">
                            {PROVIDER_DISPLAY_NAMES[provider] || provider}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-[160px] h-11 rounded-xl border-slate-200 text-xs font-bold text-slate-700 bg-white">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="all" className="text-xs font-bold text-slate-750">All Status</SelectItem>
                        <SelectItem value="language" className="text-xs font-bold text-slate-750">Language Models</SelectItem>
                        <SelectItem value="embedding" className="text-xs font-bold text-slate-750">Embedding Models</SelectItem>
                        <SelectItem value="text_to_speech" className="text-xs font-bold text-slate-750">Speech Generation (TTS)</SelectItem>
                        <SelectItem value="speech_to_text" className="text-xs font-bold text-slate-750">Speech Recognition (STT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Models Cards Grid */}
                {filteredModels.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                    <Bot className="h-12 w-12 text-slate-350 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-800 mb-2">No Models Registered</h3>
                    <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
                      Configure your API keys in the <strong>API Configurations</strong> tab to discover and register models.
                    </p>
                    <Button
                      onClick={() => setActiveTab('credentials')}
                      className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold rounded-xl h-10 px-5 cursor-pointer"
                    >
                      Configure API Keys
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredModels.map(model => {
                      const parentCred = credentials?.find(c => c.id === model.credential)
                      return (
                        <ModelCard
                          key={model.id}
                          model={model}
                          parentCredential={parentCred}
                          onConfigure={() => {
                            if (parentCred) {
                              setEditingCredentialId(parentCred.id)
                              setEditingCredential(parentCred)
                              setEditCredentialOpen(true)
                            }
                          }}
                          onTest={() => testModel(model.id, model.name)}
                          onDelete={() => deleteModel.mutate(model.id)}
                          onSync={() => {
                            if (parentCred) setDiscoverCredential(parentCred)
                          }}
                          isTesting={isModelTestPending && testingModelId === model.id}
                        />
                      )
                    })}
                  </div>
                )}

                {/* Bottom stats KPI row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                  <BottomKpiCard
                    title="Avg Accuracy"
                    value="94.5%"
                    subtext="↑ 2.3% from last month"
                    icon={<Wand2 className="h-5 w-5 text-violet-600" />}
                    iconBg="bg-violet-50"
                  />
                  <BottomKpiCard
                    title="Avg Response Time"
                    value="1.2s"
                    subtext="↓ 0.3s faster"
                    icon={<RefreshCw className="h-5 w-5 text-blue-650" />}
                    iconBg="bg-blue-50"
                  />
                  <BottomKpiCard
                    title="Success Rate"
                    value="98.7%"
                    subtext="↑ 1.2% improvement"
                    icon={<Check className="h-5 w-5 text-emerald-600" />}
                    iconBg="bg-emerald-50"
                  />
                </div>

              </div>
            )}

            {/* Tab Contents: API Configurations (the original credential management) */}
            {activeTab === 'credentials' && (
              <div className="space-y-6">
                {!encryptionReady && (
                  <Alert className="border-red-500/50 bg-red-50 dark:bg-red-950/20 rounded-2xl">
                    <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <AlertTitle className="text-red-800 dark:text-red-200">{t.apiKeys.encryptionRequired}</AlertTitle>
                    <AlertDescription className="text-red-700 dark:text-red-300">
                      <code className="text-xs bg-red-100 dark:bg-red-900/30 px-1 py-0.5 rounded">
                        {t.apiKeys.encryptionRequiredDescription}
                      </code>
                    </AlertDescription>
                  </Alert>
                )}

                {encryptionReady && <MigrationBanner providersToMigrate={providersToMigrate} />}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedProviders.map(provider => (
                    <ProviderSection
                      key={provider}
                      provider={provider}
                      credentials={credentialsByProvider[provider] || []}
                      models={models || []}
                      defaults={defaults || null}
                      allCredentials={credentials || []}
                      encryptionReady={encryptionReady}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Tab Contents: Default Assignments */}
            {activeTab === 'defaults' && (
              <div className="space-y-6">
                {models && defaults && (
                  <DefaultModelSelectors models={models} defaults={defaults} />
                )}
              </div>
            )}

            {/* Learn More link footer */}
            <div className="border-t border-slate-100 pt-5 text-left">
              <a
                href="https://github.com/lfnovo/open-notebook/blob/main/docs/5-CONFIGURATION/ai-providers.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold text-[#8B5CF6] hover:underline"
              >
                {t.apiKeys.learnMore} &rarr;
              </a>
            </div>

          </div>
        </div>
      </div>

      {/* Select Provider dialog for Add Model */}
      <Dialog open={addModelProviderSelectOpen} onOpenChange={setAddModelProviderSelectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-left">Select Provider to Configure</DialogTitle>
            <DialogDescription className="text-left">
              Choose an AI provider to add a new API configuration. Once configured, you can sync and register its models.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4 max-h-[60vh] overflow-y-auto">
            {ALL_PROVIDERS.map(provider => (
              <button
                key={provider}
                onClick={() => {
                  setSelectedProviderForAdd(provider)
                  setAddModelProviderSelectOpen(false)
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 hover:border-violet-300 hover:bg-violet-50/30 transition-all text-center gap-2 cursor-pointer"
              >
                <span className="font-bold text-sm text-slate-800">
                  {PROVIDER_DISPLAY_NAMES[provider] || provider}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  {PROVIDER_MODALITIES[provider]?.join(', ')}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Conditional CredentialFormDialog for Add Model flow */}
      {selectedProviderForAdd && (
        <CredentialFormDialog
          open={selectedProviderForAdd !== null}
          onOpenChange={(open) => {
            if (!open) setSelectedProviderForAdd(null)
          }}
          provider={selectedProviderForAdd}
        />
      )}

      {/* Credential Edit dialog */}
      {editCredentialOpen && editingCredential && (
        <CredentialFormDialog
          open={editCredentialOpen}
          onOpenChange={(open) => {
            if (!open) {
              setEditCredentialOpen(false)
              setEditingCredential(null)
            }
          }}
          provider={editingCredential.provider}
          credential={fullCredential || editingCredential}
        />
      )}

      {/* Discover/Sync dialog */}
      {discoverCredential && (
        <DiscoverModelsDialog
          open={discoverCredential !== null}
          onOpenChange={(open) => {
            if (!open) setDiscoverCredential(null)
          }}
          credential={discoverCredential}
        />
      )}

      {/* Model test result dialog */}
      <ModelTestResultDialog
        open={modelTestResult !== null}
        onOpenChange={(open) => { if (!open) clearModelTestResult() }}
        result={modelTestResult}
        modelName={testedModelName}
      />
    </AppShell>
  )
}