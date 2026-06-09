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
import { notebooksApi } from '@/lib/api/notebooks'
import { usersApi, UserDirectoryRecord } from '@/lib/api/users'
import { Trash2, UserPlus, Users } from 'lucide-react'
import { toast } from '@/lib/notifications/toast'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

interface NotebookAccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notebookId: string
  notebookName: string
}

export function NotebookAccessDialog({
  open,
  onOpenChange,
  notebookId,
  notebookName,
}: NotebookAccessDialogProps) {
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
        // listDirectory: admin-accessible, super_admin sees all, admin sees only 'user' role
        const [accessResult, usersResult] = await Promise.allSettled([
          notebooksApi.getAccess(notebookId),
          usersApi.listDirectory(),
        ])

        if (accessResult.status === 'fulfilled') {
          setGrantedUsers(accessResult.value.granted_users)
        } else {
          console.error('Failed to load notebook access:', accessResult.reason)
          toast.error('Failed to load access list: ' + (accessResult.reason?.response?.data?.detail || accessResult.reason?.message || 'Unknown error'))
        }

        if (usersResult.status === 'fulfilled') {
          // Directory already excludes super_admins for non-super-admin callers
          // Explicitly filter out super_admins to be safe
          setAllUsers(usersResult.value.filter(u => u.role !== 'super_admin'))
        } else {
          console.error('Failed to load users:', usersResult.reason)
          toast.error('Failed to load users: ' + (usersResult.reason?.response?.data?.detail || usersResult.reason?.message || 'Unknown error'))
        }
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [open, notebookId])

  const notGrantedUsers = allUsers.filter(u => !grantedUsers.includes(u.email))

  const handleGrant = async () => {
    if (!selectedEmail) return
    setSaving(selectedEmail)
    try {
      await notebooksApi.grantAccess(notebookId, selectedEmail)
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
      await notebooksApi.revokeAccess(notebookId, email)
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
            Control who can view <span className="font-semibold text-slate-700">&quot;{notebookName}&quot;</span>
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
                  {saving === selectedEmail ? <LoadingSpinner size="sm" /> : <UserPlus className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {/* Current access list */}
            <div>
              <p className="text-[13px] font-semibold text-slate-700 mb-2">
                Users with Access ({grantedUsers.length})
              </p>
              {grantedUsers.length === 0 ? (
                <p className="text-[13px] text-slate-400 py-3 text-center bg-slate-50 rounded-xl">
                  No users granted access yet
                </p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {grantedUsers.map(email => {
                    const user = allUsers.find(u => u.email === email)
                    return (
                      <div
                        key={email}
                        className="flex items-center justify-between px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100"
                      >
                        <div>
                          <p className="text-[13px] font-semibold text-slate-800">
                            {user?.name || email}
                          </p>
                          <p className="text-[11px] text-slate-400">{email}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevoke(email)}
                          disabled={saving === email}
                          className="h-7 w-7 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50"
                        >
                          {saving === email ? <LoadingSpinner size="sm" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
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
