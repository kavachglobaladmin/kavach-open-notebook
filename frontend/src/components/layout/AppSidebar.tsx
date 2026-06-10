'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { getRoleLabel, hasRoleAccess } from '@/lib/auth/roles'
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
import Image from 'next/image'
import logoImg from '@/assets/inotes.png'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import {
  Search,
  LogOut,
  FileText,
  Clipboard,
  Scissors,
  BrainCircuit,
  Settings,
  Sparkles,
  X,
  LayoutGrid,
  BookOpen,
  Building2,
  UserCog,
  Users,
  Folder,
  Database,
  ArrowRightLeft,
  ChevronRight,
} from 'lucide-react'
import { SourcePickerDialog } from '@/components/studio/SourcePickerDialog'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutGrid, studio: null, minimumRole: 'user' as const },
  { name: 'Organizations', href: '/organizations', icon: Building2, studio: null, minimumRole: 'super_admin' as const },
  { name: 'Admins', href: '/admins', icon: UserCog, studio: null, minimumRole: 'super_admin' as const },
  { name: 'Users', href: '/users', icon: Users, studio: null, minimumRole: 'super_admin' as const },
  { name: 'Cases', href: '/i_Notes', icon: Folder, studio: null, minimumRole: 'user' as const },
  { name: 'Sources', href: '/sources', icon: Database, studio: null, minimumRole: 'user' as const },
  { name: 'AI Search', href: '/search', icon: Search, studio: null, minimumRole: 'user' as const },
  { name: 'Models', href: '/settings/api-keys', icon: Sparkles, studio: null, minimumRole: 'super_admin' as const },
  { name: 'Transformations', href: '/transformations', icon: ArrowRightLeft, studio: null, minimumRole: 'super_admin' as const },
  { name: 'Settings', href: '/settings', icon: Settings, studio: null, minimumRole: 'super_admin' as const },
  { name: 'Audit Logs', href: '/audit-logs', icon: FileText, studio: null, minimumRole: 'super_admin' as const },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { logout } = useAuth()
  const { isCollapsed, toggleCollapse, setCollapsed } = useSidebarStore()
  const currentUserEmail = useAuthStore(s => s.currentUserEmail)
  const currentUserRole = useAuthStore(s => s.currentUserRole)

  const [displayName, setDisplayName] = useState('')
  const [initials, setInitials] = useState('')
  
  const [mindMapPickerOpen, setMindMapPickerOpen] = useState(false)
  const [infographicPickerOpen, setInfographicPickerOpen] = useState(false)
  const [summaryPickerOpen, setSummaryPickerOpen] = useState(false)
  const visibleNavigation = navigation.filter((item) => hasRoleAccess(currentUserRole, item.minimumRole))

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

  useEffect(() => {
    const media = window.matchMedia('(max-width: 1023px)')
    const syncSidebar = (event: MediaQueryList | MediaQueryListEvent) => {
      if (event.matches) {
        setCollapsed(true)
      }
    }

    syncSidebar(media)
    media.addEventListener('change', syncSidebar)
    return () => media.removeEventListener('change', syncSidebar)
  }, [setCollapsed])

  const handleMobileItemClick = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024 && !isCollapsed) {
      toggleCollapse()
    }
  }

  return (
    <TooltipProvider delayDuration={0}>
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-slate-900/20 z-40 lg:hidden backdrop-blur-sm transition-all" 
          onClick={toggleCollapse}
        />
      )}

      <div
        className={cn(
          'app-sidebar flex h-[100dvh] flex-col bg-white transition-all duration-300 border-r border-slate-100 relative z-50 shadow-2xl lg:shadow-none',
          'fixed inset-y-0 left-0 lg:relative',
          isCollapsed 
            ? '-translate-x-full w-[280px] lg:translate-x-0 lg:w-24'
            : 'translate-x-0 w-[280px]'
        )}
      >
        <div className={cn(
          'flex h-24 items-center px-6 pt-6 mb-4 transition-all duration-300 relative',
          isCollapsed ? 'lg:justify-center lg:px-2' : 'gap-4'
        )}>
          {/* Main Logo Container */}
          <div className={cn("relative group flex items-center", isCollapsed ? "justify-center" : "w-full")}>
            {/* Glowing effect has been removed entirely from here for a clean look */}
            <div className={cn(
              "shrink-0 flex items-center justify-center transition-all duration-300",
              isCollapsed ? "w-12 h-12" : "w-36 h-18"
            )}>
              <Image 
                src={logoImg} 
                alt="Logo" 
                width={isCollapsed ? 48 : 144} 
                height={isCollapsed ? 48 : 72} 
                className="object-contain w-full h-full"
                priority
              />
            </div>
          </div>
          
          {!isCollapsed && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleCollapse} 
              className="ml-auto shrink-0 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-[10px] transition-colors"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto overflow-x-hidden scrollbar-hide">
          {visibleNavigation.map((item) => {
            const isActive = 
              item.href === '/' 
                ? pathname === '/' 
                : item.href === '/settings'
                  ? pathname === '/settings' 
                  : item.href 
                    ? pathname?.startsWith(item.href) 
                    : false;

            const buttonContent = (
              <div
                className={cn(
                  'flex items-center w-full rounded-[14px] transition-all duration-300 group',
                  isActive 
                    ? 'bg-[#0A1C40] text-white shadow-[0_8px_20px_-6px_rgba(10,28,64,0.5)] font-semibold' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium',
                  isCollapsed ? 'justify-center w-12 h-12 mx-auto p-0' : 'p-3 gap-3.5'
                )}
              >
                <item.icon className={cn(
                  "h-[22px] w-[22px] shrink-0 transition-colors", 
                  isActive ? "text-white" : "text-slate-400 group-hover:text-slate-600"
                )} />
                <div className={cn(
                  "flex items-center flex-1 transition-all duration-300",
                  isCollapsed && "hidden"
                )}>
                  <span className="text-[14.5px] flex-1 whitespace-nowrap overflow-hidden text-ellipsis">{item.name}</span>
                  {isActive && <div className="w-1.5 h-1.5 bg-white rounded-full ml-auto shrink-0" />}
                </div>
              </div>
            )

            const itemNode = (
              <div className="relative w-full cursor-pointer">
                {item.studio ? (
                  <div onClick={() => {
                    handleMobileItemClick()
                    if (item.studio === 'mindmap') setMindMapPickerOpen(true)
                    else if (item.studio === 'infographic') setInfographicPickerOpen(true)
                    else setSummaryPickerOpen(true)
                  }}>
                    {buttonContent}
                  </div>
                ) : (
                  <Link href={item.href!} onClick={handleMobileItemClick}>{buttonContent}</Link>
                )}
              </div>
            )

            return isCollapsed ? (
              <Tooltip key={item.name}>
                <TooltipTrigger asChild className="lg:block hidden">{itemNode}</TooltipTrigger>
                <div className="lg:hidden">{itemNode}</div>
                <TooltipContent side="right" className="font-medium">{item.name}</TooltipContent>
              </Tooltip>
            ) : (
              <div key={item.name}>{itemNode}</div>
            )
          })}
        </nav>

        <div className="mt-auto px-4 pb-6 pt-4 space-y-4 bg-white relative">
          <div className="absolute top-0 left-4 right-4 h-[1px] bg-slate-100" />
          
          {/* User Profile Section at bottom */}
          {!isCollapsed && (
            <Link
              href="/profile"
              className="flex items-center justify-between px-2 py-1 select-none hover:bg-slate-50 rounded-xl transition-all cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full bg-[#0A1C40] flex items-center justify-center font-bold text-white text-[15px]">
                    {initials}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#10B981] border-2 border-white" />
                </div>
                <div className="flex flex-col text-left overflow-hidden whitespace-nowrap">
                  <span className="font-bold text-slate-800 text-[14px] truncate">{displayName}</span>
                  <span className="text-[12px] text-slate-500 font-medium">{getRoleLabel(currentUserRole)}</span>
                </div>
              </div>
              <ChevronRight className="h-4.5 w-4.5 text-slate-400 shrink-0" />
            </Link>
          )}

          {isCollapsed && (
            <Link
              href="/profile"
              className="flex justify-center py-1 cursor-pointer"
            >
              <div className="relative hover:opacity-85 transition-opacity">
                <div className="w-10 h-10 rounded-full bg-[#0A1C40] flex items-center justify-center font-bold text-white text-[15px]">
                  {initials}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#10B981] border-2 border-white" />
              </div>
            </Link>
          )}

          {/* Logout Button */}
          <Button
            variant="ghost"
            className={cn(
              "w-full rounded-[14px] text-[#EF4444] hover:bg-red-50 hover:text-red-600 transition-colors font-medium text-[14.5px]",
              isCollapsed ? "justify-center w-12 h-12 mx-auto p-0" : "justify-start gap-3.5 p-3 h-auto"
            )}
            onClick={logout}
          >
            <LogOut className="h-[22px] w-[22px] shrink-0 text-[#EF4444]" />
            {!isCollapsed && <span className="whitespace-nowrap">Logout</span>}
          </Button>
        </div>
      </div>
      
      <SourcePickerDialog open={summaryPickerOpen} onOpenChange={setSummaryPickerOpen} mode="summary" />
      <SourcePickerDialog open={mindMapPickerOpen} onOpenChange={setMindMapPickerOpen} mode="mindmap" />
      <SourcePickerDialog open={infographicPickerOpen} onOpenChange={setInfographicPickerOpen} mode="infographic" />
    </TooltipProvider>
  )
}