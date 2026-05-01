import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getApiUrl } from '@/lib/config'
import { issueToken, verifyToken, isTokenExpired, rotateBrowserSecret, decodeToken } from '@/lib/jwt'
import { queryClient } from '@/lib/api/query-client'

interface AuthState {
  isAuthenticated: boolean
  /** JWT-like signed token (or 'not-required' when auth is disabled) */
  token: string | null
  /** The global API bearer token returned by /api/auth/login — never persisted */
  apiPassword: string | null
  isLoading: boolean
  error: string | null
  lastAuthCheck: number | null
  isCheckingAuth: boolean
  hasHydrated: boolean
  authRequired: boolean | null
  tokenExpiresAt: number | null
  /** Email of the currently logged-in user */
  currentUserEmail: string | null

  setHasHydrated: (state: boolean) => void
  checkAuthRequired: () => Promise<boolean>
  /**
   * Validates user credentials against kavach_user via /api/auth/login.
   * On success the backend returns the global api_token which is stored
   * in memory + sessionStorage for subsequent API calls.
   *
   * @param email     User's email address
   * @param password  User's own password (validated against kavach_user)
   * @param name      Display name (optional, from login response)
   */
  login: (email: string, password: string, name?: string) => Promise<boolean>
  logout: () => void
  checkAuth: () => Promise<boolean>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      token: null,
      apiPassword: null,
      isLoading: false,
      error: null,
      lastAuthCheck: null,
      isCheckingAuth: false,
      hasHydrated: false,
      authRequired: null,
      tokenExpiresAt: null,
      currentUserEmail: null,

      setHasHydrated: (state: boolean) => {
        set({ hasHydrated: state })
      },

      // ── Check if backend requires a password ──────────────────────────────
      checkAuthRequired: async () => {
        try {
          const apiUrl = await getApiUrl()
          const response = await fetch(`${apiUrl}/api/auth/status`, {
            cache: 'no-store',
          })

          if (!response.ok) {
            throw new Error(`Auth status check failed: ${response.status}`)
          }

          const data = await response.json()
          const required = data.auth_enabled || false
          set({ authRequired: required })

          if (!required) {
            set({ isAuthenticated: true, token: 'not-required', tokenExpiresAt: null })
          }

          return required
        } catch (error) {
          console.error('Failed to check auth status:', error)
          if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            set({
              error: 'Unable to connect to server. Please check if the API is running.',
              authRequired: null,
            })
          } else {
            set({ authRequired: true })
          }
          throw error
        }
      },

      // ── Login ─────────────────────────────────────────────────────────────
      // Calls /api/auth/login which validates kavach_user credentials and
      // returns the global api_token. No global password needed on the frontend.
      login: async (email: string, password: string, name?: string) => {
        set({ isLoading: true, error: null })
        try {
          const apiUrl = await getApiUrl()

          const response = await fetch(`${apiUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
          })

          if (response.ok) {
            const data = await response.json()
            const apiToken: string = data.api_token ?? ''
            const verifiedEmail: string = data.email ?? email.trim().toLowerCase()
            const displayName: string = name ?? data.name ?? verifiedEmail.split('@')[0]

            // Issue a signed JWT for the local session
            const jwtToken = await issueToken(verifiedEmail, displayName)

            if (typeof window !== 'undefined') {
              // Store api_token in sessionStorage — cleared when tab closes
              sessionStorage.setItem('kavach_api_password', apiToken)
              localStorage.setItem('kavach_current_user', verifiedEmail)
            }

            set({
              isAuthenticated: true,
              token: jwtToken,
              apiPassword: apiToken,
              isLoading: false,
              lastAuthCheck: Date.now(),
              tokenExpiresAt: null,
              currentUserEmail: verifiedEmail,
              error: null,
            })
            return true
          } else {
            let errorMessage = 'Authentication failed.'
            try {
              const errData = await response.json()
              errorMessage = errData?.detail ?? errorMessage
            } catch { /* ignore */ }

            set({ error: errorMessage, isLoading: false, isAuthenticated: false, token: null, tokenExpiresAt: null })
            return false
          }
        } catch (error) {
          const errorMessage =
            error instanceof TypeError && error.message.includes('Failed to fetch')
              ? 'Unable to connect to server. Please check if the API is running.'
              : error instanceof Error
              ? `Network error: ${error.message}`
              : 'An unexpected error occurred.'

          set({ error: errorMessage, isLoading: false, isAuthenticated: false, token: null, tokenExpiresAt: null })
          return false
        }
      },

      // ── Logout ────────────────────────────────────────────────────────────
      logout: () => {
        // Rotate the browser secret — this instantly invalidates the current
        // token and any other tokens issued in this browser session.
        rotateBrowserSecret()
        // Clear the session-stored password so it can't be reused after logout
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('kavach_api_password')
        }
        set({
          isAuthenticated: false,
          token: null,
          apiPassword: null,
          error: null,
          tokenExpiresAt: null,
          currentUserEmail: null,
          lastAuthCheck: null,
        })
      },

      // ── Periodic auth check ───────────────────────────────────────────────
      checkAuth: async () => {
        const state = get()
        const { token, lastAuthCheck, isCheckingAuth, isAuthenticated } = state

        if (isCheckingAuth) return isAuthenticated
        if (!token) return false

        // ── JWT expiry check (client-side, instant) ──────────────────────
        if (token !== 'not-required') {
          if (isTokenExpired(token)) {
            console.info('[Auth] Session expired — logging out')
            queryClient.clear()
            set({
              isAuthenticated: false,
              token: null,
              apiPassword: null,
              tokenExpiresAt: null,
              lastAuthCheck: null,
              isCheckingAuth: false,
            })
            return false
          }
        }

        // ── Verify JWT signature ─────────────────────────────────────────
        if (token !== 'not-required') {
          const payload = await verifyToken(token)
          if (!payload) {
            console.warn('[Auth] Token signature invalid — logging out')
            queryClient.clear()
            set({
              isAuthenticated: false,
              token: null,
              apiPassword: null,
              tokenExpiresAt: null,
              lastAuthCheck: null,
              isCheckingAuth: false,
            })
            return false
          }
        }

        // ── Skip network check if recently validated (30s window) ────────
        const now = Date.now()
        if (isAuthenticated && lastAuthCheck && now - lastAuthCheck < 30_000) {
          return true
        }

        set({ isCheckingAuth: true })

        try {
          const apiUrl = await getApiUrl()
          // Use stored apiPassword for backend call; fall back to token for
          // 'not-required' mode or legacy sessions
          const bearerToken = state.apiPassword ?? token

          const response = await fetch(`${apiUrl}/api/notebooks`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${bearerToken}`,
              'Content-Type': 'application/json',
              ...(state.currentUserEmail ? { 'X-User-Email': state.currentUserEmail } : {}),
            },
          })

          if (response.ok) {
            set({ isAuthenticated: true, lastAuthCheck: now, isCheckingAuth: false })
            return true
          } else {
            queryClient.clear()
            set({
              isAuthenticated: false,
              token: null,
              apiPassword: null,
              tokenExpiresAt: null,
              lastAuthCheck: null,
              isCheckingAuth: false,
            })
            return false
          }
        } catch (error) {
          console.error('checkAuth error:', error)
          queryClient.clear()
          set({
            isAuthenticated: false,
            token: null,
            apiPassword: null,
            tokenExpiresAt: null,
            lastAuthCheck: null,
            isCheckingAuth: false,
          })
          return false
        }
      },
    }),
    {
      name: 'auth-storage',
      // apiPassword is intentionally excluded — never persist the raw password
      partialize: (state) => ({
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        currentUserEmail: state.currentUserEmail,
      }),
      onRehydrateStorage: () => (state) => {
        // On page reload, immediately check if the persisted token is expired
        if (state) {
          if (state.token && state.token !== 'not-required' && isTokenExpired(state.token)) {
            console.info('[Auth] Persisted token expired on rehydration — clearing session')
            queryClient.clear()
            state.token = null
            state.isAuthenticated = false
            state.tokenExpiresAt = null
            state.currentUserEmail = null
          } else if (state.token && state.token !== 'not-required') {
            // Restore currentUserEmail from the persisted JWT token's sub claim
            const payload = decodeToken(state.token)
            if (payload?.sub) {
              state.currentUserEmail = payload.sub
            }

            // Restore apiPassword from sessionStorage so API calls work after
            // a page reload within the same tab.  sessionStorage is cleared
            // when the tab is closed, so this never leaks across sessions.
            if (typeof window !== 'undefined') {
              const savedPassword = sessionStorage.getItem('kavach_api_password')
              if (savedPassword) {
                state.apiPassword = savedPassword
              }
            }
          }
          state.setHasHydrated(true)
        }
      },
    }
  )
)
