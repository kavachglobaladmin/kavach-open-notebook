import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getApiUrl } from '@/lib/config'
import { issueToken, verifyToken, isTokenExpired, rotateBrowserSecret, decodeToken } from '@/lib/jwt'

interface AuthState {
  isAuthenticated: boolean
  /** JWT-like signed token (or 'not-required' when auth is disabled) */
  token: string | null
  /** The raw API password — kept only in memory, never persisted */
  apiPassword: string | null
  isLoading: boolean
  error: string | null
  lastAuthCheck: number | null
  isCheckingAuth: boolean
  hasHydrated: boolean
  authRequired: boolean | null
  /** Expiry timestamp (ms) for UI countdown */
  tokenExpiresAt: number | null
  /** Email of the currently logged-in user (derived from JWT sub claim) */
  currentUserEmail: string | null

  setHasHydrated: (state: boolean) => void
  checkAuthRequired: () => Promise<boolean>
  login: (password: string) => Promise<boolean>
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
      login: async (password: string) => {
        set({ isLoading: true, error: null })
        try {
          const apiUrl = await getApiUrl()

          // Get the email that's about to log in (set by LoginForm before calling login())
          const email = localStorage.getItem('kavach_current_user') ?? 'user'

          // Validate password against backend — include X-User-Email so the
          // backend can scope the response to this user even during validation
          const response = await fetch(`${apiUrl}/api/notebooks`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${password}`,
              'Content-Type': 'application/json',
              'X-User-Email': email,
            },
          })

          if (response.ok) {
            // Issue a signed JWT for the local user session
            const email = localStorage.getItem('kavach_current_user') ?? 'user'
            const users: { email: string; name: string }[] = JSON.parse(
              localStorage.getItem('kavach_users') ?? '[]'
            )
            const name = users.find(u => u.email === email)?.name
            const jwtToken = await issueToken(email, name)

            set({
              isAuthenticated: true,
              token: jwtToken,
              apiPassword: password,   // memory-only, not persisted
              isLoading: false,
              lastAuthCheck: Date.now(),
              tokenExpiresAt: null,    // no time-based expiry
              currentUserEmail: email,
              error: null,
            })
            return true
          } else {
            let errorMessage = 'Authentication failed'
            if (response.status === 401) errorMessage = 'Invalid password. Please try again.'
            else if (response.status === 403) errorMessage = 'Access denied. Please check your credentials.'
            else if (response.status >= 500) errorMessage = 'Server error. Please try again later.'
            else errorMessage = `Authentication failed (${response.status})`

            set({ error: errorMessage, isLoading: false, isAuthenticated: false, token: null, tokenExpiresAt: null })
            return false
          }
        } catch (error) {
          console.error('Network error during auth:', error)
          const errorMessage =
            error instanceof TypeError && error.message.includes('Failed to fetch')
              ? 'Unable to connect to server. Please check if the API is running.'
              : error instanceof Error
              ? `Network error: ${error.message}`
              : 'An unexpected error occurred during authentication'

          set({ error: errorMessage, isLoading: false, isAuthenticated: false, token: null, tokenExpiresAt: null })
          return false
        }
      },

      // ── Logout ────────────────────────────────────────────────────────────
      logout: () => {
        // Rotate the browser secret — this instantly invalidates the current
        // token and any other tokens issued in this browser session.
        rotateBrowserSecret()
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
          }
          state.setHasHydrated(true)
        }
      },
    }
  )
)
