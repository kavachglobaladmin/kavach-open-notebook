'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { User, MapPin, Briefcase, Phone, Calendar } from 'lucide-react'
import { motion } from 'framer-motion'

interface FamilyMember {
  name: string
  relation: string
  gender: string
  details?: string
}

interface FamilyGraphProps {
  data: FamilyMember[]
  mainPerson: string
}

export function FamilyGraph({ data, mainPerson }: FamilyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 1200, h: 800 })

  // Transform & Pan State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false)
  
  // Node Dragging State
  const [manualPositions, setManualPositions] = useState<Record<string, { x: number, y: number }>>({})
  const [draggedNode, setDraggedNode] = useState<{ id: string, startX: number, startY: number, initialNodeX: number, initialNodeY: number } | null>(null)
  const dragStart = useRef({ x: 0, y: 0 })

  // Handle Resize
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver((e) => {
      const r = e[0].contentRect
      setSize({ w: Math.max(800, Math.round(r.width)), h: Math.max(600, Math.round(r.height)) })
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Handle Zoom (Wheel Event)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const zoomSensitivity = 0.0015
      const delta = -e.deltaY * zoomSensitivity
      setTransform((prev) => ({
        ...prev,
        scale: Math.min(Math.max(0.2, prev.scale + delta), 3)
      }))
    }

    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [])

  // === Mouse Event Handlers ===
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.interactive-node') || (e.target as HTMLElement).closest('.ui-controls')) return
    setIsDraggingCanvas(true)
    dragStart.current = { x: e.clientX - transform.x, y: e.clientY - transform.y }
  }

  const handleNodeMouseDown = (e: React.MouseEvent, id: string, currentX: number, currentY: number) => {
    e.stopPropagation()
    setDraggedNode({
      id,
      startX: e.clientX,
      startY: e.clientY,
      initialNodeX: currentX,
      initialNodeY: currentY
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedNode) {
      const dx = (e.clientX - draggedNode.startX) / transform.scale
      const dy = (e.clientY - draggedNode.startY) / transform.scale
      setManualPositions(prev => ({
        ...prev,
        [draggedNode.id]: {
          x: draggedNode.initialNodeX + dx,
          y: draggedNode.initialNodeY + dy
        }
      }))
    } else if (isDraggingCanvas) {
      setTransform((prev) => ({
        ...prev,
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      }))
    }
  }

  const handleMouseUp = () => {
    setIsDraggingCanvas(false)
    setDraggedNode(null)
  }

  const { w, h } = size
  const cx = w / 2
  const cy = h / 2

  // === HIERARCHICAL TREE LAYOUT ALGORITHM ===
  const layoutNodes = useMemo(() => {
    const nodes: any[] = []

    // 1. Central Target Node
    nodes.push({
      id: 'target_center',
      type: 'target',
      name: mainPerson || 'Target Profile',
      relation: 'target',
      gender: 'male', 
      x: cx,
      y: cy,
      details: []
    })

    // 2. Group family members by generation
    const parents = data.filter(d => ['father', 'mother'].includes(d.relation.toLowerCase()))
    const siblings = data.filter(d => ['brother', 'sister'].includes(d.relation.toLowerCase()))
    const spouses = data.filter(d => ['wife', 'husband', 'spouse'].includes(d.relation.toLowerCase()))
    const children = data.filter(d => ['son', 'daughter'].includes(d.relation.toLowerCase()))
    const others = data.filter(d => !['father', 'mother', 'brother', 'sister', 'wife', 'husband', 'spouse', 'son', 'daughter'].includes(d.relation.toLowerCase()))

    const cardSpacingX = 350 // generous horizontal spacing
    const cardSpacingY = 220 // distinct vertical spacing for side nodes to prevent line overlap
    const levelSpacingY = 280

    // Horizontal Array Distribution (for generations: Parents, Children)
    const distributeHorizontal = (group: FamilyMember[], centerY: number, attachDirection: 'up' | 'down', offsetX = 0) => {
      const totalWidth = (group.length - 1) * cardSpacingX
      const startX = cx - (totalWidth / 2) + offsetX

      group.forEach((member, index) => {
        const parsedDetails = member.details ? member.details.split('|').map(s => s.trim()).filter(Boolean) : []
        nodes.push({
          id: `node_${member.relation}_${index}`,
          type: 'relative',
          name: member.name,
          relation: member.relation,
          gender: member.gender.toLowerCase(),
          details: parsedDetails,
          x: startX + (index * cardSpacingX),
          y: centerY,
          connectToTarget: attachDirection
        })
      })
    }

    // Vertical Array Distribution (for side nodes: Siblings, Spouses - stacks them cleanly to share a routing trunk)
    const distributeVertical = (group: FamilyMember[], centerX: number, attachDirection: 'side', offsetX = 0) => {
      const totalHeight = (group.length - 1) * cardSpacingY
      const startY = cy - (totalHeight / 2)

      group.forEach((member, index) => {
        const parsedDetails = member.details ? member.details.split('|').map(s => s.trim()).filter(Boolean) : []
        nodes.push({
          id: `node_${member.relation}_${index}`,
          type: 'relative',
          name: member.name,
          relation: member.relation,
          gender: member.gender.toLowerCase(),
          details: parsedDetails,
          x: centerX + offsetX,
          y: startY + (index * cardSpacingY),
          connectToTarget: attachDirection
        })
      })
    }

    // Process Generations into exact tiers
    if (parents.length > 0) distributeHorizontal(parents, cy - levelSpacingY, 'up')
    if (children.length > 0) distributeHorizontal(children, cy + levelSpacingY, 'down')
    if (others.length > 0) distributeHorizontal(others, cy + (levelSpacingY * 1.5), 'down')

    // Spouses & Siblings vertically stacked on sides
    if (spouses.length > 0) distributeVertical(spouses, cx, 'side', cardSpacingX * 1.3)
    if (siblings.length > 0) distributeVertical(siblings, cx, 'side', -(cardSpacingX * 1.3))
    
    return nodes
  }, [data, cx, cy, mainPerson])

  // Apply Manual Overrides
  const finalNodes = layoutNodes.map(node => {
    const manualPos = manualPositions[node.id]
    return {
      ...node,
      x: manualPos ? manualPos.x : node.x,
      y: manualPos ? manualPos.y : node.y
    }
  })

  // --- UI Design Helpers ---
  const getDetailIcon = (text: string) => {
    const l = text.toLowerCase()
    if (l.includes('age') || l.includes('dob') || l.includes('year') || l.includes('yrs')) return <Calendar className="w-3.5 h-3.5" />
    if (l.includes('occup') || l.includes('labour') || l.includes('student') || l.includes('maker') || l.includes('work')) return <Briefcase className="w-3.5 h-3.5" />
    if (l.includes('contact') || l.includes('phone') || l.includes('mob')) return <Phone className="w-3.5 h-3.5" />
    return <MapPin className="w-3.5 h-3.5" />
  }

  const getGenderStyles = (gender: string) => {
    if (gender === 'female') {
      return {
        bg: 'bg-rose-50/30',
        border: 'border-rose-200',
        header: 'bg-gradient-to-r from-rose-100 to-rose-50 border-rose-100',
        iconBg: 'bg-rose-200 text-rose-700 border-rose-300',
        badge: 'bg-rose-100 text-rose-800 border-rose-200',
        line: '#fca5a5'
      }
    }
    return {
      bg: 'bg-slate-50/30',
      border: 'border-slate-200',
      header: 'bg-gradient-to-r from-slate-100 to-slate-50 border-slate-100',
      iconBg: 'bg-slate-200 text-slate-700 border-slate-300',
      badge: 'bg-white text-slate-700 border-slate-300 shadow-sm',
      line: '#cbd5e1'
    }
  }

  // --- Orthogonal Engine ---
  const generateOrthogonalPath = (startX: number, startY: number, endX: number, endY: number, direction: string) => {
    const midY = startY + (endY - startY) / 2
    if (direction === 'up' || direction === 'down') {
      return `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`
    } else {
      const midX = startX + (endX - startX) / 2
      return `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-screen overflow-hidden select-none font-sans bg-[#f4f7fb] ${isDraggingCanvas ? 'cursor-grabbing' : 'cursor-grab'}`}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* HUD Instructions */}
      <div className="absolute bottom-5 left-5 z-50 ui-controls bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl shadow-sm border border-slate-200 text-xs text-slate-600 font-medium pointer-events-none">
        Zoom: {Math.round(transform.scale * 100)}% • Scroll to zoom • Drag canvas to pan • Drag cards to arrange
      </div>

      {/* Pannable Canvas Area */}
      <div 
        className="absolute inset-0 origin-center"
        style={{
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transition: isDraggingCanvas || draggedNode ? 'none' : 'transform 0.1s ease-out'
        }}
      >
        {/* SVG Orthogonal Connection Lines */}
        <svg
          className="absolute inset-0 pointer-events-none overflow-visible"
          width={w}
          height={h}
          style={{ zIndex: 0 }}
        >
          {finalNodes.map((node) => {
            if (node.type === 'target') return null
            
            const isDraggingThis = draggedNode?.id === node.id
            const styles = getGenderStyles(node.gender)
            const strokeColor = isDraggingThis ? '#3b82f6' : styles.line
            
            const targetNode = finalNodes.find(n => n.type === 'target') || { x: cx, y: cy }
            
            // Connection calculations to attach to card borders instead of centers
            let startX = targetNode.x
            let startY = targetNode.y
            let endX = node.x
            let endY = node.y
            
            if (node.connectToTarget === 'up') {
              startY = targetNode.y - 45
              endY = node.y + 70
            } else if (node.connectToTarget === 'down') {
              startY = targetNode.y + 45
              endY = node.y - 70
            } else {
              // Side connections
              startX = node.x > targetNode.x ? targetNode.x + 80 : targetNode.x - 80
              endX = node.x > targetNode.x ? node.x - 145 : node.x + 145
            }

            return (
              <g key={`line-${node.id}`}>
                <path
                  d={generateOrthogonalPath(startX, startY, endX, endY, node.connectToTarget)}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isDraggingThis ? "2.5" : "1.5"}
                  strokeLinejoin="round"
                />
                <circle cx={startX} cy={startY} r={4} fill={strokeColor} />
                <circle cx={endX} cy={endY} r={4} fill="#ffffff" stroke={strokeColor} strokeWidth={2} />
              </g>
            )
          })}
        </svg>

        {/* Render Nodes */}
        {finalNodes.map((node) => {
          const isDraggingThis = draggedNode?.id === node.id

          // 1. Render Target Center Node
          if (node.type === 'target') {
            return (
              <div
                key={node.id}
                className={`absolute interactive-node flex flex-col items-center ${isDraggingThis ? 'cursor-grabbing' : 'cursor-grab'}`}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id, node.x, node.y)}
                style={{
                  left: node.x,
                  top: node.y,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isDraggingThis ? 40 : 30,
                }}
              >
                {/* NEW: Explicitly centered relative wrapper for the glowing rings and the inner icon */}
                <div className="relative flex items-center justify-center w-20 h-20">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 pointer-events-none animate-pulse" style={{ width: 120, height: 120 }} />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.4)] pointer-events-none" style={{ width: 92, height: 92 }} />
                  
                  <div className="relative w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center border-[3px] border-white shadow-xl z-10">
                    <User className="w-8 h-8 text-white" />
                  </div>
                </div>
                
                <div className="mt-6 bg-white rounded-xl shadow-lg border border-slate-200 px-5 py-2.5 flex flex-col items-center z-10 whitespace-nowrap">
                  <span className="text-[10px] font-bold text-blue-600 tracking-widest uppercase mb-0.5">Primary Target</span>
                  <span className="text-[15px] font-black text-slate-900 tracking-tight">{node.name}</span>
                </div>
              </div>
            )
          }

          // 2. Render Relative Data Storytelling Cards
          const styles = getGenderStyles(node.gender)
          
          return (
            <div
              key={node.id}
              className={`absolute interactive-node ${isDraggingThis ? 'cursor-grabbing' : 'cursor-grab'}`}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id, node.x, node.y)}
              style={{
                left: node.x,
                top: node.y,
                transform: 'translate(-50%, -50%)',
                zIndex: isDraggingThis ? 30 : 10,
              }}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`w-[290px] rounded-[16px] shadow-md border ${isDraggingThis ? 'border-blue-400 shadow-xl scale-105' : styles.border} ${styles.bg} overflow-hidden flex flex-col transition-all backdrop-blur-sm`}
              >
                {/* Header Profile Section */}
                <div className={`p-4 ${styles.header} flex items-center gap-3 border-b pointer-events-none`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border shadow-sm ${styles.iconBg}`}>
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col overflow-hidden">
                    <span className="text-[15px] font-bold text-slate-900 truncate">{node.name}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-md w-fit mt-1 border ${styles.badge}`}>
                      {node.relation}
                    </span>
                  </div>
                </div>

                {/* Body Details Section (Parsed automatically) */}
                <div className="p-4 flex flex-col gap-2.5 min-h-[80px] pointer-events-none">
                  {node.details.length === 0 && (
                    <span className="text-xs text-slate-400 font-medium italic text-center py-2">No further intelligence recorded.</span>
                  )}
                  {node.details.map((detail: string, i: number) => {
                    let keyPart = ''
                    let valPart = detail
                    const splitIndex = detail.indexOf(':')
                    
                    if (splitIndex !== -1) {
                      keyPart = detail.substring(0, splitIndex).trim()
                      valPart = detail.substring(splitIndex + 1).trim()
                    }
                    
                    return (
                      <div key={i} className="flex items-start gap-2.5 text-[12.5px] bg-white p-2.5 rounded-lg border border-slate-100 shadow-sm">
                        <div className={`mt-0.5 shrink-0 ${node.gender === 'female' ? 'text-rose-400' : 'text-slate-400'}`}>
                          {getDetailIcon(detail)}
                        </div>
                        <span className="text-slate-700 font-medium leading-snug">
                          {keyPart ? (
                            <>
                              <span className="font-bold text-slate-900">{keyPart}:</span> {valPart}
                            </>
                          ) : (
                            detail
                          )}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            </div>
          )
        })}
      </div>
    </div>
  )
}