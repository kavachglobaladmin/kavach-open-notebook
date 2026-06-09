import apiClient from './client'
import { SearchRequest, SearchResponse, AskRequest } from '@/lib/types/search'

export const searchApi = {
  // Standard search (non-streaming)
  search: async (params: SearchRequest) => {
    const response = await apiClient.post<SearchResponse>('/search', params)
    return response.data
  },

  // Ask with streaming (uses relative URL for Docker compatibility)
  askKnowledgeBase: async (params: AskRequest) => {
    // Get auth token using the same logic as apiClient interceptor
    // apiPassword (raw backend token) is preferred over local JWT
    let token = null
    let userEmail = null
    if (typeof window !== 'undefined') {
      // First try: apiPassword from Zustand store (in-memory)
      try {
        const { useAuthStore } = await import('@/lib/stores/auth-store')
        const storeState = useAuthStore.getState()
        token = storeState.apiPassword ?? sessionStorage.getItem('kavach_api_password')
        userEmail = storeState.currentUserEmail
      } catch (error) {
        console.error('Error reading auth store:', error)
      }

      // Fallback: read from sessionStorage directly
      if (!token) {
        token = sessionStorage.getItem('kavach_api_password')
      }

      // Fallback: user email from localStorage
      if (!userEmail) {
        try {
          const authStorage = localStorage.getItem('auth-storage')
          if (authStorage) {
            const { state } = JSON.parse(authStorage)
            userEmail = state?.currentUserEmail ?? null
          }
        } catch (error) {
          console.error('Error parsing auth storage:', error)
        }
      }
    }

    // Use relative URL to leverage Next.js rewrites
    // This works both in dev (Next.js proxy) and production (Docker network)
    const url = '/api/search/ask'

    // Use fetch with ReadableStream for SSE
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(userEmail && { 'X-User-Email': userEmail }),
      },
      body: JSON.stringify(params)
    })

    if (!response.ok) {
      // Try to extract error message from response
      let errorMessage = `HTTP error! status: ${response.status}`
      try {
        const errorData = await response.json()
        errorMessage = errorData.detail || errorData.message || errorMessage
      } catch {
        // If response isn't JSON, use status text
        errorMessage = response.statusText || errorMessage
      }
      throw new Error(errorMessage)
    }

    if (!response.body) {
      throw new Error('No response body received')
    }

    return response.body
  }
}
