'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d'
import { sourcesApi } from '@/lib/api/sources'
import { CommonGraphResponse } from '@/lib/types/api'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useModels, useModelDefaults, useUpdateModelDefaults } from '@/lib/hooks/use-models'
import { Badge } from '@/components/ui/badge'
import { useTransformations, useCreateTransformation, useUpdateTransformation } from '@/lib/hooks/use-transformations'
import { Settings2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

const COMMON_GRAPH_TRANSFORMATION_NAME = 'common_graph_extraction'

// No hardcoded default — prompt always comes from saved transformation
const FALLBACK_PROMPT_HINT = `(Prompt loaded from Transformations)

Note: Person name extraction uses NLP (spaCy) for accuracy.
The prompt here is saved as a transformation for reference/customization.`

const SOURCE_LINK_COLORS = [
  { line: 'rgba(168,85,247,0.6)', glow: '#a855f7' },
  { line: 'rgba(251,146,60,0.6)', glow: '#fb923c' },
  { line: 'rgba(34,211,238,0.6)', glow: '#22d3ee' },
  { line: 'rgba(74,222,128,0.6)', glow: '#4ade80' },
  { line: 'rgba(251,191,36,0.6)', glow: '#fbbf24' },
]

const NODE_TYPE_COLORS: Record<string, string> = {
  source: '#a855f7',
  person: '#0ea5e9',
  relative: '#22c55e',
  activity: '#f59e0b',
  entity: '#94a3b8',
  term: '#94a3b8',
}

const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  crime: '#ef4444',
  weapon: '#dc2626',
  drug: '#f97316',
  transaction: '#eab308',
  event: '#8b5cf6',
}

// Draw male silhouette
function drawMaleIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color
  // Head
  ctx.beginPath(); ctx.arc(x, y - r * 0.22, r * 0.32, 0, 2 * Math.PI); ctx.fill()
  // Body (shirt shape)
  ctx.beginPath()
  ctx.moveTo(x - r * 0.35, y + r * 0.1)
  ctx.lineTo(x - r * 0.42, y + r * 0.55)
  ctx.lineTo(x + r * 0.42, y + r * 0.55)
  ctx.lineTo(x + r * 0.35, y + r * 0.1)
  ctx.quadraticCurveTo(x, y + r * 0.0, x - r * 0.35, y + r * 0.1)
  ctx.fill()
}

// Draw female silhouette
function drawFemaleIcon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color
  // Head
  ctx.beginPath(); ctx.arc(x, y - r * 0.22, r * 0.3, 0, 2 * Math.PI); ctx.fill()
  // Dress (triangle shape)
  ctx.beginPath()
  ctx.moveTo(x - r * 0.18, y + r * 0.05)
  ctx.lineTo(x - r * 0.45, y + r * 0.58)
  ctx.lineTo(x + r * 0.45, y + r * 0.58)
  ctx.lineTo(x + r * 0.18, y + r * 0.05)
  ctx.quadraticCurveTo(x, y - r * 0.02, x - r * 0.18, y + r * 0.05)
  ctx.fill()
}

function guessGender(role: string, label: string): 'male' | 'female' {
  const femaleRoles = ['mother', 'wife', 'sister', 'daughter', 'aunt', 'niece', 'girlfriend', 'female', 'victim']
  const femaleNames = ['devi', 'bai', 'kumari', 'rani', 'priya', 'lata', 'poonam', 'nikita', 'anuradha', 'smt', 'km']
  const rl = (role || '').toLowerCase()
  const ll = (label || '').toLowerCase()
  if (femaleRoles.some((r) => rl.includes(r))) return 'female'
  if (femaleNames.some((n) => ll.includes(n))) return 'female'
  return 'male'
}

type GraphNode = {
  id: string
  label: string
  type: 'source' | 'person' | 'relative' | 'activity' | 'entity' | 'term'
  common?: boolean
  weight?: number
  role?: string
  activity_type?: string
  details?: string
  source_title?: string
  source_id?: string
  x?: number
  y?: number
}

type GraphLink = {
  source: string | GraphNode
  target: string | GraphNode
  type?: string
  weight?: number
}

type GraphData = { nodes: GraphNode[]; links: GraphLink[] }

function getNodeId(n: string | GraphNode): string {
  return typeof n === 'string' ? n : n.id
}

function NetworkGraphViewer({ graph, mode = 'persons', sourceIds = [] }: { graph: GraphData; mode?: 'persons' | 'activities' | 'associates'; sourceIds?: string[] }) {
  const graphRef = useRef<ForceGraphMethods | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [contextParagraphs, setContextParagraphs] = useState<string[]>([])
  const [loadingContext, setLoadingContext] = useState(false)
  const nodeImageStore = useRef<Map<string, string>>(new Map())
  const [uploadedImages, setUploadedImages] = useState<Map<string, string>>(new Map())
  const [nodeImages, setNodeImages] = useState<Map<string, HTMLImageElement>>(new Map())
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load images for source nodes (main persons) from their docx files
  useEffect(() => {
    const sourceNodes = graph.nodes.filter((n) => n.type === 'source' && n.source_id)
    sourceNodes.forEach((n) => {
      if (nodeImages.has(n.id)) return
      sourcesApi.getProfileImage(n.source_id!).then((url) => {
        if (!url) return
        const img = new Image()
        img.onload = () => setNodeImages((prev) => new Map(prev).set(n.id, img))
        img.src = url
      }).catch(() => {})
    })
  }, [graph])

  const connectedNodeIds = useMemo(() => {
    if (!hoverNode) return new Set<string>()
    const ids = new Set<string>()
    graph.links.forEach((l) => {
      const s = getNodeId(l.source), t = getNodeId(l.target)
      if (s === hoverNode.id) ids.add(t)
      if (t === hoverNode.id) ids.add(s)
    })
    return ids
  }, [graph.links, hoverNode])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((e) => {
      const r = e[0].contentRect
      setDimensions({ width: Math.max(400, Math.round(r.width)), height: Math.max(400, Math.round(r.height)) })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    const fg = graphRef.current
    if (!fg) return
    // Very strong repulsion + large link distance to prevent overlap
    fg.d3Force('charge')?.strength(-2000)
    fg.d3Force('link')?.distance(250)
    // Add collision force via d3
    try {
      const sim = (fg as any).d3Force('collision')
      if (!sim) {
        // Try to add collision force
        const fgAny = fg as any
        if (fgAny.d3Force) {
          // Use the internal simulation
          const charge = fgAny.d3Force('charge')
          if (charge) {
            // Increase min distance
            charge.distanceMin?.(30)
          }
        }
      }
    } catch {}
  }, [dimensions])

  // Convert canvas node position to screen position (unused — kept for reference)
  // const nodeToScreen = ...

  const handleNodeClick = useCallback(async (node: any) => {
    const n = node as GraphNode
    if (selectedNode?.id === n.id) {
      setSelectedNode(null)
      setContextParagraphs([])
      return
    }
    setSelectedNode(n)
    setContextParagraphs([])

    // If person has no details, load context paragraphs from source text
    if ((n.type === 'person' || n.type === 'relative') && !n.details) {
      // Find which source this person belongs to
      const link = graph.links.find((l) => {
        const s = getNodeId(l.source), t = getNodeId(l.target)
        return (t === n.id && s.startsWith('source:')) || (s === n.id && t.startsWith('source:'))
      })
      const srcNodeId = link
        ? (getNodeId(link.source).startsWith('source:') ? getNodeId(link.source) : getNodeId(link.target))
        : null
      const srcIdx = srcNodeId ? parseInt(srcNodeId.replace('source:', '')) : 0
      const sourceId = sourceIds[srcIdx]
      if (sourceId) {
        setLoadingContext(true)
        try {
          const result = await sourcesApi.getPersonContext(sourceId, n.label)
          setContextParagraphs(result.paragraphs)
        } catch {
          setContextParagraphs([])
        } finally {
          setLoadingContext(false)
        }
      }
    }
  }, [selectedNode, graph, sourceIds])

  const handleUploadImage = useCallback((nodeId: string, file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const url = e.target?.result as string
      nodeImageStore.current.set(nodeId, url)
      setUploadedImages((prev) => new Map(prev).set(nodeId, url))
    }
    reader.readAsDataURL(file)
  }, [])

  const getSourceIdx = useCallback((nodeId: string) => {
    const m = nodeId.match(/^source:(\d+)$/)
    if (m) return parseInt(m[1])
    // For person nodes, find which source they connect to in the original graph
    const link = graph.links.find((l) => {
      const s = getNodeId(l.source), t = getNodeId(l.target)
      return (t === nodeId && s.startsWith('source:')) || (s === nodeId && t.startsWith('source:'))
    })
    if (link) {
      const srcId = getNodeId(link.source).startsWith('source:') ? getNodeId(link.source) : getNodeId(link.target)
      const m2 = srcId.match(/^source:(\d+)$/)
      if (m2) return parseInt(m2[1])
    }
    return 0
  }, [graph])

  // Filter graph based on mode
  const filteredGraph = useMemo((): GraphData => {
    if (mode === 'persons') {
      // Show ALL persons from both files (source + person + relative)
      const allowedTypes = new Set(['source', 'person', 'relative'])
      const filteredNodes = graph.nodes.filter((n) => allowedTypes.has(n.type))
      const allowedIds = new Set(filteredNodes.map((n) => n.id))
      const filteredLinks = graph.links.filter((l) => {
        const s = getNodeId(l.source), t = getNodeId(l.target)
        return allowedIds.has(s) && allowedIds.has(t)
      })
      // Add cross-source links for common persons
      const extraLinks: GraphLink[] = []
      const commonPersons = filteredNodes.filter((n) => n.type === 'person' && n.common)
      const sourceNodes = filteredNodes.filter((n) => n.type === 'source')
      if (sourceNodes.length >= 2) {
        commonPersons.forEach((p) => {
          const connectedSources = filteredLinks
            .filter((l) => getNodeId(l.target) === p.id || getNodeId(l.source) === p.id)
            .map((l) => getNodeId(l.source) === p.id ? getNodeId(l.target) : getNodeId(l.source))
            .filter((id) => id.startsWith('source:'))
          sourceNodes.forEach((src) => {
            if (!connectedSources.includes(src.id)) {
              extraLinks.push({ source: src.id, target: p.id, type: 'common_link', weight: 1 })
            }
          })
        })
      }
      return { nodes: filteredNodes, links: [...filteredLinks, ...extraLinks] }

    } else if (mode === 'associates') {
      // Show ONLY common persons (appear in both files) + source nodes
      // These are the shared associates/gang members
      const sourceNodes = graph.nodes.filter((n) => n.type === 'source')
      const commonPersons = graph.nodes.filter((n) =>
        (n.type === 'person' || n.type === 'relative') && n.common === true
      )
      const filteredNodes = [...sourceNodes, ...commonPersons]
      const allowedIds = new Set(filteredNodes.map((n) => n.id))
      // Include all links connecting these nodes
      const filteredLinks = graph.links.filter((l) => {
        const s = getNodeId(l.source), t = getNodeId(l.target)
        return allowedIds.has(s) && allowedIds.has(t)
      })
      // Add links from both sources to each common person
      const extraLinks: GraphLink[] = []
      commonPersons.forEach((p) => {
        const connectedSources = filteredLinks
          .filter((l) => getNodeId(l.target) === p.id || getNodeId(l.source) === p.id)
          .map((l) => getNodeId(l.source) === p.id ? getNodeId(l.target) : getNodeId(l.source))
          .filter((id) => id.startsWith('source:'))
        sourceNodes.forEach((src) => {
          if (!connectedSources.includes(src.id)) {
            extraLinks.push({ source: src.id, target: p.id, type: 'common_link', weight: 1 })
          }
        })
      })
      return { nodes: filteredNodes, links: [...filteredLinks, ...extraLinks] }

    } else {
      // Activity graph — only source + activity nodes
      const allowedTypes = new Set(['source', 'activity'])
      const filteredNodes = graph.nodes.filter((n) => allowedTypes.has(n.type))
      const allowedIds = new Set(filteredNodes.map((n) => n.id))
      const filteredLinks = graph.links.filter((l) => {
        const s = getNodeId(l.source), t = getNodeId(l.target)
        return allowedIds.has(s) && allowedIds.has(t)
      })
      return { nodes: filteredNodes, links: filteredLinks }
    }
  }, [graph, mode])

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D) => {
    if (!isFinite(node.x) || !isFinite(node.y)) return
    const isHovered = hoverNode?.id === node.id
    const isConnected = connectedNodeIds.has(node.id)
    const dimmed = !!(hoverNode && !isHovered && !isConnected)
    const isSource = node.type === 'source'
    const isPerson = node.type === 'person' || node.type === 'relative'
    const isActivity = node.type === 'activity'
    const isCommon = node.common === true
    const radius = isSource ? 36 : isPerson ? (isCommon ? 28 : 22) : isActivity ? (isCommon ? 18 : 14) : 16

    ctx.globalAlpha = dimmed ? 0.2 : 1

    if (isPerson) {
      const gender = guessGender(node.role || '', node.label || '')
      const hash = node.id.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0)

      // Avatar color palette
      const bgColors = gender === 'female'
        ? ['#fce7f3', '#fdf2f8', '#ffe4e6', '#fef3c7', '#f0fdf4', '#eff6ff', '#f5f3ff']
        : ['#dbeafe', '#e0f2fe', '#dcfce7', '#f0fdf4', '#eff6ff', '#f5f3ff', '#fef9c3']
      const shirtColors = gender === 'female'
        ? ['#ec4899', '#f43f5e', '#a855f7', '#8b5cf6', '#06b6d4', '#10b981', '#f97316']
        : ['#3b82f6', '#0ea5e9', '#6366f1', '#8b5cf6', '#0891b2', '#059669', '#dc2626']
      const skinColors = ['#fdbcb4', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#d4956a']
      const hairColors = gender === 'female'
        ? ['#1a1a1a', '#8B4513', '#D2691E', '#FFD700', '#C0C0C0', '#800000', '#4a3728']
        : ['#1a1a1a', '#4a3728', '#8B4513', '#C0C0C0', '#2c2c2c', '#6b4226', '#3d2b1f']

      const bgColor = bgColors[hash % bgColors.length]
      const shirtColor = shirtColors[(hash + 2) % shirtColors.length]
      const skinColor = skinColors[(hash + 1) % skinColors.length]
      const hairColor = hairColors[(hash + 3) % hairColors.length]

      // Ring: gold for common, source-color for unique
      if (isCommon) {
        ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 14
        ctx.beginPath(); ctx.arc(node.x, node.y, radius + 4, 0, 2 * Math.PI)
        ctx.fillStyle = '#f59e0b'; ctx.fill()
        ctx.beginPath(); ctx.arc(node.x, node.y, radius + 2, 0, 2 * Math.PI)
        ctx.fillStyle = '#fff'; ctx.fill()
      } else {
        const srcIdx = getSourceIdx(node.id)
        const ringColor = SOURCE_LINK_COLORS[srcIdx % SOURCE_LINK_COLORS.length].glow
        ctx.beginPath(); ctx.arc(node.x, node.y, radius + 2, 0, 2 * Math.PI)
        ctx.fillStyle = ringColor; ctx.fill()
        ctx.beginPath(); ctx.arc(node.x, node.y, radius + 0.5, 0, 2 * Math.PI)
        ctx.fillStyle = '#fff'; ctx.fill()
      }
      ctx.shadowBlur = 0

      // Clip and draw avatar
      ctx.save()
      ctx.beginPath(); ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI); ctx.clip()

      // Use loaded photo if available
      const loadedImg = nodeImages.get(node.id) || (uploadedImages.get(node.id) ? null : null)
      const uploadedUrl = uploadedImages.get(node.id)

      if (loadedImg) {
        ctx.drawImage(loadedImg, node.x - radius, node.y - radius, radius * 2, radius * 2)
      } else {
        // Draw avatar illustration
        ctx.fillStyle = bgColor; ctx.fillRect(node.x - radius, node.y - radius, radius * 2, radius * 2)
      ctx.fillStyle = shirtColor
      ctx.beginPath()
      ctx.ellipse(node.x, node.y + radius * 0.9, radius * 0.7, radius * 0.6, 0, 0, 2 * Math.PI)
      ctx.fill()

      // Neck
      ctx.fillStyle = skinColor
      ctx.beginPath()
      ctx.ellipse(node.x, node.y + radius * 0.3, radius * 0.16, radius * 0.2, 0, 0, 2 * Math.PI)
      ctx.fill()

      // Head
      ctx.fillStyle = skinColor
      ctx.beginPath()
      ctx.ellipse(node.x, node.y - radius * 0.1, radius * 0.36, radius * 0.4, 0, 0, 2 * Math.PI)
      ctx.fill()

      // Hair
      ctx.fillStyle = hairColor
      if (gender === 'female') {
        ctx.beginPath()
        ctx.ellipse(node.x, node.y - radius * 0.2, radius * 0.4, radius * 0.26, 0, Math.PI, 2 * Math.PI)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(node.x - radius * 0.33, node.y - radius * 0.02, radius * 0.1, radius * 0.3, -0.2, 0, 2 * Math.PI)
        ctx.fill()
        ctx.beginPath()
        ctx.ellipse(node.x + radius * 0.33, node.y - radius * 0.02, radius * 0.1, radius * 0.3, 0.2, 0, 2 * Math.PI)
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.ellipse(node.x, node.y - radius * 0.2, radius * 0.4, radius * 0.26, 0, Math.PI, 2 * Math.PI)
        ctx.fill()
      }

      // Eyes
      ctx.fillStyle = '#2d2d2d'
      ctx.beginPath(); ctx.arc(node.x - radius * 0.12, node.y - radius * 0.08, radius * 0.045, 0, 2 * Math.PI); ctx.fill()
      ctx.beginPath(); ctx.arc(node.x + radius * 0.12, node.y - radius * 0.08, radius * 0.045, 0, 2 * Math.PI); ctx.fill()
      } // end else (avatar drawing)

      ctx.restore()

      // Name label
      const disp = node.label.length > 14 ? node.label.slice(0, 12) + '…' : node.label
      ctx.fillStyle = isCommon ? '#92400e' : '#334155'
      ctx.font = `${isCommon ? 'bold ' : ''}${isCommon ? 11 : 10}px Sans-Serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillText(disp, node.x, node.y + radius + 4)

      // ℹ️ badge for nodes with details
      if (node.details && node.details.trim()) {
        const bx = node.x + radius * 0.7
        const by = node.y - radius * 0.7
        const br = 6
        ctx.beginPath(); ctx.arc(bx, by, br, 0, 2 * Math.PI)
        ctx.fillStyle = '#0ea5e9'; ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = `bold ${br * 1.4}px Sans-Serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('i', bx, by + 0.5)
      }

    } else if (isSource) {
      // Source node = main person of the document
      const srcIdx = getSourceIdx(node.id)
      const ringColor = SOURCE_LINK_COLORS[srcIdx % SOURCE_LINK_COLORS.length].glow
      const loadedImg = nodeImages.get(node.id)

      // Outer glow ring
      ctx.shadowColor = ringColor; ctx.shadowBlur = 16
      ctx.beginPath(); ctx.arc(node.x, node.y, radius + 5, 0, 2 * Math.PI)
      ctx.fillStyle = ringColor; ctx.fill()
      ctx.beginPath(); ctx.arc(node.x, node.y, radius + 2, 0, 2 * Math.PI)
      ctx.fillStyle = '#fff'; ctx.fill()
      ctx.shadowBlur = 0

      // Photo or avatar
      ctx.save()
      ctx.beginPath(); ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI); ctx.clip()
      if (loadedImg) {
        ctx.drawImage(loadedImg, node.x - radius, node.y - radius, radius * 2, radius * 2)
      } else {
        ctx.fillStyle = '#dbeafe'; ctx.fillRect(node.x - radius, node.y - radius, radius * 2, radius * 2)
        ctx.fillStyle = '#3b82f6'
        ctx.beginPath(); ctx.arc(node.x, node.y - radius * 0.1, radius * 0.36, 0, 2 * Math.PI); ctx.fill()
        ctx.beginPath(); ctx.ellipse(node.x, node.y + radius * 0.7, radius * 0.5, radius * 0.4, 0, 0, 2 * Math.PI); ctx.fill()
      }
      ctx.restore()

      // Name below
      const nameDisp = node.label.length > 16 ? node.label.slice(0, 14) + '…' : node.label
      ctx.fillStyle = ringColor
      ctx.font = 'bold 11px Sans-Serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillText(nameDisp, node.x, node.y + radius + 5)

    } else {
      ctx.beginPath(); ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI)
      ctx.fillStyle = ACTIVITY_TYPE_COLORS[node.activity_type || ''] || '#f59e0b'
      ctx.fill()
      const disp = node.label.length > 14 ? node.label.slice(0, 12) + '…' : node.label
      ctx.fillStyle = '#1e293b'; ctx.font = '9px Sans-Serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillText(disp, node.x, node.y + radius + 3)
    }

    ctx.globalAlpha = 1
  }, [hoverNode, connectedNodeIds, getSourceIdx, nodeImages, uploadedImages])

  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D) => {
    const s = link.source, t = link.target
    if (!s?.x || !t?.x) return
    const isRelationLink = link.type === 'relation'
    const srcNodeId = getNodeId(s).startsWith('source:') ? getNodeId(s) : getNodeId(t)
    const isHighlighted = hoverNode && (getNodeId(s) === hoverNode.id || getNodeId(t) === hoverNode.id)
    const dimmed = hoverNode && !isHighlighted

    ctx.globalAlpha = dimmed ? 0.03 : (isHighlighted ? 0.95 : 0.5)

    if (isRelationLink) {
      ctx.strokeStyle = isHighlighted ? '#16a34a' : 'rgba(34,197,94,0.5)'
      ctx.lineWidth = isHighlighted ? 2 : 1.2
      ctx.setLineDash([5, 3])
    } else {
      const col = SOURCE_LINK_COLORS[getSourceIdx(srcNodeId) % SOURCE_LINK_COLORS.length]
      ctx.strokeStyle = isHighlighted ? col.glow : col.line.replace('0.6', '0.4')
      ctx.lineWidth = isHighlighted ? 2 : 1
      ctx.setLineDash([])
    }
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(t.x, t.y); ctx.stroke()
    ctx.setLineDash([])

    // Show relation label on hover
    if (isHighlighted && isRelationLink && link.label) {
      const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2
      ctx.globalAlpha = 1
      const tw = ctx.measureText(link.label).width + 8
      ctx.fillStyle = 'rgba(0,0,0,0.75)'
      ctx.fillRect(mx - tw / 2, my - 9, tw, 16)
      ctx.fillStyle = '#22c55e'
      ctx.font = 'bold 9px Sans-Serif'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(link.label, mx, my)
    }
    ctx.globalAlpha = 1
  }, [hoverNode, getSourceIdx])

  const entityNodes = graph.nodes.filter((n) => n.type === 'person' || n.type === 'entity' || n.type === 'term')
  const relativeNodes = graph.nodes.filter((n) => n.type === 'relative')
  const activityNodes = graph.nodes.filter((n) => n.type === 'activity')
  const sourceNodes = graph.nodes.filter((n) => n.type === 'source')

  return (
    <div className="flex flex-col h-full gap-2">
      <div ref={containerRef} className="flex-1 min-h-0 rounded-lg overflow-hidden relative" style={{ background: '#ffffff' }}>
        <ForceGraph2D
          ref={graphRef}
          width={dimensions.width}
          height={dimensions.height}
          graphData={filteredGraph}
          nodeLabel={(n: any) => n.label}
          nodeCanvasObject={nodeCanvasObject}
          nodeCanvasObjectMode={() => 'replace'}
          nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
            ctx.fillStyle = color
            ctx.beginPath()
            ctx.arc(node.x, node.y, node.type === 'source' ? 40 : 26, 0, 2 * Math.PI)
            ctx.fill()
          }}
          linkCanvasObject={linkCanvasObject}
          linkCanvasObjectMode={() => 'replace'}
          onNodeHover={(n) => setHoverNode(n ? (n as GraphNode) : null)}
          onNodeClick={handleNodeClick}
          onEngineStop={() => graphRef.current?.zoomToFit(500, 60)}
          backgroundColor="#ffffff"
          cooldownTicks={150}
        />

        {/* Person detail side panel */}
        {selectedNode && (selectedNode.type === 'person' || selectedNode.type === 'relative') && (
          <div
            className="absolute top-0 right-0 bottom-0 z-20 flex flex-col bg-white border-l border-slate-100 shadow-2xl"
            style={{ width: 300 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ background: selectedNode.common ? '#f59e0b' : '#0ea5e9' }}
                >
                  {selectedNode.label.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-slate-800 text-sm leading-tight">{selectedNode.label}</p>
                  {selectedNode.role && (
                    <p className="text-xs text-slate-400 capitalize">{selectedNode.role}</p>
                  )}
                  {selectedNode.common && (
                    <span className="text-xs text-amber-600 font-medium">● Common in both files</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => { setSelectedNode(null); setContextParagraphs([]) }}
                className="text-slate-300 hover:text-slate-500 p-1"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {selectedNode.details && selectedNode.details.trim() ? (
                /* Has structured details — show info card */
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center">
                      <span className="text-sky-600 text-xs font-bold">i</span>
                    </span>
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Details</span>
                  </div>
                  {selectedNode.details.split(' | ').filter(Boolean).map((detail, i) => {
                    const colonIdx = detail.indexOf(': ')
                    if (colonIdx === -1) return (
                      <div key={i} className="bg-slate-50 rounded-lg px-3 py-2">
                        <p className="text-xs text-slate-600">{detail}</p>
                      </div>
                    )
                    const key = detail.slice(0, colonIdx)
                    const val = detail.slice(colonIdx + 2)
                    return (
                      <div key={i} className="bg-slate-50 rounded-lg px-3 py-2">
                        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide leading-tight">{key}</p>
                        <p className="text-sm text-slate-800 font-semibold leading-snug mt-0.5">{val}</p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                /* No details — show source text paragraphs */
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Mentioned in source</span>
                  </div>
                  {loadingContext ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : contextParagraphs.length > 0 ? (
                    contextParagraphs.map((para, i) => (
                      <div key={i} className="bg-slate-50 rounded-lg px-3 py-2 border-l-2 border-sky-300">
                        <p className="text-xs text-slate-700 leading-relaxed">{para}</p>
                      </div>
                    ))
                  ) : (
                    <div className="bg-slate-50 rounded-lg px-3 py-4 text-center">
                      <p className="text-xs text-slate-400">No context found in source text.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Photo upload */}
            <div className="flex-shrink-0 px-4 py-3 border-t border-slate-100">
              <button
                className="text-xs text-sky-500 hover:text-sky-700 flex items-center gap-1.5"
                onClick={() => fileInputRef.current?.click()}
              >
                📷 {uploadedImages.get(selectedNode.id) ? 'Change photo' : 'Add photo'}
              </button>
            </div>
          </div>
        )}

        {/* Hidden file input for photo upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file && selectedNode) handleUploadImage(selectedNode.id, file)
            e.target.value = ''
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 px-1 text-xs flex-shrink-0">
        <div className="flex flex-wrap gap-3">
          {sourceNodes.map((n, i) => (
            <span key={n.id} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{ background: SOURCE_LINK_COLORS[i % SOURCE_LINK_COLORS.length].glow }} />
              {n.label.length > 24 ? n.label.slice(0, 22) + '…' : n.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-sky-400" />
            Persons ({entityNodes.filter((n: any) => n.common).length} common / {entityNodes.filter((n: any) => !n.common).length} unique)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-amber-400" />
            Activities ({activityNodes.filter((n: any) => n.common).length} common)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedNode && selectedNode.type !== 'person' && (
            <span className="rounded border border-slate-600 bg-slate-800 text-white px-2 py-0.5 font-medium text-xs">{selectedNode.label}</span>
          )}
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => graphRef.current?.zoomToFit(400, 60)}>Fit</Button>
        </div>
      </div>
    </div>
  )
}

interface CommonGraphModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sourceIds: string[]
}

export function CommonGraphModal({ open, onOpenChange, sourceIds }: CommonGraphModalProps) {
  const [selectedModelId, setSelectedModelId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [isBuilding, setIsBuilding] = useState(false)
  const [buildResult, setBuildResult] = useState<CommonGraphResponse | null>(null)
  const [buildError, setBuildError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [savedTransformationId, setSavedTransformationId] = useState<string | null>(null)
  const [graphMode, setGraphMode] = useState<'persons' | 'activities' | 'associates'>('persons')

  const { data: models = [] } = useModels()
  const { data: defaults } = useModelDefaults()
  const updateDefaults = useUpdateModelDefaults()
  const { data: transformations = [] } = useTransformations()
  const createTransformation = useCreateTransformation()
  const updateTransformation = useUpdateTransformation()

  const languageModels = useMemo(() => models.filter((m) => m.type === 'language'), [models])

  // Load saved model from defaults
  useEffect(() => {
    if (!selectedModelId && defaults?.default_transformation_model) {
      setSelectedModelId(defaults.default_transformation_model)
    } else if (!selectedModelId && languageModels.length > 0) {
      setSelectedModelId(languageModels[0].id)
    }
  }, [defaults, languageModels, selectedModelId])

  // Load saved prompt from transformations
  useEffect(() => {
    const existing = transformations.find((t) => t.name === COMMON_GRAPH_TRANSFORMATION_NAME)
    if (existing) {
      setPrompt(existing.prompt)
      setSavedTransformationId(existing.id)
    }
    // If no saved transformation, prompt stays empty — NLP handles extraction
  }, [transformations])

  // Auto-load saved graph OR build when modal opens
  useEffect(() => {
    if (!open || sourceIds.length < 2) return
    if (buildResult) return  // already have data

    // Try to load previously saved graph from localStorage
    const cacheKey = `common_graph_id_${[...sourceIds].sort().join('_')}`
    const savedId = localStorage.getItem(cacheKey)

    if (savedId) {
      sourcesApi.getCommonGraph(savedId)
        .then((result) => {
          const meta = result?.metadata as any
          if (result?.metadata && meta?.graph?.nodes?.length > 0) {
            setBuildResult(result)
          } else {
            localStorage.removeItem(cacheKey)
            handleBuild()
          }
        })
        .catch(() => {
          localStorage.removeItem(cacheKey)
          handleBuild()
        })
    } else {
      handleBuild()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedModelId])

  // Load images for main persons from each source
  useEffect(() => {
    if (!buildResult || !graphData) return
    // Find main person nodes and load their images
    const mainPersons = graphData.nodes.filter((n: any) => n.type === 'person' && n.role === 'main')
    mainPersons.forEach((p: any) => {
      // Find which source this person belongs to
      const link = graphData.links.find((l: any) => {
        const s = typeof l.source === 'string' ? l.source : l.source.id
        const t = typeof l.target === 'string' ? l.target : l.target.id
        return (t === p.id && s.startsWith('source:')) || (s === p.id && t.startsWith('source:'))
      })
      if (link) {
        const srcId = (typeof link.source === 'string' ? link.source : link.source.id).startsWith('source:')
          ? (typeof link.source === 'string' ? link.source : link.source.id)
          : (typeof link.target === 'string' ? link.target : link.target.id)
        const srcIdx = parseInt(srcId.replace('source:', ''))
        if (srcIdx >= 0 && srcIdx < sourceIds.length) {
          const sourceId = sourceIds[srcIdx]
          sourcesApi.getProfileImage(sourceId).then((url) => {
            if (url) {
              // Store image for this person node
              const store = new Map<string, string>()
              store.set(p.id, url)
              // Trigger re-render somehow
            }
          })
        }
      }
    })
  }, [buildResult, sourceIds])

  // Reset when closed
  useEffect(() => {
    if (!open) {
      setBuildResult(null)
      setBuildError(null)
      setShowSettings(false)
    }
  }, [open])

  const graphData = useMemo((): GraphData | undefined => {
    const raw = buildResult?.metadata as any
    return raw?.graph ? (raw.graph as GraphData) : undefined
  }, [buildResult])

  const graphHasContent = Boolean(graphData?.nodes?.length && graphData?.links?.length)
  const entityCount = useMemo(() => graphData?.nodes?.filter((n) => n.type === 'person' || n.type === 'entity' || n.type === 'term').length ?? 0, [graphData])
  const commonCount = useMemo(() => graphData?.nodes?.filter((n: any) => n.common).length ?? 0, [graphData])
  const relativeCount = useMemo(() => graphData?.nodes?.filter((n: any) => n.type === 'relative').length ?? 0, [graphData])
  const activityCount = useMemo(() => graphData?.nodes?.filter((n: any) => n.type === 'activity').length ?? 0, [graphData])

  const handleBuild = async () => {
    if (isBuilding || sourceIds.length < 2 || !selectedModelId) return
    setBuildError(null)
    setIsBuilding(true)
    setShowSettings(false)
    try {
      const result = await sourcesApi.createCommonGraph({
        source_ids: sourceIds,
        model_id: selectedModelId,
        // prompt not sent — backend uses NLP for extraction
      })
      const saved = result.id ? await sourcesApi.getCommonGraph(result.id) : result
      setBuildResult(saved)
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'Failed to build graph.'
      setBuildError(detail)
    } finally {
      setIsBuilding(false)
    }
  }

  const handleSaveSettings = async () => {
    // Save model as default transformation model
    if (selectedModelId && selectedModelId !== defaults?.default_transformation_model) {
      await updateDefaults.mutateAsync({ default_transformation_model: selectedModelId })
    }

    // Save prompt to transformations (for reference/future use)
    if (prompt.trim()) {
      try {
        if (savedTransformationId) {
          await updateTransformation.mutateAsync({
            id: savedTransformationId,
            data: { prompt, name: COMMON_GRAPH_TRANSFORMATION_NAME, title: 'Common Graph Extraction' }
          })
        } else {
          const created = await createTransformation.mutateAsync({
            name: COMMON_GRAPH_TRANSFORMATION_NAME,
            title: 'Common Graph Extraction',
            description: 'Reference prompt for common graph entity extraction (NLP handles actual extraction)',
            prompt,
            apply_default: false,
          })
          setSavedTransformationId(created.id)
        }
        toast.success('Settings saved')
      } catch {
        toast.error('Failed to save settings')
      }
    }

    handleBuild()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col overflow-hidden p-0"
        style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          width: '100vw', height: '100vh',
          maxWidth: '100vw', maxHeight: '100vh',
          margin: 0, borderRadius: 0,
          transform: 'none', translate: 'none',
        }}
      >
        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-6 pt-4 pb-3 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <DialogTitle>Common graph</DialogTitle>
            <Badge variant="secondary">{sourceIds.length} sources</Badge>
            {graphHasContent && (
              <>
                <Badge variant="outline" className="text-sky-500 border-sky-400">{entityCount} persons</Badge>
                <Badge variant="outline" className="text-amber-500 border-amber-400">{activityCount} activities</Badge>
                <Badge variant="outline" className="text-green-600 border-green-400">{commonCount} common</Badge>
                {relativeCount > 0 && <Badge variant="outline" className="text-emerald-500 border-emerald-400">{relativeCount} relatives</Badge>}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={() => setShowSettings((v) => !v)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              {showSettings ? 'Hide settings' : 'Settings'}
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5"
              disabled={isBuilding || !selectedModelId}
              onClick={handleBuild}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isBuilding ? 'animate-spin' : ''}`} />
              {isBuilding ? 'Building…' : 'Rebuild'}
            </Button>
          </div>
        </DialogHeader>

        {/* Main content */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* Graph area */}
          <div className="flex-1 min-w-0 p-3 flex flex-col">
            {isBuilding ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ background: '#0a0f1e', borderRadius: 8 }}>
                <RefreshCw className="h-8 w-8 animate-spin text-purple-400" />
                <p className="text-slate-400 text-sm">Analyzing documents and extracting entities…</p>
              </div>
            ) : buildError ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive max-w-md text-center">
                  {buildError}
                  <Button size="sm" variant="outline" className="mt-3 w-full" onClick={handleBuild}>Retry</Button>
                </div>
              </div>
            ) : graphHasContent ? (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Person / Activity toggle */}
                <div className="flex gap-2 mb-2 flex-shrink-0">
                  <button
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${graphMode === 'persons' ? 'bg-sky-500 text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    onClick={() => setGraphMode('persons')}
                  >
                    👤 All Persons
                  </button>
                  <button
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${graphMode === 'associates' ? 'bg-amber-500 text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    onClick={() => setGraphMode('associates')}
                  >
                    🔗 Common Associates
                  </button>
                  <button
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${graphMode === 'activities' ? 'bg-red-500 text-white shadow' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    onClick={() => setGraphMode('activities')}
                  >
                    ⚡ Activities
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  <NetworkGraphViewer graph={graphData as GraphData} mode={graphMode} sourceIds={sourceIds} /></div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center" style={{ background: '#0a0f1e', borderRadius: 8 }}>
                <p className="text-slate-500 text-sm">Select at least 2 sources and click Rebuild.</p>
              </div>
            )}
          </div>

          {/* Settings panel — slides in from right */}
          {showSettings && (
            <div className="w-96 flex-shrink-0 border-l flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-5">

                {/* Model selector */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Model</Label>
                  <p className="text-xs text-muted-foreground">Language model used for entity extraction.</p>
                  <Select value={selectedModelId} onValueChange={setSelectedModelId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a language model…" />
                    </SelectTrigger>
                    <SelectContent>
                      {languageModels.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <div className="flex items-center justify-between w-full gap-3">
                            <span>{m.name}</span>
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{m.provider}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Transformation picker */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Extraction Prompt</Label>
                  <p className="text-xs text-muted-foreground">Pick a transformation or use the default common graph prompt.</p>
                  <Select
                    value={savedTransformationId || '__none__'}
                    onValueChange={(val) => {
                      if (val === '__none__') {
                        setPrompt('')
                        setSavedTransformationId(null)
                      } else {
                        const t = transformations.find((t) => t.id === val)
                        if (t) { setPrompt(t.prompt); setSavedTransformationId(t.id) }
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a transformation…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">None (NLP only)</span>
                      </SelectItem>
                      {transformations.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          <div className="flex flex-col">
                            <span>{t.title || t.name}</span>
                            {t.description && <span className="text-xs text-muted-foreground">{t.description}</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Prompt preview / edit */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Prompt (saved to Transformations)</Label>
                  <p className="text-xs text-muted-foreground">
                    This prompt is saved as a transformation for reference. Person name extraction uses NLP (spaCy) for accuracy — not the LLM.
                  </p>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={14}
                    className="font-mono text-xs"
                    placeholder="Optional: add notes or instructions here. Actual extraction uses NLP."
                  />
                </div>
              </div>

              <div className="flex-shrink-0 p-4 border-t">
                <Button className="w-full" onClick={handleSaveSettings} disabled={isBuilding}>
                  Save & Rebuild
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
