import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { sourcesApi } from '@/lib/api/sources'
import { QUERY_KEYS } from '@/lib/api/query-client'
import { useToast } from '@/lib/hooks/use-toast'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getApiErrorMessage } from '@/lib/utils/error-handler'
import { useAuthStore } from '@/lib/stores/auth-store'
import {
  CreateSourceRequest,
  UpdateSourceRequest,
  SourceResponse,
  SourceStatusResponse,
  SourceListResponse
} from '@/lib/types/api'

const i_Notes_SOURCES_PAGE_SIZE = 30

/**
 * Include the logged-in user's email in source query keys so that
 * React Query maintains a separate cache per user — same pattern as
 * use-i_Notes.ts.  The backend already scopes sources by owner via
 * the X-User-Email header; this ensures the client cache is also scoped.
 */
function useCurrentUserEmail(): string | null {
  return useAuthStore(s => s.currentUserEmail)
}

export function useSources(i_NotesId?: string) {
  const userEmail = useCurrentUserEmail()
  return useQuery({
    queryKey: [...QUERY_KEYS.sources(i_NotesId), { user: userEmail }],
    queryFn: () => sourcesApi.list({ i_Notes_id: i_NotesId }),
    enabled: !!i_NotesId && userEmail !== null,
    staleTime: 5 * 1000,
    refetchOnWindowFocus: true,
  })
}

/**
 * Hook for fetching i_Notes sources with infinite scroll pagination.
 * Returns flattened sources array and pagination controls.
 */
export function usei_Notesources(i_NotesId: string) {
  const queryClient = useQueryClient()
  const userEmail = useCurrentUserEmail()

  const query = useInfiniteQuery({
    queryKey: [...QUERY_KEYS.sourcesInfinite(i_NotesId), { user: userEmail }],
    queryFn: async ({ pageParam = 0 }) => {
      const data = await sourcesApi.list({
        i_Notes_id: i_NotesId,
        limit: i_Notes_SOURCES_PAGE_SIZE,
        offset: pageParam,
        sort_by: 'updated',
        sort_order: 'desc',
      })
      return {
        sources: data,
        nextOffset: data.length === i_Notes_SOURCES_PAGE_SIZE ? pageParam + data.length : undefined,
      }
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    enabled: !!i_NotesId && userEmail !== null,
    staleTime: 5 * 1000,
    refetchOnWindowFocus: true,
  })

  // Flatten all pages into a single array with deduplication (memoized to prevent infinite re-renders)
  const sources: SourceListResponse[] = useMemo(
    () => {
      const allSources = query.data?.pages.flatMap(page => page.sources) ?? []
      // Deduplicate by source ID to prevent duplicate key warnings
      const seen = new Set<string>()
      return allSources.filter(source => {
        if (seen.has(source.id)) {
          return false
        }
        seen.add(source.id)
        return true
      })
    },
    [query.data?.pages]
  )

  // Refetch function that resets to first page
  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sourcesInfinite(i_NotesId) })
  }, [queryClient, i_NotesId])

  return {
    sources,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    refetch,
    error: query.error,
  }
}

export function useSource(id: string) {
  const userEmail = useCurrentUserEmail()
  return useQuery({
    queryKey: [...QUERY_KEYS.source(id), { user: userEmail }],
    queryFn: () => sourcesApi.get(id),
    enabled: !!id && userEmail !== null,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  })
}

export function useCreateSource() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (data: CreateSourceRequest) => sourcesApi.create(data),
    onSuccess: (result: SourceResponse, variables) => {
      // Invalidate queries for all relevant i_Notes with immediate refetch
      if (variables.i_Notes) {
        variables.i_Notes.forEach(i_NotesId => {
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.sources(i_NotesId),
            refetchType: 'active' // Refetch active queries immediately
          })
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.sourcesInfinite(i_NotesId),
            refetchType: 'active'
          })
          queryClient.refetchQueries({
            queryKey: QUERY_KEYS.sourcesInfinite(i_NotesId),
            exact: true
          })
        })
      } else if (variables.i_Notes_id) {
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.sources(variables.i_Notes_id),
          refetchType: 'active'
        })
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.sourcesInfinite(variables.i_Notes_id),
          refetchType: 'active'
        })
        queryClient.refetchQueries({
          queryKey: QUERY_KEYS.sourcesInfinite(variables.i_Notes_id),
          exact: true
        })
      }

      // Invalidate general sources query too with immediate refetch
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.sources(),
        refetchType: 'active'
      })
      queryClient.refetchQueries({
        queryKey: QUERY_KEYS.sources(),
        exact: true
      })

      // Show different messages based on processing mode
      if (variables.async_processing) {
        toast({
          title: t.sources.sourceQueued,
          description: t.sources.sourceQueuedDesc,
        })
      } else {
        toast({
          title: t.common.success,
          description: t.sources.sourceAddedSuccess,
        })
      }
    },
    onError: (error: unknown) => {
      toast({
        title: t.common.error,
        description: getApiErrorMessage(error, (key) => t(key), t.sources.failedToAddSource),
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateSource() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSourceRequest }) =>
      sourcesApi.update(id, data),
    onSuccess: (_, { id }) => {
      // Invalidate ALL sources queries (both general and i_Notes-specific)
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.source(id) })
      toast({
        title: t.common.success,
        description: t.sources.sourceUpdatedSuccess,
      })
    },
    onError: (error: unknown) => {
      toast({
        title: t.common.error,
        description: getApiErrorMessage(error, (key) => t(key), t.sources.failedToUpdateSource),
        variant: 'destructive',
      })
    },
  })
}

export function useDeleteSource() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (id: string) => sourcesApi.delete(id),
    onSuccess: (_, id) => {
      // Invalidate ALL sources queries (both general and i_Notes-specific)
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      // Also invalidate the specific source
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.source(id) })
      toast({
        title: t.common.success,
        description: t.sources.sourceDeletedSuccess,
      })
    },
    onError: (error: unknown) => {
      toast({
        title: t.common.error,
        description: getApiErrorMessage(error, (key) => t(key), t.sources.failedToDeleteSource),
        variant: 'destructive',
      })
    },
  })
}

export function useFileUpload() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: ({ file, i_NotesId }: { file: File; i_NotesId: string }) =>
      sourcesApi.upload(file, i_NotesId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: QUERY_KEYS.sources(variables.i_NotesId) 
      })
      toast({
        title: t.common.success,
        description: t.sources.fileUploadedSuccess,
      })
    },
    onError: (error: unknown) => {
      toast({
        title: t.common.error,
        description: getApiErrorMessage(error, (key) => t(key), t.sources.failedToUploadFile),
        variant: 'destructive',
      })
    },
  })
}

export function useSourceStatus(sourceId: string, enabled = true) {
  return useQuery({
    queryKey: ['sources', sourceId, 'status'],
    queryFn: () => sourcesApi.status(sourceId),
    enabled: !!sourceId && enabled,
    refetchInterval: (query) => {
      // Auto-refresh every 2 seconds if processing
      // The query.state.data contains the SourceStatusResponse
      const data = query.state.data as SourceStatusResponse | undefined
      if (data?.status === 'running' || data?.status === 'queued' || data?.status === 'new') {
        return 2000
      }
      // No auto-refresh if completed, failed, or unknown
      return false
    },
    staleTime: 0, // Always consider status data stale for real-time updates
    retry: (failureCount, error) => {
      // Don't retry on 404 (source not found)
      const axiosError = error as { response?: { status?: number } }
      if (axiosError?.response?.status === 404) {
        return false
      }
      return failureCount < 3
    },
  })
}

export function useRetrySource() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: ({ sourceId, i_NotesId }: { sourceId: string; i_NotesId?: string }) =>
      sourcesApi.retry(sourceId, i_NotesId),
    onSuccess: (result, vars) => {
      const sourceId = vars.sourceId
      // Invalidate status query to refetch latest status
      queryClient.invalidateQueries({
        queryKey: ['sources', sourceId, 'status']
      })
      // Invalidate ALL sources queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.source(sourceId) })

      toast({
        title: t.sources.sourceRequeued,
        description: t.sources.sourceRequeuedDesc,
      })
    },
    onError: (error: unknown) => {
      toast({
        title: t.common.error,
        description: getApiErrorMessage(error, (key) => t(key), t.sources.failedToRetry),
        variant: 'destructive',
      })
    },
  })
}

export function useAddSourcesToi_Notes() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: async ({ i_NotesId, sourceIds }: { i_NotesId: string; sourceIds: string[] }) => {
      const { i_NotesApi } = await import('@/lib/api/i_Notes')

      // Use Promise.allSettled to handle partial failures gracefully
      const results = await Promise.allSettled(
        sourceIds.map(sourceId => i_NotesApi.addSource(i_NotesId, sourceId))
      )

      // Count successes and failures
      const successes = results.filter(r => r.status === 'fulfilled').length
      const failures = results.filter(r => r.status === 'rejected').length

      return { successes, failures, total: sourceIds.length }
    },
    onSuccess: (result, { i_NotesId, sourceIds }) => {
      // Invalidate ALL sources queries to refresh all lists
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      // Specifically invalidate the i_Notes's sources
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sources(i_NotesId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sourcesInfinite(i_NotesId) })
      queryClient.refetchQueries({ queryKey: QUERY_KEYS.sourcesInfinite(i_NotesId), exact: true })
      // Invalidate each affected source
      sourceIds.forEach(sourceId => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.source(sourceId) })
      })

      // Show appropriate toast based on results
      if (result.failures === 0) {
        toast({
          title: t.common.success,
          description: t.sources.sourcesAddedToi_Notes.replace('{count}', result.successes.toString()),
        })
      } else if (result.successes === 0) {
        toast({
          title: t.common.error,
          description: t.sources.failedToAddSourcesToi_Notes,
          variant: 'destructive',
        })
      } else {
        toast({
          title: t.common.success,
          description: t.sources.partialAddSuccess
            .replace('{success}', result.successes.toString())
            .replace('{failed}', result.failures.toString()),
          variant: 'default',
        })
      }
    },
    onError: (error: unknown) => {
      toast({
        title: t.common.error,
        description: getApiErrorMessage(error, (key) => t(key), t.sources.failedToAddSourcesToi_Notes),
        variant: 'destructive',
      })
    },
  })
}

export function useRemoveSourceFromi_Notes() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: async ({ i_NotesId, sourceId }: { i_NotesId: string; sourceId: string }) => {
      // This will call the API we created
      const { i_NotesApi } = await import('@/lib/api/i_Notes')
      return i_NotesApi.removeSource(i_NotesId, sourceId)
    },
    onSuccess: (_, { i_NotesId, sourceId }) => {
      // Invalidate ALL sources queries to refresh all lists
      queryClient.invalidateQueries({ queryKey: ['sources'] })
      // Specifically invalidate the i_Notes's sources
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sources(i_NotesId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sourcesInfinite(i_NotesId) })
      queryClient.refetchQueries({ queryKey: QUERY_KEYS.sourcesInfinite(i_NotesId), exact: true })
      // Also invalidate the specific source
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.source(sourceId) })

      toast({
        title: t.common.success,
        description: t.sources.sourceRemovedFromi_Notes,
      })
    },
    onError: (error: unknown) => {
      toast({
        title: t.common.error,
        description: getApiErrorMessage(error, (key) => t(key), t.sources.failedToRemoveSourceFromi_Notes),
        variant: 'destructive',
      })
    },
  })
}
