'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Sparkles, Menu, HardDrive, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useSidebarStore } from '@/lib/stores/sidebar-store'
import apiClient from '@/lib/api/client'
import { NotificationCenter } from './NotificationCenter'
import { cn } from '@/lib/utils'

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
  const maxRetries = 3
  let lastError: any = null

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await apiClient.get<{ email: string; name: string }>('/users/profile')
      return res.data?.name?.trim() || null
    } catch (error: any) {
      lastError = error
      if (error?.response?.status === 404 || error?.response?.status === 401) {
        return null
      }
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)))
      }
    }
  }
  return null
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  newLabel?: string
  onNew?: () => void
  hideNew?: boolean
  hideSearch?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PageHeader({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search notebooks, cases, or documents...',
  newLabel = 'NOTEBOOK',
  onNew,
  hideNew = false,
  hideSearch = false,
}: PageHeaderProps) {
  const currentUserEmail = useAuthStore(s => s.currentUserEmail)
  const { toggleCollapse, isCollapsed } = useSidebarStore()

  // User Profile State
  const [displayName, setDisplayName] = useState('')
  const [initials, setInitials] = useState('')

  // New Notebook Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [notebookName, setNotebookName] = useState('')
  const [notebookDesc, setNotebookDesc] = useState('')
  const [storageLimit, setStorageLimit] = useState<number>(5)

  useEffect(() => {
    if (!currentUserEmail || !currentUserEmail.includes('@')) {
      setDisplayName('')
      setInitials('')
      return
    }

    const localName = resolveFromLocalStorage(currentUserEmail)
    setDisplayName(localName)
    setInitials(buildInitials(localName))

    fetchProfileName().then(backendName => {
      if (backendName && backendName !== localName) {
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

  const handleCreateNew = () => {
    if (onNew) {
      // Delegate to the parent page's handler
      onNew()
      return
    }
    // Internal modal fallback (used when no onNew prop is provided)
    console.log("Creating:", { notebookName, notebookDesc, storageLimit })
    setIsModalOpen(false)
    setNotebookName('')
    setNotebookDesc('')
    setStorageLimit(5)
  }

  return (
    <header className="h-[88px] flex items-center justify-between px-4 md:px-8 bg-[#FDFDFD] shrink-0 border-b border-[#E2E8F0] relative z-40">

      {/* ── Left: Toggle & Search ──────────────────────────────────────────── */}
      <div className="flex items-center gap-4 md:gap-6 flex-1">
        {/* Hamburger Menu Toggle */}
        {isCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-xl transition-colors flex shrink-0"
          >
            <Menu className="h-6 w-6" strokeWidth={2} />
          </Button>
        )}

        {!hideSearch && (
          <div className="relative w-full max-w-[480px] hidden sm:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
            <Input
              value={searchValue}
              onChange={e => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              autoComplete="off"
              className="pl-12 h-[46px] bg-[#F8FAFC] border-[#E2E8F0] rounded-[24px] text-[15px] placeholder:text-slate-400 text-slate-700 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-0 focus-visible:border-[#8B5CF6] transition-all hover:border-slate-300"
            />
          </div>
        )}
      </div>

      {/* ── Right: Bell + New ──────────────────────────────── */}
      <div className="flex items-center gap-3 md:gap-5 shrink-0 ml-4">

        {/* Original Notification Center Restored */}
        <NotificationCenter />

        {/* + NEW Button */}
        {!hideNew && (
          <Button
            onClick={() => onNew ? onNew() : setIsModalOpen(true)}
            className="bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#6D28D9] hover:to-[#7C3AED] text-white px-5 md:px-7 rounded-[14px] h-[46px] font-bold text-[14px] tracking-wide gap-2.5 shadow-[0_8px_20px_-6px_rgba(124,58,237,0.5)] transition-all"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
            <span className="hidden md:inline">{newLabel}</span>
            <Sparkles className="h-4 w-4 ml-0 md:ml-1 opacity-90" />
          </Button>
        )}
      </div>

      {/* ── Create New Notebook Modal Overlay ──────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 transition-all">
          <div className="bg-white w-full max-w-[480px] rounded-xl shadow-2xl relative p-6 md:p-7 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 hover:bg-slate-50 p-1.5 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-[20px] font-bold text-slate-900 mb-1.5">Create New Notebook</h2>
            <p className="text-[14px] text-slate-500 mb-6">Enter a name and optional description to get started.</p>

            <div className="space-y-5">
              {/* Name Field */}
              <div>
                <label className="block text-[14px] font-bold text-slate-900 mb-1.5">Name *</label>
                <Input
                  value={notebookName}
                  onChange={e => setNotebookName(e.target.value)}
                  placeholder="Notebook name"
                  className="h-[42px] text-[15px] border-slate-300 focus-visible:ring-[#82B4FF] focus-visible:border-[#82B4FF] placeholder:text-slate-400"
                  autoFocus
                />
              </div>

              {/* Description Field */}
              <div>
                <label className="block text-[14px] font-bold text-slate-900 mb-1.5">Description</label>
                <textarea
                  value={notebookDesc}
                  onChange={e => setNotebookDesc(e.target.value)}
                  placeholder="Add more info about this notebook here..."
                  className="w-full h-[100px] rounded-lg border border-slate-300 p-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#82B4FF] focus:border-[#82B4FF] resize-none placeholder:text-slate-400"
                />
              </div>

              {/* Storage Limit Selection */}
              <div>
                <label className="flex items-center gap-2 text-[14px] font-bold text-slate-900 mb-2">
                  <HardDrive className="h-[18px] w-[18px]" strokeWidth={2} /> Storage Limit *
                </label>
                <div className="grid grid-cols-3 gap-3 md:gap-4">
                  {[5, 10, 50].map(val => (
                    <button
                      key={val}
                      onClick={() => setStorageLimit(val)}
                      className={cn(
                        "flex flex-col items-center justify-center py-3.5 rounded-[10px] border transition-all duration-200",
                        storageLimit === val
                          ? "border-[#82B4FF] bg-blue-50/50 text-[#5B92FF] shadow-sm"
                          : "border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <span className={cn("text-[18px] font-bold leading-none mb-1", storageLimit === val ? "text-[#5B92FF]" : "text-slate-600")}>
                        {val}
                      </span>
                      <span className="text-[13px] font-semibold">MB</span>
                    </button>
                  ))}
                </div>
                <p className="text-[12px] text-slate-500 mt-2">Select a storage limit to create the notebook.</p>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 mt-8">
              <Button
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="border-slate-200 text-slate-700 h-10 px-5 text-[14px] font-semibold hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateNew}
                className="bg-[#82B4FF] hover:bg-[#68A3FB] text-white h-10 px-5 text-[14px] font-semibold shadow-sm transition-colors"
                disabled={!notebookName.trim()}
              >
                Create New Notebook
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}