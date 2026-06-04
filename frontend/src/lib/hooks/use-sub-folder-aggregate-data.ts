'use client'

import { useMemo, useRef } from 'react'
import { useQueries } from '@tanstack/react-query'

import { notesApi } from '@/lib/api/notes'
import { QUERY_KEYS } from '@/lib/api/query-client'
import { sourcesApi } from '@/lib/api/sources'
import { useNotebooks } from '@/lib/hooks/use-notebooks'
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

function useNotebookLookup() {
  const { data: activeNotebooks, isLoading: loadingActive } = useNotebooks(false)
  const { data: archivedNotebooks, isLoading: loadingArchived } = useNotebooks(true)

  const lookup = useMemo(() => {
    const lookup = new Map<string, { id: string; name: string }>()
    ;[...(activeNotebooks ?? []), ...(archivedNotebooks ?? [])].forEach((notebook) => {
      lookup.set(notebook.id, { id: notebook.id, name: notebook.name })
    })
    return lookup
  }, [activeNotebooks, archivedNotebooks])

  return {
    lookup,
    loading: loadingActive || loadingArchived,
  }
}

export function useSubFolderAggregateData(notebookIds: string[]): AggregateResult {
  const childNotebookIds = useMemo(
    () => Array.from(new Set((notebookIds ?? []).filter(Boolean))),
    [notebookIds],
  )

  const sourcesQueries = useQueries({
    queries: childNotebookIds.map((id) => ({
      queryKey: QUERY_KEYS.sources(id),
      queryFn: () =>
        sourcesApi.list({
          notebook_id: id,
          limit: 500,
          offset: 0,
          sort_by: 'updated',
          sort_order: 'desc',
        }),
      enabled: !!id,
    })),
  })

  const notesQueries = useQueries({
    queries: childNotebookIds.map((id) => ({
      queryKey: QUERY_KEYS.notes(id),
      queryFn: () => notesApi.list({ notebook_id: id }),
      enabled: !!id,
    })),
  })

  const { lookup: notebookLookup, loading: notebookLoading } = useNotebookLookup()

  const sourcesDataStamp = sourcesQueries.map((query) => query.dataUpdatedAt).join('|')
  const notesDataStamp = notesQueries.map((query) => query.dataUpdatedAt).join('|')
  const notebookStamp = Array.from(notebookLookup.values())
    .map((notebook) => `${notebook.id}:${notebook.name}`)
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
  const folderContextsStamp = `${childNotebookIds.join('|')}::${sourcesDataStamp}::${notesDataStamp}::${notebookStamp}`
  if (folderContextsCacheRef.current.stamp !== folderContextsStamp) {
    folderContextsCacheRef.current = {
      stamp: folderContextsStamp,
      value: childNotebookIds.map((notebookId, index) => {
        const notebook = notebookLookup.get(notebookId)
        return {
          id: notebookId,
          name: notebook?.name ?? notebookId,
          sources: sourcesQueries[index]?.data ?? [],
          notes: notesQueries[index]?.data ?? [],
        }
      }),
    }
  }

  const loading =
    sourcesQueries.some((query) => query.isLoading) ||
    notesQueries.some((query) => query.isLoading) ||
    notebookLoading

  return {
    sources: sourcesCacheRef.current.value,
    notes: notesCacheRef.current.value,
    folderContexts: folderContextsCacheRef.current.value,
    loading,
  }
}
