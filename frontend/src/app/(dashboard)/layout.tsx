'use client'

import { useAuth } from '@/lib/hooks/use-auth'
import { useVersionCheck } from '@/lib/hooks/use-version-check'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { ModalProvider } from '@/components/providers/ModalProvider'
import { CreateDialogsProvider } from '@/lib/hooks/use-create-dialogs'
import { CommandPalette } from '@/components/common/CommandPalette'
import { useAuthStore } from '@/lib/stores/auth-store'
import { msUntilExpiry } from '@/lib/jwt'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { isAuthenticated, isLoading, logout } = useAuth()
  const token = useAuthStore(s => s.token)
  const router = useRouter()
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false)

  // Check for version updates once per session
  useVersionCheck()

  // ── Auth redirect ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading) {
      setHasCheckedAuth(true)

      const hasLocalSession = typeof window !== 'undefined'
        ? localStorage.getItem('kavach_session') === 'true'
        : false

      if (!isAuthenticated || !hasLocalSession) {
        const currentPath = window.location.pathname + window.location.search
        sessionStorage.setItem('redirectAfterLogin', currentPath)
        router.push('/login')
      }
    }
  }, [isAuthenticated, isLoading, router])

  // ── JWT expiry auto-logout ─────────────────────────────────────────────────
  useEffect(() => {
    if (!token || token === 'not-required') return

    const remaining = msUntilExpiry(token)
    if (remaining <= 0) {
      // Already expired (e.g. tab was left open)
      logout()
      router.push('/login')
      return
    }

    // Schedule logout exactly when the token expires
    const timer = setTimeout(() => {
      console.info('[Auth] Session expired — auto logout')
      logout()
      router.push('/login')
    }, remaining)

    return () => clearTimeout(timer)
  }, [token, logout, router])

  // Show loading spinner during initial auth check or while loading
  if (isLoading || !hasCheckedAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  // Don't render anything if not authenticated (during redirect)
  const hasLocalSession = typeof window !== 'undefined'
    ? localStorage.getItem('kavach_session') === 'true'
    : false

  if (!isAuthenticated || !hasLocalSession) {
    return null
  }

  return (
    <ErrorBoundary>
      <CreateDialogsProvider>
        {children}
        <ModalProvider />
        <CommandPalette />
      </CreateDialogsProvider>
    </ErrorBoundary>
  )
}
