'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { useAuthStore } from '@/lib/stores/auth-store'
import { getConfig, getApiUrl } from '@/lib/config'
import { AlertCircle, Eye, EyeOff, CheckCircle2, XCircle, BookOpen } from 'lucide-react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import Image from 'next/image'

// Image Imports
import signUpIllustration from '@/assets/Wavy_Gen-01_Single-071.jpg'

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
const STRENGTH_COLOR = ['', '#ef4444', '#f59e0b', '#3b82f6', '#A855F7']

// ── Themed Panel ──────────────────────────────────────────────────────────────
function ThemedPanel({
  mode,
  onSwitch,
}: {
  mode: 'signin' | 'signup' | 'forgot'
  onSwitch: () => void
}) {
  return (
    <div className="hidden md:flex flex-col relative overflow-hidden md:w-1/2  flex-shrink-0 p-8 lg:p-10 text-white bg-[#02041A]">
      <style>{`
        @keyframes btnFadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .btn-anim {
          opacity: 0;
          animation: btnFadeIn 1s ease-out 0.5s forwards;
        }
      `}</style>

      <div className="absolute inset-0 z-0 overflow-hidden">
        <Image
          src={signUpIllustration}
          alt="Background Illustration"
          fill
          className="object-cover object-center z-0 "
          priority
        />
      </div>

      <div className="relative z-20 flex flex-col flex-grow justify-end items-center max-w-[80%] mx-auto w-full">
        <button
          onClick={onSwitch}
          className="px-10 py-4 w-[240px] rounded-xl text-white text-[16px] font-black shadow-lg shadow-violet-900/40 transition-all active:scale-[0.98] btn-anim"
          style={{ background: 'linear-gradient(90deg, #8B5CF6 0%, #7C3AED 100%)' }}
        >
          {mode === 'signin' ? 'Sign Up' : 'Sign In'}
        </button>
      </div>
    </div>
  )
}

// ── Field border helper ───────────────────────────────────────────────────────
function inputClass(hasError: boolean) {
  return `w-full px-4 py-3 sm:py-4 border rounded-xl bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all ${
    hasError
      ? 'border-red-400 focus:border-red-400 focus:ring-red-50'
      : 'border-slate-200 focus:border-[#8B5CF6] focus:ring-violet-50'
  }`
}

// ── Main component ────────────────────────────────────────────────────────────
export function LoginForm({ initialMode = 'signin' }: { initialMode?: 'signin' | 'signup' }) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)

  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [agreed, setAgreed] = useState(false)

  const [localError, setLocalError] = useState('')
  const [localLoading, setLocalLoading] = useState(false)
  const [animating, setAnimating] = useState(false)

  const { login, isLoading: authLoading } = useAuth()
  const { authRequired, checkAuthRequired, hasHydrated, isAuthenticated } = useAuthStore()
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [configInfo, setConfigInfo] = useState<{ version: string } | null>(null)
  const router = useRouter()

  const isLoading = authLoading || localLoading
  const emailState = getEmailState(email)

  const emailError = emailTouched && emailState === 'invalid' ? 'Enter a valid email address.' : ''
  const nameError = nameTouched && name.trim().length < 2 ? 'Name must be at least 2 characters.' : ''
  const passwordChecks = getPasswordChecks(password)
  const strengthLevel = getStrengthLevel(password)
  const passwordError =
    mode === 'signin'
      ? passwordTouched && !password.trim() ? 'Password is required.' : ''
      : passwordTouched && password.length > 0 && !isPasswordValid(password)
        ? 'Password does not meet requirements.'
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
          if (hasSession) router.push('/dashboard')
          else setIsCheckingAuth(false)
        }
      } catch { setIsCheckingAuth(false) }
      finally { setIsCheckingAuth(false) }
    }
    if (authRequired !== null) {
      if (!authRequired) {
        const hasSession = localStorage.getItem('kavach_session') === 'true'
        if (hasSession && isAuthenticated) router.push('/dashboard')
        else setIsCheckingAuth(false)
      } else { setIsCheckingAuth(false) }
    } else { void checkAuth() }
  }, [hasHydrated, authRequired, checkAuthRequired, router, isAuthenticated])

  if (!hasHydrated || isCheckingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#EBEFFE]" style={{ background: 'linear-gradient(135deg, #EBEFFE 0%, #F5F1FD 100%)' }}>
        <LoadingSpinner />
      </div>
    )
  }

  const switchMode = (m: 'signin' | 'signup') => {
    if (animating) return
    setAnimating(true)
    setTimeout(() => {
      setMode(m)
      // Keep the URL in sync with the active mode
      router.replace(m === 'signup' ? '/signup' : '/login')
      setLocalError('')
      setName(''); setNameTouched(false)
      setEmail(''); setEmailTouched(false)
      setPassword(''); setPasswordTouched(false)
      setAgreed(false)
      setAnimating(false)
    }, 200)
  }

  const handleSignUp = async () => {
    setNameTouched(true); setEmailTouched(true); setPasswordTouched(true)
    if (name.trim().length < 2 || emailState !== 'valid' || !isPasswordValid(password)) {
       setLocalError('Please correct the errors before continuing.')
       return 
    }
    setLocalLoading(true)
    const result = await registerUserBackend(name.trim(), email.trim().toLowerCase(), password)
    if (result.conflict) { setLocalError('Email already exists.'); setLocalLoading(false); return }
    if (!result.ok) { setLocalError(result.error ?? 'Failed.'); setLocalLoading(false); return }
    saveUserLocally({ name: name.trim(), email: email.trim().toLowerCase(), password })
    setLocalLoading(false)
    switchMode('signin')
  }

  const handleSignIn = async () => {
    setEmailTouched(true); setPasswordTouched(true)
    if (emailState !== 'valid' || !password.trim()) return
    setLocalLoading(true)
    const ok = await login(email.trim().toLowerCase(), password)
    if (!ok) { setLocalError('Invalid credentials.'); setLocalLoading(false); return }
    localStorage.setItem('kavach_session', 'true')
    router.push('/dashboard')
    setLocalLoading(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'signup') void handleSignUp()
    else void handleSignIn()
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#EBEFFE] p-4 sm:p-6 lg:p-8 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #EBEFFE 0%, #F5F1FD 100%)' }}>
      <div className="flex flex-col md:flex-row w-full max-w-[1200px] min-h-[auto] md:min-h-[820px] bg-white rounded-[24px] sm:rounded-[40px] shadow-2xl overflow-hidden border border-white z-10">

        {mode === 'signin' && <ThemedPanel mode="signin" onSwitch={() => switchMode('signup')} />}

        <div
          className={`flex flex-col justify-center bg-white px-6 sm:px-12 lg:px-16 py-10 sm:py-12 relative w-full md:w-1/2 ${mode === 'signup' ? 'order-2 md:order-1' : ''}`}
          style={{ opacity: animating ? 0 : 1, transition: 'opacity 0.2s ease' }}
        >
          <div className="flex justify-center mb-6">
            <div className="flex items-center gap-3 relative group">
              <div className="absolute -left-4 -top-4 w-24 h-24 bg-[#7B3AED] opacity-[0.15] blur-[32px] rounded-full pointer-events-none" />
              <div className="w-15 h-15 shrink-0 rounded-[14px] bg-gradient-to-br from-[#7B3AED] to-[#9333EA] flex items-center justify-center shadow-[0_8px_24px_-4px_rgba(123,58,237,0.45)] relative overflow-hidden">
                <BookOpen className="relative z-10 h-8 w-8 text-white transition-transform duration-500 ease-out group-hover:scale-110 group-hover:rotate-3" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[25px] font-bold text-[#7B3AED] uppercase leading-none tracking-tight">NOTEBOOKS</span>
                <span className="text-[16px] text-slate-500 font-medium leading-tight">AI Knowledge Base</span>
              </div>
            </div>
          </div>

          <div className="mb-6 sm:mb-10">
            <h2 className="font-black text-slate-900 text-[24px] sm:text-[32px] tracking-tight text-center mb-2">
              {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-sm text-[#8B5CF6] font-bold text-center">
              {mode === 'signin' ? 'Sign In To Get Started' : 'Sign Up To Get Started'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" noValidate>
            {localError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs sm:text-sm font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />{localError}
              </div>
            )}

            {mode === 'signup' && (
              <div className="space-y-1">
                <label className="text-sm font-bold text-slate-700 ml-1">Full Name</label>
                <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} className={inputClass(!!nameError)} />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 ml-1">Email Address</label>
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass(!!emailError)} />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} className={inputClass(!!passwordError)} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {mode === 'signin' && (
                <div className="flex justify-end pt-1">
                  <button type="button" onClick={() => router.push('/forgot')} className="text-[11px] sm:text-[12px] text-[#8B5CF6] font-bold uppercase">
                    Forgot Password?
                  </button>
                </div>
              )}
            </div>

            <button type="submit" disabled={isLoading} className="w-full py-3 sm:py-4 rounded-2xl text-white text-[15px] sm:text-[16px] font-black shadow-xl transition-all active:scale-[0.98] bg-[#8B5CF6]">
              {isLoading ? <LoadingSpinner /> : (mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT')}
            </button>
          </form>

          <p className="text-sm text-slate-400 font-bold text-center pt-6">
            {mode === 'signin' ? 'New to Kavach?' : 'Already have an account?'}{' '}
            <button onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')} className="text-[#8B5CF6]">
              {mode === 'signin' ? 'Create an Account' : 'Sign In'}
            </button>
          </p>
        </div>

        {mode === 'signup' && <ThemedPanel mode="signup" onSwitch={() => switchMode('signin')} />}
      </div>
    </div>
  )
}