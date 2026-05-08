'use client'

import { useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { DefaultPromptEditor } from './components/DefaultPromptEditor'
import { TransformationPlayground } from './components/TransformationPlayground'
import { TransformationEditorDialog } from './components/TransformationEditorDialog'
import { useTransformations } from '@/lib/hooks/use-transformations'
import { Transformation } from '@/lib/types/transformations'
import { useTranslation } from '@/lib/hooks/use-translation'
import { Plus, Copy, Pencil, Trash2, Play, ChevronDown } from 'lucide-react'

// ─── Card icon color gradients (cycles per card index) ───────────────────────
const ICON_GRADIENTS = [
  'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)', // indigo-blue
  'linear-gradient(135deg, #A855F7 0%, #D946EF 100%)', // purple-pink
  'linear-gradient(135deg, #10B981 0%, #34D399 100%)', // emerald
  'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)', // violet
  'linear-gradient(135deg, #3B82F6 0%, #60A5FA 100%)', // blue
  'linear-gradient(135deg, #F59E0B 0%, #FCD34D 100%)', // amber
]

// ─── Shuffle/arrows icon matching the reference ───────────────────────────────
function ShuffleIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── Single Transformation Card — matches reference exactly ──────────────────
function TransformationCard({
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

  // Safely format runsCount — handles null | undefined | number
  const runsLabel = (() => {
    const count = transformation.runsCount ?? 0
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K runs`
    return `${count} runs`
  })()

  return (
    <div
      className="bg-white flex flex-col hover:shadow-lg transition-all duration-200"
      style={{
        borderRadius: '20px',
        border: '1px solid #F1F5F9',
        boxShadow: '0 1px 6px 0 rgba(99,102,241,0.07)',
        padding: '20px 20px 16px 20px',
        minHeight: '185px',
      }}
    >
      {/* Top row: colored icon + duplicate/edit icons */}
      <div className="flex items-start justify-between">
        <div
          className="flex items-center justify-center flex-shrink-0"
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '14px',
            background: gradient,
            boxShadow: '0 4px 14px 0 rgba(99,102,241,0.22)',
          }}
        >
          <ShuffleIcon size={22} />
        </div>

        <div className="flex items-center gap-1">
          {/* Duplicate button */}
          <button
            onClick={() => onDuplicate?.(transformation)}
            className="flex items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
            style={{ width: '32px', height: '32px', color: '#CBD5E1' }}
            title="Duplicate"
          >
            <Copy size={15} />
          </button>
          {/* Edit button */}
          <button
            onClick={() => onEdit?.(transformation)}
            className="flex items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
            style={{ width: '32px', height: '32px', color: '#CBD5E1' }}
            title="Edit"
          >
            <Pencil size={15} />
          </button>
        </div>
      </div>

      {/* Title + description */}
      <div className="mt-4 flex-1">
        <h3 className="font-bold text-slate-800 text-base leading-snug">
          {transformation.name}
        </h3>
        <p className="text-slate-400 text-sm mt-1 leading-relaxed line-clamp-2">
          {transformation.description || 'No description'}
        </p>
      </div>

      {/* Bottom row: runs count + Run button + delete */}
      <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid #F8FAFC' }}>
        <span className="text-slate-400 text-xs font-medium">{runsLabel}</span>

        <div className="flex items-center gap-2">
          {/* Run button */}
          <button
            onClick={() => onPlayground(transformation)}
            className="flex items-center gap-1.5 font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{
              padding: '6px 16px',
              fontSize: '12px',
              background: 'linear-gradient(90deg, rgba(99,102,241,0.10) 0%, rgba(168,85,247,0.10) 100%)',
              color: '#6366F1',
              borderRadius: '999px',
              border: '1px solid rgba(99,102,241,0.20)',
            }}
          >
            <Play size={11} className="fill-current" />
            Run
          </button>

          {/* Delete button */}
          <button
            onClick={() => onDelete?.(transformation)}
            className="flex items-center justify-center rounded-lg transition-colors hover:bg-red-50"
            style={{ width: '30px', height: '30px', color: '#FCA5A5' }}
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      className="bg-white animate-pulse"
      style={{ borderRadius: '20px', border: '1px solid #F1F5F9', padding: '20px', minHeight: '185px' }}
    >
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 rounded-2xl bg-slate-100" />
        <div className="flex gap-1">
          <div className="w-8 h-8 rounded-lg bg-slate-100" />
          <div className="w-8 h-8 rounded-lg bg-slate-100" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="h-4 bg-slate-100 rounded w-1/2" />
        <div className="h-3 bg-slate-100 rounded w-full" />
        <div className="h-3 bg-slate-100 rounded w-3/4" />
      </div>
      <div className="flex items-center justify-between mt-6">
        <div className="h-3 bg-slate-100 rounded w-16" />
        <div className="h-7 bg-slate-100 rounded-full w-14" />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function TransformationsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'transformations' | 'playground'>('transformations')
  const [selectedTransformation, setSelectedTransformation] = useState<Transformation | undefined>()
  const [searchTerm, setSearchTerm] = useState('')
  const { data: transformations, isLoading } = useTransformations()

  // ── Editor dialog state ───────────────────────────────────────────────────
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTransformation, setEditingTransformation] = useState<Transformation | undefined>()

  const handlePlayground = (transformation: Transformation) => {
    setSelectedTransformation(transformation)
    setActiveTab('playground')
  }

  // Opens the original TransformationEditorDialog pre-filled with the transformation
  const handleEdit = (transformation: Transformation) => {
    setEditingTransformation(transformation)
    setEditorOpen(true)
  }

  const handleDuplicate = (transformation: Transformation) => {
    console.log('duplicate', transformation.id)
  }

  const handleDelete = (transformation: Transformation) => {
    console.log('delete', transformation.id)
  }

  return (
    <AppShell>
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden bg-[linear-gradient(110deg,#dbeafe_0%,#f0f7fa_45%,#e5d5f2_100%)]">
        
        <PageHeader
          searchValue={searchTerm}
          onSearchChange={(val) => setSearchTerm(val)}
          newLabel="NOTEBOOK"
        />

        <div className="flex-1 overflow-y-auto relative z-10">
          <div className="w-full px-6 md:px-12 py-10 pb-24 space-y-8 text-left">

            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2">
              <div className="space-y-1.5">
                {/* Dynamically changing the title based on the active tab */}
                <h1 className="text-3xl md:text-[32px] font-bold text-[#8A2BE2] tracking-tight transition-all">
                  {activeTab === 'transformations' ? 'Transformations' : 'Playground'}
                </h1>
                <p className="text-[14.5px] md:text-[15px] text-slate-500 font-medium transition-all">
                  {activeTab === 'transformations' 
                    ? 'Custom prompts for processing and analyzing your documents' 
                    : 'Test and experiment with transformation prompts before saving'}
                </p>
              </div>
              
              {/* Only show Create button if on Transformations tab */}
              {activeTab === 'transformations' && (
                <button
                  onClick={() => {
                    setEditingTransformation(undefined)
                    setEditorOpen(true)
                  }}
                  className="flex items-center gap-2 px-6 py-3.5 text-white font-bold text-[14px] whitespace-nowrap transition-all hover:opacity-90 active:scale-95 self-start sm:self-auto rounded-full shadow-[0_4px_18px_0_rgba(138,43,226,0.30)] bg-gradient-to-r from-[#8A2BE2] to-[#A855F7]"
                >
                  <Plus className="h-5 w-5 flex-shrink-0" />
                  Create Transformation
                </button>
              )}
            </div>

            {/* Tab Pills */}
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setActiveTab('transformations')}
                className={`px-6 py-3 rounded-full font-bold text-[14.5px] transition-all ${
                  activeTab === 'transformations'
                    ? 'bg-gradient-to-r from-[#8A2BE2] to-[#A855F7] text-white shadow-md'
                    : 'bg-white text-slate-600 shadow-sm border border-slate-100 hover:bg-slate-50'
                }`}
              >
                My Transformations
              </button>
              <button
                onClick={() => setActiveTab('playground')}
                className={`px-6 py-3 rounded-full font-bold text-[14.5px] transition-all ${
                  activeTab === 'playground'
                    ? 'bg-gradient-to-r from-[#8A2BE2] to-[#A855F7] text-white shadow-md'
                    : 'bg-white text-slate-600 shadow-sm border border-slate-100 hover:bg-slate-50'
                }`}
              >
                Playground
              </button>
            </div>

            {/* Tab content */}
            {activeTab === 'transformations' ? (
              <div className="space-y-6">

                {/* Default Transformation Prompt card — warm cream */}
                <div
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5"
                  style={{
                    background: '#FFF9EE',
                    border: '1.5px solid #FDE68A',
                    borderRadius: '20px',
                    boxShadow: '0 1px 8px 0 rgba(251,191,36,0.08)',
                  }}
                >
                  <div className="flex items-center gap-4">
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
                      <ShuffleIcon size={22} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-base">Default Transformation Prompt</div>
                      <div className="text-slate-500 text-sm mt-0.5">
                        This will be used when no specific transformation is selected
                      </div>
                    </div>
                  </div>
                  <button className="text-slate-600 font-semibold text-sm hover:text-purple-700 transition-colors whitespace-nowrap sm:text-right">
                    Edit Default
                  </button>
                </div>

                {/* DefaultPromptEditor — kept for logic, hidden visually */}
                <div className="hidden">
                  <DefaultPromptEditor />
                </div>

                {/* Transformation Cards — Responsive grid adapting to full width */}
                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {(transformations ?? []).map((transformation, index) => (
                      <TransformationCard
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

              </div>
            ) : (
              /* Exact Figma Design Playground UI */
              <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-200/60 p-6 sm:p-8 lg:p-10 max-w-[1200px]">
                <div className="space-y-8">
                  {/* Prompt Textarea */}
                  <div className="space-y-3">
                    <label className="text-[14.5px] font-bold text-slate-700 block">Transformation Prompt</label>
                    <textarea
                      className="w-full min-h-[160px] p-5 bg-[#F8F9FA] border border-slate-200 rounded-2xl text-[14.5px] focus:outline-none focus:ring-2 focus:ring-[#8A2BE2]/30 resize-none placeholder:text-slate-400"
                      placeholder="Enter your transformation prompt... e.g., 'Analyze this document and extract key insights, main themes, and actionable recommendations.'"
                      defaultValue={selectedTransformation?.prompt || ""}
                    ></textarea>
                  </div>

                  {/* Dropdowns */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[14.5px] font-bold text-slate-700 block">Select Model</label>
                      <div className="relative">
                        <select className="w-full h-[52px] px-5 bg-[#F5F3FF] border border-[#E0E7FF] rounded-xl text-[14.5px] text-[#7C3AED] font-bold focus:outline-none focus:ring-2 focus:ring-[#8A2BE2]/30 cursor-pointer appearance-none">
                          <option>GPT-4 Turbo</option>
                          <option>Claude 3 Opus</option>
                          <option>Gemini 1.5 Pro</option>
                        </select>
                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7C3AED] pointer-events-none" />
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <label className="text-[14.5px] font-bold text-slate-700 block">Sample Document</label>
                      <div className="relative">
                        <select className="w-full h-[52px] px-5 bg-white border border-slate-200 rounded-xl text-[14.5px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#8A2BE2]/30 cursor-pointer appearance-none">
                          <option>Research Paper - AI Trends.pdf</option>
                          <option>Q3 Financial Report.xlsx</option>
                        </select>
                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Run Button */}
                  <button className="w-full h-[56px] mt-4 bg-gradient-to-r from-[#8A2BE2] to-[#A855F7] hover:from-[#7A26C9] hover:to-[#9333EA] text-white text-[15px] font-bold rounded-xl flex items-center justify-center gap-3 transition-colors shadow-[0_4px_14px_rgba(138,43,226,0.30)]">
                    <Play className="w-5 h-5 fill-current" />
                    Run Transformation
                  </button>
                </div>

                {/* Hidden original component to preserve logic/imports if needed elsewhere in the component tree implicitly */}
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
    </AppShell>
  )
}