'use client'

import { addNotification } from '@/components/layout/NotificationCenter'
import { toast as sonnerToast } from 'sonner'

type ToastVariant = 'default' | 'destructive'
type ToastLevel = 'success' | 'error' | 'info' | 'warning'

type ToastOptions = {
  description?: string
  variant?: ToastVariant
  showInNotificationCenter?: boolean
}

type ToastPayload = {
  title?: string
  description?: string
  variant?: ToastVariant
  showInNotificationCenter?: boolean
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

function pushSonnerToast(
  level: ToastLevel,
  title: string,
  description?: string
) {
  const payload = { description }
  if (level === 'success') {
    sonnerToast.success(title, payload)
    return
  }
  if (level === 'error') {
    sonnerToast.error(title, payload)
    return
  }
  if (level === 'warning') {
    sonnerToast.warning(title, payload)
    return
  }
  sonnerToast.info(title, payload)
}

function emitWithOptions(
  level: ToastLevel,
  title: string,
  description?: string,
  showInNotificationCenter = true
) {
  if (showInNotificationCenter) {
    pushNotification(level, title, description)
  }
  pushSonnerToast(level, title, description)
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
  emitWithOptions(level, title, payload.description, payload.showInNotificationCenter ?? true)
}

export const toast = Object.assign(baseToast, {
  success: (title: string, options?: ToastOptions) => {
    emitWithOptions('success', title, options?.description, options?.showInNotificationCenter ?? true)
  },
  error: (title: string, options?: ToastOptions) => {
    emitWithOptions('error', title, options?.description, options?.showInNotificationCenter ?? true)
  },
  info: (title: string, options?: ToastOptions) => {
    emitWithOptions('info', title, options?.description, options?.showInNotificationCenter ?? true)
  },
  warning: (title: string, options?: ToastOptions) => {
    emitWithOptions('warning', title, options?.description, options?.showInNotificationCenter ?? true)
  },
}) as ToastFn
