import { useEffect, useRef } from 'react'
import { getConfig } from '@/lib/config'
import { useTranslation } from '@/lib/hooks/use-translation'
import { addNotification } from '@/components/layout/NotificationCenter'

/**
 * Hook to check for version updates and display notification.
 * Should be called once per session in the dashboard layout.
 * 
 * Simplified implementation using a single useEffect with a ref guard.
 * The toast is displayed once when an update is available and the user
 * hasn't dismissed it in this session.
 */
export function useVersionCheck() {
  const { t } = useTranslation()
  const hasChecked = useRef(false)

  useEffect(() => {
    if (hasChecked.current) return
    hasChecked.current = true

    getConfig()
      .then(config => {
        if (!config.hasUpdate || !config.latestVersion) return

        const dismissKey = `version_notification_dismissed_${config.latestVersion}`
        if (sessionStorage.getItem(dismissKey)) return

        addNotification({
          title: t.advanced.updateAvailable.replace('{version}', config.latestVersion),
          message: `${t.advanced.updateAvailableDesc} ${t.advanced.viewOnGithub}: https://github.com/lfnovo/open-notebook`,
          type: 'info',
        })
        sessionStorage.setItem(dismissKey, 'true')
      })
      .catch(() => {
        // Silently fail - version check is non-critical
      })
  }, [t]) // t is still a dependency but only executes once due to ref guard
}
