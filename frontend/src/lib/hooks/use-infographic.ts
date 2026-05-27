import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { infographicApi, InfographicResponse } from '@/lib/api/infographic'
import { toast } from '@/lib/notifications/toast'

const INFOGRAPHIC_QUERY_KEY = (sourceId: string) => ['infographic', sourceId]

export function useInfographic(sourceId: string | null, options?: { enabled?: boolean }) {
  return useQuery<InfographicResponse | null>({
    queryKey: INFOGRAPHIC_QUERY_KEY(sourceId || ''),
    queryFn: async () => {
      if (!sourceId) return null
      
      // Try cache first
      const cached = infographicApi.getCached(sourceId)
      if (cached) {
        console.log('[useInfographic] Using cached data for source:', sourceId)
        return cached
      }
      
      // Generate if not cached
      console.log('[useInfographic] Generating infographic for source:', sourceId)
      return await infographicApi.generate(sourceId)
    },
    enabled: !!sourceId && (options?.enabled !== false),
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

export function useGenerateInfographic() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (sourceId: string) => {
      console.log('[useGenerateInfographic] Starting generation for source:', sourceId)
      return await infographicApi.generate(sourceId)
    },
    onSuccess: (data, sourceId) => {
      console.log('[useGenerateInfographic] Success, invalidating cache for source:', sourceId)
      queryClient.invalidateQueries({ queryKey: INFOGRAPHIC_QUERY_KEY(sourceId) })
      toast.success('Infographic generated successfully')
    },
    onError: (error) => {
      console.error('[useGenerateInfographic] Error:', error)
      toast.error('Failed to generate infographic')
    },
  })
}

export function useClearInfographicCache() {
  const queryClient = useQueryClient()

  return (sourceId: string) => {
    infographicApi.clearCache(sourceId)
    queryClient.invalidateQueries({ queryKey: INFOGRAPHIC_QUERY_KEY(sourceId) })
  }
}
