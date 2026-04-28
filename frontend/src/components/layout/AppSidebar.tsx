'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/hooks/use-auth'
import { useAuthStore } from '@/lib/stores/auth-store'
import { useSidebarStore } from '@/lib/stores/sidebar-store'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { useTranslation } from '@/lib/hooks/use-translation'
import {
  Search,
  LogOut,
  ChevronLeft,
  Menu,
  FileText,
  Clipboard,
  Scissors,
  BrainCircuit,
  Settings2,
  Sparkles,
} from 'lucide-react'
import { SourcePickerDialog } from '@/components/studio/SourcePickerDialog'

// Navigation items matching the provided reference image icons
const navigation = [
  { name: 'Sources', href: '/sources', icon: FileText, studio: null },
  { name: 'Cases', href: '/notebooks', icon: Clipboard, studio: null },
  { name: 'Ask And Search', href: '/search', icon: Search, studio: null },
  { name: 'Models', href: '/settings/api-keys', icon: BrainCircuit, studio: null },
  { name: 'Transformations', href: '/transformations', icon: Scissors, studio: null },
  { name: 'Settings', href: '/settings', icon: Settings2, studio: null },
  { name: 'Advances', href: '/advanced', icon: Sparkles, studio: null },
]

export function AppSidebar() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const { logout } = useAuth()
  const { isCollapsed, toggleCollapse } = useSidebarStore()
  const currentUserEmail = useAuthStore(s => s.currentUserEmail)

  const [displayName, setDisplayName] = useState('')
  const [initials, setInitials] = useState('')
  
  const [mindMapPickerOpen, setMindMapPickerOpen] = useState(false)
  const [infographicPickerOpen, setInfographicPickerOpen] = useState(false)
  const [summaryPickerOpen, setSummaryPickerOpen] = useState(false)

  useEffect(() => {
    if (!currentUserEmail) {
      setDisplayName('')
      setInitials('')
      return
    }
    try {
      const users: { email: string; name: string }[] = JSON.parse(
        localStorage.getItem('kavach_users') ?? '[]'
      )
      const user = users.find(u => u.email.toLowerCase() === currentUserEmail.toLowerCase())
      const name = user?.name ?? currentUserEmail
      const parts = name.trim().split(/\s+/)
      const capitalizedName = parts.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      const abbr = parts.length >= 2
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : name.slice(0, 2).toUpperCase()
      setDisplayName(capitalizedName)
      setInitials(abbr)
    } catch {
      setDisplayName(currentUserEmail)
      setInitials(currentUserEmail.slice(0, 2).toUpperCase())
    }
  }, [currentUserEmail])

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          'app-sidebar flex h-full flex-col bg-[#FFF0EC] transition-all duration-300 border-none relative',
          isCollapsed ? 'w-16' : 'w-[280px]'
        )}
      >
        {/* Header Section */}
        <div
          className={cn(
            'flex h-24 items-center mb-2',
            isCollapsed ? 'justify-center px-2' : 'justify-between pl-8 pr-6'
          )}
        >
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-2">
                <Image src="/logo(1).svg" alt="Kavach" width={32} height={32} className="object-contain" />
                <p className="font-bold text-[18px] tracking-[0.1em] text-[#1E293B]">NOTEBOOKS</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCollapse}
                className="text-[#E8694F] border border-[#E8694F]/30 hover:bg-[#E8694F] hover:text-white rounded-full h-7 w-7"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Button variant="ghost" size="sm" onClick={toggleCollapse} className="text-[#E8694F]">
              <Menu className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1">
          {navigation.map((item) => {
            // Enhanced logic: Matches exactly for specific sub-routes, 
            // or handles prefix matching only if it's not a generic parent route
            const isActive = item.href === '/settings' 
                ? pathname === '/settings' // Exact match for settings to prevent collision with Models
                : (item.href ? pathname?.startsWith(item.href) : false)

            const buttonContent = (
              <div
                className={cn(
                  'flex items-center gap-4 w-full transition-all duration-200 relative z-10',
                  isCollapsed ? 'justify-center py-3' : 'pl-8 py-4',
                  isActive 
                    ? 'bg-white text-slate-900 rounded-l-[30px] ml-4' 
                    : 'text-[#334155] bg-transparent'
                )}
              >
                <item.icon className={cn("h-[20px] w-[20px]", isActive ? "text-[#E8694F]" : "text-slate-600")} />
                {!isCollapsed && <span className="font-semibold text-[15px]">{item.name}</span>}
              </div>
            )

            const itemNode = (
              <div className="relative w-full cursor-pointer group pr-0">
                {item.studio ? (
                  <div onClick={() => {
                    if (item.studio === 'mindmap') setMindMapPickerOpen(true)
                    else if (item.studio === 'infographic') setInfographicPickerOpen(true)
                    else setSummaryPickerOpen(true)
                  }}>
                    {buttonContent}
                  </div>
                ) : (
                  <Link href={item.href!}>{buttonContent}</Link>
                )}

                {/* Curved Connector Effect for Active Tab */}
                {isActive && !isCollapsed && (
                  <>
                    <div className="absolute right-0 -top-6 w-6 h-6 bg-transparent rounded-br-[24px] shadow-[8px_8px_0_0_#ffffff] pointer-events-none z-0" />
                    <div className="absolute right-0 -bottom-6 w-6 h-6 bg-transparent rounded-tr-[24px] shadow-[8px_-8px_0_0_#ffffff] pointer-events-none z-0" />
                  </>
                )}
              </div>
            )

            return isCollapsed ? (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild>{itemNode}</TooltipTrigger>
                <TooltipContent side="right">{item.name}</TooltipContent>
              </Tooltip>
            ) : (
              <div key={item.name}>{itemNode}</div>
            )
          })}
        </nav>

        {/* Bottom Actions Container */}
        <div className="mt-auto mb-8 px-5">
          <div className="bg-[#FDE4DE] rounded-[24px] p-2 flex flex-col overflow-hidden">
            <div className="flex flex-col">
              <div className="hover:bg-white/40 transition-colors rounded-xl">
                 <ThemeToggle className="w-full justify-start gap-4 px-4 py-4 text-slate-800 font-semibold text-[15px]" />
              </div>
              <div className="h-[1px] bg-[#E8694F]/10 mx-4" />
              <div className="hover:bg-white/40 transition-colors rounded-xl">
                <LanguageToggle className="w-full justify-start gap-4 px-4 py-4 text-slate-800 font-semibold text-[15px]" />
              </div>
              <div className="h-[1px] bg-[#E8694F]/10 mx-4" />
              <Button
                variant="ghost"
                className="w-full justify-start gap-4 px-4 py-4 text-slate-800 font-semibold text-[15px] hover:bg-white/40 h-auto"
                onClick={logout}
              >
                <LogOut className="h-[20px] w-[20px] text-slate-600" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      <SourcePickerDialog open={summaryPickerOpen} onOpenChange={setSummaryPickerOpen} mode="summary" />
      <SourcePickerDialog open={mindMapPickerOpen} onOpenChange={setMindMapPickerOpen} mode="mindmap" />
      <SourcePickerDialog open={infographicPickerOpen} onOpenChange={setInfographicPickerOpen} mode="infographic" />
    </TooltipProvider>
  )
}