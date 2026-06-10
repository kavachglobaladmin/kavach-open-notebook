'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { i_NotesApi } from '@/lib/api/i_Notes'
import { UserDirectoryRecord } from '@/lib/api/users'
import { Trash2, UserPlus, Users } from 'lucide-react'
import { toast } from '@/lib/notifications/toast'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

interface I_NotesAccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  i_NotesId: string
  i_NotesName: string
  currentUserEmail?: string
  currentUserRole?: string
}

export function I_NotesAccessDialog({
  open,
  onOpenChange,
  i_NotesId,
  i_NotesName,
  currentUserEmail = '',
  currentUserRole = 'user',
}: I_NotesAccessDialogProps) {
  const isSuperAdmin = currentUserRole === 'super_admin'
  const [grantedUsers, setGrantedUsers] = useState<string[]>([])
  const [allUsers, setAllUsers] = useState<UserDirectoryRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [selectedEmail, setSelectedEmail] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)

    const loadData = async () => {
      try {
        // Resolve auth credentials
        const { useAuthStore } = await import('@/lib/stores/auth-store')
        const storeState = useAuthStore.getState()
        const apiPassword = storeState.apiPassword ?? sessionStorage.getItem('kavach_api_password')
        const userEmail = storeState.currentUserEmail ?? ''

        // Always use relative URL through Next.js rewrite proxy to avoid CORS/network issues
        const directoryUrl = '/api/users/directory'

        const reqHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(apiPassword ? { Authorization: `Bearer ${apiPassword}` } : {}),
          ...(userEmail ? { 'X-User-Email': userEmail } : {}),
        }

        console.log('[AccessDialog] url:', directoryUrl, '| hasToken:', !!apiPassword, '| role:', storeState.currentUserRole)

        const [accessResult, usersResult] = await Promise.allSettled([
          i_NotesApi.getAccess(i_NotesId),
          fetch(directoryUrl, { headers: reqHeaders }).then(async r => {
            if (!r.ok) {
              const body = await r.json().catch(() => ({ detail: r.statusText }))
              throw Object.assign(new Error(body.detail || `HTTP ${r.status}`), {
                response: { status: r.status, data: body },
              })
            }
            return r.json() as Promise<UserDirectoryRecord[]>
          }),
        ])

        if (accessResult.status === 'fulfilled') {
          setGrantedUsers(accessResult.value.granted_users)
        } else {
          const e = accessResult.reason
          console.error('[AccessDialog] access list error:', e?.message)
          toast.error('Failed to load access list: ' + (e?.response?.data?.detail || e?.message || 'Unknown'))
        }

        if (usersResult.status === 'fulfilled') {
          // super_admin sees all non-super_admin users
          // admin sees only 'user' role (cannot assign admins)
          const filtered = usersResult.value.filter((u: UserDirectoryRecord) => {
            if (u.role === 'super_admin') return false
            if (!isSuperAdmin && u.role === 'admin') return false
            return true
          })
          setAllUsers(filtered)
        } else {
          const e = usersResult.reason
          console.error('[AccessDialog] users error:', e?.name, e?.message, e?.response?.status)
          toast.error('Failed to load users: ' + (e?.response?.data?.detail || e?.message || String(e) || 'Unknown'))
        }
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [open, i_NotesId])

  const notGrantedUsers = allUsers.filter(u => !grantedUsers.includes(u.email))
  const handleGrant = async () => {
    if (!selectedEmail) return
    setSaving(selectedEmail)
    try {
      await i_NotesApi.grantAccess(i_NotesId, selectedEmail)
      setGrantedUsers(prev => [...prev, selectedEmail])
      setSelectedEmail('')
      toast.success(`Access granted to ${selectedEmail}`)
    } catch {
      toast.error('Failed to grant access')
    } finally {
      setSaving(null)
    }
  }

  const handleRevoke = async (email: string) => {
    setSaving(email)
    try {
      await i_NotesApi.revokeAccess(i_NotesId, email)
      setGrantedUsers(prev => prev.filter(u => u !== email))
      toast.success(`Access revoked for ${email}`)
    } catch {
      toast.error('Failed to revoke access')
    } finally {
      setSaving(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl" onClick={e => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[18px] font-bold">
            <Users className="h-5 w-5 text-[#8A2BE2]" />
            Manage Access
          </DialogTitle>
          <DialogDescription className="text-[13px] text-slate-500">
            Control who can view{' '}
            <span className="font-semibold text-slate-700">&quot;{i_NotesName}&quot;</span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Grant access */}
            <div>
              <p className="text-[13px] font-semibold text-slate-700 mb-2">Grant Access</p>
              <div className="flex gap-2">
                <select
                  value={selectedEmail}
                  onChange={e => setSelectedEmail(e.target.value)}
                  className="flex-1 h-10 px-3 rounded-xl border border-slate-200 bg-slate-50 text-[13px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#8A2BE2]/30"
                >
                  <option value="">Select a user...</option>
                  {notGrantedUsers.map(u => (
                    <option key={u.email} value={u.email}>
                      {u.name || u.email} ({u.role})
                    </option>
                  ))}
                </select>
                <Button
                  onClick={handleGrant}
                  disabled={!selectedEmail || saving === selectedEmail}
                  className="h-10 px-4 rounded-xl bg-[#8A2BE2] hover:bg-[#7A26C9] text-white text-[13px] font-semibold"
                >
                  {saving === selectedEmail
                    ? <LoadingSpinner size="sm" />
                    : <UserPlus className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Current access list */}
            <div>
              <p className="text-[13px] font-semibold text-slate-700 mb-2">
                Users with Access ({grantedUsers.filter(e => e !== currentUserEmail).length})
              </p>
              {grantedUsers.filter(e => e !== currentUserEmail).length === 0 ? (
                <p className="text-[13px] text-slate-400 py-3 text-center bg-slate-50 rounded-xl">
                  No users granted access yet
                </p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {grantedUsers
                    .filter(email => email !== currentUserEmail)
                    .map(email => {
                    const user = allUsers.find(u => u.email === email)
                    // admin can only revoke 'user' role grantees, not admin/super_admin
                    const canRevoke = isSuperAdmin || (user?.role === 'user')
                    return (
                      <div
                        key={email}
                        className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100"
                      >
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800">
                            {user?.name || email}
                          </p>
                          <p className="text-[11px] text-slate-400">{email}{user?.role ? ` · ${user.role}` : ''}</p>
                        </div>
                        {canRevoke ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevoke(email)}
                          disabled={saving === email}
                          className="h-7 w-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"
                        >
                          {saving === email
                            ? <LoadingSpinner size="sm" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                        ) : (
                          <span className="text-[11px] text-slate-400 px-2">locked</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
