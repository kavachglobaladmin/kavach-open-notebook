import apiClient from './client'
import { getApiUrl } from '@/lib/config'
import {
  SourceChatSession,
  SourceChatSessionWithMessages,
  CreateSourceChatSessionRequest,
  UpdateSourceChatSessionRequest,
  SendMessageRequest
} from '@/lib/types/api'

export const sourceChatApi = {
  // Session management
  createSession: async (sourceId: string, data: Omit<CreateSourceChatSessionRequest, 'source_id'>) => {
    // Extract clean ID without "source:" prefix for the request body
    const cleanId = sourceId.startsWith('source:') ? sourceId.slice(7) : sourceId
    const response = await apiClient.post<SourceChatSession>(
      `/sources/${sourceId}/chat/sessions`,
      { ...data, source_id: cleanId }  // Include source_id in the request body
    )
    return response.data
  },

  listSessions: async (sourceId: string) => {
    const response = await apiClient.get<SourceChatSession[]>(
      `/sources/${sourceId}/chat/sessions`
    )
    return response.data
  },

  getSession: async (sourceId: string, sessionId: string) => {
    const response = await apiClient.get<SourceChatSessionWithMessages>(
      `/sources/${sourceId}/chat/sessions/${sessionId}`
    )
    return response.data
  },

  updateSession: async (sourceId: string, sessionId: string, data: UpdateSourceChatSessionRequest) => {
    const response = await apiClient.put<SourceChatSession>(
      `/sources/${sourceId}/chat/sessions/${sessionId}`,
      data
    )
    return response.data
  },

  deleteSession: async (sourceId: string, sessionId: string) => {
    await apiClient.delete(`/sources/${sourceId}/chat/sessions/${sessionId}`)
  },

  // Messaging with streaming
  sendMessage: async (sourceId: string, sessionId: string, data: SendMessageRequest) => {
    const apiUrl = await getApiUrl()
    const baseURL = apiUrl ? `${apiUrl}/api` : '/api'
    const url = `${baseURL}/sources/${sourceId}/chat/sessions/${sessionId}/messages`

    // Build auth headers — must match apiClient interceptor exactly.
    // The backend PasswordAuthMiddleware validates the raw API password,
    // NOT a JWT. The raw password is stored in sessionStorage as
    // 'kavach_api_password' (memory-only, survives page reload within tab).
    const extraHeaders: Record<string, string> = {}
    if (typeof window !== 'undefined') {
      try {
        // 1. Prefer raw API password from sessionStorage (same as apiClient)
        const apiPassword = sessionStorage.getItem('kavach_api_password')
        if (apiPassword) {
          extraHeaders['Authorization'] = `Bearer ${apiPassword}`
        }

        // 2. Resolve user email for scoping (same fallback chain as apiClient)
        const authStorage = localStorage.getItem('auth-storage')
        if (authStorage) {
          const { state } = JSON.parse(authStorage)
          const userEmail = state?.currentUserEmail ?? null
          if (userEmail) {
            extraHeaders['X-User-Email'] = userEmail
          }
        }
      } catch { /* ignore */ }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Streaming failed: ${response.status} - ${error}`)
    }

    if (!response.body) {
      throw new Error('No response body')
    }

    return response.body
  }
}
