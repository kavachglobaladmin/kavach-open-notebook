'use client'

import { useState, useEffect } from 'react'
import { Bell, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/lib/stores/auth-store'
import apiClient from '@/lib/api/client'

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function resolveFromLocalStorage(email: string): string {
  try {
    const users: { email: string; name: string }[] = JSON.parse(
      localStorage.getItem('kavach_users') ?? '[]'
    )
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase())
    if (user?.name?.trim()) return user.name.trim()
  } catch { /* ignore */ }
  return email.includes('@') ? email.split('@')[0] : email
}

async function fetchProfileName(): Promise<string | null> {
  try {
    const res = await apiClient.get<{ email: string; name: string }>('/users/profile')
    return res.data?.name?.trim() || null
  } catch {
    return null
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  /** Controlled search value */
  searchValue: string
  /** Called on every keystroke in the search box */
  onSearchChange: (value: string) => void
  /** Placeholder text for the search input */
  searchPlaceholder?: string
  /** Label shown inside the + NEW button */
  newLabel?: string
  /** Called when the + NEW button is clicked */
  onNew?: () => void
  /** Hide the + NEW button entirely (e.g. on pages that don't create items) */
  hideNew?: boolean
  /** Hide the search box (e.g. on pages with their own search UI) */
  hideSearch?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Shared top header used across all dashboard pages.
 *
 * Layout (matches the design image):
 *   [ Search input ]  ···  [ 🔔 ]  [ + NEW ]  [ Avatar  NAME ]
 *
 * The user name and avatar are derived from the logged-in user:
 *  1. Immediately from localStorage (kavach_users) — zero flicker
 *  2. Then refreshed from GET /api/users/profile — authoritative backend value
 */
export function PageHeader({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  newLabel = 'NEW',
  onNew,
  hideNew = false,
  hideSearch = false,
}: PageHeaderProps) {
  const currentUserEmail = useAuthStore(s => s.currentUserEmail)

  const [displayName, setDisplayName] = useState('')
  const [initials, setInitials] = useState('')

  useEffect(() => {
    if (!currentUserEmail || !currentUserEmail.includes('@')) {
      setDisplayName('')
      setInitials('')
      return
    }

    // 1. Instant local resolution
    const localName = resolveFromLocalStorage(currentUserEmail)
    setDisplayName(localName)
    setInitials(buildInitials(localName))

    // 2. Authoritative backend fetch
    fetchProfileName().then(backendName => {
      if (backendName && backendName !== localName) {
        // Sync fresher name back to localStorage
        try {
          const users: { email: string; name: string; password?: string }[] = JSON.parse(
            localStorage.getItem('kavach_users') ?? '[]'
          )
          const idx = users.findIndex(u => u.email.toLowerCase() === currentUserEmail.toLowerCase())
          if (idx >= 0) users[idx].name = backendName
          else users.push({ email: currentUserEmail, name: backendName })
          localStorage.setItem('kavach_users', JSON.stringify(users))
        } catch { /* ignore */ }

        setDisplayName(backendName)
        setInitials(buildInitials(backendName))
      }
    })
  }, [currentUserEmail])

  const showUser = Boolean(currentUserEmail?.includes('@') && displayName)

  return (
    <header className="h-20 border-b flex items-center justify-between px-8 bg-white shrink-0">
      {/* ── Left: Search ──────────────────────────────────────────── */}
      {!hideSearch ? (
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            autoComplete="off"
            className="pl-10 h-11 bg-slate-50/50 border-slate-200 rounded-xl focus-visible:ring-orange-500"
          />
        </div>
      ) : (
        <div /> /* spacer so right side stays flush */
      )}

      {/* ── Right: Bell + New + User ──────────────────────────────── */}
      <div className="flex items-center gap-4 ml-6 shrink-0">
        {/* Bell */}
        <Button variant="ghost" size="icon" className="text-slate-500 relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full border-2 border-white" />
        </Button>

        {/* + NEW */}
        {!hideNew && (
          <Button
            onClick={onNew}
            className="bg-[#FF7043] hover:bg-[#F4511E] text-white px-6 rounded-lg h-11 font-semibold gap-2 shadow-sm"
          >
            <Plus className="h-5 w-5" />
            {newLabel}
          </Button>
        )}

        {/* User avatar + name */}
        {showUser && (
          <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
            {/* Avatar circle with initials */}
            <div
              className="h-10 w-10 rounded-full bg-[#FF8E73] text-white flex items-center justify-center text-sm font-bold shrink-0 select-none"
              aria-label={`Logged in as ${displayName}`}
            >
              {initials}
            </div>
            {/* Full name — hidden on very small screens */}
            <span className="text-sm font-bold text-slate-800 uppercase hidden sm:block tracking-wide">
              {displayName}
            </span>
          </div>
        )}
      </div>
    </header>
  )
}
