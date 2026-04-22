'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { User } from 'lucide-react'

export interface Associate {
  name: string
  relation: string
  gender: string
  details?: string
}

interface FriendsAndAssociatesProps {
  data: Associate[]
  mainPerson: string
}

const CENTER_R = 72
const MEMBER_R = 44
const DETAIL_W = 230

const ringColor = (gender: string) =>
  gender.toLowerCase() === 'female' ? '#fda4af' : '#93c5fd'

export function FriendsAssociates({ data, mainPerson }: FriendsAndAssociatesProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize]           = useState({ w: 1000, h: 700 })
  const [scale, setScale]         = useState(0.85)
  const [pan, setPan]             = useState({ x: 0, y: 0 })
  const [dragging, setDragging]   = useState(false)
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const drag0 = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect
      setSize({ w: Math.max(800, r.width), h: Math.max(600, r.height) })
    })
    ro.observe(el); return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const fn = (e: WheelEvent) => {
      e.preventDefault()
      setScale(s => Math.min(2.5, Math.max(0.25, s - e.deltaY * 0.001)))
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

  // Deduplicate
  const members = useMemo(() => {
    const seen = new Set<string>()
    return data.filter(m => {
      const key = `${m.name.toLowerCase().trim()}|${m.relation.toLowerCase().trim()}`
      if (seen.has(key)) return false
      seen.add(key)
      return m.name?.trim().length > 0
    })
  }, [data])

  // Orbit radius — scales with member count
  const ORBIT = Math.min(cx - MEMBER_R - 60, cy - MEMBER_R - 80, Math.max(220, members.length * 28))

  const nodes = useMemo(() => {
    const n = members.length
    if (n === 0) return []
    return members.map((m, i) => {
      const angle = -Math.PI / 2 + (i / n) * 2 * Math.PI
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

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden bg-gradient-to-br from-[#eef3fb] to-[#f8faff] select-none ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
      onClick={() => setSelected(new Set())}
    >
      {/* hint */}
      <div className="absolute bottom-3 left-3 z-50 pointer-events-none text-[11px] text-slate-400 bg-white/80 px-2 py-1 rounded-lg border border-slate-100">
        {Math.round(scale * 100)}% • Scroll to zoom • Drag to pan • Click member for details
      </div>

      {/* zoomable layer */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`,
          transformOrigin: `${cx}px ${cy}px`,
        }}
      >
        {/* SVG lines + relation labels */}
        <svg
          className="absolute inset-0 overflow-visible pointer-events-none"
          style={{ width: size.w, height: size.h }}
        >
          {nodes.map(node => {
            const angle = node.angle
            const x1 = cx + (CENTER_R + 6) * Math.cos(angle)
            const y1 = cy + (CENTER_R + 6) * Math.sin(angle)
            const x2 = node.x - (MEMBER_R + 4) * Math.cos(angle)
            const y2 = node.y - (MEMBER_R + 4) * Math.sin(angle)
            const lx = (x1 + x2) / 2
            const ly = (y1 + y2) / 2
            return (
              <g key={node.id}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#93c5fd" strokeWidth={1.5} opacity={0.8} strokeLinecap="round" />
                <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight={600} fill="#64748b" style={{ userSelect: 'none' }}>
                  {node.relation}
                </text>
              </g>
            )
          })}
        </svg>

        {/* CENTER CIRCLE */}
        <div
          className="absolute np"
          style={{ left: cx - CENTER_R, top: cy - CENTER_R, width: CENTER_R * 2, height: CENTER_R * 2, zIndex: 20 }}
        >
          <div className="absolute inset-[-18px] rounded-full bg-blue-400/10 animate-pulse pointer-events-none" />
          <div className="absolute inset-[-6px] rounded-full bg-blue-500 shadow-2xl pointer-events-none" />
          <div className="absolute inset-[-1px] rounded-full bg-white pointer-events-none" />
          <div className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-slate-200 z-10">
            <User className="w-1/2 h-1/2 text-slate-400" />
          </div>
          <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none">
            <span className="text-[14px] font-extrabold text-slate-800 bg-white/90 px-3 py-1 rounded-full shadow-sm border border-slate-200">
              {mainPerson || 'Subject'}
            </span>
          </div>
        </div>

        {/* SATELLITE NODES */}
        {nodes.map(node => {
          const rc = ringColor(node.gender)
          return (
            <div
              key={node.id}
              className="absolute np"
              style={{ left: node.x - MEMBER_R, top: node.y - MEMBER_R, width: MEMBER_R * 2, height: MEMBER_R * 2, zIndex: selected.has(node.id) ? 30 : 15 }}
              onClick={e => { e.stopPropagation(); toggleSelected(node.id) }}
            >
              <div className="absolute inset-[-4px] rounded-full pointer-events-none" style={{ background: rc, opacity: 0.3 }} />
              <div className="absolute inset-[-2px] rounded-full pointer-events-none" style={{ border: `2.5px solid ${rc}` }} />
              <div className="relative w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-slate-100 cursor-pointer shadow-md z-10 hover:shadow-lg transition-shadow">
                <User className="w-1/2 h-1/2 text-slate-400" />
              </div>
              <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none whitespace-nowrap">
                <span className="text-[13px] font-bold text-slate-800">{node.name}</span>
                <span className="text-[11px] text-slate-500 capitalize">{node.relation}</span>
              </div>
            </div>
          )
        })}

        {/* DETAIL POPUPS — outside node divs, canvas coordinates */}
        {nodes.map(node => {
          if (!selected.has(node.id)) return null
          const angle = node.angle
          const POPUP_OFFSET = MEMBER_R + 20
          const goRight = Math.cos(angle) >= 0
          const popupX = goRight
            ? node.x + POPUP_OFFSET
            : node.x - POPUP_OFFSET - DETAIL_W
          const popupY = node.y - MEMBER_R

          return (
            <div
              key={`popup_${node.id}`}
              className="absolute np bg-white rounded-2xl shadow-lg border border-slate-200 p-5"
              style={{ left: popupX, top: popupY, width: DETAIL_W, zIndex: 50 }}
              onClick={e => e.stopPropagation()}
            >
              <p className="text-[16px] font-extrabold text-slate-900 leading-tight">{node.name}</p>
              <p className="text-[12px] text-slate-400 capitalize mb-3 mt-0.5">{node.relation}</p>
              {node.details.length > 0 ? (
                <div className="space-y-2">
                  {node.details.map((d: string, i: number) => (
                    <p key={i} className="text-[13px] text-slate-600 leading-snug">{d}</p>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-slate-400 italic">No additional details</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
