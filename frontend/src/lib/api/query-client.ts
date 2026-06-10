import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
})

export const QUERY_KEYS = {
  i_Notes: ['i_Notes'] as const,
  notebook: (id: string) => ['i_Notes', id] as const,
  notes: (i_NotesId?: string) => ['notes', i_NotesId] as const,
  note: (id: string) => ['notes', id] as const,
  sources: (i_NotesId?: string) => ['sources', i_NotesId] as const,
  sourcesInfinite: (i_NotesId: string) => ['sources', 'infinite', i_NotesId] as const,
  source: (id: string) => ['sources', id] as const,
  settings: ['settings'] as const,
  sourceChatSessions: (sourceId: string) => ['source-chat', sourceId, 'sessions'] as const,
  sourceChatSession: (sourceId: string, sessionId: string) => ['source-chat', sourceId, 'sessions', sessionId] as const,
  i_NotesChatSessions: (i_NotesId: string) => ['i_Notes-chat', i_NotesId, 'sessions'] as const,
  i_NotesChatSession: (sessionId: string) => ['i_Notes-chat', 'sessions', sessionId] as const,
  superChatSessions: (i_NotesId: string) => ['super-chat', i_NotesId, 'sessions'] as const,
  superChatSession: (sessionId: string) => ['super-chat', 'sessions', sessionId] as const,
  podcastEpisodes: ['podcasts', 'episodes'] as const,
  podcastEpisode: (episodeId: string) => ['podcasts', 'episodes', episodeId] as const,
  episodeProfiles: ['podcasts', 'episode-profiles'] as const,
  speakerProfiles: ['podcasts', 'speaker-profiles'] as const,
  languages: ['languages'] as const,
}
