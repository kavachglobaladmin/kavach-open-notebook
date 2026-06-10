import apiClient from './client'
import {
  i_NotesResponse,
  Createi_NotesRequest,
  Updatei_NotesRequest,
  i_NotesDeletePreview,
  i_NotesDeleteResponse,
} from '@/lib/types/api'

export const i_NotesApi = {
  list: async (params?: { archived?: boolean; order_by?: string }) => {
    const response = await apiClient.get<i_NotesResponse[]>('/i_Notes', { params })
    return response.data
  },

  get: async (id: string) => {
    const response = await apiClient.get<i_NotesResponse>(`/i_Notes/${id}`)
    return response.data
  },

  create: async (data: Createi_NotesRequest) => {
    const response = await apiClient.post<i_NotesResponse>('/i_Notes', data)
    return response.data
  },

  update: async (id: string, data: Updatei_NotesRequest) => {
    const response = await apiClient.put<i_NotesResponse>(`/i_Notes/${id}`, data)
    return response.data
  },

  deletePreview: async (id: string) => {
    const response = await apiClient.get<i_NotesDeletePreview>(
      `/i_Notes/${id}/delete-preview`
    )
    return response.data
  },

  delete: async (id: string, deleteExclusiveSources: boolean = false) => {
    const response = await apiClient.delete<i_NotesDeleteResponse>(`/i_Notes/${id}`, {
      params: { delete_exclusive_sources: deleteExclusiveSources },
    })
    return response.data
  },

  /**
   * Assign all i_Notes with owner = NONE/null to the currently logged-in user.
   * Called once on the i_Notes page load to migrate legacy data.
   */
  claimUnowned: async (): Promise<{ claimed: number }> => {
    const response = await apiClient.post<{ claimed: number }>('/i_Notes/claim-unowned')
    return response.data
  },

  addSource: async (i_NotesId: string, sourceId: string) => {
    const response = await apiClient.post(`/i_Notes/${i_NotesId}/sources/${sourceId}`)
    return response.data
  },

  removeSource: async (i_NotesId: string, sourceId: string) => {
    const response = await apiClient.delete(`/i_Notes/${i_NotesId}/sources/${sourceId}`)
    return response.data
  },

  // ── Access Management (super admin only) ──────────────────────────────────

  getAccess: async (i_NotesId: string): Promise<{ i_Notes_id: string; granted_users: string[] }> => {
    const response = await apiClient.get(`/i_Notes/${i_NotesId}/access`)
    return response.data
  },

  grantAccess: async (i_NotesId: string, userEmail: string) => {
    const response = await apiClient.post(`/i_Notes/${i_NotesId}/access`, { user_email: userEmail })
    return response.data
  },

  revokeAccess: async (i_NotesId: string, userEmail: string) => {
    const response = await apiClient.delete(`/i_Notes/${i_NotesId}/access/${encodeURIComponent(userEmail)}`)
    return response.data
  },
}