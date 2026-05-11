import { ForgotPasswordFlow } from '@/components/auth/ForgotPasswordFlow'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export default function ForgotPage() {
  return (
    <ErrorBoundary>
      <ForgotPasswordFlow initialStep="email" />
    </ErrorBoundary>
  )
}
