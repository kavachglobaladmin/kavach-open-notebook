'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Eye, EyeOff, BookOpen, XCircle } from 'lucide-react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { getApiErrorMessage } from '@/lib/utils/error-handler'
import { toast } from '@/lib/notifications/toast'
import apiClient from '@/lib/api/client'
import { useTranslation } from '@/lib/hooks/use-translation'
import Image from 'next/image'
import forgotIllust from '@/assets/Wavy_Gen-01_Single-071.jpg'

// ── User helpers (localStorage) ───────────────────────────────────────────────
function updateUserPassword(email: string, newPassword: string): boolean {
  try {
    const users = JSON.parse(localStorage.getItem('kavach_users') || '[]')
    const idx = users.findIndex((u: { email: string }) => u.email.toLowerCase() === email.toLowerCase())
    if (idx === -1) return false
    users[idx].password = newPassword
    localStorage.setItem('kavach_users', JSON.stringify(users))
    return true
  } catch { return false }
}

// ── Password validation ───────────────────────────────────────────────────────
function isPasswordValid(pw: string): boolean {
  return (
    pw.length >= 8 &&
    /[A-Z]/.test(pw) &&
    /[a-z]/.test(pw) &&
    /[^a-zA-Z0-9]/.test(pw)
  )
}
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/
type PasswordCheck = { label: string; pass: boolean }
function getPasswordChecks(pw: string): PasswordCheck[] {
  return [
    { label: 'At least 8 characters', pass: pw.length >= 8 },
    { label: 'At least 1 uppercase letter (A-Z)', pass: /[A-Z]/.test(pw) },
    { label: 'At least 1 lowercase letter (a-z)', pass: /[a-z]/.test(pw) },
    { label: 'At least 1 special character', pass: /[^a-zA-Z0-9]/.test(pw) },
  ]
}
function getStrengthLevel(pw: string): 0 | 1 | 2 | 3 | 4 {
  return getPasswordChecks(pw).filter(c => c.pass).length as 0 | 1 | 2 | 3 | 4
}
const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLOR = ['', '#ef4444', '#f59e0b', '#3b82f6', '#A855F7']
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiSendOTP(email: string): Promise<void> {
  await apiClient.post('/otp/send', { email })
}

async function apiVerifyOTP(email: string, otp: string): Promise<void> {
  await apiClient.post('/otp/verify', { email, otp })
}

async function apiClearOTP(email: string): Promise<void> {
  await apiClient.delete('/otp/clear', { data: { email } }).catch(() => {
    // non-critical cleanup
  })
}

async function apiResetPassword(email: string, newPassword: string): Promise<void> {
  await apiClient.post('/users/reset-password', { email, new_password: newPassword })
}

// ── Session storage key for passing email between steps ──────────────────────
const EMAIL_KEY = 'forgot_pw_email'

// ── Props ─────────────────────────────────────────────────────────────────────
export type ForgotStep = 'email' | 'otp' | 'newPassword'

interface Props {
  initialStep: ForgotStep
}

// ── Left illustration panel ───────────────────────────────────────────────────
function IllustrationPanel() {
  return (
    <div className="hidden md:flex flex-col relative overflow-hidden w-1/2 flex-shrink-0 bg-[#02041A]">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <Image
          src={forgotIllust}
          alt="Forgot Password Illustration"
          fill
          className="object-cover object-center"
          priority
        />
      </div>
    </div>
  )
}

// ── Logo ──────────────────────────────────────────────────────────────────────
function Logo() {
  return (
    <div className="flex justify-center mb-8">
      <div className="flex items-center gap-3 relative group">
        <div className="absolute -left-4 -top-4 w-24 h-24 bg-[#7B3AED] opacity-[0.15] blur-[32px] rounded-full pointer-events-none" />
        <div className="w-12 h-12 shrink-0 rounded-[14px] bg-gradient-to-br from-[#7B3AED] to-[#9333EA] flex items-center justify-center shadow-[0_8px_24px_-4px_rgba(123,58,237,0.45)]">
          <BookOpen className="h-6 w-6 text-white" />
        </div>
        <div className="flex flex-col text-left">
          <span className="text-[18px] font-bold text-[#7B3AED] uppercase leading-none tracking-tight">NOTEBOOKS</span>
          <span className="text-[12px] text-slate-500 font-medium leading-tight">AI Knowledge Base</span>
        </div>
      </div>
    </div>
  )
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null

  const checks = getPasswordChecks(password)
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
              style={{ backgroundColor: strengthLevel >= bar ? strengthColor : '#e2e8f0' }}
            />
          ))}
        </div>
        <span className="text-[12px] font-semibold" style={{ color: strengthColor || '#64748b' }}>
          {strengthLabel || 'Too weak'}
        </span>
      </div>
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
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function ForgotPasswordFlow({ initialStep }: Props) {
  const router = useRouter()
  const { t } = useTranslation()

  // Restore email from sessionStorage when landing on otp/reset-password directly
  const [email, setEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(EMAIL_KEY) || ''
    }
    return ''
  })

  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [otpTouched, setOtpTouched] = useState(false)
  const [newPasswordTouched, setNewPasswordTouched] = useState(false)
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const [success, setSuccess] = useState(false)

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // OTP countdown timer
  useEffect(() => {
    if (initialStep !== 'otp') return
    setTimeLeft(60)
    setCanResend(false)
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { setCanResend(true); clearInterval(interval); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [initialStep])

  // Auto-focus first OTP input
  useEffect(() => {
    if (initialStep === 'otp') {
      setTimeout(() => otpRefs.current[0]?.focus(), 80)
    }
  }, [initialStep])

  // ── OTP input handlers ────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otpDigits]; next[index] = digit; setOtpDigits(next)
    if (digit && index < 5) otpRefs.current[index + 1]?.focus()
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (otpDigits[index]) {
        const next = [...otpDigits]; next[index] = ''; setOtpDigits(next)
      } else if (index > 0) otpRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && index > 0) otpRefs.current[index - 1]?.focus()
    else if (e.key === 'ArrowRight' && index < 5) otpRefs.current[index + 1]?.focus()
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = ['', '', '', '', '', '']
    pasted.split('').forEach((ch, i) => { next[i] = ch })
    setOtpDigits(next)
    otpRefs.current[Math.min(pasted.length, 5)]?.focus()
  }

  // ── Step handlers ─────────────────────────────────────────────────────────
  const handleSendOTP = async () => {
    setError('')
    setEmailTouched(true)
    if (!email.trim()) { setError('Email is required.'); return }
    if (!EMAIL_REGEX.test(email.trim())) { setError('Enter a valid email.'); return }
    setLoading(true)
    try {
      const normalizedEmail = normalizeEmail(email)
      await apiSendOTP(normalizedEmail)
      // Persist email for subsequent steps
      sessionStorage.setItem(EMAIL_KEY, normalizedEmail)
      toast.success('OTP sent successfully')
      router.push('/otp')
    } catch (err) {
      const message = getApiErrorMessage(err, key => t(key), 'apiErrors.genericError')
      setError(message)
      toast.error(message)
    } finally { setLoading(false) }
  }

  const handleVerifyOTP = async () => {
    setError('')
    const otp = otpDigits.join('')
    setOtpTouched(true)
    if (otp.length !== 6) { setError('Please enter all 6 digits.'); return }
    setLoading(true)
    try {
      await apiVerifyOTP(normalizeEmail(email), otp)
      toast.success('OTP verified successfully')
      router.push('/reset-password')
    } catch (err) {
      const message = getApiErrorMessage(err, key => t(key), 'apiErrors.unauthorized')
      setError(message)
      toast.error(message)
    } finally { setLoading(false) }
  }

  const handleResetPassword = async () => {
    setError('')
    setNewPasswordTouched(true)
    setConfirmPasswordTouched(true)
    if (!newPassword.trim()) { setError('New password is required.'); return }
    if (!isPasswordValid(newPassword)) {
      setError('Password must be 8+ chars with uppercase, lowercase, and special character.')
      return
    }
    if (!confirmPassword.trim()) { setError('Confirm password is required.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const userEmail = normalizeEmail(email)

      // 1. Update password in the database (SurrealDB kavach_user table)
      await apiResetPassword(userEmail, newPassword)

      // 2. Also update localStorage cache for same-session login compatibility
      updateUserPassword(userEmail, newPassword)

      // 3. Clear the OTP session
      await apiClearOTP(userEmail)
      sessionStorage.removeItem(EMAIL_KEY)
      setSuccess(true)
      toast.success('Password updated successfully')
    } catch (err) {
      const message = getApiErrorMessage(err, key => t(key), 'apiErrors.genericError')
      setError(message)
      toast.error(message)
    } finally { setLoading(false) }
  }

  const handleResendOTP = async () => {
    setError(''); setLoading(true)
    try {
      await apiSendOTP(normalizeEmail(email))
      setOtpDigits(['', '', '', '', '', '']); setTimeLeft(60); setCanResend(false)
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
      toast.success('OTP resent successfully')
    } catch (err) {
      const message = getApiErrorMessage(err, key => t(key), 'apiErrors.genericError')
      setError(message)
      toast.error(message)
    } finally { setLoading(false) }
  }

  // ── Page wrapper — full screen with lavender background ──────────────────
  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 lg:p-8"
      style={{ background: 'linear-gradient(135deg, #EBEFFE 0%, #F5F1FD 100%)' }}
    >
      {/* Card */}
      <div className="flex flex-col md:flex-row w-full max-w-[1100px] min-h-[520px] max-h-[95vh] bg-white rounded-[24px] sm:rounded-[32px] shadow-2xl overflow-y-auto border border-white/80">

        {/* Left: illustration */}
        <IllustrationPanel />

        {/* Right: form */}
        <div className="flex flex-col justify-center bg-white px-8 sm:px-14 lg:px-16 py-10 sm:py-12 w-full md:w-1/2">

          {success ? (
            /* ── Success state ── */
            <div className="flex flex-col items-center text-center gap-6">
              <div className="w-20 h-20 rounded-full bg-purple-50 flex items-center justify-center border-4 border-white shadow-xl shadow-purple-100">
                <CheckCircle2 className="h-10 w-10 text-[#8B5CF6]" />
              </div>
              <div>
                <h2 className="font-black text-slate-900 text-[28px] mb-2 tracking-tight">Success!</h2>
                <p className="text-sm text-slate-500 font-medium">Your password has been reset successfully.</p>
              </div>
              <button
                onClick={() => router.push('/login')}
                className="w-full py-4 rounded-xl text-white text-[15px] font-bold shadow-lg shadow-purple-200 transition-all active:scale-[0.98]"
                style={{ background: '#8B5CF6' }}
              >
                BACK TO SIGN IN
              </button>
            </div>
          ) : (
            <>
              <Logo />

              {/* Heading */}
              <div className="mb-8 text-center">
                <h2 className="font-black text-[#0B101E] text-[28px] sm:text-[32px] tracking-tight mb-2">
                  {initialStep === 'email'       && 'Forgot Password?'}
                  {initialStep === 'otp'         && 'Verify OTP'}
                  {initialStep === 'newPassword' && 'Reset Password'}
                </h2>
                <p className="text-[14px] text-slate-500 font-medium leading-relaxed">
                  {initialStep === 'email'       && 'Enter your registered email to receive a recovery code.'}
                  {initialStep === 'otp'         && `We've sent a 6-digit code to ${email || 'your email'}`}
                  {initialStep === 'newPassword' && 'Set a new secure password for your account.'}
                </p>
              </div>

              {/* Form fields */}
              <div className="space-y-5">

                {/* ── Email step ── */}
                {initialStep === 'email' && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-slate-700 ml-1">Email Address</label>
                    <input
                      type="email"
                      placeholder="Enter Your Registered Email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onBlur={() => setEmailTouched(true)}
                      onKeyDown={e => e.key === 'Enter' && handleSendOTP()}
                      disabled={loading}
                      className="w-full px-5 py-3.5 border border-slate-200 rounded-xl bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#8B5CF6] focus:ring-4 focus:ring-violet-50 transition-all text-[15px]"
                    />
                    {emailTouched && !email.trim() && (
                      <p className="text-[12px] text-red-500 font-semibold pl-1">Email is required.</p>
                    )}
                    {emailTouched && email.trim() && !EMAIL_REGEX.test(email.trim()) && (
                      <p className="text-[12px] text-red-500 font-semibold pl-1">Enter a valid email.</p>
                    )}
                  </div>
                )}

                {/* ── OTP step ── */}
                {initialStep === 'otp' && (
                  <div className="space-y-5">
                    <div className="flex gap-2 sm:gap-3 justify-center">
                      {otpDigits.map((digit, i) => (
                        <input
                          key={i}
                          ref={el => { otpRefs.current[i] = el }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={digit}
                          onChange={e => handleOtpChange(i, e.target.value)}
                          onKeyDown={e => handleOtpKeyDown(i, e)}
                          onPaste={i === 0 ? handleOtpPaste : undefined}
                          onBlur={() => setOtpTouched(true)}
                          disabled={loading}
                          className={[
                            'w-11 h-13 sm:w-13 sm:h-14 text-center text-xl font-black rounded-xl border-2 transition-all focus:outline-none bg-white',
                            digit
                              ? 'border-[#8B5CF6] text-[#8B5CF6]'
                              : 'border-slate-200 focus:border-[#8B5CF6] focus:ring-4 focus:ring-violet-50 text-slate-800',
                          ].join(' ')}
                          style={{ width: '48px', height: '56px' }}
                        />
                      ))}
                    </div>
                    {otpTouched && otpDigits.join('').length !== 6 && (
                      <p className="text-[12px] text-red-500 font-semibold text-center">Please enter all 6 digits.</p>
                    )}
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className={timeLeft > 0 ? 'text-slate-400 font-medium' : 'text-red-500 font-bold'}>
                        {timeLeft > 0 ? `Resend in ${timeLeft}s` : 'Code expired'}
                      </span>
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        disabled={!canResend || loading}
                        className="text-[#8B5CF6] font-bold hover:underline disabled:text-slate-300 disabled:no-underline"
                      >
                        Resend OTP
                      </button>
                    </div>
                  </div>
                )}

                {/* ── New password step ── */}
                {initialStep === 'newPassword' && (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 ml-1">New Password</label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder="Enter New Password"
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          onBlur={() => setNewPasswordTouched(true)}
                          disabled={loading}
                          className="w-full px-5 py-3.5 pr-12 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#8B5CF6] focus:ring-4 focus:ring-violet-50 transition-all text-[15px]"
                        />
                        <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                          {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {newPasswordTouched && !newPassword.trim() && (
                        <p className="text-[12px] text-red-500 font-semibold pl-1">New password is required.</p>
                      )}
                      <PasswordStrength password={newPassword} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-bold text-slate-700 ml-1">Confirm Password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Re-enter New Password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          onBlur={() => setConfirmPasswordTouched(true)}
                          disabled={loading}
                          className="w-full px-5 py-3.5 pr-12 rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#8B5CF6] focus:ring-4 focus:ring-violet-50 transition-all text-[15px]"
                        />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                          {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {confirmPasswordTouched && !confirmPassword.trim() && (
                        <p className="text-[12px] text-red-500 font-semibold pl-1">Confirm password is required.</p>
                      )}
                      {confirmPasswordTouched && confirmPassword.trim() && newPassword !== confirmPassword && (
                        <p className="text-[12px] text-red-500 font-semibold pl-1">Passwords do not match.</p>
                      )}
                    </div>
                  </>
                )}

                {/* Error */}
                {error && (
                  <div className="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-50 border border-red-100 rounded-xl p-3">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                {/* CTA button */}
                <button
                  type="button"
                  onClick={() => {
                    if (initialStep === 'email') handleSendOTP()
                    else if (initialStep === 'otp') handleVerifyOTP()
                    else handleResetPassword()
                  }}
                  disabled={loading}
                  className="w-full py-4 rounded-xl text-white text-[15px] font-bold shadow-lg shadow-purple-200 transition-all active:scale-[0.98] disabled:opacity-70"
                  style={{ background: '#8B5CF6' }}
                >
                  {loading ? <LoadingSpinner /> : (
                    <>
                      {initialStep === 'email'       && 'SEND OTP'}
                      {initialStep === 'otp'         && 'VERIFY OTP'}
                      {initialStep === 'newPassword' && 'RESET PASSWORD'}
                    </>
                  )}
                </button>

                {/* Back to sign in */}
                <p className="text-[13px] text-slate-500 font-semibold text-center pt-1">
                  Remember Your Password?{' '}
                  <button
                    type="button"
                    onClick={() => router.push('/login')}
                    className="text-[#8B5CF6] font-bold hover:underline"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
