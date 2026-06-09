'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { useAuthStore } from '@/lib/stores/auth-store'
import { getApiUrl } from '@/lib/config'
import { AlertCircle, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { toast } from '@/lib/notifications/toast'
import { getApiErrorMessage } from '@/lib/utils/error-handler'
import { useTranslation } from '@/lib/hooks/use-translation'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'

// Logo and Image Imports
import logoImg from '@/assets/inotes.png'
import signUpIllustration from '@/assets/Wavy_Gen-01_Single-071.jpg'

// ── Shared Animation Config ───────────────────────────────────────────────────
// Added "as const" to fix the TypeScript 'AnimationGeneratorType' error
const smoothLayoutTransition = {
  type: 'spring',
  stiffness: 200,
  damping: 25,
  mass: 1,
} as const 

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
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
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
const STRENGTH_COLOR = ['', '#ef4444', '#f59e0b', '#3b82f6', '#00A896']

function PasswordStrength({
  password,
  checks,
  showChecklist = false,
}: {
  password: string
  checks: PasswordCheck[]
  showChecklist?: boolean
}) {
  if (!password) return null

  const strengthLevel = getStrengthLevel(password)
  const strengthLabel = STRENGTH_LABEL[strengthLevel]
  const strengthColor = STRENGTH_COLOR[strengthLevel]

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4].map((bar) => (
            <span
              key={bar}
              className="h-1.5 w-8 rounded-full transition-colors"
              style={{
                backgroundColor: strengthLevel >= bar ? strengthColor : '#e2e8f0',
              }}
            />
          ))}
        </div>
        <span className="text-[12px] font-semibold" style={{ color: strengthColor || '#64748b' }}>
          {strengthLabel || 'Too weak'}
        </span>
      </div>

      {showChecklist && (
        <div className="space-y-1">
          {checks.map((check) => (
            <div key={check.label} className="flex items-center gap-1.5 text-[12px]">
              {check.pass ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-slate-300 shrink-0" />
              )}
              <span className={check.pass ? 'text-emerald-600 font-medium' : 'text-slate-500'}>
                {check.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Themed Panel (Illustration) ───────────────────────────────────────────────
function ThemedPanel({
  mode,
  onSwitch,
}: {
  mode: 'signin' | 'signup' | 'forgot'
  onSwitch: () => void
}) {
  return (
    <motion.div 
      layout
      transition={smoothLayoutTransition}
      className="auth-illustration-panel hidden md:flex flex-col relative overflow-hidden md:w-[46%] flex-shrink-0 p-8 lg:p-10 bg-white"
    >
      <div className="absolute inset-0 z-0 overflow-hidden p-6 flex items-center justify-center">
        <Image
          src={signUpIllustration}
          alt="Background Illustration"
          fill
          className="object-contain object-center z-0 p-4"
          priority
        />
      </div>

      <div className="relative z-20 flex flex-col flex-grow justify-end items-center max-w-[80%] mx-auto w-full">
        <motion.button
          whileHover={{ scale: 1.03, boxShadow: '0 8px 24px rgba(106, 40, 163, 0.3)' }}
          whileTap={{ scale: 0.97 }}
          onClick={onSwitch}
          className="px-10 py-4 w-[240px] rounded-xl text-white text-[16px] font-black shadow-lg shadow-blue-900/10 transition-all cursor-pointer relative z-30"
          style={{ background: 'linear-gradient(90deg, #6A28A3 0%, #1D4BBA 100%)' }} // Darkened gradient
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="block"
            >
              {mode === 'signin' ? 'Sign Up' : 'Sign In'}
            </motion.span>
          </AnimatePresence>
        </motion.button>
      </div>
    </motion.div>
  )
}

// ── Field border helper ───────────────────────────────────────────────────────
function inputClass(hasError: boolean) {
  return `w-full px-4 py-3 sm:py-4 border rounded-xl bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all ${
    hasError
      ? 'border-red-400 focus:border-red-400 focus:ring-red-50'
      : 'border-slate-200 focus:border-[#1D4BBA] focus:ring-blue-50'
  }`
}

// ── Main component ────────────────────────────────────────────────────────────
export function LoginForm({ initialMode = 'signin' }: { initialMode?: 'signin' | 'signup' }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode)

  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)

  const [localError, setLocalError] = useState('')
  const [localLoading, setLocalLoading] = useState(false)
  const [animating, setAnimating] = useState(false)

  const { login, isLoading: authLoading } = useAuth()
  const { authRequired, checkAuthRequired, hasHydrated, isAuthenticated } = useAuthStore()
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const router = useRouter()

  const isLoading = authLoading || localLoading
  const emailState = getEmailState(email)

  const emailError = emailTouched
    ? (emailState === 'empty'
      ? 'Email is required.'
      : emailState === 'invalid'
        ? 'Enter a valid email address.'
        : '')
    : ''
  const nameError = nameTouched && name.trim().length < 2 ? 'Name must be at least 2 characters.' : ''
  const passwordChecks = getPasswordChecks(password)
  const passwordError =
    mode === 'signin'
      ? passwordTouched && !password.trim() ? 'Password is required.' : ''
      : passwordTouched
        ? (!password.trim()
          ? 'Password is required.'
          : !isPasswordValid(password)
            ? 'Password does not meet requirements.'
            : '')
        : ''

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
      <div className="fixed inset-0 flex items-center justify-center bg-[#F2F5FF]" style={{ background: 'linear-gradient(135deg, #F2F5FF 0%, #F8F2FF 100%)' }}>
        <LoadingSpinner />
      </div>
    )
  }

  // Improved switchMode for flawless transitions
  const switchMode = (m: 'signin' | 'signup') => {
    if (animating) return
    setAnimating(true)
    
    // Set state immediately so layout animation triggers cleanly without arbitrary timeouts
    setMode(m)
    router.replace(m === 'signup' ? '/signup' : '/login')
    setLocalError('')
    setName(''); setNameTouched(false)
    setEmail(''); setEmailTouched(false)
    setPassword(''); setPasswordTouched(false)

    // Unlock interactions after the layout animation roughly finishes
    setTimeout(() => {
      setAnimating(false)
    }, 600)
  }

  const handleSignUp = async () => {
    setNameTouched(true); setEmailTouched(true); setPasswordTouched(true)
    if (name.trim().length < 2 || emailState !== 'valid' || !isPasswordValid(password)) {
      const message = 'Please correct the highlighted validation errors.'
      setLocalError(message)
      toast.warning(message)
      return
    }
    setLocalLoading(true)
    const normalizedEmail = normalizeEmail(email)
    const result = await registerUserBackend(name.trim(), normalizedEmail, password)
    if (result.conflict) {
      const message = 'Email already exists.'
      setLocalError(message)
      toast.error(message)
      setLocalLoading(false)
      return
    }
    if (!result.ok) {
      const message = result.error ?? 'Failed.'
      setLocalError(message)
      toast.error(message)
      setLocalLoading(false)
      return
    }
    saveUserLocally({ name: name.trim(), email: normalizedEmail, password })
    toast.success('Account created successfully')
    setLocalLoading(false)
    switchMode('signin')
  }

  const handleSignIn = async () => {
    setEmailTouched(true); setPasswordTouched(true)
    if (emailState !== 'valid' || !password.trim()) {
      const message = emailState !== 'valid'
        ? 'Enter a valid email address.'
        : 'Password is required.'
      setLocalError(message)
      toast.warning(message)
      return
    }
    setLocalLoading(true)
    const ok = await login(normalizeEmail(email), password)
    if (!ok) {
      const authError = useAuthStore.getState().error
      const message = getApiErrorMessage(authError || 'Invalid credentials.', (key) => t(key), 'apiErrors.loginFailed')
      setLocalError(message)
      toast.error(message)
      setLocalLoading(false)
      return
    }
    localStorage.setItem('kavach_session', 'true')
    toast.success('Signed in successfully')
    router.push('/dashboard')
    setLocalLoading(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'signup') void handleSignUp()
    else void handleSignIn()
  }

  return (
    <div className="auth-shell min-h-screen w-full flex items-center justify-center bg-[#F2F5FF] p-4 sm:p-6 lg:p-8 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #F2F5FF 0%, #F8F2FF 100%)' }}>
      <motion.div 
        layout // Added layout here so parent tracks children perfectly
        initial={{ opacity: 0, scale: 0.97, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={smoothLayoutTransition}
        className="auth-card auth-split-layout flex flex-col md:flex-row w-full max-w-[1250px] min-h-[auto] md:min-h-[820px] max-h-[95vh] bg-white rounded-[24px] sm:rounded-[40px] shadow-[0_24px_60px_-15px_rgba(39,96,229,0.16)] overflow-y-auto border border-white z-10"
        style={{ flexDirection: mode === 'signin' ? 'row' : 'row-reverse' } as any}
      >
        <ThemedPanel mode={mode} onSwitch={() => switchMode(mode === 'signin' ? 'signup' : 'signin')} />

        <motion.div
          layout
          transition={smoothLayoutTransition}
          className="auth-form-panel flex flex-col justify-center bg-white px-6 sm:px-12 lg:px-16 py-10 sm:py-12 relative w-full md:w-[54%]"
        >
          <div className="flex justify-center mb-6">
            <div className="relative group flex justify-center">
              <div className="absolute -left-4 -top-4 w-32 h-32 bg-[#6A28A3] opacity-[0.12] blur-[32px] rounded-full pointer-events-none" />
              <div className="relative z-10">
                <Image
                  src={logoImg}
                  alt="Logo"
                  width={300} 
                  height={300} 
                  className="object-contain max-h-[150px] w-auto" 
                  priority
                />
              </div>
            </div>
          </div>

          <div className="mb-6 sm:mb-10 overflow-hidden min-h-[70px] flex flex-col items-center justify-center">
            {/* Added proper fading for text swaps */}
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center"
              >
                <h2 className="font-black text-[#0A1C40] text-[24px] sm:text-[32px] tracking-tight text-center mb-2">
                  {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
                </h2>
                <p className="text-sm text-[#0A1C40] font-bold text-center">
                  {mode === 'signin' ? 'Sign In To Get Started' : 'Sign Up To Get Started'}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" noValidate>
            {localError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs sm:text-sm font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />{localError}
              </div>
            )}

            <AnimatePresence initial={false}>
              {mode === 'signup' && (
                <motion.div 
                  initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                  animate={{ height: 'auto', opacity: 1, marginBottom: 16 }}
                  exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="space-y-1 overflow-hidden"
                >
                  <label className="text-sm font-bold text-[#0A1C40] ml-1">Full Name</label> 
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onBlur={() => setNameTouched(true)}
                    className={inputClass(!!nameError)}
                  />
                  {nameError && <p className="text-[12px] text-red-500 font-semibold pl-1">{nameError}</p>}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-1">
              <label className="text-sm font-bold text-[#0A1C40] ml-1">Email Address</label>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                className={inputClass(!!emailError)}
              />
              {emailError && <p className="text-[12px] text-red-500 font-semibold pl-1">{emailError}</p>}
            </div>

            <div className="space-y-1">
              <label className="text-sm font-bold text-[#0A1C40] ml-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onBlur={() => setPasswordTouched(true)}
                  className={inputClass(!!passwordError)}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {passwordError && <p className="text-[12px] text-red-500 font-semibold pl-1">{passwordError}</p>}
              <PasswordStrength
                password={password}
                checks={passwordChecks}
                showChecklist
              />
              {mode === 'signin' && (
                <div className="flex justify-end pt-1">
                  <button type="button" onClick={() => router.push('/forgot')} className="text-[11px] sm:text-[12px] text-[#0A1C40] font-bold uppercase cursor-pointer hover:text-[#1D4BBA] transition-colors">
                    Forgot Password?
                  </button>
                </div>
              )}
            </div>

            <motion.button 
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit" 
              disabled={isLoading} 
              className="w-full py-3 sm:py-4 rounded-2xl text-white text-[15px] sm:text-[16px] font-black shadow-xl transition-all cursor-pointer bg-gradient-to-r from-[#6A28A3] to-[#1D4BBA]"
            >
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <LoadingSpinner />
                  </motion.div>
                ) : (
                  <motion.span key={mode} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                    {mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </form>

          <p className="text-sm text-slate-400 font-bold text-center pt-6">
            {mode === 'signin' ? 'New to Kavach?' : 'Already have an account?'}{' '}
            <button 
              type="button"
              onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')} 
              className="text-[#0A1C40] hover:text-[#1D4BBA] transition-colors cursor-pointer"
            >
              {mode === 'signin' ? 'Create an Account' : 'Sign In'}
            </button>
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}