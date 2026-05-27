'use client'

import { useState, useEffect, useRef } from 'react'
import { AlertCircle, CheckCircle2, XCircle, Eye, EyeOff, BookOpen } from 'lucide-react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { getApiUrl } from '@/lib/config'
import Image from 'next/image'

// ── Illustration imports ──────────────────────────────────────────────────────
import authIllust    from '@/assets/Wavy_Tech-24_Single-02.jpg' 

// ── User helpers (localStorage) ───────────────────────────
function emailExists(email: string): boolean {
  try {
    const users = JSON.parse(localStorage.getItem('kavach_users') || '[]')
    return users.some((u: { email: string }) => u.email.toLowerCase() === email.toLowerCase())
  } 
  catch {
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
const STRENGTH_COLOR = ['', '#ef4444', '#f59e0b', '#3b82F6', '#8B5CF6']

// ── API helpers ─────────────────────────────────────
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

// ── Left illustration panel — Updated for full-height coverage ────────────────
function IllustrationPanel() {
  return (
    <div className="hidden md:flex flex-col relative overflow-hidden w-1/2 flex-shrink-0 bg-[#02041A]">
      {/* Background Illustration Container - Set to cover full height */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <Image
          src={authIllust}
          alt="Authentication Security"
          fill
          className="object-cover object-center z-0"
          quality={100}
          priority
        />
      </div>

      <div className="flex-1" />
    </div>
  )
}

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

  useEffect(() => {
    if (!open) {
      setStep('email'); setEmail(''); setOtpDigits(['', '', '', '', '', '']);
      setNewPassword(''); setConfirmPassword(''); setError('');
      setLoading(false); setSuccess(false); setNewPasswordTouched(false);
    }
  }, [open])

  useEffect(() => {
    if (step === 'otp') setTimeout(() => otpRefs.current[0]?.focus(), 50)
  }, [step])

  if (!open) return null

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
    } finally { setLoading(false) }
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
    } finally { setLoading(false) }
  }

  const handleResetPassword = async () => {
    setError('')
    if (!newPassword.trim()) { setError('New password is required.'); return }
    if (!isPasswordValid(newPassword)) {
      setError('Password must meet all security requirements.')
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
    } finally { setLoading(false) }
  }

  const handleResendOTP = async () => {
    setError(''); setLoading(true)
    try {
      await apiSendOTP(email.trim().toLowerCase())
      setOtpDigits(['', '', '', '', '', '']); setTimeLeft(60); setCanResend(false)
      setTimeout(() => otpRefs.current[0]?.focus(), 50)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend OTP.')
    } finally { setLoading(false) }
  }

  return (
    <div className="flex flex-col md:flex-row w-full h-full overflow-y-auto md:overflow-hidden">
      <IllustrationPanel />

      <div className="flex flex-col justify-center bg-white px-6 sm:px-12 md:px-16 py-10 sm:py-12 relative w-full md:w-1/2">
        {success ? (
          <div className="flex flex-col items-center text-center gap-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-purple-50 flex items-center justify-center border-4 border-white shadow-xl shadow-purple-100">
              <CheckCircle2 className="h-8 w-8 sm:h-10 sm:w-10 text-[#8B5CF6]" />
            </div>
            <div>
              <h2 className="font-black text-slate-900 text-[24px] sm:text-[28px] mb-2 tracking-tight">Success!</h2>
              <p className="text-sm text-slate-500 font-medium">Your password has been reset successfully.</p>
            </div>
            <button
              onClick={() => { onClose(); onSignIn() }}
              className="w-full py-3.5 sm:py-4 rounded-xl text-white text-[14px] sm:text-[15px] font-bold shadow-lg shadow-purple-200 transition-all active:scale-[0.98]"
              style={{ background: '#8B5CF6' }}
            >
              BACK TO SIGN IN
            </button>
          </div>
        ) : (
          <>
            
            <div className="flex justify-center mb-6">
              <div className="flex items-center gap-3 relative group">
                <div className="absolute -left-4 -top-4 w-24 h-24 bg-[#7B3AED] opacity-[0.15] blur-[32px] rounded-full pointer-events-none" />
                <div className="w-12 h-12 shrink-0 rounded-[14px] bg-gradient-to-br from-[#7B3AED] to-[#9333EA] flex items-center justify-center shadow-[0_8px_24px_-4px_rgba(123,58,237,0.45)] relative overflow-hidden">
                  <BookOpen className="relative z-10 h-6 w-6 text-white transition-transform duration-500 ease-out group-hover:scale-110 group-hover:rotate-3" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[18px] font-bold text-[#7B3AED] uppercase leading-none tracking-tight">NOTEBOOKS</span>
                  <span className="text-[12px] text-slate-500 font-medium leading-tight">AI Knowledge Base</span>
                </div>
              </div>
            </div>

            <div className="mb-8 sm:mb-10 text-center">
              <h2 className="font-black text-[#0B101E] text-[26px] sm:text-[34px] tracking-tight mb-2">
                {step === 'email'       && 'Forgot Password?'}
                {step === 'otp'         && 'Verify OTP'}
                {step === 'newPassword' && 'Reset Password'}
              </h2>
              <p className="text-[14px] sm:text-[15px] text-slate-500 font-medium leading-relaxed px-2">
                {step === 'email'       && 'Enter your registered email to receive a recovery code.'}
                {step === 'otp'         && `We've sent a 6-digit code to ${email}`}
                {step === 'newPassword' && 'Set a new secure password for your account.'}
              </p>
            </div>

            <div className="space-y-5 sm:space-y-6">
              {step === 'email' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="Enter Your Registered Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSendOTP()}
                    disabled={loading}
                    className="w-full px-4 sm:px-5 py-3.5 sm:py-4 border border-slate-200 rounded-xl bg-white focus:outline-none focus:border-[#8B5CF6] focus:ring-4 focus:ring-purple-50/50 transition-all placeholder:text-slate-400 text-[14px] sm:text-[15px]"
                  />
                </div>
              )}

              {step === 'otp' && (
                <div className="space-y-6">
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
                        disabled={loading}
                        className={[
                          'w-10 h-12 sm:w-12 sm:h-14 text-center text-lg sm:text-xl font-black rounded-xl border-2 transition-all focus:outline-none bg-white',
                          digit ? 'border-[#8B5CF6] text-[#8B5CF6]' : 'border-slate-200 focus:border-[#8B5CF6] focus:ring-4 focus:ring-purple-50 text-slate-800',
                        ].join(' ')}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[11px] sm:text-xs px-1">
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

              {step === 'newPassword' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">New Password</label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        placeholder="Enter New Password"
                        value={newPassword}
                        onChange={e => { setNewPassword(e.target.value); setNewPasswordTouched(true) }}
                        disabled={loading}
                        className="w-full px-4 sm:px-5 py-3.5 sm:py-4 pr-10 sm:pr-12 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-[#8B5CF6] focus:ring-4 focus:ring-purple-50 transition-all text-[14px] sm:text-[15px]"
                      />
                      <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Re-enter New Password"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        disabled={loading}
                        className="w-full px-4 sm:px-5 py-3.5 sm:py-4 pr-10 sm:pr-12 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-[#8B5CF6] focus:ring-4 focus:ring-purple-50 transition-all text-[14px] sm:text-[15px]"
                      />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {error && (
                <div className="flex items-center gap-2 text-red-500 text-xs font-bold bg-red-50 border border-red-100 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (step === 'email') handleSendOTP()
                  else if (step === 'otp') handleVerifyOTP()
                  else handleResetPassword()
                }}
                disabled={loading}
                className="w-full py-3.5 sm:py-4 rounded-xl text-white text-[14px] sm:text-[15px] font-bold shadow-lg shadow-purple-200 transition-all active:scale-[0.98] disabled:opacity-70 mt-2"
                style={{ background: '#8B5CF6' }}
              >
                {loading ? <LoadingSpinner /> : (
                  <>
                    {step === 'email' && 'SEND OTP'}
                    {step === 'otp' && 'VERIFY OTP'}
                    {step === 'newPassword' && 'RESET PASSWORD'}
                  </>
                )}
              </button>

              <p className="text-[13px] sm:text-[14px] text-slate-500 font-semibold text-center pt-2">
                Remember Your Password?{' '}
                <button type="button" onClick={() => { onClose(); onSignIn() }} className="text-[#8B5CF6] font-bold hover:underline">
                  Sign In
                </button>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}