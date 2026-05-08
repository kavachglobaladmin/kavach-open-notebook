'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import { mindmapApi, MindMapNode } from '@/lib/api/mindmap'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Button } from '@/components/ui/button'
import {
  AlertCircle, RefreshCw,
  BookOpen, X, ZoomIn, ZoomOut, Maximize2, Network, ImageIcon, ChevronRight, ChevronDown
} from 'lucide-react'

// ── localStorage helpers ──────────────────────────────────────────────────────
const CACHE_PREFIX = 'mindmap_cache_'
const NODE_SUMMARY_PREFIX = 'mindmap_node_summary_'

function loadCached(sourceId: string): MindMapNode | null {
  try { const r = localStorage.getItem(CACHE_PREFIX + sourceId); return r ? JSON.parse(r) : null }
  catch { return null }
}
function saveCache(sourceId: string, node: MindMapNode) {
  try { localStorage.setItem(CACHE_PREFIX + sourceId, JSON.stringify(node)) } catch {}
}
function nodeSummaryKey(sourceId: string, nodeName: string, context: string) {
  const safe = (s: string) => s.toLowerCase().replace(/\s+/g, '_')
  return NODE_SUMMARY_PREFIX + sourceId + '__' + safe(nodeName) + '__ctx__' + safe(context)
}
function loadCachedNodeSummary(sourceId: string, nodeName: string, context: string): string | null {
  try { return localStorage.getItem(nodeSummaryKey(sourceId, nodeName, context)) } catch { return null }
}
function saveCachedNodeSummary(sourceId: string, nodeName: string, context: string, summary: string) {
  try { localStorage.setItem(nodeSummaryKey(sourceId, nodeName, context), summary) } catch {}
}

// ── JSON extraction helpers ───────────────────────────────────────────────────
function pickNode(parsed: unknown): MindMapNode | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const obj = parsed as Record<string, unknown>

  function eventsToChildren(evArr: Record<string, unknown>[]): MindMapNode[] {
    return evArr.map((ev) => {
      const dateRange = [ev.start_date ?? ev.date ?? ev.year, ev.end_date]
        .filter(Boolean).join(' – ')
      const eventText = String(ev.event ?? ev.description ?? ev.title ?? ev.label ?? '')
      const label = dateRange ? `${dateRange}: ${eventText}` : eventText
      return { label: label.trim() }
    })
  }

  if (typeof obj.name === 'string' && Array.isArray(obj.life_events)) {
    return { label: obj.name as string, children: eventsToChildren(obj.life_events as Record<string, unknown>[]) }
  }
  if (typeof obj.name === 'string' && Array.isArray(obj.events)) {
    return { label: obj.name as string, children: eventsToChildren(obj.events as Record<string, unknown>[]) }
  }
  if (!obj.name && Array.isArray(obj.events)) {
    const children = eventsToChildren(obj.events as Record<string, unknown>[])
    const rootLabel = typeof obj.title === 'string' ? obj.title : 'Timeline'
    return { label: rootLabel, children }
  }
  
  const rootTitleKey = Object.keys(obj).find(k => k.toLowerCase().replace(/[\s_-]/g, '') === 'roottitle')
  if (rootTitleKey && typeof obj[rootTitleKey] === 'string') {
    const rootLabel = obj[rootTitleKey] as string
    return { label: rootLabel, children: (obj.children as MindMapNode[] | undefined) ?? [] } as MindMapNode
  }
  if (typeof obj.label === 'string') return obj as unknown as MindMapNode
  
  return null
}

function extractMindMapJson(raw: unknown): MindMapNode {
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    const node = pickNode(raw)
    if (node) return node
  }
  if (typeof raw !== 'string') throw new Error(`Unsupported content type: ${typeof raw}`)

  try {
    const direct = JSON.parse(raw.trim())
    const node = pickNode(direct)
    if (node) return node
  } catch { }

  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '')
  text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\'/g, "'")

  const fenceRegex = new RegExp('`{3}(?:json)?\\s*([\\s\\S]*?)\\s*`{3}')
  const fenceMatch = text.match(fenceRegex)
  if (fenceMatch) {
    try {
      const node = pickNode(JSON.parse(fenceMatch[1].trim()))
      if (node) return node
    } catch {}
  }

  const candidates: { node: MindMapNode; len: number }[] = []
  let depth = 0, start = -1, inString = false, escape = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') { if (depth === 0) start = i; depth++ }
    else if (ch === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        const slice = text.slice(start, i + 1)
        try {
          const node = pickNode(JSON.parse(slice))
          if (node) candidates.push({ node, len: slice.length })
        } catch {}
        start = -1
      }
    }
  }
  if (candidates.length > 0) {
    candidates.sort((a, b) => b.len - a.len)
    return candidates[0].node
  }

  throw new Error(`No valid mind-map JSON found.`)
}

// ── Markdown/Text renderers ───────────────────────────────────────────────────
function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <span>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </span>
  )
}
function SummaryContent({ text }: { text: string }) {
  const cleaned = text.replace(/^#{1,6}\s+(.+)$/gm, '**$1**').replace(/^-{3,}$/gm, '').replace(/\n{3,}/g, '\n\n').trim()
  return (
    <div className="space-y-2 text-sm text-foreground leading-relaxed">
      {cleaned.split('\n').map((line, i) => {
        const t = line.trim()
        if (!t) return <div key={i} className="h-1" />
        if (/^[-*]\s/.test(t)) return (
          <div key={i} className="flex gap-2 pl-2">
            <span className="text-muted-foreground shrink-0">•</span>
            <span><FormattedText text={t.replace(/^[-*]\s/, '')} /></span>
          </div>
        )
        return <p key={i}><FormattedText text={line} /></p>
      })}
    </div>
  )
}

// ── Node summary panel ────────────────────────────────────────────────────────
function NodeSummaryPanel({ sourceId, nodeName, context, onClose }: {
  sourceId: string; nodeName: string; context: string; onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const fetchSummary = useCallback(() => {
    const cached = loadCachedNodeSummary(sourceId, nodeName, context)
    if (cached) { setSummary(cached); return }
    setLoading(true); setSummary(null); setError(null)
    mindmapApi.getNodeSummary(sourceId, nodeName, context)
      .then(res => { setSummary(res.summary); saveCachedNodeSummary(sourceId, nodeName, context, res.summary) })
      .catch(err => setError(err?.response?.data?.detail || err?.message || 'Unknown error'))
      .finally(() => setLoading(false))
  }, [sourceId, nodeName, context])

  useEffect(() => { fetchSummary() }, [fetchSummary])
  
  return (
    <div className="flex flex-col h-full border-l border-border/60 bg-white dark:bg-slate-900 z-10 relative">
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3 border-b border-border/40 shrink-0 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-start gap-2 min-w-0">
          <BookOpen className="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Context Analysis</p>
            <p className="text-sm font-semibold text-foreground truncate mt-0.5">{nodeName}</p>
          </div>
        </div>
        <button onClick={onClose} className="shrink-0 rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
        {loading && <div className="flex flex-col items-center justify-center py-10 gap-3"><LoadingSpinner /></div>}
        {!loading && summary && <SummaryContent text={summary} />}
      </div>
    </div>
  )
}

// ── D3 Mind Map Component (Refactored to match Reference Aesthetic) ─────────────
interface ExtendedHierarchyNode extends d3.HierarchyPointNode<MindMapNode> {
  id?: string;
  _children?: ExtendedHierarchyNode[] | undefined;
}

function MindMapGraph({ data, onLabelClick, selectedNode, scale, onScaleChange }: { 
  data: MindMapNode; 
  onLabelClick: (label: string, context: string) => void; 
  selectedNode: string | null;
  scale: number;
  onScaleChange?: (scale: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomGroupRef = useRef<SVGGElement>(null)
  const [rootNode, setRootNode] = useState<ExtendedHierarchyNode | null>(null)
  const [updateTick, setUpdateTick] = useState(0)
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)

  useEffect(() => {
    if (!data) return
    const root = d3.hierarchy(data) as any
    let nodeId = 0
    root.each((d: any) => {
      d.id = `node_${++nodeId}`
      if (d.depth >= 1 && d.children) {
        d._children = d.children
        d.children = null
      }
    })
    setRootNode(root)
  }, [data])

  const { nodes, links } = useMemo(() => {
    if (!rootNode) return { nodes: [], links: [] }
    // Reference image uses a wide horizontal spacing
    const treeLayout = d3.tree<MindMapNode>().nodeSize([60, 280]) 
    treeLayout(rootNode)
    return {
      nodes: rootNode.descendants() as ExtendedHierarchyNode[],
      links: rootNode.links()
    }
  }, [rootNode, updateTick])

  useEffect(() => {
    if (!svgRef.current || !zoomGroupRef.current) return
    const svg = d3.select(svgRef.current)
    const g = d3.select(zoomGroupRef.current)
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
        if (onScaleChange) onScaleChange(event.transform.k)
      })
    zoomBehaviorRef.current = zoom
    svg.call(zoom)
    svg.call(zoom.transform, d3.zoomIdentity.translate(150, 400).scale(scale))
  }, [])

  useEffect(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    const svg = d3.select(svgRef.current)
    const currentZoom = d3.zoomTransform(svgRef.current).k
    if (Math.abs(currentZoom - scale) > 0.01) {
      svg.transition().duration(300).call(zoomBehaviorRef.current.scaleTo, scale)
    }
  }, [scale])

  const handleToggle = (e: React.MouseEvent, node: ExtendedHierarchyNode) => {
    e.stopPropagation()
    if (node.children) {
      node._children = node.children as ExtendedHierarchyNode[]
      node.children = undefined
    } else if (node._children) {
      node.children = node._children as unknown as ExtendedHierarchyNode[]
      node._children = undefined
    }
    setUpdateTick(tick => tick + 1)
  }

  // Horizontal Curve Link Generator (Reference Style)
  const linkGenerator = d3.linkHorizontal<any, any>()
    .x(d => d.y)
    .y(d => d.x)

  return (
    <div className="w-full h-full relative overflow-hidden bg-white font-sans">
      {/* Background Grid Pattern (Reference matches a clean white bg) */}
      <div className="absolute inset-0 opacity-[0.1] pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#64748b 1px, transparent 0)', backgroundSize: '30px 30px' }} />
      
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing">
        <g ref={zoomGroupRef}>
          {links.map((link) => {
             const targetNode = link.target as ExtendedHierarchyNode
             return (
               <path 
                 key={`link_${targetNode.id}`}
                 d={linkGenerator(link) || undefined}
                 fill="none"
                 stroke="#cbd5e1" // Soft slate for flow lines
                 strokeWidth={1.5}
                 className="transition-all duration-500 ease-in-out"
               />
             )
          })}

          {nodes.map((node) => {
            const hasChildren = !!node.children || !!node._children
            const isExpanded = !!node.children
            const isLeaf = !hasChildren && node.depth > 0
            const isSelected = selectedNode === node.data.label
            const displayLabel = (node.data.label || '').trim()

            // Colors extracted from Reference Image:
            // Parent/Mid: Dark Slate (#1e293b)
            // Leaf: Sage Green (#2d4a3e)
            const nodeBg = isLeaf ? 'bg-[#2d4a3e]' : 'bg-[#1e293b]'

            return (
              <g key={node.id} transform={`translate(${node.y},${node.x})`} className="transition-all duration-500">
                {/* Node Dot Hub */}
                <circle r={5} fill={isLeaf ? '#4ade80' : '#6366f1'} className="opacity-0" />
                
                <foreignObject x={0} y={-18} width={250} height={60} className="overflow-visible">
                  <div className="flex items-center group">
                    <div 
                      onClick={() => onLabelClick(displayLabel, node.parent?.data?.label || '')}
                      className={`relative flex items-center px-4 py-1.5 w-max max-w-[220px] rounded-md transition-all duration-300 border border-transparent cursor-pointer shadow-sm
                        ${nodeBg} ${isSelected ? 'ring-2 ring-indigo-400 ring-offset-2' : 'hover:scale-105'}
                      `}
                    >
                      <span className="text-white text-[12px] font-medium leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                        {displayLabel}
                      </span>
                      
                      {/* Toggle Button on the node connector */}
                      {hasChildren && (
                        <button 
                          onClick={(e) => handleToggle(e, node)}
                          className="absolute -right-2.5 w-5 h-5 rounded-full flex items-center justify-center bg-slate-700 text-white border border-slate-500 hover:bg-slate-600 transition-colors z-10"
                        >
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                      )}
                    </div>
                  </div>
                </foreignObject>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

// ── Main Layout Logic Preserved ────────────────────────────────────────────────
function ZoomControls({ scale, onZoomIn, onZoomOut, onReset }) {
  return (
    <div className="absolute bottom-6 right-6 flex items-center gap-1 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-lg p-1 shadow-lg z-10">
      <button onClick={onZoomOut} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600"><ZoomOut className="h-4 w-4" /></button>
      <span className="text-[11px] font-bold text-slate-500 w-10 text-center">{Math.round(scale * 100)}%</span>
      <button onClick={onZoomIn} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600"><ZoomIn className="h-4 w-4" /></button>
      <div className="w-px h-4 bg-slate-200 mx-1" />
      <button onClick={onReset} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600"><Maximize2 className="h-4 w-4" /></button>
    </div>
  )
}

export function MindMapInsightViewer({ content, sourceId, title }: { content: string; sourceId: string; title?: string | null }) {
  const [mindMap, setMindMap] = useState<MindMapNode | null>(null)
  const [selected, setSelected] = useState<{ nodeName: string, context: string } | null>(null)
  const [scale, setScale] = useState(0.8)
  const [activeTab, setActiveTab] = useState<'graph' | 'photos'>('graph')

  useEffect(() => {
    try {
      const parsed = extractMindMapJson(content)
      setMindMap(parsed)
      saveCache(sourceId, parsed)
    } catch (e) {
      console.error(e)
    }
  }, [content, sourceId])

  const handleClick = useCallback((nodeName: string, context: string) => {
    setSelected(prev => prev?.nodeName === nodeName ? null : { nodeName, context })
  }, [])

  if (!mindMap) return <div className="flex items-center justify-center py-20"><LoadingSpinner /></div>

  return (
    <div className="flex flex-col h-full bg-white rounded-xl overflow-hidden">
      <div className="flex gap-2 border-b border-slate-100 px-4 py-2 shrink-0">
        <button onClick={() => setActiveTab('graph')} className={`px-4 py-1.5 text-xl font-semibold rounded-[8px] transition-all ${activeTab === 'graph' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Map View</button>
        <button onClick={() => setActiveTab('photos')} className={`px-4 py-1.5 text-xl font-semibold rounded-[8px] transition-all ${activeTab === 'photos' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>Photos</button>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div className={`relative flex-1 transition-all duration-500 ${selected ? 'mr-[320px]' : ''}`}>
           <MindMapGraph data={mindMap} onLabelClick={handleClick} selectedNode={selected?.nodeName ?? null} scale={scale} onScaleChange={setScale} />
           <ZoomControls scale={scale} onZoomIn={() => setScale(s => s + 0.1)} onZoomOut={() => setScale(s => s - 0.1)} onReset={() => setScale(0.8)} />
        </div>
        
        {selected && (
          <div className="absolute right-0 top-0 bottom-0 w-[320px] bg-white border-l border-slate-200 shadow-2xl z-20 animate-in slide-in-from-right duration-300">
            <NodeSummaryPanel sourceId={sourceId} nodeName={selected.nodeName} context={selected.context} onClose={() => setSelected(null)} />
          </div>
        )}
      </div>
    </div>
  )
}