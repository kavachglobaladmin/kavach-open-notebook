'use client'

import { addNotification } from '@/components/layout/NotificationCenter'

type ToastVariant = 'default' | 'destructive'
type ToastLevel = 'success' | 'error' | 'info' | 'warning'

type ToastOptions = {
  description?: string
  variant?: ToastVariant
}

type ToastPayload = {
  title?: string
  description?: string
  variant?: ToastVariant
}

function pushNotification(
  level: ToastLevel,
  title: string,
  description?: string
) {
  addNotification({
    title,
    message: description || '',
    type: level,
  })
}

type ToastFn = ((payload: ToastPayload) => void) & {
  success: (title: string, options?: ToastOptions) => void
  error: (title: string, options?: ToastOptions) => void
  info: (title: string, options?: ToastOptions) => void
  warning: (title: string, options?: ToastOptions) => void
}

const baseToast = (payload: ToastPayload) => {
  const title = payload.title || (payload.variant === 'destructive' ? 'Error' : 'Success')
  const level: ToastLevel = payload.variant === 'destructive' ? 'error' : 'success'
  pushNotification(level, title, payload.description)
}

export const toast = Object.assign(baseToast, {
  success: (title: string, options?: ToastOptions) => {
    pushNotification('success', title, options?.description)
  },
  error: (title: string, options?: ToastOptions) => {
    pushNotification('error', title, options?.description)
  },
  info: (title: string, options?: ToastOptions) => {
    pushNotification('info', title, options?.description)
  },
  warning: (title: string, options?: ToastOptions) => {
    pushNotification('warning', title, options?.description)
  },
}) as ToastFn
