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
import { Plus, Copy, Pencil, Trash2, Play } from 'lucide-react'

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
          {/* Duplicate button — wired to onDuplicate */}
          <button
            onClick={() => onDuplicate?.(transformation)}
            className="flex items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
            style={{ width: '32px', height: '32px', color: '#CBD5E1' }}
            title="Duplicate"
          >
            <Copy size={15} />
          </button>
          {/* Edit button — wired to onEdit (same handler the original TransformationsList used) */}
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
        {/* runsCount: null-safe, no TS(18047) error */}
        <span className="text-slate-400 text-xs font-medium">{runsLabel}</span>

        <div className="flex items-center gap-2">
          {/* Run button — soft indigo-to-purple pill */}
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

          {/* Delete button — wired to onDelete */}
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
    // e.g. duplicateMutation.mutate(transformation.id)
    console.log('duplicate', transformation.id)
  }

  const handleDelete = (transformation: Transformation) => {
    // e.g. deleteMutation.mutate(transformation.id)
    console.log('delete', transformation.id)
  }

  return (
    <AppShell>
      <div
        className="flex-1 flex flex-col min-h-0 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #EEF0FB 0%, #E8E4F5 50%, #EBF0FB 100%)' }}
      >
        {/* Top-right purple glow blob */}
        <div
          className="absolute top-0 right-0 pointer-events-none"
          style={{
            width: '560px',
            height: '560px',
            background: 'radial-gradient(circle, rgba(192,132,252,0.40) 0%, rgba(167,139,250,0.18) 50%, transparent 75%)',
            borderRadius: '50%',
            transform: 'translate(30%, -30%)',
            filter: 'blur(6px)',
          }}
        />
        {/* Mid-left blue glow blob */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: '28%',
            left: 0,
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(147,197,253,0.30) 0%, rgba(196,181,253,0.10) 60%, transparent 80%)',
            borderRadius: '50%',
            transform: 'translateX(-42%)',
            filter: 'blur(6px)',
          }}
        />

        <PageHeader
          searchValue={searchTerm}
          onSearchChange={(val) => setSearchTerm(val)}
          newLabel="NOTEBOOK"
        />

        <div className="flex-1 overflow-y-auto relative z-10">
          <div className="max-w-7xl mx-auto px-6 sm:px-8 py-8 space-y-6">

            {/* Header row */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-4xl font-extrabold leading-tight" style={{ color: '#6D28D9' }}>
                  {t.transformations.title}
                </h1>
                <p className="text-slate-500 mt-1 text-sm sm:text-base">
                  {t.transformations.desc}
                </p>
              </div>
              <button
                className="flex items-center gap-2 px-5 py-3 text-white font-semibold text-sm whitespace-nowrap transition-all hover:opacity-90 active:scale-95 self-start sm:self-auto"
                style={{
                  background: 'linear-gradient(90deg, #5B21B6 0%, #7C3AED 100%)',
                  borderRadius: '999px',
                  boxShadow: '0 4px 18px 0 rgba(109,40,217,0.28)',
                }}
              >
                <Plus className="h-4 w-4 flex-shrink-0" />
                {t.transformations.createNew}
              </button>
            </div>

            {/* Tab Pills */}
            <div className="flex items-center gap-2">
              {(['transformations', 'playground'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="px-6 py-2.5 text-sm font-semibold transition-all"
                  style={
                    activeTab === tab
                      ? {
                          background: 'linear-gradient(90deg, #6366F1 0%, #A855F7 100%)',
                          color: '#fff',
                          borderRadius: '999px',
                          boxShadow: '0 2px 12px 0 rgba(139,92,246,0.28)',
                          border: '2px solid transparent',
                        }
                      : {
                          background: '#fff',
                          color: '#64748b',
                          borderRadius: '999px',
                          border: '2px solid #E2E8F0',
                        }
                  }
                >
                  {tab === 'transformations' ? t.transformations.title : t.transformations.playground}
                </button>
              ))}
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

                {/* Transformation Cards — 2-column responsive grid */}
                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <TransformationPlayground
                transformations={transformations}
                selectedTransformation={selectedTransformation}
              />
            )}

          </div>
        </div>
      </div>
      {/* === UI CHANGES END === */}

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