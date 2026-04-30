'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { useAuthStore } from '@/lib/stores/auth-store'
import { getConfig, getApiUrl } from '@/lib/config'
import { AlertCircle, Eye, EyeOff, CheckCircle2, XCircle, Sparkles } from 'lucide-react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import Image from 'next/image'
import { ForgotPasswordModal } from './ForgotPasswordModal'

// Image Imports
import KavachLogo from '@/assets/kavach_logo.png'
import signInIllustration from '@/assets/10241279-01.png'
import signUpIllustration from '@/assets/Data_security_011.png'
import forgotIllustration from '@/assets/Hand.png'

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
function findUserLocally(email: string, password: string): LocalUser | null {
  return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password) ?? null
}
function emailExistsLocally(email: string): boolean {
  return getUsers().some(u => u.email.toLowerCase() === email.toLowerCase())
}

// ── Backend user API helpers ──────────────────────────────────────────────────
async function registerUserBackend(name: string, email: string, password: string): Promise<{ ok: boolean; conflict: boolean }> {
  try {
    const apiUrl = await getApiUrl()
    const res = await fetch(`${apiUrl}/api/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    if (res.ok) return { ok: true, conflict: false }
    if (res.status === 409) return { ok: false, conflict: true }
    return { ok: false, conflict: false }
  } catch { return { ok: false, conflict: false } }
}

async function loginUserBackend(email: string, password: string): Promise<{ name: string } | null> {
  try {
    const apiUrl = await getApiUrl()
    const res = await fetch(`${apiUrl}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (res.ok) {
      const data = await res.json()
      return { name: data.name ?? '' }
    }
    return null
  } catch { return null }
}

async function upsertUserBackend(name: string, email: string, apiPassword: string): Promise<void> {
  try {
    const apiUrl = await getApiUrl()
    await fetch(`${apiUrl}/api/users/upsert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiPassword}`,
        'X-User-Email': email,
      },
      body: JSON.stringify({ name, email }),
    })
  } catch { /* non-fatal */ }
}

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
  const passed = getPasswordChecks(pw).filter(c => c.pass).length
  return passed as 0 | 1 | 2 | 3 | 4
}
const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLOR = ['', '#ef4444', '#f59e0b', '#3b82f6', '#FF7043']

// ── Themed Panel (Updated for Minimalist Logo & Switch) ───────────────────────
function ThemedPanel({ mode, onSwitch, illustration }: { mode: 'signin' | 'signup' | 'forgot'; onSwitch: () => void; illustration?: typeof signInIllustration }) {
  const isSignIn = mode === 'signin'
  const switchButtonText = isSignIn ? 'Sign Up' : 'Sign In'
  // Use provided illustration, or fall back to mode-based default
  const bgImage = illustration ?? (isSignIn ? signInIllustration : signUpIllustration)

  return (
    <div
      className="flex flex-col relative overflow-hidden w-1/2 flex-shrink-0 animate-in fade-in duration-700"
      style={{ backgroundColor: '#FFF0EC' }}
    >
      {/* Decorative Glows */}
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

      {/* Transparent Logo Container */}
      <div className="relative z-10 flex w-full justify-center pt-10">
        <Image src={KavachLogo} alt="Kavach Logo" width={160} height={60} className="object-contain" />
      </div>

      <div className="flex-1" />

      {/* Simplified Switch Button */}
      {/* <div className="relative z-10 flex w-full justify-center pb-12">
        <button
          onClick={onSwitch}
          className="group px-14 py-3 rounded-xl text-white text-[15px] font-bold transition-all active:scale-95 flex items-center gap-2 hover:brightness-110"
          style={{ background: '#FF7043' }}
        >
          <Sparkles className="w-4 h-4 text-orange-100" />
          {switchButtonText}
        </button>
      </div> */}
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
    return <div className="fixed inset-0 flex items-center justify-center bg-[#FFF0EC]"><LoadingSpinner /></div>
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
      if (!name.trim()) { setLocalError('Name is required.'); return }
      if (!email.trim()) { setLocalError('Email is required.'); return }
      if (emailState !== 'valid') { setLocalError('Enter a valid email address.'); return }
      if (!password.trim()) { setLocalError('Password is required.'); return }
      if (!isPasswordValid(password)) { setLocalError('Password must have 8+ chars, 1 uppercase, 1 lowercase, and 1 special character.'); return }
      if (!agreed) { setLocalError('Please agree to Terms & Conditions.'); return }
      if (emailExistsLocally(email)) { setLocalError('Account already exists. Please sign in.'); return }
      setLocalLoading(true)
      const backendResult = await registerUserBackend(name.trim(), email.trim().toLowerCase(), password)
      if (backendResult.conflict) {
        setLocalError('Account already exists. Please sign in.')
        setLocalLoading(false)
        return
      }
      saveUserLocally({ name: name.trim(), email: email.trim().toLowerCase(), password })
      await new Promise(resolve => setTimeout(resolve, 400))
      setLocalLoading(false)
      switchMode('signin')
      return
    }
    if (!email.trim()) { setLocalError('Email is required.'); return }
    if (emailState !== 'valid') { setLocalError('Enter a valid email address.'); return }
    if (!password.trim()) { setLocalError('Password is required.'); return }
    const normalizedEmail = email.trim().toLowerCase()
    setLocalLoading(true)

    // 1. Set current user BEFORE login() so auth-store can read the email + name
    localStorage.setItem('kavach_current_user', normalizedEmail)

    // 2. Perform app-level auth (validates the API bearer password)
    const ok = await login(password)
    if (!ok) {
      localStorage.removeItem('kavach_current_user')
      setLocalError('Authentication failed. Please try again.')
      setLocalLoading(false)
      return
    }

    // 3. Resolve display name from localStorage (set during registration)
    const localUser = findUserLocally(normalizedEmail, password)
    const displayName = localUser?.name?.trim() || normalizedEmail.split('@')[0]

    // 4. Upsert the user in SurrealDB so /api/users/profile works from any device.
    //    Uses the API bearer password for auth — no separate user password needed.
    await upsertUserBackend(displayName, normalizedEmail, password)

    localStorage.setItem('kavach_session', 'true')
    router.push('/notebooks')
    setLocalLoading(false)
  }

  const isSignIn = mode === 'signin'

  // When forgotOpen is true, the ForgotPasswordModal renders its own
  // two-panel layout (illustration + form) — no outer ThemedPanel needed.
  if (forgotOpen) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#FFF0EC] p-4 sm:p-8 relative overflow-hidden">
        <div className="flex w-full max-w-[1100px] min-h-[720px] bg-white rounded-[40px] shadow-[0_32px_64px_-12px_rgba(255,112,67,0.15)] overflow-hidden border border-white z-10">
          <ForgotPasswordModal
            open={forgotOpen}
            onClose={() => setForgotOpen(false)}
            onSignIn={() => {
              setForgotOpen(false)
              switchMode('signin')
            }}
          />
        </div>
        <p className="absolute bottom-6 right-8 text-slate-300 text-[11px] font-bold tracking-widest uppercase">v{configInfo?.version ?? '1.8.1'} • SECURE</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#FFF0EC] p-4 sm:p-8 relative overflow-hidden">
      <div className="flex w-full max-w-[1100px] min-h-[720px] bg-white rounded-[40px] shadow-[0_32px_64px_-12px_rgba(255,112,67,0.15)] overflow-hidden border border-white z-10">
        {isSignIn ? (
          <>
            <ThemedPanel mode="signin" onSwitch={() => switchMode('signup')} />
            <div className="flex flex-col justify-center bg-white px-12 sm:px-16 py-12 relative w-1/2" style={{ opacity: animating ? 0 : 1, transition: 'opacity 0.2s ease' }}>
                <div className="mb-10">
                    <h2 className="font-black text-slate-900 text-[32px] mb-2 tracking-tight">Welcome Back</h2>
                    <div className="h-1.5 w-12 bg-[#FF7043] rounded-full" />
                </div>
                {/* Sign In Form Logic Here */}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-700 ml-1">Email Address</label>
                        <input
                            type="email"
                            placeholder="Enter Your Registered Email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full px-4 py-4 border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:border-[#FF7043] focus:ring-4 focus:ring-orange-50 transition-all"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
                        <div className="relative">
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Enter Your Password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full px-4 py-4 border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:border-[#FF7043] focus:ring-4 focus:ring-orange-50 transition-all"
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        <div className="flex justify-end pt-1">
                            <button type="button" onClick={() => setForgotOpen(true)} className="text-[12px] text-[#FF7043] font-bold uppercase">Forgot Password?</button>
                        </div>
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full py-4 rounded-2xl text-white text-[16px] font-black shadow-xl shadow-orange-100 transition-all active:scale-[0.98]" style={{ background: '#FF7043' }}>
                        {isLoading ? <LoadingSpinner /> : 'SIGN IN'}
                    </button>
                </form>
                <p className="text-sm text-slate-400 font-bold text-center pt-6">New to Kavach? <button onClick={() => switchMode('signup')} className="text-[#FF7043]">Create an Account</button></p>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col justify-center bg-white px-12 sm:px-16 py-12 relative w-1/2" style={{ opacity: animating ? 0 : 1, transition: 'opacity 0.2s ease' }}>
                <div className="mb-10">
                    <h2 className="font-black text-slate-900 text-[28px] mb-2 tracking-tight">Welcome To Open NoteBook</h2>
                    <div className="h-1.5 w-12 bg-[#FF7043] rounded-full" />
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-700 ml-1">Name</label>
                        <input
                            type="text"
                            placeholder="Please enter your name"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full px-4 py-4 border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:border-[#FF7043] focus:ring-4 focus:ring-orange-50 transition-all"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-700 ml-1">Email Address</label>
                        <input
                            type="email"
                            placeholder="Enter Your Registered Email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full px-4 py-4 border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:border-[#FF7043] focus:ring-4 focus:ring-orange-50 transition-all"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-sm font-bold text-slate-700 ml-1">Password</label>
                        <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter Your Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full px-4 py-4 border border-slate-200 rounded-xl bg-slate-50/50 focus:outline-none focus:border-[#FF7043] focus:ring-4 focus:ring-orange-50 transition-all"
                        />
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full py-4 rounded-2xl text-white text-[16px] font-black shadow-xl shadow-orange-100 transition-all active:scale-[0.98]" style={{ background: '#FF7043' }}>
                        {isLoading ? <LoadingSpinner /> : 'CREATE ACCOUNT'}
                    </button>
                </form>
                <p className="text-sm text-slate-400 font-bold text-center pt-6">Already have an account? <button onClick={() => switchMode('signin')} className="text-[#FF7043]">Sign In</button></p>
            </div>
            <ThemedPanel mode="signup" onSwitch={() => switchMode('signin')} />
          </>
        )}
      </div>
      <p className="absolute bottom-6 right-8 text-slate-300 text-[11px] font-bold tracking-widest uppercase">v{configInfo?.version ?? '1.8.1'} • SECURE</p>
    </div>
  )
}