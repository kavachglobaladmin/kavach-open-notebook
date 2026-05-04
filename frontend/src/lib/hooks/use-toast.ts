import { useTranslation } from '@/lib/hooks/use-translation'
import { addNotification } from '@/components/layout/NotificationCenter'

type ToastProps = {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

export function useToast() {
  const { t } = useTranslation()

  return {
    toast: ({ title, description, variant = 'default' }: ToastProps) => {
      const isError = variant === 'destructive'
      const resolvedTitle = title || (isError ? t.common.error : t.common.success)
      const resolvedMessage = description || ''

      addNotification({
        title: resolvedTitle,
        message: resolvedMessage,
        type: isError ? 'error' : 'success',
      })
    }
  }
}