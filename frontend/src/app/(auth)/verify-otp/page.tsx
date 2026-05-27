import { ForgotPasswordFlow } from '@/components/auth/ForgotPasswordFlow'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export default function VerifyOtpPage() {
  return (
    <ErrorBoundary>
      <ForgotPasswordFlow initialStep="otp" />
    </ErrorBoundary>
  )
}
