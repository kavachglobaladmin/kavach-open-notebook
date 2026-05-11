import { LoginForm } from '@/components/auth/LoginForm'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

export default function SignUpPage() {
  return (
    <ErrorBoundary>
      <LoginForm initialMode="signup" />
    </ErrorBoundary>
  )
}
