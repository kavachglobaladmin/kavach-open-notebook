import { ForgotPasswordFlow } from '@/components/auth/ForgotPasswordFlow'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export default function ResetPasswordPage() {
  return (
    <ErrorBoundary>
      <ForgotPasswordFlow initialStep="newPassword" />
    </ErrorBoundary>
  )
}
