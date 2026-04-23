'use client'

import { useState, useEffect, useRef } from 'react'
import { AlertCircle, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { getApiUrl } from '@/lib/config'

// ── User helpers (localStorage — same as LoginForm) ───────────────────────────
function emailExists(email: string): boolean {
  try {
    const users = JSON.parse(localStorage.getItem('kavach_users') || '[]')
    return users.some((u: { email: string }) => u.email.toLowerCase() === email.toLowerCase())
  } catch {
    return false
  }
}

function updateUserPassword(email: string, newPassword: string): boolean {
  try {
    const users = JSON.parse(localStorage.getItem('kavach_users') || '[]')
    const idx = users.findIndex((u: { email: string }) => u.email.toLowerCase() === email.toLowerCase())
    if (idx === -1) return false
    users[idx].password = newPassword
    localStorage.setItem('kavach_users', JSON.stringify(users))
    return true
  } catch {
    return false
  }
}

// ── Password validation ───────────────────────────────────────────────────────
interface PasswordCheck {
  label: string
  pass: boolean
}

function getPasswordChecks(pw: string): PasswordCheck[] {
  return [
    { label: 'At least 8 characters',           pass: pw.length >= 8 },
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
const STRENGTH_COLOR = ['', '#ef4444', '#f59e0b', '#3b82f6', '#22c55e']

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiSendOTP(email: string): Promise<void> {
  const base = await getApiUrl()
  const res = await fetch(`${base}/api/otp/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to send OTP.')
  }
}

async function apiVerifyOTP(email: string, otp: string): Promise<void> {
  const base = await getApiUrl()
  const res = await fetch(`${base}/api/otp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || 'Invalid or expired OTP.')
  }
}

async function apiClearOTP(email: string): Promise<void> {
  const base = await getApiUrl()
  await fetch(`${base}/api/otp/clear`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  }).catch(() => {/* non-critical */})
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  open: boolean
  onClose: () => void
  onSignIn: () => void
}

type Step = 'email' | 'otp' | 'newPassword'

// ── Component ─────────────────────────────────────────────────────────────────
export function ForgotPasswordModal({ open, onClose, onSignIn }: Props) {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [newPasswordTouched, setNewPasswordTouched] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(60)
  const [canResend, setCanResend] = useState(false)
  const [success, setSuccess] = useState(false)

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  // OTP countdown timer
  useEffect(() => {
    if (step !== 'otp') return
    setTimeLeft(60)
    setCanResend(false)
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { setCanResend(true); clearInterval(interval); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [step])

  // Reset everything when closed
  useEffect(() => {
    if (!open) {
      setStep('email')
      setEmail('')
      setOtpDigits(['', '', '', '', '', ''])
      setNewPassword('')
      setConfirmPassword('')
      setError('')
      setLoading(false)
      setSuccess(false)
      setNewPasswordTouched(false)
    }
  }, [open])

  // Auto-focus first OTP box when entering OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    }
  }, [step])

  if (!open) return null

  // ── OTP box handlers ────────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otpDigits]
    next[index] = digit
    setOtpDigits(next)
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (otpDigits[index]) {
        const next = [...otpDigits]
        next[index] = ''
        setOtpDigits(next)
      } else if (index > 0) {
        otpRefs.current[index - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus()
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = ['', '', '', '', '', '']
    pasted.split('').forEach((ch, i) => { next[i] = ch })
    setOtpDigits(next)
    const focusIdx = Math.min(pasted.length, 5)
    otpRefs.current[focusIdx]?.focus()
  }

  // ── Step handlers ───────────────────────────────────────────────────────────
  const handleSendOTP = async () => {
    setError('')
    if (!email.trim()) { setError('Email is required.'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email.'); return }
    if (!emailExists(email)) { setError('No account found with this email.'); return }

    setLoading(true)
    try {
      await apiSendOTP(email.trim().toLowerCase())
      setStep('otp')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send OTP.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    setError('')
    const otp = otpDigits.join('')
    if (otp.length !== 6) { setError('Please enter all 6 digits.'); return }

    setLoading(true)
    try {
      await apiVerifyOTP(email.trim().toLowerCase(), otp)
      setStep('newPassword')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid or expired OTP.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    setError('')
    if (!newPassword.trim()) { setError('New password is required.'); return }
    if (!isPasswordValid(newPassword)) {
      setError('Password must have 8+ chars, 1 uppercase, 1 lowercase, and 1 special character.')
      return
    }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }

    setLoading(true)
    try {
      const ok = updateUserPassword(email.trim().toLowerCase(), newPassword)
      if (!ok) { setError('Failed to update password.'); return }
      await apiClearOTP(email.trim().toLowerCase())
      setSuccess(true)
    } catch {
      setError('Failed to update password.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendOTP = async () => {
    setError('')
    setLoading(true)
    try {
      await apiSendOTP(email.trim().toLowerCase())
      setOtpDigits(['', '', '', '', '', ''])
      setTimeLeft(60)
      setCanResend(false)
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP.')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col justify-center bg-white"
      style={{ flex: 1, minWidth: 0, padding: '48px 52px' }}
    >
      {/* ── Success screen ── */}
      {success ? (
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <h2 className="font-bold text-gray-900 text-2xl">Password Updated!</h2>
          <p className="text-sm text-gray-500">Your password has been reset successfully.</p>
          <button
            onClick={() => { onClose(); onSignIn() }}
            className="mt-2 w-full py-3 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]"
            style={{
              background: 'linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)',
              boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
            }}
          >
            Sign In
          </button>
        </div>
      ) : (
        <>
          {/* ── Header ── */}
          <div className="mb-8">
            <h2 className="font-bold text-gray-900 text-2xl mb-1">
              {step === 'email' && 'Forgot Your'}
              {step === 'otp' && 'Verify Your'}
              {step === 'newPassword' && 'Reset Your'}
              {' '}
              <span className="text-blue-600">
                {step === 'email' && 'Password?'}
                {step === 'otp' && 'Identity'}
                {step === 'newPassword' && 'Password'}
              </span>
            </h2>
            <p className="text-sm text-gray-400">
              {step === 'email' && 'Enter your registered email to receive an OTP.'}
              {step === 'otp' && `A 6-digit code was sent to ${email}`}
              {step === 'newPassword' && 'Create a strong new password for your account.'}
            </p>
          </div>

          <div className="space-y-5">
            {/* ── Step 1: Email ── */}
            {step === 'email' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Email Address</label>
                <input
                  type="email"
                  placeholder="Enter Your Registered Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendOTP()}
                  disabled={loading}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors placeholder:text-gray-400"
                />
              </div>
            )}

            {/* ── Step 2: OTP boxes ── */}
            {step === 'otp' && (
              <div className="space-y-4">
                <div className="flex gap-3 justify-center">
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
                      disabled={loading}
                      className={[
                        'w-11 h-12 text-center text-lg font-bold rounded-lg border-2 bg-gray-50 focus:outline-none focus:bg-white transition-all',
                        digit
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 focus:border-blue-400 text-gray-800',
                      ].join(' ')}
                    />
                  ))}
                </div>

                {/* Timer / Resend */}
                <div className="flex items-center justify-between text-xs px-1">
                  <span className={timeLeft > 0 ? 'text-gray-400' : 'text-red-500'}>
                    {timeLeft > 0 ? `OTP expires in ${timeLeft}s` : 'OTP expired'}
                  </span>
                  <span className="text-gray-400">
                    Didn&apos;t Receive The Code?{' '}
                    {canResend ? (
                      <button
                        onClick={handleResendOTP}
                        disabled={loading}
                        className="text-blue-600 font-semibold hover:underline disabled:opacity-50"
                      >
                        Resend OTP
                      </button>
                    ) : (
                      <span className="text-gray-300">Resend OTP</span>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* ── Step 3: New Password ── */}
            {step === 'newPassword' && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Enter New Password"
                      value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); setNewPasswordTouched(true) }}
                      onBlur={() => setNewPasswordTouched(true)}
                      disabled={loading}
                      className={[
                        'w-full px-3 py-2.5 pr-10 text-sm rounded-lg bg-gray-50 focus:outline-none focus:bg-white transition-colors border placeholder:text-gray-400',
                        newPasswordTouched && newPassword
                          ? isPasswordValid(newPassword)
                            ? 'border-green-400 focus:border-green-500'
                            : 'border-red-400 focus:border-red-500'
                          : 'border-gray-200 focus:border-blue-400',
                      ].join(' ')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {/* Strength bar + checklist */}
                  {newPasswordTouched && newPassword && (() => {
                    const checks = getPasswordChecks(newPassword)
                    const strength = getStrengthLevel(newPassword)
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

                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Re-enter New Password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      disabled={loading}
                      className={[
                        'w-full px-3 py-2.5 pr-10 text-sm rounded-lg bg-gray-50 focus:outline-none focus:bg-white transition-colors border placeholder:text-gray-400',
                        confirmPassword && newPassword
                          ? newPassword === confirmPassword
                            ? 'border-green-400 focus:border-green-500'
                            : 'border-red-400 focus:border-red-500'
                          : 'border-gray-200 focus:border-blue-400',
                      ].join(' ')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword && newPassword && (
                    <p className={`text-xs flex items-center gap-1 mt-1 ${newPassword === confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
                      {newPassword === confirmPassword
                        ? <><CheckCircle2 className="h-3 w-3" /> Passwords match</>
                        : <><XCircle className="h-3 w-3" /> Passwords do not match</>
                      }
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 text-red-500 text-xs bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Action button */}
            <button
              onClick={() => {
                if (step === 'email') handleSendOTP()
                else if (step === 'otp') handleVerifyOTP()
                else handleResetPassword()
              }}
              disabled={loading}
              className="w-full py-3 rounded-lg text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
              style={{
                background: 'linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)',
                boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <LoadingSpinner />
                  {step === 'email' && 'Sending OTP...'}
                  {step === 'otp' && 'Verifying...'}
                  {step === 'newPassword' && 'Updating...'}
                </span>
              ) : (
                <>
                  {step === 'email' && 'Send OTP'}
                  {step === 'otp' && 'Verify OTP'}
                  {step === 'newPassword' && 'Reset Password'}
                </>
              )}
            </button>

            {/* Back to sign in */}
            <p className="text-xs text-gray-500 text-center">
              Remember Your Password?{' '}
              <button
                type="button"
                onClick={() => { onClose(); onSignIn() }}
                className="text-blue-600 font-semibold hover:underline"
              >
                Sign In
              </button>
            </p>
          </div>
        </>
      )}
    </div>
  )
}
