'use client'

import { addNotification as globalAddNotification, Notification } from '@/components/layout/NotificationCenter'

/**
 * Hook to add notifications globally from anywhere in the app
 * Usage: const { addNotification } = useAddNotification()
 *        addNotification({ title: 'Success', message: 'Operation completed', type: 'success' })
 */
export function useAddNotification() {
  return {
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
      globalAddNotification(notification)
    },
  }
}
