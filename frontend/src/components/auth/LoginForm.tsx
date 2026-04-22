'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { useAuthStore } from '@/lib/stores/auth-store'
import { getConfig } from '@/lib/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle, Eye, EyeOff, Rocket } from 'lucide-react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

// ── Local user store (localStorage) ──────────────────────────────────────────
interface LocalUser { name: string; email: string; password: string }

function getUsers(): LocalUser[] {
  try { return JSON.parse(localStorage.getItem('kavach_users') || '[]') } catch { return [] }
}
function saveUser(u: LocalUser) {
  const users = getUsers()
  users.push(u)
  localStorage.setItem('kavach_users', JSON.stringify(users))
}
function findUser(email: string, password: string): LocalUser | null {
  return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password) ?? null
}
function emailExists(email: string): boolean {
  return getUsers().some(u => u.email.toLowerCase() === email.toLowerCase())
}

export function LoginForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [localError, setLocalError] = useState('')
  const [localLoading, setLocalLoading] = useState(false)

  const { login, isLoading: authLoading } = useAuth()
  const { authRequired, checkAuthRequired, hasHydrated, isAuthenticated } = useAuthStore()
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [configInfo, setConfigInfo] = useState<{ version: string } | null>(null)
  const router = useRouter()

  const isLoading = authLoading || localLoading

  useEffect(() => {
    getConfig().then(cfg => setConfigInfo({ version: cfg.version })).catch(() => {})
  }, [])

  useEffect(() => {
    if (!hasHydrated) return
    const checkAuth = async () => {
      try {
        const required = await checkAuthRequired()
        if (!required) router.push('/notebooks')
      } catch { /* assume auth required */ }
      finally { setIsCheckingAuth(false) }
    }
    if (authRequired !== null) {
      if (!authRequired && isAuthenticated) router.push('/notebooks')
      else setIsCheckingAuth(false)
    } else {
      void checkAuth()
    }
  }, [hasHydrated, authRequired, checkAuthRequired, router, isAuthenticated])

  if (!hasHydrated || isCheckingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#e8eef8' }}>
        <LoadingSpinner />
      </div>
    )
  }

  const switchMode = (m: 'signin' | 'signup') => {
    setMode(m)
    setLocalError('')
    setName('')
    setEmail('')
    setPassword('')
    setAgreed(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')

    // ── Sign Up ──────────────────────────────────────────────────────────────
    if (mode === 'signup') {
      if (!name.trim()) { setLocalError('Name is required.'); return }
      if (!email.trim()) { setLocalError('Email is required.'); return }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setLocalError('Enter a valid email.'); return }
      if (!password.trim()) { setLocalError('Password is required.'); return }
      if (password.length < 6) { setLocalError('Password must be at least 6 characters.'); return }
      if (!agreed) { setLocalError('Please agree to Terms & Conditions.'); return }
      if (emailExists(email)) { setLocalError('An account with this email already exists. Please sign in.'); return }

      setLocalLoading(true)
      saveUser({ name: name.trim(), email: email.trim().toLowerCase(), password })
      // Auto-login after register using backend password auth
      const ok = await login(password)
      setLocalLoading(false)
      if (!ok) {
        // Backend password not set — still allow access
        router.push('/notebooks')
      }
      return
    }

    // ── Sign In ──────────────────────────────────────────────────────────────
    if (!email.trim()) { setLocalError('Email is required.'); return }
    if (!password.trim()) { setLocalError('Password is required.'); return }

    const user = findUser(email.trim(), password)
    if (!user) {
      setLocalError('Invalid email or password.')
      return
    }

    setLocalLoading(true)
    const ok = await login(password)
    setLocalLoading(false)
    if (!ok) {
      // Backend password not set — still allow access
      router.push('/notebooks')
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #dce8ff 0%, #eef2ff 100%)' }}
    >
      <div
        className="w-full h-full flex items-center justify-center p-4"
      >
        <div
          className="w-full flex overflow-hidden rounded-3xl shadow-2xl"
          style={{ maxWidth: 900, minHeight: 540, background: 'white' }}
        >
          {/* ── Left blue panel ─────────────────────────────────────────── */}
          <div
            className="flex flex-col items-center justify-between py-12 px-10 relative overflow-hidden"
            style={{
              width: '42%',
              minWidth: 260,
              background: 'linear-gradient(160deg, #2563eb 0%, #1e40af 100%)',
              flexShrink: 0,
            }}
          >
            {/* Wave decorations */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 540" preserveAspectRatio="none">
              <path d="M190,0 Q110,135 175,270 Q240,405 155,540 L300,540 L300,0 Z" fill="white" fillOpacity="0.08" />
              <path d="M230,0 Q150,135 215,270 Q280,405 195,540 L300,540 L300,0 Z" fill="white" fillOpacity="0.05" />
              <path d="M260,0 Q180,135 245,270 Q310,405 225,540 L300,540 L300,0 Z" fill="white" fillOpacity="0.04" />
            </svg>

            <div className="relative z-10 flex flex-col items-center text-center gap-5 mt-4">
              <p className="text-white/70 text-xs font-semibold tracking-[0.2em] uppercase">Welcome to</p>
              <div
                className="rounded-full flex items-center justify-center"
                style={{ width: 72, height: 72, background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(4px)' }}
              >
                <Rocket className="text-white" style={{ width: 34, height: 34 }} />
              </div>
              <h1 className="text-white font-bold" style={{ fontSize: 32, letterSpacing: '-0.5px' }}>Kavach</h1>
              <p className="text-white/60 text-sm leading-relaxed" style={{ maxWidth: 180 }}>
                Intelligence platform for law enforcement professionals.
              </p>
            </div>

            <p className="relative z-10 text-white/30 text-xs">
              v{configInfo?.version ?? '1.0'}
            </p>
          </div>

          {/* ── Right form panel ─────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col justify-center px-10 py-10" style={{ minWidth: 0 }}>
            <h2 className="font-bold text-gray-800 mb-1" style={{ fontSize: 26 }}>
              {mode === 'signup' ? 'Create your account' : 'Welcome back'}
            </h2>
            <p className="text-sm text-gray-400 mb-8">
              {mode === 'signup' ? 'Sign up to get started' : 'Sign in to continue'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5" style={{ maxWidth: 380 }}>
              {/* Name — signup only */}
              {mode === 'signup' && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Name</label>
                  <Input
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    disabled={isLoading}
                    className="border-0 border-b-2 border-gray-200 rounded-none focus-visible:ring-0 focus-visible:border-blue-500 px-0 bg-transparent h-9 text-sm"
                  />
                </div>
              )}

              {/* Email */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">E-mail Address</label>
                <Input
                  type="email"
                  placeholder="Enter your mail"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="border-0 border-b-2 border-gray-200 rounded-none focus-visible:ring-0 focus-visible:border-blue-500 px-0 bg-transparent h-9 text-sm"
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="border-0 border-b-2 border-gray-200 rounded-none focus-visible:ring-0 focus-visible:border-blue-500 px-0 bg-transparent h-9 text-sm pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Terms — signup only */}
              {mode === 'signup' && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={e => setAgreed(e.target.checked)}
                    className="rounded accent-blue-600 w-3.5 h-3.5"
                  />
                  <span className="text-xs text-gray-500">
                    By signing up I agree with{' '}
                    <span className="text-blue-600 font-medium hover:underline cursor-pointer">
                      Terms &amp; Conditions
                    </span>
                  </span>
                </label>
              )}

              {/* Error */}
              {localError && (
                <div className="flex items-start gap-2 text-red-500 text-xs">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  {localError}
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center gap-3 pt-1">
                <button
                  type={mode === 'signup' ? 'submit' : 'button'}
                  onClick={() => mode === 'signin' && switchMode('signup')}
                  disabled={isLoading}
                  className="px-7 py-2.5 rounded-full text-sm font-semibold text-white transition-all disabled:opacity-60"
                  style={{
                    background: mode === 'signup' ? '#2563eb' : '#e5e7eb',
                    color: mode === 'signup' ? 'white' : '#6b7280',
                    boxShadow: mode === 'signup' ? '0 4px 14px rgba(37,99,235,0.35)' : 'none',
                  }}
                >
                  {isLoading && mode === 'signup' ? (
                    <span className="flex items-center gap-2"><LoadingSpinner />Signing up...</span>
                  ) : 'Sign Up'}
                </button>

                <button
                  type={mode === 'signin' ? 'submit' : 'button'}
                  onClick={() => mode === 'signup' && switchMode('signin')}
                  disabled={isLoading}
                  className="px-7 py-2.5 rounded-full text-sm font-semibold border transition-all disabled:opacity-60"
                  style={{
                    background: mode === 'signin' ? '#2563eb' : 'white',
                    color: mode === 'signin' ? 'white' : '#374151',
                    borderColor: mode === 'signin' ? '#2563eb' : '#d1d5db',
                    boxShadow: mode === 'signin' ? '0 4px 14px rgba(37,99,235,0.35)' : 'none',
                  }}
                >
                  {isLoading && mode === 'signin' ? (
                    <span className="flex items-center gap-2"><LoadingSpinner />Signing in...</span>
                  ) : 'Sign In'}
                </button>
              </div>

              {/* Switch mode hint */}
              <p className="text-xs text-gray-400 pt-1">
                {mode === 'signin' ? (
                  <>Don&apos;t have an account?{' '}
                    <button type="button" onClick={() => switchMode('signup')} className="text-blue-600 font-medium hover:underline">
                      Create one
                    </button>
                  </>
                ) : (
                  <>Already have an account?{' '}
                    <button type="button" onClick={() => switchMode('signin')} className="text-blue-600 font-medium hover:underline">
                      Sign in
                    </button>
                  </>
                )}
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
