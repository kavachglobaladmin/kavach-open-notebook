'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import * as d3 from 'd3'
import { mindmapApi, MindMapNode } from '@/lib/api/mindmap'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Button } from '@/components/ui/button'
import {
  AlertCircle, RefreshCw,
  BookOpen, X, ZoomIn, ZoomOut, Maximize2, ChevronRight, ChevronDown,
  Camera, GitFork
} from 'lucide-react'

// ── localStorage helpers ──────────────────────────────────────────────────────
const CACHE_PREFIX = 'mindmap_cache_'
const NODE_SUMMARY_PREFIX = 'mindmap_node_summary_'

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
        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-xs text-destructive text-center">{error}</p>
            <Button variant="outline" size="sm" className="text-xs h-7 mt-1" onClick={fetchSummary}>
              <RefreshCw className="h-3 w-3 mr-1" /> Retry
            </Button>
          </div>
        )}
        {!loading && summary && <SummaryContent text={summary} />}
      </div>
    </div>
  )
}

// ── D3 Mind Map Component ────────────────────────────────────────────────────
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

    // Use a recursive traversal instead of each() so we can assign IDs to ALL
    // nodes (including depth-2+) before collapsing their parents, avoiding the
    // bug where each() skips children that were collapsed during its traversal.
    function initNode(node: any) {
      node.id = `node_${++nodeId}`
      if (node.children) {
        if (node.depth >= 1) {
          // Collapse this node: move children -> _children, then recurse into them
          node._children = node.children
          node.children = null
          node._children.forEach((child: any) => initNode(child))
        } else {
          // Root level: keep children visible, recurse normally
          node.children.forEach((child: any) => initNode(child))
        }
      }
    }
    initNode(root)

    setRootNode(root)
  }, [data])

  const { nodes, links } = useMemo(() => {
    if (!rootNode) return { nodes: [], links: [] }
    const treeLayout = d3.tree<MindMapNode>().nodeSize([45, 260])
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
    const rect = svgRef.current.getBoundingClientRect()
    const centerY = rect.height > 0 ? rect.height / 2 : 300
    svg.call(zoom.transform, d3.zoomIdentity.translate(120, centerY).scale(scale))
  }, [])

  useEffect(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return
    const svg = d3.select(svgRef.current)
    const currentZoom = d3.zoomTransform(svgRef.current).k
    if (Math.abs(currentZoom - scale) > 0.01) {
      svg.transition().duration(300).call(zoomBehaviorRef.current.scaleTo, scale)
    }
  }, [scale])

  // Toggle uses ONLY updateTick — no animKey so React does NOT remount all nodes
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

  const linkGenerator = d3.linkHorizontal<any, any>()
    .x(d => d.y)
    .y(d => d.x)

  const baseStyles = `
    @keyframes mmDrawPath {
      0%   { stroke-dashoffset: 900; opacity: 0; }
      20%  { opacity: 1; }
      100% { stroke-dashoffset: 0; opacity: 1; }
    }
    @keyframes mmDotFade {
      0%,100% { opacity: 0; }
      15%,85% { opacity: 0.9; }
    }
    .mm-path {
      stroke-dasharray: 900;
      animation: mmDrawPath 0.65s cubic-bezier(0.4,0,0.2,1) forwards;
    }
    .mm-dot {
      animation: mmDotFade 2.8s ease-in-out infinite;
    }
  `

  return (
    <div className="w-full h-full relative overflow-hidden bg-white font-sans">
      <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing">
        <defs>
          <style dangerouslySetInnerHTML={{ __html: baseStyles }} />
          <filter id="mm-shadow" x="-20%" y="-40%" width="140%" height="180%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#00000022" />
          </filter>
        </defs>

        <g ref={zoomGroupRef}>
          {/* Connector paths — outer <g> keeps stable key; inner <path> re-keys on updateTick to retrigger draw animation */}
          {links.map((link, i) => {
            const targetNode = link.target as ExtendedHierarchyNode
            const sourceNode = link.source as ExtendedHierarchyNode
            // Source nodes (parents) exit from their right edge (~160px from left);
            // target nodes (children / leaves) enter at their left edge (x=0 offset).
            const EST_BOX_W = 160
            const pathD = linkGenerator({
              source: { x: sourceNode.x, y: sourceNode.y + EST_BOX_W },
              target: { x: targetNode.x, y: targetNode.y }
            }) || ''
            return (
              <g key={`lgrp_${targetNode.id ?? `i${i}`}`}>
                <path
                  key={`path_${targetNode.id}`}
                  d={pathD || undefined}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  className="mm-path"
                  style={{ animationDelay: `${i * 0.04}s` }}
                />
                {/* Flowing dot along connector */}
                {pathD && (
                  <circle
                    key={`dot_${targetNode.id}`}
                    r="3.5"
                    fill="#166534"
                    className="mm-dot"
                    style={{ animationDelay: `${0.55 + i * 0.18}s` }}
                  >
                    <animateMotion
                      dur="2.8s"
                      repeatCount="indefinite"
                      begin={`${0.55 + i * 0.18}s`}
                      path={pathD}
                    />
                  </circle>
                )}
              </g>
            )
          })}

          {/* Nodes — stable keys so React preserves DOM, D3 transitions positions smoothly */}
          {nodes.map((node, i) => {
            const hasChildren = !!node.children || !!node._children
            const isExpanded = !!node.children
            const isLeaf = !hasChildren && node.depth > 0
            const isSelected = selectedNode === node.data.label
            const displayLabel = (node.data.label || '').trim()
            const nodeBg = isLeaf ? 'bg-[#166534]' : 'bg-[#1e3a5f]'
            const accentColor = isLeaf ? '#22c55e' : '#60a5fa'

            return (
              <g
                key={node.id ?? `ni_${i}`}
                transform={`translate(${node.y},${node.x})`}
              >
                <foreignObject x={0} y={-16} width={280} height={32} className="overflow-visible">
                  <div className="flex items-center h-full">
                    <div
                      onClick={() => onLabelClick(displayLabel, node.parent?.data?.label || '')}
                      style={{ filter: 'url(#mm-shadow)' }}
                      className={`relative flex items-center gap-2 px-4 py-1.5 w-max max-w-[240px] rounded-[7px] cursor-pointer
                        transition-all duration-200 ease-out
                        hover:brightness-125 hover:scale-[1.04] hover:-translate-y-px
                        ${nodeBg}
                        ${isSelected ? 'ring-2 ring-offset-2 ring-offset-white ring-blue-400 brightness-125' : ''}
                      `}
                    >
                      <span
                        className="shrink-0 w-1.5 h-1.5 rounded-full"
                        style={{ background: accentColor, opacity: 0.85 }}
                      />
                      <span className="text-[#E2E8F0] text-[12.5px] font-medium leading-tight whitespace-nowrap overflow-hidden text-ellipsis">
                        {displayLabel}
                      </span>

                      {hasChildren && (
                        <button
                          onClick={(e) => handleToggle(e, node)}
                          className="absolute -right-3 top-1/2 -translate-y-1/2 w-[20px] h-[20px] rounded-full
                            flex items-center justify-center
                            bg-white text-[#1e3a5f] border border-slate-300 shadow-md
                            hover:bg-slate-100 hover:scale-110 active:scale-95
                            transition-all duration-150 z-10"
                          title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded
                            ? <ChevronDown size={10} strokeWidth={3} />
                            : <ChevronRight size={10} strokeWidth={3} />}
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

// ── Photos Tab ────────────────────────────────────────────────────────────────
function PhotosTab({ sourceId }: { sourceId: string }) {
  const [images, setImages] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [selectedImg, setSelectedImg] = useState<string | null>(null)

  useEffect(() => {
    if (loaded) return
    setLoading(true)
    mindmapApi.getImages(sourceId)
      .then(res => { setImages(res.images ?? []); setLoaded(true) })
      .catch(() => { setImages([]); setLoaded(true) })
      .finally(() => setLoading(false))
  }, [sourceId, loaded])

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
      <LoadingSpinner />
      <p className="text-sm">Extracting images from source…</p>
    </div>
  )

  if (!images.length) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400 px-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
        <Camera className="h-7 w-7 text-slate-300" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-600">No photos found</p>
        <p className="text-xs text-slate-400 mt-1">Photos embedded in the source document will appear here.</p>
      </div>
    </div>
  )

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 overflow-y-auto h-full">
        {images.map((b64, i) => (
          <button
            key={i}
            onClick={() => setSelectedImg(b64)}
            className="rounded-xl overflow-hidden border border-slate-200 hover:border-violet-400 transition-all shadow-sm hover:shadow-md"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${b64}`}
              alt={`Image ${i + 1}`}
              className="w-full h-40 object-contain bg-slate-50"
            />
          </button>
        ))}
      </div>
      {selectedImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setSelectedImg(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] p-2" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:image/png;base64,${selectedImg}`}
              alt="Full size"
              className="max-w-full max-h-[85vh] rounded-xl shadow-2xl object-contain"
            />
            <button
              onClick={() => setSelectedImg(null)}
              className="absolute top-3 right-3 bg-black/50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-black/80 text-lg"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function isMindMapInsight(insightType: string): boolean {
  return /mind.?map/i.test(insightType)
}

// ── Main Layout Logic Preserved ────────────────────────────────────────────────
function ZoomControls({ scale, onZoomIn, onZoomOut, onReset, onFullscreen }: {
  scale: number
  onZoomIn: () => void
  onZoomOut: () => void
  onReset: () => void
  onFullscreen?: () => void
}) {
  return (
    <div className="absolute bottom-6 right-6 flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-lg p-1 shadow-lg z-10">
      <button onClick={onZoomOut} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600"><ZoomOut className="h-4 w-4" /></button>
      <span className="text-[11px] font-bold text-slate-500 w-10 text-center">{Math.round(scale * 100)}%</span>
      <button onClick={onZoomIn} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600"><ZoomIn className="h-4 w-4" /></button>
      <div className="w-px h-4 bg-slate-200 mx-1" />
      <button onClick={onReset} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600" title="Reset zoom"><Maximize2 className="h-4 w-4" /></button>
      {onFullscreen && (
        <>
          <div className="w-px h-4 bg-slate-200 mx-1" />
          <button onClick={onFullscreen} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600" title="Fullscreen">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}

export function MindMapInsightViewer({ content, sourceId, title }: { content: string; sourceId: string; title?: string | null }) {
  const [mindMap, setMindMap] = useState<MindMapNode | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [rawDebug, setRawDebug] = useState('')
  const [selected, setSelected] = useState<{ nodeName: string, context: string } | null>(null)
  const [scale, setScale] = useState(0.8)
  const [activeTab, setActiveTab] = useState<'graph' | 'photos'>('graph')
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    setSelected(null)
    setParseError(null)
    const rawStr = String(content)
    setRawDebug(rawStr)
    try {
      const parsed = extractMindMapJson(content)
      setMindMap(parsed)
      saveCache(sourceId, parsed)
    } catch (e) {
      setParseError(e instanceof Error ? e.message : String(e))
      setMindMap(null)
    }
  }, [content, sourceId])

  const handleClick = useCallback((nodeName: string, context: string) => {
    setSelected(prev => prev?.nodeName === nodeName ? null : { nodeName, context })
  }, [])

  if (parseError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm font-medium text-destructive">Could not render mind map</p>
        <p className="text-xs text-muted-foreground max-w-sm font-mono bg-muted px-2 py-1 rounded">{parseError}</p>
        <details className="mt-2 w-full text-left">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">▶ Show raw data</summary>
          <pre className="mt-2 text-[10px] bg-muted rounded p-3 overflow-auto max-h-60 whitespace-pre-wrap break-all border border-border/40">{rawDebug}</pre>
        </details>
      </div>
    )
  }

  if (!mindMap) return <div className="flex items-center justify-center py-20"><LoadingSpinner /></div>

  return (
    <div className="flex flex-col h-full bg-white rounded-xl overflow-hidden">

      {/* ── Tab bar — underline style with icons ── */}
      <div className="flex items-center border-b border-slate-100 px-4 shrink-0">
        <button
          onClick={() => setActiveTab('graph')}
          className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'graph'
              ? 'text-slate-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-slate-900 after:rounded-full'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <GitFork className="h-3.5 w-3.5" />
          Map View
        </button>
        <button
          onClick={() => { setActiveTab('photos'); setSelected(null) }}
          className={`relative flex items-center gap-1.5 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'photos'
              ? 'text-slate-900 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-slate-900 after:rounded-full'
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Camera className="h-3.5 w-3.5" />
          Evidence
        </button>
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'graph' ? (
        <div className="flex-1 flex overflow-hidden relative">
          <div className={`relative flex-1 transition-all duration-500 ${selected ? 'mr-[320px]' : ''}`}>
            <MindMapGraph
              data={mindMap}
              onLabelClick={handleClick}
              selectedNode={selected?.nodeName ?? null}
              scale={scale}
              onScaleChange={setScale}
            />
            <ZoomControls
              scale={scale}
              onZoomIn={() => setScale(s => Math.min(s + 0.1, 3))}
              onZoomOut={() => setScale(s => Math.max(s - 0.1, 0.1))}
              onReset={() => setScale(0.8)}
              onFullscreen={() => setFullscreen(true)}
            />
          </div>

          {selected && (
            <div className="absolute right-0 top-0 bottom-0 w-[320px] bg-white border-l border-slate-200 shadow-2xl z-20 animate-in slide-in-from-right duration-300">
              <NodeSummaryPanel
                sourceId={sourceId}
                nodeName={selected.nodeName}
                context={selected.context}
                onClose={() => setSelected(null)}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-hidden">
          <PhotosTab sourceId={sourceId} />
        </div>
      )}

      {/* ── Fullscreen overlay ── */}
      {fullscreen && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
            <span className="text-lg font-bold text-slate-900">{mindMap.label || title || 'Knowledge Map'}</span>
            <button
              onClick={() => setFullscreen(false)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-semibold text-sm transition-colors"
            >
              <X className="h-4 w-4" /> Exit Fullscreen
            </button>
          </div>
          <div className="flex-1 relative overflow-hidden">
            <MindMapGraph
              data={mindMap}
              onLabelClick={handleClick}
              selectedNode={selected?.nodeName ?? null}
              scale={0.8}
              onScaleChange={() => {}}
            />
          </div>
        </div>
      )}
    </div>
  )
}