'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/notifications/toast'
import { getApiErrorMessage } from '@/lib/utils/error-handler'
import { useTranslation } from '@/lib/hooks/use-translation'
import { superChatApi } from '@/lib/api/super-chat'
import { QUERY_KEYS } from '@/lib/api/query-client'
import {
  NotebookChatMessage,
  CreateNotebookChatSessionRequest,
  UpdateNotebookChatSessionRequest,
  SourceListResponse,
  NoteResponse,
  BuildContextResponse,
} from '@/lib/types/api'
import { ContextSelections } from '@/app/(dashboard)/notebooks/[id]/page'

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
  previousMessages: NotebookChatMessage[],
  serverMessages: NotebookChatMessage[],
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

interface UseSuperChatParams {
  notebookId: string
  sources: SourceListResponse[]
  notes: NoteResponse[]
  contextSelections: ContextSelections
  folderContexts?: FolderContext[]
}

export function useSuperChat({
  notebookId,
  sources,
  notes,
  contextSelections,
  folderContexts = [],
}: UseSuperChatParams) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<NotebookChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const isSendingRef = useRef(false)
  const [tokenCount, setTokenCount] = useState<number>(0)
  const [charCount, setCharCount] = useState<number>(0)
  const [pendingModelOverride, setPendingModelOverride] = useState<string | null>(null)
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([])

  const {
    data: sessions = [],
    isLoading: loadingSessions,
  } = useQuery({
    queryKey: QUERY_KEYS.superChatSessions(notebookId),
    queryFn: () => superChatApi.listSessions(notebookId),
    enabled: !!notebookId,
  })

  const {
    data: currentSession,
    refetch: refetchCurrentSession,
  } = useQuery({
    queryKey: QUERY_KEYS.superChatSession(currentSessionId!),
    queryFn: () => superChatApi.getSession(currentSessionId!),
    enabled: !!notebookId && !!currentSessionId,
  })

  useEffect(() => {
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

    if (!isSendingRef.current) {
      if (
        currentSession?.suggested_questions &&
        currentSession.suggested_questions.length > 0
      ) {
        setSuggestedQuestions(currentSession.suggested_questions)
      } else {
        setSuggestedQuestions([])
      }
    }
  }, [currentSession, currentSessionId])

  useEffect(() => {
    if (sessions.length > 0 && currentSessionId === null && messages.length === 0) {
      setCurrentSessionId(sessions[0].id)
    }
  }, [sessions]) // eslint-disable-line react-hooks/exhaustive-deps

  const createSessionMutation = useMutation({
    mutationFn: (data: CreateNotebookChatSessionRequest) => superChatApi.createSession(data),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.superChatSessions(notebookId),
      })
      setCurrentSessionId(newSession.id)
      toast.success(t.chat.sessionCreated)
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } }; message?: string }
      toast.error(
        getApiErrorMessage(
          error.response?.data?.detail || error.message,
          (key) => t(key),
          'apiErrors.failedToCreateSession',
        ),
      )
    },
  })

  const updateSessionMutation = useMutation({
    mutationFn: ({
      sessionId,
      data,
    }: {
      sessionId: string
      data: UpdateNotebookChatSessionRequest
    }) => superChatApi.updateSession(sessionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.superChatSessions(notebookId),
      })
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.superChatSession(currentSessionId!),
      })
      toast.success(t.chat.sessionUpdated)
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } }; message?: string }
      toast.error(
        getApiErrorMessage(
          error.response?.data?.detail || error.message,
          (key) => t(key),
          'apiErrors.failedToUpdateSession',
        ),
      )
    },
  })

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) => superChatApi.deleteSession(sessionId),
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({
        queryKey: QUERY_KEYS.superChatSession(deletedId),
      })
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.superChatSessions(notebookId),
      })
      if (currentSessionId === deletedId) {
        setCurrentSessionId(null)
        setMessages([])
        setSuggestedQuestions([])
      }
      toast.success(t.chat.sessionDeleted)
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } }; message?: string }
      toast.error(
        getApiErrorMessage(
          error.response?.data?.detail || error.message,
          (key) => t(key),
          'apiErrors.failedToDeleteSession',
        ),
      )
    },
  })

  const buildContext = useCallback(async () => {
    const context_config: { sources: Record<string, string>; notes: Record<string, string> } = {
      sources: {},
      notes: {},
    }

    sources.forEach((source) => {
      const mode = getEffectiveSourceMode(source, contextSelections.sources)
      if (mode === 'insights') {
        context_config.sources[source.id] = 'insights'
      } else if (mode === 'full') {
        context_config.sources[source.id] = 'full content'
      } else {
        context_config.sources[source.id] = 'not in'
      }
    })

    // Also include any folder sources that might not be in the merged sources list yet
    // (e.g., a folder whose query resolved after the merged array was last computed).
    folderContexts.forEach((folder) => {
      folder.sources.forEach((source) => {
        if (!(source.id in context_config.sources)) {
          const mode = getEffectiveSourceMode(source, contextSelections.sources)
          if (mode === 'insights') {
            context_config.sources[source.id] = 'insights'
          } else if (mode === 'full') {
            context_config.sources[source.id] = 'full content'
          } else {
            context_config.sources[source.id] = 'not in'
          }
        }
      })
      folder.notes.forEach((note) => {
        if (!(note.id in context_config.notes)) {
          const mode = getEffectiveNoteMode(note, contextSelections.notes)
          context_config.notes[note.id] = mode === 'full' ? 'full content' : 'not in'
        }
      })
    })

    notes.forEach((note) => {
      const mode = getEffectiveNoteMode(note, contextSelections.notes)
      if (mode === 'full') {
        context_config.notes[note.id] = 'full content'
      } else {
        context_config.notes[note.id] = 'not in'
      }
    })

    const response: BuildContextResponse = await superChatApi.buildContext({
      notebook_id: notebookId,
      context_config,
      folder_structure: folderContexts.map((folder) => {
        const selectedSources = folder.sources
          .filter((source) => getEffectiveSourceMode(source, contextSelections.sources) !== 'off')
          .map((source) => ({ id: source.id, title: source.title ?? null }))
        const selectedNotes = folder.notes
          .filter((note) => getEffectiveNoteMode(note, contextSelections.notes) !== 'off')
          .map((note) => ({ id: note.id, title: note.title ?? null }))
        return {
          id: folder.id,
          name: folder.name,
          sources: selectedSources,
          notes: selectedNotes,
          has_context: selectedSources.length > 0 || selectedNotes.length > 0,
        }
      }),
    })

    const folder_structure = folderContexts
      .map((folder) => {
        const selectedSources = folder.sources
          .filter(
            (source) => getEffectiveSourceMode(source, contextSelections.sources) !== 'off',
          )
          .map((source) => ({
            id: source.id,
            title: source.title ?? null,
          }))

        const selectedNotes = folder.notes
          .filter((note) => getEffectiveNoteMode(note, contextSelections.notes) !== 'off')
          .map((note) => ({
            id: note.id,
            title: note.title ?? null,
          }))

        return {
          id: folder.id,
          name: folder.name,
          sources: selectedSources,
          notes: selectedNotes,
          has_context: selectedSources.length > 0 || selectedNotes.length > 0,
        }
      })

    setTokenCount(response.token_count)
    setCharCount(response.char_count)

    return {
      ...response.context,
      folder_structure,
    }
  }, [notebookId, sources, notes, contextSelections, folderContexts])

  const sendMessage = useCallback(
    async (message: string, modelOverride?: string) => {
      let sessionId = currentSessionId

      if (!sessionId) {
        try {
          const defaultTitle =
            message.length > 30 ? `${message.substring(0, 30)}...` : message
          const newSession = await superChatApi.createSession({
            notebook_id: notebookId,
            title: defaultTitle,
            model_override: pendingModelOverride ?? undefined,
          })
          sessionId = newSession.id
          setCurrentSessionId(sessionId)
          setPendingModelOverride(null)
          queryClient.invalidateQueries({
            queryKey: QUERY_KEYS.superChatSessions(notebookId),
          })
        } catch (err: unknown) {
          const error = err as {
            response?: { data?: { detail?: string } }
            message?: string
          }
          toast.error(
            getApiErrorMessage(
              error.response?.data?.detail || error.message,
              (key) => t(key),
              'apiErrors.failedToCreateSession',
            ),
          )
          return
        }
      }

      const userMessage: NotebookChatMessage = {
        id: `temp-${Date.now()}`,
        type: 'human',
        content: message,
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, userMessage])
      setIsSending(true)
      isSendingRef.current = true
      setSuggestedQuestions([])

      const aiMessageId = `ai-${Date.now()}`
      const aiMessage: NotebookChatMessage = {
        id: aiMessageId,
        type: 'ai',
        content: '',
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, aiMessage])

      try {
        const context = await buildContext()

        await superChatApi.sendMessageStream(
          {
            session_id: sessionId,
            message,
            context,
            model_override: modelOverride ?? (currentSession?.model_override ?? undefined),
          },
          (token) => {
            setMessages((prev) => {
              const next = [...prev]
              const msgIndex = next.findIndex((entry) => entry.id === aiMessageId)
              if (msgIndex >= 0) {
                const currentMsg = next[msgIndex]
                next[msgIndex] = {
                  ...currentMsg,
                  content: currentMsg.content + token,
                }
              }
              return next
            })
          },
          (questions) => {
            setSuggestedQuestions(questions)
          },
        )

        const result = await refetchCurrentSession()
        if (result?.data?.messages) {
          setMessages((prevMessages) =>
            mergeSessionMessages(prevMessages, result.data.messages),
          )
        }
      } catch (err: unknown) {
        const error = err as { response?: { data?: { detail?: string } }; message?: string }
        console.error('Error sending super chat message:', error)
        toast.error(
          getApiErrorMessage(
            error.response?.data?.detail || error.message,
            (key) => t(key),
            'apiErrors.failedToSendMessage',
          ),
        )
        setMessages((prev) =>
          prev.filter((messageEntry) => !messageEntry.id.startsWith('temp-') && messageEntry.id !== aiMessageId),
        )
      } finally {
        setIsSending(false)
        isSendingRef.current = false
      }
    },
    [
      notebookId,
      currentSessionId,
      currentSession,
      pendingModelOverride,
      buildContext,
      refetchCurrentSession,
      queryClient,
      t,
    ],
  )

  const switchSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId)
  }, [])

  const createSession = useCallback(
    (title?: string) => {
      return createSessionMutation.mutate({
        notebook_id: notebookId,
        title,
      })
    },
    [createSessionMutation, notebookId],
  )

  const updateSession = useCallback(
    (sessionId: string, data: UpdateNotebookChatSessionRequest) => {
      return updateSessionMutation.mutate({
        sessionId,
        data,
      })
    },
    [updateSessionMutation],
  )

  const deleteSession = useCallback(
    (sessionId: string) => {
      return deleteSessionMutation.mutate(sessionId)
    },
    [deleteSessionMutation],
  )

  const setModelOverride = useCallback(
    (model: string | null) => {
      if (currentSessionId) {
        updateSessionMutation.mutate({
          sessionId: currentSessionId,
          data: { model_override: model },
        })
      } else {
        setPendingModelOverride(model)
      }
    },
    [currentSessionId, updateSessionMutation],
  )

  useEffect(() => {
    const updateContextCounts = async () => {
      try {
        await buildContext()
      } catch (error) {
        console.error('Error updating super chat context counts:', error)
      }
    }
    updateContextCounts()
  }, [buildContext])

  return {
    sessions,
    currentSession: currentSession || sessions.find((session) => session.id === currentSessionId),
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
