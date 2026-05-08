'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useNavigationStore } from '@/lib/stores/navigation-store'

export type ModalType = 'source' | 'note' | 'insight'

export function useModalManager() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const { setReturnTo } = useNavigationStore()

  // Read current modal state from URL params
  const modalType = searchParams?.get('modal') as ModalType | null
  const modalId = searchParams?.get('id')

  /**
   * Derive a human-readable back-label from the current pathname.
   * e.g. /notebooks/abc123  → "Back to Cases"
   *      /sources            → "Back to Sources"
   *      /dashboard          → "Back to Dashboard"
   */
  const getReturnLabel = (path: string): string => {
    if (path.startsWith('/notebooks')) return 'Back to Cases'
    if (path.startsWith('/sources')) return 'Back to Sources'
    if (path.startsWith('/dashboard')) return 'Back to Dashboard'
    if (path.startsWith('/search')) return 'Back to Search'
    return 'Back'
  }

  /**
   * Open a modal by updating URL params without navigation.
   * Special case: 'source' type navigates to the full-page source detail
   * instead of opening a popup dialog, and stores the return path so
   * "Back to …" on the source page goes back to the originating page.
   * @param type - Type of modal to open (source, note, insight)
   * @param id - ID of the content to display
   */
  const openModal = (type: ModalType, id: string) => {
    // Source opens as a full page, not a popup
    if (type === 'source') {
      // Store where we came from so the source page can navigate back correctly
      setReturnTo(pathname, getReturnLabel(pathname))
      const encodedId = encodeURIComponent(id)
      router.push(`/sources/${encodedId}`)
      return
    }

    const params = new URLSearchParams(searchParams?.toString() || '')
    params.set('modal', type)
    params.set('id', id)
    // Use scroll: false to prevent page from scrolling when modal state changes
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  /**
   * Close the currently open modal by removing modal params from URL
   */
  const closeModal = () => {
    const params = new URLSearchParams(searchParams?.toString() || '')
    params.delete('modal')
    params.delete('id')
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  return {
    modalType,
    modalId,
    openModal,
    closeModal,
    isOpen: !!modalType && !!modalId
  }
}
