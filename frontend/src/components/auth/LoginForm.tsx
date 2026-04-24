'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { useAuthStore } from '@/lib/stores/auth-store'
import { getApiUrl, getConfig } from '@/lib/config'
import { AlertCircle, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import Image from 'next/image'
import { ForgotPasswordModal } from './ForgotPasswordModal'

// ── Backend user API ──────────────────────────────────────────────────────────
async function apiRegister(name: string, email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const apiUrl = await getApiUrl()
    const res = await fetch(`${apiUrl}/api/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    if (res.ok) return { ok: true }
    const data = await res.json().catch(() => ({}))
    if (res.status === 409) return { ok: false, error: 'Account already exists. Please sign in.' }
    return { ok: false, error: data.detail || 'Registration failed' }
  } catch {
    return { ok: false, error: 'Unable to connect to server.' }
  }
}

async function apiLogin(email: string, password: string): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const apiUrl = await getApiUrl()
    const res = await fetch(`${apiUrl}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (res.ok) {
      const data = await res.json()
      return { ok: true, name: data.name }
    }
    const data = await res.json().catch(() => ({}))
    return { ok: false, error: data.detail || 'Invalid email or password' }
  } catch {
    return { ok: false, error: 'Unable to connect to server.' }
  }
}

// ── Email validation ──────────────────────────────────────────────────────────
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/

type EmailState = 'empty' | 'invalid' | 'valid'

function getEmailState(email: string): EmailState {
  if (!email) return 'empty'
  return EMAIL_REGEX.test(email.trim()) ? 'valid' : 'invalid'
}

// ── Password validation ───────────────────────────────────────────────────────
interface PasswordCheck {
  label: string
  pass: boolean
}

function getPasswordChecks(pw: string): PasswordCheck[] {
  return [
    { label: 'At least 8 characters',            pass: pw.length >= 8 },
    { label: 'At least 1 uppercase letter (A–Z)', pass: /[A-Z]/.test(pw) },
    { label: 'At least 1 lowercase letter (a–z)', pass: /[a-z]/.test(pw) },
    { label: 'At least 1 special character',      pass: /[^a-zA-Z0-9]/.test(pw) },
  ]
}

function isPasswordValid(pw: string): boolean {
  return getPasswordChecks(pw).every(c => c.pass)
}

function getStrengthLevel(pw: string): 0 | 1 | 2 | 3 | 4 {
  const passed = getPasswordChecks(pw).filter(c => c.pass).length
  return passed as 0 | 1 | 2 | 3 | 4
}

const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLOR = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e']

// ── Blue panel ────────────────────────────────────────────────────────────────
function BluePanel({ mode, onSwitch }: { mode: 'signin' | 'signup'; onSwitch: () => void }) {
  return (
    <div
      className="flex flex-col items-center justify-between relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #1a3a8f 0%, #0f2460 60%, #0a1a4a 100%)',
        width: '45%',
        flexShrink: 0,
      }}
    >
      {/* Network dot/line pattern */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 700" preserveAspectRatio="xMidYMid slice">
        {Array.from({ length: 14 }).map((_, row) =>
          Array.from({ length: 8 }).map((_, col) => (
            <circle key={`${row}-${col}`} cx={col * 55 + 20} cy={row * 52 + 20} r="1.5" fill="rgba(255,255,255,0.13)" />
          ))
        )}
        <line x1="75"  y1="72"  x2="130" y2="124" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        <line x1="130" y1="124" x2="185" y2="72"  stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        <line x1="185" y1="72"  x2="240" y2="124" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        <line x1="75"  y1="176" x2="130" y2="124" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        <line x1="240" y1="124" x2="295" y2="176" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        <line x1="130" y1="228" x2="185" y2="176" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        <line x1="185" y1="176" x2="240" y2="228" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
        <line x1="75"  y1="280" x2="130" y2="228" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <line x1="240" y1="228" x2="295" y2="280" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        <circle cx="130" cy="124" r="3" fill="rgba(100,160,255,0.5)" />
        <circle cx="240" cy="228" r="3" fill="rgba(100,160,255,0.5)" />
        <circle cx="185" cy="176" r="4" fill="rgba(100,160,255,0.6)" />
        <circle cx="75"  cy="280" r="3" fill="rgba(100,160,255,0.4)" />
        <circle cx="295" cy="176" r="3" fill="rgba(100,160,255,0.4)" />
      </svg>

      {/* Logo top */}
      <div className="relative z-10 flex items-center gap-2 pt-10 pb-0">
        <Image src="/KavachLogo.png" alt="Kavach" width={32} height={32} className="object-contain" />
        <span className="text-white font-bold text-xl tracking-wide">kavach</span>
      </div>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center text-center gap-4 px-8">
        <p className="text-white/55 text-xs font-semibold tracking-[0.2em] uppercase">Welcome to</p>
        <h2 className="text-white font-bold leading-snug text-2xl">
          Advanced Intelligence<br />Platform for Law<br />Enforcement
        </h2>
        <p className="text-white/50 text-xs leading-relaxed" style={{ maxWidth: 230 }}>
          Empowering agencies with secure, real-time insights and seamless operational control. Built for accuracy, speed, and reliability in critical environments.
        </p>
        <button
          onClick={onSwitch}
          className="mt-1 px-10 py-2.5 rounded-full text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-95"
          style={{
            background: 'linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)',
            boxShadow: '0 4px 18px rgba(37,99,235,0.5)',
          }}
        >
          {mode === 'signin' ? 'Sign Up' : 'Sign In'}
        </button>
      </div>

      <div className="pb-8" />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function LoginForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [localError, setLocalError] = useState('')
  const [localLoading, setLocalLoading] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  const { login, isLoading: authLoading } = useAuth()
  const { authRequired, checkAuthRequired, hasHydrated, isAuthenticated } = useAuthStore()
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [configInfo, setConfigInfo] = useState<{ version: string } | null>(null)
  const router = useRouter()

  const isLoading = authLoading || localLoading
  const emailState: EmailState = getEmailState(email)

  useEffect(() => {
    getConfig().then(cfg => setConfigInfo({ version: cfg.version })).catch(() => {})
  }, [])

  useEffect(() => {
    if (!hasHydrated) return
    const checkAuth = async () => {
      try {
        const required = await checkAuthRequired()
        if (!required) {
          const hasSession = localStorage.getItem('kavach_session') === 'true'
          if (hasSession) router.push('/notebooks')
          else setIsCheckingAuth(false)
        }
      } catch { /* ignore */ }
      finally { setIsCheckingAuth(false) }
    }
    if (authRequired !== null) {
      if (!authRequired) {
        const hasSession = localStorage.getItem('kavach_session') === 'true'
        if (hasSession && isAuthenticated) router.push('/notebooks')
        else setIsCheckingAuth(false)
      } else {
        setIsCheckingAuth(false)
      }
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
    if (animating) return
    setAnimating(true)
    setTimeout(() => {
      setMode(m); setLocalError(''); setName(''); setEmail('')
      setEmailTouched(false); setPassword(''); setPasswordTouched(false)
      setAgreed(false); setAnimating(false)
    }, 200)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError('')

    if (mode === 'signup') {
      if (!name.trim())                          { setLocalError('Name is required.'); return }
      if (!email.trim())                         { setLocalError('Email is required.'); return }
      if (emailState !== 'valid')                { setLocalError('Enter a valid email address.'); return }
      if (!password.trim())                      { setLocalError('Password is required.'); return }
      if (!isPasswordValid(password))            { setLocalError('Password must have 8+ chars, 1 uppercase, 1 lowercase, and 1 special character.'); return }
      if (!agreed)                               { setLocalError('Please agree to Terms & Conditions.'); return }

      setLocalLoading(true)
      const reg = await apiRegister(name.trim(), email.trim().toLowerCase(), password)
      if (!reg.ok) {
        setLocalError(reg.error ?? 'Registration failed')
        setLocalLoading(false)
        return
      }

      // Store name in localStorage for sidebar display (non-sensitive)
      const emailLower = email.trim().toLowerCase()
      const existing: { email: string; name: string }[] = JSON.parse(localStorage.getItem('kavach_users') ?? '[]')
      if (!existing.find(u => u.email === emailLower)) {
        existing.push({ email: emailLower, name: name.trim() })
        localStorage.setItem('kavach_users', JSON.stringify(existing))
      }
      localStorage.setItem('kavach_session', 'true')
      localStorage.setItem('kavach_current_user', emailLower)
      const ok = await login(password)
      setLocalLoading(false)
      if (!ok) router.push('/notebooks')
      return
    }

    // Sign in
    if (!email.trim())          { setLocalError('Email is required.'); return }
    if (emailState !== 'valid') { setLocalError('Enter a valid email address.'); return }
    if (!password.trim())       { setLocalError('Password is required.'); return }

    setLocalLoading(true)
    const result = await apiLogin(email.trim().toLowerCase(), password)
    if (!result.ok) {
      setLocalError(result.error ?? 'Invalid email or password')
      setLocalLoading(false)
      return
    }

    // Sync name to localStorage for sidebar display
    const emailLower = email.trim().toLowerCase()
    const existing: { email: string; name: string }[] = JSON.parse(localStorage.getItem('kavach_users') ?? '[]')
    const idx = existing.findIndex(u => u.email === emailLower)
    if (idx >= 0) {
      existing[idx].name = result.name ?? existing[idx].name
    } else {
      existing.push({ email: emailLower, name: result.name ?? emailLower })
    }
    localStorage.setItem('kavach_users', JSON.stringify(existing))
    localStorage.setItem('kavach_session', 'true')
    localStorage.setItem('kavach_current_user', emailLower)
    const ok = await login(password)
    setLocalLoading(false)
    if (!ok) router.push('/notebooks')
  }

  const isSignIn = mode === 'signin'

  // When forgot-password flow is active, show it in the right panel
  if (forgotOpen) {
    return (
      <div
        className="fixed inset-0 flex"
        style={{ background: 'linear-gradient(135deg, #dce8ff 0%, #eef2ff 100%)' }}
      >
        <div className="flex w-full h-full">
          <BluePanel mode="signin" onSwitch={() => switchMode('signup')} />
          <ForgotPasswordModal
            open={forgotOpen}
            onClose={() => setForgotOpen(false)}
            onSignIn={() => { setForgotOpen(false); setMode('signin') }}
          />
        </div>
      </div>
    )
  }

  // ── Email field with live validation indicator ────────────────────────────
  const emailField = (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">Email Address</label>
      <div className="relative">
        <input
          type="email"
          placeholder="Enter Your Registered Email"
          value={email}
          onChange={e => { setEmail(e.target.value); setEmailTouched(true) }}
          onBlur={() => setEmailTouched(true)}
          disabled={isLoading}
          className={[
            'w-full px-3 py-2.5 pr-10 text-sm rounded-lg bg-gray-50 focus:outline-none focus:bg-white transition-colors placeholder:text-gray-400 border',
            emailTouched && email
              ? emailState === 'valid'
                ? 'border-green-400 focus:border-green-500'
                : 'border-red-400 focus:border-red-500'
              : 'border-gray-200 focus:border-blue-400',
          ].join(' ')}
        />
        {/* Validation icon — show only when user has typed */}
        {emailTouched && email && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {emailState === 'valid'
              ? <CheckCircle2 className="h-4 w-4 text-green-500" />
              : <XCircle className="h-4 w-4 text-red-400" />
            }
          </span>
        )}
      </div>
      {/* Inline hint below field */}
      {emailTouched && email && emailState === 'invalid' && (
        <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
          <AlertCircle className="h-3 w-3 shrink-0" />
          Please enter a valid email (e.g. name@example.com)
        </p>
      )}
      {emailTouched && email && emailState === 'valid' && (
        <p className="text-xs text-green-600 mt-0.5">✓ Valid email address</p>
      )}
    </div>
  )

  // ── Form panel ────────────────────────────────────────────────────────────
  const formPanel = (
    <div
      className="flex flex-col justify-center bg-white"
      style={{
        flex: 1,
        minWidth: 0,
        padding: '48px 52px',
        opacity: animating ? 0 : 1,
        transform: animating ? 'translateY(6px)' : 'translateY(0)',
        transition: 'opacity 0.2s ease, transform 0.2s ease',
      }}
    >
      {/* Header */}
      <div className="mb-8">
        <h2 className="font-bold text-gray-900 text-2xl mb-1">
          {isSignIn ? 'Welcome Back' : 'Create Your Account'}
        </h2>
        <p className="text-sm">
          <span className="text-blue-600 font-semibold">{isSignIn ? 'Sign In' : 'Sign Up'}</span>
          <span className="text-gray-400"> To Get Started</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name — signup only */}
        {!isSignIn && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Name</label>
            <input
              type="text"
              placeholder="Enter Your Name"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors placeholder:text-gray-400"
            />
          </div>
        )}

        {/* Email with validation */}
        {emailField}

        {/* Password */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter Your Password"
              value={password}
              onChange={e => { setPassword(e.target.value); setPasswordTouched(true) }}
              onBlur={() => setPasswordTouched(true)}
              disabled={isLoading}
              className={[
                'w-full px-3 py-2.5 pr-10 text-sm rounded-lg bg-gray-50 focus:outline-none focus:bg-white transition-colors placeholder:text-gray-400 border',
                !isSignIn && passwordTouched && password
                  ? isPasswordValid(password)
                    ? 'border-green-400 focus:border-green-500'
                    : 'border-red-400 focus:border-red-500'
                  : 'border-gray-200 focus:border-blue-400',
              ].join(' ')}
            />
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Sign In — forgot password */}
          {isSignIn && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-xs text-blue-500 hover:underline mt-0.5"
              >
                Forgot Password?
              </button>
            </div>
          )}

          {/* Sign Up — strength bar + checklist */}
          {!isSignIn && passwordTouched && password && (() => {
            const checks = getPasswordChecks(password)
            const strength = getStrengthLevel(password)
            return (
              <div className="mt-2 space-y-2">
                {/* Strength bar */}
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3, 4].map(i => (
                      <div
                        key={i}
                        className="h-1.5 flex-1 rounded-full transition-all duration-300"
                        style={{ background: i <= strength ? STRENGTH_COLOR[strength] : '#e5e7eb' }}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-semibold w-12 text-right" style={{ color: STRENGTH_COLOR[strength] }}>
                    {STRENGTH_LABEL[strength]}
                  </span>
                </div>
                {/* Checklist */}
                <ul className="space-y-1">
                  {checks.map(c => (
                    <li key={c.label} className="flex items-center gap-1.5 text-xs">
                      {c.pass
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        : <XCircle     className="h-3.5 w-3.5 text-red-400   shrink-0" />
                      }
                      <span className={c.pass ? 'text-green-600' : 'text-red-400'}>{c.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })()}
        </div>

        {/* Terms — signup only */}
        {!isSignIn && (
          <label className="flex items-start gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="rounded accent-blue-600 w-3.5 h-3.5 shrink-0 mt-0.5"
            />
            <span className="text-xs text-gray-500 leading-relaxed">
              I Agree To The{' '}
              <span className="text-blue-600 font-medium hover:underline cursor-pointer">
                Terms &amp; Conditions And Privacy Policy
              </span>
            </span>
          </label>
        )}

        {/* Submit error */}
        {localError && (
          <div className="flex items-start gap-2 text-red-500 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {localError}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
          style={{
            background: 'linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)',
            boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
          }}
        >
          {isLoading
            ? <span className="flex items-center justify-center gap-2"><LoadingSpinner />{isSignIn ? 'Signing In...' : 'Signing Up...'}</span>
            : (isSignIn ? 'Sign In' : 'Sign Up')
          }
        </button>

        {/* Switch mode */}
        <p className="text-xs text-gray-500 text-center">
          {isSignIn ? (
            <>Don&apos;t Have An Account?{' '}
              <button type="button" onClick={() => switchMode('signup')} className="text-blue-600 font-semibold hover:underline">
                Create Account
              </button>
            </>
          ) : (
            <>Remember Your Password?{' '}
              <button type="button" onClick={() => switchMode('signin')} className="text-blue-600 font-semibold hover:underline">
                Sign In
              </button>
            </>
          )}
        </p>
      </form>

      <p className="text-center text-gray-300 text-xs mt-8">v{configInfo?.version ?? '1.0'}</p>
    </div>
  )

  const bluePanel = (
    <BluePanel mode={mode} onSwitch={() => switchMode(isSignIn ? 'signup' : 'signin')} />
  )

  return (
    // Full screen — no centering card, fills entire viewport
    <div
      className="fixed inset-0 flex"
      style={{ background: 'linear-gradient(135deg, #dce8ff 0%, #eef2ff 100%)' }}
    >
      <div className="flex w-full h-full">
        {isSignIn ? (
          <>
            {bluePanel}
            {formPanel}
          </>
        ) : (
          <>
            {formPanel}
            {bluePanel}
          </>
        )}
      </div>

    </div>
  )
}
