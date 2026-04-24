import apiClient from './client'
import { getApiUrl } from '@/lib/config'
import {
  NotebookChatSession,
  NotebookChatSessionWithMessages,
  CreateNotebookChatSessionRequest,
  UpdateNotebookChatSessionRequest,
  SendNotebookChatMessageRequest,
  NotebookChatMessage,
  BuildContextRequest,
  BuildContextResponse,
} from '@/lib/types/api'

export const chatApi = {
  // Session management
  listSessions: async (notebookId: string) => {
    const response = await apiClient.get<NotebookChatSession[]>(
      `/chat/sessions`,
      { params: { notebook_id: notebookId } }
    )
    return response.data
  },

  createSession: async (data: CreateNotebookChatSessionRequest) => {
    const response = await apiClient.post<NotebookChatSession>(
      `/chat/sessions`,
      data
    )
    return response.data
  },

  getSession: async (sessionId: string) => {
    const response = await apiClient.get<NotebookChatSessionWithMessages>(
      `/chat/sessions/${sessionId}`
    )
    return response.data
  },

  updateSession: async (sessionId: string, data: UpdateNotebookChatSessionRequest) => {
    const response = await apiClient.put<NotebookChatSession>(
      `/chat/sessions/${sessionId}`,
      data
    )
    return response.data
  },

  deleteSession: async (sessionId: string) => {
    await apiClient.delete(`/chat/sessions/${sessionId}`)
  },

  // Messaging (synchronous, no streaming)
  sendMessage: async (data: SendNotebookChatMessageRequest) => {
    const response = await apiClient.post<{
      session_id: string
      messages: NotebookChatMessage[]
    }>(
      `/chat/execute`,
      data
    )
    return response.data
  },

  // Messaging with streaming (real-time token generation)
  sendMessageStream: async (
    data: SendNotebookChatMessageRequest,
    onToken: (token: string) => void,
    onSuggestedQuestions?: (questions: string[]) => void
  ) => {
    const apiUrl = await getApiUrl()
    const baseURL = apiUrl ? `${apiUrl}/api` : '/api'
    const url = `${baseURL}/chat/stream-execute`

    // Build auth headers from persisted auth-storage (same as apiClient interceptor)
    const extraHeaders: Record<string, string> = {}
    if (typeof window !== 'undefined') {
      try {
        const authStorage = localStorage.getItem('auth-storage')
        if (authStorage) {
          const { state } = JSON.parse(authStorage)
          if (state?.token) {
            extraHeaders['Authorization'] = `Bearer ${state.token}`
          }
          if (state?.currentUserEmail) {
            extraHeaders['X-User-Email'] = state.currentUserEmail
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
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Streaming failed: ${response.status} - ${error}`)
    }

    if (!response.body) {
      throw new Error('No response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let accumulated_response = ''
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true })

        // Split by newline and process complete lines
        const lines = buffer.split('\n')

        // Keep the last incomplete line in the buffer
        buffer = lines[lines.length - 1]

        // Process complete lines
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim()

          // Skip empty lines and pings
          if (line === ':ping' || line === '') continue

          // Look for SSE data format
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim()
              const eventData = JSON.parse(jsonStr)

              // Handle token event
              if (eventData.token !== undefined && eventData.token !== null) {
                const token = eventData.token
                accumulated_response += token
                onToken(token)
              }

              // Handle suggested_questions event
              if (eventData.type === 'suggested_questions' && eventData.questions && onSuggestedQuestions) {
                onSuggestedQuestions(eventData.questions)
              }

              // Handle done event
              if (eventData.done === true) {
                return {
                  session_id: eventData.session_id || '',
                  accumulated_response
                }
              }
              
              // Handle error event
              if (eventData.error) {
                console.error('❌ Stream error event:', eventData.error)
                throw new Error(eventData.error)
              }
            } catch (parseError) {
              console.warn('⚠️ Failed to parse SSE line:', line, 'Error:', parseError)
              continue
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return {
      session_id: '',
      accumulated_response
    }
  },

  buildContext: async (data: BuildContextRequest) => {
    const response = await apiClient.post<BuildContextResponse>(
      `/chat/context`,
      data
    )
    return response.data
  },
}

export default chatApi
