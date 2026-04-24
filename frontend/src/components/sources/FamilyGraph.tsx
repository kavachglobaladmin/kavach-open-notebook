'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { User } from 'lucide-react'

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

const memberImageStore = new Map<string, string>()
export { memberImageStore }

const CENTER_R  = 72   // center circle radius
const MEMBER_R  = 48   // satellite circle radius
const DETAIL_W  = 260  // detail popup width

export function FamilyGraph({ data, mainPerson }: FamilyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize]           = useState({ w: 1000, h: 700 })
  const [scale, setScale]         = useState(0.85) 
  const [pan, setPan]             = useState({ x: 0, y: 0 })
  const [dragging, setDragging]   = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const drag0 = useRef({ x: 0, y: 0 })

  // Resize observer
  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect
      setSize({ w: Math.max(800, r.width), h: Math.max(600, r.height) })
    })
    ro.observe(el); return () => ro.disconnect()
  }, [])

  // Dynamic initial zoom based on family size to ensure it fits on screen
  useEffect(() => {
    if (data.length > 10) setScale(0.55)
    else if (data.length > 6) setScale(0.7)
    else setScale(0.85)
  }, [data.length])

  // Wheel zoom
  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const fn = (e: WheelEvent) => {
      e.preventDefault()
      setScale(s => Math.min(2.5, Math.max(0.15, s - e.deltaY * 0.001)))
    }
    el.addEventListener('wheel', fn, { passive: false })
    return () => el.removeEventListener('wheel', fn)
  }, [])

  const onDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.np')) return
    setDragging(true)
    drag0.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }
  const onMove = (e: React.MouseEvent) => {
    if (!dragging) return
    setPan({ x: e.clientX - drag0.current.x, y: e.clientY - drag0.current.y })
  }
  const onUp = () => setDragging(false)

  const toggleSelected = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const cx = size.w / 2
  const cy = size.h / 2

  // ── Deduplicate members ───────────────────────────────────────────────────
  const members = useMemo(() => {
    const seen = new Set<string>()
    return data.filter(m => {
      const key = `${m.name.toLowerCase().trim()}|${m.relation.toLowerCase().trim()}`
      if (seen.has(key)) return false
      seen.add(key)
      return m.name && m.name.trim().length > 0
    })
  }, [data])

  // ── Radial Layout Engine ──────────────────────────────────────────────────
  // Calculate orbit radius based on member count (Increased for better spacing)
  const ORBIT = useMemo(() => {
    const minCircumference = members.length * 320; // Increased spacing
    return Math.max(420, minCircumference / (2 * Math.PI)); // Increased min radius
  }, [members.length])

  const nodes = useMemo(() => {
    const n = members.length
    if (n === 0) return []
    
    // SMART ANGLE OFFSET: 
    // Shift starting angle for even node counts (like 4) to form a diagonal "X" cross
    // Instead of a strict horizontal/vertical "+" layout.
    const startAngle = n % 2 === 0 ? -Math.PI / 2 + (Math.PI / n) : -Math.PI / 2;

    return members.map((m, i) => {
      const angle = startAngle + (i / n) * 2 * Math.PI
      return {
        ...m,
        id: `${m.relation}_${i}`,
        angle,
        x: cx + ORBIT * Math.cos(angle),
        y: cy + ORBIT * Math.sin(angle),
        details: m.details
          ? m.details.split('|').map(s => s.trim()).filter(Boolean)
          : [],
      }
    })
  }, [members, cx, cy, ORBIT])

  // Soft modern gender rings
  const ringColor = (gender: string) =>
    gender?.toLowerCase() === 'female' ? '#fda4af' : '#93c5fd'

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-[#f4f7fb] to-[#f8fbff] select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      onClick={() => setSelected(new Set())}
    >
      {/* HUD Hint */}
      <div className="absolute bottom-4 left-4 z-50 pointer-events-none text-[12px] font-medium text-slate-500 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-200/60 shadow-sm">
        {Math.round(scale * 100)}% • Scroll to zoom • Drag to pan • Hover for glowing effects
      </div>

      {/* ── Zoomable Canvas ── */}
      <div
        className="absolute inset-0 transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`,
          transformOrigin: `${cx}px ${cy}px`,
        }}
      >
        {/* ── SVG Connections ── */}
        <svg
          className="absolute inset-0 overflow-visible pointer-events-none"
          style={{ width: size.w, height: size.h }}
        >
          {nodes.map(node => {
            const angle = node.angle
            const x1 = cx + (CENTER_R + 8) * Math.cos(angle)
            const y1 = cy + (CENTER_R + 8) * Math.sin(angle)
            const x2 = node.x - (MEMBER_R + 8) * Math.cos(angle)
            const y2 = node.y - (MEMBER_R + 8) * Math.sin(angle)

            // Push the label slightly closer to the outer satellite node
            const lx = x1 + (x2 - x1) * 0.65
            const ly = y1 + (y2 - y1) * 0.65

            return (
              <g key={node.id}>
                {/* Connector Line */}
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="#a5b4fc" strokeWidth={1.5} opacity={0.5}
                  strokeLinecap="round"
                />

                {/* Dot Anchors */}
                <circle cx={x1} cy={y1} r={3.5} fill="#fff" stroke="#a5b4fc" strokeWidth={1.5} />
                <circle cx={x2} cy={y2} r={3.5} fill="#fff" stroke="#a5b4fc" strokeWidth={1.5} />

                {/* Relation text resting cleanly on the line with cutout */}
                <text
                  x={lx} y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={13}
                  fontWeight={600}
                  fill="#475569"
                  stroke="#f8fbff" 
                  strokeWidth={12} 
                  paintOrder="stroke"
                  style={{ userSelect: 'none' }}
                >
                  {node.relation}
                </text>
              </g>
            )
          })}
        </svg>

        {/* ── Center Node ── */}
        <div
          className="absolute np group"
          style={{ left: cx - CENTER_R, top: cy - CENTER_R, width: CENTER_R * 2, height: CENTER_R * 2, zIndex: 20 }}
        >
          {/* Neon Glow Effects */}
          <div className="absolute inset-[-24px] rounded-full bg-blue-500/20 blur-[18px] opacity-100 group-hover:opacity-100 group-hover:bg-blue-400/35 transition-all duration-300 pointer-events-none" />
          <div className="absolute inset-[-8px] rounded-full bg-gradient-to-b from-blue-400 to-blue-600 shadow-[0_0_25px_10px_rgba(59,130,246,0.3)] pointer-events-none group-hover:shadow-[0_0_35px_15px_rgba(59,130,246,0.4)] transition-shadow duration-300" />
          <div className="absolute inset-[-3px] rounded-full bg-white pointer-events-none" />
          
          <div className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-slate-100 z-10 border-4 border-white shadow-lg">
            <User className="w-[55%] h-[55%] text-slate-300" />
          </div>
          
          <div className="absolute top-full mt-4 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none flex flex-col items-center gap-1.5 z-30">
            <span className="text-[22px] font-extrabold text-slate-800 tracking-tight">{mainPerson || 'Subject'}</span>
            <span className="text-[12px] font-bold text-slate-500 bg-white/95 backdrop-blur-md px-3.5 py-1 rounded-full shadow-sm border border-slate-200">
              - {mainPerson || 'Subject'}
            </span>
          </div>
        </div>

        {/* ── Satellite Nodes & Detail Cards ── */}
        {nodes.map(node => {
          const rc = ringColor(node.gender)

          // ── SMART 8-WAY OUTWARD POSITIONING ──
          // Radially pushes cards outward based on their angle to naturally
          // fan them out and completely avoid bounding box overlap.
          const cos = Math.cos(node.angle);
          const sin = Math.sin(node.angle);
          const OFFSET = 35; // Generous gap between node and card
          
          let cardStyle: React.CSSProperties = { width: DETAIL_W };

          // Calculate strict radial anchor point
          const anchorX = node.x + (MEMBER_R + OFFSET) * cos;
          const anchorY = node.y + (MEMBER_R + OFFSET) * sin;

          let xTrans = "-50%";
          let yTrans = "-50%";

          // Small threshold forces adjacent bottom/top nodes to fan left/right
          if (cos > 0.2) xTrans = "0%";
          else if (cos < -0.2) xTrans = "-100%";

          if (sin > 0.2) yTrans = "0%";
          else if (sin < -0.2) yTrans = "-100%";

          cardStyle = {
            ...cardStyle,
            left: anchorX,
            top: anchorY,
            transform: `translate(${xTrans}, ${yTrans})`
          };

          return (
            <div key={node.id}>
              {/* Satellite Icon Container */}
              <div
                className="absolute np group"
                style={{ left: node.x - MEMBER_R, top: node.y - MEMBER_R, width: MEMBER_R * 2, height: MEMBER_R * 2, zIndex: 15 }}
                onClick={e => { e.stopPropagation(); toggleSelected(node.id) }}
              >
                <div
                  className="absolute inset-[-8px] rounded-full blur-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{ background: rc }}
                />
                <div
                  className="absolute inset-[-4px] rounded-full pointer-events-none"
                  style={{ background: rc, opacity: 0.4 }}
                />
                <div
                  className="absolute inset-[-2px] rounded-full pointer-events-none border-[3px] border-white"
                  style={{ border: `2.5px solid ${rc}` }}
                />
                <div className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-slate-50 cursor-pointer shadow-md z-10 border-4 border-white transition-all group-hover:scale-[1.03]">
                  <User className="w-[50%] h-[50%] text-slate-300" />
                </div>
                
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none whitespace-nowrap bg-white/70 backdrop-blur-sm px-2 py-0.5 rounded-md group-hover:scale-105 transition-transform z-20">
                  <span className="text-[14px] font-bold text-slate-800 leading-tight">{node.name}</span>
                  <span className="text-[12px] text-slate-500 capitalize font-semibold">{node.relation}</span>
                </div>
              </div>

              {/* Information Popup Card - Using the calculated 8-way style */}
              {node.details.length > 0 && (
                <div
                  className="absolute np bg-white/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200/80 p-5 z-40 transition-all hover:shadow-[0_12px_40px_rgba(59,130,246,0.12)] hover:border-blue-200"
                  style={cardStyle}
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex justify-between items-baseline mb-2.5">
                      <p className="text-[16px] font-extrabold text-slate-900 leading-tight truncate mr-2">{node.name}</p>
                      <p className="text-[11px] text-slate-400 capitalize font-bold shrink-0">{node.relation}</p>
                  </div>
                  
                  <div className="h-px bg-slate-100 mb-3" />
                  
                  <div className="space-y-2">
                    {node.details.map((d: string, i: number) => {
                      const sep = d.indexOf(':')
                      const key = sep !== -1 ? d.slice(0, sep).trim() : ''
                      const val = sep !== -1 ? d.slice(sep + 1).trim() : d
                      return (
                        <p key={i} className="text-[12.5px] text-slate-600 leading-snug break-words">
                          {key ? (
                            <>
                              <span className="font-bold text-slate-800">{key}:</span> {val}
                            </>
                          ) : (
                            d
                          )}
                        </p>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}