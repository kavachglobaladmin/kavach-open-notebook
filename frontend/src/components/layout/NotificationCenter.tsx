'use client'

import { useEffect, useState } from 'react'
import { Bell, Save } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  timestamp: Date
  read: boolean
}

const NOTIFICATIONS_STORAGE_KEY = 'open_notebook_notifications_v1'

type StoredNotification = Omit<Notification, 'timestamp'> & {
  timestamp: string
}

function loadNotificationsFromStorage(): Notification[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as StoredNotification[]
    if (!Array.isArray(parsed)) return []

    return parsed.map(item => ({
      ...item,
      timestamp: new Date(item.timestamp),
    }))
  } catch {
    return []
  }
}

function persistNotifications(nextNotifications: Notification[]) {
  if (typeof window === 'undefined') return

  try {
    const serializable: StoredNotification[] = nextNotifications.map(item => ({
      ...item,
      timestamp: item.timestamp.toISOString(),
    }))
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(serializable))
  } catch {
    // Ignore persistence failures gracefully
  }
}

// Global notification store
let notifications: Notification[] = loadNotificationsFromStorage()
let listeners: Set<() => void> = new Set()

export function addNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
  const isDuplicate = notifications.some(
    existing =>
      existing.title === notification.title &&
      existing.message === notification.message &&
      existing.type === notification.type
  )

  if (isDuplicate) {
    return
  }

  const newNotification: Notification = {
    ...notification,
    id: `notif-${Date.now()}-${Math.random()}`,
    timestamp: new Date(),
    read: false,
  }
  notifications.unshift(newNotification)
  // Keep only last 50 notifications
  if (notifications.length > 50) {
    notifications = notifications.slice(0, 50)
  }
  persistNotifications(notifications)
  listeners.forEach(listener => listener())
}

export function useNotifications() {
  const [, setUpdate] = useState(0)
  
  // Subscribe to updates on mount
  useEffect(() => {
    const listener = () => setUpdate(prev => prev + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return {
    notifications,
    addNotification,
    markAsRead: (id: string) => {
      const notif = notifications.find(n => n.id === id)
      if (notif) notif.read = true
      persistNotifications(notifications)
      listeners.forEach(listener => listener())
    },
    markAllAsRead: () => {
      notifications = notifications.map(notif => ({ ...notif, read: true }))
      persistNotifications(notifications)
      listeners.forEach(listener => listener())
    },
    clearAll: () => {
      notifications = []
      persistNotifications(notifications)
      listeners.forEach(listener => listener())
    },
  }
}

export function NotificationCenter() {
  const { notifications, markAsRead, markAllAsRead, clearAll } = useNotifications()
  const [open, setOpen] = useState(false)
  const [savedNotifications, setSavedNotifications] = useState<Notification[]>([])

  const unreadCount = notifications.filter(n => !n.read).length

  const handleSaveNotification = (notif: Notification) => {
    setSavedNotifications(prev => {
      const exists = prev.find(n => n.id === notif.id)
      if (exists) {
        return prev.filter(n => n.id !== notif.id)
      }
      return [...prev, notif]
    })
  }

  const isSaved = (id: string) => savedNotifications.some(n => n.id === id)

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  const getTypeTextColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'text-green-700'
      case 'error':
        return 'text-red-700'
      case 'warning':
        return 'text-yellow-700'
      default:
        return 'text-blue-700'
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div className="relative">
          <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <Bell className="h-5 w-5" />
          </button>
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold pointer-events-none z-50 transform translate-x-1/2 -translate-y-1/2">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="bottom" className="w-96 max-h-[80vh] overflow-y-auto p-0">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Notifications</h3>
          <div className="flex items-center gap-3">
            {notifications.length > 0 && unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                Mark all as read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {notifications.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {notifications.map(notif => (
              <div
                key={notif.id}
                className={`p-4 border-l-4 ${getTypeColor(notif.type)} cursor-pointer hover:bg-opacity-75 transition-colors`}
                onClick={() => markAsRead(notif.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm ${getTypeTextColor(notif.type)}`}>
                      {notif.title}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {notif.message}
                    </p>
                    <p className="text-xs text-slate-500 mt-2">
                      {notif.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSaveNotification(notif)
                      }}
                      className={`p-1 rounded transition-colors ${
                        isSaved(notif.id)
                          ? 'bg-blue-100 text-blue-600'
                          : 'text-slate-400 hover:bg-slate-100'
                      }`}
                      title="Save notification"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {savedNotifications.length > 0 && (
          <div className="border-t border-slate-200 p-4 bg-slate-50">
            <p className="text-xs font-semibold text-slate-600 mb-2">
              Saved ({savedNotifications.length})
            </p>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {savedNotifications.map(notif => (
                <div key={notif.id} className="text-xs bg-white p-2 rounded border border-slate-200">
                  <p className="font-medium text-slate-700">{notif.title}</p>
                  <p className="text-slate-600 line-clamp-1">{notif.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
