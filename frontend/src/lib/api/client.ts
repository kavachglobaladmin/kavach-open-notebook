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

    if (storeState.apiPassword) {
      // Auth is required and user is logged in — send the raw password
      config.headers.Authorization = `Bearer ${storeState.apiPassword}`

      // Send user email for per-user data scoping on the backend
      const userEmail = storeState.currentUserEmail
        ?? (storeState.token && storeState.token !== 'not-required'
          ? decodeToken(storeState.token)?.sub
          : null)
      if (userEmail) {
        config.headers['X-User-Email'] = userEmail
      }
    } else {
      // Auth not required (token === 'not-required') — fall back to localStorage
      const authStorage = localStorage.getItem('auth-storage')
      if (authStorage) {
        try {
          const { state } = JSON.parse(authStorage)
          if (state?.token) {
            config.headers.Authorization = `Bearer ${state.token}`

            // Send user email so the backend can scope data per-user.
            // Prefer the persisted currentUserEmail; fall back to JWT sub claim.
            const userEmail = state.currentUserEmail
              ?? (state.token !== 'not-required' ? decodeToken(state.token)?.sub : null)
            if (userEmail) {
              config.headers['X-User-Email'] = userEmail
            }
          }
        } catch (error) {
          console.error('Error parsing auth storage:', error)
        }
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