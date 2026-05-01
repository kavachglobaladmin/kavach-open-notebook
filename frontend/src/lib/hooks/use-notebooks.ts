import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notebooksApi } from '@/lib/api/notebooks'
import { QUERY_KEYS } from '@/lib/api/query-client'
import { useToast } from '@/lib/hooks/use-toast'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getApiErrorKey } from '@/lib/utils/error-handler'
import { CreateNotebookRequest, UpdateNotebookRequest } from '@/lib/types/api'
import { useAuthStore } from '@/lib/stores/auth-store'

/**
 * Include the logged-in user's email in every notebook query key so that
 * React Query maintains a separate cache per user.  This prevents user A's
 * notebooks from being served to user B when they share the same browser
 * session (e.g. after a logout/login without a full page reload).
 *
 * The backend already filters by `owner = X-User-Email`, so the data
 * returned is always scoped to the current user — the query key just
 * ensures the client-side cache is also scoped correctly.
 */
function useCurrentUserEmail(): string | null {
  return useAuthStore(s => s.currentUserEmail)
}

/**
 * Returns true when it is safe to fire notebook queries:
 * - Auth is not required (token = 'not-required') → always safe
 * - Auth is required AND we have a real user email → safe
 * - Auth is required but email is still null (store not hydrated yet) → wait
 */
function useNotebooksEnabled(): boolean {
  const token = useAuthStore(s => s.token)
  const hasHydrated = useAuthStore(s => s.hasHydrated)
  const currentUserEmail = useAuthStore(s => s.currentUserEmail)

  if (!hasHydrated) return false
  // Auth not required — fetch without user scoping
  if (token === 'not-required') return true
  // Auth required — only fetch once we know who the user is
  return currentUserEmail !== null
}

export function useNotebooks(archived?: boolean) {
  const userEmail = useCurrentUserEmail()
  const canFetch = useNotebooksEnabled()
  return useQuery({
    queryKey: [...QUERY_KEYS.notebooks, { archived, user: userEmail }],
    queryFn: () => notebooksApi.list({ archived, order_by: 'updated desc' }),
    enabled: canFetch,
  })
}

export function useNotebook(id: string) {
  const userEmail = useCurrentUserEmail()
  const canFetch = useNotebooksEnabled()
  return useQuery({
    queryKey: [...QUERY_KEYS.notebook(id), { user: userEmail }],
    queryFn: () => notebooksApi.get(id),
    enabled: !!id && canFetch,
  })
}

export function useCreateNotebook() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()
  const userEmail = useCurrentUserEmail()

  return useMutation({
    mutationFn: (data: CreateNotebookRequest) => notebooksApi.create(data),
    onSuccess: () => {
      // Invalidate the exact user-scoped query keys so the new notebook
      // appears immediately for the logged-in user without a manual refresh.
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.notebooks, { archived: false, user: userEmail }] })
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.notebooks, { archived: true, user: userEmail }] })
      // Also invalidate the broader key as a safety net
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notebooks })
      toast({
        title: t.common.success,
        description: t.notebooks.createSuccess,
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
    mutationFn: ({ id, data }: { id: string; data: UpdateNotebookRequest }) =>
      notebooksApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notebooks })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notebook(id) })
      toast({
        title: t.common.success,
        description: t.notebooks.updateSuccess,
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
  const canFetch = useNotebooksEnabled()
  return useQuery({
    queryKey: [...QUERY_KEYS.notebook(id), 'delete-preview', { user: userEmail }],
    queryFn: () => notebooksApi.deletePreview(id),
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
    }) => notebooksApi.delete(id, deleteExclusiveSources),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notebooks })
      // Also invalidate sources since some may have been deleted
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      toast({
        title: t.common.success,
        description: t.notebooks.deleteSuccess,
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
