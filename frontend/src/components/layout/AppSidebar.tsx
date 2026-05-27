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
  FileText,
  Clipboard,
  Scissors,
  BrainCircuit,
  Settings2,
  Sparkles,
  X,
  LayoutGrid,
  BookOpen, // Added Notebook icon from lucide-react
} from 'lucide-react'
import { SourcePickerDialog } from '@/components/studio/SourcePickerDialog'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutGrid, studio: null },
  { name: 'Sources', href: '/sources', icon: FileText, studio: null },
  { name: 'Cases', href: '/notebooks', icon: Clipboard, studio: null },
  { name: 'Ask & Search', href: '/search', icon: Search, studio: null },
  { name: 'Models', href: '/settings/api-keys', icon: BrainCircuit, studio: null },
  { name: 'Transformations', href: '/transformations', icon: Scissors, studio: null },
  { name: 'Settings', href: '/settings', icon: Settings2, studio: null },
  { name: 'Advanced', href: '/advanced', icon: Sparkles, studio: null },
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
          'flex h-24 items-center gap-4 px-6 pt-6 mb-4 transition-all duration-300 relative',
          isCollapsed && 'lg:justify-center lg:px-2'
        )}>
          {/* Main Logo Container */}
          <div className="flex items-center gap-3 relative group">
            
            {/* The Reference Glow Effect */}
            <div className="absolute -left-4 -top-4 w-24 h-24 bg-[#7B3AED] opacity-[0.15] blur-[32px] rounded-full pointer-events-none" />
            
            <div className="w-12 h-12 shrink-0 rounded-[14px] bg-gradient-to-br from-[#7B3AED] to-[#9333EA] flex items-center justify-center shadow-[0_8px_24px_-4px_rgba(123,58,237,0.45)] relative overflow-hidden">
              {/* Animated Icon */}
              <BookOpen 
                className="relative z-10 h-6 w-6 text-white transition-transform duration-500 ease-out group-hover:scale-110 group-hover:rotate-3" 
              />
            </div>
            
            {!isCollapsed && (
              <div className="flex flex-col transition-opacity duration-300">
                <span className="text-[18px] font-bold text-[#7B3AED] uppercase leading-none tracking-tight">NOTEBOOKS</span>
                <span className="text-[12px] text-slate-500 font-medium leading-tight">AI Knowledge Base</span>
              </div>
            )}
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

        <div className={cn(
          "px-5 mb-6 transition-all duration-300",
          isCollapsed && "lg:hidden"
        )}>
          <div className="flex items-center gap-3 bg-[#F4F6F9] border border-slate-100 shadow-sm p-3 rounded-[16px] transition-all">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-[12px] bg-[#7B3AED] flex items-center justify-center font-bold text-white text-[15px]">
                {initials}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#10B981] border-2 border-[#F4F6F9]" />
            </div>
            <div className="flex flex-col overflow-hidden whitespace-nowrap">
              <span className="font-bold text-slate-800 text-[14px] truncate">{displayName}</span>
              <span className="text-[12px] text-slate-500 font-medium">Premium Account</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-2 overflow-y-auto overflow-x-hidden scrollbar-hide">
          {navigation.map((item) => {
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
                    ? 'bg-[#7B3AED] text-white shadow-[0_8px_20px_-6px_rgba(123,58,237,0.5)] font-semibold' 
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

        <div className="mt-auto px-4 pb-6 pt-4 space-y-2 bg-white relative">
          <div className="absolute top-0 left-4 right-4 h-[1px] bg-slate-100" />
          
          <ThemeToggle 
            className={cn(
              "w-full rounded-[14px] text-slate-500 font-medium text-[14.5px] hover:bg-slate-50 hover:text-slate-700 transition-colors",
              isCollapsed ? "justify-center w-12 h-12 mx-auto p-0 [&_span]:hidden [&_svg]:mx-auto" : "justify-start gap-3.5 p-3"
            )} 
          />
          <LanguageToggle 
            className={cn(
              "w-full rounded-[14px] text-slate-500 font-medium text-[14.5px] hover:bg-slate-50 hover:text-slate-700 transition-colors",
              isCollapsed ? "justify-center w-12 h-12 mx-auto p-0 [&_span]:hidden [&_svg]:mx-auto" : "justify-start gap-3.5 p-3"
            )} 
          />
          <Button
            variant="ghost"
            className={cn(
              "w-full rounded-[14px] text-[#EF4444] font-medium text-[14.5px] hover:bg-red-50 hover:text-red-600 transition-colors",
              isCollapsed ? "justify-center w-12 h-12 mx-auto p-0" : "justify-start gap-3.5 p-3 h-auto"
            )}
            onClick={logout}
          >
            <LogOut className="h-[22px] w-[22px] shrink-0" />
            {!isCollapsed && <span className="whitespace-nowrap">Sign Out</span>}
          </Button>
        </div>
      </div>
      
      <SourcePickerDialog open={summaryPickerOpen} onOpenChange={setSummaryPickerOpen} mode="summary" />
      <SourcePickerDialog open={mindMapPickerOpen} onOpenChange={setMindMapPickerOpen} mode="mindmap" />
      <SourcePickerDialog open={infographicPickerOpen} onOpenChange={setInfographicPickerOpen} mode="infographic" />
    </TooltipProvider>
  )
}