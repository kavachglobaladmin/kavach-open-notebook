import type { AxiosResponse } from 'axios'

import apiClient from './client'
import { 
  SourceListResponse, 
  SourceDetailResponse, 
  SourceResponse,
  SourceStatusResponse,
  CreateSourceRequest, 
  CreateCommonGraphRequest,
  CommonGraphResponse,
  ProfileGraphData,
  UpdateSourceRequest 
} from '@/lib/types/api'

/**
 * Strip SurrealDB table prefix from a source ID.
 * "source:abc123" → "abc123"
 * "abc123"        → "abc123"
 *
 * Colons in URL path segments are not valid and cause FastAPI to misparse
 * the route, resulting in 500 / 404 errors. Always use this before
 * embedding an ID in a URL path.
 */
function stripSourcePrefix(id: string): string {
  return id.startsWith('source:') ? id.slice(7) : id
}

export const sourcesApi = {
  list: async (params?: {
    i_Notes_id?: string
    limit?: number
    offset?: number
    sort_by?: 'created' | 'updated'
    sort_order?: 'asc' | 'desc'
  }) => {
    const response = await apiClient.get<SourceListResponse[]>('/sources', { params })
    return response.data
  },

  get: async (id: string) => {
    const cleanId = stripSourcePrefix(id)
    const response = await apiClient.get<SourceDetailResponse>(`/sources/${cleanId}`)
    return response.data
  },

  create: async (data: CreateSourceRequest & { file?: File }) => {
    // Always use FormData to match backend expectations
    const formData = new FormData()
    
    formData.append('type', data.type)
    
    if (data.i_Notes !== undefined) {
      formData.append('i_Notes', JSON.stringify(data.i_Notes))
    }
    if (data.i_Notes_id) {
      formData.append('i_Notes_id', data.i_Notes_id)
    }
    if (data.title) {
      formData.append('title', data.title)
    }
    if (data.url) {
      formData.append('url', data.url)
    }
    if (data.content) {
      formData.append('content', data.content)
    }
    if (data.transformations !== undefined) {
      formData.append('transformations', JSON.stringify(data.transformations))
    }
    
    const dataWithFile = data as CreateSourceRequest & { file?: File }
    if (dataWithFile.file instanceof File) {
      formData.append('file', dataWithFile.file)
    }
    
    formData.append('embed', String(data.embed ?? false))
    formData.append('delete_source', String(data.delete_source ?? false))
    formData.append('async_processing', String(data.async_processing ?? false))
    
    const response = await apiClient.post<SourceResponse>('/sources', formData)
    return response.data
  },

  update: async (id: string, data: UpdateSourceRequest) => {
    const cleanId = stripSourcePrefix(id)
    const response = await apiClient.put<SourceListResponse>(`/sources/${cleanId}`, data)
    return response.data
  },

  delete: async (id: string) => {
    const cleanId = stripSourcePrefix(id)
    await apiClient.delete(`/sources/${cleanId}`)
  },

  status: async (id: string) => {
    const cleanId = stripSourcePrefix(id)
    const response = await apiClient.get<SourceStatusResponse>(`/sources/${cleanId}/status`)
    return response.data
  },

  upload: async (file: File, i_Notes_id: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('i_Notes_id', i_Notes_id)
    formData.append('type', 'upload')
    formData.append('async_processing', 'true')
    
    const response = await apiClient.post<SourceResponse>('/sources', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  retry: async (id: string, i_NotesId?: string) => {
    const cleanId = stripSourcePrefix(id)
    const response = await apiClient.post<SourceResponse>(`/sources/${cleanId}/retry`, undefined, {
      params: i_NotesId ? { i_Notes_id: i_NotesId } : undefined,
    })
    return response.data
  },

  createCommonGraph: async (data: CreateCommonGraphRequest) => {
    const response = await apiClient.post<CommonGraphResponse>('/sources/common-graphs', data)
    return response.data
  },

  getCommonGraph: async (id: string) => {
    const response = await apiClient.get<CommonGraphResponse>(`/sources/common-graphs/${encodeURIComponent(id)}`)
    return response.data
  },

  getProfileGraph: async (sourceId: string, modelId?: string) => {
    const cleanId = stripSourcePrefix(sourceId)
    const params = modelId ? { model_id: modelId } : {}
    const response = await apiClient.get<ProfileGraphData>(`/sources/${cleanId}/profile-graph`, { params })
    return response.data
  },

  getProfileImage: async (sourceId: string): Promise<string | null> => {
    try {
      const cleanId = stripSourcePrefix(sourceId)
      const response = await apiClient.get(`/sources/${cleanId}/profile-image`, { responseType: 'blob' })
      return URL.createObjectURL(response.data)
    } catch {
      return null
    }
  },

  getWordCloud: async (sourceId: string) => {
    const cleanId = stripSourcePrefix(sourceId)
    const response = await apiClient.get<{ words: { text: string; value: number }[]; source_id: string }>(`/sources/${cleanId}/word-cloud`)
    return response.data
  },

  getPersonContext: async (sourceId: string, name: string): Promise<{ paragraphs: string[]; name: string }> => {
    const cleanId = stripSourcePrefix(sourceId)
    const response = await apiClient.get(`/sources/${cleanId}/person-context`, { params: { name } })
    return response.data
  },

  getPartIV: async (sourceId: string) => {
    const cleanId = stripSourcePrefix(sourceId)
    const response = await apiClient.get<{
      sections: Record<string, string>
      raw: string
      source_id: string
      found: boolean
    }>(`/sources/${cleanId}/part-iv`)
    return response.data
  },

  downloadFile: async (id: string): Promise<AxiosResponse<Blob>> => {
    const cleanId = stripSourcePrefix(id)
    return apiClient.get(`/sources/${cleanId}/download`, {
      responseType: 'blob',
    })
  },
}
