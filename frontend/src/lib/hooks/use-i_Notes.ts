import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { i_NotesApi } from '@/lib/api/i_Notes'
import { QUERY_KEYS } from '@/lib/api/query-client'
import { useToast } from '@/lib/hooks/use-toast'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getApiErrorKey } from '@/lib/utils/error-handler'
import { Createi_NotesRequest, Updatei_NotesRequest } from '@/lib/types/api'
import { useAuthStore } from '@/lib/stores/auth-store'

function useCurrentUserEmail(): string | null {
  return useAuthStore(s => s.currentUserEmail)
}

function usei_NotesEnabled(): boolean {
  const token = useAuthStore(s => s.token)
  const hasHydrated = useAuthStore(s => s.hasHydrated)
  const currentUserEmail = useAuthStore(s => s.currentUserEmail)

  if (!hasHydrated) return false
  if (token === 'not-required') return true
  return currentUserEmail !== null
}

/** Fetch list of notebooks (active or archived) */
export function usei_Notes(archived?: boolean) {
  const userEmail = useCurrentUserEmail()
  const canFetch = usei_NotesEnabled()
  return useQuery({
    queryKey: [...QUERY_KEYS.i_Notes, { archived, user: userEmail }],
    queryFn: () => i_NotesApi.list({ archived, order_by: 'updated desc' }),
    enabled: canFetch,
  })
}

/** Fetch a single notebook by ID */
export function useNotebook(id: string) {
  const userEmail = useCurrentUserEmail()
  const canFetch = usei_NotesEnabled()
  return useQuery({
    queryKey: [...QUERY_KEYS.notebook(id), { user: userEmail }],
    queryFn: () => i_NotesApi.get(id),
    enabled: !!id && canFetch,
  })
}

export function useCreateNotebook() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()
  const userEmail = useCurrentUserEmail()

  return useMutation({
    mutationFn: (data: Createi_NotesRequest) => i_NotesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.i_Notes, { archived: false, user: userEmail }] })
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.i_Notes, { archived: true, user: userEmail }] })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.i_Notes })
      toast({
        title: t.common.success,
        description: t.i_Notes.createSuccess,
      })
    },
    onError: (error: unknown) => {
      toast({
        title: t.common.error,
        description: t(getApiErrorKey(error, t.common.error)),
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateNotebook() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Updatei_NotesRequest }) =>
      i_NotesApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.i_Notes })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notebook(id) })
      toast({
        title: t.common.success,
        description: t.i_Notes.updateSuccess,
      })
    },
    onError: (error: unknown) => {
      toast({
        title: t.common.error,
        description: t(getApiErrorKey(error, t.common.error)),
        variant: 'destructive',
      })
    },
  })
}

export function useNotebookDeletePreview(id: string, enabled: boolean = false) {
  const userEmail = useCurrentUserEmail()
  const canFetch = usei_NotesEnabled()
  return useQuery({
    queryKey: [...QUERY_KEYS.notebook(id), 'delete-preview', { user: userEmail }],
    queryFn: () => i_NotesApi.deletePreview(id),
    enabled: !!id && enabled && canFetch,
  })
}

export function useDeleteNotebook() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: ({
      id,
      deleteExclusiveSources = false,
    }: {
      id: string
      deleteExclusiveSources?: boolean
    }) => i_NotesApi.delete(id, deleteExclusiveSources),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.i_Notes })
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      toast({
        title: t.common.success,
        description: t.i_Notes.deleteSuccess,
      })
    },
    onError: (error: unknown) => {
      toast({
        title: t.common.error,
        description: t(getApiErrorKey(error, t.common.error)),
        variant: 'destructive',
      })
    },
  })
}
