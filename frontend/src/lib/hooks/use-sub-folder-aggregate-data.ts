'use client'

import { useMemo, useRef } from 'react'
import { useQueries } from '@tanstack/react-query'

import { notesApi } from '@/lib/api/notes'
import { QUERY_KEYS } from '@/lib/api/query-client'
import { sourcesApi } from '@/lib/api/sources'
import { usei_Notes } from '@/lib/hooks/use-i_Notes'
import type { NoteResponse, SourceListResponse } from '@/lib/types/api'

export interface SubFolderAggregateContext {
  id: string
  name: string
  sources: SourceListResponse[]
  notes: NoteResponse[]
}

interface AggregateResult {
  sources: SourceListResponse[]
  notes: NoteResponse[]
  folderContexts: SubFolderAggregateContext[]
  loading: boolean
}

function mergeById<T extends { id: string }>(collections: T[][]): T[] {
  const deduped = new Map<string, T>()
  collections.forEach((collection) => {
    collection.forEach((item) => {
      deduped.set(item.id, item)
    })
  })
  return Array.from(deduped.values())
}

function usei_NotesLookup() {
  const { data: activei_Notess, isLoading: loadingActive } = usei_Notes(false)
  const { data: archivedi_Notess, isLoading: loadingArchived } = usei_Notes(true)

  const lookup = useMemo(() => {
    const lookup = new Map<string, { id: string; name: string }>()
    ;[...(activei_Notess ?? []), ...(archivedi_Notess ?? [])].forEach((i_Notes) => {
      lookup.set(i_Notes.id, { id: i_Notes.id, name: i_Notes.name })
    })
    return lookup
  }, [activei_Notess, archivedi_Notess])

  return {
    lookup,
    loading: loadingActive || loadingArchived,
  }
}

export function useSubFolderAggregateData(i_NotesIds: string[]): AggregateResult {
  const childi_NotesIds = useMemo(
    () => Array.from(new Set((i_NotesIds ?? []).filter(Boolean))),
    [i_NotesIds],
  )

  const sourcesQueries = useQueries({
    queries: childi_NotesIds.map((id) => ({
      queryKey: QUERY_KEYS.sources(id),
      queryFn: () =>
        sourcesApi.list({
          i_Notes_id: id,
          limit: 500,
          offset: 0,
          sort_by: 'updated',
          sort_order: 'desc',
        }),
      enabled: !!id,
    })),
  })

  const notesQueries = useQueries({
    queries: childi_NotesIds.map((id) => ({
      queryKey: QUERY_KEYS.notes(id),
      queryFn: () => notesApi.list({ i_Notes_id: id }),
      enabled: !!id,
    })),
  })

  const { lookup: i_NotesLookup, loading: i_NotesLoading } = usei_NotesLookup()

  const sourcesDataStamp = sourcesQueries.map((query) => query.dataUpdatedAt).join('|')
  const notesDataStamp = notesQueries.map((query) => query.dataUpdatedAt).join('|')
  const i_NotesStamp = Array.from(i_NotesLookup.values())
    .map((i_Notes) => `${i_Notes.id}:${i_Notes.name}`)
    .join('|')

  const sourcesCacheRef = useRef<{ stamp: string; value: SourceListResponse[] }>({
    stamp: '',
    value: [],
  })
  if (sourcesCacheRef.current.stamp !== sourcesDataStamp) {
    sourcesCacheRef.current = {
      stamp: sourcesDataStamp,
      value: mergeById<SourceListResponse>(sourcesQueries.map((query) => query.data ?? [])),
    }
  }

  const notesCacheRef = useRef<{ stamp: string; value: NoteResponse[] }>({
    stamp: '',
    value: [],
  })
  if (notesCacheRef.current.stamp !== notesDataStamp) {
    notesCacheRef.current = {
      stamp: notesDataStamp,
      value: mergeById<NoteResponse>(notesQueries.map((query) => query.data ?? [])),
    }
  }

  const folderContextsCacheRef = useRef<{
    stamp: string
    value: SubFolderAggregateContext[]
  }>({
    stamp: '',
    value: [],
  })
  const folderContextsStamp = `${childi_NotesIds.join('|')}::${sourcesDataStamp}::${notesDataStamp}::${i_NotesStamp}`
  if (folderContextsCacheRef.current.stamp !== folderContextsStamp) {
    folderContextsCacheRef.current = {
      stamp: folderContextsStamp,
      value: childi_NotesIds.map((i_NotesId, index) => {
        const i_Notes = i_NotesLookup.get(i_NotesId)
        return {
          id: i_NotesId,
          name: i_Notes?.name ?? i_NotesId,
          sources: sourcesQueries[index]?.data ?? [],
          notes: notesQueries[index]?.data ?? [],
        }
      }),
    }
  }

  const loading =
    sourcesQueries.some((query) => query.isLoading) ||
    notesQueries.some((query) => query.isLoading) ||
    i_NotesLoading

  return {
    sources: sourcesCacheRef.current.value,
    notes: notesCacheRef.current.value,
    folderContexts: folderContextsCacheRef.current.value,
    loading,
  }
}
