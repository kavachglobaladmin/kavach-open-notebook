import apiClient from './client'
import { getApiUrl } from '@/lib/config'
import {
  SourceChatSession,
  SourceChatSessionWithMessages,
  CreateSourceChatSessionRequest,
  UpdateSourceChatSessionRequest,
  SendMessageRequest
} from '@/lib/types/api'

/**
 * Strip SurrealDB table prefix from a source ID.
 * "source:abc123" → "abc123"
 * Colons in URL path segments cause FastAPI route-matching failures.
 */
function cleanSourceId(id: string): string {
  return id.startsWith('source:') ? id.slice(7) : id
}

/**
 * Strip SurrealDB table prefix from a session ID.
 * "chat_session:abc123" → "abc123"
 */
function cleanSessionId(id: string): string {
  return id.startsWith('chat_session:') ? id.slice(13) : id
}

export const sourceChatApi = {
  // Session management
  createSession: async (sourceId: string, data: Omit<CreateSourceChatSessionRequest, 'source_id'>) => {
    const cleanId = cleanSourceId(sourceId)
    const response = await apiClient.post<SourceChatSession>(
      `/sources/${cleanId}/chat/sessions`,
      { ...data, source_id: cleanId }
    )
    return response.data
  },

  listSessions: async (sourceId: string) => {
    const cleanId = cleanSourceId(sourceId)
    const response = await apiClient.get<SourceChatSession[]>(
      `/sources/${cleanId}/chat/sessions`
    )
    return response.data
  },

  getSession: async (sourceId: string, sessionId: string) => {
    const cleanSrc = cleanSourceId(sourceId)
    const cleanSess = cleanSessionId(sessionId)
    const response = await apiClient.get<SourceChatSessionWithMessages>(
      `/sources/${cleanSrc}/chat/sessions/${cleanSess}`
    )
    return response.data
  },

  updateSession: async (sourceId: string, sessionId: string, data: UpdateSourceChatSessionRequest) => {
    const cleanSrc = cleanSourceId(sourceId)
    const cleanSess = cleanSessionId(sessionId)
    const response = await apiClient.put<SourceChatSession>(
      `/sources/${cleanSrc}/chat/sessions/${cleanSess}`,
      data
    )
    return response.data
  },

  deleteSession: async (sourceId: string, sessionId: string) => {
    const cleanSrc = cleanSourceId(sourceId)
    const cleanSess = cleanSessionId(sessionId)
    await apiClient.delete(`/sources/${cleanSrc}/chat/sessions/${cleanSess}`)
  },

  // Messaging with streaming
  sendMessage: async (sourceId: string, sessionId: string, data: SendMessageRequest) => {
    const cleanSrc = cleanSourceId(sourceId)
    const cleanSess = cleanSessionId(sessionId)
    const apiUrl = await getApiUrl()
    const baseURL = apiUrl ? `${apiUrl}/api` : '/api'
    const url = `${baseURL}/sources/${cleanSrc}/chat/sessions/${cleanSess}/messages`

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
