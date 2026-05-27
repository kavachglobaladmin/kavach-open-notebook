import axios, { AxiosResponse } from 'axios'
import { getApiUrl } from '@/lib/config'
import { decodeToken } from '@/lib/jwt'
import { useAuthStore } from '@/lib/stores/auth-store'

// API client with runtime-configurable base URL
// The base URL is fetched from the API config endpoint on first request
// Timeout increased to 10 minutes (600000ms = 600s) to accommodate slow LLM operations
// (transformations, insights generation, chat) especially on slower hardware (Ollama, LM Studio)
// Note: Frontend uses milliseconds, backend uses seconds
// Local LLMs can take several minutes for complex questions with large contexts
export const apiClient = axios.create({
  timeout: 600000, // 600 seconds = 10 minutes
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
})

// Request interceptor to add base URL and auth header
apiClient.interceptors.request.use(async (config) => {
  // Set the base URL dynamically from runtime config
  if (!config.baseURL) {
    const apiUrl = await getApiUrl()
    config.baseURL = `${apiUrl}/api`
  }

  if (typeof window !== 'undefined') {
    // Prefer the in-memory apiPassword (raw backend password) from the Zustand store.
    // The backend's PasswordAuthMiddleware validates the raw password, not a JWT.
    // apiPassword is memory-only (never persisted) so it's available only within
    // the same browser session after login.
    const storeState = useAuthStore.getState()

    // Resolve the API password: prefer in-memory, fall back to sessionStorage
    // (sessionStorage survives page reloads within the same tab).
    const apiPassword = storeState.apiPassword
      ?? (typeof window !== 'undefined' ? sessionStorage.getItem('kavach_api_password') : null)

    // Resolve the user email: prefer in-memory store, fall back to persisted auth-storage
    const resolveUserEmail = (): string | null => {
      if (storeState.currentUserEmail) return storeState.currentUserEmail
      try {
        const authStorage = localStorage.getItem('auth-storage')
        if (authStorage) {
          const { state } = JSON.parse(authStorage)
          return state?.currentUserEmail
            ?? (state?.token && state.token !== 'not-required'
              ? decodeToken(state.token)?.sub
              : null)
            ?? null
        }
      } catch { /* ignore */ }
      return null
    }

    if (apiPassword) {
      // Auth is required and user is logged in — send the raw password
      config.headers.Authorization = `Bearer ${apiPassword}`

      const userEmail = resolveUserEmail()
      if (userEmail) {
        config.headers['X-User-Email'] = userEmail
      }
    } else if (storeState.token === 'not-required') {
      // Auth not required — still send user email for scoping if available.
      // This ensures notebooks are always filtered by owner even when no
      // API password is configured.
      const userEmail = resolveUserEmail()
      if (userEmail) {
        config.headers['X-User-Email'] = userEmail
      }
    } else if (storeState.isAuthenticated) {
      // Authenticated but apiPassword not yet restored (e.g. between hydration
      // and sessionStorage read) — still send the email so scoping works.
      const userEmail = resolveUserEmail()
      if (userEmail) {
        config.headers['X-User-Email'] = userEmail
      }
    }
  }

  // Handle FormData vs JSON content types
  if (config.data instanceof FormData) {
    // Remove any Content-Type header to let browser set multipart boundary
    delete config.headers['Content-Type']
  } else if (config.method && ['post', 'put', 'patch'].includes(config.method.toLowerCase())) {
    config.headers['Content-Type'] = 'application/json'
  }

  return config
})

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth-storage')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient