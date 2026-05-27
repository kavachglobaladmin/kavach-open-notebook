import { useTranslation } from '@/lib/hooks/use-translation'
import { toast as appToast } from '@/lib/notifications/toast'

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

      if (isError) {
        appToast.error(resolvedTitle, { description: resolvedMessage })
      } else {
        appToast.success(resolvedTitle, { description: resolvedMessage })
      }
    }
  }
}
