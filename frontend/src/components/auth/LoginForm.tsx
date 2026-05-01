'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { useAuthStore } from '@/lib/stores/auth-store'
import { getConfig, getApiUrl } from '@/lib/config'
import { AlertCircle, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import Image from 'next/image'
import { ForgotPasswordModal } from './ForgotPasswordModal'

// Image Imports
import KavachLogo from '@/assets/kavach_logo.png'
import signInIllustration from '@/assets/10241279-01.png'
import signUpIllustration from '@/assets/Data_security_011.png'

// ── Local user store ──────────────────────────────────────────────────────────
interface LocalUser { name: string; email: string; password: string }

function getUsers(): LocalUser[] {
  try { return JSON.parse(localStorage.getItem('kavach_users') || '[]') } catch { return [] }
}
function saveUserLocally(u: LocalUser) {
  const users = getUsers()
  const idx = users.findIndex(x => x.email.toLowerCase() === u.email.toLowerCase())
  if (idx >= 0) users[idx] = u; else users.push(u)
  localStorage.setItem('kavach_users', JSON.stringify(users))
}

// ── Backend user API helpers ──────────────────────────────────────────────────
async function registerUserBackend(
  name: string,
  email: string,
  password: string,
): Promise<{ ok: boolean; conflict: boolean; error?: string }> {
  try {
    const apiUrl = await getApiUrl()
    const res = await fetch(`${apiUrl}/api/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    if (res.ok) return { ok: true, conflict: false }
    if (res.status === 409) return { ok: false, conflict: true }
    if (res.status === 422) {
      const data = await res.json().catch(() => ({}))
      const detail = data?.detail
      const msg = Array.isArray(detail)
        ? detail.map((d: { msg?: string }) => d.msg).join(' ')
        : typeof detail === 'string'
        ? detail
        : 'Validation failed. Please check your inputs.'
      return { ok: false, conflict: false, error: msg }
    }
    return { ok: false, conflict: false, error: 'Registration failed. Please try again.' }
  } catch {
    return { ok: false, conflict: false, error: 'Unable to connect to server.' }
  }
}

// ── Validation helpers ────────────────────────────────────────────────────────
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
type EmailState = 'empty' | 'invalid' | 'valid'
function getEmailState(email: string): EmailState {
  if (!email) return 'empty'
  return EMAIL_REGEX.test(email.trim()) ? 'valid' : 'invalid'
}

interface PasswordCheck { label: string; pass: boolean }
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
  return getPasswordChecks(pw).filter(c => c.pass).length as 0 | 1 | 2 | 3 | 4
}
const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLOR = ['', '#ef4444', '#f59e0b', '#3b82f6', '#FF7043']

// ── Themed Panel ──────────────────────────────────────────────────────────────
function ThemedPanel({
  mode,
}: {
  mode: 'signin' | 'signup' | 'forgot'
  onSwitch: () => void
  illustration?: typeof signInIllustration
}) {
  const bgImage = mode === 'signin' ? signInIllustration : signUpIllustration
  return (
    <div
      className="flex flex-col relative overflow-hidden w-1/2 flex-shrink-0 animate-in fade-in duration-700"
      style={{ backgroundColor: '#FFF0EC' }}
    >
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#FF7043]/10 blur-[80px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-[#FF7043]/10 blur-[80px]" />
      <div className="absolute inset-0 z-0 flex items-center justify-center p-8 pointer-events-none">
        <div className="relative w-full h-full flex items-center justify-center scale-110">
          <Image
            src={bgImage}
            alt={`${mode} illustration`}
            fill
            className="object-contain object-center drop-shadow-2xl"
            quality={100}
            priority
          />
        </div>
      </div>
      <div className="relative z-10 flex w-full justify-center pt-10">
        <Image src={KavachLogo} alt="Kavach Logo" width={160} height={60} className="object-contain" />
      </div>
      <div className="flex-1" />
    </div>
  )
}

// ── Field border helper ───────────────────────────────────────────────────────
function inputClass(hasError: boolean) {
  return `w-full px-4 py-4 border rounded-xl bg-slate-50/50 focus:outline-none focus:ring-4 transition-all ${
    hasError
      ? 'border-red-400 focus:border-red-400 focus:ring-red-50'
      : 'border-slate-200 focus:border-[#FF7043] focus:ring-orange-50'
  }`
}

// ── Main component ────────────────────────────────────────────────────────────
export function LoginForm() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')

  // Shared fields
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Sign-up only
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
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
  const emailState = getEmailState(email)

  // Derived inline validation (only shown after field is touched)
  const emailError = emailTouched && emailState === 'invalid' ? 'Enter a valid email address (e.g. user@example.com).' : ''
  const nameError = nameTouched && name.trim().length < 2 ? 'Name must be at least 2 characters.' : ''
  const passwordChecks = getPasswordChecks(password)
  const strengthLevel = getStrengthLevel(password)
  // Sign-in: just require non-empty. Sign-up: full strength check.
  const passwordError =
    mode === 'signin'
      ? passwordTouched && !password.trim() ? 'Password is required.' : ''
      : passwordTouched && password.length > 0 && !isPasswordValid(password)
        ? 'Password does not meet the requirements below.'
        : ''

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
      } catch { setIsCheckingAuth(false) }
      finally { setIsCheckingAuth(false) }
    }
    if (authRequired !== null) {
      if (!authRequired) {
        const hasSession = localStorage.getItem('kavach_session') === 'true'
        if (hasSession && isAuthenticated) router.push('/notebooks')
        else setIsCheckingAuth(false)
      } else { setIsCheckingAuth(false) }
    } else { void checkAuth() }
  }, [hasHydrated, authRequired, checkAuthRequired, router, isAuthenticated])

  if (!hasHydrated || isCheckingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#FFF0EC]">
        <LoadingSpinner />
      </div>
    )
  }

  const switchMode = (m: 'signin' | 'signup') => {
    if (animating) return
    setAnimating(true)
    setTimeout(() => {
      setMode(m)
      setLocalError('')
      setName(''); setNameTouched(false)
      setEmail(''); setEmailTouched(false)
      setPassword(''); setPasswordTouched(false)
      setAgreed(false)
      setAnimating(false)
    }, 200)
  }

  // ── Sign-up ─────────────────────────────────────────────────────────────────
  const handleSignUp = async () => {
    setNameTouched(true); setEmailTouched(true); setPasswordTouched(true)
    setLocalError('')

    if (name.trim().length < 2) { setLocalError('Name must be at least 2 characters.'); return }
    if (emailState !== 'valid') { setLocalError('Enter a valid email address.'); return }
    if (!isPasswordValid(password)) { setLocalError('Password does not meet the strength requirements.'); return }
    if (!agreed) { setLocalError('Please agree to the Terms & Conditions.'); return }

    setLocalLoading(true)
    const result = await registerUserBackend(name.trim(), email.trim().toLowerCase(), password)
    if (result.conflict) {
      setLocalError('An account with this email already exists. Please sign in.')
      setLocalLoading(false)
      return
    }
    if (!result.ok) {
      setLocalError(result.error ?? 'Registration failed. Please try again.')
      setLocalLoading(false)
      return
    }
    // Cache locally for fast name resolution
    saveUserLocally({ name: name.trim(), email: email.trim().toLowerCase(), password })
    setLocalLoading(false)
    switchMode('signin')
  }

  // ── Sign-in ─────────────────────────────────────────────────────────────────
  const handleSignIn = async () => {
    setEmailTouched(true); setPasswordTouched(true)
    setLocalError('')

    if (emailState !== 'valid') { setLocalError('Enter a valid email address.'); return }
    if (!password.trim()) { setLocalError('Password is required.'); return }

    const normalizedEmail = email.trim().toLowerCase()
    setLocalLoading(true)

    // Single call to /api/auth/login — validates kavach_user credentials
    // and returns the global api_token. No global password needed.
    const ok = await login(normalizedEmail, password)
    if (!ok) {
      setLocalError('Invalid email or password.')
      setLocalLoading(false)
      return
    }

    // Claim any notebooks with owner = NONE and assign to this user
    try {
      const apiUrl = await getApiUrl()
      const apiToken = sessionStorage.getItem('kavach_api_password') ?? ''
      await fetch(`${apiUrl}/api/notebooks/claim-unowned`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
          'X-User-Email': normalizedEmail,
        },
      })
    } catch { /* non-fatal */ }

    localStorage.setItem('kavach_session', 'true')
    // Navigation is handled by use-auth handleLogin → router.push('/notebooks')
    setLocalLoading(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'signup') void handleSignUp()
    else void handleSignIn()
  }

  const isSignIn = mode === 'signin'

  if (forgotOpen) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#FFF0EC] p-4 sm:p-8 relative overflow-hidden">
        <div className="flex w-full max-w-[1100px] min-h-[720px] bg-white rounded-[40px] shadow-[0_32px_64px_-12px_rgba(255,112,67,0.15)] overflow-hidden border border-white z-10">
          <ForgotPasswordModal
            open={forgotOpen}
            onClose={() => setForgotOpen(false)}
            onSignIn={() => { setForgotOpen(false); switchMode('signin') }}
          />
        </div>
        <p className="absolute bottom-6 right-8 text-slate-300 text-[11px] font-bold tracking-widest uppercase">
          v{configInfo?.version ?? '1.8.1'} • SECURE
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FFF0EC] p-4 sm:p-8 relative overflow-hidden">
      <div className="flex w-full max-w-[1100px] min-h-[720px] bg-white rounded-[40px] shadow-[0_32px_64px_-12px_rgba(255,112,67,0.15)] overflow-hidden border border-white z-10">

        {/* ── SIGN IN ─────────────────────────────────────────────────────── */}
        {isSignIn ? (
          <>
            <ThemedPanel mode="signin" onSwitch={() => switchMode('signup')} />
            <div
              className="flex flex-col justify-center bg-white px-12 sm:px-16 py-12 relative w-1/2"
              style={{ opacity: animating ? 0 : 1, transition: 'opacity 0.2s ease' }}
            >
              <div className="mb-10">
                <h2 className="font-black text-slate-900 text-[32px] mb-2 tracking-tight">Welcome Back</h2>
                <div className="h-1.5 w-12 bg-[#FF7043] rounded-full" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                {/* Global error banner */}
                {localError && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {localError}
                  </div>
                )}

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 ml-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="Enter your registered email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); if (localError) setLocalError('') }}
                    onBlur={() => setEmailTouched(true)}
                    className={inputClass(!!emailError)}
                    autoComplete="email"
                  />
                  {emailError && (
                    <p className="text-xs text-red-500 ml-1 flex items-center gap-1 mt-0.5">
                      <XCircle className="w-3 h-3 shrink-0" /> {emailError}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => { setPassword(e.target.value); if (localError) setLocalError('') }}
                      onBlur={() => setPasswordTouched(true)}
                      className={inputClass(!!passwordError)}
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="text-xs text-red-500 ml-1 flex items-center gap-1 mt-0.5">
                      <XCircle className="w-3 h-3 shrink-0" /> {passwordError}
                    </p>
                  )}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => setForgotOpen(true)}
                      className="text-[12px] text-[#FF7043] font-bold uppercase"
                    >
                      Forgot Password?
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 rounded-2xl text-white text-[16px] font-black shadow-xl shadow-orange-100 transition-all active:scale-[0.98] disabled:opacity-60"
                  style={{ background: '#FF7043' }}
                >
                  {isLoading ? <LoadingSpinner /> : 'SIGN IN'}
                </button>
              </form>

              <p className="text-sm text-slate-400 font-bold text-center pt-6">
                New to Kavach?{' '}
                <button onClick={() => switchMode('signup')} className="text-[#FF7043]">
                  Create an Account
                </button>
              </p>
            </div>
          </>
        ) : (

        /* ── SIGN UP ────────────────────────────────────────────────────── */
          <>
            <div
              className="flex flex-col justify-center bg-white px-12 sm:px-16 py-12 relative w-1/2 overflow-y-auto"
              style={{ opacity: animating ? 0 : 1, transition: 'opacity 0.2s ease' }}
            >
              <div className="mb-8">
                <h2 className="font-black text-slate-900 text-[28px] mb-2 tracking-tight">Create Account</h2>
                <div className="h-1.5 w-12 bg-[#FF7043] rounded-full" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* Global error banner */}
                {localError && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {localError}
                  </div>
                )}

                {/* Name */}
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 ml-1">Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={name}
                    onChange={e => { setName(e.target.value); if (localError) setLocalError('') }}
                    onBlur={() => setNameTouched(true)}
                    className={inputClass(!!nameError)}
                    autoComplete="name"
                  />
                  {nameError && (
                    <p className="text-xs text-red-500 ml-1 flex items-center gap-1 mt-0.5">
                      <XCircle className="w-3 h-3 shrink-0" /> {nameError}
                    </p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 ml-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={e => { setEmail(e.target.value); if (localError) setLocalError('') }}
                    onBlur={() => setEmailTouched(true)}
                    className={inputClass(!!emailError)}
                    autoComplete="email"
                  />
                  {emailError && (
                    <p className="text-xs text-red-500 ml-1 flex items-center gap-1 mt-0.5">
                      <XCircle className="w-3 h-3 shrink-0" /> {emailError}
                    </p>
                  )}
                </div>

                {/* Password + strength meter */}
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a strong password"
                      value={password}
                      onChange={e => { setPassword(e.target.value); if (localError) setLocalError('') }}
                      onBlur={() => setPasswordTouched(true)}
                      className={inputClass(!!passwordError)}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Strength bar — shown as soon as user starts typing */}
                  {password.length > 0 && (
                    <div className="pt-1 space-y-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(i => (
                          <div
                            key={i}
                            className="h-1.5 flex-1 rounded-full transition-all duration-300"
                            style={{
                              backgroundColor: i <= strengthLevel ? STRENGTH_COLOR[strengthLevel] : '#e2e8f0',
                            }}
                          />
                        ))}
                      </div>
                      {strengthLevel > 0 && (
                        <p className="text-xs font-semibold" style={{ color: STRENGTH_COLOR[strengthLevel] }}>
                          {STRENGTH_LABEL[strengthLevel]}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Per-rule checklist — shown after password field is touched */}
                  {passwordTouched && password.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {passwordChecks.map(c => (
                        <li
                          key={c.label}
                          className={`flex items-center gap-1.5 text-xs ${c.pass ? 'text-green-600' : 'text-slate-400'}`}
                        >
                          {c.pass
                            ? <CheckCircle2 className="w-3 h-3 shrink-0" />
                            : <XCircle className="w-3 h-3 shrink-0" />}
                          {c.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Terms & Conditions */}
                <label className="flex items-start gap-3 cursor-pointer select-none group">
                  <div className="relative mt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={e => { setAgreed(e.target.checked); if (localError.includes('Terms')) setLocalError('') }}
                      className="sr-only"
                    />
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${agreed ? 'bg-[#FF7043] border-[#FF7043]' : 'border-slate-300 bg-white group-hover:border-[#FF7043]'}`}>
                      {agreed && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-slate-500 leading-snug">
                    I agree to the{' '}
                    <span className="text-[#FF7043] font-semibold">Terms & Conditions</span>
                    {' '}and{' '}
                    <span className="text-[#FF7043] font-semibold">Privacy Policy</span>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-4 rounded-2xl text-white text-[16px] font-black shadow-xl shadow-orange-100 transition-all active:scale-[0.98] disabled:opacity-60"
                  style={{ background: '#FF7043' }}
                >
                  {isLoading ? <LoadingSpinner /> : 'CREATE ACCOUNT'}
                </button>
              </form>

              <p className="text-sm text-slate-400 font-bold text-center pt-4">
                Already have an account?{' '}
                <button onClick={() => switchMode('signin')} className="text-[#FF7043]">
                  Sign In
                </button>
              </p>
            </div>
            <ThemedPanel mode="signup" onSwitch={() => switchMode('signin')} />
          </>
        )}
      </div>
      <p className="absolute bottom-6 right-8 text-slate-300 text-[11px] font-bold tracking-widest uppercase">
        v{configInfo?.version ?? '1.8.1'} • SECURE
      </p>
    </div>
  )
}
