'use client'

import { useEffect, useState, useRef } from 'react'
import {
  RefreshCw,
  FileText,
  AlertCircle,
  Bold,
  Italic,
  Highlighter,
  List,
  ListOrdered,
  Type,
  Undo,
  Redo,
  Save,
  Download
} from 'lucide-react'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import { sourcesApi } from '@/lib/api/sources'

// ── Types ──────────────────────────────────────────────────────────────────
interface PartIVViewProps {
  sourceId: string
}

interface PartIVData {
  sections: Record<string, string>
  raw: string
  source_id: string
  found: boolean
}

// ── Full-Width Editor Controller ───────────────────────────────────────────
function EditorController({ initialContent, placeholder }: { initialContent: string, placeholder?: string }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true, keepAttributes: false },
        orderedList: { keepMarks: true, keepAttributes: false },
      }),
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ 
        placeholder: placeholder || 'Start writing the background narrative...' 
      }),
    ],
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-slate prose-sm md:prose-base max-w-none focus:outline-none min-h-[65vh] text-slate-700 leading-relaxed p-8 lg:p-12',
      },
    },
  })

  if (!editor) return null

  return (
    <div className="relative w-full h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group">
      
      {/* ── Main Toolbar (Top Controls) ── */}
      <div className="flex flex-wrap items-center gap-1 p-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-0.5 mr-2">
          <button 
            onClick={() => editor.chain().focus().undo().run()} 
            className="p-2 hover:bg-white hover:shadow-sm rounded-md text-slate-500 transition-all cursor-pointer active:scale-95"
            title="Undo"
          >
            <Undo size={16}/>
          </button>
          <button 
            onClick={() => editor.chain().focus().redo().run()} 
            className="p-2 hover:bg-white hover:shadow-sm rounded-md text-slate-500 transition-all cursor-pointer active:scale-95"
            title="Redo"
          >
            <Redo size={16}/>
          </button>
        </div>
        
        <div className="h-6 w-[1px] bg-slate-200 mx-2" />
        
        <button 
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} 
          className={`p-2 rounded-md transition-all active:scale-95 ${editor.isActive('heading', { level: 3 }) ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-white'}`}
        >
          <Type size={16}/>
        </button>
        
        <button 
          onClick={() => editor.chain().focus().toggleBold().run()} 
          className={`p-2 rounded-md transition-all active:scale-95 ${editor.isActive('bold') ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-white'}`}
        >
          <Bold size={16}/>
        </button>

        <button 
          onClick={() => editor.chain().focus().toggleHighlight().run()} 
          className={`p-2 rounded-md transition-all active:scale-95 ${editor.isActive('highlight') ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-white'}`}
        >
          <Highlighter size={16}/>
        </button>
        
        <div className="h-6 w-[1px] bg-slate-200 mx-2" />

        <button 
          onClick={() => editor.chain().focus().toggleBulletList().run()} 
          className={`p-2 rounded-md transition-all active:scale-95 ${editor.isActive('bulletList') ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-white'}`}
        >
          <List size={16}/>
        </button>
        
        <button 
          onClick={() => editor.chain().focus().toggleOrderedList().run()} 
          className={`p-2 rounded-md transition-all active:scale-95 ${editor.isActive('orderedList') ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:bg-white'}`}
        >
          <ListOrdered size={16}/>
        </button>

        <div className="flex-1" />
        
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 shadow-md transition-all active:scale-95 group-focus-within:ring-2 ring-blue-200">
          <Save size={14}/> Save Changes
        </button>
      </div>

      {/* ── Editor Content Area ── */}
      <div className="flex-1 overflow-y-auto bg-white custom-scrollbar selection:bg-blue-100">
        <EditorContent editor={editor} />
      </div>

      {/* Styling for lists to ensure they show up properly */}
      <style jsx global>{`
        .prose ul { list-style-type: disc !important; padding-left: 1.5rem !important; }
        .prose ol { list-style-type: decimal !important; padding-left: 1.5rem !important; }
        .prose strong { font-weight: 700 !important; color: inherit !important; }
        .prose h3 { font-weight: 700 !important; margin-top: 1.5rem !important; margin-bottom: 0.5rem !important; }
      `}</style>
    </div>
  )
}

// ── Main PartIVView Component ──────────────────────────────────────────────
export function PartIVView({ sourceId }: PartIVViewProps) {
  const [data, setData] = useState<PartIVData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sourceId) return
    let isMounted = true
    setLoading(true)

    sourcesApi.getPartIV(sourceId)
      .then((d) => {
        if (!isMounted) return
        setData(d)
        setLoading(false)
      })
      .catch((e) => {
        if (!isMounted) return
        setError(e?.response?.data?.detail || e?.message || 'Failed to load document')
        setLoading(false)
      })

    return () => { isMounted = false }
  }, [sourceId])

  if (loading) return (
    <div className="flex h-full min-h-[600px] flex-col items-center justify-center gap-4 bg-white rounded-xl border border-slate-100">
      <div className="h-12 w-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
      <span className="text-slate-500 font-semibold animate-pulse tracking-wide">Syncing Editor Content...</span>
    </div>
  )

  if (error || !data?.found) return (
    <div className="flex h-full min-h-[600px] flex-col items-center justify-center gap-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
      <AlertCircle size={32} className="text-amber-500" />
      <div className="max-w-xs">
        <h3 className="font-bold text-slate-800">History Not Found</h3>
        <p className="text-slate-500 text-sm mt-2">{error || "Could not retrieve the Part IV record for this source."}</p>
      </div>
    </div>
  )

  return (
    <div className="w-full h-full flex flex-col bg-slate-50/50">
      {/* ── Header ── */}
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg text-white shadow-lg shadow-blue-100">
            <FileText size={18} />
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-sm leading-tight">Background & History</h1>
            <div className="flex items-center gap-2 mt-0.5">
               <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block">Live Editor — Part IV</span>
            </div>
          </div>
        </div>
        <button className="flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-md text-xs font-bold transition-all border border-transparent hover:border-slate-200">
          <Download size={14} /> Export Document
        </button>
      </div>

      {/* ── Editor Area ── */}
      <div className="flex-1 px-6 pb-6 overflow-hidden">
        <EditorController initialContent={data.raw} />
      </div>
    </div>
  )
}

export default PartIVView