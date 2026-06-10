// 'use client'

// import { useState, useCallback, useEffect } from 'react'
// import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
// import { toast } from 'sonner'
// import { getApiErrorMessage } from '@/lib/utils/error-handler'
// import { useTranslation } from '@/lib/hooks/use-translation'
// import { chatApi } from '@/lib/api/chat'
// import { QUERY_KEYS } from '@/lib/api/query-client'
// import {
//   i_NotesChatMessage,
//   Createi_NotesChatSessionRequest,
//   Updatei_NotesChatSessionRequest,
//   SourceListResponse,
//   NoteResponse
// } from '@/lib/types/api'
// import { ContextSelections } from '@/app/(dashboard)/i_Notes/[id]/page'

// interface Usei_NotesChatParams {
//   i_NotesId: string
//   sources: SourceListResponse[]
//   notes: NoteResponse[]
//   contextSelections: ContextSelections
// }

// export function usei_NotesChat({ i_NotesId, sources, notes, contextSelections }: Usei_NotesChatParams) {
//   const { t } = useTranslation()
//   const queryClient = useQueryClient()
//   const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
//   const [messages, setMessages] = useState<i_NotesChatMessage[]>([])
//   const [isSending, setIsSending] = useState(false)
//   const [tokenCount, setTokenCount] = useState<number>(0)
//   const [charCount, setCharCount] = useState<number>(0)
//   // Pending model override for when user changes model before a session exists
//   const [pendingModelOverride, setPendingModelOverride] = useState<string | null>(null)
//   // Suggested follow-up questions
//   const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])

//   // Fetch sessions for this i_Notes
//   const {
//     data: sessions = [],
//     isLoading: loadingSessions,
//     refetch: refetchSessions
//   } = useQuery({
//     queryKey: QUERY_KEYS.i_NotesChatSessions(i_NotesId),
//     queryFn: () => chatApi.listSessions(i_NotesId),
//     enabled: !!i_NotesId
//   })

//   // Fetch current session with messages
//   const {
//     data: currentSession,
//     // refetch: refetchCurrentSession
//   } = useQuery({
//     queryKey: QUERY_KEYS.i_NotesChatSession(currentSessionId!),
//     queryFn: () => chatApi.getSession(currentSessionId!),
//     enabled: !!i_NotesId && !!currentSessionId
//   })

//   // Update messages when current session changes
//   useEffect(() => {
//     if (currentSession?.messages) {
//       console.log('📬 [Hook] Current session loaded with messages:', currentSession.messages.length)

//       setMessages(prevMessages => {
//         const serverMessages = currentSession.messages || []

//         // Keep optimistic messages that are not already represented in the server payload.
//         const optimisticMessages = prevMessages.filter(optimistic => {
//           if (optimistic.id.startsWith('temp-') || optimistic.id.startsWith('ai-')) {
//             return !serverMessages.some(server =>
//               server.type === optimistic.type &&
//               server.content.trim() === optimistic.content.trim() &&
//               Math.abs(new Date(server.timestamp).getTime() - new Date(optimistic.timestamp).getTime()) < 30000
//             )
//           }
//           return true
//         })

//         // Combine and deduplicate by ID (prefer server messages over optimistic)
//         const merged = [...serverMessages, ...optimisticMessages]
//         const seenIds = new Set<string>()
//         const deduplicated = merged.filter(msg => {
//           if (seenIds.has(msg.id)) {
//             console.warn(`🔴 Duplicate message ID detected: ${msg.id}`)
//             return false
//           }
//           seenIds.add(msg.id)
//           return true
//         })

//         return deduplicated
//       })
//     }

//     // ✅ Load persisted suggested questions when session loads
//     if (currentSession?.suggested_questions && currentSession.suggested_questions.length > 0) {
//       console.log('💡 [Hook] Loading persisted suggestions from session:', currentSession.suggested_questions)
//       setSuggestedQuestions(currentSession.suggested_questions)
//     } else {
//       console.log('⚠️ [Hook] No suggestions in current session')
//       setSuggestedQuestions([])
//     }
//   }, [currentSession])

//   // Auto-select most recent session when sessions are loaded
//   useEffect(() => {
//     if (sessions.length > 0 && !currentSessionId) {
//       // Sessions are sorted by created date desc from API
//       const mostRecentSession = sessions[0]
//       setCurrentSessionId(mostRecentSession.id)
//     }
//   }, [sessions, currentSessionId])

//   // Create session mutation
//   const createSessionMutation = useMutation({
//     mutationFn: (data: Createi_NotesChatSessionRequest) =>
//       chatApi.createSession(data),
//     onSuccess: (newSession) => {
//       queryClient.invalidateQueries({
//         queryKey: QUERY_KEYS.i_NotesChatSessions(i_NotesId)
//       })
//       setCurrentSessionId(newSession.id)
//       toast.success(t.chat.sessionCreated)
//     },
//     onError: (err: unknown) => {
//       const error = err as { response?: { data?: { detail?: string } }, message?: string };
//       toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToCreateSession'))
//     }
//   })

//   // Update session mutation
//   const updateSessionMutation = useMutation({
//     mutationFn: ({ sessionId, data }: {
//       sessionId: string
//       data: Updatei_NotesChatSessionRequest
//     }) => chatApi.updateSession(sessionId, data),
//     onSuccess: () => {
//       queryClient.invalidateQueries({
//         queryKey: QUERY_KEYS.i_NotesChatSessions(i_NotesId)
//       })
//       queryClient.invalidateQueries({
//         queryKey: QUERY_KEYS.i_NotesChatSession(currentSessionId!)
//       })
//       toast.success(t.chat.sessionUpdated)
//     },
//     onError: (err: unknown) => {
//       const error = err as { response?: { data?: { detail?: string } }, message?: string };
//       toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToUpdateSession'))
//     }
//   })

//   // Delete session mutation
//   const deleteSessionMutation = useMutation({
//     mutationFn: (sessionId: string) =>
//       chatApi.deleteSession(sessionId),
//     onSuccess: (_, deletedId) => {
//       queryClient.invalidateQueries({
//         queryKey: QUERY_KEYS.i_NotesChatSessions(i_NotesId)
//       })
//       if (currentSessionId === deletedId) {
//         setCurrentSessionId(null)
//         setMessages([])
//       }
//       toast.success(t.chat.sessionDeleted)
//     },
//     onError: (err: unknown) => {
//       const error = err as { response?: { data?: { detail?: string } }, message?: string };
//       toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToDeleteSession'))
//     }
//   })

//   // Build context from sources and notes based on user selections
//   const buildContext = useCallback(async () => {
//     // Build context_config mapping IDs to selection modes
//     const context_config: { sources: Record<string, string>, notes: Record<string, string> } = {
//       sources: {},
//       notes: {}
//     }

//     // Map source selections
//     sources.forEach(source => {
//       const mode = contextSelections.sources[source.id]
//       if (mode === 'insights') {
//         context_config.sources[source.id] = 'insights'
//       } else if (mode === 'full') {
//         context_config.sources[source.id] = 'full content'
//       } else {
//         context_config.sources[source.id] = 'not in'
//       }
//     })

//     // Map note selections
//     notes.forEach(note => {
//       const mode = contextSelections.notes[note.id]
//       if (mode === 'full') {
//         context_config.notes[note.id] = 'full content'
//       } else {
//         context_config.notes[note.id] = 'not in'
//       }
//     })

//     // Call API to build context with actual content
//     const response = await chatApi.buildContext({
//       i_Notes_id: i_NotesId,
//       context_config
//     })

//     // Store token and char counts
//     setTokenCount(response.token_count)
//     setCharCount(response.char_count)

//     return response.context
//   }, [i_NotesId, sources, notes, contextSelections])

//   // Send message (synchronous, no streaming)
//   const sendMessage = useCallback(async (message: string, modelOverride?: string) => {
//     let sessionId = currentSessionId

//     // Auto-create session if none exists
//     if (!sessionId) {
//       try {
//         const defaultTitle = message.length > 30
//           ? `${message.substring(0, 30)}...`
//           : message
//         const newSession = await chatApi.createSession({
//           i_Notes_id: i_NotesId,
//           title: defaultTitle,
//           // Include pending model override when creating session
//           model_override: pendingModelOverride ?? undefined
//         })
//         sessionId = newSession.id
//         setCurrentSessionId(sessionId)
//         // Clear pending model override now that it's applied to the session
//         setPendingModelOverride(null)
//         queryClient.invalidateQueries({
//           queryKey: QUERY_KEYS.i_NotesChatSessions(i_NotesId)
//         })
//       } catch (err: unknown) {
//         const error = err as { response?: { data?: { detail?: string } }, message?: string };
//         toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToCreateSession'))
//         return
//       }
//     }

//     // Add user message optimistically
//     const userMessage: i_NotesChatMessage = {
//       id: `temp-${Date.now()}`,
//       type: 'human',
//       content: message,
//       timestamp: new Date().toISOString()
//     }
//     setMessages(prev => [...prev, userMessage])
//     setIsSending(true)
//     // Clear previous suggested questions when sending new message
//     setSuggestedQuestions([])

//     // Create AI message placeholder
//     const aiMessageId = `ai-${Date.now()}`
//     const aiMessage: i_NotesChatMessage = {
//       id: aiMessageId,
//       type: 'ai',
//       content: '',
//       timestamp: new Date().toISOString()
//     }
//     setMessages(prev => [...prev, aiMessage])

//     try {
//       // Build context and send message
//       const context = await buildContext()

//       // Use streaming API with token callback and suggested questions callback
//       await chatApi.sendMessageStream({
//         session_id: sessionId,
//         message,
//         context,
//         model_override: modelOverride ?? (currentSession?.model_override ?? undefined)
//       }, (token) => {
//         // Update AI message content with streamed token
//         setMessages(prev => {
//           const newMessages = [...prev]
//           const msgIndex = newMessages.findIndex(m => m.id === aiMessageId)
//           if (msgIndex >= 0) {
//             const currentMsg = newMessages[msgIndex]
//             newMessages[msgIndex] = {
//               ...currentMsg,
//               content: currentMsg.content + token
//             }
//           }
//           return newMessages
//         })
//       }, (questions) => {
//         // Handle suggested questions from stream
//         console.log('💡 [Hook] Received suggested questions from stream:', questions)
//         setSuggestedQuestions(questions)
//       })

//       // Refetch current session to get updated data
//       console.log('🔄 [Hook] Refetching session after stream completes...')
//       const updatedSession = await refetchCurrentSession()

//       // Load persisted suggestions from session after refetch
//       if (updatedSession?.data?.suggested_questions) {
//         console.log('💾 [Hook] Loaded persisted suggestions from session:', updatedSession.data.suggested_questions)
//         setSuggestedQuestions(updatedSession.data.suggested_questions)
//       }
//     } catch (err: unknown) {
//       const error = err as { response?: { data?: { detail?: string } }, message?: string };
//       console.error('Error sending message:', error)
//       toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToSendMessage'))
//       // Remove optimistic messages on error
//       setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-') && msg.id !== aiMessageId))
//     } finally {
//       setIsSending(false)
//     }
//   }, [
//     i_NotesId,
//     currentSessionId,
//     currentSession,
//     pendingModelOverride,
//     buildContext,
//     // refetchCurrentSession,
//     queryClient,
//     t
//   ])

//   // Switch session
//   const switchSession = useCallback((sessionId: string) => {
//     setCurrentSessionId(sessionId)
//   }, [])

//   // Create session
//   const createSession = useCallback((title?: string) => {
//     return createSessionMutation.mutate({
//       i_Notes_id: i_NotesId,
//       title
//     })
//   }, [createSessionMutation, i_NotesId])

//   // Update session
//   const updateSession = useCallback((sessionId: string, data: Updatei_NotesChatSessionRequest) => {
//     return updateSessionMutation.mutate({
//       sessionId,
//       data
//     })
//   }, [updateSessionMutation])

//   // Delete session
//   const deleteSession = useCallback((sessionId: string) => {
//     return deleteSessionMutation.mutate(sessionId)
//   }, [deleteSessionMutation])

//   // Set model override - handles both existing sessions and pending state
//   const setModelOverride = useCallback((model: string | null) => {
//     if (currentSessionId) {
//       // Session exists - update it directly
//       updateSessionMutation.mutate({
//         sessionId: currentSessionId,
//         data: { model_override: model }
//       })
//     } else {
//       // No session yet - store as pending
//       setPendingModelOverride(model)
//     }
//   }, [currentSessionId, updateSessionMutation])

//   // Update token/char counts when context selections change
//   useEffect(() => {
//     const updateContextCounts = async () => {
//       try {
//         await buildContext()
//       } catch (error) {
//         console.error('Error updating context counts:', error)
//       }
//     }
//     updateContextCounts()
//   }, [buildContext])

//   return {
//     // State
//     sessions,
//     currentSession: currentSession || sessions.find(s => s.id === currentSessionId),
//     currentSessionId,
//     messages,
//     isSending,
//     loadingSessions,
//     tokenCount,
//     charCount,
//     pendingModelOverride,
//     suggestedQuestions,

//     // Actions
//     createSession,
//     updateSession,
//     deleteSession,
//     switchSession,
//     sendMessage,
//     setModelOverride,
//   }
// }




'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/notifications/toast'
import { getApiErrorMessage } from '@/lib/utils/error-handler'
import { useTranslation } from '@/lib/hooks/use-translation'
import { chatApi } from '@/lib/api/chat'
import { QUERY_KEYS } from '@/lib/api/query-client'
import {
  i_NotesChatMessage,
  Createi_NotesChatSessionRequest,
  Updatei_NotesChatSessionRequest,
  SourceListResponse,
  NoteResponse,
  BuildContextResponse
} from '@/lib/types/api'
import { ContextSelections } from '@/app/(dashboard)/i_Notes/[id]/page'

function getEffectiveSourceMode(
  source: SourceListResponse,
  selections: ContextSelections['sources'],
) {
  return selections[source.id] ?? (source.insights_count > 0 ? 'insights' : 'full')
}

function getEffectiveNoteMode(
  note: NoteResponse,
  selections: ContextSelections['notes'],
) {
  return selections[note.id] ?? 'full'
}

type FolderContext = {
  id: string
  name: string
  sources: SourceListResponse[]
  notes: NoteResponse[]
}

function mergeSessionMessages(
  previousMessages: i_NotesChatMessage[],
  serverMessages: i_NotesChatMessage[],
) {
  const getTimestamp = (timestamp?: string | null) => {
    if (!timestamp) return null

    const value = new Date(timestamp).getTime()
    return Number.isFinite(value) ? value : null
  }

  const contentsMatch = (serverContent: string, optimisticContent: string) => {
    if (!serverContent && !optimisticContent) return true
    if (!serverContent || !optimisticContent) return false

    return (
      serverContent === optimisticContent ||
      serverContent.startsWith(optimisticContent) ||
      optimisticContent.startsWith(serverContent)
    )
  }

  const merged = [...serverMessages]

  previousMessages.forEach((optimistic) => {
    let matchIndex = -1

    for (let index = merged.length - 1; index >= 0; index -= 1) {
      const server = merged[index]
      if (server.type !== optimistic.type) {
        continue
      }

      const serverContent = server.content.trim()
      const optimisticContent = optimistic.content.trim()
      if (!contentsMatch(serverContent, optimisticContent)) {
        continue
      }

      const serverTime = getTimestamp(server.timestamp)
      const optimisticTime = getTimestamp(optimistic.timestamp)

      if (serverTime !== null && optimisticTime !== null) {
        if (Math.abs(serverTime - optimisticTime) >= 30000) {
          continue
        }
      }

      matchIndex = index
      break
    }

    if (matchIndex >= 0) {
      const serverMessage = merged[matchIndex]
      if (optimistic.content.length > serverMessage.content.length) {
        merged[matchIndex] = {
          ...serverMessage,
          content: optimistic.content,
        }
      }
      return
    }

    if (optimistic.id.startsWith('temp-') || optimistic.id.startsWith('ai-')) {
      merged.push(optimistic)
    }
  })

  const seenIds = new Set<string>()
  return merged.filter((message) => {
    if (seenIds.has(message.id)) return false
    seenIds.add(message.id)
    return true
  })
}

interface Usei_NotesChatParams {
  i_NotesId: string
  sources: SourceListResponse[]
  notes: NoteResponse[]
  contextSelections: ContextSelections
  folderContexts?: Array<{
    id: string
    name: string
    sources: SourceListResponse[]
    notes: NoteResponse[]
  }>
}

function normalizeRecordId(value: string | null | undefined) {
  return value?.trim() ?? ''
}

export function usei_NotesChat({ i_NotesId, sources, notes, contextSelections, folderContexts = [] }: Usei_NotesChatParams) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<i_NotesChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const isSendingRef = useRef(false)
  const [tokenCount, setTokenCount] = useState<number>(0)
  const [charCount, setCharCount] = useState<number>(0)
  const [pendingModelOverride, setPendingModelOverride] = useState<string | null>(null)
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])

  // Fetch sessions for this i_Notes
  const {
    data: sessions = [],
    isLoading: loadingSessions,
  } = useQuery({
    queryKey: QUERY_KEYS.i_NotesChatSessions(i_NotesId),
    queryFn: () => chatApi.listSessions(i_NotesId),
    enabled: !!i_NotesId
  })

  // Fetch current session with messages
  const {
    data: currentSession,
    refetch: refetchCurrentSession
  } = useQuery({
    queryKey: QUERY_KEYS.i_NotesChatSession(currentSessionId!),
    queryFn: () => chatApi.getSession(currentSessionId!),
    enabled: !!i_NotesId && !!currentSessionId
  })

  // Update messages when current session changes
  useEffect(() => {
    // If no session is selected, clear messages
    if (!currentSessionId) {
      setMessages([])
      setSuggestedQuestions([])
      return
    }

    if (currentSession?.messages) {
      setMessages((prevMessages) =>
        mergeSessionMessages(prevMessages, currentSession.messages || []),
      )
    }

    // ✅ FIX: Only load suggested questions from session when NOT actively sending
    // This prevents overwriting questions already set by the stream callback
    if (!isSendingRef.current) {
      if (currentSession?.suggested_questions && currentSession.suggested_questions.length > 0) {
        setSuggestedQuestions(currentSession.suggested_questions)
      } else {
        setSuggestedQuestions([])
      }
    }
  }, [currentSession, currentSessionId]) // watch both so clearing works on session deselect

  // Auto-select most recent session on initial load so the user continues
  // their previous conversation instead of seeing an empty state.
  useEffect(() => {
    if (sessions.length > 0 && currentSessionId === null) {
      if (messages.length === 0) {
        const mostRecentSession = sessions[0]
        setCurrentSessionId(mostRecentSession.id)
      }
    }
  }, [sessions]) // eslint-disable-line react-hooks/exhaustive-deps

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: (data: Createi_NotesChatSessionRequest) =>
      chatApi.createSession(data),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.i_NotesChatSessions(i_NotesId)
      })
      setCurrentSessionId(newSession.id)
      toast.success(t.chat.sessionCreated)
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } }, message?: string };
      toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToCreateSession'))
    }
  })

  // Update session mutation
  const updateSessionMutation = useMutation({
    mutationFn: ({ sessionId, data }: {
      sessionId: string
      data: Updatei_NotesChatSessionRequest
    }) => chatApi.updateSession(sessionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.i_NotesChatSessions(i_NotesId)
      })
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.i_NotesChatSession(currentSessionId!)
      })
      toast.success(t.chat.sessionUpdated)
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } }, message?: string };
      toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToUpdateSession'))
    }
  })

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      chatApi.deleteSession(sessionId),
    onSuccess: (_, deletedId) => {
      // Remove the deleted session from cache immediately so its useEffect doesn't re-populate messages
      queryClient.removeQueries({
        queryKey: QUERY_KEYS.i_NotesChatSession(deletedId)
      })
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.i_NotesChatSessions(i_NotesId)
      })
      if (currentSessionId === deletedId) {
        setCurrentSessionId(null)
        setMessages([])
        setSuggestedQuestions([])
      }
      toast.success(t.chat.sessionDeleted)
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } }, message?: string };
      toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToDeleteSession'))
    }
  })

  const buildFolderStructure = useCallback(() => {
    return folderContexts.map((folder) => ({
      id: folder.id,
      name: folder.name,
      sources: folder.sources.map((source) => ({
        id: source.id,
        title: source.title ?? null,
      })),
      notes: folder.notes.map((note) => ({
        id: note.id,
        title: note.title ?? null,
      })),
    }))
  }, [folderContexts])

  const buildFolderSummary = useCallback((folderStructure: ReturnType<typeof buildFolderStructure>) => {
    return folderStructure
      .map((folder) => {
        const sourceLabels = folder.sources.length > 0
          ? folder.sources.map((source) => `${source.title ?? source.id} [${source.id}]`).join(', ')
          : 'none'
        const noteLabels = folder.notes.length > 0
          ? folder.notes.map((note) => `${note.title ?? note.id} [${note.id}]`).join(', ')
          : 'none'

        return [
          `Folder: ${folder.name} [${folder.id}]`,
          `Sources: ${sourceLabels}`,
          `Notes: ${noteLabels}`,
        ].join('\n')
      })
      .join('\n\n')
  }, [])

  const estimateTokenCount = useCallback((text: string) => {
    return Math.max(0, Math.ceil(text.length / 4))
  }, [])

  const buildLocalContextFallback = useCallback(() => {
    const folder_structure = buildFolderStructure()
    const folder_summary = buildFolderSummary(folder_structure)

    const context = {
      sources: sources.map((source) => {
        const mode = contextSelections.sources[source.id]
        const sourceId = normalizeRecordId(source.id)
        return {
          id: source.id,
          title: source.title ?? null,
          mode: mode ?? 'off',
          i_Notess: folderContexts
            .filter((folder) =>
              folder.sources.some(
                (folderSource) => normalizeRecordId(folderSource.id) === sourceId,
              ),
            )
            .map((folder) => ({ id: folder.id, name: folder.name })),
        }
      }),
      notes: notes.map((note) => {
        const mode = contextSelections.notes[note.id]
        const noteId = normalizeRecordId(note.id)
        return {
          id: note.id,
          title: note.title ?? null,
          mode: mode ?? 'off',
          i_Notess: folderContexts
            .filter((folder) =>
              folder.notes.some(
                (folderNote) => normalizeRecordId(folderNote.id) === noteId,
              ),
            )
            .map((folder) => ({ id: folder.id, name: folder.name })),
        }
      }),
      folder_structure,
      folder_summary,
    }

    const countText = [
      folder_summary,
      ...context.sources.map((source) => JSON.stringify(source)),
      ...context.notes.map((note) => JSON.stringify(note)),
    ].join('\n')

    setTokenCount(estimateTokenCount(countText))
    setCharCount(countText.length)

    return context
  }, [buildFolderStructure, buildFolderSummary, contextSelections.notes, contextSelections.sources, estimateTokenCount, folderContexts, notes, sources])

  const ensureFolderSourcesInContextConfig = useCallback(
    (
      context_config: { sources: Record<string, string>; notes: Record<string, string> },
    ) => {
      folderContexts.forEach((folder) => {
        folder.sources.forEach((source) => {
          const mode = contextSelections.sources[source.id]
          if (mode === 'insights') {
            context_config.sources[source.id] = 'insights'
          } else if (mode === 'full') {
            context_config.sources[source.id] = 'full content'
          } else if (!(source.id in context_config.sources)) {
            const hasInsights = source.insights_count > 0
            context_config.sources[source.id] = hasInsights ? 'insights' : 'full content'
          }
        })

        folder.notes.forEach((note) => {
          const mode = contextSelections.notes[note.id]
          if (mode === 'full') {
            context_config.notes[note.id] = 'full content'
          } else if (!(note.id in context_config.notes)) {
            context_config.notes[note.id] = 'full content'
          }
        })
      })
    },
    [contextSelections.notes, contextSelections.sources, folderContexts],
  )

  // Build context from sources and notes based on user selections
  const buildContext = useCallback(async () => {
    const context_config: { sources: Record<string, string>, notes: Record<string, string> } = {
      sources: {},
      notes: {}
    }

    sources.forEach(source => {
      const mode = getEffectiveSourceMode(source, contextSelections.sources)
      if (mode === 'insights') {
        context_config.sources[source.id] = 'insights'
      } else if (mode === 'full') {
        context_config.sources[source.id] = 'full content'
      } else {
        context_config.sources[source.id] = 'not in'
      }
    })

    notes.forEach(note => {
      const mode = getEffectiveNoteMode(note, contextSelections.notes)
      if (mode === 'full') {
        context_config.notes[note.id] = 'full content'
      } else {
        context_config.notes[note.id] = 'not in'
      }
    })

    ensureFolderSourcesInContextConfig(context_config)
    const folder_structure = buildFolderStructure()

    try {
      const response: BuildContextResponse = await chatApi.buildContext({
        i_Notes_id: i_NotesId,
        context_config,
        folder_structure,
      })

      const folder_summary = buildFolderSummary(folder_structure)

      setTokenCount(response.token_count)
      setCharCount(response.char_count)

      return {
        ...response.context,
        folder_structure,
        folder_summary,
      }
    } catch (error) {
      console.warn('Falling back to local context builder:', error)
      return buildLocalContextFallback()
    }
  }, [
    i_NotesId,
    sources,
    notes,
    contextSelections,
    buildFolderStructure,
    buildFolderSummary,
    buildLocalContextFallback,
    ensureFolderSourcesInContextConfig,
  ])

  // Send message (with streaming)
  const sendMessage = useCallback(async (message: string, modelOverride?: string) => {
    let sessionId = currentSessionId

    if (!sessionId) {
      try {
        const defaultTitle = message.length > 30
          ? `${message.substring(0, 30)}...`
          : message
        const newSession = await chatApi.createSession({
          i_Notes_id: i_NotesId,
          title: defaultTitle,
          model_override: pendingModelOverride ?? undefined
        })
        sessionId = newSession.id
        setCurrentSessionId(sessionId)
        setPendingModelOverride(null)
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.i_NotesChatSessions(i_NotesId)
        })
      } catch (err: unknown) {
        const error = err as { response?: { data?: { detail?: string } }, message?: string };
        toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToCreateSession'))
        return
      }
    }

    const userMessage: i_NotesChatMessage = {
      id: `temp-${Date.now()}`,
      type: 'human',
      content: message,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMessage])
    setIsSending(true)
    isSendingRef.current = true

    // ✅ FIX: Clear suggestions only once here, before streaming starts
    setSuggestedQuestions([])

    const aiMessageId = `ai-${Date.now()}`
    const aiMessage: i_NotesChatMessage = {
      id: aiMessageId,
      type: 'ai',
      content: '',
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, aiMessage])

    try {
      const context = await buildContext()

      await chatApi.sendMessageStream({
        session_id: sessionId,
        message,
        context,
        model_override: modelOverride ?? (currentSession?.model_override ?? undefined)
      }, (token) => {
        setMessages(prev => {
          const newMessages = [...prev]
          const msgIndex = newMessages.findIndex(m => m.id === aiMessageId)
          if (msgIndex >= 0) {
            const currentMsg = newMessages[msgIndex]
            newMessages[msgIndex] = {
              ...currentMsg,
              content: currentMsg.content + token
            }
          }
          return newMessages
        })
      }, (questions) => {
        // ✅ FIX: Set suggested questions ONLY here from stream — single source of truth
        setSuggestedQuestions(questions)
      })

      // ✅ FIX: After streaming completes, refetch and clear optimistic placeholder
      const result = await refetchCurrentSession()
      
      // Remove the optimistic placeholder and keep only server messages
      if (result?.data?.messages) {
        setMessages((prevMessages) =>
          mergeSessionMessages(prevMessages, result.data.messages),
        )
      }

    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } }, message?: string };
      console.error('Error sending message:', error)
      toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToSendMessage'))
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-') && msg.id !== aiMessageId))
    } finally {
      setIsSending(false)
      isSendingRef.current = false
    }
  }, [
    i_NotesId,
    currentSessionId,
    currentSession,
    pendingModelOverride,
    buildContext,
    refetchCurrentSession,
    queryClient,
    t
  ])

  // Switch session
  const switchSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId)
  }, [])

  // Create session
  const createSession = useCallback((title?: string) => {
    return createSessionMutation.mutate({
      i_Notes_id: i_NotesId,
      title
    })
  }, [createSessionMutation, i_NotesId])

  // Update session
  const updateSession = useCallback((sessionId: string, data: Updatei_NotesChatSessionRequest) => {
    return updateSessionMutation.mutate({
      sessionId,
      data
    })
  }, [updateSessionMutation])

  // Delete session
  const deleteSession = useCallback((sessionId: string) => {
    return deleteSessionMutation.mutate(sessionId)
  }, [deleteSessionMutation])

  // Set model override
  const setModelOverride = useCallback((model: string | null) => {
    if (currentSessionId) {
      updateSessionMutation.mutate({
        sessionId: currentSessionId,
        data: { model_override: model }
      })
    } else {
      setPendingModelOverride(model)
    }
  }, [currentSessionId, updateSessionMutation])

  // Update token/char counts when context selections change
  useEffect(() => {
    const updateContextCounts = async () => {
      try {
        await buildContext()
      } catch (error) {
        console.error('Error updating context counts:', error)
      }
    }
    updateContextCounts()
  }, [buildContext])

  return {
    sessions,
    currentSession: currentSession || sessions.find(s => s.id === currentSessionId),
    currentSessionId,
    messages,
    isSending,
    loadingSessions,
    tokenCount,
    charCount,
    pendingModelOverride,
    suggestedQuestions,
    createSession,
    updateSession,
    deleteSession,
    switchSession,
    sendMessage,
    setModelOverride,
  }
}
