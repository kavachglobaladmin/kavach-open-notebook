import apiClient from '@/lib/api/client'
import type { UserRole } from '@/lib/auth/roles'

export interface UserAdminRecord {
  id: string
  email: string
  name: string
  role: UserRole
  password: string
  password_encrypted: string
  created_at?: string | null
}

export interface UserProfile {
  email: string
  name: string
  role: UserRole
}

export interface UserDirectoryRecord {
  id: string
  email: string
  name: string
  role: UserRole
}

export const usersApi = {
  listAll: async () => {
    const response = await apiClient.get<UserAdminRecord[]>('/users/all')
    return response.data
  },
  listDirectory: async () => {
    const response = await apiClient.get<UserDirectoryRecord[]>('/users/directory')
    return response.data
  },
  updateRole: async (email: string, role: UserRole) => {
    const response = await apiClient.patch<UserProfile>(`/users/${encodeURIComponent(email)}/role`, { role })
    return response.data
  },
  getProfile: async () => {
    const response = await apiClient.get<UserProfile>('/users/profile')
    return response.data
  },
  listAssignable: async (isSuperAdmin: boolean): Promise<UserDirectoryRecord[]> => {
    if (isSuperAdmin) {
      const users = await usersApi.listAll()
      return users.map(({ id, email, name, role }) => ({ id, email, name, role }))
    }
    return usersApi.listDirectory()
  },
}
