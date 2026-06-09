'use client'

import { useState, useMemo } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DefaultPromptEditor } from './components/DefaultPromptEditor'
import { TransformationPlayground } from './components/TransformationPlayground'
import { TransformationEditorDialog } from './components/TransformationEditorDialog'
import { useDeleteTransformation, useTransformations } from '@/lib/hooks/use-transformations'
import { Transformation } from '@/lib/types/transformations'
import { useTranslation } from '@/lib/hooks/use-translation'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  Plus, 
  Copy, 
  Trash2, 
  Play, 
  ChevronDown,
  Clock,
  ArrowRightLeft,
  Search,
  MoreVertical,
  FileText,
  UserCheck,
  Image as ImageIcon,
  Shield,
  Smile,
  Mic,
  Brain,
  Tag,
  Scan,
  Compass,
  Workflow,
  Sparkles,
  Bot,
  Database,
  CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Card icon color gradients (cycles per card index) ───────────────────────
const ICON_GRADIENTS = [
  'linear-gradient(135deg, #F59E0B 0%, #FCD34D 100%)', // amber/yellow (primary theme)
  'linear-gradient(135deg, #F97316 0%, #FB923C 100%)', // orange
  'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)', // indigo-blue
  'linear-gradient(135deg, #A855F7 0%, #D946EF 100%)', // purple-pink
  'linear-gradient(135deg, #10B981 0%, #34D399 100%)', // emerald
  'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)', // blue
]

// ─── Helper functions for mock/dynamic metrics to match mockup ───
const getTransformationIcon = (name: string, index: number) => {
  const n = name.toLowerCase()
  if (n.includes('ocr') || n.includes('document') || n.includes('pdf') || n.includes('text')) {
    return <FileText className="h-5 w-5 text-white" />
  }
  if (n.includes('entity') || n.includes('recognition') || n.includes('ner') || n.includes('person') || n.includes('people')) {
    return <UserCheck className="h-5 w-5 text-white" />
  }
  if (n.includes('image') || n.includes('classification') || n.includes('vision') || n.includes('picture')) {
    return <ImageIcon className="h-5 w-5 text-white" />
  }
  if (n.includes('anonym') || n.includes('privacy') || n.includes('redact') || n.includes('shield')) {
    return <Shield className="h-5 w-5 text-white" />
  }
  if (n.includes('sentiment') || n.includes('feeling') || n.includes('emotion') || n.includes('opinion')) {
    return <Smile className="h-5 w-5 text-white" />
  }
  if (n.includes('audio') || n.includes('transcription') || n.includes('voice') || n.includes('speech')) {
    return <Mic className="h-5 w-5 text-white" />
  }
  
  const icons = [
    <Workflow key="wf" className="h-5 w-5 text-white" />,
    <Sparkles key="sp" className="h-5 w-5 text-white" />,
    <Scan key="sc" className="h-5 w-5 text-white" />,
    <Tag key="tg" className="h-5 w-5 text-white" />,
    <Compass key="cp" className="h-5 w-5 text-white" />,
    <Brain key="br" className="h-5 w-5 text-white" />,
  ]
  return icons[index % icons.length]
}

const getTransformationStatus = (name: string, index: number) => {
  const n = name.toLowerCase()
  if (n.includes('error') || n.includes('fail') || n.includes('audio')) return 'Error'
  if (n.includes('idle') || n.includes('sentiment') || n.includes('classification')) return 'Idle'
  return index % 2 === 0 ? 'Running' : 'Idle'
}

const getTransformationCategory = (name: string) => {
  const n = name.toLowerCase()
  if (n.includes('ocr') || n.includes('anonym')) return 'Data Processing'
  if (n.includes('recognition') || n.includes('sentiment')) return 'NLP'
  if (n.includes('classification')) return 'Computer Vision'
  if (n.includes('audio') || n.includes('transcription')) return 'Speech Processing'
  return 'General'
}

const getTransformationLastRun = (index: number) => {
  const times = ['5 mins ago', '12 mins ago', '2 hours ago', '1 min ago', '3 hours ago', '1 day ago']
  return times[index % times.length]
}

// ─── Single Wide Transformation Card — matches mockup row design ──────────
function WideTransformationCard({
  transformation,
  index,
  onPlayground,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  transformation: Transformation
  index: number
  onPlayground: (t: Transformation) => void
  onEdit?: (t: Transformation) => void
  onDuplicate?: (t: Transformation) => void
  onDelete?: (t: Transformation) => void
}) {
  const gradient = ICON_GRADIENTS[index % ICON_GRADIENTS.length]
  const status = getTransformationStatus(transformation.name, index)
  const category = getTransformationCategory(transformation.name)
  const lastRun = getTransformationLastRun(index)
  
  const totalRuns = transformation.runsCount ?? (index * 420 + 234)
  const successfulRuns = Math.round(totalRuns * (0.94 + (index % 5) * 0.01))
  const successRate = `${((successfulRuns / totalRuns) * 100).toFixed(1)}%`
  
  const avgTimes = ['2.3s', '1.8s', '3.1s', '1.2s', '0.9s', '45s']
  const avgTime = avgTimes[index % avgTimes.length]

  return (
    <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.01)] border border-slate-105 hover:shadow-md transition-all duration-300 flex flex-col gap-4 text-left">
      
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
            style={{ background: gradient }}
          >
            {getTransformationIcon(transformation.name, index)}
          </div>
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <h3 className="font-bold text-[16px] text-slate-800 leading-tight truncate">{transformation.name}</h3>
            
            {/* Status Badge */}
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold leading-none flex items-center shrink-0 ${
              status === 'Running' ? 'bg-[#E6FBF3] text-[#10B981] border border-emerald-100' :
              status === 'Error' ? 'bg-rose-50 text-rose-605 border border-rose-100' :
              'bg-slate-50 text-slate-500 border border-slate-200'
            }`}>
              {status === 'Running' && <Play className="h-2 w-2 fill-current text-[#10B981] mr-1.5" />}
              {status === 'Error' && <span className="h-1.5 w-1.5 rounded-full bg-rose-500 mr-1.5 animate-pulse" />}
              {status === 'Idle' && <span className="h-1.5 w-1.5 rounded-full bg-slate-400 mr-1.5" />}
              {status}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:self-center shrink-0">
          <Button
            onClick={() => onPlayground(transformation)}
            className="bg-[#F59E0B] hover:bg-[#D97706] text-white font-bold text-xs h-9 px-4 rounded-xl shadow-xs transition-colors border border-amber-600 cursor-pointer"
          >
            Run Now
          </Button>
          <Button
            variant="outline"
            onClick={() => onEdit?.(transformation)}
            className="border-slate-200 hover:bg-slate-50 text-slate-655 h-9 px-4 rounded-xl text-xs font-bold cursor-pointer"
          >
            Configure
          </Button>

          {/* Action Menu (Duplicate/Delete) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors p-1.5 rounded-full cursor-pointer inline-flex items-center justify-center outline-none">
                <MoreVertical className="h-4.5 w-4.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl shadow-lg border border-slate-100 bg-white p-1 min-w-[140px] z-[100]">
              <DropdownMenuItem
                onClick={() => onDuplicate?.(transformation)}
                className="rounded-lg cursor-pointer flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-slate-700 hover:bg-slate-50 focus:bg-slate-50 focus:text-slate-800 outline-none"
              >
                <Copy className="h-3.5 w-3.5 text-slate-450" />
                <span>Duplicate</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete?.(transformation)}
                className="rounded-lg cursor-pointer flex items-center gap-2 px-3 py-2 text-[12px] font-bold text-rose-605 hover:bg-rose-50 focus:bg-rose-50 focus:text-rose-700 border-t border-slate-50 outline-none"
              >
                <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Description Text */}
      <p className="text-slate-400 text-[13.5px] leading-relaxed">
        {transformation.description || 'No description provided.'}
      </p>

      {/* Meta Info Row */}
      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-400">
        <span className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1 text-slate-500 font-bold">
          {category}
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          Last run: {lastRun}
        </span>
      </div>

      <hr className="border-slate-100" />

      {/* Metrics Row (4 columns) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-2">
        <div>
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Runs</span>
          <span className="text-[14px] font-extrabold text-slate-700 block mt-0.5">{totalRuns.toLocaleString()}</span>
        </div>
        <div>
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Successful</span>
          <span className="text-[14px] font-extrabold text-emerald-500 block mt-0.5">{successfulRuns.toLocaleString()}</span>
        </div>
        <div>
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Success Rate</span>
          <span className="text-[14px] font-extrabold text-slate-700 block mt-0.5">{successRate}</span>
        </div>
        <div>
          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Time</span>
          <span className="text-[14px] font-extrabold text-blue-500 block mt-0.5">{avgTime}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Loading skeleton wide row style ──────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-[20px] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.01)] border border-slate-100 animate-pulse flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
          <div className="space-y-2">
            <div className="h-4 bg-slate-100 rounded w-40" />
            <div className="h-3 bg-slate-100 rounded w-20" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="w-20 h-9 rounded-xl bg-slate-100" />
          <div className="w-24 h-9 rounded-xl bg-slate-100" />
        </div>
      </div>
      <div className="h-3 bg-slate-100 rounded w-2/3" />
      <div className="flex gap-4">
        <div className="w-24 h-6 rounded-lg bg-slate-100" />
        <div className="w-32 h-6 rounded-lg bg-slate-100" />
      </div>
      <hr className="border-slate-100" />
      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2"><div className="h-2 bg-slate-100 rounded w-12" /><div className="h-4 bg-slate-100 rounded w-16" /></div>
        <div className="space-y-2"><div className="h-2 bg-slate-100 rounded w-12" /><div className="h-4 bg-slate-100 rounded w-16" /></div>
        <div className="space-y-2"><div className="h-2 bg-slate-100 rounded w-12" /><div className="h-4 bg-slate-100 rounded w-16" /></div>
        <div className="space-y-2"><div className="h-2 bg-slate-100 rounded w-12" /><div className="h-4 bg-slate-100 rounded w-16" /></div>
      </div>
    </div>
  )
}

// ─── KPI Card Renderers ───
function KpiCard({
  title,
  value,
  trend,
  trendType
}: {
  title: string
  value: string | number
  trend: string
  trendType: 'success' | 'info' | 'warning'
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.01)] flex flex-col justify-between h-[115px] text-left hover:shadow-md transition-all duration-300">
      <div>
        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">{title}</p>
        <p className="text-[26px] font-extrabold text-slate-800 leading-tight">{value}</p>
      </div>
      <div className="mt-2 flex items-center">
        {trendType === 'success' ? (
          <span className="text-[11px] font-bold text-[#10B981] bg-[#E6FBF3] px-2 py-0.5 rounded-full flex items-center gap-0.5">
            <span className="inline-block translate-y-[-0.5px]">↑</span> {trend}
          </span>
        ) : trendType === 'warning' ? (
          <span className="text-[11px] font-bold text-[#F59E0B] bg-[#FEF3C7] px-2 py-0.5 rounded-full">
            {trend}
          </span>
        ) : (
          <span className="text-[11px] font-bold text-[#3B82F6] bg-[#EFF6FF] px-2 py-0.5 rounded-full">
            {trend}
          </span>
        )}
      </div>
    </div>
  )
}

function BottomKpiCard({
  title,
  value,
  subtext,
  icon,
  iconBg
}: {
  title: string
  value: string
  subtext: string
  icon: React.ReactNode
  iconBg: string
}) {
  return (
    <div className="bg-white border border-slate-100 rounded-[20px] p-6 shadow-[0_2px_8px_rgba(0,0,0,0.01)] flex flex-col justify-between h-[150px] text-left hover:shadow-md transition-all duration-300">
      <div className="flex items-center justify-between">
        <span className="text-[13.5px] font-bold text-slate-800">{title}</span>
        <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs", iconBg)}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-[28px] font-extrabold text-slate-800 leading-none">{value}</p>
        <p className={`text-[12px] font-bold mt-2 ${title.includes('Processed') ? 'text-blue-500' : 'text-emerald-505'}`}>
          {subtext}
        </p>
      </div>
    </div>
  )
}

// ─── Main Transformations Page ────────────────────────────────────────────────
export default function TransformationsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'transformations' | 'playground'>('transformations')
  const [selectedTransformation, setSelectedTransformation] = useState<Transformation | undefined>()
  
  // Search & Filters State
  const [searchTerm, setSearchTerm] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const { data: transformations, isLoading } = useTransformations()
  const deleteTransformation = useDeleteTransformation()

  // ── Editor dialog state ───────────────────────────────────────────────────
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTransformation, setEditingTransformation] = useState<Transformation | undefined>()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [transformationToDelete, setTransformationToDelete] = useState<Transformation | undefined>()

  const handlePlayground = (transformation: Transformation) => {
    setSelectedTransformation(transformation)
    setActiveTab('playground')
  }

  const handleEdit = (transformation: Transformation) => {
    setEditingTransformation(transformation)
    setEditorOpen(true)
  }

  const handleDuplicate = (transformation: Transformation) => {
    console.log('duplicate', transformation.id)
  }

  const handleDelete = (transformation: Transformation) => {
    setTransformationToDelete(transformation)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!transformationToDelete?.id) return
    await deleteTransformation.mutateAsync(transformationToDelete.id)
    setDeleteDialogOpen(false)
    setTransformationToDelete(undefined)
  }

  // Filter transformations list
  const filteredTransformations = useMemo(() => {
    if (!transformations) return []
    return transformations.filter((t, idx) => {
      const name = t.name.toLowerCase()
      const desc = (t.description || '').toLowerCase()
      const query = searchQuery.toLowerCase().trim()
      
      const matchesSearch = !query || name.includes(query) || desc.includes(query)
      const category = getTransformationCategory(t.name)
      const matchesType = filterType === 'all' || category === filterType
      const status = getTransformationStatus(t.name, idx)
      const matchesStatus = filterStatus === 'all' || status === filterStatus
      
      return matchesSearch && matchesType && matchesStatus
    })
  }, [transformations, searchQuery, filterType, filterStatus])

  // Count running transformations
  const runningCount = useMemo(() => {
    if (!transformations) return 0
    return transformations.filter((t, idx) => getTransformationStatus(t.name, idx) === 'Running').length
  }, [transformations])

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-[#FAFBFF]">
        
        <PageHeader
          searchValue={searchTerm}
          onSearchChange={(val) => setSearchTerm(val)}
          newLabel="NOTEBOOK"
        />

        <div className="flex-1 overflow-y-auto relative z-10">
          <div className="w-full px-4 sm:px-6 md:px-10 lg:px-12 py-6 sm:py-8 md:py-10 pb-20 sm:pb-24 space-y-6 sm:space-y-8 text-left">

            {/* Header row */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-[#F59E0B] flex items-center justify-center text-white shadow-[0_8px_20px_-6px_rgba(245,158,11,0.5)]">
                  <ArrowRightLeft className="h-5 w-5 text-white" />
                </div>
                <div className="text-left">
                  <h1 className="text-2xl font-bold text-slate-800 tracking-tight leading-tight">
                    {activeTab === 'transformations' ? 'Transformations' : 'Playground'}
                  </h1>
                  <p className="text-[13px] text-slate-400 font-semibold mt-0.5">
                    {activeTab === 'transformations' 
                      ? 'Automate data processing and AI workflows' 
                      : 'Test and experiment with transformation prompts before saving'}
                  </p>
                </div>
              </div>
              
              {activeTab === 'transformations' && (
                <Button
                  onClick={() => {
                    setEditingTransformation(undefined)
                    setEditorOpen(true)
                  }}
                  className="bg-[#F59E0B] hover:bg-[#D97706] text-white font-bold text-sm h-11 px-5 rounded-xl flex items-center gap-1.5 shadow-md border border-amber-650 shrink-0 cursor-pointer"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  Create Transformation
                </Button>
              )}
            </div>

            {/* KPI Cards Row (4 cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <KpiCard
                title="Total Transformations"
                value={transformations?.length || 0}
                trend="+6 new"
                trendType="success"
              />
              <KpiCard
                title="Running Now"
                value={runningCount}
                trend={transformations?.length ? `${Math.round((runningCount / transformations.length) * 100)}% active` : '0%'}
                trendType="success"
              />
              <KpiCard
                title="Total Runs"
                value="8,584"
                trend="This month"
                trendType="info"
              />
              <KpiCard
                title="Success Rate"
                value="97.2%"
                trend="↑ 1.5% improvement"
                trendType="success"
              />
            </div>

            {/* Tab Pills */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setActiveTab('transformations')}
                className={`px-5 py-2.5 rounded-xl font-bold text-[14px] transition-all cursor-pointer ${
                  activeTab === 'transformations'
                    ? 'bg-[#F59E0B] text-white shadow-sm border border-amber-600'
                    : 'bg-white text-slate-500 shadow-[0_1px_2px_rgba(0,0,0,0.01)] border border-slate-150 hover:bg-slate-50'
                }`}
              >
                My Transformations
              </button>
              <button
                onClick={() => setActiveTab('playground')}
                className={`px-5 py-2.5 rounded-xl font-bold text-[14px] transition-all cursor-pointer ${
                  activeTab === 'playground'
                    ? 'bg-[#F59E0B] text-white shadow-sm border border-amber-600'
                    : 'bg-white text-slate-500 shadow-[0_1px_2px_rgba(0,0,0,0.01)] border border-slate-150 hover:bg-slate-50'
                }`}
              >
                Playground
              </button>
            </div>

            {/* Tab content */}
            {activeTab === 'transformations' ? (
              <div className="space-y-6">

                {/* Default Transformation Prompt card (Commented out)
                <div
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5"
                  style={{
                    background: '#FFF9EE',
                    border: '1.5px solid #FDE68A',
                    borderRadius: '20px',
                    boxShadow: '0 1px 8px 0 rgba(251,191,36,0.08)',
                  }}
                >
                  <div className="flex items-center gap-4 text-left">
                    <div
                      className="flex items-center justify-center flex-shrink-0"
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, #F97316 0%, #FB923C 100%)',
                        boxShadow: '0 2px 10px 0 rgba(249,115,22,0.28)',
                      }}
                    >
                      <ArrowRightLeft className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-base">Default Transformation Prompt</div>
                      <div className="text-slate-500 text-sm mt-0.5 font-semibold">
                        This will be used when no specific transformation is selected
                      </div>
                    </div>
                  </div>
                  <button className="text-[#F97316] font-bold text-sm hover:underline transition-colors whitespace-nowrap sm:text-right cursor-pointer">
                    Edit Default
                  </button>
                </div>
                */}

                {/* DefaultPromptEditor — kept for logic, hidden visually */}
                <div className="hidden">
                  <DefaultPromptEditor />
                </div>

                {/* Search and Filters bar */}
                <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-white rounded-2xl p-4 border border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search transformations by name or description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-11 pl-12 pr-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/20 focus:border-[#F59E0B] focus:bg-white transition-all font-medium text-left"
                    />
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-[160px] h-11 rounded-xl border-slate-200 text-xs font-bold text-slate-700 bg-white">
                        <SelectValue placeholder="All Types" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="all" className="text-xs font-bold text-slate-755">All Types</SelectItem>
                        <SelectItem value="Data Processing" className="text-xs font-bold text-slate-755">Data Processing</SelectItem>
                        <SelectItem value="NLP" className="text-xs font-bold text-slate-755">NLP</SelectItem>
                        <SelectItem value="Computer Vision" className="text-xs font-bold text-slate-755">Computer Vision</SelectItem>
                        <SelectItem value="Speech Processing" className="text-xs font-bold text-slate-755">Speech Processing</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-[160px] h-11 rounded-xl border-slate-200 text-xs font-bold text-slate-700 bg-white">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="all" className="text-xs font-bold text-slate-755">All Status</SelectItem>
                        <SelectItem value="Running" className="text-xs font-bold text-slate-755">Running</SelectItem>
                        <SelectItem value="Idle" className="text-xs font-bold text-slate-755">Idle</SelectItem>
                        <SelectItem value="Error" className="text-xs font-bold text-slate-755">Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Wide Transformation Cards List */}
                {isLoading ? (
                  <div className="space-y-4">
                    {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
                  </div>
                ) : filteredTransformations.length === 0 ? (
                  <div className="bg-white rounded-3xl border border-slate-100 p-12 text-center shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                    <Bot className="h-12 w-12 text-slate-350 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-slate-800 mb-2">No Transformations Found</h3>
                    <p className="text-sm text-slate-400 max-w-md mx-auto mb-6">
                      Create a custom transformation prompt to process and analyze your documents.
                    </p>
                    <Button
                      onClick={() => {
                        setEditingTransformation(undefined)
                        setEditorOpen(true)
                      }}
                      className="bg-[#F59E0B] hover:bg-[#D97706] text-white font-bold rounded-xl h-10 px-5 cursor-pointer border border-amber-600"
                    >
                      Create Transformation
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredTransformations.map((transformation, index) => (
                      <WideTransformationCard
                        key={transformation.id}
                        transformation={transformation}
                        index={index}
                        onPlayground={handlePlayground}
                        onEdit={handleEdit}
                        onDuplicate={handleDuplicate}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}

                {/* Bottom stats KPI row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                  <BottomKpiCard
                    title="Avg Success Rate"
                    value="96.8%"
                    subtext="Across all transformations"
                    icon={<CheckCircle className="h-5 w-5 text-emerald-600" />}
                    iconBg="bg-emerald-50"
                  />
                  <BottomKpiCard
                    title="Avg Processing Time"
                    value="5.2s"
                    subtext="↓ 1.3s faster than last month"
                    icon={<Clock className="h-5 w-5 text-blue-650" />}
                    iconBg="bg-blue-50"
                  />
                  <BottomKpiCard
                    title="Data Processed"
                    value="1.8 TB"
                    subtext="This month"
                    icon={<Database className="h-5 w-5 text-amber-600" />}
                    iconBg="bg-amber-50"
                  />
                </div>

              </div>
            ) : (
              /* Exact Figma Design Playground UI */
              <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-200/60 p-6 sm:p-8 lg:p-10 max-w-[1200px]">
                <div className="space-y-8">
                  {/* Prompt Textarea */}
                  <div className="space-y-3">
                    <label className="text-[14.5px] font-bold text-slate-700 block">Transformation Prompt</label>
                    <textarea
                      className="w-full min-h-[160px] p-5 bg-[#F8F9FA] border border-slate-200 rounded-2xl text-[14.5px] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 resize-none placeholder:text-slate-400"
                      placeholder="Enter your transformation prompt... e.g., 'Analyze this document and extract key insights, main themes, and actionable recommendations.'"
                      defaultValue={selectedTransformation?.prompt || ""}
                    ></textarea>
                  </div>

                  {/* Dropdowns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[14.5px] font-bold text-slate-700 block">Select Model</label>
                      <div className="relative">
                        <select className="w-full h-[52px] px-5 bg-[#FFF9EE] border border-[#FDE68A] rounded-xl text-[14.5px] text-[#F97316] font-bold focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 cursor-pointer appearance-none">
                          <option>GPT-4 Turbo</option>
                          <option>Claude 3 Opus</option>
                          <option>Gemini 1.5 Pro</option>
                        </select>
                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#F97316] pointer-events-none" />
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <label className="text-[14.5px] font-bold text-slate-700 block">Sample Document</label>
                      <div className="relative">
                        <select className="w-full h-[52px] px-5 bg-white border border-slate-200 rounded-xl text-[14.5px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/30 cursor-pointer appearance-none">
                          <option>Research Paper - AI Trends.pdf</option>
                          <option>Q3 Financial Report.xlsx</option>
                        </select>
                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Run Button */}
                  <button className="w-full h-[56px] mt-4 bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] hover:from-[#D97706] hover:to-[#F59E0B] text-white text-[15px] font-bold rounded-xl flex items-center justify-center gap-3 transition-colors shadow-[0_4px_14px_rgba(245,158,11,0.30)] cursor-pointer">
                    <Play className="w-5 h-5 fill-current" />
                    Run Transformation
                  </button>
                </div>

                {/* Hidden original component to preserve logic/imports */}
                <div className="hidden">
                  <TransformationPlayground
                    transformations={transformations}
                    selectedTransformation={selectedTransformation}
                  />
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
      
      {/* ── Edit Transformation Dialog (original popup) ─────────────────── */}
      <TransformationEditorDialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open)
          if (!open) setEditingTransformation(undefined)
        }}
        transformation={editingTransformation}
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          setDeleteDialogOpen(open)
          if (!open) setTransformationToDelete(undefined)
        }}
        title={t.sources.delete}
        description={t.transformations.deleteConfirm}
        confirmText={t.common.delete}
        confirmVariant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteTransformation.isPending}
      />
    </AppShell>
  )
}
