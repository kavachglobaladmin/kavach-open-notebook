'use client'

import { useState } from 'react'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AddSourceDialog } from './AddSourceDialog'

interface AddSourceButtonProps {
  defaulti_NotesId?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'default' | 'lg'
  className?: string
  iconOnly?: boolean
  onSuccess?: () => void
}

export function AddSourceButton({ 
  defaulti_NotesId, 
  variant = 'default',
  size = 'default',
  className,
  iconOnly = false,
  onSuccess
}: AddSourceButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setDialogOpen(true)}
        variant={variant}
        size={size}
        className={className}
      >
        <PlusIcon className={iconOnly ? "h-4 w-4" : "h-4 w-4 mr-2"} />
        {!iconOnly && "Add Source"}
      </Button>

      <AddSourceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaulti_NotesId={defaulti_NotesId}
        onSuccess={onSuccess}
      />
    </>
  )
}