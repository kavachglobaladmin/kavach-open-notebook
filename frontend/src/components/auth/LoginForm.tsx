'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { useAuthStore } from '@/lib/stores/auth-store'
import { getConfig } from '@/lib/config'
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
function saveUser(u: LocalUser) {
  const users = getUsers(); users.push(u)
  localStorage.setItem('kavach_users', JSON.stringify(users))
}
function findUser(email: string, password: string): LocalUser | null {
  return getUsers().find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password) ?? null
}
function emailExists(email: string): boolean {
  return getUsers().some(u => u.email.toLowerCase() === email.toLowerCase())
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

// ── Blue panel (Overlay Card) ─────────────────────────────────────────────────
function BluePanel({ mode, onSwitch }: { mode: 'signin' | 'signup'; onSwitch: () => void }) {
  const isSignIn = mode === 'signin'
  const switchButtonText = isSignIn ? 'Sign Up' : 'Sign In'
  
  const bgImage = isSignIn ? signInIllustration : signUpIllustration

  return (
    <div
      className="flex flex-col relative overflow-hidden w-1/2 flex-shrink-0"
      style={{ backgroundColor: '#4e78b3ff' }}
    >
      <div className="absolute inset-0 z-0 flex items-center justify-center p-8 pointer-events-none">
        <div className="relative w-full h-full flex items-center justify-center">
          <Image 
            src={bgImage} 
            alt={`${mode} illustration`} 
            fill 
            className="object-contain object-center" 
            quality={100}
            priority
          />
        </div>
      </div>

      <div className="relative z-10 flex w-full justify-center pt-5">
        <Image 
          src={KavachLogo} 
          alt="Kavach Logo" 
          width={175} 
          height={65} 
          className="object-contain" 
        />
      </div>

      <div className="flex-1" />

      <div className="relative z-10 flex w-full justify-center pb-10">
        <button
          onClick={onSwitch}
          className="px-16 py-3 rounded-md text-white text-sm font-bold transition-all active:scale-95"
          style={{
            background: 'rgba(31, 31, 31, 0.65)',
          }}
        >
          {switchButtonText}
        </button>
      </div>
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
      <div className="fixed inset-0 flex items-center justify-center bg-[#e8eef8]">
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
      if (emailExists(email))                    { setLocalError('Account already exists. Please sign in.'); return }

      setLocalLoading(true)
      // Save locally
      saveUser({ name: name.trim(), email: email.trim().toLowerCase(), password })
      
      // Simulate registration delay
      await new Promise(resolve => setTimeout(resolve, 800))
      
      setLocalLoading(false)
      // Redirect to Sign In after successful signup
      switchMode('signin')
      return
    }

    // Sign in flow
    if (!email.trim())      { setLocalError('Email is required.'); return }
    if (emailState !== 'valid') { setLocalError('Enter a valid email address.'); return }
    if (!password.trim())   { setLocalError('Password is required.'); return }

    const user = findUser(email.trim(), password)
    if (!user) { setLocalError('Invalid email or password.'); return }

    setLocalLoading(true)
    // Set current user BEFORE login() so auth-store can read the email + name
    localStorage.setItem('kavach_current_user', email.trim().toLowerCase())
    // Perform actual login
    const ok = await login(password)
    
    if (ok) {
      localStorage.setItem('kavach_session', 'true')
      router.push('/notebooks')
    } else {
      localStorage.removeItem('kavach_current_user')
      setLocalError('Authentication failed. Please try again.')
    }
    setLocalLoading(false)
  }

  const isSignIn = mode === 'signin'

  if (forgotOpen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#e8eef8] p-4 sm:p-8">
        <div className="flex w-full max-w-[1000px] h-[650px] bg-white rounded-2xl shadow-2xl overflow-hidden">
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

  const emailField = (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-gray-700">Email Address</label>
      <div className="relative">
        <input
          type="email"
          placeholder="Enter Your Registered Email"
          value={email}
          onChange={e => { setEmail(e.target.value); setEmailTouched(true) }}
          onBlur={() => setEmailTouched(true)}
          disabled={isLoading}
          className={[
            'w-full px-3 py-3 pr-10 text-sm rounded-lg bg-gray-50 focus:outline-none focus:bg-white transition-colors placeholder:text-gray-400 border',
            emailTouched && email
              ? emailState === 'valid'
                ? 'border-green-400 focus:border-green-500'
                : 'border-red-400 focus:border-red-500'
              : 'border-gray-200 focus:border-blue-400',
          ].join(' ')}
        />
        {emailTouched && email && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {emailState === 'valid'
              ? <CheckCircle2 className="h-4 w-4 text-green-500" />
              : <XCircle className="h-4 w-4 text-red-400" />
            }
          </span>
        )}
      </div>
      {emailTouched && email && emailState === 'invalid' && (
        <p className="text-xs text-red-500 flex items-center gap-1 mt-0.5">
          <AlertCircle className="h-3 w-3 shrink-0" />
          Please enter a valid email (e.g. name@example.com)
        </p>
      )}
    </div>
  )

  const formPanel = (
    <div
      className="flex flex-col justify-center bg-white px-10 sm:px-14 py-12 relative w-1/2"
      style={{
        opacity: animating ? 0 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      <div className="mb-8 text-center">
        <h2 className="font-extrabold text-gray-900 text-[26px] mb-2 tracking-tight">
          {isSignIn ? 'Welcome Back' : 'Create Your Account'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {!isSignIn && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-700">Name</label>
            <input
              type="text"
              placeholder="Please enter your name"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isLoading}
              className="w-full px-3 py-3 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors placeholder:text-gray-400"
            />
          </div>
        )}

        {emailField}

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-700">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter Your Password"
              value={password}
              onChange={e => { setPassword(e.target.value); setPasswordTouched(true) }}
              onBlur={() => setPasswordTouched(true)}
              disabled={isLoading}
              className={[
                'w-full px-3 py-3 pr-10 text-sm rounded-lg bg-gray-50 focus:outline-none focus:bg-white transition-colors placeholder:text-gray-400 border',
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

          {isSignIn && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                Forgot Password?
              </button>
            </div>
          )}

          {!isSignIn && passwordTouched && password && (() => {
            const checks = getPasswordChecks(password)
            const strength = getStrengthLevel(password)
            return (
              <div className="mt-2 space-y-2">
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

        {!isSignIn && (
          <label className="flex items-start gap-2 cursor-pointer select-none pt-2">
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              className="rounded accent-blue-600 w-3.5 h-3.5 shrink-0 mt-0.5 border-gray-300"
            />
            <span className="text-xs text-gray-600 font-medium">
              I Agree To The{' '}
              <span className="text-gray-800 hover:text-blue-600 transition-colors cursor-pointer">
                Terms &amp; Conditions And Privacy Policy
              </span>
            </span>
          </label>
        )}

        {localError && (
          <div className="flex items-start gap-2 text-red-500 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            {localError}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 mt-4 rounded-xl text-white text-sm font-semibold transition-all hover:bg-blue-600 active:scale-[0.98] disabled:opacity-60"
          style={{ background: '#2563eb' }}
        >
          {isLoading
            ? <span className="flex items-center justify-center gap-2"><LoadingSpinner />{isSignIn ? 'Signing In...' : 'Signing Up...'}</span>
            : (isSignIn ? 'Sign In' : 'Sign Up')
          }
        </button>

        <p className="text-xs text-gray-900 font-medium text-center pt-2">
          {isSignIn ? (
            <>Don&apos;t Have An Account?{' '}
              <button type="button" onClick={() => switchMode('signup')} className="text-blue-600 font-bold hover:underline">
                Sign Up
              </button>
            </>
          ) : (
            <>Remember Your Password?{' '}
              <button type="button" onClick={() => switchMode('signin')} className="text-blue-600 font-bold hover:underline">
                Sign In
              </button>
            </>
          )}
        </p>
      </form>

      <p className="absolute bottom-4 right-6 text-gray-300 text-[10px]">v{configInfo?.version ?? '1.0'}</p>
    </div>
  )

  const bluePanel = (
    <BluePanel mode={mode} onSwitch={() => switchMode(isSignIn ? 'signup' : 'signin')} />
  )

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#e8eef8] p-4 sm:p-8 ">
      <div className="flex w-full max-w-[1090px] min-h-[710px] bg-white rounded-4xl shadow-2xl overflow-hidden">
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