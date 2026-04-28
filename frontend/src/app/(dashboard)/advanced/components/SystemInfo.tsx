'use client'

import { useEffect, useState } from 'react'
import { getConfig } from '@/lib/config'
import { useTranslation } from '@/lib/hooks/use-translation'

export function SystemInfo() {
  const { t } = useTranslation()
  const [config, setConfig] = useState<{
    version: string
    latestVersion?: string | null
    hasUpdate?: boolean
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const cfg = await getConfig()
        setConfig(cfg)
      } catch (error) {
        console.error('Failed to load config:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadConfig()
  }, [])

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-6 space-y-4">
      <h2 className="text-lg font-bold text-slate-900">{t.advanced.systemInfo}</h2>

      {isLoading ? (
        <p className="text-sm text-slate-400">{t.common.loading}</p>
      ) : (
        <div className="space-y-3">
          {/* Current Version */}
          <div className="flex items-center justify-between py-1 border-b border-slate-50">
            <span className="text-sm font-medium text-slate-700">{t.advanced.currentVersion}</span>
            <span className="text-sm text-slate-500 bg-slate-100 rounded-lg px-3 py-1 font-mono">
              {config?.version || t.advanced.unknown}
            </span>
          </div>

          {/* Latest Version */}
          {config?.latestVersion && (
            <div className="flex items-center justify-between py-1 border-b border-slate-50">
              <span className="text-sm font-medium text-slate-700">{t.advanced.latestVersion}</span>
              <span className="text-sm text-slate-500 bg-slate-100 rounded-lg px-3 py-1 font-mono">
                {config.latestVersion}
              </span>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center justify-between py-1">
            <span className="text-sm font-medium text-slate-700">{t.advanced.status}</span>
            {config?.hasUpdate ? (
              <span className="text-xs font-semibold bg-[#FF7043] text-white rounded-full px-3 py-1">
                {t.advanced.updateAvailable.replace('{version}', config.latestVersion || '')}
              </span>
            ) : config?.latestVersion ? (
              <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full px-3 py-1">
                {t.advanced.upToDate}
              </span>
            ) : (
              <span className="text-xs font-semibold bg-slate-100 text-slate-500 rounded-full px-3 py-1">
                {t.advanced.unknown}
              </span>
            )}
          </div>

          {/* GitHub link — always shown */}
          <div className="pt-2">
            <a
              href="https://github.com/lfnovo/open-notebook"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#FF7043] hover:underline inline-flex items-center gap-1 font-medium"
            >
              {t.advanced.viewOnGithub}
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          {/* Version check failed */}
          {!config?.latestVersion && config?.version && (
            <p className="text-xs text-slate-400">{t.advanced.updateCheckFailed}</p>
          )}
        </div>
      )}
    </div>
  )
}
