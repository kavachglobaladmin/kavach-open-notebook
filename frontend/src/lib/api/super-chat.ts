import apiClient from './client'
import { getApiUrl } from '@/lib/config'
import {
  NotebookChatSession,
  NotebookChatSessionWithMessages,
  CreateNotebookChatSessionRequest,
  UpdateNotebookChatSessionRequest,
  SendNotebookChatMessageRequest,
  BuildContextRequest,
  BuildContextResponse,
} from '@/lib/types/api'

export const superChatApi = {
  listSessions: async (notebookId: string) => {
    const response = await apiClient.get<NotebookChatSession[]>(
      `/super-chat/sessions`,
      { params: { notebook_id: notebookId } }
    )
    return response.data
  },

  createSession: async (data: CreateNotebookChatSessionRequest) => {
    const response = await apiClient.post<NotebookChatSession>(
      `/super-chat/sessions`,
      data
    )
    return response.data
  },

  getSession: async (sessionId: string) => {
    const response = await apiClient.get<NotebookChatSessionWithMessages>(
      `/super-chat/sessions/${sessionId}`
    )
    return response.data
  },

  updateSession: async (
    sessionId: string,
    data: UpdateNotebookChatSessionRequest,
  ) => {
    const response = await apiClient.put<NotebookChatSession>(
      `/super-chat/sessions/${sessionId}`,
      data
    )
    return response.data
  },

  deleteSession: async (sessionId: string) => {
    await apiClient.delete(`/super-chat/sessions/${sessionId}`)
  },

  sendMessageStream: async (
    data: SendNotebookChatMessageRequest,
    onToken: (token: string) => void,
    onSuggestedQuestions?: (questions: string[]) => void,
  ) => {
    const apiUrl = await getApiUrl()
    const baseURL = apiUrl ? `${apiUrl}/api` : '/api'
    const url = `${baseURL}/super-chat/stream-execute`

    const extraHeaders: Record<string, string> = {}
    if (typeof window !== 'undefined') {
      try {
        const apiPassword = sessionStorage.getItem('kavach_api_password')
        if (apiPassword) {
          extraHeaders['Authorization'] = `Bearer ${apiPassword}`
        }

        const authStorage = localStorage.getItem('auth-storage')
        if (authStorage) {
          const { state } = JSON.parse(authStorage)
          const userEmail = state?.currentUserEmail ?? null
          if (userEmail) {
            extraHeaders['X-User-Email'] = userEmail
          }
        }
      } catch {
        // ignore auth header resolution errors
      }
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
    let accumulatedResponse = ''
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines[lines.length - 1]

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i].trim()
          if (line === ':ping' || line === '') continue

          if (!line.startsWith('data: ')) continue

          let eventData: {
            token?: string | null
            type?: string
            questions?: string[]
            done?: boolean
            error?: string
            session_id?: string
          }

          try {
            const jsonStr = line.slice(6).trim()
            eventData = JSON.parse(jsonStr)
          } catch (parseError) {
            console.warn('Failed to parse SSE line:', line, parseError)
            continue
          }

          if (eventData.token !== undefined && eventData.token !== null) {
            const token = eventData.token
            accumulatedResponse += token
            onToken(token)
          }

          if (
            eventData.type === 'suggested_questions' &&
            eventData.questions &&
            onSuggestedQuestions
          ) {
            onSuggestedQuestions(eventData.questions)
          }

          if (eventData.done === true) {
            return {
              session_id: eventData.session_id || '',
              accumulated_response: accumulatedResponse,
            }
          }

          if (eventData.error) {
            throw new Error(eventData.error)
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    return {
      session_id: '',
      accumulated_response: accumulatedResponse,
    }
  },

  buildContext: async (data: BuildContextRequest) => {
    const response = await apiClient.post<BuildContextResponse>(
      `/super-chat/context`,
      data
    )
    return response.data
  },
}

export default superChatApi
